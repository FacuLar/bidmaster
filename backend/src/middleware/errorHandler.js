/**
 * Manejador centralizado de errores.
 * Los controladores pueden lanzar `new AppError(mensaje, statusCode)`
 * para devolver códigos HTTP semánticos (400, 403, 404, etc.).
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  if (status === 500) {
    // eslint-disable-next-line no-console
    console.error('[ERROR]', err);
  }
  res.status(status).json({ error: err.message || 'Error interno del servidor' });
}

// Envuelve controladores async para no repetir try/catch en cada uno.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { AppError, errorHandler, asyncHandler };
