const {
  ItemCatalogo, Producto, Catalogo, Pujo, Asistente, RegistroDeSubasta, Multa,
} = require('../models');

const COSTO_ENVIO = 850;
const MULTA_PORC = 0.10;
const HORAS_MULTA = 72;

/** Factura del ganador de un ítem. La comisión sale del itemsCatalogo. */
function calcularFactura(item, montoPujado, { retiroPersonal = false } = {}) {
  const monto_pujado = Number(montoPujado);
  const comision = Number(item.comision);
  const costo_envio = retiroPersonal ? 0 : COSTO_ENVIO;
  return { monto_pujado, comision, costo_envio, total: +(monto_pujado + comision + costo_envio).toFixed(2) };
}

/** Pujo ganador (mayor importe) de un ítem + el cliente. */
async function pujoGanador(itemId) {
  return Pujo.findOne({ where: { item: itemId }, order: [['importe', 'DESC']], include: [{ model: Asistente, as: 'asistenteRel' }] });
}

/** Cierra un ítem: marca subastado y deja el pujo ganador. Devuelve el resultado. */
async function cerrarItem(itemId) {
  const item = await ItemCatalogo.findByPk(itemId);
  if (!item || item.subastado === 'si') return null;
  const top = await pujoGanador(itemId);
  item.subastado = 'si';
  await item.save();
  if (top) {
    top.ganador = 'si';
    await top.save();
    return { resultado: 'vendida', lider_id: top.asistenteRel ? top.asistenteRel.cliente : null, importe: Number(top.importe) };
  }
  return { resultado: 'sin_ofertas', lider_id: null };
}

/** Aplica una multa (10% del valor ofertado) al cliente. */
async function aplicarMulta(clienteId, valorOfertado) {
  return Multa.create({
    cliente: clienteId,
    monto: +(valorOfertado * MULTA_PORC).toFixed(2),
    fechaLimite: new Date(Date.now() + HORAS_MULTA * 3600 * 1000),
    estado: 'con_deuda',
  });
}

/** Paga un ítem ganado: descuenta del medio y registra la venta; si no alcanza,
 *  aplica multa. */
async function pagarPieza({ usuario, item, medio, retiroPersonal }) {
  const top = await pujoGanador(item.identificador);
  const montoPujado = top ? Number(top.importe) : Number(item.precioBase);
  const f = calcularFactura(item, montoPujado, { retiroPersonal });

  if (f.total > Number(medio.saldoDisponible)) {
    const multa = await aplicarMulta(usuario.id, montoPujado);
    return { ok: false, multa, factura: f };
  }

  // Producto -> duenio y subasta del item.
  const prod = await Producto.findByPk(item.producto);
  const cat = await Catalogo.findByPk(item.catalogo);

  // Evita doble registro.
  const existe = await RegistroDeSubasta.findOne({ where: { producto: item.producto, cliente: usuario.id } });
  if (!existe) {
    await RegistroDeSubasta.create({
      subasta: cat ? cat.subasta : null,
      duenio: prod ? prod.duenio : null,
      producto: item.producto,
      cliente: usuario.id,
      importe: f.total,
      comision: f.comision,
    });
  }
  medio.saldoDisponible = Number(medio.saldoDisponible) - f.total;
  await medio.save();
  if (item.subastado !== 'si') { item.subastado = 'si'; await item.save(); }
  return { ok: true, factura: f };
}

module.exports = { calcularFactura, cerrarItem, aplicarMulta, pagarPieza, COSTO_ENVIO };
