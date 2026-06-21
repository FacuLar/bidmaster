import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Boton, Tarjeta } from '../components/ui';
import { SubastaAPI, PagoAPI } from '../api/endpoints';
import colors from '../theme/colors';

/* Detalle/historia del objeto + elección del medio de pago antes de entrar. */
export default function HistoriaObjetoScreen({ route, navigation }) {
  const { pieza, subasta } = route.params;
  const idSubasta = subasta.id_subasta || subasta.id;
  const moneda = subasta.moneda;
  const simbolo = moneda === 'USD' ? 'US$' : '$';
  const base = pieza.precio_base || 0;

  const [medios, setMedios] = useState([]);
  const [elegido, setElegido] = useState(null);
  const [entrando, setEntrando] = useState(false);

  // Carrusel simple de las 6 fotos.
  const fotos = Array.isArray(pieza.imagenes) ? pieza.imagenes : [];
  const [fotoActual, setFotoActual] = useState(0);

  const cargarMedios = useCallback(async () => {
    try {
      const todos = await PagoAPI.listar();
      // Solo medios verificados en la MONEDA de la subasta.
      const validos = todos.filter((m) => m.estado_verificacion === 'Verificado' && m.moneda === moneda);
      setMedios(validos);
      // Preselecciona el primero que tenga fondos para el precio base.
      const conFondos = validos.find((m) => Number(m.saldo_disponible) >= base);
      setElegido((conFondos || validos[0])?.id ?? null);
    } catch (e) { /* silencioso */ }
  }, [moneda, base]);

  useFocusEffect(useCallback(() => { cargarMedios(); }, [cargarMedios]));

  const medioElegido = medios.find((m) => m.id === elegido);
  const fondosOk = medioElegido && Number(medioElegido.saldo_disponible) >= base;

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
      {fotos.length ? (
        <>
          <Image source={{ uri: fotos[fotoActual] }} style={styles.img} />
          <View style={styles.dots}>
            {fotos.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setFotoActual(i)}>
                <View style={[styles.dot, i === fotoActual && styles.dotOn]} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.fotoTxt}>Foto {fotoActual + 1} de {fotos.length}</Text>
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
      {medios.length === 0 ? (
        <Tarjeta><Text style={styles.sinMedio}>No tenés medios verificados en {moneda}. Agregá uno en tu Billetera.</Text></Tarjeta>
      ) : (
        medios.map((m) => {
          const ok = Number(m.saldo_disponible) >= base;
          const sel = m.id === elegido;
          return (
            <TouchableOpacity key={m.id} activeOpacity={0.85}
              onPress={() => setElegido(m.id)}
              style={[styles.medio, sel && styles.medioSel, !ok && styles.medioNoFondos]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medioTit}>
                  {m.tipo === 'TARJETA' ? '💳' : m.tipo === 'CHEQUE' ? '🧾' : '🏦'} {m.tipo} · {m.entidad}
                </Text>
                <Text style={styles.medioSaldo}>Saldo: {simbolo}{Number(m.saldo_disponible).toLocaleString()}</Text>
              </View>
              {!ok && <Text style={styles.badgeNo}>Sin fondos</Text>}
              {sel && ok && <Text style={styles.badgeOk}>✓</Text>}
            </TouchableOpacity>
          );
        })
      )}

      <Boton title="INGRESAR A LA SALA" onPress={ingresar} loading={entrando}
        disabled={!fondosOk} />
      {!fondosOk && medios.length > 0 && (
        <Text style={styles.aviso}>Elegí un medio con saldo suficiente para el precio base.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  img: { width: '100%', height: 220, borderRadius: 12, backgroundColor: colors.grisBorde },
  ph: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.grisBorde, marginHorizontal: 3 },
  dotOn: { backgroundColor: colors.naranja, width: 18 },
  fotoTxt: { textAlign: 'center', color: colors.grisTexto, fontSize: 11, marginTop: 4, marginBottom: 8 },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.azulMarino, marginTop: 6 },
  artista: { fontWeight: '700', color: colors.textoOscuro, marginTop: 4 },
  meta: { color: colors.grisTexto, marginTop: 2 },
  box: { backgroundColor: colors.blanco, borderRadius: 12, padding: 14, marginVertical: 14 },
  historia: { color: colors.textoOscuro, lineHeight: 21 },
  precio: { fontWeight: '700', color: colors.azulMarino, marginBottom: 12 },
  lbl: { color: colors.azulMarino, fontWeight: '700', marginBottom: 8 },
  medio: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.blanco,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: colors.grisBorde,
  },
  medioSel: { borderColor: colors.naranja, backgroundColor: '#FFFDFB' },
  medioNoFondos: { opacity: 0.6 },
  medioTit: { fontWeight: '700', color: colors.textoOscuro },
  medioSaldo: { color: colors.grisTexto, fontSize: 12.5, marginTop: 2 },
  badgeNo: { color: colors.rojo, fontWeight: '700', fontSize: 12 },
  badgeOk: { color: colors.naranja, fontWeight: '900', fontSize: 18 },
  sinMedio: { color: colors.grisTexto },
  aviso: { color: colors.rojo, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
