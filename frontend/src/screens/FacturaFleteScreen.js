import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Tarjeta } from '../components/ui';
import { VendedorAPI } from '../api/endpoints';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/* Factura del flete por devolución del bien con cargo al vendedor (#13). */
export default function FacturaFleteScreen({ route }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { id } = route.params;
  const [factura, setFactura] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    VendedorAPI.facturaFlete(id).then(setFactura).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <View style={styles.container}><Text style={styles.err}>{error}</Text></View>;
  if (!factura) return <View style={styles.container}><ActivityIndicator color={colors.naranja} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTxt}>FACTURA — DEVOLUCIÓN CON CARGO</Text></View>
      <Tarjeta style={{ margin: 16 }}>
        <Text style={styles.titulo}>{factura.titulo}</Text>
        <Text style={styles.concepto}>{factura.concepto}</Text>
        {factura.motivo ? <Text style={styles.motivo}>Motivo: {factura.motivo}</Text> : null}
        <View style={styles.divisor} />
        <View style={styles.row}>
          <Text style={styles.lbl}>Costo de flete</Text>
          <Text style={styles.val}>${Number(factura.costo_flete).toLocaleString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.total}>TOTAL A PAGAR</Text>
          <Text style={styles.totalVal}>${Number(factura.total).toLocaleString()}</Text>
        </View>
      </Tarjeta>
      <Text style={styles.nota}>El bien se devuelve a tu domicilio con cargo a tu cuenta.</Text>
    </View>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla, justifyContent: 'flex-start' },
  header: { backgroundColor: colors.rojo, padding: 18 },
  headerTxt: { color: colors.blanco, fontWeight: '800', fontSize: 16 },
  titulo: { fontWeight: '800', color: colors.azulMarino, fontSize: 16 },
  concepto: { color: colors.textoOscuro, marginTop: 6 },
  motivo: { color: colors.grisTexto, marginTop: 4, fontSize: 13 },
  divisor: { height: 1, backgroundColor: colors.grisBorde, marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  lbl: { color: colors.grisTexto },
  val: { fontWeight: '600', color: colors.textoOscuro },
  total: { fontWeight: '800', color: colors.azulMarino, fontSize: 16 },
  totalVal: { fontWeight: '900', color: colors.rojo, fontSize: 16 },
  nota: { color: colors.grisTexto, fontSize: 12, textAlign: 'center', paddingHorizontal: 18 },
});
