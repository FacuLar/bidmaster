const sequelize = require('../config/database');

const Usuario = require('./Usuario');
const SolicitudRegistro = require('./SolicitudRegistro');
const MedioPago = require('./MedioPago');
const Subasta = require('./Subasta');
const Pieza = require('./Pieza');
const Puja = require('./Puja');
const Venta = require('./Venta');
const Multa = require('./Multa');
const Articulo = require('./Articulo');

/* ----------------------------- Relaciones ----------------------------- */

// Usuario 1—N MedioPago
Usuario.hasMany(MedioPago, { foreignKey: 'usuario_id', as: 'medios_pago' });
MedioPago.belongsTo(Usuario, { foreignKey: 'usuario_id' });

// Subasta 1—N Pieza
Subasta.hasMany(Pieza, { foreignKey: 'subasta_id', as: 'piezas' });
Pieza.belongsTo(Subasta, { foreignKey: 'subasta_id', as: 'subasta' });

// Pieza N—1 Usuario (dueño actual) y N—1 Usuario (líder de la puja)
Pieza.belongsTo(Usuario, { foreignKey: 'dueno_id', as: 'dueno' });
Pieza.belongsTo(Usuario, { foreignKey: 'lider_id', as: 'lider' });

// Puja N—1 Usuario / Pieza / Subasta
Puja.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Puja.belongsTo(Pieza, { foreignKey: 'pieza_id', as: 'pieza' });
Puja.belongsTo(Subasta, { foreignKey: 'subasta_id', as: 'subasta' });
Usuario.hasMany(Puja, { foreignKey: 'usuario_id', as: 'pujas' });
Pieza.hasMany(Puja, { foreignKey: 'pieza_id', as: 'pujas' });

// Venta N—1 Usuario / Pieza / MedioPago
Venta.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Venta.belongsTo(Pieza, { foreignKey: 'pieza_id', as: 'pieza' });
Venta.belongsTo(MedioPago, { foreignKey: 'medio_pago_id', as: 'medio_pago' });
Usuario.hasMany(Venta, { foreignKey: 'usuario_id', as: 'ventas' });

// Multa N—1 Usuario
Multa.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'usuario' });
Usuario.hasMany(Multa, { foreignKey: 'usuario_id', as: 'multas' });

// Articulo N—1 Usuario (vendedor)
Articulo.belongsTo(Usuario, { foreignKey: 'usuario_id', as: 'vendedor' });
Usuario.hasMany(Articulo, { foreignKey: 'usuario_id', as: 'articulos' });

module.exports = {
  sequelize,
  Usuario,
  SolicitudRegistro,
  MedioPago,
  Subasta,
  Pieza,
  Puja,
  Venta,
  Multa,
  Articulo,
};
