const {
  Subasta, Catalogo, ItemCatalogo, Producto, Foto, ClasificacionProducto,
  Subastador, Persona, MedioPago, Multa,
} = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { puedeAcceder } = require('../services/categoriaService');
const { subastaComprometida } = require('../services/pujaService');
const { mapItem } = require('../services/mapeo');

const includeItems = () => [{
  model: Catalogo, as: 'catalogos',
  include: [{
    model: ItemCatalogo, as: 'items',
    include: [{ model: Producto, as: 'productoRel', include: [{ model: Foto, as: 'fotos' }, { model: ClasificacionProducto, as: 'clasificacion' }] }],
  }],
}];

// Estado "de app" (programada/activa/finalizada) a partir del motor en memoria.
function estadoApp(subasta, engine) {
  if (subasta.estado === 'cerrada') return 'finalizada';
  return engine && engine.enCurso(subasta.identificador) ? 'activa' : 'programada';
}

async function tituloYRematador(subasta) {
  const cat = subasta.catalogos && subasta.catalogos[0];
  let rematador = '—';
  if (subasta.subastador) {
    const p = await Persona.findByPk(subasta.subastador);
    if (p) rematador = p.nombre;
  }
  return { titulo: cat ? cat.descripcion : `Subasta #${subasta.identificador}`, rematador };
}

/* 3.1 Listar subastas — GET /subastas?moneda= */
const listarSubastas = asyncHandler(async (req, res) => {
  // Esquema de la cátedra: no hay moneda; todo se maneja en ARS.
  if (req.query.moneda && req.query.moneda !== 'ARS') return res.status(200).json([]);
  const engine = req.app.get('subastaEngine');
  const subastas = await Subasta.findAll({ where: { estado: 'abierta' }, include: includeItems(), order: [['fecha', 'ASC']] });
  const data = [];
  for (const s of subastas) {
    const items = (s.catalogos || []).flatMap((c) => c.items || []);
    const { titulo, rematador } = await tituloYRematador(s);
    data.push({
      id_subasta: s.identificador,
      titulo,
      fecha: s.fecha,
      hora: s.hora,
      moneda: 'ARS',
      rematador,
      categoria_requerida: s.categoria || 'comun',
      ubicacion: s.ubicacion,
      estado: estadoApp(s, engine),
      en_curso: !!(engine && engine.enCurso(s.identificador)),
      cantidad_piezas: items.filter((i) => i.subastado !== 'si').length,
      accesible: req.usuario ? puedeAcceder(req.usuario.categoria, s.categoria || 'comun') : null,
    });
  }
  res.status(200).json(data);
});

/* 3.2 Catálogo — GET /subastas/:id/catalogo */
const catalogo = asyncHandler(async (req, res) => {
  const subasta = await Subasta.findByPk(req.params.id, { include: includeItems() });
  if (!subasta) throw new AppError('Subasta inexistente', 404);
  const logueado = !!req.usuario;
  const items = (subasta.catalogos || []).flatMap((c) => c.items || []);
  const piezas = [];
  for (const it of items) piezas.push(await mapItem(it, { logueado }));
  const { titulo, rematador } = await tituloYRematador(subasta);
  res.status(200).json({
    id_subasta: subasta.identificador,
    titulo,
    moneda: 'ARS',
    categoria_requerida: subasta.categoria || 'comun',
    rematador,
    piezas,
  });
});

/* 3.3 Entrar a la sala — GET /subastas/:id/streaming?id_medio=&id_pieza= */
const streaming = asyncHandler(async (req, res) => {
  const subasta = await Subasta.findByPk(req.params.id);
  if (!subasta) throw new AppError('Subasta inexistente', 404);
  if (subasta.estado === 'cerrada') throw new AppError('La subasta ya finalizó', 400);

  const multa = await Multa.findOne({ where: { cliente: req.usuario.id, estado: 'con_deuda' } });
  if (multa) throw new AppError('Tenés una multa pendiente: pagala para volver a entrar a las subastas', 403);

  if (!puedeAcceder(req.usuario.categoria, subasta.categoria || 'comun')) {
    throw new AppError('Categoría insuficiente para esta subasta', 403);
  }

  let medio;
  if (req.query.id_medio) {
    medio = await MedioPago.findOne({ where: { identificador: req.query.id_medio, cliente: req.usuario.id, estadoVerificacion: 'Verificado' } });
    if (!medio) throw new AppError('El medio elegido no es válido o no está verificado', 403);
  } else {
    medio = await MedioPago.findOne({ where: { cliente: req.usuario.id, estadoVerificacion: 'Verificado' } });
    if (!medio) throw new AppError('Necesitás un medio de pago verificado', 403);
  }
  if (req.query.id_pieza) {
    const item = await ItemCatalogo.findByPk(req.query.id_pieza);
    if (item && Number(medio.saldoDisponible) < Number(item.precioBase)) {
      throw new AppError('El medio seleccionado no tiene saldo para cubrir el precio base de esta pieza.', 403);
    }
  }
  const comprometida = await subastaComprometida(req.usuario.id);
  if (comprometida && String(comprometida) !== String(subasta.identificador)) {
    throw new AppError(`Estás participando en la subasta #${comprometida} hasta que termine tu ítem.`, 403);
  }

  const base = process.env.STREAM_BASE_URL || 'wss://stream.bidmaster.com';
  res.status(200).json({
    url_stream: `${base}/${subasta.identificador}`,
    medio_pago: {
      id: medio.identificador, tipo: medio.tipo, entidad: medio.entidad,
      numero: medio.numeroIdentificador, moneda: medio.moneda, saldo_disponible: Number(medio.saldoDisponible),
    },
  });
});

/* ADMIN — comenzar subasta */
const adminComenzarSubasta = asyncHandler(async (req, res) => {
  const engine = req.app.get('subastaEngine');
  if (!engine) throw new AppError('Motor de subastas no disponible', 503);
  const r = await engine.arrancar(req.params.id);
  if (!r.ok) throw new AppError(r.motivo, 400);
  res.status(200).json({ mensaje: 'Subasta iniciada. Se remata ítem por ítem.', id_subasta: Number(req.params.id), total_items: r.total_items });
});

module.exports = { listarSubastas, catalogo, streaming, adminComenzarSubasta };
