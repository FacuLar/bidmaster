const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Etapa 1 del registro. Guarda los datos y la documentación mientras la
 * empresa hace la verificación externa de antecedentes y asigna la categoría.
 */
const SolicitudRegistro = sequelize.define('SolicitudRegistro', {
  id_solicitud: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  apellido: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  dni_frente: { type: DataTypes.STRING, allowNull: false },
  dni_dorso: { type: DataTypes.STRING, allowNull: false },
  domicilio_legal: { type: DataTypes.STRING, allowNull: false },
  pais_origen: { type: DataTypes.STRING, allowNull: false },
  estado: {
    type: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada'),
    defaultValue: 'pendiente',
  },
  categoria_asignada: {
    type: DataTypes.ENUM('comun', 'especial', 'plata', 'oro', 'platino'),
    defaultValue: 'comun',
  },
  // Código que se "envía por mail" al habilitar la cuenta; se exige para
  // generar la clave personal (validación de la clave por mail).
  codigo_validacion: { type: DataTypes.STRING, allowNull: true },
  // Si ya se notificó por mail que la cuenta fue habilitada.
  mail_habilitacion_enviado: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  tableName: 'solicitudes_registro',
});

module.exports = SolicitudRegistro;
