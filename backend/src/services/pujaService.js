const {
  Subasta, Catalogo, ItemCatalogo, Producto, Asistente, Pujo, Multa,
} = require('../models');
const { puedeAcceder, exentoLimiteSuperior } = require('./categoriaService');
const { ofertaLider } = require('./mapeo');

const PORC_MIN = 0.01;
const PORC_MAX = 0.20;

/** Subasta a la que el cliente está atado: tiene un pujo en un ítem aún no
 *  rematado de una subasta abierta. */
async function subastaComprometida(clienteId) {
  const asistentes = await Asistente.findAll({
    where: { cliente: clienteId },
    include: [{ model: Subasta, as: 'subastaRel' }],
    order: [['identificador', 'DESC']],
  });
  for (const a of asistentes) {
    if (a.subastaRel && a.subastaRel.estado === 'abierta') {
      const pujo = await Pujo.findOne({ where: { asistente: a.identificador }, include: [{ model: ItemCatalogo, as: 'itemRel' }] });
      if (pujo && pujo.itemRel && pujo.itemRel.subastado !== 'si') return a.subasta;
    }
  }
  return null;
}

function calcularLimites(precioBase, ofertaActual, categoriaSubasta) {
  const ref = ofertaActual > 0 ? ofertaActual : precioBase;
  return {
    minimo: ref + PORC_MIN * precioBase,
    maximo: ref + PORC_MAX * precioBase,
    sinLimiteSuperior: exentoLimiteSuperior(categoriaSubasta),
  };
}

/** Asegura que el cliente sea ASISTENTE de la subasta (con número de postor). */
async function asegurarAsistente(clienteId, subastaId) {
  let a = await Asistente.findOne({ where: { cliente: clienteId, subasta: subastaId } });
  if (!a) {
    const cuantos = await Asistente.count({ where: { subasta: subastaId } });
    a = await Asistente.create({ cliente: clienteId, subasta: subastaId, numeroPostor: cuantos + 1 });
  }
  return a;
}

/** Valida + registra una puja sobre un ItemCatalogo. */
async function registrarPuja({ usuario, idSubasta, idPieza, monto, medioPagoId }) {
  const item = await ItemCatalogo.findByPk(idPieza, { include: [{ model: Producto, as: 'productoRel' }, { model: Catalogo, as: 'catalogoRel' }] });
  if (!item) return { ok: false, status: 404, motivo: 'Ítem inexistente' };
  const subastaId = idSubasta || (item.catalogoRel ? item.catalogoRel.subasta : null);
  const subasta = await Subasta.findByPk(subastaId);
  if (!subasta) return { ok: false, status: 404, motivo: 'Subasta inexistente' };

  // Multa pendiente.
  const multa = await Multa.findOne({ where: { cliente: usuario.id, estado: 'con_deuda' } });
  if (multa) return { ok: false, status: 403, motivo: 'Tenés una multa pendiente de pago' };
  // No pujar por el propio bien.
  if (item.productoRel && String(item.productoRel.duenio) === String(usuario.id)) {
    return { ok: false, status: 403, motivo: 'No podés pujar por tu propio bien' };
  }
  if (subasta.estado === 'cerrada') return { ok: false, status: 400, motivo: 'La subasta ya finalizó' };
  if (item.subastado === 'si') return { ok: false, status: 400, motivo: 'El ítem ya fue rematado' };
  if (!puedeAcceder(usuario.categoria, subasta.categoria || 'comun')) {
    return { ok: false, status: 403, motivo: 'Categoría insuficiente para esta subasta' };
  }
  // Compromiso: una subasta a la vez.
  const comprometida = await subastaComprometida(usuario.id);
  if (comprometida && String(comprometida) !== String(subastaId)) {
    return { ok: false, status: 403, motivo: `Ya estás participando en otra subasta activa (#${comprometida}).` };
  }

  const base = Number(item.precioBase);
  const { oferta_actual } = await ofertaLider(item.identificador);
  const { minimo, maximo, sinLimiteSuperior } = calcularLimites(base, oferta_actual, subasta.categoria || 'comun');
  if (monto < minimo) return { ok: false, status: 400, motivo: `La puja debe ser de al menos ${minimo.toFixed(2)} (oferta actual + 1% del valor base)` };
  if (!sinLimiteSuperior && monto > maximo) return { ok: false, status: 400, motivo: `La puja no puede superar ${maximo.toFixed(2)} (oferta actual + 20% del valor base)` };

  // Cheque: la puja no puede superar el saldo garantizado.
  if (medioPagoId) {
    const { MedioPago } = require('../models');
    const medio = await MedioPago.findOne({ where: { identificador: medioPagoId, cliente: usuario.id, estadoVerificacion: 'Verificado' } });
    if (!medio) return { ok: false, status: 400, motivo: 'Medio de pago no válido o no verificado' };
    if (medio.tipo === 'CHEQUE' && monto > Number(medio.saldoDisponible)) {
      return { ok: false, status: 400, motivo: 'El monto supera el saldo del cheque certificado' };
    }
  }

  const asistente = await asegurarAsistente(usuario.id, subastaId);
  await Pujo.create({ asistente: asistente.identificador, item: item.identificador, importe: monto, ganador: 'no' });

  return { ok: true, estado: 'Puja Aceptada', nueva_oferta_lider: monto, lider_id: usuario.id, id_pieza: item.identificador, id_subasta: subastaId };
}

module.exports = { calcularLimites, registrarPuja, subastaComprometida, PORC_MIN, PORC_MAX };
