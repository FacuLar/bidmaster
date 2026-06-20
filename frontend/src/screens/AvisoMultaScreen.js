import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tarjeta } from '../components/ui';
import colors from '../theme/colors';

/* Aviso de multa por incumplimiento de pago (10% + 72hs). */
export default function AvisoMultaScreen({ route }) {
  const { multa } = route.params || {};
  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTxt}>AVISO DE MULTA</Text></View>
      <Tarjeta style={{ borderColor: colors.rojo, borderWidth: 1, margin: 16 }}>
        <Text style={styles.t}>Incumplimiento de Pago</Text>
        <Text style={styles.sub}>Se ha aplicado una multa del 10%:</Text>
        <Text style={styles.monto}>${Number(multa?.monto_multa || 0).toLocaleString()}</Text>
        <Text style={styles.sub}>Plazo restante para pagar saldo: {multa?.horas_restantes ?? 72}hs.</Text>
      </Tarjeta>
      <Text style={styles.nota}>Tu cuenta ha sido suspendida para nuevas pujas hasta regularizar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  header: { backgroundColor: '#FEE2E2', padding: 18 },
  headerTxt: { color: colors.rojo, fontSize: 20, fontWeight: '800' },
  t: { fontWeight: '800', color: colors.textoOscuro },
  sub: { color: colors.grisTexto, marginTop: 6 },
  monto: { color: colors.rojo, fontSize: 30, fontWeight: '900', marginVertical: 6 },
  nota: { color: colors.grisTexto, fontSize: 12, paddingHorizontal: 18 },
});
