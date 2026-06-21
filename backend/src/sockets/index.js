const jwt = require('jsonwebtoken');
const { Usuario, Subasta, Pieza, Multa } = require('../models');
const { registrarPuja, subastaComprometida } = require('../services/pujaService');
const { cerrarPieza } = require('../services/ventaService');
const { JWT_SECRET } = require('../middleware/auth');

// Duración de una subasta una vez que arranca (primer puja): se cierra al minuto.
const DURACION_SUBASTA_MS = Number(process.env.DURACION_SUBASTA_MS || 60000);
// Anti-sniping: si alguien puja faltando menos de UMBRAL, el cierre se estira a
// EXTENSION (la subasta no termina hasta que nadie supere la última oferta).
const EXTENSION_UMBRAL_MS = Number(process.env.EXTENSION_UMBRAL_MS || 15000);
const EXTENSION_MS = Number(process.env.EXTENSION_MS || 30000);

/**
 * Motor de pujas en tiempo real.
 *
 * Reglas implementadas:
 *  - Autenticación del socket vía JWT (handshake.auth.token).
 *  - "Una sola sala a la vez": un usuario no puede unirse a 2 subastas.
 *  - COMPROMISO: si ya pujó en una subasta activa, no puede entrar a otra
 *    (queda atado a esa hasta que termine; las demás quedan bloqueadas).
 *  - "Confirmación secuencial": no se procesa otra puja del mismo usuario
 *    hasta confirmar (o rechazar) la anterior.
 *  - Cierre automático POR PIEZA: cada pieza se cierra al minuto de su primer
 *    puja y se declara su ganador. La subasta sólo termina cuando ya no quedan
 *    piezas abiertas (las demás piezas NO desaparecen al cerrar una).
 */
function initSockets(io, app) {
  // Mapa usuario_id -> id_subasta (sala activa). Compartido con el controller
  // de streaming para validar "una sala a la vez" también por REST.
  const salasUsuarios = {};
  app.set('salasUsuarios', salasUsuarios);

  // Usuarios con una puja en curso (lock de secuencialidad).
  const pujaEnCurso = new Set();
  // Temporizadores de cierre por PIEZA (pieza_id -> { cierra_ts, timer }).
  const cierres = {};

  /**
   * Cierra UNA pieza al vencer su reloj: declara su ganador (o compra de la
   * empresa si no hubo ofertas) y avisa a la sala. Si esa era la última pieza
   * abierta de la subasta, recién ahí finaliza la subasta completa.
   */
  async function cerrarPiezaTimer(idPieza) {
    delete cierres[idPieza];
    const pieza = await Pieza.findByPk(idPieza);
    if (!pieza || pieza.estado !== 'en_subasta') return;
    const idSubasta = pieza.subasta_id;

    const r = await cerrarPieza(idPieza); // vende al líder o marca sin_ofertas
    const piezaCerrada = await Pieza.findByPk(idPieza);

    io.to(`subasta_${idSubasta}`).emit('pieza_cerrada', {
      id_subasta: idSubasta,
      id_pieza: idPieza,
      titulo: piezaCerrada.titulo,
      lider_id: piezaCerrada.lider_id,
      resultado: r ? r.resultado : 'sin_cambios',
    });

    // ¿Quedan piezas abiertas? Si no, la subasta termina.
    const abiertas = await Pieza.count({ where: { subasta_id: idSubasta, estado: 'en_subasta' } });
    if (abiertas === 0) {
      const subasta = await Subasta.findByPk(idSubasta);
      if (subasta && subasta.estado !== 'finalizada') {
        subasta.estado = 'finalizada';
        await subasta.save();
      }
      io.to(`subasta_${idSubasta}`).emit('subasta_cerrada', { id_subasta: idSubasta });
      Object.keys(salasUsuarios).forEach((uid) => {
        if (String(salasUsuarios[uid]) === String(idSubasta)) delete salasUsuarios[uid];
      });
    }
  }

  // Middleware de autenticación del socket.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Token no provisto'));
      const payload = jwt.verify(token, JWT_SECRET);
      const usuario = await Usuario.findByPk(payload.id_usuario);
      if (!usuario) return next(new Error('Usuario inexistente'));
      socket.usuario = usuario;
      next();
    } catch (err) {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    const usuario = socket.usuario;

    /* Unirse a la sala de una subasta. Si ya está comprometido (pujó) en otra
       subasta activa, queda bloqueado: no puede entrar a esta. */
    socket.on('join_subasta', async ({ id_subasta, id_pieza }) => {
      // Con una multa pendiente la cuenta está bloqueada: no puede unirse.
      const multa = await Multa.findOne({ where: { usuario_id: usuario.id, estado: 'con_deuda' } });
      if (multa) {
        socket.emit('error_sala', {
          motivo: 'Tenés una multa pendiente. Pagala para volver a participar en subastas.',
        });
        return;
      }
      const comprometida = await subastaComprometida(usuario.id);
      if (comprometida && String(comprometida) !== String(id_subasta)) {
        socket.emit('error_sala', {
          motivo: `Estás participando en la subasta #${comprometida} hasta que termine.`,
        });
        return;
      }
      const salaActual = salasUsuarios[usuario.id];
      if (salaActual && String(salaActual) !== String(id_subasta)) {
        socket.leave(`subasta_${salaActual}`); // libera la sala anterior (si no está comprometido)
      }
      const room = `subasta_${id_subasta}`;
      socket.join(room);
      salasUsuarios[usuario.id] = id_subasta;
      socket.emit('sala_unida', { id_subasta });
      // Si la PIEZA que está mirando ya tiene cierre programado, informa cuánto falta.
      if (id_pieza != null && cierres[id_pieza]) {
        const cierra_ts = cierres[id_pieza].cierra_ts;
        socket.emit('subasta_timer', {
          id_subasta,
          id_pieza,
          cierra_ts,
          segundos_restantes: Math.max(0, Math.round((cierra_ts - Date.now()) / 1000)),
        });
      }
    });

    /* Salir de la sala. No libera el compromiso (eso lo hace el cierre). */
    socket.on('leave_subasta', ({ id_subasta }) => {
      socket.leave(`subasta_${id_subasta}`);
      delete salasUsuarios[usuario.id];
    });

    /* Realizar una puja en tiempo real. */
    socket.on('nueva_puja', async ({ id_subasta, id_pieza, monto, id_medio_pago }) => {
      // Lock de secuencialidad: una puja a la vez por usuario.
      if (pujaEnCurso.has(usuario.id)) {
        socket.emit('puja_rechazada', { motivo: 'Esperá la confirmación de tu puja anterior' });
        return;
      }
      pujaEnCurso.add(usuario.id);
      try {
        const resultado = await registrarPuja({
          usuario,
          idSubasta: id_subasta,
          idPieza: id_pieza,
          monto: Number(monto),
          medioPagoId: id_medio_pago,
        });

        if (!resultado.ok) {
          socket.emit('puja_rechazada', { motivo: resultado.motivo });
          return;
        }

        // Confirma SOLO al emisor (recién ahí el cliente habilita otra puja).
        socket.emit('puja_confirmada', {
          id_pieza: resultado.id_pieza,
          monto: resultado.nueva_oferta_lider,
        });

        // Broadcast de la nueva oferta líder a toda la sala.
        io.to(`subasta_${resultado.id_subasta}`).emit('oferta_actualizada', {
          id_pieza: resultado.id_pieza,
          nueva_oferta_lider: resultado.nueva_oferta_lider,
          lider_id: resultado.lider_id,
        });

        // Cierre automático POR PIEZA: al primer puja de esa pieza arranca su
        // reloj. Anti-sniping: si pujan faltando poco, se extiende. Cerrar una
        // pieza NO afecta a las demás piezas de la subasta.
        const sub = resultado.id_subasta;
        const key = resultado.id_pieza;
        let nuevoCierre = null;
        if (!cierres[key]) {
          nuevoCierre = Date.now() + DURACION_SUBASTA_MS;
        } else {
          const restante = cierres[key].cierra_ts - Date.now();
          if (restante < EXTENSION_UMBRAL_MS) {
            clearTimeout(cierres[key].timer);
            nuevoCierre = Date.now() + EXTENSION_MS;
          }
        }
        if (nuevoCierre) {
          const ms = nuevoCierre - Date.now();
          cierres[key] = { cierra_ts: nuevoCierre, timer: setTimeout(() => cerrarPiezaTimer(key), ms) };
          io.to(`subasta_${sub}`).emit('subasta_timer', {
            id_subasta: sub,
            id_pieza: key,
            cierra_ts: nuevoCierre,
            segundos_restantes: Math.max(0, Math.round(ms / 1000)),
          });
        }
      } catch (err) {
        socket.emit('puja_rechazada', { motivo: 'Error al procesar la puja' });
      } finally {
        pujaEnCurso.delete(usuario.id);
      }
    });

    socket.on('disconnect', () => {
      delete salasUsuarios[usuario.id];
      pujaEnCurso.delete(usuario.id);
    });
  });
}

module.exports = { initSockets };
