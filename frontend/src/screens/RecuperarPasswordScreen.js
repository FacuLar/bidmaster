import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Boton, Campo, Tarjeta } from '../components/ui';
import { AuthAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Recuperación de contraseña en 2 pasos: pedir el código y luego setear la clave.
   Sin servidor de mail, el código se muestra en la app (igual que en el registro). */
export default function RecuperarPasswordScreen({ navigation }) {
  const [paso, setPaso] = useState(1); // 1: email · 2: código + nueva clave
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoMail, setCodigoMail] = useState(null);
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  async function pedirCodigo() {
    if (!email) { Alert.alert('Email requerido', 'Ingresá tu email registrado.'); return; }
    setCargando(true);
    try {
      const r = await AuthAPI.recuperarPassword(email.trim());
      if (r.existe) {
        setCodigoMail(r.codigo_reset || null);
        if (r.codigo_reset) setCodigo(r.codigo_reset); // precargado (demo, sin mail real)
        setPaso(2);
      } else {
        // No se confirma si el email existe; igual que un mail real.
        Alert.alert('Revisá tu mail', r.mensaje, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCargando(false);
    }
  }

  async function resetear() {
    if (!codigo) { Alert.alert('Falta el código', 'Ingresá el código que te llegó.'); return; }
    if (password.length < 6) { Alert.alert('Clave débil', 'La clave debe tener al menos 6 caracteres.'); return; }
    setCargando(true);
    try {
      const r = await AuthAPI.resetearPassword(email.trim(), codigo, password);
      Alert.alert('Listo', r.mensaje, [{ text: 'Iniciar sesión', onPress: () => navigation.replace('Login') }]);
    } catch (e) {
      Alert.alert('No se pudo cambiar', e.message);
    } finally {
      setCargando(false);
    }
  }

  if (paso === 1) {
    return (
      <View style={styles.container}>
        <Text style={styles.texto}>
          Ingresá el email con el que te registraste y te enviaremos un código para
          crear una nueva clave personal.
        </Text>
        <Campo label="Email" autoCapitalize="none" keyboardType="email-address"
          value={email} onChangeText={setEmail} placeholder="tu@email.com" />
        <Boton title="ENVIAR CÓDIGO" onPress={pedirCodigo} loading={cargando} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Tarjeta style={{ borderColor: colors.verde, borderWidth: 1, marginBottom: 16 }}>
        <Text style={styles.mailTit}>✉️ Código de recuperación</Text>
        <Text style={styles.mailTxt}>Ingresá el código y elegí tu nueva clave personal.</Text>
        {codigoMail ? (
          <View style={styles.codigoBox}><Text style={styles.codigoVal}>{codigoMail}</Text></View>
        ) : null}
      </Tarjeta>
      <Campo label="Email" value={email} editable={false} />
      <Campo label="Código de recuperación" keyboardType="numeric"
        value={codigo} onChangeText={setCodigo} placeholder="6 dígitos" />
      <Campo label="Nueva clave personal" secureTextEntry
        value={password} onChangeText={setPassword} placeholder="••••••" />
      <Boton title="CAMBIAR CLAVE" onPress={resetear} loading={cargando} />
      <Boton title="Volver" variant="ghost" onPress={() => setPaso(1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla, padding: 22, justifyContent: 'center' },
  texto: { color: colors.grisTexto, marginBottom: 20, lineHeight: 20 },
  mailTit: { color: colors.verde, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  mailTxt: { color: colors.textoOscuro, fontSize: 13 },
  codigoBox: { backgroundColor: colors.verdeSuave, borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  codigoVal: { color: colors.verdeOscuro, fontSize: 22, fontWeight: '900', letterSpacing: 4 },
});
