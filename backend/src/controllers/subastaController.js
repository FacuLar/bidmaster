const { Op } = require('sequelize');
const { Subasta, Pieza, MedioPago, Usuario } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { puedeAcceder } = require('../services/categoriaService');
const { subastaComprometida } = require('../services/pujaService');

/* 3.1 Listar Subastas Activas (Home) — GET /subastas?moneda=&categoria= */
const listarSubastas = asyncHandler(async (req, res) => {
  // Se muestran las programadas (todavía no arrancaron) y las activas (en curso).
  const where = { estado: { [Op.in]: ['programada', 'activa'] } };
  if (req.query.moneda) where.moneda = req.query.moneda; // ARS / USD

  const subastas = await Subasta.findAll({
    where,
    include: [{ model: Pieza, as: 'piezas' }],
    order: [['fecha', 'ASC']],
  });

  const data = subastas.map((s) => ({
    id_subasta: s.id,
    titulo: s.titulo,
    fecha: s.fecha,
    hora: s.hora,
    moneda: s.moneda,
    rematador: s.rematador,
    categoria_requerida: s.categoria_requerida,
    ubicacion: s.ubicacion,
    estado: s.estado,                 // programada | activa
    en_curso: s.estado === 'activa',
    pieza_actual_id: s.pieza_actual_id,
    cantidad_piezas: s.piezas ? s.piezas.length : 0,
    // El usuario logueado sabe si puede o no acceder.
    accesible: req.usuario ? puedeAcceder(req.usuario.categoria, s.categoria_requerida) : null,
  }));

  res.status(200).json(data);
});

/* 3.2 Detalle de Piezas (Catálogo) — GET /subastas/:id/catalogo
   Oculta el precio base si el usuario no está logueado. */
const catalogo = asyncHandler(async (req, res) => {
  const subasta = await Subasta.findByPk(req.params.id, {
    include: [{ model: Pieza, as: 'piezas' }],
  });
  if (!subasta) throw new AppError('Subasta inexistente', 404);

  const logueado = !!req.usuario;
  const piezas = subasta.piezas.map((p) => ({
    id_pieza: p.id,
    nro_pieza: p.nro_pieza,
    titulo: p.titulo,
    descripcion: p.descripcion,
    artista: p.artista,
    fecha_obra: p.fecha_obra,
    historia: p.historia,
    imagenes: p.imagenes,
    categoria: p.categoria,
    tags: p.tags || [],
    uso: p.uso,
    oferta_actual: p.oferta_actual,
    estado: p.estado,
    // Sólo los usuarios registrados ven el precio base.
    precio_base: logueado ? p.precio_base : null,
  }));

  res.status(200).json({
    id_subasta: subasta.id,
    titulo: subasta.titulo,
    moneda: subasta.moneda,
    categoria_requerida: subasta.categoria_requerida,
    rematador: subasta.rematador,
    piezas,
  });
});

/* 3.3 Conectar a Streaming — GET /subastas/:id/streaming
   Valida categoría + medio verificado + que no esté en otra sala. */
const streaming = asyncHandler(async (req, res) => {
  const subasta = await Subasta.findByPk(req.params.id);
  if (!subasta) throw new AppError('Subasta inexistente', 404);

  // No se puede entrar a una subasta ya finalizada.
  if (subasta.estado === 'finalizada') {
    throw new AppError('La subasta ya finalizó', 400);
  }

  // Cuenta suspendida (multa impaga): no accede a los servicios.
  if (req.usuario.estado === 'suspendido') {
    throw new AppError('Cuenta suspendida por multa impaga: regularizá para acceder', 403);
  }

  if (!puedeAcceder(req.usuario.categoria, subasta.categoria_requerida)) {
    throw new AppError('Categoría insuficiente para esta subasta', 403);
  }

  // Medio de pago: el usuario elige cuál usar (id_medio). Si no manda ninguno,
  // se toma el primero verificado en la moneda de la subasta (compatibilidad).
  let medioVerificado;
  if (req.query.id_medio) {
    medioVerificado = await MedioPago.findOne({
      where: {
        id: req.query.id_medio, usuario_id: req.usuario.id,
        estado_verificacion: 'Verificado', moneda: subasta.moneda,
      },
    });
    if (!medioVerificado) {
      throw new AppError(`El medio elegido no es válido o no está verificado en ${subasta.moneda}`, 403);
    }
  } else {
    medioVerificado = await MedioPago.findOne({
      where: { usuario_id: req.usuario.id, estado_verificacion: 'Verificado', moneda: subasta.moneda },
    });
    if (!medioVerificado) {
      throw new AppError(`Necesitás un medio de pago verificado en ${subasta.moneda}`, 403);
    }
  }

  // No se puede entrar con un medio que no cubra ni el precio base de la pieza.
  if (req.query.id_pieza) {
    const pieza = await Pieza.findByPk(req.query.id_pieza);
    if (pieza && medioVerificado.saldo_disponible < pieza.precio_base) {
      throw new AppError(
        'El medio seleccionado no tiene saldo para cubrir el precio base de esta pieza. Elegí otro o cargá fondos.',
        403,
      );
    }
  }

  // COMPROMISO: si el usuario ya pujó en otra subasta que sigue activa, queda
  // atado a esa hasta que termine; las demás le quedan bloqueadas.
  const comprometida = await subastaComprometida(req.usuario.id);
  if (comprometida && String(comprometida) !== String(subasta.id)) {
    throw new AppError(
      `Estás participando en la subasta #${comprometida} hasta que termine. Las demás quedan bloqueadas.`,
      403,
    );
  }

  const base = process.env.STREAM_BASE_URL || 'wss://stream.bidmaster.com';
  res.status(200).json({
    url_stream: `${base}/${subasta.id}`,
    // Medio de pago que se usará en esta subasta (se define al iniciar).
    medio_pago: {
      id: medioVerificado.id,
      tipo: medioVerificado.tipo,
      entidad: medioVerificado.entidad,
      numero: medioVerificado.numero_identificador,
      moneda: medioVerificado.moneda,
      saldo_disponible: medioVerificado.saldo_disponible,
    },
  });
});

/* ADMIN — Comenzar una subasta (arranca el remate secuencial ítem por ítem).
   POST /admin/subastas/:id/comenzar  (header x-admin-key) */
const adminComenzarSubasta = asyncHandler(async (req, res) => {
  const engine = req.app.get('subastaEngine');
  if (!engine) throw new AppError('Motor de subastas no disponible', 503);
  const r = await engine.arrancar(req.params.id);
  if (!r.ok) throw new AppError(r.motivo, 400);
  res.status(200).json({
    mensaje: 'Subasta iniciada. Se remata ítem por ítem.',
    id_subasta: Number(req.params.id),
    total_items: r.total_items,
  });
});

module.exports = { listarSubastas, catalogo, streaming, adminComenzarSubasta };
