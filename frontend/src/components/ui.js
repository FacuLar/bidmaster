import React from 'react';
import {
  TouchableOpacity, Text, TextInput, View, StyleSheet, ActivityIndicator,
} from 'react-native';
import colors from '../theme/colors';

/* Botón de acción principal (naranja) o secundario. */
export function Boton({ title, onPress, variant = 'primary', loading, disabled, style }) {
  const bg = variant === 'primary' ? colors.naranja
    : variant === 'dark' ? colors.azulMarino
    : colors.grisPerla;
  const fg = variant === 'secondary' ? colors.azulMarino : colors.blanco;
  const off = disabled || loading;
  // Botón deshabilitado: navy desaturado (igual que el wireframe).
  const bgOff = variant === 'secondary' ? '#D1D5DB' : '#3E4A6B';
  return (
    <TouchableOpacity
      style={[styles.boton, { backgroundColor: off ? bgOff : bg }, style]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : <Text style={[styles.botonTexto, { color: off && variant === 'secondary' ? colors.grisTexto : fg }]}>{title}</Text>}
    </TouchableOpacity>
  );
}

/* Header oscuro reutilizable (navy) con título, subtítulo y campana de avisos.
   Replica la barra superior de los wireframes (Mi Billetera, Mi Perfil, etc.). */
export function Header({ titulo, subtitulo, onAvisos, conAviso }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitulo}>{titulo}</Text>
        {subtitulo ? <Text style={styles.headerSub}>{subtitulo}</Text> : null}
      </View>
      <TouchableOpacity onPress={onAvisos} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.headerSobre}>✉️</Text>
        {conAviso ? <View style={styles.headerDot} /> : null}
      </TouchableOpacity>
    </View>
  );
}

/* Input con label. */
export function Campo({ label, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
    </View>
  );
}

/* Tarjeta blanca. */
export function Tarjeta({ children, style }) {
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

/* Insignia de categoría / estado. */
export function Insignia({ texto, color = colors.dorado }) {
  return (
    <View style={[styles.insignia, { backgroundColor: color }]}>
      <Text style={styles.insigniaTexto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boton: {
    paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6,
  },
  botonTexto: { fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  header: {
    backgroundColor: colors.azulMarino, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  headerTitulo: { color: colors.blanco, fontSize: 22, fontWeight: '800' },
  headerSub: { color: '#9FB3C8', fontSize: 12, marginTop: 2, fontWeight: '600' },
  headerSobre: { fontSize: 20 },
  headerDot: {
    position: 'absolute', top: -2, right: -2, width: 9, height: 9,
    borderRadius: 5, backgroundColor: colors.rojo,
  },
  banner: {
    backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: colors.dorado,
    paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  bannerTxt: { color: '#92400E', fontSize: 12.5, fontWeight: '600', flex: 1 },
  bannerCta: { color: colors.naranja, fontWeight: '800', fontSize: 12.5, marginLeft: 8 },
  label: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  input: {
    borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.blanco,
    fontSize: 15, color: colors.textoOscuro,
  },
  tarjeta: {
    backgroundColor: colors.blanco, borderRadius: 14, padding: 16, marginVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  insignia: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
  },
  insigniaTexto: { color: colors.blanco, fontWeight: '700', fontSize: 11 },
});
