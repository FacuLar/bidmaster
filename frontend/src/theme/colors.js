/**
 * Paleta de colores — concepto "Trust & Action" (Primera Entrega).
 * Soporta modo claro y oscuro. Cada token mantiene su SEMÁNTICA en ambos modos:
 *  - `nav`        → fondo de barras/headers (siempre navy oscuro).
 *  - `superficie` → fondo de tarjetas/inputs.
 *  - `fondo`/`grisPerla` → fondo general de pantalla.
 *  - `azulMarino`/`textoOscuro` → texto principal (oscuro en claro, claro en oscuro).
 *  - `blanco` → texto sobre superficies oscuras (siempre blanco).
 */
export const lightColors = {
  // Marca / base
  azulMarino: '#0A192F',   // texto principal (títulos)
  naranja: '#FF6B00',
  dorado: '#D4AF37',
  verde: '#10B981',
  rojo: '#EF4444',
  blanco: '#FFFFFF',       // texto sobre fondos oscuros
  grisPerla: '#F3F4F6',    // fondo general
  grisTexto: '#6B7280',
  grisBorde: '#E5E7EB',
  azulClaro: '#172A46',
  textoOscuro: '#111827',  // texto principal

  // Superficies / navegación
  nav: '#0A192F',          // headers, tab bar, botones oscuros, splash/login
  superficie: '#FFFFFF',   // tarjetas / inputs
  fondo: '#F1F4F8',

  // Variantes
  azulProfundo: '#060F22',
  azulMedio: '#13294B',
  naranjaOscuro: '#E25C00',
  naranjaSuave: '#FFF1E8',
  doradoOscuro: '#B8941F',
  doradoSuave: '#FBF4DC',
  verdeOscuro: '#0E9E6E',
  verdeSuave: '#E7F8F1',
  rojoSuave: '#FDECEC',
  azulInfo: '#3B82F6',
  azulInfoSuave: '#EAF1FE',
  textoSuave: '#9CA3AF',
  borde: '#E5E7EB',
  bordeFuerte: '#CBD5E1',
};

export const darkColors = {
  azulMarino: '#DCE6F2',   // texto principal (claro sobre oscuro)
  naranja: '#FF7A1A',
  dorado: '#E2C34F',
  verde: '#34D399',
  rojo: '#F87171',
  blanco: '#FFFFFF',
  grisPerla: '#0E1525',    // fondo general (oscuro)
  grisTexto: '#9AA6B8',
  grisBorde: '#2A3550',
  azulClaro: '#22304A',
  textoOscuro: '#E8EDF4',  // texto principal (claro)

  nav: '#0A192F',          // headers/tab bar quedan navy en ambos modos
  superficie: '#18202F',   // tarjetas / inputs (oscuro)
  fondo: '#0B1220',

  azulProfundo: '#060F22',
  azulMedio: '#16233B',
  naranjaOscuro: '#E25C00',
  naranjaSuave: '#3A2A1E',
  doradoOscuro: '#B8941F',
  doradoSuave: '#2E2913',
  verdeOscuro: '#34D399',
  verdeSuave: '#12302A',
  rojoSuave: '#3A1E22',
  azulInfo: '#60A5FA',
  azulInfoSuave: '#15233B',
  textoSuave: '#6B7686',
  borde: '#2A3550',
  bordeFuerte: '#3A4761',
};

/* Escala de espaciado y radios. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/* Sombra reutilizable según nivel de elevación. */
export const sombra = (nivel = 1) => ({
  shadowColor: '#0A192F',
  shadowOpacity: 0.06 + nivel * 0.03,
  shadowRadius: 4 + nivel * 3,
  shadowOffset: { width: 0, height: 1 + nivel },
  elevation: nivel + 1,
});

// Export por defecto = paleta clara (para usos estáticos / fallback).
export default lightColors;
