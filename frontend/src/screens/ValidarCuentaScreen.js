import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Boton, Campo, Tarjeta } from '../components/ui';
import { AuthAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Permite retomar la validación de una cuenta ya registrada (etapa 1) cuando el
   usuario cerró sesión: ingresa su email y vuelve a la pantalla para generar la
   clave. Resuelve el caso "salí y no puedo volver a validar". */
export default function ValidarCuentaScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);

  async function continuar() {
    const correo = email.trim();
    if (!correo) { Alert.alert('Falta el email', 'Ingresá el email con el que te registraste.'); return; }
    setCargando(true);
    try {
      const r = await AuthAPI.reanudarRegistro(correo);
      if (r.ya_activada) {
        Alert.alert('Cuenta ya activada', 'Esta cuenta ya está activa. Iniciá sesión con tu email y clave.', [
          { text: 'Ir a iniciar sesión', onPress: () => navigation.replace('Login') },
        ]);
        return;
      }
      if (r.estado === 'rechazada') {
        Alert.alert('Solicitud rechazada', 'Tu solicitud fue rechazada por la verificación.');
        return;
      }
      // Pendiente o aprobada: vamos a la pantalla de validación con la solicitud.
      navigation.navigate('CompletarRegistro', { id_solicitud: r.id_solicitud, email: correo });
    } catch (e) {
      Alert.alert('No pudimos continuar', e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Tarjeta>
        <Text style={styles.titulo}>Validá tu cuenta</Text>
        <Text style={styles.sub}>
          ¿Ya te registraste pero todavía no generaste tu clave? Ingresá tu email y
          retomamos donde quedaste.
        </Text>
        <Campo label="Email registrado" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholder="tu@email.com" />
        <Boton title="CONTINUAR" size="lg" onPress={continuar} loading={cargando} />
        <Boton title="Volver" variant="ghost" onPress={() => navigation.goBack()} />
      </Tarjeta>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla, justifyContent: 'center', padding: 22 },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.azulMarino, marginBottom: 6 },
  sub: { color: colors.grisTexto, fontSize: 13, lineHeight: 19, marginBottom: 16 },
});
