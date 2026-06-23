const jwt = require('jsonwebtoken');
const { Usuario, Subasta, Pieza, Multa } = require('../models');
const { registrarPuja, subastaComprometida } = require('../services/pujaService');
const { cerrarPieza } = require('../services/ventaService');
const { JWT_SECRET } = require('../middleware/auth');

// Duración de cada ÍTEM (no de toda la subasta): se remata uno por vez.
const DURACION_ITEM_MS = Number(process.env.DURACION_ITEM_MS || process.env.DURACION_SUBASTA_MS || 30000);
// Anti-sniping: si pujan faltando menos de UMBRAL, el ítem se extiende a EXTENSION.
const EXTENSION_UMBRAL_MS = Number(process.env.EXTENSION_UMBRAL_MS || 15000);
const EXTENSION_MS = Number(process.env.EXTENSION_MS || 30000);

/**
 * Motor de subastas SECUENCIAL en tiempo real.
 *
 * Modelo (consigna): cada subasta tiene un catálogo ordenado y se remata UN
 * ítem por vez. Cuando termina el tiempo de un ítem, gana el último postor y se
 * pasa automáticamente al siguiente, hasta que no quedan ítems.
 *
 * Reglas:
 *  - Autenticación del socket por JWT.
 *  - "Una sola sala a la vez" + compromiso por pieza abierta.
 *  - Sólo se puede pujar por el ÍTEM ACTUAL (el que se está rematando).
 *  - Confirmación secuencial: una puja a la vez por usuario.
 *  - Arranque manual por un administrador (POST /admin/subastas/:id/comenzar).
 */
function initSockets(io, app) {
  const room = (id) => `subasta_${id}`;

  // user_id -> id_subasta (sala activa). Compartido con el controller por REST.
  const salasUsuarios = {};
  app.set('salasUsuarios', salasUsuarios);

  const pujaEnCurso = new Set(); // lock de secuencialidad por usuario
  // Motores activos: id_subasta -> { piezas:[ids], idx, piezaActualId, cierra_ts, timer }
  const motores = {};

  async function snapshotItem(idSubasta, pieza, m) {
    return {
      id_subasta: idSubasta,
      id_pieza: pieza.id,
      nro_pieza: pieza.nro_pieza,
      titulo: pieza.titulo,
      descripcion: pieza.descripcion,
      imagenes: pieza.imagenes,
      artista: pieza.artista,
      historia: pieza.historia,
      precio_base: pieza.precio_base,
      oferta_actual: pieza.oferta_actual,
      lider_id: pieza.lider_id,
      orden: m.idx + 1,
      total: m.piezas.length,
      cierra_ts: m.cierra_ts,
      segundos_restantes: Math.max(0, Math.round((m.cierra_ts - Date.now()) / 1000)),
    };
  }

  // Pasa al siguiente ítem del catálogo (o finaliza si no quedan).
  async function avanzar(idSubasta) {
    const m = motores[idSubasta];
    if (!m) return;
    m.idx += 1;
    if (m.idx >= m.piezas.length) return finalizar(idSubasta);

    const pieza = await Pieza.findByPk(m.piezas[m.idx]);
    if (!pieza || pieza.estado !== 'en_subasta') return avanzar(idSubasta); // saltea ya resueltas

    m.piezaActualId = pieza.id;
    m.cierra_ts = Date.now() + DURACION_ITEM_MS;
    m.timer = setTimeout(() => cerrarYAvanzar(idSubasta), DURACION_ITEM_MS);

    const subasta = await Subasta.findByPk(idSubasta);
    if (subasta) { subasta.pieza_actual_id = pieza.id; await subasta.save(); }

    io.to(room(idSubasta)).emit('item_actual', await snapshotItem(idSubasta, pieza, m));
  }

  // Cierra el ítem actual (vende al líder o sin_ofertas) y avanza al siguiente.
  async function cerrarYAvanzar(idSubasta) {
    const m = motores[idSubasta];
    if (!m) return;
    const piezaId = m.piezaActualId;
    const r = await cerrarPieza(piezaId);
    const pieza = await Pieza.findByPk(piezaId);
    io.to(room(idSubasta)).emit('item_cerrado', {
      id_subasta: idSubasta,
      id_pieza: piezaId,
      titulo: pieza ? pieza.titulo : 'Ítem',
      resultado: r ? r.resultado : 'sin_cambios',
      lider_id: pieza ? pieza.lider_id : null,
    });
    await avanzar(idSubasta);
  }

  async function finalizar(idSubasta) {
    const m = motores[idSubasta];
    if (m && m.timer) clearTimeout(m.timer);
    delete motores[idSubasta];
    const subasta = await Subasta.findByPk(idSubasta);
    if (subasta && subasta.estado !== 'finalizada') {
      subasta.estado = 'finalizada';
      subasta.pieza_actual_id = null;
      await subasta.save();
    }
    io.to(room(idSubasta)).emit('subasta_finalizada', { id_subasta: idSubasta });
    Object.keys(salasUsuarios).forEach((uid) => {
      if (String(salasUsuarios[uid]) === String(idSubasta)) delete salasUsuarios[uid];
    });
  }

  // ¿La sala quedó sin nadie conectado?
  function salaVacia(idSubasta) {
    const r = io.sockets.adapter.rooms.get(room(idSubasta));
    return !r || r.size === 0;
  }

  // Pausa el remate si no queda nadie mirando (así la subasta NO se consume sola
  // ni desaparece del catálogo cuando te vas; se reanuda al volver a entrar).
  function pausarSiVacia(idSubasta) {
    const m = motores[idSubasta];
    if (!m || m.pausado || !salaVacia(idSubasta)) return;
    if (m.timer) clearTimeout(m.timer);
    m.restante = Math.max(1000, m.cierra_ts - Date.now());
    m.pausado = true;
  }

  // Reanuda el ítem actual desde donde quedó.
  async function reanudar(idSubasta) {
    const m = motores[idSubasta];
    if (!m || !m.pausado) return;
    m.cierra_ts = Date.now() + m.restante;
    m.timer = setTimeout(() => cerrarYAvanzar(idSubasta), m.restante);
    m.pausado = false;
    const pieza = await Pieza.findByPk(m.piezaActualId);
    if (pieza) io.to(room(idSubasta)).emit('item_actual', await snapshotItem(idSubasta, pieza, m));
  }

  // Arranca una subasta: la marca activa y empieza a rematar ítem por ítem.
  async function arrancarSubasta(idSubasta) {
    const subasta = await Subasta.findByPk(idSubasta);
    if (!subasta) return { ok: false, motivo: 'Subasta inexistente' };
    if (motores[idSubasta]) return { ok: false, motivo: 'La subasta ya está en curso' };
    if (subasta.estado === 'finalizada') return { ok: false, motivo: 'La subasta ya finalizó' };

    const piezas = await Pieza.findAll({
      where: { subasta_id: idSubasta },
      order: [['nro_pieza', 'ASC']],
    });
    const pendientes = piezas.filter((p) => p.estado === 'en_subasta').map((p) => p.id);
    if (pendientes.length === 0) {
      subasta.estado = 'finalizada';
      await subasta.save();
      return { ok: false, motivo: 'La subasta no tiene ítems para rematar' };
    }

    subasta.estado = 'activa';
    await subasta.save();
    motores[idSubasta] = { piezas: pendientes, idx: -1 };
    await avanzar(idSubasta);
    return { ok: true, total_items: pendientes.length };
  }

  // Expuesto al controller admin para arrancar por Postman.
  app.set('subastaEngine', { arrancar: arrancarSubasta, enCurso: (id) => !!motores[id] });

  /* ------------------------- Sockets de cliente ------------------------- */

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

    socket.on('join_subasta', async ({ id_subasta }) => {
      const multa = await Multa.findOne({ where: { usuario_id: usuario.id, estado: 'con_deuda' } });
      if (multa) {
        socket.emit('error_sala', { motivo: 'Tenés una multa pendiente. Pagala para volver a participar.' });
        return;
      }
      const comprometida = await subastaComprometida(usuario.id);
      if (comprometida && String(comprometida) !== String(id_subasta)) {
        socket.emit('error_sala', { motivo: `Estás participando en la subasta #${comprometida} hasta que termine tu ítem.` });
        return;
      }
      const salaActual = salasUsuarios[usuario.id];
      if (salaActual && String(salaActual) !== String(id_subasta)) {
        socket.leave(room(salaActual));
      }
      socket.join(room(id_subasta));
      salasUsuarios[usuario.id] = id_subasta;
      socket.emit('sala_unida', { id_subasta });

      // Al entrar: si la subasta está pausada (nadie la miraba) se reanuda donde
      // quedó. NO se auto-inicia: la subasta arranca manualmente por un admin
      // (POST /admin/subastas/:id/comenzar). Con AUTO_START_SUBASTA=true se puede
      // habilitar el arranque automático al entrar (apagado por defecto).
      let yaEmitido = false;
      if (motores[id_subasta] && motores[id_subasta].pausado) {
        await reanudar(id_subasta);
        yaEmitido = true;
      } else if (!motores[id_subasta] && String(process.env.AUTO_START_SUBASTA || 'false').toLowerCase() === 'true') {
        const sub = await Subasta.findByPk(id_subasta);
        if (sub && sub.estado !== 'finalizada') {
          const r = await arrancarSubasta(id_subasta);
          yaEmitido = r.ok;
        }
      }
      if (yaEmitido) return; // el item_actual ya salió

      // Estado actual: si está corriendo, manda el ítem en remate; si no, el estado.
      const m = motores[id_subasta];
      if (m && m.piezaActualId) {
        const pieza = await Pieza.findByPk(m.piezaActualId);
        if (pieza) socket.emit('item_actual', await snapshotItem(id_subasta, pieza, m));
      } else {
        const subasta = await Subasta.findByPk(id_subasta);
        socket.emit('subasta_estado', { id_subasta, estado: subasta ? subasta.estado : 'desconocida' });
      }
    });

    socket.on('leave_subasta', ({ id_subasta }) => {
      socket.leave(room(id_subasta));
      delete salasUsuarios[usuario.id];
      pausarSiVacia(id_subasta);
    });

    socket.on('nueva_puja', async ({ id_subasta, id_pieza, monto, id_medio_pago }) => {
      if (pujaEnCurso.has(usuario.id)) {
        socket.emit('puja_rechazada', { motivo: 'Esperá la confirmación de tu puja anterior' });
        return;
      }
      const m = motores[id_subasta];
      // Sólo se puede pujar por el ÍTEM ACTUAL.
      if (!m || String(m.piezaActualId) !== String(id_pieza)) {
        socket.emit('puja_rechazada', { motivo: 'Ese ítem no se está rematando en este momento' });
        return;
      }
      pujaEnCurso.add(usuario.id);
      try {
        const resultado = await registrarPuja({
          usuario, idSubasta: id_subasta, idPieza: id_pieza, monto: Number(monto), medioPagoId: id_medio_pago,
        });
        if (!resultado.ok) {
          socket.emit('puja_rechazada', { motivo: resultado.motivo });
          return;
        }
        socket.emit('puja_confirmada', { id_pieza: resultado.id_pieza, monto: resultado.nueva_oferta_lider });
        io.to(room(id_subasta)).emit('oferta_actualizada', {
          id_pieza: resultado.id_pieza,
          nueva_oferta_lider: resultado.nueva_oferta_lider,
          lider_id: resultado.lider_id,
        });

        // Anti-sniping: si faltaba poco, se extiende el reloj de ESTE ítem.
        const restante = m.cierra_ts - Date.now();
        if (restante < EXTENSION_UMBRAL_MS) {
          clearTimeout(m.timer);
          m.cierra_ts = Date.now() + EXTENSION_MS;
          m.timer = setTimeout(() => cerrarYAvanzar(id_subasta), EXTENSION_MS);
          io.to(room(id_subasta)).emit('item_timer', {
            id_subasta, id_pieza,
            cierra_ts: m.cierra_ts,
            segundos_restantes: Math.max(0, Math.round((m.cierra_ts - Date.now()) / 1000)),
          });
        }
      } catch (err) {
        socket.emit('puja_rechazada', { motivo: 'Error al procesar la puja' });
      } finally {
        pujaEnCurso.delete(usuario.id);
      }
    });

    socket.on('disconnect', () => {
      const sub = salasUsuarios[usuario.id];
      delete salasUsuarios[usuario.id];
      pujaEnCurso.delete(usuario.id);
      // Si el que se fue era el último de la sala, se pausa la subasta.
      if (sub != null) setImmediate(() => pausarSiVacia(sub));
    });
  });
}

module.exports = { initSockets };
