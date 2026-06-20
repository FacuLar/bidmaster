/**
 * Configuración de conexión al backend.
 *
 * - Emulador Android: usar 'http://10.0.2.2:4000'
 * - iOS simulator / web: usar 'http://localhost:4000'
 * - Dispositivo físico (Expo Go): reemplazar por la IP LAN de tu PC,
 *   por ejemplo 'http://192.168.0.10:4000'.
 * - Backend desplegado online: usar la URL pública (https://...).
 */
export const API_URL = 'http://192.168.0.15:4000';
export const API_BASE = `${API_URL}/api/v1`;
export const SOCKET_URL = API_URL;
