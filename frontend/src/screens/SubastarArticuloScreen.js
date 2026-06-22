import React, { useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Boton, Campo, SelectorMedios } from '../components/ui';
import { VendedorAPI, PagoAPI } from '../api/endpoints';
import colors from '../theme/colors';

const TIPOS = [
  { k: 'otro', label: 'Otro' },
  { k: 'obra', label: 'Obra de arte' },
  { k: 'auto', label: 'Automóvil' },
];

/* Formulario para proponer un bien propio a remate (Módulo 5). */
export default function SubastarArticuloScreen({ navigation }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [historia, setHistoria] = useState('');
  const [tipo, setTipo] = useState('otro');
  const [fotos, setFotos] = useState([]);        // imágenes reales (base64), min 6
  const [qrTitulo, setQrTitulo] = useState(null); // QR del título (autos)
  const [compraventa, setCompraventa] = useState(null); // boleto de compraventa (opcional)
  const [checks, setChecks] = useState({ pertenece: false, origen: false, devolucion: false, terminos: false });
  const [enviando, setEnviando] = useState(false);
  const [cuentas, setCuentas] = useState([]);   // cuentas corrientes del vendedor
  const [cuentaSel, setCuentaSel] = useState(null);

  const toggle = (k) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  // Carga las cuentas corrientes para elegir cuál usar (cobros y cargo de flete).
  const cargarCuentas = useCallback(async () => {
    try {
      const medios = await PagoAPI.listar();
      const ctas = medios.filter((m) => m.tipo === 'CUENTA');
      setCuentas(ctas);
      setCuentaSel((s) => s ?? ctas[0]?.id ?? null);
    } catch (e) { /* silencioso */ }
  }, []);
  useFocusEffect(useCallback(() => { cargarCuentas(); }, [cargarCuentas]));

  async function agregarFoto() {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) { Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.5, base64: true, allowsMultipleSelection: true, selectionLimit: 10,
      });
      if (res.canceled) return;
      const nuevas = res.assets.map((a) => `data:image/jpeg;base64,${a.base64}`);
      setFotos((f) => [...f, ...nuevas]);
    } catch (e) { Alert.alert('No se pudo cargar', e.message); }
  }

  async function adjuntar(setter, label) {
    try {
      const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) { Alert.alert('Permiso requerido', `Necesitamos acceso para adjuntar ${label}.`); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled) return;
      setter(`data:image/jpeg;base64,${res.assets[0].base64}`);
    } catch (e) { Alert.alert('No se pudo cargar', e.message); }
  }

  async function enviar() {
    if (!titulo) { Alert.alert('Falta el título', 'Indicá el título del bien.'); return; }
    if (fotos.length < 6) { Alert.alert('Fotos insuficientes', `Subí al menos 6 fotos (tenés ${fotos.length}).`); return; }
    if (!checks.pertenece || !checks.devolucion) {
      Alert.alert('Declaraciones juradas', 'Debés aceptar las declaraciones obligatorias.'); return;
    }
    if (!checks.terminos) { Alert.alert('Términos y condiciones', 'Debés aceptar los términos y condiciones.'); return; }
    if (tipo === 'auto' && !qrTitulo) { Alert.alert('Auto', 'Para un automóvil adjuntá el QR del título.'); return; }
    if (!cuentaSel) {
      Alert.alert('Falta la cuenta', 'Elegí (o registrá en la Billetera) una cuenta corriente para cobros y cargos.'); return;
    }

    setEnviando(true);
    try {
      const articulo = {
        titulo, descripcion, historia, tipo_bien: tipo,
        fotos,
        qr_titulo: qrTitulo, compraventa,
        medio_pago_id: cuentaSel,
        acepta_devolucion: checks.devolucion,
        acepta_terminos: checks.terminos,
        declaracion_jurada_licita: checks.pertenece,
        acredita_origen: checks.origen,
      };
      const r = await VendedorAPI.proponer(articulo);
      Alert.alert(
        r.interesa ? 'Nos interesa tu bien' : 'Sin interés',
        r.mensaje,
        [{ text: 'Ver mis artículos', onPress: () => navigation.replace('MisArticulos') }],
      );
    } catch (e) {
      Alert.alert('No se pudo enviar', e.message);
    } finally {
      setEnviando(false);
    }
  }

  const Check = ({ k, label }) => (
    <TouchableOpacity style={styles.check} onPress={() => toggle(k)}>
      <View style={[styles.box, checks[k] && styles.boxOn]}>{checks[k] && <Text style={styles.tick}>✓</Text>}</View>
      <Text style={styles.checkTxt}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      <Campo label="Título del Bien" value={titulo} onChangeText={setTitulo} />

      <Text style={styles.lbl}>Tipo de bien</Text>
      <View style={styles.tipos}>
        {TIPOS.map((t) => (
          <TouchableOpacity key={t.k} style={[styles.tipo, tipo === t.k && styles.tipoOn]} onPress={() => setTipo(t.k)}>
            <Text style={[styles.tipoTxt, tipo === t.k && styles.tipoTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Campo label="Descripción / Valor histórico" value={descripcion} onChangeText={setDescripcion} multiline />
      <Campo label="Historia (contexto, dueños anteriores, curiosidades)" value={historia} onChangeText={setHistoria} multiline />

      <Text style={styles.lbl}>Fotos (Mínimo 6) — {fotos.length}/6</Text>
      <View style={styles.grid}>
        {fotos.map((uri, i) => <Image key={i} source={{ uri }} style={styles.thumb} />)}
      </View>
      <TouchableOpacity style={styles.upload} onPress={agregarFoto}>
        <Text style={styles.uploadTxt}>📷 + Agregar imágenes</Text>
      </TouchableOpacity>

      {/* Prueba de propiedad: la compraventa no siempre es obligatoria; para autos, QR del título. */}
      {tipo === 'auto' && (
        <TouchableOpacity style={[styles.upload, qrTitulo && styles.uploadOk]} onPress={() => adjuntar(setQrTitulo, 'el QR del título')}>
          <Text style={styles.uploadTxt}>{qrTitulo ? '✓ QR del título adjunto' : '🚗 Adjuntar QR del título (obligatorio)'}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.upload, compraventa && styles.uploadOk]} onPress={() => adjuntar(setCompraventa, 'la compraventa')}>
        <Text style={styles.uploadTxt}>{compraventa ? '✓ Compraventa / prueba adjunta' : '🧾 Adjuntar compraventa o foto de prueba (opcional)'}</Text>
      </TouchableOpacity>

      <Check k="pertenece" label="Declaro que el bien me pertenece (sin impedimentos legales)" />
      <Check k="origen" label="Puedo acreditar el origen lícito del bien si se requiere" />
      <Check k="devolucion" label="Acepto los cargos de devolución si es rechazado" />
      <Check k="terminos" label="Acepto los términos y condiciones" />

      <Text style={styles.lbl}>Cuenta corriente para cobros y cargos</Text>
      {cuentas.length === 0 ? (
        <Text style={styles.nota}>Necesitás una cuenta corriente registrada en tu Billetera para poder vender.</Text>
      ) : (
        <SelectorMedios medios={cuentas} elegido={cuentaSel} onElegir={setCuentaSel} />
      )}
      <Boton title="ENVIAR PARA EVALUACIÓN" onPress={enviar} loading={enviando} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  lbl: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6 },
  tipos: { flexDirection: 'row', marginBottom: 14 },
  tipo: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, marginRight: 8 },
  tipoOn: { backgroundColor: colors.azulMarino, borderColor: colors.azulMarino },
  tipoTxt: { color: colors.grisTexto, fontWeight: '600', fontSize: 13 },
  tipoTxtOn: { color: colors.blanco },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  thumb: { width: 56, height: 56, borderRadius: 8, margin: 3, backgroundColor: colors.grisBorde },
  upload: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.grisTexto, borderRadius: 10,
    padding: 18, alignItems: 'center', backgroundColor: '#fff', marginBottom: 12,
  },
  uploadOk: { borderColor: colors.verde, borderStyle: 'solid', backgroundColor: '#ECFDF5' },
  uploadTxt: { color: colors.grisTexto, fontWeight: '600' },
  check: { flexDirection: 'row', alignItems: 'center', marginVertical: 7 },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: colors.grisTexto, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.naranja, borderColor: colors.naranja },
  tick: { color: '#fff', fontWeight: '900' },
  checkTxt: { flex: 1, color: colors.textoOscuro },
  nota: { color: colors.grisTexto, fontSize: 12, marginVertical: 10, textAlign: 'center' },
});
