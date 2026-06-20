/**
 * Paleta de colores — concepto "Trust & Action" (Primera Entrega).
 * Trazabilidad directa con la justificación psicológica del diseño.
 *
 * Se mantienen los tokens originales y se agregan variantes (pressed, tints,
 * superficies) para lograr una UI más profesional y consistente.
 */
export const colors = {
  // --- Marca / base (originales) ---
  azulMarino: '#0A192F',   // confianza / estabilidad (navbars, headers, fondos)
  naranja: '#FF6B00',      // acción / urgencia (botones críticos: Pujar, Confirmar)
  dorado: '#D4AF37',       // exclusividad / estatus (insignias, alto valor)
  verde: '#10B981',        // éxito (oferta superada, subasta ganada)
  rojo: '#EF4444',         // alerta (multas, errores)
  blanco: '#FFFFFF',       // fondos / tarjetas
  grisPerla: '#F3F4F6',    // fondo general
  grisTexto: '#6B7280',    // texto secundario
  grisBorde: '#E5E7EB',
  azulClaro: '#172A46',    // tarjetas sobre fondo azul
  textoOscuro: '#111827',

  // --- Variantes nuevas (profundidad y estados) ---
  azulProfundo: '#060F22', // base para degradados / splash
  azulMedio: '#13294B',    // gradiente intermedio del header
  naranjaOscuro: '#E25C00', // estado "pressed" del botón de acción
  naranjaSuave: '#FFF1E8', // tint para fondos/realces naranjas
  doradoOscuro: '#B8941F',
  doradoSuave: '#FBF4DC',  // tint de insignias premium
  verdeOscuro: '#0E9E6E',
  verdeSuave: '#E7F8F1',
  rojoSuave: '#FDECEC',
  azulInfo: '#3B82F6',
  azulInfoSuave: '#EAF1FE',

  // --- Superficies y texto ---
  fondo: '#F1F4F8',        // fondo general (levemente más frío y moderno)
  superficie: '#FFFFFF',
  textoSuave: '#9CA3AF',   // placeholders / texto terciario
  borde: '#E5E7EB',
  bordeFuerte: '#CBD5E1',
};

/* Escala de espaciado y radios para mantener consistencia entre pantallas. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };

/* Sombra reutilizable (iOS + Android) según nivel de elevación. */
export const sombra = (nivel = 1) => ({
  shadowColor: '#0A192F',
  shadowOpacity: 0.06 + nivel * 0.03,
  shadowRadius: 4 + nivel * 3,
  shadowOffset: { width: 0, height: 1 + nivel },
  elevation: nivel + 1,
});

export default colors;
