import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Modal, Alert, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Campo, Insignia, Header, BannerInvitado } from '../components/ui';
import { PagoAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

// Formatea el número de tarjeta en grupos de 4 dígitos (máx 19 dígitos).
const formatTarjeta = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
// Formatea el vencimiento como MM/AA y no deja meses > 12.
const formatVenc = (v) => {
  let d = v.replace(/\D/g, '').slice(0, 4);
  if (d.length >= 1 && Number(d[0]) > 1) d = `0${d}`.slice(0, 4); // 3 -> 03
  if (d.length >= 2) {
    let mes = Math.min(12, Math.max(1, Number(d.slice(0, 2)) || 1));
    d = String(mes).padStart(2, '0') + d.slice(2);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }
  return d;
};

// Estado inicial del formulario (incluye los campos de tarjeta y cheque).
const FORM_VACIO = {
  tipo: 'TARJETA', entidad: '', moneda: 'ARS',
  // Tarjeta
  numero_identificador: '', titular: '', vencimiento: '', cvv: '',
  // Cheque
  numero_cheque: '', banco: '', cbu: '', monto_certificado: '',
  // Cuenta / opcional
  saldo_disponible: '',
};

export default function BilleteraScreen({ navigation }) {
  const { esInvitado } = useAuth();
  const [medios, setMedios] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (esInvitado) return; // sin cuenta validada no hay medios de pago
    try { setMedios(await PagoAPI.listar()); }
    catch (e) { Alert.alert('Error', e.message); }
  }, [esInvitado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  // Validación de forma en el cliente (el backend vuelve a validar igual).
  function faltantes() {
    if (!form.entidad) return 'Completá la entidad emisora.';
    if (form.tipo === 'TARJETA') {
      if (!form.numero_identificador) return 'Ingresá el número de tarjeta.';
      if (!form.titular) return 'Ingresá el nombre del titular.';
      if (!/^\d{2}\s*\/\s*\d{2,4}$/.test(form.vencimiento)) return 'El vencimiento debe ser MM/AA (ej: 08/27).';
      if (!/^\d{3,4}$/.test(form.cvv)) return 'El código de seguridad (CVV) debe tener 3 o 4 dígitos.';
    } else if (form.tipo === 'CHEQUE') {
      if (!form.numero_cheque) return 'Ingresá el número de cheque.';
      if (!form.banco) return 'Indicá el banco emisor.';
      if (!form.monto_certificado || Number(form.monto_certificado) <= 0) return 'Ingresá el monto certificado.';
    } else if (!form.numero_identificador) {
      return 'Ingresá el identificador de la cuenta (CBU/alias).';
    }
    return null;
  }

  async function guardar() {
    const err = faltantes();
    if (err) { Alert.alert('Datos incompletos', err); return; }
    setGuardando(true);
    try {
      // Se envía sólo lo que corresponde a cada tipo.
      const payload = { tipo: form.tipo, entidad: form.entidad, moneda: form.moneda };
      if (form.tipo === 'TARJETA') {
        Object.assign(payload, {
          numero_identificador: form.numero_identificador,
          titular: form.titular,
          vencimiento: form.vencimiento,
          cvv: form.cvv,
          saldo_disponible: form.saldo_disponible ? Number(form.saldo_disponible) : undefined,
        });
      } else if (form.tipo === 'CHEQUE') {
        Object.assign(payload, {
          numero_cheque: form.numero_cheque,
          banco: form.banco,
          cbu: form.cbu || undefined,
          monto_certificado: Number(form.monto_certificado),
        });
      } else {
        Object.assign(payload, {
          numero_identificador: form.numero_identificador,
          saldo_disponible: form.saldo_disponible ? Number(form.saldo_disponible) : undefined,
        });
      }
      await PagoAPI.registrar(payload);
      setModal(false);
      setForm(FORM_VACIO);
      cargar();
      Alert.alert('Medio registrado',
        'Quedó en verificación. Vas a poder usarlo para pujar una vez que sea aprobado.');
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

  function eliminar(item) {
    Alert.alert('Eliminar medio de pago', `¿Borrar ${item.tipo} · ${item.entidad}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try { await PagoAPI.eliminar(item.id); cargar(); }
          catch (e) { Alert.alert('No se pudo eliminar', e.message); }
        },
      },
    ]);
  }

  const render = ({ item }) => (
    <Tarjeta>
      <View style={styles.row}>
        <Text style={styles.medioTitulo}>
          {item.tipo === 'TARJETA' ? '💳' : item.tipo === 'CHEQUE' ? '🧾' : '🏦'} {item.tipo} · {item.entidad}
        </Text>
        <Insignia texto={item.estado_verificacion}
          color={item.estado_verificacion === 'Verificado' ? colors.verde : colors.naranja} />
      </View>
      <Text style={styles.medioNum}>
        {item.marca ? `${item.marca} · ` : ''}{item.numero_identificador} ({item.moneda})
        {item.vencimiento ? ` · vence ${item.vencimiento}` : ''}
      </Text>
      <Text style={styles.saldo}>
        {item.tipo === 'CHEQUE' ? 'Saldo garantizado' : 'Saldo disponible'}: ${Number(item.saldo_disponible).toLocaleString()}
      </Text>
      <TouchableOpacity style={styles.borrar} onPress={() => eliminar(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.borrarTxt}>🗑 Eliminar</Text>
      </TouchableOpacity>
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
            <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.h2}>Nuevo medio de pago</Text>
            <Text style={styles.lbl}>Tipo</Text>
            <Selector campo="tipo" valores={['CUENTA', 'TARJETA', 'CHEQUE']} />
            <Text style={styles.lbl}>Moneda</Text>
            <Selector campo="moneda" valores={['ARS', 'USD']} />
            <Campo label="Entidad" value={form.entidad}
              placeholder={form.tipo === 'TARJETA' ? 'Visa, Mastercard, Amex…' : form.tipo === 'CHEQUE' ? 'Banco emisor' : 'Banco / billetera'}
              onChangeText={(v) => setForm((f) => ({ ...f, entidad: v }))} />

            {form.tipo === 'TARJETA' && (
              <>
                <Campo label="Número de tarjeta" keyboardType="numeric" value={form.numero_identificador}
                  placeholder="0000 0000 0000 0000" maxLength={23}
                  onChangeText={(v) => setForm((f) => ({ ...f, numero_identificador: formatTarjeta(v) }))} />
                <Campo label="Titular" value={form.titular}
                  placeholder="Como figura en la tarjeta"
                  onChangeText={(v) => setForm((f) => ({ ...f, titular: v }))} />
                <View style={styles.fila}>
                  <View style={styles.col}>
                    <Campo label="Vencimiento" value={form.vencimiento} placeholder="MM/AA"
                      keyboardType="numeric" maxLength={5}
                      onChangeText={(v) => setForm((f) => ({ ...f, vencimiento: formatVenc(v) }))} />
                  </View>
                  <View style={styles.col}>
                    <Campo label="CVV" keyboardType="numeric" secureTextEntry value={form.cvv}
                      placeholder="123" maxLength={4}
                      onChangeText={(v) => setForm((f) => ({ ...f, cvv: v.replace(/\D/g, '') }))} />
                  </View>
                </View>
                <Text style={styles.hint}>Se valida marca, número (Luhn), CVV y vencimiento. La verificación final es manual.</Text>
              </>
            )}

            {form.tipo === 'CHEQUE' && (
              <>
                <Campo label="Número de cheque" keyboardType="numeric" value={form.numero_cheque}
                  placeholder="6 a 12 dígitos"
                  onChangeText={(v) => setForm((f) => ({ ...f, numero_cheque: v }))} />
                <Campo label="Banco emisor" value={form.banco}
                  onChangeText={(v) => setForm((f) => ({ ...f, banco: v }))} />
                <Campo label="CBU (opcional)" keyboardType="numeric" value={form.cbu} maxLength={22}
                  placeholder="22 dígitos"
                  onChangeText={(v) => setForm((f) => ({ ...f, cbu: v.replace(/\D/g, '') }))} />
                <Campo label="Monto certificado" keyboardType="numeric" value={form.monto_certificado}
                  onChangeText={(v) => setForm((f) => ({ ...f, monto_certificado: v }))} />
              </>
            )}

            {form.tipo === 'CUENTA' && (
              <Campo label="CBU / Alias" value={form.numero_identificador}
                placeholder="CBU o alias de la cuenta"
                onChangeText={(v) => setForm((f) => ({ ...f, numero_identificador: v }))} />
            )}

            {(form.tipo === 'TARJETA' || form.tipo === 'CUENTA') && (
              <Campo label="Saldo disponible (opcional)" keyboardType="numeric" value={form.saldo_disponible}
                onChangeText={(v) => setForm((f) => ({ ...f, saldo_disponible: v }))}
                placeholder="Fondos disponibles" />
            )}
            <Boton title="GUARDAR" onPress={guardar} loading={guardando} />
            <Boton title="Cancelar" variant="secondary" onPress={() => setModal(false)} />
            </ScrollView>
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
  borrar: { alignSelf: 'flex-start', marginTop: 10 },
  borrarTxt: { color: colors.rojo, fontWeight: '700', fontSize: 13 },
  hint: { color: colors.grisTexto, fontSize: 11, marginBottom: 10, marginTop: -4 },
  aviso: { color: colors.grisTexto, fontSize: 12, marginTop: 12, lineHeight: 18 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  fila: { flexDirection: 'row', marginHorizontal: -6 },
  col: { flex: 1, paddingHorizontal: 6 },
  lbl: { color: colors.azulMarino, fontWeight: '600', marginBottom: 6 },
  selector: { flexDirection: 'row', marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, marginRight: 8 },
  chipActivo: { backgroundColor: colors.azulMarino, borderColor: colors.azulMarino },
  chipTxt: { color: colors.grisTexto, fontWeight: '600' },
  chipTxtActivo: { color: colors.blanco },
});
