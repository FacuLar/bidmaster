const express = require('express');
const router = express.Router();

const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const auth = require('../controllers/authController');
const usuario = require('../controllers/usuarioController');
const pago = require('../controllers/pagoController');
const subasta = require('../controllers/subastaController');
const puja = require('../controllers/pujaController');
const vendedor = require('../controllers/vendedorController');

/* --------------------- Módulo 1: Autenticación --------------------- */
router.post('/auth/login', auth.login);
router.post('/auth/registro-etapa1', auth.registroEtapa1);
router.get('/auth/solicitudes/:id/estado', auth.estadoSolicitud); // estado de verificación externa
router.post('/auth/registro-etapa2', auth.registroEtapa2);
router.post('/auth/reanudar-registro', auth.reanudarRegistro); // volver a validar por email
router.post('/auth/recuperar-password', auth.recuperarPassword); // corrección de diseño
router.post('/auth/resetear-password', auth.resetearPassword); // setea la nueva clave
router.get('/usuarios/perfil/metricas', requireAuth, usuario.metricas);
router.get('/usuarios/multas', requireAuth, usuario.multas);
router.post('/usuarios/multas/pagar', requireAuth, usuario.pagarMulta);

/* --------------------- Módulo 2: Billetera ------------------------- */
router.post('/pagos/medios', requireAuth, pago.registrarMedio);
router.get('/pagos/medios', requireAuth, pago.listarMedios);
router.get('/pagos/medios/:id/estado', requireAuth, pago.estadoMedio);

/* --------------------- Módulo 3: Catálogo y Subastas --------------- */
router.get('/subastas', optionalAuth, subasta.listarSubastas);
router.get('/subastas/:id/catalogo', optionalAuth, subasta.catalogo);
router.get('/subastas/:id/streaming', requireAuth, subasta.streaming);

/* --------------------- Módulo 4: Pujas y Facturación -------------- */
router.post('/pujas', requireAuth, puja.pujar);
router.get('/ventas/:id_pieza/factura', requireAuth, puja.factura);
router.post('/ventas/:id_pieza/pagar', requireAuth, puja.pagar);

/* --------------------- Módulo 5: Inclusión de Bienes ------------- */
router.get('/vendedores/articulos', requireAuth, vendedor.listarArticulos);
router.post('/vendedores/articulos', requireAuth, vendedor.proponerArticulo);
router.patch('/vendedores/articulos/:id/inspeccion', requireAuth, vendedor.confirmarInspeccion);
router.patch('/vendedores/articulos/:id/condiciones', requireAuth, vendedor.responderCondiciones);
router.patch('/vendedores/articulos/:id/devolucion', requireAuth, vendedor.confirmarDevolucion);
router.get('/vendedores/articulos/:id/factura-flete', requireAuth, vendedor.facturaFlete);
router.get('/vendedores/articulos/:id/logistica', requireAuth, vendedor.logistica);

/* --------------------- Administración (sólo Postman) --------------------- */
/* Todas requieren el header  x-admin-key: <ADMIN_KEY>  (ver POSTMAN-ADMIN.md). */
// Aprobación manual de registros.
router.get('/admin/solicitudes', requireAdmin, auth.adminListarSolicitudes);
router.patch('/admin/solicitudes/:id/resolver', requireAdmin, auth.adminResolverSolicitud);
// Verificación manual de medios de pago.
router.get('/admin/pagos/medios', requireAdmin, pago.adminListarMedios);
router.patch('/admin/pagos/medios/:id/verificar', requireAdmin, pago.adminVerificarMedio);

module.exports = router;
