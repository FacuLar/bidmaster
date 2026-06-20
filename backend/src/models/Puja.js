const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Cada oferta económica de un postor sobre una pieza.
 * Se respeta el orden secuencial (campo `orden`) por pieza.
 */
const Puja = sequelize.define('Puja', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  orden: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'pujas',
});

module.exports = Puja;
