const { Cliente, MedioPago, RegistroDeSubasta } = require('../models');
const { categoriaSugerida, mejorCategoria } = require('./categoriaService');

/**
 * Recalcula la categoría del CLIENTE: diversidad de medios verificados +
 * subastas ganadas (registroDeSubasta). Nunca degrada por debajo de la actual.
 */
async function actualizarCategoria(clienteId) {
  const cliente = await Cliente.findByPk(clienteId);
  if (!cliente) return null;

  const medios = await MedioPago.findAll({ where: { cliente: clienteId, estadoVerificacion: 'Verificado' } });
  const tiposDistintos = new Set(medios.map((m) => m.tipo)).size;
  const subastasGanadas = await RegistroDeSubasta.count({ where: { cliente: clienteId } });

  const sugerida = categoriaSugerida({ tiposMediosVerificados: tiposDistintos, subastasGanadas });
  const nueva = mejorCategoria(cliente.categoria, sugerida);
  if (nueva !== cliente.categoria) {
    cliente.categoria = nueva;
    await cliente.save();
  }
  return cliente.categoria;
}

module.exports = { actualizarCategoria };
