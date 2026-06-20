/**
 * Prueba del motor de pujas en tiempo real (Socket.IO).
 * Simula DOS postores en la misma sala y verifica:
 *  - autenticación por JWT en el handshake,
 *  - broadcast de la nueva oferta líder a toda la sala,
 *  - confirmación al emisor (secuencialidad),
 *  - rechazo de pujas inválidas.
 * Uso: node src/utils/ws-test.js   (con el server corriendo + seed cargado)
 */
// socket.io-client está en el frontend; se resuelve desde allí para la prueba.
const path = require('path');
let io;
try {
  ({ io } = require('socket.io-client'));
} catch (_) {
  ({ io } = require(path.join(__dirname, '..', '..', '..', 'frontend', 'node_modules', 'socket.io-client')));
}
const http = require('http');

const URL = 'http://localhost:4000';

function login(email) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ email, password_personal: '123456' });
    const req = http.request(`${URL}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(JSON.parse(d).token));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

const log = (q, m) => console.log(`${q} ${m}`);

(async () => {
  const tokenFacundo = await login('facundo@ejemplo.com');
  const tokenOro = await login('oro@ejemplo.com');

  const a = io(URL, { transports: ['websocket'], auth: { token: tokenFacundo } });
  const b = io(URL, { transports: ['websocket'], auth: { token: tokenOro } });

  let confirmadas = 0; let broadcastsB = 0; let rechazos = 0;

  a.on('connect', () => log('✅', 'Postor A (Facundo) conectado'));
  b.on('connect', () => log('✅', 'Postor B (Oro) conectado'));

  a.on('puja_confirmada', (d) => { confirmadas++; log('✅', `A recibió confirmación de su puja: $${d.monto}`); });
  a.on('puja_rechazada', (d) => { rechazos++; log('✅', `A recibió rechazo correcto: ${d.motivo}`); });
  b.on('oferta_actualizada', (d) => { broadcastsB++; log('✅', `B recibió broadcast de nueva oferta líder: $${d.nueva_oferta_lider}`); });

  // Ambos entran a la sala de la subasta 2 (Rolex en USD).
  a.emit('join_subasta', { id_subasta: 2 });
  b.emit('join_subasta', { id_subasta: 2 });

  setTimeout(() => {
    // Puja válida de A: 15200 (rolex base 10000, oferta inicial 15000).
    a.emit('nueva_puja', { id_subasta: 2, id_pieza: 3, monto: 15200 });
  }, 600);

  setTimeout(() => {
    // Puja inválida de A (fuera del +20%): debe rechazarse.
    a.emit('nueva_puja', { id_subasta: 2, id_pieza: 3, monto: 999999 });
  }, 1200);

  setTimeout(() => {
    console.log('\n--- Resumen WS ---');
    console.log(`confirmaciones a A: ${confirmadas} (esperado >=1)`);
    console.log(`broadcasts a B:     ${broadcastsB} (esperado >=1)`);
    console.log(`rechazos a A:       ${rechazos} (esperado >=1)`);
    const ok = confirmadas >= 1 && broadcastsB >= 1 && rechazos >= 1;
    console.log(ok ? '\n🎉 Motor de pujas en tiempo real OK' : '\n❌ Falló alguna verificación');
    a.close(); b.close();
    process.exit(ok ? 0 : 1);
  }, 2200);
})();
