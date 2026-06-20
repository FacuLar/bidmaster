import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../config';

/**
 * Conecta al motor de pujas en tiempo real, autenticando con el JWT.
 * Devuelve el socket ya conectado (o lo reusa si ya existe).
 */
let socket = null;

export async function conectarSocket() {
  const token = await AsyncStorage.getItem('token');
  if (socket && socket.connected) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
  });
  return socket;
}

export function desconectarSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}
