import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, Alert, View, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Boton, Campo } from '../components/ui';
import { AuthAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

// Validación de formato (igual que el backend, para avisar antes de enviar).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esEmailValido = (email) => EMAIL_RE.test((email || '').trim());
// Domicilio legal: al menos calle + número (mínimo razonable).
const esDomicilioValido = (dir) => (dir || '').trim().length >= 5 && /\d/.test(dir || '');

/* Etapa 1 del registro. Incluye la CORRECCIÓN DE DISEÑO: campo "Mail". */
export default function RegistroScreen({ navigation }) {
  const { entrarComoInvitado } = useAuth();
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', domicilio_legal: '', pais_origen: '',
  });
  // Ahora guardan la imagen real del DNI (data URI base64), no un booleano.
  const [dniFrente, setDniFrente] = useState(null);
  const [dniDorso, setDniDorso] = useState(null);
  const [cargando, setCargando] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  /* Abre cámara o galería y devuelve la imagen elegida como data URI base64. */
  async function elegirImagen(setter) {
    Alert.alert('Foto del DNI', '¿De dónde querés tomar la imagen?', [
      { text: 'Cámara', onPress: () => abrir(setter, 'camara') },
      { text: 'Galería', onPress: () => abrir(setter, 'galeria') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function abrir(setter, origen) {
    try {
      const permiso = origen === 'camara'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso para adjuntar la foto del DNI.');
        return;
      }
      const opciones = {
        mediaTypes: ['images'], // API nueva de expo-image-picker (SDK 52+)
        quality: 0.6,
        base64: true,
        allowsEditing: true,
        aspect: [16, 10],
      };
      const res = origen === 'camara'
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync(opciones);
      if (res.canceled) return;
      const img = res.assets[0];
      setter(`data:image/jpeg;base64,${img.base64}`);
    } catch (e) {
      Alert.alert('No se pudo cargar la imagen', e.message);
    }
  }

  async function enviar() {
    const { nombre, apellido, email, domicilio_legal, pais_origen } = form;
    if (!nombre || !apellido || !email || !domicilio_legal || !pais_origen) {
      Alert.alert('Campos obligatorios', 'Completá todos los datos.');
      return;
    }
    if (!esEmailValido(email)) {
      Alert.alert('Mail inválido', 'Ingresá un email con formato válido (ej: nombre@dominio.com).');
      return;
    }
    if (!esDomicilioValido(domicilio_legal)) {
      Alert.alert('Domicilio inválido', 'Ingresá un domicilio legal válido (calle y número).');
      return;
    }
    if (!dniFrente || !dniDorso) {
      Alert.alert('Documentación', 'Adjuntá una foto del frente y del dorso del DNI.');
      return;
    }
    setCargando(true);
    try {
      const datos = {
        ...form,
        email: email.trim(),
        dni_frente: dniFrente, // imagen real (base64)
        dni_dorso: dniDorso,
      };
      const { id_solicitud } = await AuthAPI.registroEtapa1(datos);
      // Entra como INVITADO (registrado pero no validado): puede ver el catálogo
      // y las subastas, pero no pujar hasta validar la cuenta.
      Alert.alert(
        'Registro recibido',
        'Tu cuenta está en verificación. Mientras tanto entrás como invitado: podés mirar las subastas, pero para participar tenés que validar tu cuenta.',
        [{ text: 'Entrar como invitado', onPress: () => entrarComoInvitado({ id_solicitud, email: email.trim() }) }],
      );
    } catch (e) {
      Alert.alert('No se pudo registrar', e.message);
    } finally {
      setCargando(false);
    }
  }

  const DniBox = ({ label, uri, onPress }) => (
    <TouchableOpacity style={[styles.dni, uri && styles.dniOk]} onPress={onPress}>
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.preview} resizeMode="cover" />
          <Text style={styles.dniTextoOk}>✓ {label} · Tocá para cambiar</Text>
        </>
      ) : (
        <Text style={styles.dniTexto}>📷 {label}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 22 }}>
      <Campo label="Nombre" value={form.nombre} onChangeText={set('nombre')} />
      <Campo label="Apellido" value={form.apellido} onChangeText={set('apellido')} />
      {/* CORRECCIÓN DE DISEÑO: campo Mail agregado en "Creá tu cuenta". */}
      <Campo label="Mail" autoCapitalize="none" keyboardType="email-address"
        value={form.email} onChangeText={set('email')} placeholder="tu@email.com" />
      <Campo label="Domicilio legal" value={form.domicilio_legal} onChangeText={set('domicilio_legal')}
        placeholder="Av. Corrientes 1000, Buenos Aires" />
      <Text style={styles.hint}>Verificamos que la dirección exista de verdad (calle, número y ciudad).</Text>
      <Campo label="País de origen" value={form.pais_origen} onChangeText={set('pais_origen')}
        placeholder="Argentina" />

      <Text style={styles.label}>Foto del DNI</Text>
      <View style={styles.dniRow}>
        <DniBox label="DNI (Frente)" uri={dniFrente} onPress={() => elegirImagen(setDniFrente)} />
        <DniBox label="DNI (Dorso)" uri={dniDorso} onPress={() => elegirImagen(setDniDorso)} />
      </View>
      <Text style={styles.nota}>Tu categoría será asignada tras la verificación.</Text>

      <Boton title="ENVIAR DATOS PARA VERIFICACIÓN" onPress={enviar} loading={cargando} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  label: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6, fontSize: 13 },
  dniRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  dni: {
    flex: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.grisTexto,
    borderRadius: 10, padding: 12, marginHorizontal: 4, alignItems: 'center',
    backgroundColor: '#fff', minHeight: 96, justifyContent: 'center',
  },
  dniOk: { borderColor: colors.verde, borderStyle: 'solid', backgroundColor: '#ECFDF5' },
  dniTexto: { color: colors.grisTexto, fontWeight: '600' },
  dniTextoOk: { color: colors.verde, fontWeight: '600', fontSize: 11, marginTop: 6, textAlign: 'center' },
  preview: { width: '100%', height: 64, borderRadius: 6 },
  nota: { color: colors.grisTexto, fontSize: 12, textAlign: 'center', marginVertical: 12 },
  hint: { color: colors.grisTexto, fontSize: 11, marginTop: -8, marginBottom: 10 },
});
