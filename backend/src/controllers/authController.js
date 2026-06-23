const bcrypt = require('bcryptjs');
const { Persona, Cliente, Cuenta, Pais, Empleado } = require('../models');
const { firmarToken, cargarUsuario } = require('../middleware/auth');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const {
  emailFormatoValido, verificarEmailExiste, verificarDomicilio, paisValido, nombreValido, esImagenValida,
} = require('../utils/validaciones');

const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'];

function enviarMail(destino, asunto, cuerpo) {
  // eslint-disable-next-line no-console
  console.log(`\n📧 [MAIL] Para: ${destino}\n   Asunto: ${asunto}\n   ${cuerpo}\n`);
}

const esDomicilioValido = (dir) => typeof dir === 'string' && dir.trim().length >= 5 && /\d/.test(dir);

// Estado de la solicitud (cliente) traducido al lenguaje del front.
function estadoSolicitud(persona, cliente) {
  if (!cliente) return 'pendiente';
  if (cliente.admitido === 'si') return 'aprobada';
  if (persona.estado === 'inactivo') return 'rechazada';
  return 'pendiente';
}

/* 1.0 Login — POST /auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password_personal } = req.body;
  if (!email || !password_personal) throw new AppError('Email y contraseña son obligatorios', 400);
  const cuenta = await Cuenta.findOne({ where: { email: email.trim() } });
  if (!cuenta || !cuenta.passwordHash) throw new AppError('Email o contraseña incorrectos', 401);
  const ok = await bcrypt.compare(password_personal, cuenta.passwordHash);
  if (!ok) throw new AppError('Email o contraseña incorrectos', 401);
  const usuario = await cargarUsuario(cuenta.persona);
  res.status(200).json({
    token: firmarToken(usuario),
    id_usuario: usuario.id,
    categoria: usuario.categoria,
    nombre: usuario.nombre,
  });
});

/* 1.1 Registro etapa 1 — POST /auth/registro-etapa1 */
const registroEtapa1 = asyncHandler(async (req, res) => {
  const { nombre, apellido, email, dni_frente, dni_dorso, domicilio_legal, pais_origen } = req.body;
  if (!nombre || !apellido || !email || !dni_frente || !dni_dorso || !domicilio_legal || !pais_origen) {
    throw new AppError('Faltan datos o documentos obligatorios', 400);
  }
  if (!nombreValido(nombre)) throw new AppError('El nombre sólo puede contener letras', 400);
  if (!nombreValido(apellido)) throw new AppError('El apellido sólo puede contener letras', 400);
  if (!paisValido(pais_origen)) throw new AppError('Ingresá un país de origen válido', 400);
  if (!esImagenValida(dni_frente) || !esImagenValida(dni_dorso)) {
    throw new AppError('Las fotos del DNI deben ser imágenes válidas (frente y dorso)', 400);
  }
  if (!emailFormatoValido(email)) throw new AppError('El email no tiene un formato válido', 400);
  const verif = await verificarEmailExiste(email);
  if (!verif.ok) throw new AppError(verif.motivo, 400);
  if (!esDomicilioValido(domicilio_legal)) throw new AppError('Ingresá un domicilio legal válido (calle y número)', 400);
  const verifDir = await verificarDomicilio(domicilio_legal, pais_origen);
  if (!verifDir.ok) throw new AppError(verifDir.motivo, 400);

  if (await Cuenta.findOne({ where: { email: email.trim() } })) {
    throw new AppError('Ya existe un usuario con ese email', 400);
  }

  // País -> número (si lo conocemos).
  const pais = await Pais.findOne({ where: { nombre: pais_origen.trim() } });

  // persona + cliente (admitido='no', pendiente) + cuenta (sin clave aún).
  const persona = await Persona.create({
    documento: String(Date.now()).slice(-8),
    nombre: `${nombre.trim()} ${apellido.trim()}`,
    direccion: domicilio_legal.trim(),
    estado: 'activo',
    foto: dni_frente,
  });
  await Cliente.create({ identificador: persona.identificador, numeroPais: pais ? pais.numero : null, admitido: 'no', categoria: 'comun' });
  await Cuenta.create({ persona: persona.identificador, email: email.trim() });

  res.status(202).json({
    mensaje: 'Solicitud recibida. Queda en verificación hasta que sea aprobada manualmente.',
    id_solicitud: persona.identificador,
    estado: 'pendiente',
  });
});

/* 1.1.b Estado de la solicitud — GET /auth/solicitudes/:id/estado */
const consultarEstado = asyncHandler(async (req, res) => {
  const persona = await Persona.findByPk(req.params.id);
  if (!persona) throw new AppError('Solicitud no encontrada', 404);
  const cliente = await Cliente.findByPk(persona.identificador);
  const cuenta = await Cuenta.findOne({ where: { persona: persona.identificador } });
  const estado = estadoSolicitud(persona, cliente);
  const aprobada = estado === 'aprobada';
  res.status(200).json({
    id_solicitud: persona.identificador,
    estado,
    categoria_asignada: aprobada ? cliente.categoria : null,
    mail_habilitacion: aprobada,
    codigo_validacion: aprobada && cuenta ? cuenta.codigoValidacion : null,
  });
});

/* 1.2 Registro etapa 2 (generar clave) — POST /auth/registro-etapa2 */
const registroEtapa2 = asyncHandler(async (req, res) => {
  const { id_solicitud, password_personal, codigo } = req.body;
  if (!id_solicitud || !password_personal) throw new AppError('Solicitud y clave personal son obligatorias', 400);
  if (String(password_personal).length < 6) throw new AppError('La clave debe tener al menos 6 caracteres', 400);
  const persona = await Persona.findByPk(id_solicitud);
  if (!persona) throw new AppError('Solicitud no encontrada', 404);
  const cliente = await Cliente.findByPk(persona.identificador);
  const cuenta = await Cuenta.findOne({ where: { persona: persona.identificador } });
  const estado = estadoSolicitud(persona, cliente);
  if (estado === 'rechazada') throw new AppError('Tu solicitud fue rechazada por la verificación', 403);
  if (estado !== 'aprobada') throw new AppError('Tu solicitud sigue en verificación. Esperá la aprobación.', 403);
  if (!codigo || String(codigo).trim() !== String(cuenta.codigoValidacion)) {
    throw new AppError('Código de validación incorrecto (revisá tu mail)', 400);
  }
  if (cuenta.passwordHash) throw new AppError('Esta cuenta ya fue activada. Iniciá sesión.', 409);

  cuenta.passwordHash = await bcrypt.hash(password_personal, 10);
  await cuenta.save();
  const usuario = await cargarUsuario(persona.identificador);
  res.status(201).json({
    mensaje: 'Usuario activado',
    id_usuario: usuario.id,
    categoria: usuario.categoria,
    token: firmarToken(usuario),
  });
});

/* Reanudar validación por email — POST /auth/reanudar-registro */
const reanudarRegistro = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !emailFormatoValido(email)) throw new AppError('Ingresá un email válido', 400);
  const cuenta = await Cuenta.findOne({ where: { email: email.trim() } });
  if (!cuenta) throw new AppError('No encontramos un registro con ese email. Registrate primero.', 404);
  if (cuenta.passwordHash) return res.status(200).json({ ya_activada: true, email: cuenta.email });
  const persona = await Persona.findByPk(cuenta.persona);
  const cliente = await Cliente.findByPk(cuenta.persona);
  res.status(200).json({ id_solicitud: persona.identificador, email: cuenta.email, estado: estadoSolicitud(persona, cliente) });
});

/* Recuperar contraseña — POST /auth/recuperar-password */
const recuperarPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !emailFormatoValido(email)) throw new AppError('El email no tiene un formato válido', 400);
  const cuenta = await Cuenta.findOne({ where: { email: email.trim() } });
  if (!cuenta) return res.status(200).json({ existe: false, mensaje: 'Si el email está registrado, te enviamos instrucciones.' });
  cuenta.codigoReset = String(Math.floor(100000 + Math.random() * 900000));
  await cuenta.save();
  enviarMail(cuenta.email, 'Restablecé tu clave', `Código: ${cuenta.codigoReset}`);
  res.status(200).json({ existe: true, mensaje: 'Te enviamos un código.', codigo_reset: cuenta.codigoReset });
});

/* Resetear contraseña — POST /auth/resetear-password */
const resetearPassword = asyncHandler(async (req, res) => {
  const { email, codigo, password_nueva } = req.body;
  if (!email || !codigo || !password_nueva) throw new AppError('Email, código y nueva clave son obligatorios', 400);
  if (String(password_nueva).length < 6) throw new AppError('La clave debe tener al menos 6 caracteres', 400);
  const cuenta = await Cuenta.findOne({ where: { email: email.trim() } });
  if (!cuenta || !cuenta.codigoReset || String(codigo).trim() !== String(cuenta.codigoReset)) {
    throw new AppError('Código de recuperación incorrecto', 400);
  }
  cuenta.passwordHash = await bcrypt.hash(password_nueva, 10);
  cuenta.codigoReset = null;
  await cuenta.save();
  res.status(200).json({ mensaje: 'Clave actualizada. Ya podés iniciar sesión.' });
});

/* ===================== ADMIN ===================== */

/* GET /admin/solicitudes?estado=pendiente */
const adminListarSolicitudes = asyncHandler(async (req, res) => {
  const clientes = await Cliente.findAll({ include: [{ model: Persona, as: 'persona' }] });
  const data = [];
  for (const c of clientes) {
    const cuenta = await Cuenta.findOne({ where: { persona: c.identificador } });
    const est = estadoSolicitud(c.persona, c);
    if (req.query.estado && req.query.estado !== est) continue;
    data.push({
      id_solicitud: c.identificador,
      nombre: c.persona ? c.persona.nombre : '',
      email: cuenta ? cuenta.email : null,
      estado: est,
      categoria_asignada: c.categoria,
    });
  }
  res.status(200).json(data);
});

/* PATCH /admin/solicitudes/:id/resolver  body { aprobar, categoria } */
const adminResolverSolicitud = asyncHandler(async (req, res) => {
  const { aprobar, categoria } = req.body;
  const persona = await Persona.findByPk(req.params.id);
  if (!persona) throw new AppError('Solicitud no encontrada', 404);
  const cliente = await Cliente.findByPk(persona.identificador);
  const cuenta = await Cuenta.findOne({ where: { persona: persona.identificador } });
  if (!cliente) throw new AppError('No es un cliente', 404);

  if (aprobar === false) {
    persona.estado = 'inactivo';
    await persona.save();
    cliente.admitido = 'no';
    await cliente.save();
    return res.status(200).json({ id_solicitud: persona.identificador, estado: 'rechazada' });
  }
  if (categoria && !CATEGORIAS.includes(categoria)) {
    throw new AppError(`Categoría inválida (${CATEGORIAS.join(', ')})`, 400);
  }
  const empleado = await Empleado.findOne();
  cliente.admitido = 'si';
  cliente.categoria = categoria || cliente.categoria || 'comun';
  if (empleado) cliente.verificador = empleado.identificador;
  await cliente.save();
  cuenta.codigoValidacion = String(Math.floor(100000 + Math.random() * 900000));
  await cuenta.save();
  enviarMail(cuenta.email, 'Tu cuenta de BidMaster fue habilitada',
    `Categoría ${cliente.categoria}. Ingresá a la app y generá tu clave con este código: ${cuenta.codigoValidacion}`);
  res.status(200).json({
    id_solicitud: persona.identificador, estado: 'aprobada',
    categoria_asignada: cliente.categoria, codigo_validacion: cuenta.codigoValidacion,
  });
});

module.exports = {
  login, registroEtapa1, estadoSolicitud: consultarEstado, registroEtapa2,
  reanudarRegistro, recuperarPassword, resetearPassword,
  adminListarSolicitudes, adminResolverSolicitud,
};
