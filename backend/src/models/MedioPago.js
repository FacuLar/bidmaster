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
  // Para TARJETA guarda el número enmascarado (**** 4092); para CUENTA/CHEQUE
  // el identificador correspondiente. NUNCA se guarda el número completo ni el CVV.
  numero_identificador: { type: DataTypes.STRING },
  // --- Datos de TARJETA ---
  marca: { type: DataTypes.STRING },        // VISA, MASTERCARD, AMEX
  titular: { type: DataTypes.STRING },      // nombre del titular
  vencimiento: { type: DataTypes.STRING },  // MM/AA
  // --- Datos de CHEQUE ---
  numero_cheque: { type: DataTypes.STRING },
  banco: { type: DataTypes.STRING },
  cbu: { type: DataTypes.STRING },
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
