const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Liquidación post-remate del ganador de una pieza.
 * total = monto_pujado + comision(10%) + costo_envio (salvo retiro personal).
 */
const Venta = sequelize.define('Venta', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  monto_pujado: { type: DataTypes.FLOAT, allowNull: false },
  comision: { type: DataTypes.FLOAT, allowNull: false },
  costo_envio: { type: DataTypes.FLOAT, defaultValue: 0 },
  total: { type: DataTypes.FLOAT, allowNull: false },
  // Si retira personalmente: ahorra envío pero pierde la cobertura del seguro.
  retiro_personal: { type: DataTypes.BOOLEAN, defaultValue: false },
  estado_pago: {
    type: DataTypes.ENUM('pendiente', 'pagada', 'impaga'),
    defaultValue: 'pendiente',
  },
}, {
  tableName: 'ventas',
});

module.exports = Venta;
