import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Boton, Tarjeta } from '../components/ui';
import { PagoAPI, PujaAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Resumen de compra / liquidación del ganador. */
export default function SubastaGanadaScreen({ route, navigation }) {
  const { factura, pieza } = route.params;
  const [pagando, setPagando] = useState(false);

  async function pagar() {
    if (!pieza?.id_pieza) {
      Alert.alert('No se puede pagar', 'No pudimos identificar la pieza. Volvé a entrar desde "Mis Pujas".');
      return;
    }
    setPagando(true);
    try {
      // Elige un medio de pago verificado EN LA MONEDA correcta para liquidar.
      const medios = await PagoAPI.listar();
      const verificados = medios.filter((m) => m.estado_verificacion === 'Verificado');
      if (!verificados.length) {
        Alert.alert('Sin medio verificado', 'Agregá un medio de pago verificado en tu Billetera.');
        return;
      }
      // Prioriza un medio con saldo suficiente; si no, usa el de mayor saldo.
      const total = Number(factura.total_a_pagar) || 0;
      const medio = verificados.find((m) => Number(m.saldo_disponible) >= total)
        || verificados.sort((a, b) => b.saldo_disponible - a.saldo_disponible)[0];

      const { status, data } = await PujaAPI.pagar(pieza.id_pieza, medio.id);
      if (status === 402) {
        // Fondos insuficientes → multa del 10% (consigna).
        Alert.alert('Fondos insuficientes', data.mensaje, [
          { text: 'Ver multa', onPress: () => navigation.navigate('AvisoMulta', { multa: { monto_multa: data.monto_multa, horas_restantes: data.horas_restantes } }) },
        ]);
      } else {
        Alert.alert('¡Pago exitoso!', `Total abonado: $${Number(data.total_pagado).toLocaleString()}`, [
          { text: 'OK', onPress: () => navigation.navigate('Main') },
        ]);
      }
    } catch (e) {
      // 403 si hay multa pendiente u otro bloqueo del backend.
      Alert.alert('No se pudo pagar', e.message);
    } finally {
      setPagando(false);
    }
  }

  const Row = ({ label, val }) => (
    <View style={styles.row}>
      <Text style={styles.lbl}>{label}</Text>
      <Text style={styles.val}>${Number(val).toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTxt}>¡Subasta Ganada!</Text></View>
      <Tarjeta>
        <Text style={styles.titulo}>Resumen de Compra — {pieza?.titulo}</Text>
        <Row label="Monto ofertado:" val={factura.monto_pujado} />
        <Row label="Comisiones (10%):" val={factura.comision_10_porciento} />
        <Row label="Envío a domicilio:" val={factura.costo_envio} />
        <View style={styles.divisor} />
        <View style={styles.row}>
          <Text style={styles.total}>TOTAL A PAGAR:</Text>
          <Text style={styles.totalVal}>${Number(factura.total_a_pagar).toLocaleString()}</Text>
        </View>
        <Boton title="PAGAR CON MEDIO REGISTRADO" variant="dark" onPress={pagar} loading={pagando} />
        <Text style={styles.nota}>Podés retirar personalmente para ahorrar envío (perdés la cobertura del seguro).</Text>
      </Tarjeta>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  header: { backgroundColor: colors.verde, padding: 18 },
  headerTxt: { color: colors.blanco, fontSize: 20, fontWeight: '800' },
  titulo: { fontWeight: '800', color: colors.azulMarino, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  lbl: { color: colors.grisTexto },
  val: { fontWeight: '600', color: colors.textoOscuro },
  divisor: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 8 },
  total: { fontWeight: '800', color: colors.azulMarino, fontSize: 16 },
  totalVal: { fontWeight: '900', color: colors.naranja, fontSize: 16 },
  nota: { color: colors.grisTexto, fontSize: 12, marginTop: 10, textAlign: 'center' },
});
