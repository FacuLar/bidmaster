const jwt = require('jsonwebtoken');
const { Usuario, Subasta, Pieza } = require('../models');
const { registrarPuja, subastaComprometida } = require('../services/pujaService');
const { cerrarPieza } = require('../services/ventaService');
const { JWT_SECRET } = require('../middleware/auth');

// Duración de una subasta una vez que arranca (primer puja): se cierra al minuto.
const DURACION_SUBASTA_MS = Number(process.env.DURACION_SUBASTA_MS || 60000);

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
 *  - Cierre automático: la subasta se cierra al minuto del primer puja y se
 *    declara ganador; ahí se libera el compromiso de los participantes.
 */
function initSockets(io, app) {
  // Mapa usuario_id -> id_subasta (sala activa). Compartido con el controller
  // de streaming para validar "una sala a la vez" también por REST.
  const salasUsuarios = {};
  app.set('salasUsuarios', salasUsuarios);

  // Usuarios con una puja en curso (lock de secuencialidad).
  const pujaEnCurso = new Set();
  // Temporizadores de cierre por subasta (subasta_id -> timeout).
  const cierres = {};

  /** Cierra una subasta: declara ganadores, avisa a la sala y libera locks. */
  async function cerrarSubasta(idSubasta) {
    delete cierres[idSubasta];
    const subasta = await Subasta.findByPk(idSubasta);
    if (!subasta || subasta.estado === 'finalizada') return;
    subasta.estado = 'finalizada';
    await subasta.save();

    const piezas = await Pieza.findAll({ where: { subasta_id: idSubasta } });
    const resultados = [];
    for (const p of piezas) {
      const r = await cerrarPieza(p.id);
      resultados.push({ id_pieza: p.id, titulo: p.titulo, lider_id: p.lider_id, resultado: r ? r.resultado : 'sin_cambios' });
    }

    io.to(`subasta_${idSubasta}`).emit('subasta_cerrada', { id_subasta: idSubasta, resultados });

    // Libera el lock de conexión de todos los que estaban en esa sala
    // (el compromiso se libera solo, porque la subasta ya no está 'activa').
    Object.keys(salasUsuarios).forEach((uid) => {
      if (String(salasUsuarios[uid]) === String(idSubasta)) delete salasUsuarios[uid];
    });
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
    socket.on('join_subasta', async ({ id_subasta }) => {
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
      // Si la subasta ya tiene cierre programado, informa cuánto falta.
      if (cierres[id_subasta]) {
        socket.emit('subasta_timer', { id_subasta, cierra_ts: cierres[id_subasta].cierra_ts });
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

        // Cierre automático: al primer puja, arranca el reloj de 1 minuto.
        if (!cierres[resultado.id_subasta]) {
          const cierra_ts = Date.now() + DURACION_SUBASTA_MS;
          cierres[resultado.id_subasta] = {
            cierra_ts,
            timer: setTimeout(() => cerrarSubasta(resultado.id_subasta), DURACION_SUBASTA_MS),
          };
          io.to(`subasta_${resultado.id_subasta}`).emit('subasta_timer', {
            id_subasta: resultado.id_subasta, cierra_ts,
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
