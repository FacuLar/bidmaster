import { NativeModules } from 'react-native';

/**
 * Configuración de conexión al backend.
 *
 * Detecta automáticamente la IP del servidor a partir de la URL desde la que
 * Expo sirve el bundle (NativeModules.SourceCode.scriptURL). Así funciona solo en
 * cualquier red (Wi-Fi de casa, hotspot del celu/datos, etc.) SIN editar la IP a
 * mano: el backend corre en el mismo equipo que Metro, en el puerto 4000.
 *
 * - Si no se puede detectar (o se usa `--tunnel`), cae a IP_FIJA: editá esa línea
 *   con la IP LAN de tu PC, o con la URL pública del backend si lo desplegás.
 */
const IP_FIJA = '10.145.215.163'; // fallback (cambiá por tu IP o URL pública si hace falta)

function hostDelBundle() {
  try {
    const url = NativeModules?.SourceCode?.scriptURL || '';
    const m = url.match(/https?:\/\/([^/:]+)(?::\d+)?\//);
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
}

const host = hostDelBundle();
const esIpLan = host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host); // IP numérica = misma red

// En IP numérica (LAN/hotspot) usamos ese host; si no (tunnel/dominio), la fija.
const SERVER_HOST = esIpLan ? host : IP_FIJA;

export const API_URL = `http://${SERVER_HOST}:4000`;
export const API_BASE = `${API_URL}/api/v1`;
export const SOCKET_URL = API_URL;
