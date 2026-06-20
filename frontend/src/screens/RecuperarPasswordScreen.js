import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Boton, Campo } from '../components/ui';
import { AuthAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Pantalla de la corrección de diseño: recuperación de contraseña. */
export default function RecuperarPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar() {
    if (!email) {
      Alert.alert('Email requerido', 'Ingresá tu email registrado.');
      return;
    }
    setCargando(true);
    try {
      const { mensaje } = await AuthAPI.recuperarPassword(email.trim());
      Alert.alert('Listo', mensaje, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.texto}>
        Ingresá el email con el que te registraste y te enviaremos las instrucciones
        para restablecer tu clave personal.
      </Text>
      <Campo label="Email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} placeholder="tu@email.com" />
      <Boton title="ENVIAR INSTRUCCIONES" onPress={enviar} loading={cargando} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla, padding: 22, justifyContent: 'center' },
  texto: { color: colors.grisTexto, marginBottom: 20, lineHeight: 20 },
});
