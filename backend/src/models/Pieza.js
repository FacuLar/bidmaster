const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Objeto/ítem del catálogo de una subasta. Puede estar compuesto por varios
 * elementos (p.ej. "Juego de Té de 18 piezas"). Mantiene la oferta líder actual.
 */
const Pieza = sequelize.define('Pieza', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nro_pieza: { type: DataTypes.INTEGER, allowNull: false },
  titulo: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT },
  precio_base: { type: DataTypes.FLOAT, allowNull: false },
  // Imágenes del bien (aprox. 6). Guardadas como JSON de URLs.
  imagenes: { type: DataTypes.JSON, defaultValue: [] },
  // Datos para obras de arte / objetos de diseñador.
  artista: { type: DataTypes.STRING },
  fecha_obra: { type: DataTypes.STRING },
  historia: { type: DataTypes.TEXT },
  // --- Clasificación para búsqueda y filtros ---
  // Categoría principal: arte | tecnologia | moda | joyas | vehiculos | hobbies
  categoria: { type: DataTypes.STRING },
  // Etiquetas de atributos (Lujo, Vintage, Colección, etc.).
  tags: { type: DataTypes.JSON, defaultValue: [] },
  // Estado de uso: nuevo | poco_uso | usado | sellado | restaurado
  uso: { type: DataTypes.STRING },
  // Estado de la oferta en tiempo real.
  oferta_actual: { type: DataTypes.FLOAT, defaultValue: 0 },
  estado: {
    type: DataTypes.ENUM('en_subasta', 'vendida', 'sin_ofertas'),
    defaultValue: 'en_subasta',
  },
}, {
  tableName: 'piezas',
});

module.exports = Pieza;
