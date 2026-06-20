const { Puja, Pieza, Venta, Multa } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

/* 1.3 Obtener Métricas del Perfil — GET /usuarios/perfil/metricas */
const metricas = asyncHandler(async (req, res) => {
  const usuario = req.usuario;

  // Subastas ganadas + total invertido (a partir de las ventas).
  const ventas = await Venta.findAll({
    where: { usuario_id: usuario.id },
    include: [{ model: Pieza, as: 'pieza' }],
  });
  const subastas_ganadas = ventas.length;
  const total_invertido = ventas.reduce((acc, v) => acc + v.total, 0);

  // Subastas asistidas = subastas distintas en las que pujó + total ofertado.
  const pujas = await Puja.findAll({ where: { usuario_id: usuario.id } });
  const subastasDistintas = new Set(pujas.map((p) => p.subasta_id));
  const total_ofertado = pujas.reduce((acc, p) => acc + p.monto, 0);

  const historial_pujas = ventas.map((v) => ({
    titulo: v.pieza ? v.pieza.titulo : 'Pieza',
    resultado: 'Ganada',
    monto: v.monto_pujado,
  }));

  res.status(200).json({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    categoria: usuario.categoria,
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
    monto_multa: multa.monto,
    horas_restantes,
  });
});

module.exports = { metricas, multas };
