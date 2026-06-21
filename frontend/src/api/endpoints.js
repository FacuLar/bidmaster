import api from './client';

/* Agrupa las llamadas a la API REST por módulo (trazabilidad con la spec). */
export const AuthAPI = {
  login: (email, password_personal) =>
    api.post('/auth/login', { email, password_personal }).then((r) => r.data),
  registroEtapa1: (datos) =>
    // Timeout amplio: el backend verifica el email (MX) y el domicilio (geocoding).
    api.post('/auth/registro-etapa1', datos, { timeout: 25000 }).then((r) => r.data),
  estadoSolicitud: (id) =>
    api.get(`/auth/solicitudes/${id}/estado`).then((r) => r.data),
  registroEtapa2: (id_solicitud, email, password_personal, codigo) =>
    api.post('/auth/registro-etapa2', { id_solicitud, email, password_personal, codigo }).then((r) => r.data),
  reanudarRegistro: (email) =>
    api.post('/auth/reanudar-registro', { email }).then((r) => r.data),
  recuperarPassword: (email) =>
    api.post('/auth/recuperar-password', { email }).then((r) => r.data),
  resetearPassword: (email, codigo, password_nueva) =>
    api.post('/auth/resetear-password', { email, codigo, password_nueva }).then((r) => r.data),
};

export const UsuarioAPI = {
  metricas: () => api.get('/usuarios/perfil/metricas').then((r) => r.data),
  multas: () => api.get('/usuarios/multas').then((r) => r.data),
  // Devuelve {status, data}: 200 pagada / 402 sin fondos.
  pagarMulta: (id_medio_pago) =>
    api.post('/usuarios/multas/pagar', { id_medio_pago },
      { validateStatus: (s) => s === 200 || s === 402 })
      .then((r) => ({ status: r.status, data: r.data })),
};

export const PagoAPI = {
  listar: () => api.get('/pagos/medios').then((r) => r.data),
  registrar: (medio) => api.post('/pagos/medios', medio).then((r) => r.data),
  eliminar: (id) => api.delete(`/pagos/medios/${id}`).then((r) => r.data),
  estado: (id) => api.get(`/pagos/medios/${id}/estado`).then((r) => r.data),
};

export const SubastaAPI = {
  listar: (moneda) =>
    api.get('/subastas', { params: moneda ? { moneda } : {} }).then((r) => r.data),
  catalogo: (id) => api.get(`/subastas/${id}/catalogo`).then((r) => r.data),
  // params opcionales: { id_medio, id_pieza } para elegir el medio y validar fondos.
  streaming: (id, params = {}) =>
    api.get(`/subastas/${id}/streaming`, { params }).then((r) => r.data),
};

export const PujaAPI = {
  pujar: (datos) => api.post('/pujas', datos).then((r) => r.data),
  factura: (idPieza, retiro = false) =>
    api.get(`/ventas/${idPieza}/factura`, { params: { retiro } }).then((r) => r.data),
  // Devuelve {status, data}: 200 pagada / 402 multa_aplicada.
  pagar: (idPieza, id_medio_pago, retiro_personal = false) =>
    api.post(`/ventas/${idPieza}/pagar`, { id_medio_pago, retiro_personal },
      { validateStatus: (s) => s === 200 || s === 402 })
      .then((r) => ({ status: r.status, data: r.data })),
};

export const VendedorAPI = {
  listar: () => api.get('/vendedores/articulos').then((r) => r.data),
  proponer: (articulo) => api.post('/vendedores/articulos', articulo).then((r) => r.data),
  inspeccion: (id, decision) =>
    api.patch(`/vendedores/articulos/${id}/inspeccion`, { decision }).then((r) => r.data),
  condiciones: (id, decision) =>
    api.patch(`/vendedores/articulos/${id}/condiciones`, { decision }).then((r) => r.data),
  devolucion: (id, metodo) =>
    api.patch(`/vendedores/articulos/${id}/devolucion`, { metodo }).then((r) => r.data),
  facturaFlete: (id) => api.get(`/vendedores/articulos/${id}/factura-flete`).then((r) => r.data),
  logistica: (id) => api.get(`/vendedores/articulos/${id}/logistica`).then((r) => r.data),
};
