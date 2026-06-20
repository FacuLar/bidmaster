import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Insignia, Boton } from '../components/ui';
import { UsuarioAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Muestra el estado de las pujas/compras del usuario (pendientes de pago, etc.). */
export default function MisPujasScreen({ navigation }) {
  const [items, setItems] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const m = await UsuarioAPI.metricas();
      setItems(m.historial_pujas || []);
    } catch (e) { /* silencioso */ }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={<Text style={styles.vacio}>Todavía no tenés pujas registradas.</Text>}
        renderItem={({ item }) => (
          <Tarjeta style={{ borderColor: colors.verde, borderWidth: 1 }}>
            <Insignia texto={`ESTADO: ${item.resultado === 'Ganada' ? 'ACEPTADO' : item.resultado}`} color={colors.verde} />
            <Text style={styles.t}>{item.titulo}</Text>
            <Text style={styles.v}>Valor: ${Number(item.monto).toLocaleString()}</Text>
            <Boton title="PAGAR" onPress={() => navigation.navigate('SubastaGanada', {
              pieza: { titulo: item.titulo },
              factura: {
                monto_pujado: item.monto,
                comision_10_porciento: item.monto * 0.1,
                costo_envio: 850,
                total_a_pagar: item.monto + item.monto * 0.1 + 850,
              },
            })} />
          </Tarjeta>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  t: { fontWeight: '700', color: colors.azulMarino, marginTop: 8 },
  v: { fontWeight: '700', marginVertical: 4 },
  vacio: { textAlign: 'center', color: colors.grisTexto, marginTop: 40 },
});
