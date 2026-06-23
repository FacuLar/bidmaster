const jwt = require('jsonwebtoken');
const { Subasta, Catalogo, ItemCatalogo, Multa } = require('../models');
const { registrarPuja, subastaComprometida } = require('../services/pujaService');
const { cerrarItem } = require('../services/ventaService');
const { mapItem } = require('../services/mapeo');
const { JWT_SECRET, cargarUsuario } = require('../middleware/auth');

const DURACION_ITEM_MS = Number(process.env.DURACION_ITEM_MS || process.env.DURACION_SUBASTA_MS || 30000);
const EXTENSION_UMBRAL_MS = Number(process.env.EXTENSION_UMBRAL_MS || 15000);
const EXTENSION_MS = Number(process.env.EXTENSION_MS || 30000);

/**
 * Motor SECUENCIAL sobre el esquema de la cátedra: la subasta remata los
 * itemsCatalogo (subastado='no') uno por vez, en orden. Estado de "corriendo"
 * en memoria; al cerrar todos, la subasta pasa a 'cerrada'.
 */
function initSockets(io, app) {
  const room = (id) => `subasta_${id}`;
  const salasUsuarios = {};
  app.set('salasUsuarios', salasUsuarios);
  const pujaEnCurso = new Set();
  const motores = {};

  async function itemsDeSubasta(idSubasta) {
    const cats = await Catalogo.findAll({ where: { subasta: idSubasta } });
    const catIds = cats.map((c) => c.identificador);
    if (catIds.length === 0) return [];
    const items = await ItemCatalogo.findAll({ where: { catalogo: catIds, subastado: 'no' }, order: [['identificador', 'ASC']] });
    return items.map((i) => i.identificador);
  }

  async function snapshot(idSubasta, itemId, m) {
    const item = await ItemCatalogo.findByPk(itemId);
    const pieza = await mapItem(item);
    return {
      ...pieza,
      id_subasta: idSubasta,
      orden: m.idx + 1,
      total: m.items.length,
      cierra_ts: m.cierra_ts,
      segundos_restantes: Math.max(0, Math.round((m.cierra_ts - Date.now()) / 1000)),
    };
  }

  async function avanzar(idSubasta) {
    const m = motores[idSubasta];
    if (!m) return;
    m.idx += 1;
    if (m.idx >= m.items.length) return finalizar(idSubasta);
    const itemId = m.items[m.idx];
    const item = await ItemCatalogo.findByPk(itemId);
    if (!item || item.subastado === 'si') return avanzar(idSubasta);
    m.piezaActualId = itemId;
    m.cierra_ts = Date.now() + DURACION_ITEM_MS;
    m.timer = setTimeout(() => cerrarYAvanzar(idSubasta), DURACION_ITEM_MS);
    io.to(room(idSubasta)).emit('item_actual', await snapshot(idSubasta, itemId, m));
  }

  async function cerrarYAvanzar(idSubasta) {
    const m = motores[idSubasta];
    if (!m) return;
    const itemId = m.piezaActualId;
    const r = await cerrarItem(itemId);
    const item = await ItemCatalogo.findByPk(itemId);
    const pieza = await mapItem(item);
    io.to(room(idSubasta)).emit('item_cerrado', {
      id_subasta: idSubasta, id_pieza: itemId, titulo: pieza.titulo,
      resultado: r ? r.resultado : 'sin_cambios', lider_id: r ? r.lider_id : null,
    });
    await avanzar(idSubasta);
  }

  async function finalizar(idSubasta) {
    const m = motores[idSubasta];
    if (m && m.timer) clearTimeout(m.timer);
    delete motores[idSubasta];
    const subasta = await Subasta.findByPk(idSubasta);
    if (subasta && subasta.estado !== 'cerrada') { subasta.estado = 'cerrada'; await subasta.save(); }
    io.to(room(idSubasta)).emit('subasta_finalizada', { id_subasta: idSubasta });
    Object.keys(salasUsuarios).forEach((uid) => { if (String(salasUsuarios[uid]) === String(idSubasta)) delete salasUsuarios[uid]; });
  }

  function salaVacia(idSubasta) {
    const r = io.sockets.adapter.rooms.get(room(idSubasta));
    return !r || r.size === 0;
  }
  function pausarSiVacia(idSubasta) {
    const m = motores[idSubasta];
    if (!m || m.pausado || !salaVacia(idSubasta)) return;
    if (m.timer) clearTimeout(m.timer);
    m.restante = Math.max(1000, m.cierra_ts - Date.now());
    m.pausado = true;
  }
  async function reanudar(idSubasta) {
    const m = motores[idSubasta];
    if (!m || !m.pausado) return;
    m.cierra_ts = Date.now() + m.restante;
    m.timer = setTimeout(() => cerrarYAvanzar(idSubasta), m.restante);
    m.pausado = false;
    if (m.piezaActualId) io.to(room(idSubasta)).emit('item_actual', await snapshot(idSubasta, m.piezaActualId, m));
  }

  async function arrancarSubasta(idSubasta) {
    const subasta = await Subasta.findByPk(idSubasta);
    if (!subasta) return { ok: false, motivo: 'Subasta inexistente' };
    if (motores[idSubasta]) return { ok: false, motivo: 'La subasta ya está en curso' };
    if (subasta.estado === 'cerrada') return { ok: false, motivo: 'La subasta ya finalizó' };
    const items = await itemsDeSubasta(idSubasta);
    if (items.length === 0) { subasta.estado = 'cerrada'; await subasta.save(); return { ok: false, motivo: 'La subasta no tiene ítems para rematar' }; }
    motores[idSubasta] = { items, idx: -1 };
    await avanzar(idSubasta);
    return { ok: true, total_items: items.length };
  }

  app.set('subastaEngine', { arrancar: arrancarSubasta, enCurso: (id) => !!motores[id] });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Token no provisto'));
      const payload = jwt.verify(token, JWT_SECRET);
      const usuario = await cargarUsuario(payload.id_usuario);
      if (!usuario) return next(new Error('Usuario inexistente'));
      socket.usuario = usuario;
      next();
    } catch (err) { next(new Error('Token inválido')); }
  });

  io.on('connection', (socket) => {
    const usuario = socket.usuario;

    socket.on('join_subasta', async ({ id_subasta }) => {
      const multa = await Multa.findOne({ where: { cliente: usuario.id, estado: 'con_deuda' } });
      if (multa) { socket.emit('error_sala', { motivo: 'Tenés una multa pendiente. Pagala para volver a participar.' }); return; }
      const comprometida = await subastaComprometida(usuario.id);
      if (comprometida && String(comprometida) !== String(id_subasta)) {
        socket.emit('error_sala', { motivo: `Estás participando en la subasta #${comprometida} hasta que termine tu ítem.` });
        return;
      }
      const salaActual = salasUsuarios[usuario.id];
      if (salaActual && String(salaActual) !== String(id_subasta)) socket.leave(room(salaActual));
      socket.join(room(id_subasta));
      salasUsuarios[usuario.id] = id_subasta;
      socket.emit('sala_unida', { id_subasta });

      let yaEmitido = false;
      if (motores[id_subasta] && motores[id_subasta].pausado) { await reanudar(id_subasta); yaEmitido = true; } else if (!motores[id_subasta] && String(process.env.AUTO_START_SUBASTA || 'false').toLowerCase() === 'true') {
        const sub = await Subasta.findByPk(id_subasta);
        if (sub && sub.estado !== 'cerrada') { const r = await arrancarSubasta(id_subasta); yaEmitido = r.ok; }
      }
      if (yaEmitido) return;

      const m = motores[id_subasta];
      if (m && m.piezaActualId) {
        socket.emit('item_actual', await snapshot(id_subasta, m.piezaActualId, m));
      } else {
        const subasta = await Subasta.findByPk(id_subasta);
        socket.emit('subasta_estado', { id_subasta, estado: subasta && subasta.estado === 'cerrada' ? 'finalizada' : 'programada' });
      }
    });

    socket.on('leave_subasta', ({ id_subasta }) => {
      socket.leave(room(id_subasta));
      delete salasUsuarios[usuario.id];
      pausarSiVacia(id_subasta);
    });

    socket.on('nueva_puja', async ({ id_subasta, id_pieza, monto, id_medio_pago }) => {
      if (pujaEnCurso.has(usuario.id)) { socket.emit('puja_rechazada', { motivo: 'Esperá la confirmación de tu puja anterior' }); return; }
      const m = motores[id_subasta];
      if (!m || String(m.piezaActualId) !== String(id_pieza)) { socket.emit('puja_rechazada', { motivo: 'Ese ítem no se está rematando en este momento' }); return; }
      pujaEnCurso.add(usuario.id);
      try {
        const r = await registrarPuja({ usuario, idSubasta: id_subasta, idPieza: id_pieza, monto: Number(monto), medioPagoId: id_medio_pago });
        if (!r.ok) { socket.emit('puja_rechazada', { motivo: r.motivo }); return; }
        socket.emit('puja_confirmada', { id_pieza: r.id_pieza, monto: r.nueva_oferta_lider });
        io.to(room(id_subasta)).emit('oferta_actualizada', { id_pieza: r.id_pieza, nueva_oferta_lider: r.nueva_oferta_lider, lider_id: r.lider_id });
        const restante = m.cierra_ts - Date.now();
        if (restante < EXTENSION_UMBRAL_MS) {
          clearTimeout(m.timer);
          m.cierra_ts = Date.now() + EXTENSION_MS;
          m.timer = setTimeout(() => cerrarYAvanzar(id_subasta), EXTENSION_MS);
          io.to(room(id_subasta)).emit('item_timer', { id_subasta, id_pieza, cierra_ts: m.cierra_ts, segundos_restantes: Math.max(0, Math.round((m.cierra_ts - Date.now()) / 1000)) });
        }
      } catch (err) { socket.emit('puja_rechazada', { motivo: 'Error al procesar la puja' }); } finally { pujaEnCurso.delete(usuario.id); }
    });

    socket.on('disconnect', () => {
      const sub = salasUsuarios[usuario.id];
      delete salasUsuarios[usuario.id];
      pujaEnCurso.delete(usuario.id);
      if (sub != null) setImmediate(() => pausarSiVacia(sub));
    });
  });
}

module.exports = { initSockets };
