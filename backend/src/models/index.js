const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Esquema de base de datos según la estructura OBLIGATORIA de la cátedra
 * (EstructuraActual.sql). Las tablas y columnas respetan esa estructura; lo que
 * la app necesita y no está en el esquema va en TABLAS NUEVAS (cuentas,
 * mediosPago, multas, clasificacionProducto), como pidió el profe.
 *
 * Adaptaciones a SQLite/Sequelize: `identity` -> autoIncrement,
 * `varbinary(max)` -> TEXT (guardamos imágenes en base64/URL),
 * `decimal(18,2)` -> DECIMAL, `time` -> STRING, checks -> ENUM.
 */

const si_no = () => DataTypes.ENUM('si', 'no');
const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'];

/* ===================== Tablas de la cátedra (obligatorias) ================ */

const Pais = sequelize.define('Pais', {
  numero: { type: DataTypes.INTEGER, primaryKey: true },
  nombre: { type: DataTypes.STRING(250), allowNull: false },
  nombreCorto: { type: DataTypes.STRING(250) },
  capital: { type: DataTypes.STRING(250), allowNull: false },
  nacionalidad: { type: DataTypes.STRING(250), allowNull: false },
  idiomas: { type: DataTypes.STRING(150), allowNull: false },
}, { tableName: 'paises', timestamps: false });

const Persona = sequelize.define('Persona', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  documento: { type: DataTypes.STRING(20), allowNull: false },
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  direccion: { type: DataTypes.STRING(250) },
  estado: { type: DataTypes.ENUM('activo', 'inactivo'), defaultValue: 'activo' },
  foto: { type: DataTypes.TEXT('long') }, // varbinary(max) -> base64/data-uri
}, { tableName: 'personas', timestamps: false });

const Empleado = sequelize.define('Empleado', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cargo: { type: DataTypes.STRING(100) },
  sector: { type: DataTypes.INTEGER }, // FK -> sectores
}, { tableName: 'empleados', timestamps: false });

const Sector = sequelize.define('Sector', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombreSector: { type: DataTypes.STRING(150), allowNull: false },
  codigoSector: { type: DataTypes.STRING(10) },
  responsableSector: { type: DataTypes.INTEGER }, // FK -> empleados
}, { tableName: 'sectores', timestamps: false });

const Seguro = sequelize.define('Seguro', {
  nroPoliza: { type: DataTypes.STRING(30), primaryKey: true },
  compania: { type: DataTypes.STRING(150), allowNull: false },
  polizaCombinada: { type: si_no() },
  importe: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
}, { tableName: 'seguros', timestamps: false });

const Cliente = sequelize.define('Cliente', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true }, // FK -> personas
  numeroPais: { type: DataTypes.INTEGER },
  admitido: { type: si_no(), defaultValue: 'no' },
  categoria: { type: DataTypes.ENUM(...CATEGORIAS), defaultValue: 'comun' },
  verificador: { type: DataTypes.INTEGER, allowNull: true }, // FK -> empleados
}, { tableName: 'clientes', timestamps: false });

const Duenio = sequelize.define('Duenio', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true }, // FK -> personas
  numeroPais: { type: DataTypes.INTEGER },
  verificacionFinanciera: { type: si_no() },
  verificacionJudicial: { type: si_no() },
  calificacionRiesgo: { type: DataTypes.INTEGER }, // 1..6
  verificador: { type: DataTypes.INTEGER, allowNull: true }, // FK -> empleados
}, { tableName: 'duenios', timestamps: false });

const Subastador = sequelize.define('Subastador', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true }, // FK -> personas
  matricula: { type: DataTypes.STRING(15) },
  region: { type: DataTypes.STRING(50) },
}, { tableName: 'subastadores', timestamps: false });

const Subasta = sequelize.define('Subasta', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY },
  hora: { type: DataTypes.STRING, allowNull: false },
  estado: { type: DataTypes.ENUM('abierta', 'cerrada'), defaultValue: 'abierta' },
  subastador: { type: DataTypes.INTEGER }, // FK -> subastadores
  ubicacion: { type: DataTypes.STRING(350) },
  capacidadAsistentes: { type: DataTypes.INTEGER },
  tieneDeposito: { type: si_no() },
  seguridadPropia: { type: si_no() },
  categoria: { type: DataTypes.ENUM(...CATEGORIAS) },
}, { tableName: 'subastas', timestamps: false });

const Producto = sequelize.define('Producto', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fecha: { type: DataTypes.DATEONLY },
  disponible: { type: si_no(), defaultValue: 'si' },
  descripcionCatalogo: { type: DataTypes.STRING(500), defaultValue: 'No Posee' },
  descripcionCompleta: { type: DataTypes.STRING(300), allowNull: false },
  revisor: { type: DataTypes.INTEGER }, // FK -> empleados
  duenio: { type: DataTypes.INTEGER }, // FK -> duenios
  seguro: { type: DataTypes.STRING(30) }, // FK -> seguros (nroPoliza)
}, { tableName: 'productos', timestamps: false });

const Foto = sequelize.define('Foto', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto: { type: DataTypes.INTEGER, allowNull: false }, // FK -> productos
  foto: { type: DataTypes.TEXT('long'), allowNull: false }, // varbinary(max) -> base64/url
}, { tableName: 'fotos', timestamps: false });

const Catalogo = sequelize.define('Catalogo', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  descripcion: { type: DataTypes.STRING(250), allowNull: false },
  subasta: { type: DataTypes.INTEGER }, // FK -> subastas
  responsable: { type: DataTypes.INTEGER }, // FK -> empleados
}, { tableName: 'catalogos', timestamps: false });

const ItemCatalogo = sequelize.define('ItemCatalogo', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  catalogo: { type: DataTypes.INTEGER, allowNull: false }, // FK -> catalogos
  producto: { type: DataTypes.INTEGER, allowNull: false }, // FK -> productos
  precioBase: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  comision: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  subastado: { type: si_no(), defaultValue: 'no' },
}, { tableName: 'itemsCatalogo', timestamps: false });

const Asistente = sequelize.define('Asistente', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  numeroPostor: { type: DataTypes.INTEGER, allowNull: false },
  cliente: { type: DataTypes.INTEGER, allowNull: false }, // FK -> clientes
  subasta: { type: DataTypes.INTEGER, allowNull: false }, // FK -> subastas
}, { tableName: 'asistentes', timestamps: false });

const Pujo = sequelize.define('Pujo', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asistente: { type: DataTypes.INTEGER, allowNull: false }, // FK -> asistentes
  item: { type: DataTypes.INTEGER, allowNull: false }, // FK -> itemsCatalogo
  importe: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  ganador: { type: si_no(), defaultValue: 'no' },
}, { tableName: 'pujos', timestamps: false });

const RegistroDeSubasta = sequelize.define('RegistroDeSubasta', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  subasta: { type: DataTypes.INTEGER, allowNull: false },
  duenio: { type: DataTypes.INTEGER, allowNull: false },
  producto: { type: DataTypes.INTEGER, allowNull: false },
  cliente: { type: DataTypes.INTEGER, allowNull: false },
  importe: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  comision: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
}, { tableName: 'registroDeSubasta', timestamps: false });

/* ===================== Tablas NUEVAS (agregadas por la app) =============== */

// Credenciales de acceso (no están en el esquema de la cátedra).
const Cuenta = sequelize.define('Cuenta', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  persona: { type: DataTypes.INTEGER, allowNull: false, unique: true }, // FK -> personas
  email: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING },
  codigoValidacion: { type: DataTypes.STRING },
  codigoReset: { type: DataTypes.STRING },
}, { tableName: 'cuentas', timestamps: true });

// Medios de pago del cliente (billetera).
const MedioPago = sequelize.define('MedioPago', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente: { type: DataTypes.INTEGER, allowNull: false }, // FK -> clientes
  tipo: { type: DataTypes.ENUM('CUENTA', 'TARJETA', 'CHEQUE'), allowNull: false },
  entidad: { type: DataTypes.STRING },
  numeroIdentificador: { type: DataTypes.STRING },
  marca: { type: DataTypes.STRING },
  titular: { type: DataTypes.STRING },
  vencimiento: { type: DataTypes.STRING },
  numeroCheque: { type: DataTypes.STRING },
  banco: { type: DataTypes.STRING },
  cbu: { type: DataTypes.STRING },
  montoCertificado: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  saldoDisponible: { type: DataTypes.DECIMAL(18, 2), defaultValue: 0 },
  moneda: { type: DataTypes.ENUM('ARS', 'USD'), defaultValue: 'ARS' },
  estadoVerificacion: { type: DataTypes.ENUM('Pendiente', 'Verificado', 'Rechazado'), defaultValue: 'Pendiente' },
}, { tableName: 'mediosPago', timestamps: true });

// Multas por incumplimiento de pago.
const Multa = sequelize.define('Multa', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cliente: { type: DataTypes.INTEGER, allowNull: false }, // FK -> clientes
  monto: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  fechaLimite: { type: DataTypes.DATE, allowNull: false },
  estado: { type: DataTypes.ENUM('con_deuda', 'pagada'), defaultValue: 'con_deuda' },
}, { tableName: 'multas', timestamps: true });

// Clasificación de productos para búsqueda/filtros (categoría/tags/uso).
const ClasificacionProducto = sequelize.define('ClasificacionProducto', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  producto: { type: DataTypes.INTEGER, allowNull: false, unique: true }, // FK -> productos
  categoria: { type: DataTypes.STRING },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  uso: { type: DataTypes.STRING },
}, { tableName: 'clasificacionProducto', timestamps: false });

// Trámite de inclusión de un bien que propone un cliente-vendedor (módulo 5).
// No está en el esquema de la cátedra; al aceptarse se materializa en un
// Producto + ItemCatalogo reales.
const PropuestaVenta = sequelize.define('PropuestaVenta', {
  identificador: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vendedor: { type: DataTypes.INTEGER, allowNull: false }, // FK -> clientes
  titulo: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.STRING },
  historia: { type: DataTypes.STRING },
  tipo_bien: { type: DataTypes.STRING, defaultValue: 'otro' },
  fotos: { type: DataTypes.JSON, defaultValue: [] },
  qr_titulo: { type: DataTypes.TEXT },
  estado: { type: DataTypes.STRING, defaultValue: 'A inspeccionar' },
  valor_base_sugerido: { type: DataTypes.DECIMAL(18, 2) },
  comisiones: { type: DataTypes.INTEGER, defaultValue: 10 },
  fecha_subasta: { type: DataTypes.DATE },
  monto_venta: { type: DataTypes.DECIMAL(18, 2) },
  metodo_devolucion: { type: DataTypes.STRING },
  costo_flete: { type: DataTypes.DECIMAL(18, 2) },
  ubicacion_deposito: { type: DataTypes.STRING },
  motivo_rechazo: { type: DataTypes.STRING },
  seguro_compania: { type: DataTypes.STRING },
  seguro_cobertura: { type: DataTypes.DECIMAL(18, 2) },
  medio_pago: { type: DataTypes.INTEGER }, // FK -> mediosPago
  producto: { type: DataTypes.INTEGER }, // FK -> productos (al aceptarse)
}, { tableName: 'propuestasVenta', timestamps: true });

/* ============================ Asociaciones (FKs) ========================== */

// Subtipos de persona (1—1).
Persona.hasOne(Cliente, { foreignKey: 'identificador', as: 'cliente' });
Cliente.belongsTo(Persona, { foreignKey: 'identificador', as: 'persona' });
Persona.hasOne(Duenio, { foreignKey: 'identificador', as: 'duenioRel' });
Duenio.belongsTo(Persona, { foreignKey: 'identificador', as: 'persona' });
Persona.hasOne(Subastador, { foreignKey: 'identificador', as: 'subastadorRel' });
Subastador.belongsTo(Persona, { foreignKey: 'identificador', as: 'persona' });
Persona.hasOne(Cuenta, { foreignKey: 'persona', as: 'cuenta' });
Cuenta.belongsTo(Persona, { foreignKey: 'persona', as: 'personaRel' });

// Sectores / empleados.
Sector.belongsTo(Empleado, { foreignKey: 'responsableSector', as: 'responsable' });
Empleado.belongsTo(Sector, { foreignKey: 'sector', as: 'sectorRel' });

// Verificadores.
Cliente.belongsTo(Empleado, { foreignKey: 'verificador', as: 'verificadorEmp' });
Duenio.belongsTo(Empleado, { foreignKey: 'verificador', as: 'verificadorEmp' });
Cliente.belongsTo(Pais, { foreignKey: 'numeroPais', as: 'pais' });
Duenio.belongsTo(Pais, { foreignKey: 'numeroPais', as: 'pais' });

// Subastas / subastadores.
Subasta.belongsTo(Subastador, { foreignKey: 'subastador', as: 'subastadorRel' });

// Productos.
Producto.belongsTo(Duenio, { foreignKey: 'duenio', as: 'duenioRel' });
Producto.belongsTo(Empleado, { foreignKey: 'revisor', as: 'revisorEmp' });
Producto.belongsTo(Seguro, { foreignKey: 'seguro', targetKey: 'nroPoliza', as: 'seguroRel' });
Producto.hasMany(Foto, { foreignKey: 'producto', as: 'fotos' });
Foto.belongsTo(Producto, { foreignKey: 'producto', as: 'productoRel' });
Producto.hasOne(ClasificacionProducto, { foreignKey: 'producto', as: 'clasificacion' });
ClasificacionProducto.belongsTo(Producto, { foreignKey: 'producto', as: 'productoRel' });

// Catálogos / items.
Catalogo.belongsTo(Subasta, { foreignKey: 'subasta', as: 'subastaRel' });
Catalogo.belongsTo(Empleado, { foreignKey: 'responsable', as: 'responsableEmp' });
Subasta.hasMany(Catalogo, { foreignKey: 'subasta', as: 'catalogos' });
ItemCatalogo.belongsTo(Catalogo, { foreignKey: 'catalogo', as: 'catalogoRel' });
ItemCatalogo.belongsTo(Producto, { foreignKey: 'producto', as: 'productoRel' });
Catalogo.hasMany(ItemCatalogo, { foreignKey: 'catalogo', as: 'items' });

// Asistentes / pujos.
Asistente.belongsTo(Cliente, { foreignKey: 'cliente', as: 'clienteRel' });
Asistente.belongsTo(Subasta, { foreignKey: 'subasta', as: 'subastaRel' });
Pujo.belongsTo(Asistente, { foreignKey: 'asistente', as: 'asistenteRel' });
Pujo.belongsTo(ItemCatalogo, { foreignKey: 'item', as: 'itemRel' });
ItemCatalogo.hasMany(Pujo, { foreignKey: 'item', as: 'pujos' });

// Registro de subasta (ventas).
RegistroDeSubasta.belongsTo(Subasta, { foreignKey: 'subasta', as: 'subastaRel' });
RegistroDeSubasta.belongsTo(Duenio, { foreignKey: 'duenio', as: 'duenioRel' });
RegistroDeSubasta.belongsTo(Producto, { foreignKey: 'producto', as: 'productoRel' });
RegistroDeSubasta.belongsTo(Cliente, { foreignKey: 'cliente', as: 'clienteRel' });

// Extras.
MedioPago.belongsTo(Cliente, { foreignKey: 'cliente', as: 'clienteRel' });
Cliente.hasMany(MedioPago, { foreignKey: 'cliente', as: 'mediosPago' });
Multa.belongsTo(Cliente, { foreignKey: 'cliente', as: 'clienteRel' });
Cliente.hasMany(Multa, { foreignKey: 'cliente', as: 'multas' });
PropuestaVenta.belongsTo(Cliente, { foreignKey: 'vendedor', as: 'vendedorRel' });
PropuestaVenta.belongsTo(Producto, { foreignKey: 'producto', as: 'productoRel' });
PropuestaVenta.belongsTo(MedioPago, { foreignKey: 'medio_pago', as: 'medioRel' });

module.exports = {
  sequelize,
  Pais, Persona, Empleado, Sector, Seguro, Cliente, Duenio, Subastador,
  Subasta, Producto, Foto, Catalogo, ItemCatalogo, Asistente, Pujo, RegistroDeSubasta,
  Cuenta, MedioPago, Multa, ClasificacionProducto, PropuestaVenta,
};
