import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Tarjeta, Boton } from '../components/ui';
import { PagoAPI, UsuarioAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Aviso de multa por incumplimiento de pago (10% + 72hs) y pago de la misma. */
export default function AvisoMultaScreen({ route, navigation }) {
  const { multa } = route.params || {};
  const [pagando, setPagando] = useState(false);

  async function pagarMulta() {
    setPagando(true);
    try {
      const medios = await PagoAPI.listar();
      const verificados = medios.filter((m) => m.estado_verificacion === 'Verificado');
      if (!verificados.length) {
        Alert.alert('Sin medio verificado', 'Agregá un medio de pago verificado en tu Billetera para pagar la multa.');
        return;
      }
      const monto = Number(multa?.monto_multa) || 0;
      const medio = verificados.find((m) => Number(m.saldo_disponible) >= monto)
        || verificados.sort((a, b) => b.saldo_disponible - a.saldo_disponible)[0];

      const { status, data } = await UsuarioAPI.pagarMulta(medio.id);
      if (status === 402) {
        Alert.alert('Fondos insuficientes', data.mensaje);
      } else {
        Alert.alert('Multa pagada', `${data.mensaje} Tu cuenta ya está activa.`, [
          { text: 'OK', onPress: () => navigation.navigate('Main') },
        ]);
      }
    } catch (e) {
      Alert.alert('No se pudo pagar la multa', e.message);
    } finally {
      setPagando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTxt}>AVISO DE MULTA</Text></View>
      <Tarjeta style={{ borderColor: colors.rojo, borderWidth: 1.5, margin: 16, backgroundColor: colors.rojoSuave }}>
        <Text style={styles.t}>Incumplimiento de pago</Text>
        <Text style={styles.sub}>Se aplicó una multa del 10% del valor ofertado:</Text>
        <Text style={styles.monto}>${Number(multa?.monto_multa || 0).toLocaleString()}</Text>
        <Text style={styles.sub}>Plazo restante: {multa?.horas_restantes ?? 72}hs.</Text>
      </Tarjeta>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.nota}>
          Tu cuenta está suspendida: no podés pujar, unirte a subastas ni pagar piezas
          hasta regularizar la multa.
        </Text>
        <Boton title="PAGAR MULTA AHORA" onPress={pagarMulta} loading={pagando} />
        <Boton title="Más tarde" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  header: { backgroundColor: '#FEE2E2', padding: 18 },
  headerTxt: { color: colors.rojo, fontSize: 20, fontWeight: '800' },
  t: { fontWeight: '800', color: colors.textoOscuro, fontSize: 15 },
  sub: { color: colors.grisTexto, marginTop: 6 },
  monto: { color: colors.rojo, fontSize: 30, fontWeight: '900', marginVertical: 6 },
  nota: { color: colors.grisTexto, fontSize: 13, lineHeight: 19, marginBottom: 12 },
});
