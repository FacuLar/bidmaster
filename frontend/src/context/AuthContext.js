import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthAPI } from '../api/endpoints';

const AuthContext = createContext(null);

/**
 * Maneja la sesión:
 *  - `usuario`: sesión completa (token JWT + datos) tras validar la cuenta.
 *  - `invitado`: usuario registrado pero AÚN NO validado. Entra a la app en
 *    modo solo-lectura (puede ver catálogo/subastas, no pujar) hasta generar
 *    su clave. Guarda { id_solicitud, email }.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [invitado, setInvitado] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('token');
      const data = await AsyncStorage.getItem('usuario');
      const inv = await AsyncStorage.getItem('invitado');
      if (token && data) setUsuario(JSON.parse(data));
      else if (inv) setInvitado(JSON.parse(inv));
      setCargando(false);
    })();
  }, []);

  async function guardarSesion({ token, ...datos }) {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('usuario', JSON.stringify(datos));
    await AsyncStorage.removeItem('invitado'); // deja de ser invitado
    setInvitado(null);
    setUsuario(datos);
  }

  async function login(email, password) {
    const data = await AuthAPI.login(email, password);
    await guardarSesion(data);
    return data;
  }

  // Entra a la app como invitado (registrado pero no validado).
  async function entrarComoInvitado({ id_solicitud, email }) {
    const inv = { id_solicitud, email };
    await AsyncStorage.setItem('invitado', JSON.stringify(inv));
    setInvitado(inv);
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'usuario', 'invitado']);
    setUsuario(null);
    setInvitado(null);
  }

  const esInvitado = !usuario && !!invitado;

  return (
    <AuthContext.Provider value={{
      usuario, invitado, esInvitado, cargando,
      login, logout, guardarSesion, entrarComoInvitado,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
