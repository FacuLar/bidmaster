import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Insignia, Boton, EmptyState } from '../components/ui';
import { UsuarioAPI } from '../api/endpoints';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;

/* Muestra las piezas ganadas y su estado de pago (pendiente / pagada). */
export default function MisPujasScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const [items, setItems] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const m = await UsuarioAPI.metricas();
      setItems(m.historial_pujas || []);
    } catch (e) { /* silencioso */ }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  function pagar(item) {
    navigation.navigate('SubastaGanada', {
      pieza: { id_pieza: item.id_pieza, titulo: item.titulo },
      moneda: item.moneda,
      factura: {
        monto_pujado: item.monto,
        comision_10_porciento: item.comision,
        costo_envio: item.costo_envio,
        total_a_pagar: item.total,
      },
    });
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(it, i) => String(it.id_pieza ?? i)}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={
          <EmptyState icon="📜" titulo="Sin pujas ganadas" texto="Cuando ganes una subasta, tus piezas aparecen acá para pagarlas." />
        }
        renderItem={({ item }) => {
          const pagada = item.estado_pago === 'pagada';
          return (
            <Tarjeta style={{ borderColor: pagada ? colors.verde : colors.naranja, borderWidth: 1 }}>
              <Insignia
                texto={pagada ? '✓ PAGADA' : 'PENDIENTE DE PAGO'}
                color={pagada ? colors.verde : colors.naranja}
                variant="soft"
              />
              <Text style={styles.t}>{item.titulo}</Text>
              <Text style={styles.v}>Ofertado: {fmt(item.monto)} · Total: {fmt(item.total)}</Text>
              {!pagada
                ? <Boton title="PAGAR" onPress={() => pagar(item)} />
                : <Text style={styles.ok}>Compra completada.</Text>}
            </Tarjeta>
          );
        }}
      />
    </View>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  t: { fontWeight: '700', color: colors.azulMarino, marginTop: 8 },
  v: { fontWeight: '600', color: colors.grisTexto, marginVertical: 4, fontSize: 13 },
  ok: { color: colors.verde, fontWeight: '700', marginTop: 8 },
});
