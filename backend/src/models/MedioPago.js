const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Medio de pago / garantía financiera del postor.
 * Cheque certificado: monto_certificado limita el total de compras.
 */
const MedioPago = sequelize.define('MedioPago', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo: {
    type: DataTypes.ENUM('CUENTA', 'TARJETA', 'CHEQUE'),
    allowNull: false,
  },
  entidad: { type: DataTypes.STRING },
  numero_identificador: { type: DataTypes.STRING },
  // Sólo aplica a CHEQUE: monto total garantizado.
  monto_certificado: { type: DataTypes.FLOAT, defaultValue: 0 },
  // Saldo restante del cheque a medida que se consumen compras.
  saldo_disponible: { type: DataTypes.FLOAT, defaultValue: 0 },
  // Moneda del medio (para subastas ARS/USD).
  moneda: { type: DataTypes.ENUM('ARS', 'USD'), defaultValue: 'ARS' },
  estado_verificacion: {
    type: DataTypes.ENUM('Pendiente', 'Verificado', 'Rechazado'),
    defaultValue: 'Pendiente',
  },
}, {
  tableName: 'medios_pago',
});

module.exports = MedioPago;
