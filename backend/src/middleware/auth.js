const jwt = require('jsonwebtoken');
const { Persona, Cliente, Cuenta } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'bidmaster_super_secret_2026';

/**
 * Carga el "usuario" de la app a partir del id de persona. En el esquema de la
 * cátedra el usuario que puja es una PERSONA + CLIENTE (+ CUENTA de acceso). Se
 * devuelve un objeto normalizado para que los controladores no dependan del
 * detalle del esquema: { id, categoria, nombre, email, admitido }.
 */
async function cargarUsuario(personaId) {
  const persona = await Persona.findByPk(personaId);
  if (!persona) return null;
  const cliente = await Cliente.findByPk(personaId);
  const cuenta = await Cuenta.findOne({ where: { persona: personaId } });
  return {
    id: persona.identificador,
    nombre: persona.nombre,
    email: cuenta ? cuenta.email : null,
    categoria: cliente ? cliente.categoria : 'comun',
    admitido: cliente ? cliente.admitido : 'no',
  };
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token no provisto' });
    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = await cargarUsuario(payload.id_usuario);
    if (!usuario) return res.status(401).json({ error: 'Usuario inexistente' });
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET);
      const usuario = await cargarUsuario(payload.id_usuario);
      if (usuario) req.usuario = usuario;
    }
  } catch (_) { /* anónimo */ }
  next();
}

const ADMIN_KEY = process.env.ADMIN_KEY || 'bidmaster_admin_2026';

function requireAdmin(req, res, next) {
  const clave = req.headers['x-admin-key'] || req.query.admin_key;
  if (!clave || clave !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Acceso de administrador denegado (x-admin-key inválida)' });
  }
  next();
}

// Firma el JWT con el id de persona (id_usuario) y la categoría.
function firmarToken(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id, categoria: usuario.categoria },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
}

module.exports = { requireAuth, optionalAuth, requireAdmin, firmarToken, cargarUsuario, JWT_SECRET, ADMIN_KEY };
