const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'bidmaster_super_secret_2026';

/**
 * Middleware de autenticación JWT.
 * Lee el header Authorization: Bearer <token>, lo valida y carga req.usuario.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Token no provisto' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = await Usuario.findByPk(payload.id_usuario);
    if (!usuario) {
      return res.status(401).json({ error: 'Usuario inexistente' });
    }
    req.usuario = usuario;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Auth "suave": si hay token válido carga req.usuario, si no continúa igual.
 * Se usa en el catálogo para ocultar/mostrar el precio base.
 */
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) {
      const payload = jwt.verify(token, JWT_SECRET);
      const usuario = await Usuario.findByPk(payload.id_usuario);
      if (usuario) req.usuario = usuario;
    }
  } catch (_) {
    /* token inválido -> se trata como anónimo */
  }
  next();
}

function firmarToken(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id, categoria: usuario.categoria },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { requireAuth, optionalAuth, firmarToken, JWT_SECRET };
