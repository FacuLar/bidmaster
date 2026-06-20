const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Penalización del 10% del valor ofertado cuando el ganador no tiene fondos.
 * Debe abonarse y presentar fondos antes de las 72hs; mientras tanto la
 * cuenta queda suspendida para nuevas pujas.
 */
const Multa = sequelize.define('Multa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  monto: { type: DataTypes.FLOAT, allowNull: false },
  fecha_limite: { type: DataTypes.DATE, allowNull: false },
  estado: {
    type: DataTypes.ENUM('con_deuda', 'pagada'),
    defaultValue: 'con_deuda',
  },
}, {
  tableName: 'multas',
});

module.exports = Multa;
