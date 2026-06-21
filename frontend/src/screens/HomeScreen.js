import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Header, BannerInvitado, Insignia, EmptyState } from '../components/ui';
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
        // Solo se muestran piezas todavía en subasta (las vendidas/sin ofertas se ocultan).
        cat.piezas
          .filter((p) => p.estado === 'en_subasta')
          .forEach((p) => todas.push({ ...p, subasta: s }));
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
      <Tarjeta style={styles.card}>
        <View style={styles.imgWrap}>
          {item.imagenes && item.imagenes[0]
            ? <Image source={{ uri: item.imagenes[0] }} style={styles.img} />
            : <View style={[styles.img, styles.imgPlaceholder]}><Text style={styles.imgTxt}>🖼️ Imagen del Artículo</Text></View>}
          {item.subasta.en_curso ? (
            <View style={styles.envivo}>
              <View style={styles.envivoDot} />
              <Text style={styles.envivoTxt}>EN VIVO</Text>
            </View>
          ) : (
            <View style={styles.programada}>
              <Text style={styles.programadaTxt}>⏳ PROGRAMADA</Text>
            </View>
          )}
          {!accesible && (
            <View style={styles.lockBadge}><Text style={styles.lockTxt}>🔒 Categoría superior</Text></View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.tituloRow}>
            <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
            <Insignia texto={capit(item.subasta.categoria_requerida)} color={colors.dorado} variant="soft" />
          </View>
          <Text style={styles.meta}>🕒 Hoy {item.subasta.hora}hs · 🎙️ {item.subasta.rematador}</Text>

          <View style={styles.precioRow}>
            <Text style={styles.precioLbl}>Precio base</Text>
            <Text style={styles.precio}>
              {item.precio_base != null ? `$${item.precio_base.toLocaleString()}` : '🔒 registrate para ver'}
            </Text>
          </View>

          <Boton
            title={accesible ? 'INGRESAR A LA SALA' : 'NO DISPONIBLE'}
            icon={accesible ? '🚪' : undefined}
            onPress={() => abrirSala(item)}
            disabled={!accesible}
          />
        </View>
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
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(moneda)} />}
          ListEmptyComponent={!cargando && (
            <EmptyState icon="🏛️" titulo="Sin subastas activas"
              texto={`No hay subastas en ${moneda === 'ARS' ? 'pesos' : 'dólares'} por ahora. Probá refrescando o cambiá de moneda.`} />
          )}
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

  card: { padding: 0, overflow: 'hidden' },
  imgWrap: { position: 'relative' },
  img: { width: '100%', height: 170, backgroundColor: colors.grisPerla },
  imgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grisBorde },
  imgTxt: { color: colors.grisTexto, fontSize: 12 },
  envivo: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(10,25,47,0.85)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  envivoDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rojo, marginRight: 6 },
  envivoTxt: { color: colors.blanco, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  programada: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(212,175,55,0.92)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  programadaTxt: { color: colors.azulMarino, fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  lockBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(17,24,39,0.82)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
  },
  lockTxt: { color: colors.blanco, fontSize: 10.5, fontWeight: '700' },

  cardBody: { padding: 15 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontSize: 17, fontWeight: '800', color: colors.azulMarino, flex: 1, marginRight: 8 },
  meta: { color: colors.grisTexto, fontSize: 12, marginTop: 4 },
  precioRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.verdeSuave, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    marginTop: 12, marginBottom: 4,
  },
  precioLbl: { color: colors.verdeOscuro, fontSize: 12, fontWeight: '600' },
  precio: { color: colors.verdeOscuro, fontWeight: '800', fontSize: 15 },
});
