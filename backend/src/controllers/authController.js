const bcrypt = require('bcryptjs');
const { Usuario, SolicitudRegistro } = require('../models');
const { firmarToken } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const {
  emailFormatoValido, verificarEmailExiste,
  verificarDomicilio, paisValido, nombreValido, esImagenValida,
} = require('../utils/validaciones');

// Categorías válidas que el administrador puede asignar al aprobar.
const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'];

// Simula el envío de un mail (en producción saldría por un servicio de email).
function enviarMail(destino, asunto, cuerpo) {
  // eslint-disable-next-line no-console
  console.log(`\n📧 [MAIL] Para: ${destino}\n   Asunto: ${asunto}\n   ${cuerpo}\n`);
}

/* 1.0 Iniciar Sesión (Login Directo) — POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password_personal } = req.body;
  if (!email || !password_personal) {
    throw new AppError('Email y contraseña son obligatorios', 400);
  }
  const usuario = await Usuario.findOne({ where: { email: email.trim() } });
  if (!usuario) throw new AppError('Email o contraseña incorrectos', 401);

  const ok = await bcrypt.compare(password_personal, usuario.password_hash);
  if (!ok) throw new AppError('Email o contraseña incorrectos', 401);

  res.status(200).json({
    token: firmarToken(usuario),
    id_usuario: usuario.id,
    categoria: usuario.categoria,
    nombre: usuario.nombre,
  });
});

/* 1.1 Iniciar Registro (Etapa 1) — POST /auth/registro-etapa1 */
const registroEtapa1 = asyncHandler(async (req, res) => {
  const { nombre, apellido, email, dni_frente, dni_dorso, domicilio_legal, pais_origen } = req.body;
  // Documentación obligatoria.
  if (!nombre || !apellido || !email || !dni_frente || !dni_dorso || !domicilio_legal || !pais_origen) {
    throw new AppError('Faltan datos o documentos obligatorios', 400);
  }
  // Nombre y apellido: sólo letras (sin números ni símbolos).
  if (!nombreValido(nombre)) throw new AppError('El nombre sólo puede contener letras', 400);
  if (!nombreValido(apellido)) throw new AppError('El apellido sólo puede contener letras', 400);

  // País de origen: debe ser un país real.
  if (!paisValido(pais_origen)) {
    throw new AppError('Ingresá un país de origen válido', 400);
  }

  // Fotos del DNI: deben ser imágenes reales (no texto ni archivos cualquiera).
  if (!esImagenValida(dni_frente) || !esImagenValida(dni_dorso)) {
    throw new AppError('Las fotos del DNI deben ser imágenes válidas (frente y dorso)', 400);
  }

  // Email: formato + existencia real (typos, descartables y registros MX).
  if (!emailFormatoValido(email)) {
    throw new AppError('El email no tiene un formato válido', 400);
  }
  const verif = await verificarEmailExiste(email);
  if (!verif.ok) throw new AppError(verif.motivo, 400);

  // Domicilio legal: existencia real geocodificada (OpenStreetMap).
  const verifDir = await verificarDomicilio(domicilio_legal, pais_origen);
  if (!verifDir.ok) throw new AppError(verifDir.motivo, 400);

  const existe = await Usuario.findOne({ where: { email: email.trim() } });
  if (existe) throw new AppError('Ya existe un usuario con ese email', 400);

  const solicitud = await SolicitudRegistro.create({
    nombre, apellido, email: email.trim(), dni_frente, dni_dorso, domicilio_legal, pais_origen,
  });

  // 202: recibido para verificación externa MANUAL (NO aprobado todavía).
  res.status(202).json({
    mensaje: 'Solicitud recibida. Queda en verificación hasta que sea aprobada manualmente.',
    id_solicitud: solicitud.id_solicitud,
    estado: solicitud.estado, // 'pendiente'
  });
});

/* 1.1.b Consultar estado de la verificación — GET /auth/solicitudes/:id/estado
   La app consulta acá hasta que un administrador apruebe (verificación manual). */
const estadoSolicitud = asyncHandler(async (req, res) => {
  const solicitud = await SolicitudRegistro.findByPk(req.params.id);
  if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

  const aprobada = solicitud.estado === 'aprobada';
  res.status(200).json({
    id_solicitud: solicitud.id_solicitud,
    estado: solicitud.estado, // pendiente | aprobada | rechazada
    categoria_asignada: aprobada ? solicitud.categoria_asignada : null,
    // Aviso de que la cuenta fue habilitada (la app lo muestra como "mail recibido").
    mail_habilitacion: aprobada,
    // El código de validación NO se expone acá: llega por mail al aprobar.
  });
});

/* 1.2 Completar Registro (Etapa 2) — POST /auth/registro-etapa2
   La clave se genera DESPUÉS de la aprobación y se valida con el código que se
   envió por mail al habilitar la cuenta. */
const registroEtapa2 = asyncHandler(async (req, res) => {
  const { id_solicitud, email, password_personal, codigo } = req.body;
  if (!id_solicitud || !password_personal) {
    throw new AppError('Solicitud y clave personal son obligatorias', 400);
  }
  const solicitud = await SolicitudRegistro.findByPk(id_solicitud);
  if (!solicitud) throw new AppError('Solicitud no encontrada', 404);
  if (solicitud.estado === 'rechazada') {
    throw new AppError('Tu solicitud fue rechazada por la verificación', 403);
  }
  // Gate real: SOLO se completa el registro si ya fue aprobada manualmente.
  if (solicitud.estado !== 'aprobada') {
    throw new AppError('Tu solicitud sigue en verificación. Esperá la aprobación.', 403);
  }

  // Validación por mail: el código ingresado debe coincidir con el enviado.
  if (!codigo || String(codigo).trim() !== String(solicitud.codigo_validacion)) {
    throw new AppError('Código de validación incorrecto (revisá tu mail)', 400);
  }

  const password_hash = await bcrypt.hash(password_personal, 10);
  const usuario = await Usuario.create({
    nombre: solicitud.nombre,
    apellido: solicitud.apellido,
    email: email || solicitud.email,
    password_hash,
    dni_frente: solicitud.dni_frente,
    dni_dorso: solicitud.dni_dorso,
    domicilio_legal: solicitud.domicilio_legal,
    pais_origen: solicitud.pais_origen,
    categoria: solicitud.categoria_asignada,
  });

  res.status(201).json({
    mensaje: 'Usuario activado',
    id_usuario: usuario.id,
    categoria: usuario.categoria,
    token: firmarToken(usuario),
  });
});

/* Corrección de diseño: "Se me olvidó la contraseña" — POST /auth/recuperar-password */
const recuperarPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError('El email es obligatorio', 400);
  if (!emailFormatoValido(email)) throw new AppError('El email no tiene un formato válido', 400);
  // No se revela si el email existe (buena práctica de seguridad).
  res.status(200).json({
    mensaje: 'Si el email está registrado, te enviamos instrucciones para restablecer tu clave.',
  });
});

/* ===================== ADMIN (sólo por Postman, x-admin-key) ============== */

/* Listar solicitudes de registro — GET /admin/solicitudes?estado=pendiente */
const adminListarSolicitudes = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.estado) where.estado = req.query.estado;
  const solicitudes = await SolicitudRegistro.findAll({
    where,
    order: [['createdAt', 'DESC']],
    attributes: { exclude: ['dni_frente', 'dni_dorso'] }, // no devolvemos las imágenes
  });
  res.status(200).json(solicitudes);
});

/* Aprobar / rechazar una solicitud — PATCH /admin/solicitudes/:id/resolver
   body: { aprobar: true|false, categoria?: 'comun'|'especial'|'plata'|'oro'|'platino' }
   Al aprobar: asigna categoría, genera el código de validación y lo "envía" por
   mail. El código se devuelve también en esta respuesta (para el admin). */
const adminResolverSolicitud = asyncHandler(async (req, res) => {
  const { aprobar, categoria } = req.body;
  const solicitud = await SolicitudRegistro.findByPk(req.params.id);
  if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

  if (aprobar === false) {
    solicitud.estado = 'rechazada';
    await solicitud.save();
    enviarMail(solicitud.email, 'Tu solicitud en BidMaster',
      'Lamentablemente tu solicitud no fue aprobada por la verificación.');
    return res.status(200).json({ id_solicitud: solicitud.id_solicitud, estado: 'rechazada' });
  }

  if (categoria && !CATEGORIAS.includes(categoria)) {
    throw new AppError(`Categoría inválida (${CATEGORIAS.join(', ')})`, 400);
  }

  solicitud.estado = 'aprobada';
  solicitud.categoria_asignada = categoria || solicitud.categoria_asignada || 'comun';
  solicitud.codigo_validacion = String(Math.floor(100000 + Math.random() * 900000));
  solicitud.mail_habilitacion_enviado = true;
  await solicitud.save();

  enviarMail(
    solicitud.email,
    'Tu cuenta de BidMaster fue habilitada',
    `¡Felicitaciones! Tu cuenta fue habilitada (categoría ${solicitud.categoria_asignada}). `
    + `Ingresá a la app y generá tu clave personal con este código: ${solicitud.codigo_validacion}`,
  );

  res.status(200).json({
    id_solicitud: solicitud.id_solicitud,
    estado: 'aprobada',
    categoria_asignada: solicitud.categoria_asignada,
    codigo_validacion: solicitud.codigo_validacion, // visible para el admin
  });
});

module.exports = {
  login,
  registroEtapa1,
  estadoSolicitud,
  registroEtapa2,
  recuperarPassword,
  adminListarSolicitudes,
  adminResolverSolicitud,
};
