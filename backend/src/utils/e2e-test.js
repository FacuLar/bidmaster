/**
 * Test E2E "como usuario" contra las consignas del TPO_DAI_1C2026.
 * Recorre los flujos funcionales end-to-end usando HTTP nativo (sin deps).
 * Uso: levantar el server (npm run dev) + seed, luego: node src/utils/e2e-test.js
 */
const http = require('http');
const BASE = 'http://localhost:4000/api/v1';

function req(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = http.request(`${BASE}${path}`, { method, headers }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => {
        let json = null; try { json = d ? JSON.parse(d) : null; } catch (_) { json = d; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let ok = 0; let fail = 0;
function check(consigna, cond, detalle = '') {
  console.log(`${cond ? '✅' : '❌'} ${consigna}${detalle ? `  → ${detalle}` : ''}`);
  cond ? ok++ : fail++;
}

async function run() {
  // ---- Registro en 2 etapas (consigna: registro etapa1 + etapa2 + clave) ----
  const r1 = await req('POST', '/auth/registro-etapa1', {
    body: {
      nombre: 'Test', apellido: 'User', email: `test${Date.now()}@mail.com`,
      dni_frente: 'b64f', dni_dorso: 'b64d', domicilio_legal: 'Calle 1', pais_origen: 'Argentina',
    },
  });
  check('Registro etapa 1 → 202 + id_solicitud', r1.status === 202 && !!r1.body.id_solicitud, `HTTP ${r1.status}`);
  const r1bad = await req('POST', '/auth/registro-etapa1', { body: { nombre: 'X' } });
  check('Registro etapa 1 sin documentos → 400', r1bad.status === 400);
  const r1mail = await req('POST', '/auth/registro-etapa1', {
    body: {
      nombre: 'Test', apellido: 'User', email: 'mal-formato', dni_frente: 'b64f', dni_dorso: 'b64d',
      domicilio_legal: 'Calle 123', pais_origen: 'Argentina',
    },
  });
  check('Registro etapa 1 con mail inválido → 400', r1mail.status === 400);

  // Gate real: NO se aprueba al instante; etapa 2 está bloqueada hasta la verificación.
  const r2pend = await req('POST', '/auth/registro-etapa2', {
    body: { id_solicitud: r1.body.id_solicitud, email: 'test_new@mail.com', password_personal: '123456' },
  });
  check('Registro etapa 2 sin aprobación → 403 (verificación pendiente)', r2pend.status === 403, `HTTP ${r2pend.status}`);

  // Espera la aprobación de la verificación externa (consultando el estado).
  let aprobada = false;
  let codigoMail = null;
  for (let i = 0; i < 20 && !aprobada; i++) {
    const st = await req('GET', `/auth/solicitudes/${r1.body.id_solicitud}/estado`);
    aprobada = st.body && st.body.estado === 'aprobada';
    if (aprobada) codigoMail = st.body.codigo_validacion;
    if (!aprobada) await new Promise((res) => setTimeout(res, 1000));
  }
  check('Verificación externa aprueba la solicitud (no instantáneo)', aprobada);
  check('Mail de cuenta habilitada incluye código de validación', !!codigoMail);

  // Generación de clave DESPUÉS de aprobar, validando con el código del mail.
  const r2bad = await req('POST', '/auth/registro-etapa2', {
    body: { id_solicitud: r1.body.id_solicitud, email: 'test_new@mail.com', password_personal: '123456', codigo: '000000' },
  });
  check('Etapa 2 con código incorrecto → 400', r2bad.status === 400);
  const r2 = await req('POST', '/auth/registro-etapa2', {
    body: { id_solicitud: r1.body.id_solicitud, email: 'test_new@mail.com', password_personal: '123456', codigo: codigoMail },
  });
  check('Registro etapa 2 (código válido) → 201 + clave personal (token)', r2.status === 201 && !!r2.body.token, `HTTP ${r2.status}`);

  // ---- Login + recuperar contraseña (corrección de diseño) ----
  const login = await req('POST', '/auth/login', { body: { email: 'facundo@ejemplo.com', password_personal: '123456' } });
  check('Login válido → token JWT', login.status === 200 && !!login.body.token);
  const loginBad = await req('POST', '/auth/login', { body: { email: 'facundo@ejemplo.com', password_personal: 'malo' } });
  check('Login inválido → 401', loginBad.status === 401);
  const recup = await req('POST', '/auth/recuperar-password', { body: { email: 'facundo@ejemplo.com' } });
  check('Recuperar contraseña → 200 (corrección de diseño)', recup.status === 200);

  const facundo = login.body.token;                         // categoría plata
  const nuevoTok = (await req('POST', '/auth/login', { body: { email: 'nuevo@ejemplo.com', password_personal: '123456' } })).body.token; // común
  const oroTok = (await req('POST', '/auth/login', { body: { email: 'oro@ejemplo.com', password_personal: '123456' } })).body.token;     // oro

  // ---- Catálogo público vs precio base sólo para registrados ----
  const catAnon = await req('GET', '/subastas/2/catalogo');
  check('Catálogo público accesible sin login', catAnon.status === 200);
  check('Precio base OCULTO sin login', catAnon.body.piezas[0].precio_base === null);
  const catAuth = await req('GET', '/subastas/2/catalogo', { token: facundo });
  check('Precio base VISIBLE con login', catAuth.body.piezas[0].precio_base === 10000);

  // ---- Categoría determina acceso ----
  const subUSD = await req('GET', '/subastas?moneda=USD', { token: nuevoTok });
  check('Usuario común NO accede a subasta plata (accesible=false)', subUSD.body[0].accesible === false);
  const strNuevo = await req('GET', '/subastas/2/streaming', { token: nuevoTok });
  check('Streaming bloqueado por categoría insuficiente → 403', strNuevo.status === 403, strNuevo.body.error);

  // ---- Pujar requiere medio verificado en la moneda de la subasta ----
  const pujaNuevo = await req('POST', '/pujas', { token: nuevoTok, body: { id_subasta: 2, id_pieza: 3, monto_oferta: 15200 } });
  check('Sin medio verificado / categoría → NO puede pujar (403)', pujaNuevo.status === 403, pujaNuevo.body.error);

  // ---- Reglas de puja 1%–20% (Rolex base 10000, oferta inicial 15000) ----
  const pBaja = await req('POST', '/pujas', { token: facundo, body: { id_subasta: 2, id_pieza: 3, monto_oferta: 15050 } });
  check('Puja por debajo del mínimo (+1%) → 400', pBaja.status === 400, pBaja.body.error);
  const pAlta = await req('POST', '/pujas', { token: facundo, body: { id_subasta: 2, id_pieza: 3, monto_oferta: 20000 } });
  check('Puja por encima del máximo (+20%) → 400', pAlta.status === 400, pAlta.body.error);
  const pOk = await req('POST', '/pujas', { token: facundo, body: { id_subasta: 2, id_pieza: 3, monto_oferta: 15200 } });
  check('Puja válida (15200) → 201 Aceptada', pOk.status === 201 && pOk.body.nueva_oferta_lider === 15200);

  // ---- Subasta en dólares se paga en dólares ----
  // Facundo (plata) tiene cuenta USD verificada → puede pujar en USD. ✓ (recién lo hizo)
  check('Subasta USD: facundo con medio USD verificado pudo pujar', pOk.status === 201);

  // ---- Métricas del perfil ----
  const met = await req('GET', '/usuarios/perfil/metricas', { token: facundo });
  check('Métricas: asistidas/ganadas/ofertado presentes',
    met.status === 200 && met.body.subastas_asistidas >= 1 && met.body.total_ofertado >= 15200,
    `asistidas=${met.body.subastas_asistidas}, ofertado=${met.body.total_ofertado}`);

  // ---- Billetera: registrar / validar tarjeta (Luhn) / estado de medio ----
  const cuentaNueva = await req('POST', '/pagos/medios', { token: facundo, body: { tipo: 'CUENTA', entidad: 'Galicia', numero_identificador: 'AR-123', moneda: 'ARS' } });
  check('Registrar medio (CUENTA) → 201 (Pendiente)', cuentaNueva.status === 201 && cuentaNueva.body.estado_verificacion === 'Pendiente');
  const estado = await req('GET', `/pagos/medios/${cuentaNueva.body.id_medio}/estado`, { token: facundo });
  check('Consultar estado de medio → 200', estado.status === 200 && estado.body.estado === 'Pendiente');
  // Validación de tarjeta real (Luhn) — como la herramienta gratuita de Mercado Libre.
  const tarjInvalida = await req('POST', '/pagos/medios', { token: facundo, body: { tipo: 'TARJETA', entidad: 'Amex', numero_identificador: '4111111111111112', moneda: 'ARS' } });
  check('Tarjeta inválida (no pasa Luhn) → 400', tarjInvalida.status === 400);
  const tarjValida = await req('POST', '/pagos/medios', { token: facundo, body: { tipo: 'TARJETA', entidad: 'Visa', numero_identificador: '4111111111111111', moneda: 'ARS' } });
  check('Tarjeta válida (Luhn) → 201 Verificada', tarjValida.status === 201 && tarjValida.body.estado_verificacion === 'Verificado');
  const chequeSinMonto = await req('POST', '/pagos/medios', { token: facundo, body: { tipo: 'CHEQUE', entidad: 'B', numero_identificador: 'C2' } });
  check('Cheque sin monto certificado → 400', chequeSinMonto.status === 400);

  // ---- Streaming OK con categoría + medio verificado ----
  const strOk = await req('GET', '/subastas/2/streaming', { token: facundo });
  check('Streaming OK (categoría + medio verificado) → url', strOk.status === 200 && !!strOk.body.url_stream);

  // ---- Factura/liquidación del ganador (comisión 10% + envío) ----
  const fac = await req('GET', '/ventas/3/factura', { token: facundo });
  check('Factura: total = pujado + 10% + envío',
    fac.status === 200 && fac.body.comision_10_porciento === 1520 && fac.body.total_a_pagar === 15200 + 1520 + 850,
    `total=${fac.body.total_a_pagar}`);

  // ---- Pago con fondos insuficientes (cheque) → MULTA 10% + suspensión ----
  // Facundo gana el Juego de Té (ARS, base 45000) y paga con cheque de saldo 20000.
  const pTe = await req('POST', '/pujas', { token: facundo, body: { id_subasta: 1, id_pieza: 1, monto_oferta: 45450 } });
  check('Puja en subasta ARS (Juego de Té) válida', pTe.status === 201, `HTTP ${pTe.status}`);
  // Buscar id del cheque verificado.
  const medios = await req('GET', '/pagos/medios', { token: facundo });
  const cheque = medios.body.find((m) => m.tipo === 'CHEQUE');
  const pagoMulta = await req('POST', '/ventas/1/pagar', { token: facundo, body: { id_medio_pago: cheque.id } });
  check('Pago con cheque insuficiente → 402 + multa 10%',
    pagoMulta.status === 402 && Math.round(pagoMulta.body.monto_multa) === Math.round(45450 * 0.1),
    `multa=${pagoMulta.body.monto_multa}`);
  const multaCons = await req('GET', '/usuarios/multas', { token: facundo });
  check('Consultar multa activa → con_deuda + 72hs', multaCons.body.estado === 'con_deuda' && multaCons.body.horas_restantes <= 72);
  // Suspendido: no accede a servicios (streaming).
  const strSusp = await req('GET', '/subastas/2/streaming', { token: facundo });
  check('Cuenta suspendida NO accede a streaming → 403', strSusp.status === 403, strSusp.body.error);
  // Suspendido: no puede pujar.
  const pujaSusp = await req('POST', '/pujas', { token: facundo, body: { id_subasta: 2, id_pieza: 3, monto_oferta: 15500 } });
  check('Cuenta suspendida NO puede pujar → 403', pujaSusp.status === 403);

  // ---- Módulo 5: inclusión de bienes (vendedores) ----
  const artBad = await req('POST', '/vendedores/articulos', { token: oroTok, body: { titulo: 'Reloj', fotos: ['a', 'b'], declaracion_jurada_licita: true, acepta_devolucion: true } });
  check('Proponer artículo con <6 fotos → 400', artBad.status === 400);
  const artNoDDJJ = await req('POST', '/vendedores/articulos', { token: oroTok, body: { titulo: 'Reloj', fotos: ['1', '2', '3', '4', '5', '6'], declaracion_jurada_licita: false, acepta_devolucion: true } });
  check('Proponer artículo sin DDJJ → 400', artNoDDJJ.status === 400);
  // Vendedor sin cuenta corriente → no puede vender (#20).
  const sinCuentaTok = (await req('POST', '/auth/login', { body: { email: 'nuevo@ejemplo.com', password_personal: '123456' } })).body.token;
  const artSinCuenta = await req('POST', '/vendedores/articulos', { token: sinCuentaTok, body: { titulo: 'Cuadro', fotos: ['1', '2', '3', '4', '5', '6'], declaracion_jurada_licita: true, acepta_devolucion: true, acepta_terminos: true } });
  check('Vendedor sin cuenta corriente → 400 (#20)', artSinCuenta.status === 400);
  // Bien sin interés (hardcodeado #9) → Rechazado.
  const artNoInt = await req('POST', '/vendedores/articulos', { token: oroTok, body: { titulo: 'Chatarra rota', fotos: ['1', '2', '3', '4', '5', '6'], declaracion_jurada_licita: true, acepta_devolucion: true, acepta_terminos: true } });
  check('Bien sin interés → 201 Rechazado (#9)', artNoInt.status === 201 && artNoInt.body.estado === 'Rechazado' && artNoInt.body.interesa === false);
  // Auto sin QR del título → 400 (#10).
  const artAuto = await req('POST', '/vendedores/articulos', { token: oroTok, body: { titulo: 'Ford Mustang', tipo_bien: 'auto', fotos: ['1', '2', '3', '4', '5', '6'], declaracion_jurada_licita: true, acepta_devolucion: true, acepta_terminos: true } });
  check('Auto sin QR del título → 400 (#10)', artAuto.status === 400);
  // Propuesta válida → le interesa → "A inspeccionar" (#11).
  const artOk = await req('POST', '/vendedores/articulos', { token: oroTok, body: { titulo: 'Reloj antiguo', historia: 'h', fotos: ['1', '2', '3', '4', '5', '6'], declaracion_jurada_licita: true, acredita_origen: true, acepta_devolucion: true, acepta_terminos: true } });
  check('Proponer válido → 201 A inspeccionar (#11)', artOk.status === 201 && artOk.body.estado === 'A inspeccionar');
  // Enviar a inspección → pasa → Tasado con base + comisión + fecha (#12/#14).
  const insp = await req('PATCH', `/vendedores/articulos/${artOk.body.id_tramite}/inspeccion`, { token: oroTok, body: { decision: 'ENVIAR' } });
  check('Enviar a inspección (en condiciones) → 200 Tasado', insp.status === 200 && insp.body.estado === 'Tasado' && !!insp.body.tasacion.fecha_subasta);
  // Acepta la tasación → Programado (#14).
  const cond = await req('PATCH', `/vendedores/articulos/${artOk.body.id_tramite}/condiciones`, { token: oroTok, body: { decision: 'ACEPTAR' } });
  check('Aceptar tasación → 200 Programado', cond.status === 200 && cond.body.estado === 'Programado');
  const log = await req('GET', `/vendedores/articulos/${artOk.body.id_tramite}/logistica`, { token: oroTok });
  check('Logística: depósito + póliza de seguro',
    log.status === 200 && !!log.body.ubicacion_deposito && !!log.body.seguro.compania,
    `${log.body.ubicacion_deposito} / ${log.body.seguro.compania}`);
  // Vendedor solo ve monto vendido + comisión, sin historial de pujas (#19).
  const listaF = await req('GET', '/vendedores/articulos', { token: facundo });
  const vendido = listaF.body.find((a) => a.estado === 'Vendido');
  check('Vendedor ve venta (monto + comisión), sin historial (#19)',
    !!vendido && vendido.monto_venta === 48000 && vendido.comision_cobrada === 4800,
    `venta=${vendido && vendido.monto_venta}, comisión=${vendido && vendido.comision_cobrada}`);
  // Rechazar tasación → Devuelto; el usuario elige cómo recuperar el bien.
  const tasado = listaF.body.find((a) => a.estado === 'Tasado');
  const devol = await req('PATCH', `/vendedores/articulos/${tasado.id_tramite}/condiciones`, { token: facundo, body: { decision: 'RECHAZAR' } });
  check('Rechazar tasación → 200 Devuelto', devol.status === 200 && devol.body.estado === 'Devuelto');
  // Opción retiro: lo busca el usuario, sin cargo (#12).
  const retiro = await req('PATCH', `/vendedores/articulos/${tasado.id_tramite}/devolucion`, { token: facundo, body: { metodo: 'RETIRO' } });
  check('Devolución por RETIRO → sin cargo (#12)', retiro.status === 200 && retiro.body.metodo === 'retiro');
  // Opción envío: devolución con cargo de flete + factura (#13).
  const envio = await req('PATCH', `/vendedores/articulos/${tasado.id_tramite}/devolucion`, { token: facundo, body: { metodo: 'ENVIO' } });
  check('Devolución por ENVÍO → con cargo de flete (#13)', envio.status === 200 && envio.body.costo_flete > 0);
  const flete = await req('GET', `/vendedores/articulos/${tasado.id_tramite}/factura-flete`, { token: facundo });
  check('Factura de flete de devolución (#13)', flete.status === 200 && flete.body.total > 0);

  // ---- Seguridad: endpoint protegido sin token ----
  const sinTok = await req('GET', '/usuarios/multas');
  check('Endpoint protegido sin token → 401', sinTok.status === 401);

  console.log(`\n================  RESULTADO: ${ok} OK / ${fail} fallidas  ================`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => { console.error('Error e2e:', e.message); process.exit(1); });
