import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { Boton, Tarjeta, SelectorMedios } from '../components/ui';
import { PagoAPI, PujaAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Resumen de compra / liquidación del ganador, con elección del medio de pago. */
export default function SubastaGanadaScreen({ route, navigation }) {
  const { factura, pieza, moneda = 'ARS' } = route.params;
  const simbolo = moneda === 'USD' ? 'US$' : '$';
  const total = Number(factura.total_a_pagar) || 0;

  const [medios, setMedios] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const todos = await PagoAPI.listar();
        // Verificados en la moneda de la subasta (no es bimonetario).
        const validos = todos.filter((m) => m.estado_verificacion === 'Verificado' && m.moneda === moneda);
        setMedios(validos);
        const conFondos = validos.find((m) => Number(m.saldo_disponible) >= total);
        setElegido((conFondos || validos[0])?.id ?? null);
      } catch (e) { /* silencioso */ }
    })();
  }, [moneda, total]);

  const medioElegido = medios.find((m) => m.id === elegido);

  async function pagar() {
    if (!pieza?.id_pieza) {
      Alert.alert('No se puede pagar', 'No pudimos identificar la pieza. Volvé a entrar desde "Mis Pujas".');
      return;
    }
    if (!medioElegido) {
      Alert.alert('Sin medio de pago', `Necesitás un medio verificado en ${moneda} en tu Billetera.`);
      return;
    }
    setPagando(true);
    try {
      const { status, data } = await PujaAPI.pagar(pieza.id_pieza, medioElegido.id);
      if (status === 402) {
        Alert.alert('Fondos insuficientes', data.mensaje, [
          { text: 'Ver multa', onPress: () => navigation.navigate('AvisoMulta', { multa: { monto_multa: data.monto_multa, horas_restantes: data.horas_restantes } }) },
        ]);
      } else {
        const saldo = data.saldo_restante != null
          ? `\nSaldo restante en ${data.medio || 'tu medio'}: ${simbolo}${Number(data.saldo_restante).toLocaleString()}`
          : '';
        Alert.alert('¡Pago exitoso!', `Total abonado: ${simbolo}${Number(data.total_pagado).toLocaleString()}${saldo}`, [
          { text: 'OK', onPress: () => navigation.navigate('Main') },
        ]);
      }
    } catch (e) {
      Alert.alert('No se pudo pagar', e.message);
    } finally {
      setPagando(false);
    }
  }

  const Row = ({ label, val }) => (
    <View style={styles.row}>
      <Text style={styles.lbl}>{label}</Text>
      <Text style={styles.val}>{simbolo}{Number(val).toLocaleString()}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}><Text style={styles.headerTxt}>¡Subasta Ganada!</Text></View>
      <Tarjeta style={{ margin: 16 }}>
        <Text style={styles.titulo}>Resumen de compra — {pieza?.titulo}</Text>
        <Row label="Monto ofertado:" val={factura.monto_pujado} />
        <Row label="Comisiones (10%):" val={factura.comision_10_porciento} />
        <Row label="Envío a domicilio:" val={factura.costo_envio} />
        <View style={styles.divisor} />
        <View style={styles.row}>
          <Text style={styles.total}>TOTAL A PAGAR:</Text>
          <Text style={styles.totalVal}>{simbolo}{Number(total).toLocaleString()}</Text>
        </View>
      </Tarjeta>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.selLbl}>Elegí el medio de pago ({moneda})</Text>
        <SelectorMedios medios={medios} elegido={elegido} onElegir={setElegido}
          montoMinimo={total} simbolo={simbolo} />
        <Boton title="PAGAR CON MEDIO SELECCIONADO" variant="dark" onPress={pagar} loading={pagando} />
        <Text style={styles.nota}>
          Si el medio no tiene fondos suficientes se aplicará una multa del 10% (consigna).
          Podés retirar personalmente para ahorrar envío (perdés la cobertura del seguro).
        </Text>
      </View>
    </ScrollView>
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
  selLbl: { color: colors.azulMarino, fontWeight: '700', marginBottom: 8 },
  nota: { color: colors.grisTexto, fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 17 },
});
