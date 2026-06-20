import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Header, BannerInvitado } from '../components/ui';
import { SubastaAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

// Texto "Común o superior" para la categoría requerida (igual al wireframe).
const capit = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function HomeScreen({ navigation }) {
  const { usuario, esInvitado, invitado } = useAuth();
  const [moneda, setMoneda] = useState('ARS');
  const [subastas, setSubastas] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async (m) => {
    setCargando(true);
    try {
      const lista = await SubastaAPI.listar(m);
      setSubastas(lista);
      // Trae las piezas de cada subasta para el listado tipo catálogo.
      const todas = [];
      for (const s of lista) {
        const cat = await SubastaAPI.catalogo(s.id_subasta);
        cat.piezas.forEach((p) => todas.push({ ...p, subasta: s }));
      }
      setPiezas(todas);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(moneda); }, [moneda, cargar]));

  function abrirSala(item) {
    if (esInvitado) {
      Alert.alert('Validá tu cuenta', 'Como invitado podés mirar las subastas, pero para ingresar y pujar tenés que validar tu cuenta.', [
        { text: 'Más tarde', style: 'cancel' },
        { text: 'Validar ahora', onPress: () => navigation.navigate('CompletarRegistro') },
      ]);
      return;
    }
    if (!item.subasta.accesible) {
      Alert.alert('Acceso restringido', 'Tu categoría no alcanza para esta subasta.');
      return;
    }
    navigation.navigate('HistoriaObjeto', { pieza: item, subasta: item.subasta });
  }

  const Tab = ({ val, label }) => (
    <TouchableOpacity onPress={() => setMoneda(val)} style={styles.tab}>
      <Text style={[styles.tabTxt, moneda === val && styles.tabActivo]}>{label}</Text>
      {moneda === val && <View style={styles.tabLinea} />}
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const accesible = item.subasta.accesible;
    return (
      <Tarjeta>
        {item.imagenes && item.imagenes[0]
          ? <Image source={{ uri: item.imagenes[0] }} style={styles.img} />
          : <View style={[styles.img, styles.imgPlaceholder]}><Text style={styles.imgTxt}>🖼️ Imagen del Artículo</Text></View>}
        <Text style={styles.titulo}>{item.titulo}</Text>
        <Text style={styles.meta}>Cat. Requerida: {capit(item.subasta.categoria_requerida)} o superior</Text>
        <Text style={styles.meta}>Inicio: Hoy, {item.subasta.hora}hs · Rematador: {item.subasta.rematador}</Text>
        <Text style={styles.precio}>
          Precio Base: {item.precio_base != null
            ? `$${item.precio_base.toLocaleString()}`
            : '🔒 (registrate para ver)'}
        </Text>
        <Boton title="INGRESAR A LA SALA" onPress={() => abrirSala(item)} disabled={!accesible} />
      </Tarjeta>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Header
          titulo="Subastas Activas"
          subtitulo={esInvitado
            ? `${invitado?.email} · Invitado (sin validar)`
            : `${usuario?.nombre} · Categoría: ${capit(usuario?.categoria)}`}
          conAviso
          onAvisos={() => Alert.alert('Avisos', 'No tenés notificaciones nuevas.')}
        />

        {esInvitado && <BannerInvitado onValidar={() => navigation.navigate('CompletarRegistro')} />}

        <View style={styles.tabs}>
          <Tab val="ARS" label="En Pesos" />
          <Tab val="USD" label="En Dólares" />
        </View>

        <FlatList
          data={piezas}
          keyExtractor={(it) => String(it.id_pieza)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14 }}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(moneda)} />}
          ListEmptyComponent={!cargando && <Text style={styles.vacio}>No hay subastas activas en esta moneda.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.azulMarino },
  container: { flex: 1, backgroundColor: colors.grisPerla },
  tabs: { flexDirection: 'row', backgroundColor: colors.blanco, paddingHorizontal: 16 },
  tab: { marginRight: 28, paddingVertical: 12, alignItems: 'center' },
  tabTxt: { color: colors.grisTexto, fontWeight: '600' },
  tabActivo: { color: colors.azulMarino, fontWeight: '800' },
  tabLinea: { height: 3, backgroundColor: colors.naranja, width: '100%', marginTop: 6, borderRadius: 2 },
  img: { width: '100%', height: 150, borderRadius: 10, marginBottom: 10, backgroundColor: colors.grisPerla },
  imgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grisBorde },
  imgTxt: { color: colors.grisTexto, fontSize: 12 },
  titulo: { fontSize: 17, fontWeight: '800', color: colors.azulMarino },
  meta: { color: colors.grisTexto, fontSize: 12, marginTop: 2 },
  precio: { color: colors.verde, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  vacio: { textAlign: 'center', color: colors.grisTexto, marginTop: 40 },
});
