const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Bien que un usuario propone a la empresa para subastar (Módulo 5).
 * Flujo: En revisión -> (¿interesa?) -> A inspeccionar -> En inspección ->
 *        Tasado -> Programado -> Vendido   (o Rechazado / Devuelto / Cancelado)
 */
const Articulo = sequelize.define('Articulo', {
  id_tramite: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  titulo: { type: DataTypes.STRING, allowNull: false },
  descripcion: { type: DataTypes.TEXT },
  historia: { type: DataTypes.TEXT },
  // Tipo de bien: condiciona la prueba de propiedad (auto -> QR del título).
  tipo_bien: { type: DataTypes.ENUM('auto', 'obra', 'otro'), defaultValue: 'otro' },
  // Mínimo 6 fotos (validado en el controlador).
  fotos: { type: DataTypes.JSON, defaultValue: [] },
  // Pruebas de propiedad (no siempre obligatorias; según el valor del bien).
  qr_titulo: { type: DataTypes.STRING },        // autos: QR del título
  compraventa: { type: DataTypes.STRING },       // boleto de compraventa (opcional)
  fotos_prueba: { type: DataTypes.JSON, defaultValue: [] }, // fotos viejas como prueba
  // Declaraciones juradas / términos obligatorios del formulario.
  acepta_devolucion: { type: DataTypes.BOOLEAN, defaultValue: false },
  acepta_terminos: { type: DataTypes.BOOLEAN, defaultValue: false },
  declaracion_jurada_licita: { type: DataTypes.BOOLEAN, defaultValue: false },
  acredita_origen: { type: DataTypes.BOOLEAN, defaultValue: false },
  estado: {
    type: DataTypes.ENUM(
      'En revisión', 'A inspeccionar', 'En inspección', 'Tasado',
      'Programado', 'Vendido', 'Rechazado', 'Devuelto', 'Cancelado',
    ),
    defaultValue: 'En revisión',
  },
  // Tasación que propone la empresa y el vendedor acepta/rechaza (#14).
  valor_base_sugerido: { type: DataTypes.FLOAT },
  comisiones: { type: DataTypes.FLOAT },          // % de comisión
  fecha_subasta: { type: DataTypes.DATEONLY },
  // Pieza generada al aceptar la tasación (queda incluida en una subasta).
  pieza_id: { type: DataTypes.INTEGER, allowNull: true },
  // Resultado de venta (lo único que ve el vendedor; sin historial de pujas #19).
  monto_venta: { type: DataTypes.FLOAT },
  // Logística y seguro una vez aceptado.
  ubicacion_deposito: { type: DataTypes.STRING },
  seguro_compania: { type: DataTypes.STRING },
  seguro_cobertura: { type: DataTypes.FLOAT },
  // Devolución del bien rechazado: el usuario lo retira (#12) o se envía con
  // cargo de flete (#13).
  metodo_devolucion: { type: DataTypes.ENUM('retiro', 'envio') },
  costo_flete: { type: DataTypes.FLOAT },
  motivo_rechazo: { type: DataTypes.STRING },
}, {
  tableName: 'articulos',
});

module.exports = Articulo;
