const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Usuario = sequelize.define('Usuario', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  apellido: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  dni_frente: { type: DataTypes.STRING },
  dni_dorso: { type: DataTypes.STRING },
  domicilio_legal: { type: DataTypes.STRING },
  pais_origen: { type: DataTypes.STRING },
  // Categorías que determinan a qué subastas puede acceder.
  categoria: {
    type: DataTypes.ENUM('comun', 'especial', 'plata', 'oro', 'platino'),
    defaultValue: 'comun',
  },
  // activo / suspendido (suspendido = con multa impaga, no puede pujar).
  estado: {
    type: DataTypes.ENUM('activo', 'suspendido'),
    defaultValue: 'activo',
  },
  // Cuenta a la vista (puede ser del exterior) para cobrar sus ventas.
  cuenta_cobro: { type: DataTypes.STRING },
  // Código temporal para restablecer la contraseña ("se envía por mail").
  codigo_reset: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'usuarios',
});

module.exports = Usuario;
