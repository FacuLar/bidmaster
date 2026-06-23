const { ItemCatalogo, RegistroDeSubasta, MedioPago, Multa } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { registrarPuja } = require('../services/pujaService');
const { calcularFactura, pagarPieza } = require('../services/ventaService');
const { ofertaLider } = require('../services/mapeo');
const { actualizarCategoria } = require('../services/usuarioService');

/* 4.1 Puja por REST — POST /pujas (el tiempo real va por WebSocket) */
const pujar = asyncHandler(async (req, res) => {
  const { id_subasta, id_pieza, monto_oferta, id_medio_pago } = req.body;
  if (!id_pieza || !monto_oferta) throw new AppError('Pieza y monto son obligatorios', 400);
  const r = await registrarPuja({ usuario: req.usuario, idSubasta: id_subasta, idPieza: id_pieza, monto: Number(monto_oferta), medioPagoId: id_medio_pago });
  if (!r.ok) throw new AppError(r.motivo, r.status || 400);
  const io = req.app.get('io');
  if (io) io.to(`subasta_${r.id_subasta}`).emit('oferta_actualizada', { id_pieza: r.id_pieza, nueva_oferta_lider: r.nueva_oferta_lider, lider_id: r.lider_id });
  res.status(201).json({ estado: r.estado, nueva_oferta_lider: r.nueva_oferta_lider });
});

/* 4.2 Factura — GET /ventas/:id_pieza/factura */
const factura = asyncHandler(async (req, res) => {
  const item = await ItemCatalogo.findByPk(req.params.id_pieza);
  if (!item) throw new AppError('Pieza inexistente', 404);

  const reg = await RegistroDeSubasta.findOne({ where: { producto: item.producto, cliente: req.usuario.id } });
  if (reg) {
    const comision = Number(reg.comision);
    return res.status(200).json({
      monto_pujado: Number(reg.importe) - comision,
      comision_10_porciento: comision,
      costo_envio: 0,
      total_a_pagar: Number(reg.importe),
    });
  }

  const { oferta_actual, lider_id } = await ofertaLider(item.identificador);
  if (String(lider_id) !== String(req.usuario.id)) throw new AppError('No sos el ganador de esta pieza', 403);
  const montoPujado = oferta_actual > 0 ? oferta_actual : Number(item.precioBase);
  const f = calcularFactura(item, montoPujado, { retiroPersonal: req.query.retiro === 'true' });
  res.status(200).json({ monto_pujado: f.monto_pujado, comision_10_porciento: f.comision, costo_envio: f.costo_envio, total_a_pagar: f.total });
});

/* 4.3 Pagar pieza ganada — POST /ventas/:id_pieza/pagar */
const pagar = asyncHandler(async (req, res) => {
  const { id_medio_pago, retiro_personal } = req.body;
  const item = await ItemCatalogo.findByPk(req.params.id_pieza);
  if (!item) throw new AppError('Pieza inexistente', 404);

  const { lider_id } = await ofertaLider(item.identificador);
  if (String(lider_id) !== String(req.usuario.id)) throw new AppError('No sos el ganador de esta pieza', 403);

  const multaActiva = await Multa.findOne({ where: { cliente: req.usuario.id, estado: 'con_deuda' } });
  if (multaActiva) throw new AppError('Tenés una multa pendiente. Pagala para poder operar.', 403);

  const ventaPrevia = await RegistroDeSubasta.findOne({ where: { producto: item.producto, cliente: req.usuario.id } });
  if (ventaPrevia) throw new AppError('Esta pieza ya está pagada', 400);

  if (item.subastado !== 'si') throw new AppError('La subasta sigue en curso. Vas a poder pagar cuando termine, si resultás ganador.', 403);

  const medio = await MedioPago.findOne({ where: { identificador: id_medio_pago, cliente: req.usuario.id, estadoVerificacion: 'Verificado' } });
  if (!medio) throw new AppError('Medio de pago no válido o no verificado', 400);

  const resultado = await pagarPieza({ usuario: req.usuario, item, medio, retiroPersonal: retiro_personal === true });
  if (!resultado.ok) {
    return res.status(402).json({
      estado: 'multa_aplicada',
      mensaje: 'Fondos insuficientes. Se aplicó una multa del 10% y tenés 72hs para regularizar.',
      monto_multa: Number(resultado.multa.monto), horas_restantes: 72,
    });
  }
  const categoria = await actualizarCategoria(req.usuario.id);
  res.status(200).json({
    estado: 'pagada', total_pagado: resultado.factura.total, saldo_restante: Number(medio.saldoDisponible),
    medio: `${medio.tipo} ${medio.numeroIdentificador || ''}`.trim(), nueva_categoria: categoria,
  });
});

module.exports = { pujar, factura, pagar };
