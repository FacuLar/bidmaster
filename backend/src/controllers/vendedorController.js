const { Articulo, MedioPago, Pieza, Subasta } = require('../models');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Devuelve (o crea) la subasta "programada" donde se incluyen los bienes que los
 * usuarios proponen y la empresa acepta. Permite probar el circuito completo:
 * un bien aceptado aparece en el catálogo y se puede rematar.
 */
async function obtenerSubastaComunidad() {
  let subasta = await Subasta.findOne({
    where: { titulo: 'Subasta de la Comunidad', estado: 'programada' },
  });
  if (!subasta) {
    const en7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    subasta = await Subasta.create({
      titulo: 'Subasta de la Comunidad', fecha: en7dias, hora: '19:00',
      moneda: 'ARS', categoria_requerida: 'comun', rematador: 'BidMaster',
      ubicacion: 'Salón Comunidad', estado: 'programada',
    });
  }
  return subasta;
}

const COSTO_FLETE_DEVOLUCION = 1500; // cargo de flete por devolución (#13)
const COMISION_DEFAULT = 10;         // % de comisión de la empresa

/* ---- Reglas HARDCODEADAS de la empresa (#9 interés, #12 inspección) ---- */
// ¿Le interesa el bien a la empresa para subastar? (hardcodeado)
function leInteresa(titulo) {
  const t = (titulo || '').toLowerCase();
  if (t.trim().length < 3) return false;
  return !/(rot[oa]|basura|replica|trucho|fals[oa]|chatarra|quemad[oa])/.test(t);
}
// Tras la inspección física, ¿el bien está en condiciones? (hardcodeado)
function enCondiciones(titulo) {
  const t = (titulo || '').toLowerCase();
  return !/(dudos[oa]|dañad[oa]|deteriorad[oa]|incomplet[oa]|roto|rota)/.test(t);
}

/* 5.0 Listar Mis Artículos — GET /vendedores/articulos
   El vendedor NO ve historial de la subasta, solo el resultado (#19). */
const listarArticulos = asyncHandler(async (req, res) => {
  const articulos = await Articulo.findAll({
    where: { usuario_id: req.usuario.id },
    order: [['createdAt', 'DESC']],
  });
  const data = articulos.map((a) => ({
    id_tramite: a.id_tramite,
    titulo: a.titulo,
    tipo_bien: a.tipo_bien,
    estado: a.estado,
    valor_base_sugerido: a.valor_base_sugerido,
    comisiones: a.comisiones,
    fecha_subasta: a.fecha_subasta,
    monto_venta: a.monto_venta,
    comision_cobrada: a.monto_venta != null ? +(a.monto_venta * (a.comisiones || COMISION_DEFAULT) / 100).toFixed(2) : null,
    metodo_devolucion: a.metodo_devolucion,
    costo_flete: a.costo_flete,
    ubicacion_deposito: a.ubicacion_deposito,
    motivo_rechazo: a.motivo_rechazo,
    fecha_ingreso: a.createdAt,
  }));
  res.status(200).json(data);
});

/* 5.1 Proponer un Bien — POST /vendedores/articulos
   Valida cuenta corriente (#20), 6 fotos, T&C, prueba (QR si es auto, #10) y
   evalúa el interés de la empresa (hardcodeado, #9). */
const proponerArticulo = asyncHandler(async (req, res) => {
  const {
    titulo, descripcion, historia, fotos, tipo_bien,
    qr_titulo, compraventa, fotos_prueba,
    acepta_devolucion, acepta_terminos, declaracion_jurada_licita, acredita_origen,
  } = req.body;

  if (!titulo) throw new AppError('El título del bien es obligatorio', 400);
  if (!Array.isArray(fotos) || fotos.length < 6) {
    throw new AppError('Se requieren al menos 6 fotos del bien', 400);
  }
  if (!declaracion_jurada_licita || !acepta_devolucion) {
    throw new AppError('Debés aceptar las declaraciones juradas obligatorias', 400);
  }
  if (!acepta_terminos) {
    throw new AppError('Debés aceptar los términos y condiciones', 400);
  }
  // Si es un auto, exige el QR del título como prueba de propiedad (#10).
  if (tipo_bien === 'auto' && !qr_titulo) {
    throw new AppError('Para un automóvil necesitás adjuntar el QR del título', 400);
  }
  // Los vendedores solo operan con cuenta corriente (#20).
  const cuenta = await MedioPago.findOne({ where: { usuario_id: req.usuario.id, tipo: 'CUENTA' } });
  if (!cuenta) {
    throw new AppError('Para vender necesitás una cuenta corriente registrada en tu billetera', 400);
  }

  // ¿Le interesa a la empresa? (hardcodeado)
  const interesa = leInteresa(titulo);

  const articulo = await Articulo.create({
    titulo, descripcion, historia,
    tipo_bien: tipo_bien || 'otro',
    fotos,
    qr_titulo: qr_titulo || null,
    compraventa: compraventa || null,
    fotos_prueba: Array.isArray(fotos_prueba) ? fotos_prueba : [],
    acepta_devolucion: !!acepta_devolucion,
    acepta_terminos: !!acepta_terminos,
    declaracion_jurada_licita: !!declaracion_jurada_licita,
    acredita_origen: !!acredita_origen,
    estado: interesa ? 'A inspeccionar' : 'Rechazado',
    motivo_rechazo: interesa ? null : 'El bien no es de interés para las subastas actuales',
    usuario_id: req.usuario.id,
  });

  res.status(201).json({
    id_tramite: articulo.id_tramite,
    estado: articulo.estado,
    interesa,
    mensaje: interesa
      ? 'Nos interesa tu bien. Tenés que traerlo al depósito para inspeccionarlo.'
      : 'El bien no es de interés para las subastas en este momento.',
  });
});

/* 5.2 Confirmar envío a inspección — PATCH /vendedores/articulos/:id/inspeccion
   La empresa pide traer el bien; el usuario decide enviarlo o no (#11). Si lo
   envía, se inspecciona (hardcodeado, #12): tasación o rechazo con flete (#12/#13). */
const confirmarInspeccion = asyncHandler(async (req, res) => {
  const { decision } = req.body; // ENVIAR / CANCELAR
  const articulo = await Articulo.findOne({
    where: { id_tramite: req.params.id, usuario_id: req.usuario.id },
  });
  if (!articulo) throw new AppError('Artículo no encontrado', 404);
  if (articulo.estado !== 'A inspeccionar') {
    throw new AppError('El artículo no está esperando inspección', 400);
  }

  if (decision === 'CANCELAR') {
    articulo.estado = 'Cancelado';
    await articulo.save();
    return res.status(200).json({ estado: articulo.estado, mensaje: 'Cancelaste el envío del bien.' });
  }
  if (decision !== 'ENVIAR') {
    throw new AppError('Decisión inválida (ENVIAR / CANCELAR)', 400);
  }

  // Inspección física (resultado hardcodeado).
  if (enCondiciones(articulo.titulo)) {
    articulo.estado = 'Tasado';
    articulo.valor_base_sugerido = articulo.valor_base_sugerido || 12000;
    articulo.comisiones = COMISION_DEFAULT;
    articulo.fecha_subasta = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // +14 días
    articulo.ubicacion_deposito = 'Centro Logístico Sur - Pasillo 4B';
    articulo.seguro_compania = 'Seguros Patria S.A.';
    articulo.seguro_cobertura = articulo.valor_base_sugerido;
    await articulo.save();
    return res.status(200).json({
      estado: articulo.estado,
      tasacion: {
        valor_base: articulo.valor_base_sugerido,
        comision_porcentaje: articulo.comisiones,
        fecha_subasta: articulo.fecha_subasta,
      },
      mensaje: 'El bien pasó la inspección. Revisá la tasación propuesta.',
    });
  }

  // No está en condiciones: rechazo. El usuario elige cómo recuperar el bien:
  // retirarlo él (#12) o que se lo devuelvan con cargo de flete (#13).
  articulo.estado = 'Rechazado';
  articulo.motivo_rechazo = 'El bien no está en condiciones tras la inspección';
  await articulo.save();
  res.status(200).json({
    estado: articulo.estado,
    mensaje: 'El bien no está en condiciones. Retiralo del depósito o pedí la devolución con cargo de flete.',
  });
});

/* 5.x Elegir cómo recuperar un bien rechazado — PATCH /vendedores/articulos/:id/devolucion
   RETIRO: lo busca el usuario, sin cargo (#12). ENVIO: se devuelve con flete (#13). */
const confirmarDevolucion = asyncHandler(async (req, res) => {
  const { metodo } = req.body; // RETIRO / ENVIO
  const articulo = await Articulo.findOne({
    where: { id_tramite: req.params.id, usuario_id: req.usuario.id },
  });
  if (!articulo) throw new AppError('Artículo no encontrado', 404);
  if (!['Rechazado', 'Devuelto'].includes(articulo.estado)) {
    throw new AppError('Este artículo no está en devolución', 400);
  }

  if (metodo === 'RETIRO') {
    articulo.metodo_devolucion = 'retiro';
    articulo.costo_flete = 0;
    if (!articulo.ubicacion_deposito) articulo.ubicacion_deposito = 'Centro Logístico Sur - Pasillo 4B';
    await articulo.save();
    return res.status(200).json({
      metodo: 'retiro',
      mensaje: `Podés retirar el bien en ${articulo.ubicacion_deposito}, sin cargo.`,
    });
  }
  if (metodo === 'ENVIO') {
    articulo.metodo_devolucion = 'envio';
    articulo.costo_flete = COSTO_FLETE_DEVOLUCION;
    await articulo.save();

    // El flete se cobra con cargo al vendedor: se descuenta de su cuenta corriente.
    let saldo_restante = null;
    const cuenta = await MedioPago.findOne({
      where: { usuario_id: req.usuario.id, tipo: 'CUENTA' },
      order: [['saldo_disponible', 'DESC']],
    });
    if (cuenta) {
      cuenta.saldo_disponible = Math.max(0, cuenta.saldo_disponible - COSTO_FLETE_DEVOLUCION);
      await cuenta.save();
      saldo_restante = cuenta.saldo_disponible;
    }

    return res.status(200).json({
      metodo: 'envio',
      costo_flete: articulo.costo_flete,
      saldo_restante,
      mensaje: cuenta
        ? `Se devuelve a tu domicilio. Se descontaron $${COSTO_FLETE_DEVOLUCION} de tu cuenta por el flete.`
        : 'Se devuelve a tu domicilio con cargo de flete. Revisá la factura.',
    });
  }
  throw new AppError('Método inválido (RETIRO / ENVIO)', 400);
});

/* 5.3 Aceptar/Rechazar Tasación — PATCH /vendedores/articulos/:id/condiciones (#14)
   El usuario acepta el valor base + comisión + fecha, o cancela (devolución con cargo). */
const responderCondiciones = asyncHandler(async (req, res) => {
  const { decision } = req.body; // ACEPTAR / RECHAZAR
  const articulo = await Articulo.findOne({
    where: { id_tramite: req.params.id, usuario_id: req.usuario.id },
  });
  if (!articulo) throw new AppError('Artículo no encontrado', 404);
  if (articulo.estado !== 'Tasado') {
    throw new AppError('El artículo no tiene una tasación pendiente de respuesta', 400);
  }

  if (decision === 'ACEPTAR') {
    // Al aceptar, el bien se incluye en una subasta real (programada) como pieza,
    // así puede rematarse y probar todo el circuito vendedor -> comprador.
    const subasta = await obtenerSubastaComunidad();
    const maxNro = (await Pieza.max('nro_pieza', { where: { subasta_id: subasta.id } })) || 900;
    const pieza = await Pieza.create({
      nro_pieza: maxNro + 1,
      titulo: articulo.titulo,
      descripcion: articulo.descripcion,
      historia: articulo.historia,
      precio_base: articulo.valor_base_sugerido || 10000,
      imagenes: Array.isArray(articulo.fotos) ? articulo.fotos : [],
      subasta_id: subasta.id,
      dueno_id: req.usuario.id,
      estado: 'en_subasta',
    });

    articulo.estado = 'Programado';
    articulo.pieza_id = pieza.id;
    articulo.fecha_subasta = subasta.fecha;
    await articulo.save();

    return res.status(200).json({
      estado: articulo.estado,
      mensaje: `Aceptaste. Tu bien quedó incluido en "${subasta.titulo}" y ya se puede subastar.`,
      id_subasta: subasta.id,
      id_pieza: pieza.id,
      fecha_subasta: subasta.fecha,
    });
  }
  if (decision === 'RECHAZAR') {
    articulo.estado = 'Devuelto';
    articulo.motivo_rechazo = 'El vendedor no aceptó el valor base / comisiones';
    await articulo.save();
    return res.status(200).json({
      estado: articulo.estado,
      mensaje: 'Rechazaste la tasación. Retirá el bien o pedí la devolución con cargo de flete.',
    });
  }
  throw new AppError('Decisión inválida (ACEPTAR / RECHAZAR)', 400);
});

/* 5.4 Factura del flete de devolución — GET /vendedores/articulos/:id/factura-flete (#13) */
const facturaFlete = asyncHandler(async (req, res) => {
  const articulo = await Articulo.findOne({
    where: { id_tramite: req.params.id, usuario_id: req.usuario.id },
  });
  if (!articulo) throw new AppError('Artículo no encontrado', 404);
  if (articulo.metodo_devolucion !== 'envio' || !articulo.costo_flete) {
    throw new AppError('Este artículo no tiene una devolución con cargo', 400);
  }
  res.status(200).json({
    id_tramite: articulo.id_tramite,
    titulo: articulo.titulo,
    concepto: 'Devolución del bien con cargo al vendedor',
    motivo: articulo.motivo_rechazo,
    costo_flete: articulo.costo_flete,
    total: articulo.costo_flete,
  });
});

/* 5.5 Seguimiento y Póliza de Seguro — GET /vendedores/articulos/:id/logistica */
const logistica = asyncHandler(async (req, res) => {
  const articulo = await Articulo.findOne({
    where: { id_tramite: req.params.id, usuario_id: req.usuario.id },
  });
  if (!articulo) throw new AppError('Artículo no encontrado', 404);

  res.status(200).json({
    ubicacion_deposito: articulo.ubicacion_deposito || 'Pendiente de asignación',
    seguro: {
      compania: articulo.seguro_compania || 'Pendiente',
      cobertura: articulo.seguro_cobertura || 0,
    },
  });
});

module.exports = {
  listarArticulos,
  proponerArticulo,
  confirmarInspeccion,
  responderCondiciones,
  confirmarDevolucion,
  facturaFlete,
  logistica,
};
