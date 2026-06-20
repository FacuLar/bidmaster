import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config';

/**
 * Cliente HTTP central. Inyecta el token JWT en cada request y normaliza los
 * mensajes de error que devuelve el backend.
 */
// timeout corto: si el server no responde, el login/registro corta y avisa rápido
// (no se queda "cargando" indefinidamente).
const api = axios.create({ baseURL: API_BASE, timeout: 8000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      // Sin conexión / servidor caído.
      return Promise.reject(new Error('Sin conexión con el servidor. Revisá tu internet.'));
    }
    const msg = error.response.data && error.response.data.error
      ? error.response.data.error
      : 'Ocurrió un error inesperado';
    return Promise.reject(new Error(msg));
  }
);

export default api;
