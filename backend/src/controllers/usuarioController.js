const {
  Asistente, Pujo, ItemCatalogo, Producto, RegistroDeSubasta, Multa, MedioPago,
} = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/* 1.3 Métricas del perfil — GET /usuarios/perfil/metricas */
const metricas = asyncHandler(async (req, res) => {
  const usuario = req.usuario;
  const [nombre, ...resto] = (usuario.nombre || '').split(' ');

  const asistentes = await Asistente.findAll({ where: { cliente: usuario.id } });
  const asistenteIds = asistentes.map((a) => a.identificador);
  const subastas_asistidas = new Set(asistentes.map((a) => a.subasta)).size;

  const pujas = asistenteIds.length ? await Pujo.findAll({ where: { asistente: asistenteIds } }) : [];
  const total_ofertado = pujas.reduce((a, p) => a + Number(p.importe), 0);
  const ganadores = pujas.filter((p) => p.ganador === 'si');

  const historial_pujas = [];
  for (const g of ganadores) {
    const item = await ItemCatalogo.findByPk(g.item, { include: [{ model: Producto, as: 'productoRel' }] });
    const prod = item ? item.productoRel : null;
    const reg = prod ? await RegistroDeSubasta.findOne({ where: { producto: prod.identificador, cliente: usuario.id } }) : null;
    const comision = item ? Number(item.comision) : 0;
    historial_pujas.push({
      id_pieza: g.item,
      titulo: prod ? prod.descripcionCatalogo : 'Pieza',
      moneda: 'ARS',
      resultado: 'Ganada',
      estado_pago: reg ? 'pagada' : 'pendiente',
      monto: Number(g.importe),
      comision,
      costo_envio: 0,
      total: reg ? Number(reg.importe) : Number(g.importe) + comision,
    });
  }

  const registros = await RegistroDeSubasta.findAll({ where: { cliente: usuario.id } });
  const total_invertido = registros.reduce((a, r) => a + Number(r.importe), 0);

  res.status(200).json({
    nombre: nombre || usuario.nombre,
    apellido: resto.join(' '),
    email: usuario.email,
    categoria: usuario.categoria,
    pais_origen: null,
    subastas_asistidas,
    subastas_ganadas: ganadores.length,
    total_invertido,
    total_ofertado,
    cantidad_pujas: pujas.length,
    historial_pujas,
  });
});

/* 1.4 Multas activas — GET /usuarios/multas */
const multas = asyncHandler(async (req, res) => {
  const multa = await Multa.findOne({ where: { cliente: req.usuario.id, estado: 'con_deuda' }, order: [['createdAt', 'DESC']] });
  if (!multa) return res.status(200).json({ estado: 'sin_deuda' });
  const horas_restantes = Math.max(0, Math.round((new Date(multa.fechaLimite).getTime() - Date.now()) / 3600000));
  res.status(200).json({ estado: 'con_deuda', id_multa: multa.identificador, monto_multa: Number(multa.monto), horas_restantes });
});

/* 1.5 Pagar multa — POST /usuarios/multas/pagar */
const pagarMulta = asyncHandler(async (req, res) => {
  const { id_medio_pago } = req.body;
  const multa = await Multa.findOne({ where: { cliente: req.usuario.id, estado: 'con_deuda' }, order: [['createdAt', 'DESC']] });
  if (!multa) throw new AppError('No tenés multas pendientes', 400);

  let medio;
  if (id_medio_pago) {
    medio = await MedioPago.findOne({ where: { identificador: id_medio_pago, cliente: req.usuario.id, estadoVerificacion: 'Verificado' } });
    if (!medio) throw new AppError('Medio de pago no válido o no verificado', 400);
  } else {
    medio = await MedioPago.findOne({ where: { cliente: req.usuario.id, estadoVerificacion: 'Verificado' }, order: [['saldoDisponible', 'DESC']] });
    if (!medio) throw new AppError('Necesitás un medio de pago verificado para pagar la multa', 400);
  }

  if (Number(medio.saldoDisponible) < Number(multa.monto)) {
    return res.status(402).json({ estado: 'sin_fondos', mensaje: 'El medio de pago no tiene fondos suficientes para pagar la multa.', monto_multa: Number(multa.monto) });
  }
  medio.saldoDisponible = Number(medio.saldoDisponible) - Number(multa.monto);
  await medio.save();
  multa.estado = 'pagada';
  await multa.save();

  res.status(200).json({
    estado: 'pagada', mensaje: 'Multa pagada. Ya podés volver a participar.',
    monto_pagado: Number(multa.monto), saldo_restante: Number(medio.saldoDisponible),
    medio: `${medio.tipo} ${medio.numeroIdentificador || ''}`.trim(),
  });
});

module.exports = { metricas, multas, pagarMulta };
