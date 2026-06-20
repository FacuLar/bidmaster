const { Pieza, Venta, Usuario, MedioPago, Multa } = require('../models');

const COMISION = 0.10;       // 10% sobre lo pujado
const COSTO_ENVIO = 850;     // costo de envío a domicilio (a cargo del comprador)
const MULTA_PORC = 0.10;     // multa = 10% del valor ofertado
const HORAS_MULTA = 72;

/**
 * Calcula el desglose de la liquidación para el ganador de una pieza.
 * retiroPersonal=true => sin costo de envío (pierde la cobertura del seguro).
 */
function calcularFactura(pieza, { retiroPersonal = false } = {}) {
  const monto_pujado = pieza.oferta_actual;
  const comision = +(monto_pujado * COMISION).toFixed(2);
  const costo_envio = retiroPersonal ? 0 : COSTO_ENVIO;
  const total = +(monto_pujado + comision + costo_envio).toFixed(2);
  return { monto_pujado, comision, costo_envio, total };
}

/**
 * Cierra una pieza al finalizar la subasta.
 * - Si hubo ofertas: el líder es el nuevo dueño y se registra la venta.
 * - Si no hubo ofertas: la empresa la compra al precio base.
 */
async function cerrarPieza(piezaId) {
  const pieza = await Pieza.findByPk(piezaId);
  if (!pieza || pieza.estado === 'vendida') return null;

  if (!pieza.lider_id) {
    // Sin ofertas: la empresa la compra al valor base.
    pieza.estado = 'sin_ofertas';
    await pieza.save();
    return { resultado: 'compra_empresa', precio: pieza.precio_base };
  }

  const { monto_pujado, comision, costo_envio, total } = calcularFactura(pieza);
  const venta = await Venta.create({
    monto_pujado,
    comision,
    costo_envio,
    total,
    pieza_id: pieza.id,
    usuario_id: pieza.lider_id,
  });

  // Nuevo dueño + pieza vendida.
  pieza.dueno_id = pieza.lider_id;
  pieza.estado = 'vendida';
  await pieza.save();

  return { resultado: 'vendida', venta };
}

/**
 * Aplica una multa del 10% del valor ofertado cuando el ganador no puede pagar.
 * Suspende la cuenta hasta que regularice y otorga 72hs de plazo.
 */
async function aplicarMulta(usuarioId, valorOfertado) {
  const monto = +(valorOfertado * MULTA_PORC).toFixed(2);
  const fecha_limite = new Date(Date.now() + HORAS_MULTA * 60 * 60 * 1000);
  const multa = await Multa.create({
    monto,
    fecha_limite,
    usuario_id: usuarioId,
    estado: 'con_deuda',
  });
  await Usuario.update({ estado: 'suspendido' }, { where: { id: usuarioId } });
  return multa;
}

/**
 * Procesa el pago de una pieza ganada con un medio de pago.
 * - Si el medio es un cheque y el total supera su saldo -> multa del 10%.
 * - Si alcanza -> registra/actualiza la venta como pagada y descuenta el saldo
 *   del cheque (las compras con cheque no pueden superar el monto certificado).
 */
async function pagarPieza({ usuario, pieza, medio, retiroPersonal }) {
  const f = calcularFactura(pieza, { retiroPersonal });

  // Fondos del medio de pago (tarjeta, cuenta o cheque): si el total supera el
  // saldo disponible, no puede pagar -> multa del 10%.
  if (f.total > medio.saldo_disponible) {
    const multa = await aplicarMulta(usuario.id, pieza.oferta_actual);
    return { ok: false, multa, factura: f };
  }

  // Registra/actualiza la venta como pagada.
  let venta = await Venta.findOne({ where: { pieza_id: pieza.id, usuario_id: usuario.id } });
  if (!venta) {
    venta = await Venta.create({
      monto_pujado: f.monto_pujado, comision: f.comision, costo_envio: f.costo_envio,
      total: f.total, retiro_personal: !!retiroPersonal,
      pieza_id: pieza.id, usuario_id: usuario.id, medio_pago_id: medio.id,
    });
  }
  venta.estado_pago = 'pagada';
  venta.medio_pago_id = medio.id;
  await venta.save();

  // Se descuenta el dinero del medio de pago utilizado (tarjeta/cuenta/cheque).
  medio.saldo_disponible -= f.total;
  await medio.save();

  // Nuevo dueño + pieza vendida.
  pieza.dueno_id = usuario.id;
  pieza.estado = 'vendida';
  await pieza.save();

  return { ok: true, venta, factura: f };
}

module.exports = {
  COMISION,
  COSTO_ENVIO,
  calcularFactura,
  cerrarPieza,
  aplicarMulta,
  pagarPieza,
};
