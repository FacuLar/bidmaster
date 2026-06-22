import React, { useState, useCallback } from 'react';
import {
  ScrollView, View, Text, StyleSheet, Image, Alert, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Boton, SelectorMedios } from '../components/ui';
import { SubastaAPI, PagoAPI } from '../api/endpoints';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const ANCHO = Dimensions.get('window').width - 36; // ancho útil (padding 18 x2)

/* Detalle/historia del objeto + elección del medio de pago antes de entrar. */
export default function HistoriaObjetoScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { pieza, subasta } = route.params;
  const idSubasta = subasta.id_subasta || subasta.id;
  const moneda = subasta.moneda;
  const simbolo = moneda === 'USD' ? 'US$' : '$';
  const base = pieza.precio_base || 0;

  const [medios, setMedios] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [fotoActual, setFotoActual] = useState(0);

  const fotos = Array.isArray(pieza.imagenes) ? pieza.imagenes : [];

  const cargarMedios = useCallback(async () => {
    try {
      const todos = await PagoAPI.listar();
      const validos = todos.filter((m) => m.estado_verificacion === 'Verificado' && m.moneda === moneda);
      setMedios(validos);
      const conFondos = validos.find((m) => Number(m.saldo_disponible) >= base);
      setElegido((conFondos || validos[0])?.id ?? null);
    } catch (e) { /* silencioso */ }
  }, [moneda, base]);

  useFocusEffect(useCallback(() => { cargarMedios(); }, [cargarMedios]));

  const medioElegido = medios.find((m) => m.id === elegido);
  const fondosOk = medioElegido && Number(medioElegido.saldo_disponible) >= base;

  function onScroll(e) {
    const i = Math.round(e.nativeEvent.contentOffset.x / ANCHO);
    if (i !== fotoActual) setFotoActual(i);
  }

  async function ingresar() {
    if (!medioElegido) {
      Alert.alert('Sin medio de pago', `Necesitás un medio verificado en ${moneda}. Agregalo en tu Billetera.`);
      return;
    }
    if (!fondosOk) {
      Alert.alert('Fondos insuficientes', `El medio elegido no cubre el precio base (${simbolo}${base.toLocaleString()}). Elegí otro o cargá fondos.`);
      return;
    }
    setEntrando(true);
    try {
      const r = await SubastaAPI.streaming(idSubasta, { id_medio: elegido, id_pieza: pieza.id_pieza });
      navigation.navigate('SubastaEnVivo', { pieza, subasta, medio: r.medio_pago });
    } catch (e) {
      Alert.alert('No podés ingresar', e.message);
    } finally {
      setEntrando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      {/* Carrusel deslizable de las 6 fotos. */}
      {fotos.length ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            style={styles.carrusel}
          >
            {fotos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.img} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {fotos.map((_, i) => (
              <View key={i} style={[styles.dot, i === fotoActual && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.fotoTxt}>Foto {fotoActual + 1} de {fotos.length} · deslizá para ver más →</Text>
        </>
      ) : (
        <View style={[styles.img, styles.ph]}><Text>Sin fotos</Text></View>
      )}

      <Text style={styles.titulo}>{pieza.titulo}</Text>
      {pieza.artista ? <Text style={styles.artista}>Artista/Diseñador: {pieza.artista}</Text> : null}
      {pieza.fecha_obra ? <Text style={styles.meta}>Fecha: {pieza.fecha_obra} · {subasta.titulo}</Text> : null}

      <View style={styles.box}>
        <Text style={styles.historia}>{pieza.historia || pieza.descripcion || 'Sin historia registrada.'}</Text>
      </View>

      <Text style={styles.precio}>
        Precio base: {pieza.precio_base != null ? `${simbolo}${base.toLocaleString()}` : '🔒'}
      </Text>

      {/* Elección del medio de pago con el que vas a pujar (#18). */}
      <Text style={styles.lbl}>Elegí el medio de pago para esta subasta ({moneda})</Text>
      <SelectorMedios medios={medios} elegido={elegido} onElegir={setElegido}
        montoMinimo={base} simbolo={simbolo} />

      <Boton title="INGRESAR A LA SALA" onPress={ingresar} loading={entrando} disabled={!fondosOk} />
      {!fondosOk && medios.length > 0 && (
        <Text style={styles.aviso}>Elegí un medio con saldo suficiente para el precio base.</Text>
      )}
    </ScrollView>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  carrusel: { width: ANCHO, height: 230, borderRadius: 12 },
  img: { width: ANCHO, height: 230, borderRadius: 12, backgroundColor: colors.grisBorde },
  ph: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.grisBorde, marginHorizontal: 3 },
  dotOn: { backgroundColor: colors.naranja, width: 18 },
  fotoTxt: { textAlign: 'center', color: colors.grisTexto, fontSize: 11, marginTop: 4, marginBottom: 8 },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.azulMarino, marginTop: 6 },
  artista: { fontWeight: '700', color: colors.textoOscuro, marginTop: 4 },
  meta: { color: colors.grisTexto, marginTop: 2 },
  box: { backgroundColor: colors.superficie, borderRadius: 12, padding: 14, marginVertical: 14 },
  historia: { color: colors.textoOscuro, lineHeight: 21 },
  precio: { fontWeight: '700', color: colors.azulMarino, marginBottom: 12 },
  lbl: { color: colors.azulMarino, fontWeight: '700', marginBottom: 8 },
  aviso: { color: colors.rojo, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
