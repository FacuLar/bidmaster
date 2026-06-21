const { Usuario, Pieza, Subasta, Puja, MedioPago, Multa } = require('../models');
const { puedeAcceder, exentoLimiteSuperior } = require('./categoriaService');
const { Op } = require('sequelize');

const PORC_MIN = 0.01; // +1% del valor base
const PORC_MAX = 0.20; // +20% del valor base

/**
 * Calcula los límites de una puja válida sobre una pieza.
 * referencia = última oferta (o el precio base si todavía no hubo ofertas).
 */
function calcularLimites(pieza, categoriaSubasta) {
  const referencia = pieza.oferta_actual > 0 ? pieza.oferta_actual : pieza.precio_base;
  const minimo = referencia + PORC_MIN * pieza.precio_base;
  const maximo = referencia + PORC_MAX * pieza.precio_base;
  return {
    minimo,
    maximo,
    sinLimiteSuperior: exentoLimiteSuperior(categoriaSubasta),
  };
}

/**
 * Verifica que el usuario pueda pujar (sin registrar nada).
 * Lanza un objeto { status, motivo } si algo falla.
 */
async function validarPuja({ usuario, pieza, subasta, monto, medioPagoId }) {
  // Multa / suspensión: no puede pujar con deuda activa.
  if (usuario.estado === 'suspendido') {
    return { ok: false, status: 403, motivo: 'Cuenta suspendida por multa impaga' };
  }
  const multaActiva = await Multa.findOne({
    where: { usuario_id: usuario.id, estado: 'con_deuda' },
  });
  if (multaActiva) {
    return { ok: false, status: 403, motivo: 'Tenés una multa pendiente de pago' };
  }

  // No se puede pujar por el propio bien.
  if (pieza.dueno_id != null && String(pieza.dueno_id) === String(usuario.id)) {
    return { ok: false, status: 403, motivo: 'No podés pujar por tu propio bien' };
  }

  // Subasta y pieza vigentes.
  if (subasta.estado === 'finalizada') {
    return { ok: false, status: 400, motivo: 'La subasta ya finalizó' };
  }
  if (pieza.estado === 'vendida') {
    return { ok: false, status: 400, motivo: 'La pieza ya fue vendida' };
  }

  // Una subasta a la vez: si ya pujó en OTRA subasta activa, queda atado a esa
  // hasta que termine (vale tanto para el WebSocket como para el REST).
  const comprometida = await subastaComprometida(usuario.id);
  if (comprometida && String(comprometida) !== String(subasta.id)) {
    return {
      ok: false,
      status: 403,
      motivo: `Ya estás participando en otra subasta activa (#${comprometida}). Esperá a que termine.`,
    };
  }

  // Categoría suficiente.
  if (!puedeAcceder(usuario.categoria, subasta.categoria_requerida)) {
    return { ok: false, status: 403, motivo: 'Categoría insuficiente para esta subasta' };
  }

  // Debe tener al menos un medio de pago verificado EN LA MONEDA de la subasta.
  // (Las subastas en dólares se cancelan en dólares; no son bimonetarias).
  const medioVerificado = await MedioPago.findOne({
    where: { usuario_id: usuario.id, estado_verificacion: 'Verificado', moneda: subasta.moneda },
  });
  if (!medioVerificado) {
    return {
      ok: false,
      status: 403,
      motivo: `Necesitás un medio de pago verificado en ${subasta.moneda} para pujar en esta subasta`,
    };
  }

  // Rango de la oferta (1% - 20% del valor base sobre la última oferta).
  const { minimo, maximo, sinLimiteSuperior } = calcularLimites(pieza, subasta.categoria_requerida);
  if (monto < minimo) {
    return {
      ok: false,
      status: 400,
      motivo: `La puja debe ser de al menos ${minimo.toFixed(2)} (oferta actual + 1% del valor base)`,
    };
  }
  if (!sinLimiteSuperior && monto > maximo) {
    return {
      ok: false,
      status: 400,
      motivo: `La puja no puede superar ${maximo.toFixed(2)} (oferta actual + 20% del valor base)`,
    };
  }

  // Si paga con cheque certificado: la puja no puede superar el saldo garantizado.
  if (medioPagoId) {
    const medio = await MedioPago.findOne({
      where: { id: medioPagoId, usuario_id: usuario.id, estado_verificacion: 'Verificado' },
    });
    if (!medio) {
      return { ok: false, status: 400, motivo: 'Medio de pago no válido o no verificado' };
    }
    if (medio.tipo === 'CHEQUE' && monto > medio.saldo_disponible) {
      return {
        ok: false,
        status: 400,
        motivo: 'El monto supera el saldo del cheque certificado',
      };
    }
  }

  return { ok: true, minimo, maximo };
}

/**
 * Valida y registra la puja de forma atómica. Devuelve el nuevo estado líder.
 * Usado tanto por el endpoint REST como por el WebSocket.
 */
async function registrarPuja({ usuario, idSubasta, idPieza, monto, medioPagoId }) {
  const pieza = await Pieza.findByPk(idPieza);
  if (!pieza) return { ok: false, status: 404, motivo: 'Pieza inexistente' };
  const subasta = await Subasta.findByPk(idSubasta || pieza.subasta_id);
  if (!subasta) return { ok: false, status: 404, motivo: 'Subasta inexistente' };

  const validacion = await validarPuja({ usuario, pieza, subasta, monto, medioPagoId });
  if (!validacion.ok) return validacion;

  // Orden secuencial por pieza.
  const ultimaOrden = (await Puja.max('orden', { where: { pieza_id: pieza.id } })) || 0;
  await Puja.create({
    monto,
    orden: ultimaOrden + 1,
    usuario_id: usuario.id,
    pieza_id: pieza.id,
    subasta_id: subasta.id,
  });

  // Actualiza el líder de la pieza.
  pieza.oferta_actual = monto;
  pieza.lider_id = usuario.id;
  await pieza.save();

  return {
    ok: true,
    estado: 'Puja Aceptada',
    nueva_oferta_lider: monto,
    lider_id: usuario.id,
    id_pieza: pieza.id,
    id_subasta: subasta.id,
  };
}

/**
 * Devuelve el id de la subasta a la que el usuario está COMPROMETIDO: aquella
 * (todavía activa) en la que ya pujó. Mientras tenga una puja en una subasta
 * activa no puede entrar/pujar en otra (queda atado hasta que esa termine).
 * Devuelve null si no está comprometido con ninguna.
 */
async function subastaComprometida(usuarioId) {
  // Atado sólo si tiene una puja en una pieza TODAVÍA ABIERTA (en_subasta) de una
  // subasta activa. Si su pieza ya cerró, queda libre para participar en otra.
  const puja = await Puja.findOne({
    where: { usuario_id: usuarioId },
    include: [
      { model: Subasta, as: 'subasta', where: { estado: 'activa' }, required: true },
      { model: Pieza, as: 'pieza', where: { estado: 'en_subasta' }, required: true },
    ],
    order: [['createdAt', 'DESC']],
  });
  return puja ? puja.subasta_id : null;
}

module.exports = {
  calcularLimites, validarPuja, registrarPuja, subastaComprometida, PORC_MIN, PORC_MAX,
};
