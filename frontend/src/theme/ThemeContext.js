import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from './colors';

const ThemeContext = createContext({ colors: lightColors, dark: false, toggleTema: () => {} });

/* Provee la paleta activa (clara/oscura) y persiste la preferencia. */
export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('tema').then((v) => { if (v === 'dark') setDark(true); });
  }, []);

  async function toggleTema() {
    setDark((d) => {
      const nuevo = !d;
      AsyncStorage.setItem('tema', nuevo ? 'dark' : 'light');
      return nuevo;
    });
  }

  const colors = dark ? darkColors : lightColors;
  return (
    <ThemeContext.Provider value={{ colors, dark, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
