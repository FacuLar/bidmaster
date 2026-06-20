const { Usuario, MedioPago, Venta } = require('../models');
const { categoriaSugerida, mejorCategoria } = require('./categoriaService');

/**
 * Recalcula y eventualmente mejora la categoría del usuario según la regla del
 * enunciado: diversidad de medios de pago verificados + actividad (subastas
 * ganadas). Nunca degrada por debajo de la categoría asignada.
 * Devuelve la categoría resultante.
 */
async function actualizarCategoria(usuarioId) {
  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) return null;

  const medios = await MedioPago.findAll({
    where: { usuario_id: usuarioId, estado_verificacion: 'Verificado' },
  });
  const tiposDistintos = new Set(medios.map((m) => m.tipo)).size;
  const subastasGanadas = await Venta.count({ where: { usuario_id: usuarioId } });

  const sugerida = categoriaSugerida({
    tiposMediosVerificados: tiposDistintos,
    subastasGanadas,
  });
  const nueva = mejorCategoria(usuario.categoria, sugerida);

  if (nueva !== usuario.categoria) {
    usuario.categoria = nueva;
    await usuario.save();
  }
  return usuario.categoria;
}

module.exports = { actualizarCategoria };
