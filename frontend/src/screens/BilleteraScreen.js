import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Alert, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Campo, Insignia, Header, BannerInvitado } from '../components/ui';
import { PagoAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

export default function BilleteraScreen({ navigation }) {
  const { esInvitado } = useAuth();
  const [medios, setMedios] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'TARJETA', entidad: '', numero_identificador: '', monto_certificado: '', saldo_disponible: '', moneda: 'ARS' });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (esInvitado) return; // sin cuenta validada no hay medios de pago
    try { setMedios(await PagoAPI.listar()); }
    catch (e) { Alert.alert('Error', e.message); }
  }, [esInvitado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function guardar() {
    if (!form.entidad || !form.numero_identificador) {
      Alert.alert('Datos incompletos', 'Completá entidad e identificador.');
      return;
    }
    setGuardando(true);
    try {
      await PagoAPI.registrar({
        ...form,
        monto_certificado: form.tipo === 'CHEQUE' ? Number(form.monto_certificado) : 0,
        saldo_disponible: form.saldo_disponible ? Number(form.saldo_disponible) : undefined,
      });
      setModal(false);
      setForm({ tipo: 'TARJETA', entidad: '', numero_identificador: '', monto_certificado: '', saldo_disponible: '', moneda: 'ARS' });
      cargar();
      Alert.alert('Medio agregado', form.tipo === 'TARJETA'
        ? 'Tarjeta verificada correctamente.'
        : 'Medio de pago registrado.');
    } catch (e) {
      Alert.alert('No se pudo registrar', e.message);
    } finally {
      setGuardando(false);
    }
  }

  const Selector = ({ campo, valores }) => (
    <View style={styles.selector}>
      {valores.map((v) => (
        <TouchableOpacity key={v}
          style={[styles.chip, form[campo] === v && styles.chipActivo]}
          onPress={() => setForm((f) => ({ ...f, [campo]: v }))}>
          <Text style={[styles.chipTxt, form[campo] === v && styles.chipTxtActivo]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const render = ({ item }) => (
    <Tarjeta>
      <View style={styles.row}>
        <Text style={styles.medioTitulo}>
          {item.tipo === 'TARJETA' ? '💳' : item.tipo === 'CHEQUE' ? '🧾' : '🏦'} {item.tipo} · {item.entidad}
        </Text>
        <Insignia texto={item.estado_verificacion}
          color={item.estado_verificacion === 'Verificado' ? colors.verde : colors.naranja} />
      </View>
      <Text style={styles.medioNum}>{item.numero_identificador} ({item.moneda})</Text>
      <Text style={styles.saldo}>
        {item.tipo === 'CHEQUE' ? 'Saldo garantizado' : 'Saldo disponible'}: ${Number(item.saldo_disponible).toLocaleString()}
      </Text>
    </Tarjeta>
  );

  if (esInvitado) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header titulo="Mi Billetera" />
        <BannerInvitado onValidar={() => navigation.navigate('CompletarRegistro')} />
        <View style={[styles.container, { padding: 16 }]}>
          <Tarjeta>
            <Text style={{ color: colors.grisTexto }}>
              Validá tu cuenta para registrar medios de pago y poder pujar.
            </Text>
          </Tarjeta>
          <Boton title="VALIDAR MI CUENTA" onPress={() => navigation.navigate('CompletarRegistro')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
      <Header titulo="Mi Billetera" onAvisos={() => Alert.alert('Avisos', 'No tenés notificaciones nuevas.')} />
      <FlatList
        data={medios}
        keyExtractor={(it) => String(it.id)}
        renderItem={render}
        contentContainerStyle={{ padding: 14 }}
        ListFooterComponent={
          <>
            <Boton title="+ AGREGAR MEDIO DE PAGO" variant="dark" onPress={() => setModal(true)} />
            <Text style={styles.aviso}>
              Importante: si no posés fondos al ganar una subasta, se aplicará una multa del 10% sobre el valor ofertado.
            </Text>
          </>
        }
      />

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h2}>Nuevo medio de pago</Text>
            <Text style={styles.lbl}>Tipo</Text>
            <Selector campo="tipo" valores={['CUENTA', 'TARJETA', 'CHEQUE']} />
            <Text style={styles.lbl}>Moneda</Text>
            <Selector campo="moneda" valores={['ARS', 'USD']} />
            <Campo label="Entidad" value={form.entidad} onChangeText={(v) => setForm((f) => ({ ...f, entidad: v }))} />
            <Campo label={form.tipo === 'TARJETA' ? 'Número de tarjeta' : 'Número / Identificador'}
              keyboardType={form.tipo === 'TARJETA' ? 'numeric' : 'default'}
              value={form.numero_identificador}
              onChangeText={(v) => setForm((f) => ({ ...f, numero_identificador: v }))} />
            {form.tipo === 'TARJETA' && (
              <Text style={styles.hint}>Se verifica el número con la herramienta (Luhn). Ej. válido: 4539 1488 0343 6467</Text>
            )}
            {form.tipo === 'CHEQUE' && (
              <Campo label="Monto certificado" keyboardType="numeric" value={form.monto_certificado}
                onChangeText={(v) => setForm((f) => ({ ...f, monto_certificado: v }))} />
            )}
            {(form.tipo === 'TARJETA' || form.tipo === 'CUENTA') && (
              <Campo label="Saldo disponible (opcional)" keyboardType="numeric" value={form.saldo_disponible}
                onChangeText={(v) => setForm((f) => ({ ...f, saldo_disponible: v }))}
                placeholder="Fondos disponibles" />
            )}
            <Boton title="GUARDAR" onPress={guardar} loading={guardando} />
            <Boton title="Cancelar" variant="secondary" onPress={() => setModal(false)} />
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.azulMarino },
  container: { flex: 1, backgroundColor: colors.grisPerla },
  h1: { fontSize: 22, fontWeight: '800', color: colors.azulMarino, marginBottom: 8 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.azulMarino, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medioTitulo: { fontWeight: '700', color: colors.textoOscuro, flex: 1 },
  medioNum: { color: colors.grisTexto, marginTop: 4 },
  saldo: { color: colors.azulMarino, marginTop: 4, fontWeight: '600' },
  hint: { color: colors.grisTexto, fontSize: 11, marginBottom: 10, marginTop: -4 },
  aviso: { color: colors.grisTexto, fontSize: 12, marginTop: 12, lineHeight: 18 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  lbl: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6 },
  selector: { flexDirection: 'row', marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8 },
  chipActivo: { backgroundColor: colors.azulMarino, borderColor: colors.azulMarino },
  chipTxt: { color: colors.grisTexto, fontWeight: '600' },
  chipTxtActivo: { color: colors.blanco },
});
