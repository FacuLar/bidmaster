const {
  PropuestaVenta, MedioPago, Subasta, Catalogo, ItemCatalogo, Producto, Foto,
  ClasificacionProducto, Duenio, Empleado,
} = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const COSTO_FLETE_DEVOLUCION = 1500;
const COMISION_DEFAULT = 10;

function leInteresa(titulo) {
  const t = (titulo || '').toLowerCase();
  if (t.trim().length < 3) return false;
  return !/(rot[oa]|basura|replica|trucho|fals[oa]|chatarra|quemad[oa])/.test(t);
}
function enCondiciones(titulo) {
  const t = (titulo || '').toLowerCase();
  return !/(dudos[oa]|dañad[oa]|deteriorad[oa]|incomplet[oa]|roto|rota)/.test(t);
}

// Asegura un Duenio para el cliente (Producto.duenio lo requiere).
async function asegurarDuenio(clienteId) {
  let d = await Duenio.findByPk(clienteId);
  if (!d) d = await Duenio.create({ identificador: clienteId, numeroPais: 32, verificacionFinanciera: 'si', verificacionJudicial: 'si', calificacionRiesgo: 3 });
  return d;
}
async function unEmpleado() { return (await Empleado.findOne()) || Empleado.create({ cargo: 'Revisor' }); }

// Subasta "de la Comunidad" (abierta) + su catálogo, donde caen los bienes aceptados.
async function obtenerComunidad() {
  let subasta = await Subasta.findOne({ where: { ubicacion: 'Salón Comunidad', estado: 'abierta' } });
  if (!subasta) {
    const en7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    subasta = await Subasta.create({ fecha: en7, hora: '19:00', estado: 'abierta', ubicacion: 'Salón Comunidad', capacidadAsistentes: 200, tieneDeposito: 'si', seguridadPropia: 'no', categoria: 'comun' });
  }
  let cat = await Catalogo.findOne({ where: { subasta: subasta.identificador } });
  if (!cat) { const emp = await unEmpleado(); cat = await Catalogo.create({ descripcion: 'Subasta de la Comunidad', subasta: subasta.identificador, responsable: emp.identificador }); }
  return { subasta, cat };
}

function mapPropuesta(p) {
  return {
    id_tramite: p.identificador,
    titulo: p.titulo,
    tipo_bien: p.tipo_bien,
    estado: p.estado,
    valor_base_sugerido: p.valor_base_sugerido != null ? Number(p.valor_base_sugerido) : null,
    comisiones: p.comisiones,
    fecha_subasta: p.fecha_subasta,
    monto_venta: p.monto_venta != null ? Number(p.monto_venta) : null,
    comision_cobrada: p.monto_venta != null ? +(Number(p.monto_venta) * (p.comisiones || COMISION_DEFAULT) / 100).toFixed(2) : null,
    metodo_devolucion: p.metodo_devolucion,
    costo_flete: p.costo_flete != null ? Number(p.costo_flete) : null,
    ubicacion_deposito: p.ubicacion_deposito,
    motivo_rechazo: p.motivo_rechazo,
    fecha_ingreso: p.createdAt,
  };
}

/* 5.0 GET /vendedores/articulos */
const listarArticulos = asyncHandler(async (req, res) => {
  const props = await PropuestaVenta.findAll({ where: { vendedor: req.usuario.id }, order: [['createdAt', 'DESC']] });
  res.status(200).json(props.map(mapPropuesta));
});

/* 5.1 POST /vendedores/articulos */
const proponerArticulo = asyncHandler(async (req, res) => {
  const {
    titulo, descripcion, historia, fotos, tipo_bien, qr_titulo, medio_pago_id,
    acepta_devolucion, acepta_terminos, declaracion_jurada_licita,
  } = req.body;
  if (!titulo) throw new AppError('El título del bien es obligatorio', 400);
  if (!Array.isArray(fotos) || fotos.length < 6) throw new AppError('Se requieren al menos 6 fotos del bien', 400);
  if (!declaracion_jurada_licita || !acepta_devolucion) throw new AppError('Debés aceptar las declaraciones juradas obligatorias', 400);
  if (!acepta_terminos) throw new AppError('Debés aceptar los términos y condiciones', 400);
  if (tipo_bien === 'auto' && !qr_titulo) throw new AppError('Para un automóvil necesitás adjuntar el QR del título', 400);

  let cuenta;
  if (medio_pago_id) {
    cuenta = await MedioPago.findOne({ where: { identificador: medio_pago_id, cliente: req.usuario.id, tipo: 'CUENTA' } });
    if (!cuenta) throw new AppError('La cuenta elegida no es válida', 400);
  } else {
    cuenta = await MedioPago.findOne({ where: { cliente: req.usuario.id, tipo: 'CUENTA' } });
  }
  if (!cuenta) throw new AppError('Para vender necesitás una cuenta corriente registrada en tu billetera', 400);

  const interesa = leInteresa(titulo);
  const p = await PropuestaVenta.create({
    vendedor: req.usuario.id, titulo, descripcion, historia, tipo_bien: tipo_bien || 'otro',
    fotos, qr_titulo: qr_titulo || null, medio_pago: cuenta.identificador,
    estado: interesa ? 'A inspeccionar' : 'Rechazado',
    motivo_rechazo: interesa ? null : 'El bien no es de interés para las subastas actuales',
  });
  res.status(201).json({
    id_tramite: p.identificador, estado: p.estado, interesa,
    mensaje: interesa ? 'Nos interesa tu bien. Traelo al depósito para inspeccionarlo.' : 'El bien no es de interés en este momento.',
  });
});

const buscarPropuesta = async (id, clienteId) => PropuestaVenta.findOne({ where: { identificador: id, vendedor: clienteId } });

/* 5.2 PATCH /vendedores/articulos/:id/inspeccion */
const confirmarInspeccion = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  const p = await buscarPropuesta(req.params.id, req.usuario.id);
  if (!p) throw new AppError('Artículo no encontrado', 404);
  if (p.estado !== 'A inspeccionar') throw new AppError('El artículo no está esperando inspección', 400);

  if (decision === 'CANCELAR') { p.estado = 'Cancelado'; await p.save(); return res.status(200).json({ estado: p.estado, mensaje: 'Cancelaste el envío del bien.' }); }
  if (decision !== 'ENVIAR') throw new AppError('Decisión inválida (ENVIAR / CANCELAR)', 400);

  if (enCondiciones(p.titulo)) {
    p.estado = 'Tasado';
    p.valor_base_sugerido = p.valor_base_sugerido || 12000;
    p.comisiones = COMISION_DEFAULT;
    p.fecha_subasta = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    p.ubicacion_deposito = 'Centro Logístico Sur - Pasillo 4B';
    p.seguro_compania = 'Seguros Patria S.A.';
    p.seguro_cobertura = p.valor_base_sugerido;
    await p.save();
    return res.status(200).json({
      estado: p.estado,
      tasacion: { valor_base: Number(p.valor_base_sugerido), comision_porcentaje: p.comisiones, fecha_subasta: p.fecha_subasta },
      mensaje: 'El bien pasó la inspección. Revisá la tasación propuesta.',
    });
  }
  p.estado = 'Rechazado';
  p.motivo_rechazo = 'El bien no está en condiciones tras la inspección';
  await p.save();
  res.status(200).json({ estado: p.estado, mensaje: 'El bien no está en condiciones. Retiralo o pedí la devolución con cargo de flete.' });
});

/* 5.3 PATCH /vendedores/articulos/:id/condiciones */
const responderCondiciones = asyncHandler(async (req, res) => {
  const { decision } = req.body;
  const p = await buscarPropuesta(req.params.id, req.usuario.id);
  if (!p) throw new AppError('Artículo no encontrado', 404);
  if (p.estado !== 'Tasado') throw new AppError('El artículo no tiene una tasación pendiente de respuesta', 400);

  if (decision === 'ACEPTAR') {
    const { subasta, cat } = await obtenerComunidad();
    await asegurarDuenio(req.usuario.id);
    const emp = await unEmpleado();
    const base = Number(p.valor_base_sugerido) || 10000;
    const prod = await Producto.create({
      fecha: subasta.fecha, disponible: 'si',
      descripcionCatalogo: p.titulo, descripcionCompleta: p.descripcion || p.titulo,
      revisor: emp.identificador, duenio: req.usuario.id,
    });
    const imgs = Array.isArray(p.fotos) ? p.fotos : [];
    if (imgs.length) await Foto.bulkCreate(imgs.map((f) => ({ producto: prod.identificador, foto: f })));
    await ClasificacionProducto.create({ producto: prod.identificador, categoria: p.tipo_bien || 'otros', tags: [], uso: 'usado' });
    const item = await ItemCatalogo.create({ catalogo: cat.identificador, producto: prod.identificador, precioBase: base, comision: Math.round(base * 0.1), subastado: 'no' });

    p.estado = 'Programado';
    p.producto = prod.identificador;
    p.fecha_subasta = subasta.fecha;
    await p.save();
    return res.status(200).json({
      estado: p.estado, mensaje: 'Aceptaste. Tu bien quedó incluido en la Subasta de la Comunidad y ya se puede subastar.',
      id_subasta: subasta.identificador, id_pieza: item.identificador, fecha_subasta: subasta.fecha,
    });
  }
  if (decision === 'RECHAZAR') {
    p.estado = 'Devuelto';
    p.motivo_rechazo = 'El vendedor no aceptó el valor base / comisiones';
    await p.save();
    return res.status(200).json({ estado: p.estado, mensaje: 'Rechazaste la tasación. Retirá el bien o pedí la devolución con cargo de flete.' });
  }
  throw new AppError('Decisión inválida (ACEPTAR / RECHAZAR)', 400);
});

/* 5.x PATCH /vendedores/articulos/:id/devolucion */
const confirmarDevolucion = asyncHandler(async (req, res) => {
  const { metodo } = req.body;
  const p = await buscarPropuesta(req.params.id, req.usuario.id);
  if (!p) throw new AppError('Artículo no encontrado', 404);
  if (!['Rechazado', 'Devuelto'].includes(p.estado)) throw new AppError('Este artículo no está en devolución', 400);

  if (metodo === 'RETIRO') {
    p.metodo_devolucion = 'retiro'; p.costo_flete = 0;
    if (!p.ubicacion_deposito) p.ubicacion_deposito = 'Centro Logístico Sur - Pasillo 4B';
    await p.save();
    return res.status(200).json({ metodo: 'retiro', mensaje: `Podés retirar el bien en ${p.ubicacion_deposito}, sin cargo.` });
  }
  if (metodo === 'ENVIO') {
    p.metodo_devolucion = 'envio'; p.costo_flete = COSTO_FLETE_DEVOLUCION;
    await p.save();
    let saldo_restante = null;
    let cuenta = p.medio_pago ? await MedioPago.findOne({ where: { identificador: p.medio_pago, cliente: req.usuario.id } }) : null;
    if (!cuenta) cuenta = await MedioPago.findOne({ where: { cliente: req.usuario.id, tipo: 'CUENTA' }, order: [['saldoDisponible', 'DESC']] });
    if (cuenta) { cuenta.saldoDisponible = Math.max(0, Number(cuenta.saldoDisponible) - COSTO_FLETE_DEVOLUCION); await cuenta.save(); saldo_restante = Number(cuenta.saldoDisponible); }
    return res.status(200).json({
      metodo: 'envio', costo_flete: COSTO_FLETE_DEVOLUCION, saldo_restante,
      mensaje: cuenta ? `Se devuelve a tu domicilio. Se descontaron $${COSTO_FLETE_DEVOLUCION} por el flete.` : 'Se devuelve con cargo de flete. Revisá la factura.',
    });
  }
  throw new AppError('Método inválido (RETIRO / ENVIO)', 400);
});

/* 5.4 GET /vendedores/articulos/:id/factura-flete */
const facturaFlete = asyncHandler(async (req, res) => {
  const p = await buscarPropuesta(req.params.id, req.usuario.id);
  if (!p) throw new AppError('Artículo no encontrado', 404);
  if (p.metodo_devolucion !== 'envio' || !p.costo_flete) throw new AppError('Este artículo no tiene una devolución con cargo', 400);
  res.status(200).json({ id_tramite: p.identificador, titulo: p.titulo, concepto: 'Devolución del bien con cargo al vendedor', motivo: p.motivo_rechazo, costo_flete: Number(p.costo_flete), total: Number(p.costo_flete) });
});

/* 5.5 GET /vendedores/articulos/:id/logistica */
const logistica = asyncHandler(async (req, res) => {
  const p = await buscarPropuesta(req.params.id, req.usuario.id);
  if (!p) throw new AppError('Artículo no encontrado', 404);
  res.status(200).json({
    ubicacion_deposito: p.ubicacion_deposito || 'Pendiente de asignación',
    seguro: { compania: p.seguro_compania || 'Pendiente', cobertura: p.seguro_cobertura ? Number(p.seguro_cobertura) : 0 },
  });
});

module.exports = { listarArticulos, proponerArticulo, confirmarInspeccion, responderCondiciones, confirmarDevolucion, facturaFlete, logistica };
