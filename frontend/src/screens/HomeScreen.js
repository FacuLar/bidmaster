import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, Image, RefreshControl, Alert, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Header, BannerInvitado, Insignia, EmptyState, Chip } from '../components/ui';
import { SubastaAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { CATEGORIAS, TAGS, USOS, labelUso, norm } from '../theme/taxonomia';

// Texto "Común o superior" para la categoría requerida (igual al wireframe).
const capit = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function HomeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { usuario, esInvitado, invitado } = useAuth();
  const [moneda, setMoneda] = useState('ARS');
  const [subastas, setSubastas] = useState([]);
  const [piezas, setPiezas] = useState([]);
  const [cargando, setCargando] = useState(false);
  // Búsqueda y filtros del catálogo.
  const [query, setQuery] = useState('');
  const [catSel, setCatSel] = useState(null);
  const [usoSel, setUsoSel] = useState(null);
  const [tagsSel, setTagsSel] = useState([]);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  const toggleTag = (t) => setTagsSel((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const limpiar = () => { setQuery(''); setCatSel(null); setUsoSel(null); setTagsSel([]); };
  const hayFiltros = !!(query.trim() || catSel || usoSel || tagsSel.length);

  const piezasFiltradas = piezas.filter((p) => {
    if (catSel && p.categoria !== catSel) return false;
    if (usoSel && p.uso !== usoSel) return false;
    if (tagsSel.length && !tagsSel.some((t) => (p.tags || []).includes(t))) return false;
    if (query.trim()) {
      const q = norm(query);
      const heno = `${norm(p.titulo)} ${norm(p.descripcion)} ${norm(p.artista)} ${norm((p.tags || []).join(' '))}`;
      if (!heno.includes(q)) return false;
    }
    return true;
  });

  // Agrupa los ítems por SUBASTA: cada subasta es una sección con sus objetos.
  const secciones = subastas
    .map((s) => ({ subasta: s, data: piezasFiltradas.filter((p) => p.subasta.id_subasta === s.id_subasta) }))
    .filter((sec) => sec.data.length > 0);

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

  // Header de cada SUBASTA (con la cantidad de objetos y el botón de ingresar).
  const renderSubastaHeader = ({ section }) => {
    const s = section.subasta;
    const simbolo = s.moneda === 'USD' ? 'US$' : '$';
    return (
      <View style={styles.subHeader}>
        <View style={styles.subHeaderTop}>
          <Text style={styles.subTitulo} numberOfLines={1}>{s.titulo}</Text>
          {s.en_curso
            ? <View style={styles.envivoMini}><View style={styles.envivoDot} /><Text style={styles.envivoTxt}>EN VIVO</Text></View>
            : <Text style={styles.progMini}>⏳ PROGRAMADA</Text>}
        </View>
        <Text style={styles.subMeta}>
          📦 {section.data.length} objeto{section.data.length !== 1 ? 's' : ''} · 🕒 {s.hora}hs · 🎙️ {s.rematador} · {simbolo}
        </Text>
        <View style={styles.subHeaderBtns}>
          <Insignia texto={`Cat. ${capit(s.categoria_requerida)}`} color={colors.dorado} variant="soft" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Boton title={s.accesible ? 'INGRESAR A LA SALA' : '🔒 NO DISPONIBLE'} size="sm"
              onPress={() => abrirSala(section.data[0])} disabled={!s.accesible} style={{ marginVertical: 0 }} />
          </View>
        </View>
      </View>
    );
  };

  // Card compacta de cada objeto (tocá para ver el detalle / entrar).
  const renderItem = ({ item }) => (
    <Tarjeta style={styles.itemCard} onPress={() => abrirSala(item)}>
      {item.imagenes && item.imagenes[0]
        ? <Image source={{ uri: item.imagenes[0] }} style={styles.itemImg} />
        : <View style={[styles.itemImg, styles.imgPlaceholder]}><Text style={styles.imgTxt}>🖼️</Text></View>}
      <View style={styles.itemBody}>
        <Text style={styles.titulo} numberOfLines={1}>{item.titulo}</Text>
        <View style={styles.clasifRow}>
          {(CATEGORIAS.find((c) => c.k === item.categoria) || {}).icon ? (
            <Text style={styles.clasifCat}>{(CATEGORIAS.find((c) => c.k === item.categoria) || {}).icon} {(CATEGORIAS.find((c) => c.k === item.categoria) || {}).label}</Text>
          ) : null}
          {item.uso ? <Text style={styles.clasifPill}>{labelUso(item.uso)}</Text> : null}
        </View>
        <Text style={styles.precio}>
          {item.precio_base != null ? `$${item.precio_base.toLocaleString()}` : '🔒 registrate para ver'}
        </Text>
      </View>
    </Tarjeta>
  );

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

        {/* Buscador + filtros */}
        <View style={styles.buscador}>
          <View style={styles.searchBox}>
            <Text style={styles.lupa}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, artista o etiqueta…"
              placeholderTextColor={colors.textoSuave}
              value={query}
              onChangeText={setQuery}
            />
            {query ? (
              <TouchableOpacity onPress={() => setQuery('')}><Text style={styles.limpiarX}>✕</Text></TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Chip label="Todas" activo={!catSel} onPress={() => setCatSel(null)} />
            {CATEGORIAS.map((c) => (
              <Chip key={c.k} label={`${c.icon} ${c.label}`} activo={catSel === c.k}
                onPress={() => setCatSel(catSel === c.k ? null : c.k)} />
            ))}
          </ScrollView>

          <View style={styles.filtrosBarra}>
            <TouchableOpacity onPress={() => setMostrarFiltros((v) => !v)}>
              <Text style={styles.filtrosTxt}>
                ⚙ Filtros{(tagsSel.length || usoSel) ? ` (${tagsSel.length + (usoSel ? 1 : 0)})` : ''} {mostrarFiltros ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.resultTxt}>
              {piezasFiltradas.length} resultado{piezasFiltradas.length !== 1 ? 's' : ''}
              {hayFiltros ? <Text style={styles.limpiar} onPress={limpiar}>  · Limpiar</Text> : null}
            </Text>
          </View>

          {mostrarFiltros && (
            <View style={styles.panelFiltros}>
              <Text style={styles.filtroLbl}>Estado de uso</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {USOS.map((u) => (
                  <Chip key={u.k} label={u.label} activo={usoSel === u.k}
                    onPress={() => setUsoSel(usoSel === u.k ? null : u.k)} />
                ))}
              </ScrollView>
              <Text style={styles.filtroLbl}>Etiquetas</Text>
              <View style={styles.tagsWrap}>
                {TAGS.map((t) => (
                  <View key={t} style={{ marginBottom: 8 }}>
                    <Chip label={t} activo={tagsSel.includes(t)} onPress={() => toggleTag(t)} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        <SectionList
          sections={secciones}
          keyExtractor={(it) => String(it.id_pieza)}
          renderItem={renderItem}
          renderSectionHeader={renderSubastaHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(moneda)} />}
          ListEmptyComponent={!cargando && (
            hayFiltros
              ? <EmptyState icon="🔎" titulo="Sin resultados" texto="Ningún ítem coincide con la búsqueda o los filtros. Probá limpiarlos." />
              : <EmptyState icon="🏛️" titulo="Sin subastas activas"
                  texto={`No hay subastas en ${moneda === 'ARS' ? 'pesos' : 'dólares'} por ahora. Probá refrescando o cambiá de moneda.`} />
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.nav },
  container: { flex: 1, backgroundColor: colors.grisPerla },
  tabs: { flexDirection: 'row', backgroundColor: colors.superficie, paddingHorizontal: 16 },
  tab: { marginRight: 28, paddingVertical: 12, alignItems: 'center' },
  tabTxt: { color: colors.grisTexto, fontWeight: '600' },
  tabActivo: { color: colors.azulMarino, fontWeight: '800' },
  tabLinea: { height: 3, backgroundColor: colors.naranja, width: '100%', marginTop: 6, borderRadius: 2 },

  buscador: { backgroundColor: colors.superficie, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.grisBorde },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.grisPerla, borderRadius: 10, paddingHorizontal: 10 },
  lupa: { fontSize: 15, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14, color: colors.textoOscuro },
  limpiarX: { color: colors.grisTexto, fontWeight: '800', fontSize: 15, paddingHorizontal: 4 },
  chipsRow: { paddingVertical: 10, paddingRight: 8 },
  filtrosBarra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 },
  filtrosTxt: { color: colors.azulMarino, fontWeight: '700', fontSize: 13 },
  resultTxt: { color: colors.grisTexto, fontSize: 12 },
  limpiar: { color: colors.naranja, fontWeight: '700' },
  panelFiltros: { borderTopWidth: 1, borderTopColor: colors.grisBorde, marginTop: 4, paddingTop: 6 },
  filtroLbl: { color: colors.azulMarino, fontWeight: '700', fontSize: 12, marginTop: 4 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },

  clasifRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 },
  clasifCat: { color: colors.azulMarino, fontWeight: '700', fontSize: 11.5, marginRight: 8 },
  clasifPill: { backgroundColor: colors.grisPerla, color: colors.grisTexto, fontSize: 10.5, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginRight: 6, overflow: 'hidden' },

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
  precio: { color: colors.verdeOscuro, fontWeight: '800', fontSize: 14 },

  // Header de subasta (sección)
  subHeader: {
    backgroundColor: colors.superficie, borderRadius: 14, padding: 13, marginTop: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borde, borderLeftWidth: 4, borderLeftColor: colors.naranja,
  },
  subHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subTitulo: { fontSize: 16, fontWeight: '800', color: colors.azulMarino, flex: 1, marginRight: 8 },
  envivoMini: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.nav, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  progMini: { color: colors.doradoOscuro, fontWeight: '800', fontSize: 10.5 },
  subMeta: { color: colors.grisTexto, fontSize: 12, marginTop: 4 },
  subHeaderBtns: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },

  // Card compacta del objeto
  itemCard: { flexDirection: 'row', padding: 8, marginVertical: 5, alignItems: 'center' },
  itemImg: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.grisPerla },
  itemBody: { flex: 1, marginLeft: 12 },
});
