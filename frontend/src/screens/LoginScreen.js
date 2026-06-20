import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Boton, Campo } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  async function ingresar() {
    if (!email || !password) {
      Alert.alert('Campos obligatorios', 'Ingresá email y contraseña.');
      return;
    }
    setCargando(true);
    try {
      await login(email.trim(), password);
      // La navegación al Home la dispara el cambio de estado de Auth.
    } catch (e) {
      Alert.alert('No se pudo iniciar sesión', e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.martillo}>🔨</Text>
        </View>
        <Text style={styles.logo}>BIDMASTER</Text>
        <Text style={styles.tagline}>Subastas premium, en vivo</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Iniciar sesión</Text>
        <Text style={styles.subtitulo}>Ingresá para participar de las subastas</Text>

        <Campo label="Email" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholder="tu@email.com" />
        <Campo label="Contraseña" secureTextEntry value={password}
          onChangeText={setPassword} placeholder="••••••" />

        <Boton title="INGRESAR" size="lg" onPress={ingresar} loading={cargando} />

        {/* CORRECCIÓN DE DISEÑO: "¿Se me olvidó la contraseña?" */}
        <TouchableOpacity onPress={() => navigation.navigate('RecuperarPassword')}>
          <Text style={styles.olvido}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        {/* Retomar la validación si ya te registraste y cerraste sesión. */}
        <TouchableOpacity onPress={() => navigation.navigate('ValidarCuenta')}>
          <Text style={styles.validar}>Ya me registré · Validar mi cuenta</Text>
        </TouchableOpacity>

        <View style={styles.sep}>
          <View style={styles.sepLinea} />
          <Text style={styles.sepTxt}>¿No tenés cuenta?</Text>
          <View style={styles.sepLinea} />
        </View>

        <Boton title="CREAR CUENTA" variant="outline" onPress={() => navigation.navigate('Registro')} />
      </View>

      <Text style={styles.pie}>BidMaster · TPO Desarrollo de Aplicaciones 1</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.azulMarino, justifyContent: 'center', padding: 22 },
  header: { alignItems: 'center', marginBottom: 26 },
  logoBadge: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: colors.azulClaro,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    borderWidth: 2, borderColor: colors.dorado,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  martillo: { fontSize: 46 },
  logo: { color: colors.blanco, fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  tagline: { color: colors.dorado, fontSize: 12.5, fontWeight: '600', marginTop: 5, letterSpacing: 0.5 },
  card: {
    backgroundColor: colors.blanco, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10,
  },
  titulo: { fontSize: 21, fontWeight: '800', color: colors.azulMarino, textAlign: 'center' },
  subtitulo: { fontSize: 13, color: colors.grisTexto, textAlign: 'center', marginTop: 4, marginBottom: 18 },
  olvido: { color: colors.naranja, textAlign: 'center', marginTop: 14, fontWeight: '600' },
  validar: { color: colors.azulMarino, textAlign: 'center', marginTop: 12, fontWeight: '700', fontSize: 13 },
  sep: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 6 },
  sepLinea: { flex: 1, height: 1, backgroundColor: colors.grisBorde },
  sepTxt: { color: colors.grisTexto, fontSize: 12, marginHorizontal: 10, fontWeight: '600' },
  pie: { color: '#5B7290', textAlign: 'center', fontSize: 11, marginTop: 22 },
});
