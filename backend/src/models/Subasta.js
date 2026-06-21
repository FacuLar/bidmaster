const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Subasta = sequelize.define('Subasta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING, allowNull: false },
  fecha: { type: DataTypes.DATEONLY, allowNull: false },
  hora: { type: DataTypes.STRING },
  moneda: { type: DataTypes.ENUM('ARS', 'USD'), defaultValue: 'ARS' },
  categoria_requerida: {
    type: DataTypes.ENUM('comun', 'especial', 'plata', 'oro', 'platino'),
    defaultValue: 'comun',
  },
  rematador: { type: DataTypes.STRING },
  ubicacion: { type: DataTypes.STRING },
  url_stream: { type: DataTypes.STRING },
  estado: {
    type: DataTypes.ENUM('programada', 'activa', 'finalizada'),
    defaultValue: 'activa',
  },
  // Pieza que se está rematando AHORA (modelo secuencial: un ítem por vez).
  pieza_actual_id: { type: DataTypes.INTEGER, allowNull: true },
  // Si es una colección de un mismo vendedor.
  es_coleccion: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'subastas',
});

module.exports = Subasta;
