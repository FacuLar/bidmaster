const dns = require('dns').promises;

/* ============================================================================
 * Validaciones "reales" (no de fase de prueba) de datos de registro y medios
 * de pago: existencia real del email y del domicilio, país válido, CBU con
 * dígito verificador, fotos de DNI reales, formato de tarjetas y cheques.
 * Se separan del controller para poder testearlas y reutilizarlas.
 * ========================================================================== */

// fetch con timeout (Node 18+ trae fetch global).
async function fetchConTimeout(url, opciones = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/* -------------------------------------------------------------------------- */
/* TARJETAS                                                                    */
/* -------------------------------------------------------------------------- */

// Reglas por marca: prefijos aceptados, longitudes válidas del número y del CVV.
const MARCAS = [
  { marca: 'AMEX', prefijos: [/^3[47]/], longitudes: [15], cvv: [4] },
  { marca: 'VISA', prefijos: [/^4/], longitudes: [13, 16, 19], cvv: [3] },
  {
    marca: 'MASTERCARD',
    prefijos: [/^5[1-5]/, /^2[2-7]/],
    longitudes: [16],
    cvv: [3],
  },
];

/** Devuelve la marca detectada por el prefijo, o null si no la reconoce. */
function detectarMarca(digitos) {
  return MARCAS.find((m) => m.prefijos.some((re) => re.test(digitos))) || null;
}

/**
 * Algoritmo de Luhn: chequea que el número sea matemáticamente válido (la misma
 * técnica que usan las pasarelas para descartar tarjetas falsas de entrada).
 */
function pasaLuhn(digitos) {
  let suma = 0;
  let alternar = false;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = parseInt(digitos[i], 10);
    if (alternar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    alternar = !alternar;
  }
  return suma % 10 === 0;
}

/** Valida formato MM/AA o MM/AAAA y que la tarjeta no esté vencida. */
function validarVencimiento(vencimiento) {
  const m = String(vencimiento || '').trim().match(/^(\d{2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return { ok: false, motivo: 'El vencimiento debe tener formato MM/AA (ej: 08/27)' };
  const mes = parseInt(m[1], 10);
  let anio = parseInt(m[2], 10);
  if (anio < 100) anio += 2000;
  if (mes < 1 || mes > 12) return { ok: false, motivo: 'El mes del vencimiento es inválido (01-12)' };
  // Último día del mes de vencimiento.
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  if (finDeMes < new Date()) return { ok: false, motivo: 'La tarjeta está vencida' };
  return { ok: true, mes, anio };
}

/**
 * Validación completa de una tarjeta. Devuelve { ok, motivo, marca, ultimos4 }.
 * Exige: número con dígitos coherentes a la marca + Luhn, CVV con la cantidad
 * de dígitos correcta y vencimiento futuro.
 */
function validarTarjeta({ numero, cvv, vencimiento }) {
  const digitos = String(numero || '').replace(/\D/g, '');
  if (!digitos) return { ok: false, motivo: 'Ingresá el número de tarjeta' };

  const marcaInfo = detectarMarca(digitos);
  if (!marcaInfo) {
    return { ok: false, motivo: 'No reconocemos la tarjeta (sólo Visa, Mastercard o Amex)' };
  }
  if (!marcaInfo.longitudes.includes(digitos.length)) {
    return {
      ok: false,
      motivo: `El número de ${marcaInfo.marca} debe tener ${marcaInfo.longitudes.join(' o ')} dígitos`,
    };
  }
  if (!pasaLuhn(digitos)) {
    return { ok: false, motivo: 'Número de tarjeta inválido (no pasó la verificación)' };
  }

  const cvvDigitos = String(cvv || '').replace(/\D/g, '');
  if (!marcaInfo.cvv.includes(cvvDigitos.length)) {
    return {
      ok: false,
      motivo: `El código de seguridad (CVV) de ${marcaInfo.marca} debe tener ${marcaInfo.cvv.join(' o ')} dígitos`,
    };
  }

  const venc = validarVencimiento(vencimiento);
  if (!venc.ok) return { ok: false, motivo: venc.motivo };

  return {
    ok: true,
    marca: marcaInfo.marca,
    ultimos4: digitos.slice(-4),
  };
}

/* -------------------------------------------------------------------------- */
/* CHEQUES                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Validación de cheque certificado. Devuelve { ok, motivo }.
 * Exige número de cheque, banco, monto certificado > 0 y, si viene CBU, que
 * tenga los 22 dígitos reglamentarios.
 */
function validarCheque({ numero_cheque, banco, monto_certificado, cbu }) {
  const nro = String(numero_cheque || '').replace(/\D/g, '');
  if (nro.length < 6 || nro.length > 12) {
    return { ok: false, motivo: 'El número de cheque debe tener entre 6 y 12 dígitos' };
  }
  if (!banco || String(banco).trim().length < 2) {
    return { ok: false, motivo: 'Indicá el banco emisor del cheque' };
  }
  const monto = Number(monto_certificado);
  if (!monto || monto <= 0) {
    return { ok: false, motivo: 'El cheque requiere un monto certificado mayor a 0' };
  }
  if (cbu != null && String(cbu).trim() !== '') {
    const r = validarCBU(cbu);
    if (!r.ok) return r;
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* EMAIL: existencia real (DNS / registros MX)                                 */
/* -------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Dominios de mail temporal/descartable: no se aceptan para registrarse.
const DOMINIOS_DESCARTABLES = new Set([
  'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com',
  'temp-mail.org', 'yopmail.com', 'throwawaymail.com', 'getnada.com',
  'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'maildrop.cc',
]);

// Typos frecuentes de proveedores conocidos -> sugerencia del dominio correcto.
const TYPOS_DOMINIO = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hormail.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'live.co': 'live.com', 'icloud.co': 'icloud.com',
};

/** Validación de FORMATO (no de existencia). */
function emailFormatoValido(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

/**
 * Verifica que el dominio del email exista de verdad consultando sus registros
 * MX (servidores de correo). Si no hay MX, se prueba A/AAAA como último recurso.
 * Sin servidores de correo => el mail no puede existir.
 *
 * Devuelve { ok, motivo }. Si VERIFICAR_EMAIL=false, se saltea (solo formato).
 */
async function verificarEmailExiste(email) {
  if (!emailFormatoValido(email)) {
    return { ok: false, motivo: 'El email no tiene un formato válido' };
  }
  // Permite desactivar la verificación DNS (p. ej. entornos offline).
  if (String(process.env.VERIFICAR_EMAIL || 'true').toLowerCase() === 'false') {
    return { ok: true };
  }

  const dominio = email.trim().split('@')[1].toLowerCase();

  // Typo de un proveedor conocido: avisamos con la sugerencia.
  if (TYPOS_DOMINIO[dominio]) {
    return { ok: false, motivo: `¿Quisiste decir @${TYPOS_DOMINIO[dominio]}? Revisá el dominio del email` };
  }
  // Mail temporal/descartable: no se acepta.
  if (DOMINIOS_DESCARTABLES.has(dominio)) {
    return { ok: false, motivo: 'No se permiten emails temporales o descartables' };
  }

  try {
    const mx = await dns.resolveMx(dominio);
    if (mx && mx.length > 0) return { ok: true };
  } catch (e) {
    // ENOTFOUND / ENODATA => seguimos al fallback A/AAAA.
    if (!['ENOTFOUND', 'ENODATA'].includes(e.code)) {
      // Error transitorio de red/DNS: no podemos afirmar que no exista.
      return { ok: false, motivo: 'No pudimos verificar el email, intentá de nuevo en un momento' };
    }
  }
  // Fallback: algunos dominios reciben mail sin MX (usan el registro A).
  try {
    await dns.resolve(dominio);
    return { ok: true };
  } catch (_) {
    return { ok: false, motivo: 'El dominio del email no existe o no recibe correos' };
  }
}

/* -------------------------------------------------------------------------- */
/* CBU: validación con dígitos verificadores (norma BCRA)                       */
/* -------------------------------------------------------------------------- */

// Verifica un bloque del CBU con sus pesos y el dígito verificador.
function bloqueCbuValido(bloque, pesos) {
  const dv = parseInt(bloque[bloque.length - 1], 10);
  const cuerpo = bloque.slice(0, -1);
  let suma = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    suma += parseInt(cuerpo[i], 10) * pesos[i];
  }
  const calculado = (10 - (suma % 10)) % 10;
  return calculado === dv;
}

/**
 * Valida un CBU argentino real: 22 dígitos = bloque banco (8) + bloque cuenta
 * (14), cada uno con su dígito verificador. Devuelve { ok, motivo }.
 */
function validarCBU(cbu) {
  const d = String(cbu || '').replace(/\D/g, '');
  if (d.length !== 22) return { ok: false, motivo: 'El CBU debe tener 22 dígitos' };
  const banco = d.slice(0, 8);
  const cuenta = d.slice(8);
  if (!bloqueCbuValido(banco, [7, 1, 3, 9, 7, 1, 3])) {
    return { ok: false, motivo: 'CBU inválido (dígito verificador del banco no coincide)' };
  }
  if (!bloqueCbuValido(cuenta, [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3])) {
    return { ok: false, motivo: 'CBU inválido (dígito verificador de la cuenta no coincide)' };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* PAÍS DE ORIGEN: contra una lista real de países                             */
/* -------------------------------------------------------------------------- */

// Lista de países (ES) aceptados como país de origen del postor.
const PAISES = new Set([
  'argentina', 'uruguay', 'paraguay', 'brasil', 'chile', 'bolivia', 'peru',
  'ecuador', 'colombia', 'venezuela', 'mexico', 'estados unidos', 'eeuu', 'usa',
  'canada', 'espana', 'españa', 'portugal', 'francia', 'italia', 'alemania',
  'reino unido', 'inglaterra', 'irlanda', 'suiza', 'austria', 'belgica',
  'holanda', 'paises bajos', 'suecia', 'noruega', 'dinamarca', 'finlandia',
  'polonia', 'rusia', 'ucrania', 'grecia', 'turquia', 'china', 'japon', 'corea',
  'corea del sur', 'india', 'australia', 'nueva zelanda', 'sudafrica', 'israel',
  'emiratos arabes unidos', 'arabia saudita', 'egipto', 'marruecos',
]);

// Normaliza (saca acentos, minúsculas) para comparar contra la lista.
function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Valida que el país de origen sea un país real de la lista. */
function paisValido(pais) {
  return PAISES.has(normalizar(pais));
}

/* -------------------------------------------------------------------------- */
/* NOMBRE / APELLIDO: sólo letras                                              */
/* -------------------------------------------------------------------------- */

// Letras (con acentos y ñ), espacios, apóstrofes y guiones; 2 a 40 caracteres.
const NOMBRE_RE = /^[A-Za-zÀ-ÿ' -]{2,40}$/;
function nombreValido(s) {
  return typeof s === 'string' && NOMBRE_RE.test(s.trim());
}

/* -------------------------------------------------------------------------- */
/* IMÁGENES (DNI): que el base64 sea realmente una imagen                      */
/* -------------------------------------------------------------------------- */

/**
 * Verifica que un data URI sea una imagen real (JPEG/PNG/WebP) chequeando los
 * "magic bytes" del contenido base64, no sólo el prefijo declarado. Evita que
 * se suba texto o un archivo cualquiera como si fuera el DNI.
 */
function esImagenValida(dataUri) {
  if (typeof dataUri !== 'string') return false;
  const m = dataUri.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!m) return false;
  let buf;
  try {
    buf = Buffer.from(m[2], 'base64');
  } catch (_) {
    return false;
  }
  if (buf.length < 1024) return false; // demasiado chica para ser una foto real
  const esJPEG = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const esPNG = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const esWebP = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return esJPEG || esPNG || esWebP;
}

/* -------------------------------------------------------------------------- */
/* DOMICILIO LEGAL: que la calle exista de verdad (OpenStreetMap / Nominatim)   */
/* -------------------------------------------------------------------------- */

/** Validación de FORMATO del domicilio (al menos calle + número). */
function domicilioFormatoValido(dir) {
  return typeof dir === 'string' && dir.trim().length >= 5 && /\d/.test(dir);
}

/**
 * Verifica que el domicilio exista de verdad geocodificándolo contra
 * OpenStreetMap (Nominatim, gratuito, sin API key). Devuelve
 * { ok, motivo, direccion_normalizada }.
 *
 * - VERIFICAR_DOMICILIO=false  -> sólo valida el formato.
 * - Si Nominatim no responde (red/límite), NO bloquea el registro (fail-open)
 *   para no rechazar a un usuario real por una caída del servicio externo.
 */
async function verificarDomicilio(domicilio, pais) {
  if (!domicilioFormatoValido(domicilio)) {
    return { ok: false, motivo: 'Ingresá un domicilio legal válido (calle y número)' };
  }
  if (String(process.env.VERIFICAR_DOMICILIO || 'true').toLowerCase() === 'false') {
    return { ok: true };
  }

  const consulta = pais ? `${domicilio}, ${pais}` : domicilio;
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q='
    + encodeURIComponent(consulta);
  try {
    const resp = await fetchConTimeout(url, {
      headers: { 'User-Agent': 'BidMaster/1.0 (TPO DAI)' },
    });
    if (!resp.ok) return { ok: true }; // servicio caído -> no bloqueamos
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, motivo: 'No encontramos ese domicilio. Revisá la calle, el número y la ciudad' };
    }
    const lugar = data[0];
    // Exigimos que el resultado tenga al menos calle (road) para evitar matches
    // demasiado genéricos (sólo ciudad/país).
    const tieneCalle = lugar.address && (lugar.address.road || lugar.address.pedestrian || lugar.address.residential);
    if (!tieneCalle) {
      return { ok: false, motivo: 'No encontramos esa calle. Ingresá un domicilio más preciso (calle y número)' };
    }
    return { ok: true, direccion_normalizada: lugar.display_name };
  } catch (_) {
    // Timeout / sin internet: no bloqueamos el registro.
    return { ok: true };
  }
}

module.exports = {
  detectarMarca,
  validarTarjeta,
  validarCheque,
  validarCBU,
  paisValido,
  nombreValido,
  esImagenValida,
  emailFormatoValido,
  verificarEmailExiste,
  domicilioFormatoValido,
  verificarDomicilio,
};
