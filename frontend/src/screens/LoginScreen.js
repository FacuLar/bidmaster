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
        <Text style={styles.martillo}>🔨</Text>
        <Text style={styles.logo}>BIDMASTER</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.titulo}>Iniciar Sesión</Text>
        <Campo label="Email" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholder="tu@email.com" />
        <Campo label="Contraseña" secureTextEntry value={password}
          onChangeText={setPassword} placeholder="••••••" />

        <Boton title="INGRESAR" onPress={ingresar} loading={cargando} />

        {/* CORRECCIÓN DE DISEÑO: "¿Se me olvidó la contraseña?" */}
        <TouchableOpacity onPress={() => navigation.navigate('RecuperarPassword')}>
          <Text style={styles.olvido}>¿Se me olvidó la contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Registro')}>
          <Text style={styles.registro}>Registrarse</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.azulMarino, justifyContent: 'center', padding: 22 },
  header: { alignItems: 'center', marginBottom: 24 },
  martillo: { fontSize: 60, color: colors.dorado },
  logo: { color: colors.blanco, fontSize: 24, fontWeight: '800', letterSpacing: 2 },
  card: { backgroundColor: colors.blanco, borderRadius: 16, padding: 22 },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.dorado, textAlign: 'center', marginBottom: 18 },
  olvido: { color: colors.naranja, textAlign: 'center', marginTop: 14, fontWeight: '600' },
  registro: { color: colors.azulMarino, textAlign: 'center', marginTop: 16, fontWeight: '700' },
});
