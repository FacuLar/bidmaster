import React, { useState } from 'react';
import {
  TouchableOpacity, Text, TextInput, View, StyleSheet, ActivityIndicator,
} from 'react-native';
import colors, { radius, sombra } from '../theme/colors';

/* ============================================================================
 * Sistema de componentes de UI de BidMaster.
 * Todos son retrocompatibles: las props nuevas son opcionales.
 * ========================================================================== */

/* Botón de acción. Variantes: primary (naranja) | dark (navy) | secondary
   (claro) | outline (borde) | ghost (texto). Tamaños: sm | md | lg. */
export function Boton({
  title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, textStyle,
}) {
  const off = disabled || loading;
  const paletas = {
    primary: { bg: colors.naranja, fg: colors.blanco, bgOff: '#F5B98A' },
    dark: { bg: colors.azulMarino, fg: colors.blanco, bgOff: '#3E4A6B' },
    secondary: { bg: colors.grisPerla, fg: colors.azulMarino, bgOff: '#E5E7EB' },
    outline: { bg: 'transparent', fg: colors.azulMarino, bgOff: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.naranja, bgOff: 'transparent' },
  };
  const p = paletas[variant] || paletas.primary;
  const tamanios = {
    sm: { paddingVertical: 9, fontSize: 13 },
    md: { paddingVertical: 14, fontSize: 15 },
    lg: { paddingVertical: 16, fontSize: 16 },
  };
  const t = tamanios[size] || tamanios.md;
  const conSombra = (variant === 'primary' || variant === 'dark') && !off;

  return (
    <TouchableOpacity
      style={[
        styles.boton,
        { backgroundColor: off ? p.bgOff : p.bg, paddingVertical: t.paddingVertical },
        variant === 'outline' && { borderWidth: 1.5, borderColor: off ? colors.grisBorde : colors.azulMarino },
        conSombra && sombra(variant === 'primary' ? 3 : 2),
        style,
      ]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text style={[styles.botonTexto, { color: p.fg, fontSize: t.fontSize }, textStyle]}>
          {icon ? `${icon}  ` : ''}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/* Header oscuro reutilizable (navy) con título, subtítulo y campana de avisos.
   Lleva una línea de acento dorada inferior para dar prolijidad. */
export function Header({ titulo, subtitulo, onAvisos, conAviso }) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo}>{titulo}</Text>
          {subtitulo ? <Text style={styles.headerSub}>{subtitulo}</Text> : null}
        </View>
        {onAvisos ? (
          <TouchableOpacity onPress={onAvisos} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerCampana}>
            <Text style={styles.headerSobre}>✉️</Text>
            {conAviso ? <View style={styles.headerDot} /> : null}
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.headerAccent} />
    </View>
  );
}

/* Input con label, estado de foco, y soporte opcional de error/hint. */
export function Campo({ label, error, hint, style, onFocus, onBlur, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          focus && styles.inputFocus,
          !!error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textoSuave}
        onFocus={(e) => { setFocus(true); onFocus && onFocus(e); }}
        onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
        {...props}
      />
      {error ? <Text style={styles.errorTxt}>{error}</Text>
        : hint ? <Text style={styles.hintTxt}>{hint}</Text> : null}
    </View>
  );
}

/* Tarjeta blanca. Si recibe onPress, se comporta como tarjeta presionable. */
export function Tarjeta({ children, style, onPress }) {
  if (onPress) {
    return (
      <TouchableOpacity style={[styles.tarjeta, style]} onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.tarjeta, style]}>{children}</View>;
}

/* Banner de modo invitado: recordatorio de validar la cuenta para participar. */
export function BannerInvitado({ onValidar }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onValidar} activeOpacity={0.9}>
      <Text style={styles.bannerTxt}>🔒 Estás como invitado. Validá tu cuenta para participar.</Text>
      <Text style={styles.bannerCta}>VALIDAR ›</Text>
    </TouchableOpacity>
  );
}

/* Insignia de categoría / estado.
   variant: 'solid' (default, usa `color` de fondo) | 'soft' (tint suave) | 'outline'. */
export function Insignia({ texto, color = colors.dorado, variant = 'solid', dot }) {
  if (variant === 'soft' || variant === 'outline') {
    const esSoft = variant === 'soft';
    return (
      <View style={[
        styles.insignia,
        esSoft ? { backgroundColor: tint(color) } : { backgroundColor: 'transparent', borderWidth: 1, borderColor: color },
      ]}>
        {dot ? <View style={[styles.insigniaDot, { backgroundColor: color }]} /> : null}
        <Text style={[styles.insigniaTexto, { color }]}>{texto}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.insignia, { backgroundColor: color }]}>
      {dot ? <View style={[styles.insigniaDot, { backgroundColor: colors.blanco }]} /> : null}
      <Text style={[styles.insigniaTexto, { color: colors.blanco }]}>{texto}</Text>
    </View>
  );
}

/* Chip seleccionable (para selectores tipo "Tipo / Moneda / Tabs"). */
export function Chip({ label, activo, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, activo && styles.chipActivo]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, activo && styles.chipTxtActivo]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* Separador horizontal sutil. */
export function Divider({ style }) {
  return <View style={[styles.divider, style]} />;
}

/* Estado vacío (listas sin datos), con ícono opcional. */
export function EmptyState({ icon = '📭', titulo, texto }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      {titulo ? <Text style={styles.emptyTitulo}>{titulo}</Text> : null}
      {texto ? <Text style={styles.emptyTexto}>{texto}</Text> : null}
    </View>
  );
}

/* Mezcla un color con blanco para obtener un tint suave (aprox.). */
function tint(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return colors.grisPerla;
  const mix = (c) => Math.round(parseInt(c, 16) * 0.16 + 255 * 0.84);
  return `rgb(${mix(m[1])}, ${mix(m[2])}, ${mix(m[3])})`;
}

const styles = StyleSheet.create({
  boton: {
    borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginVertical: 6,
  },
  botonTexto: { fontWeight: '700', letterSpacing: 0.3 },

  headerWrap: { backgroundColor: colors.azulMarino },
  header: {
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  headerTitulo: { color: colors.blanco, fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  headerSub: { color: '#9FB3C8', fontSize: 12, marginTop: 3, fontWeight: '600' },
  headerCampana: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.azulClaro,
    alignItems: 'center', justifyContent: 'center',
  },
  headerSobre: { fontSize: 18 },
  headerDot: {
    position: 'absolute', top: 6, right: 8, width: 9, height: 9,
    borderRadius: 5, backgroundColor: colors.rojo, borderWidth: 1.5, borderColor: colors.azulMarino,
  },
  headerAccent: { height: 3, backgroundColor: colors.dorado, opacity: 0.9 },

  banner: {
    backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: colors.dorado,
    paddingVertical: 11, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  bannerTxt: { color: '#92400E', fontSize: 12.5, fontWeight: '600', flex: 1 },
  bannerCta: { color: colors.naranja, fontWeight: '800', fontSize: 12.5, marginLeft: 8 },

  label: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  input: {
    borderWidth: 1.5, borderColor: colors.grisBorde, borderRadius: radius.md,
    paddingHorizontal: 13, paddingVertical: 11, backgroundColor: colors.blanco,
    fontSize: 15, color: colors.textoOscuro,
  },
  inputFocus: { borderColor: colors.naranja, backgroundColor: '#FFFDFB' },
  inputError: { borderColor: colors.rojo, backgroundColor: colors.rojoSuave },
  errorTxt: { color: colors.rojo, fontSize: 11.5, marginTop: 5, fontWeight: '600' },
  hintTxt: { color: colors.grisTexto, fontSize: 11.5, marginTop: 5 },

  tarjeta: {
    backgroundColor: colors.blanco, borderRadius: radius.lg, padding: 16, marginVertical: 8,
    borderWidth: 1, borderColor: '#EEF1F5',
    ...sombra(2),
  },

  insignia: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm,
  },
  insigniaDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  insigniaTexto: { fontWeight: '700', fontSize: 11, letterSpacing: 0.2 },

  chip: {
    borderWidth: 1, borderColor: colors.grisBorde, borderRadius: radius.pill,
    paddingVertical: 7, paddingHorizontal: 15, marginRight: 8, backgroundColor: colors.blanco,
  },
  chipActivo: { backgroundColor: colors.azulMarino, borderColor: colors.azulMarino },
  chipTxt: { color: colors.grisTexto, fontWeight: '600', fontSize: 13 },
  chipTxtActivo: { color: colors.blanco },

  divider: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 12 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitulo: { color: colors.azulMarino, fontWeight: '800', fontSize: 16, marginBottom: 4 },
  emptyTexto: { color: colors.grisTexto, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
