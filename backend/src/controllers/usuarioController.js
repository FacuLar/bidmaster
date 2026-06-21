const { Puja, Pieza, Venta, Multa, MedioPago, Usuario } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/* 1.3 Obtener Métricas del Perfil — GET /usuarios/perfil/metricas */
const metricas = asyncHandler(async (req, res) => {
  const usuario = req.usuario;

  // Subastas ganadas + total invertido (a partir de las ventas).
  const ventas = await Venta.findAll({
    where: { usuario_id: usuario.id },
    include: [{ model: Pieza, as: 'pieza' }],
  });
  const subastas_ganadas = ventas.length;
  // Sólo cuenta como invertido lo efectivamente PAGADO.
  const total_invertido = ventas
    .filter((v) => v.estado_pago === 'pagada')
    .reduce((acc, v) => acc + v.total, 0);

  // Subastas asistidas = subastas distintas en las que pujó + total ofertado.
  const pujas = await Puja.findAll({ where: { usuario_id: usuario.id } });
  const subastasDistintas = new Set(pujas.map((p) => p.subasta_id));
  const total_ofertado = pujas.reduce((acc, p) => acc + p.monto, 0);

  // Historial con datos suficientes para pagar desde "Mis Pujas".
  const historial_pujas = ventas.map((v) => ({
    id_pieza: v.pieza_id,
    titulo: v.pieza ? v.pieza.titulo : 'Pieza',
    resultado: 'Ganada',
    estado_pago: v.estado_pago, // pendiente | pagada | impaga
    monto: v.monto_pujado,
    comision: v.comision,
    costo_envio: v.costo_envio,
    total: v.total,
  }));

  res.status(200).json({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    categoria: usuario.categoria,
    pais_origen: usuario.pais_origen,
    subastas_asistidas: subastasDistintas.size,
    subastas_ganadas,
    total_invertido,
    total_ofertado,
    cantidad_pujas: pujas.length,
    historial_pujas,
  });
});

/* 1.4 Consultar Multas Activas — GET /usuarios/multas */
const multas = asyncHandler(async (req, res) => {
  const multa = await Multa.findOne({
    where: { usuario_id: req.usuario.id, estado: 'con_deuda' },
    order: [['createdAt', 'DESC']],
  });

  if (!multa) {
    return res.status(200).json({ estado: 'sin_deuda' });
  }

  const horas_restantes = Math.max(
    0,
    Math.round((new Date(multa.fecha_limite).getTime() - Date.now()) / (1000 * 60 * 60))
  );

  res.status(200).json({
    estado: 'con_deuda',
    id_multa: multa.id,
    monto_multa: multa.monto,
    horas_restantes,
  });
});

/* 1.5 Pagar la multa — POST /usuarios/multas/pagar
   Paga la multa activa con un medio de pago verificado y REACTIVA la cuenta.
   Hasta no pagarla, el usuario no puede pujar, unirse a subastas ni pagar piezas. */
const pagarMulta = asyncHandler(async (req, res) => {
  const { id_medio_pago } = req.body;
  const multa = await Multa.findOne({
    where: { usuario_id: req.usuario.id, estado: 'con_deuda' },
    order: [['createdAt', 'DESC']],
  });
  if (!multa) throw new AppError('No tenés multas pendientes', 400);

  // Medio: el indicado, o el verificado con mayor saldo.
  let medio;
  if (id_medio_pago) {
    medio = await MedioPago.findOne({
      where: { id: id_medio_pago, usuario_id: req.usuario.id, estado_verificacion: 'Verificado' },
    });
    if (!medio) throw new AppError('Medio de pago no válido o no verificado', 400);
  } else {
    medio = await MedioPago.findOne({
      where: { usuario_id: req.usuario.id, estado_verificacion: 'Verificado' },
      order: [['saldo_disponible', 'DESC']],
    });
    if (!medio) throw new AppError('Necesitás un medio de pago verificado para pagar la multa', 400);
  }

  if (medio.saldo_disponible < multa.monto) {
    return res.status(402).json({
      estado: 'sin_fondos',
      mensaje: 'El medio de pago no tiene fondos suficientes para pagar la multa.',
      monto_multa: multa.monto,
    });
  }

  medio.saldo_disponible -= multa.monto;
  await medio.save();
  multa.estado = 'pagada';
  await multa.save();
  await Usuario.update({ estado: 'activo' }, { where: { id: req.usuario.id } });

  res.status(200).json({
    estado: 'pagada',
    mensaje: 'Multa pagada. Tu cuenta fue reactivada.',
    monto_pagado: multa.monto,
  });
});

module.exports = { metricas, multas, pagarMulta };
