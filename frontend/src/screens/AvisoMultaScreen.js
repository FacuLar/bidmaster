import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { Tarjeta, Boton, SelectorMedios } from '../components/ui';
import { PagoAPI, UsuarioAPI } from '../api/endpoints';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/* Aviso de multa por incumplimiento de pago (10% + 72hs) y pago de la misma. */
export default function AvisoMultaScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { multa } = route.params || {};
  const monto = Number(multa?.monto_multa) || 0;
  const [medios, setMedios] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [pagando, setPagando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const todos = await PagoAPI.listar();
        const validos = todos.filter((m) => m.estado_verificacion === 'Verificado');
        setMedios(validos);
        const conFondos = validos.find((m) => Number(m.saldo_disponible) >= monto);
        setElegido((conFondos || validos[0])?.id ?? null);
      } catch (e) { /* silencioso */ }
    })();
  }, [monto]);

  const medioElegido = medios.find((m) => m.id === elegido);
  const fondosOk = medioElegido && Number(medioElegido.saldo_disponible) >= monto;

  async function pagarMulta() {
    if (!medioElegido) {
      Alert.alert('Sin medio verificado', 'Agregá un medio de pago verificado en tu Billetera para pagar la multa.');
      return;
    }
    setPagando(true);
    try {
      const { status, data } = await UsuarioAPI.pagarMulta(elegido);
      if (status === 402) {
        Alert.alert('Fondos insuficientes', data.mensaje);
      } else {
        const saldo = data.saldo_restante != null
          ? `\nSaldo restante en ${data.medio || 'tu medio'}: $${Number(data.saldo_restante).toLocaleString()}`
          : '';
        Alert.alert('Multa pagada', `${data.mensaje}${saldo}`, [
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.header}><Text style={styles.headerTxt}>AVISO DE MULTA</Text></View>
      <Tarjeta style={{ borderColor: colors.rojo, borderWidth: 1.5, margin: 16, backgroundColor: colors.rojoSuave }}>
        <Text style={styles.t}>Incumplimiento de pago</Text>
        <Text style={styles.sub}>Se aplicó una multa del 10% del valor ofertado:</Text>
        <Text style={styles.monto}>${monto.toLocaleString()}</Text>
        <Text style={styles.sub}>Plazo restante: {multa?.horas_restantes ?? 72}hs.</Text>
      </Tarjeta>

      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.nota}>
          Tu cuenta está suspendida: no podés pujar, unirte a subastas ni pagar piezas
          hasta regularizar la multa.
        </Text>
        <Text style={styles.lbl}>Elegí con qué medio pagar la multa</Text>
        <SelectorMedios medios={medios} elegido={elegido} onElegir={setElegido} montoMinimo={monto} />
        <Boton title="PAGAR MULTA AHORA" onPress={pagarMulta} loading={pagando} disabled={!fondosOk} />
        {!fondosOk && medios.length > 0 && (
          <Text style={styles.aviso}>El medio elegido no tiene saldo para cubrir la multa.</Text>
        )}
        <Boton title="Más tarde" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  header: { backgroundColor: '#FEE2E2', padding: 18 },
  headerTxt: { color: colors.rojo, fontSize: 20, fontWeight: '800' },
  t: { fontWeight: '800', color: colors.textoOscuro, fontSize: 15 },
  sub: { color: colors.grisTexto, marginTop: 6 },
  monto: { color: colors.rojo, fontSize: 30, fontWeight: '900', marginVertical: 6 },
  nota: { color: colors.grisTexto, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  lbl: { color: colors.azulMarino, fontWeight: '700', marginBottom: 8 },
  aviso: { color: colors.rojo, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
