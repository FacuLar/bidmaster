const { Pieza, Venta, Subasta, MedioPago, Multa } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { registrarPuja } = require('../services/pujaService');
const { calcularFactura, pagarPieza } = require('../services/ventaService');
const { actualizarCategoria } = require('../services/usuarioService');

/* 4.1 Realizar Puja Dinámica — POST /pujas
   (También disponible por WebSocket para el tiempo real). */
const pujar = asyncHandler(async (req, res) => {
  const { id_subasta, id_pieza, monto_oferta, id_medio_pago } = req.body;
  if (!id_pieza || !monto_oferta) {
    throw new AppError('Pieza y monto son obligatorios', 400);
  }

  const resultado = await registrarPuja({
    usuario: req.usuario,
    idSubasta: id_subasta,
    idPieza: id_pieza,
    monto: Number(monto_oferta),
    medioPagoId: id_medio_pago,
  });

  if (!resultado.ok) throw new AppError(resultado.motivo, resultado.status || 400);

  // Notifica a la sala por WebSocket (si está disponible).
  const io = req.app.get('io');
  if (io) {
    io.to(`subasta_${resultado.id_subasta}`).emit('oferta_actualizada', {
      id_pieza: resultado.id_pieza,
      nueva_oferta_lider: resultado.nueva_oferta_lider,
      lider_id: resultado.lider_id,
    });
  }

  res.status(201).json({
    estado: resultado.estado,
    nueva_oferta_lider: resultado.nueva_oferta_lider,
  });
});

/* 4.2 Liquidación (Notificación de Compra) — GET /ventas/:id_pieza/factura */
const factura = asyncHandler(async (req, res) => {
  const pieza = await Pieza.findByPk(req.params.id_pieza);
  if (!pieza) throw new AppError('Pieza inexistente', 404);

  // Si ya existe la venta registrada (subasta cerrada), se devuelve esa.
  const venta = await Venta.findOne({
    where: { pieza_id: pieza.id, usuario_id: req.usuario.id },
  });

  if (venta) {
    return res.status(200).json({
      monto_pujado: venta.monto_pujado,
      comision_10_porciento: venta.comision,
      costo_envio: venta.costo_envio,
      total_a_pagar: venta.total,
    });
  }

  // Si la subasta sigue abierta pero el usuario es el líder, se muestra la
  // proyección del total a pagar.
  if (String(pieza.lider_id) !== String(req.usuario.id)) {
    throw new AppError('No sos el ganador de esta pieza', 403);
  }
  const f = calcularFactura(pieza, { retiroPersonal: req.query.retiro === 'true' });
  res.status(200).json({
    monto_pujado: f.monto_pujado,
    comision_10_porciento: f.comision,
    costo_envio: f.costo_envio,
    total_a_pagar: f.total,
  });
});

/* 4.3 Pagar la pieza ganada — POST /ventas/:id_pieza/pagar
   Liquida con un medio de pago. Si los fondos no alcanzan (cheque), aplica
   multa del 10% y suspende la cuenta (72hs). Tras pagar, evalúa mejora de categoría. */
const pagar = asyncHandler(async (req, res) => {
  const { id_medio_pago, retiro_personal } = req.body;
  const pieza = await Pieza.findByPk(req.params.id_pieza);
  if (!pieza) throw new AppError('Pieza inexistente', 404);

  // Sólo el ganador (líder) puede pagar.
  if (String(pieza.lider_id) !== String(req.usuario.id)) {
    throw new AppError('No sos el ganador de esta pieza', 403);
  }

  // Con una multa pendiente la cuenta está bloqueada: hay que pagarla primero.
  const multaActiva = await Multa.findOne({
    where: { usuario_id: req.usuario.id, estado: 'con_deuda' },
  });
  if (multaActiva) {
    throw new AppError('Tenés una multa pendiente. Pagala para reactivar tu cuenta y poder operar.', 403);
  }

  // Si la pieza ya fue pagada, no se vuelve a cobrar.
  const ventaPrevia = await Venta.findOne({
    where: { pieza_id: pieza.id, usuario_id: req.usuario.id },
  });
  if (ventaPrevia && ventaPrevia.estado_pago === 'pagada') {
    throw new AppError('Esta pieza ya está pagada', 400);
  }

  const subasta = await Subasta.findByPk(pieza.subasta_id);
  const medio = await MedioPago.findOne({
    where: { id: id_medio_pago, usuario_id: req.usuario.id, estado_verificacion: 'Verificado' },
  });
  if (!medio) throw new AppError('Medio de pago no válido o no verificado', 400);

  // Las subastas en dólares se cancelan en dólares (no bimonetario).
  if (medio.moneda !== subasta.moneda) {
    throw new AppError(`La subasta es en ${subasta.moneda}: pagá con un medio en ${subasta.moneda}`, 400);
  }

  const resultado = await pagarPieza({
    usuario: req.usuario, pieza, medio, retiroPersonal: retiro_personal === true,
  });

  if (!resultado.ok) {
    // 402 Payment Required: fondos insuficientes -> multa aplicada.
    return res.status(402).json({
      estado: 'multa_aplicada',
      mensaje: 'Fondos insuficientes. Se aplicó una multa del 10% y tenés 72hs para regularizar.',
      monto_multa: resultado.multa.monto,
      horas_restantes: 72,
    });
  }

  // Tras una compra exitosa, se evalúa la mejora de categoría.
  const categoria = await actualizarCategoria(req.usuario.id);

  res.status(200).json({
    estado: 'pagada',
    total_pagado: resultado.factura.total,
    nueva_categoria: categoria,
  });
});

module.exports = { pujar, factura, pagar };
