import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta } from '../components/ui';
import { VendedorAPI } from '../api/endpoints';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/* Depósito físico de la pieza + póliza de seguro contratada por la empresa. */
export default function UbicacionSeguroScreen({ route }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { id } = route.params;
  const [data, setData] = useState(null);

  const cargar = useCallback(async () => {
    try { setData(await VendedorAPI.logistica(id)); }
    catch (e) { Alert.alert('Error', e.message); }
  }, [id]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Tarjeta>
        <Text style={styles.h}>📍 Depósito Actual</Text>
        <Text style={styles.v}>{data?.ubicacion_deposito || '—'}</Text>
      </Tarjeta>

      <Tarjeta>
        <Text style={styles.h}>🛡️ Póliza de Seguro</Text>
        <Text style={styles.v}>Compañía: {data?.seguro?.compania || '—'}</Text>
        <Text style={styles.v}>Cobertura: ${Number(data?.seguro?.cobertura || 0).toLocaleString()} (Valor Base)</Text>
        <Text style={styles.link}>Podés contactar a la aseguradora para aumentar el valor de la póliza.</Text>
      </Tarjeta>
    </ScrollView>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  h: { fontWeight: '800', color: colors.azulMarino, marginBottom: 6 },
  v: { color: colors.textoOscuro, marginVertical: 2 },
  link: { color: colors.naranja, marginTop: 8, fontSize: 12 },
});
