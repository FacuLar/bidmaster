import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, Alert } from 'react-native';
import { Boton } from '../components/ui';
import { SubastaAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Detalle/historia del objeto antes de ingresar a la sala en vivo. */
export default function HistoriaObjetoScreen({ route, navigation }) {
  const { pieza, subasta } = route.params;
  const [entrando, setEntrando] = useState(false);

  // Al ingresar se valida categoría + medio de pago verificado + compromiso
  // (no estar atado a otra subasta) y se define el medio que se usará (#18).
  async function ingresar() {
    setEntrando(true);
    try {
      const r = await SubastaAPI.streaming(subasta.id_subasta || subasta.id);
      navigation.navigate('SubastaEnVivo', { pieza, subasta, medio: r.medio_pago });
    } catch (e) {
      Alert.alert('No podés ingresar', e.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      {pieza.imagenes && pieza.imagenes[0]
        ? <Image source={{ uri: pieza.imagenes[0] }} style={styles.img} />
        : <View style={[styles.img, styles.ph]}><Text>Carrusel {pieza.imagenes?.length || 6} Fotos</Text></View>}

      <Text style={styles.titulo}>{pieza.titulo}</Text>
      {pieza.artista ? <Text style={styles.artista}>Artista/Diseñador: {pieza.artista}</Text> : null}
      {pieza.fecha_obra ? <Text style={styles.meta}>Fecha: {pieza.fecha_obra} · Origen: catálogo {subasta.titulo}</Text> : null}

      <View style={styles.box}>
        <Text style={styles.historia}>{pieza.historia || pieza.descripcion || 'Sin historia registrada.'}</Text>
      </View>

      <Text style={styles.precio}>
        Precio base: {pieza.precio_base != null ? `$${pieza.precio_base.toLocaleString()}` : '🔒'}
      </Text>

      <Boton title="INGRESAR A LA SALA" onPress={ingresar} loading={entrando} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  img: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.grisBorde, marginBottom: 14 },
  ph: { alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.azulMarino },
  artista: { fontWeight: '700', color: colors.textoOscuro, marginTop: 4 },
  meta: { color: colors.grisTexto, marginTop: 2 },
  box: { backgroundColor: colors.blanco, borderRadius: 12, padding: 14, marginVertical: 14 },
  historia: { color: colors.textoOscuro, lineHeight: 21 },
  precio: { fontWeight: '700', color: colors.azulMarino, marginBottom: 8 },
});
