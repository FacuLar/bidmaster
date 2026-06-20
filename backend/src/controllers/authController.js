const bcrypt = require('bcryptjs');
const { Usuario, SolicitudRegistro } = require('../models');
const { firmarToken } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Tiempo (segundos) que "tarda" la investigación externa antes de aprobar.
// Simula la verificación de antecedentes sin depender de Postman ni de un admin.
const VERIFICACION_SEGUNDOS = Number(process.env.VERIFICACION_SEGUNDOS || 8);

// Validaciones de forma reutilizables (también se validan en el frontend).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esEmailValido = (email) => typeof email === 'string' && EMAIL_RE.test(email.trim());
const esDomicilioValido = (dir) =>
  typeof dir === 'string' && dir.trim().length >= 5 && /\d/.test(dir);

// Simula el envío de un mail (en producción saldría por un servicio de email).
function enviarMail(destino, asunto, cuerpo) {
  // eslint-disable-next-line no-console
  console.log(`\n📧 [MAIL] Para: ${destino}\n   Asunto: ${asunto}\n   ${cuerpo}\n`);
}

/**
 * Resuelve la verificación externa de forma diferida y determinística:
 * una vez transcurridos VERIFICACION_SEGUNDOS desde la creación, la solicitud
 * pasa a 'aprobada', se le asigna una categoría, se genera el código de
 * validación y se NOTIFICA POR MAIL que la cuenta fue habilitada. No usa timers
 * (sobrevive a reinicios) y NO se aprueba al instante de registrarse.
 */
async function resolverVerificacion(solicitud) {
  if (solicitud.estado !== 'pendiente') return solicitud;
  const transcurrido = (Date.now() - new Date(solicitud.createdAt).getTime()) / 1000;
  if (transcurrido >= VERIFICACION_SEGUNDOS) {
    solicitud.estado = 'aprobada';
    // La investigación externa asigna la categoría (acá, 'comun' por defecto).
    if (!solicitud.categoria_asignada) solicitud.categoria_asignada = 'comun';
    // Código de validación de 6 dígitos que se envía por mail.
    solicitud.codigo_validacion = String(Math.floor(100000 + Math.random() * 900000));
    if (!solicitud.mail_habilitacion_enviado) {
      enviarMail(
        solicitud.email,
        'Tu cuenta de BidMaster fue habilitada',
        `¡Felicitaciones! Tu cuenta fue habilitada (categoría ${solicitud.categoria_asignada}). `
        + `Ingresá a la app y generá tu clave personal con este código: ${solicitud.codigo_validacion}`,
      );
      solicitud.mail_habilitacion_enviado = true;
    }
    await solicitud.save();
  }
  return solicitud;
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
  // Validación de formato: email y domicilio legal.
  if (!esEmailValido(email)) {
    throw new AppError('El email no tiene un formato válido', 400);
  }
  if (!esDomicilioValido(domicilio_legal)) {
    throw new AppError('Ingresá un domicilio legal válido (calle y número)', 400);
  }
  const existe = await Usuario.findOne({ where: { email: email.trim() } });
  if (existe) throw new AppError('Ya existe un usuario con ese email', 400);

  const solicitud = await SolicitudRegistro.create({
    nombre, apellido, email: email.trim(), dni_frente, dni_dorso, domicilio_legal, pais_origen,
  });

  // 202: recibido para verificación externa asíncrona (NO aprobado todavía).
  res.status(202).json({
    mensaje: 'Solicitud en proceso de verificación externa',
    id_solicitud: solicitud.id_solicitud,
    estado: solicitud.estado, // 'pendiente'
    verificacion_segundos: VERIFICACION_SEGUNDOS,
  });
});

/* 1.1.b Consultar estado de la verificación — GET /auth/solicitudes/:id/estado
   La app consulta acá hasta que la empresa apruebe (verificación externa). */
const estadoSolicitud = asyncHandler(async (req, res) => {
  const solicitud = await SolicitudRegistro.findByPk(req.params.id);
  if (!solicitud) throw new AppError('Solicitud no encontrada', 404);

  await resolverVerificacion(solicitud);

  const transcurrido = (Date.now() - new Date(solicitud.createdAt).getTime()) / 1000;
  const segundos_restantes = Math.max(0, Math.ceil(VERIFICACION_SEGUNDOS - transcurrido));

  const aprobada = solicitud.estado === 'aprobada';
  res.status(200).json({
    id_solicitud: solicitud.id_solicitud,
    estado: solicitud.estado, // pendiente | aprobada | rechazada
    categoria_asignada: aprobada ? solicitud.categoria_asignada : null,
    segundos_restantes,
    // Notificación de cuenta habilitada (la app la muestra como "mail recibido").
    mail_habilitacion: aprobada,
    // Para la demo (sin servidor de mail real) devolvemos el código que se
    // "envió por mail" para validar la generación de la clave.
    codigo_validacion: aprobada ? solicitud.codigo_validacion : null,
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
    throw new AppError('Tu solicitud fue rechazada por la verificación externa', 403);
  }

  // Da una última chance a que la verificación se complete antes de bloquear.
  await resolverVerificacion(solicitud);

  // Gate real: SOLO se completa el registro si la empresa ya aprobó la solicitud.
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
  if (!esEmailValido(email)) throw new AppError('El email no tiene un formato válido', 400);
  // No se revela si el email existe (buena práctica de seguridad).
  // En producción se enviaría un mail con un enlace de recuperación.
  res.status(200).json({
    mensaje: 'Si el email está registrado, te enviamos instrucciones para restablecer tu clave.',
  });
});

module.exports = { login, registroEtapa1, estadoSolicitud, registroEtapa2, recuperarPassword };
