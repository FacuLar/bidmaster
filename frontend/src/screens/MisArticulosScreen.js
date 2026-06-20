import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Insignia, Boton } from '../components/ui';
import { VendedorAPI } from '../api/endpoints';
import colors from '../theme/colors';

const colorEstado = {
  'En revisión': colors.naranja,
  'A inspeccionar': colors.naranja,
  'En inspección': colors.naranja,
  Tasado: colors.dorado,
  Programado: colors.azulMarino,
  Vendido: colors.verde,
  Rechazado: colors.rojo,
  Devuelto: colors.rojo,
  Cancelado: colors.grisTexto,
};

/* Lista los artículos propuestos y permite avanzar el trámite según su estado. */
export default function MisArticulosScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const cargar = useCallback(async () => {
    try { setItems(await VendedorAPI.listar()); }
    catch (e) { Alert.alert('Error', e.message); }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  async function inspeccion(id, decision) {
    try {
      const r = await VendedorAPI.inspeccion(id, decision);
      Alert.alert('Listo', r.mensaje);
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function responder(id, decision) {
    try {
      const r = await VendedorAPI.condiciones(id, decision);
      Alert.alert('Listo', r.mensaje);
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function devolucion(id, metodo) {
    try {
      const r = await VendedorAPI.devolucion(id, metodo);
      Alert.alert('Listo', r.mensaje);
      cargar();
    } catch (e) { Alert.alert('Error', e.message); }
  }

  const render = ({ item }) => (
    <Tarjeta>
      <View style={styles.row}>
        <Text style={styles.t}>{item.titulo}</Text>
        <Insignia texto={item.estado} color={colorEstado[item.estado] || colors.grisTexto} />
      </View>

      {/* A inspeccionar: la empresa pide traer el bien; el usuario decide (#11). */}
      {item.estado === 'A inspeccionar' && (
        <>
          <Text style={styles.info}>Nos interesa tu bien. Llevalo al depósito para inspeccionarlo.</Text>
          <View style={styles.acciones}>
            <Boton title="ENVIAR A INSPECCIÓN" style={{ flex: 1, marginRight: 6 }}
              onPress={() => inspeccion(item.id_tramite, 'ENVIAR')} />
            <Boton title="CANCELAR" variant="secondary" style={{ flex: 1, marginLeft: 6 }}
              onPress={() => inspeccion(item.id_tramite, 'CANCELAR')} />
          </View>
        </>
      )}

      {/* Tasado: valor base + comisión + fecha; el usuario acepta o rechaza (#14). */}
      {item.estado === 'Tasado' && (
        <>
          <Text style={styles.v}>Valor base: ${Number(item.valor_base_sugerido).toLocaleString()}</Text>
          <Text style={styles.info}>Comisión: {item.comisiones}%   ·   Subasta: {String(item.fecha_subasta).slice(0, 10)}</Text>
          <View style={styles.acciones}>
            <Boton title="ACEPTAR" style={{ flex: 1, marginRight: 6 }}
              onPress={() => responder(item.id_tramite, 'ACEPTAR')} />
            <Boton title="RECHAZAR" variant="secondary" style={{ flex: 1, marginLeft: 6 }}
              onPress={() => responder(item.id_tramite, 'RECHAZAR')} />
          </View>
        </>
      )}

      {/* Vendido: el vendedor SOLO ve cuánto se vendió y la comisión (#19). */}
      {item.estado === 'Vendido' && (
        <>
          <Text style={styles.vendido}>Vendido por ${Number(item.monto_venta).toLocaleString()}</Text>
          <Text style={styles.info}>Comisión de la empresa: ${Number(item.comision_cobrada).toLocaleString()} ({item.comisiones}%)</Text>
        </>
      )}

      {/* Rechazado/Devuelto: el usuario elige retirarlo (#12) o que se lo
          devuelvan con cargo de flete (#13). */}
      {(item.estado === 'Rechazado' || item.estado === 'Devuelto') && (
        <>
          {item.motivo_rechazo ? <Text style={styles.info}>Motivo: {item.motivo_rechazo}</Text> : null}
          {!item.metodo_devolucion && (
            <>
              <Text style={styles.info}>¿Cómo querés recuperar el bien?</Text>
              <View style={styles.acciones}>
                <Boton title="LO RETIRO YO" style={{ flex: 1, marginRight: 6 }}
                  onPress={() => devolucion(item.id_tramite, 'RETIRO')} />
                <Boton title="ENVIAR (con cargo)" variant="secondary" style={{ flex: 1, marginLeft: 6 }}
                  onPress={() => devolucion(item.id_tramite, 'ENVIO')} />
              </View>
            </>
          )}
          {item.metodo_devolucion === 'retiro' && (
            <Text style={styles.info}>Retiralo sin cargo en: {item.ubicacion_deposito}</Text>
          )}
          {item.metodo_devolucion === 'envio' && (
            <Boton title="VER FACTURA DE FLETE" variant="dark"
              onPress={() => navigation.navigate('FacturaFlete', { id: item.id_tramite })} />
          )}
        </>
      )}

      {(item.estado === 'Tasado' || item.estado === 'Programado') && (
        <Boton title="VER UBICACIÓN Y SEGURO" variant="dark"
          onPress={() => navigation.navigate('UbicacionSeguro', { id: item.id_tramite })} />
      )}
    </Tarjeta>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id_tramite)}
        renderItem={render}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={<Text style={styles.vacio}>No propusiste artículos todavía.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  t: { fontWeight: '800', color: colors.azulMarino, flex: 1, marginRight: 8 },
  v: { color: colors.textoOscuro, marginTop: 6, fontWeight: '700' },
  vendido: { color: colors.verde, marginTop: 6, fontWeight: '800', fontSize: 16 },
  info: { color: colors.grisTexto, marginTop: 4, fontSize: 13 },
  acciones: { flexDirection: 'row', marginTop: 8 },
  vacio: { textAlign: 'center', color: colors.grisTexto, marginTop: 40 },
});
