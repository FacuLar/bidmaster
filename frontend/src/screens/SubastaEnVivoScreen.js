import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { Boton, Tarjeta } from '../components/ui';
import { conectarSocket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

/**
 * Sala de subasta EN VIVO — modelo SECUENCIAL: la subasta remata un ítem por vez
 * y avanza sola. La pantalla muestra el ítem que se está rematando AHORA; cuando
 * cierra, aparece el siguiente automáticamente. Podés entrar, pujar por los ítems
 * que te interesan e irte a pagar cuando quieras.
 */
export default function SubastaEnVivoScreen({ route, navigation }) {
  const { subasta, medio } = route.params;
  const idSubasta = subasta.id_subasta || subasta.id;
  const { usuario } = useAuth();
  const miId = usuario?.id_usuario;
  const simbolo = subasta.moneda === 'USD' ? 'US$' : '$';

  const [estado, setEstado] = useState('conectando'); // conectando|programada|en_curso|finalizada
  const [item, setItem] = useState(null);             // ítem que se remata ahora
  const [oferta, setOferta] = useState(0);
  const [soyLider, setSoyLider] = useState(false);
  const [monto, setMonto] = useState('');
  const [pujando, setPujando] = useState(false);
  const [segundos, setSegundos] = useState(null);
  const [ganados, setGanados] = useState([]);

  const socketRef = useRef(null);
  const cierreTsRef = useRef(null);
  const itemRef = useRef(null);
  useEffect(() => { itemRef.current = item; }, [item]);

  const base = item?.precio_base || 0;
  const exento = subasta.categoria_requerida === 'oro' || subasta.categoria_requerida === 'platino';
  const minimo = oferta > 0 ? oferta + 0.01 * base : base;
  const maximo = (oferta > 0 ? oferta : base) + 0.20 * base;

  useEffect(() => {
    let socket; let tick;
    (async () => {
      socket = await conectarSocket();
      socketRef.current = socket;
      socket.emit('join_subasta', { id_subasta: idSubasta });

      socket.on('error_sala', (e) => { Alert.alert('No se pudo entrar', e.motivo); navigation.goBack(); });
      socket.on('subasta_estado', ({ estado: est }) => {
        setEstado(est === 'activa' ? 'en_curso' : est); // programada | finalizada
      });

      const aplicarItem = (d) => {
        setEstado('en_curso');
        setItem(d);
        setOferta(d.oferta_actual || 0);
        setSoyLider(d.lider_id != null && String(d.lider_id) === String(miId));
        setMonto('');
        if (d.segundos_restantes != null) {
          cierreTsRef.current = Date.now() + d.segundos_restantes * 1000;
          setSegundos(d.segundos_restantes);
        }
      };
      socket.on('item_actual', aplicarItem);

      socket.on('item_timer', ({ id_pieza, segundos_restantes }) => {
        if (itemRef.current && String(id_pieza) === String(itemRef.current.id_pieza) && segundos_restantes != null) {
          cierreTsRef.current = Date.now() + segundos_restantes * 1000;
          setSegundos(segundos_restantes);
        }
      });

      socket.on('oferta_actualizada', (d) => {
        if (itemRef.current && String(d.id_pieza) === String(itemRef.current.id_pieza)) {
          setOferta(d.nueva_oferta_lider);
          setSoyLider(String(d.lider_id) === String(miId));
        }
      });

      socket.on('puja_confirmada', () => { setPujando(false); setMonto(''); });
      socket.on('puja_rechazada', (e) => { setPujando(false); Alert.alert('Puja rechazada', e.motivo); });

      socket.on('item_cerrado', (d) => {
        if (String(d.lider_id) === String(miId)) {
          setGanados((g) => (g.find((x) => x.id_pieza === d.id_pieza) ? g : [...g, { id_pieza: d.id_pieza, titulo: d.titulo }]));
        }
      });

      socket.on('subasta_finalizada', () => { setEstado('finalizada'); setItem(null); setSegundos(null); });
    })();

    tick = setInterval(() => {
      if (cierreTsRef.current) setSegundos(Math.max(0, Math.round((cierreTsRef.current - Date.now()) / 1000)));
    }, 1000);

    return () => {
      if (tick) clearInterval(tick);
      if (socket) {
        socket.emit('leave_subasta', { id_subasta: idSubasta });
        ['error_sala', 'subasta_estado', 'item_actual', 'item_timer', 'oferta_actualizada',
          'puja_confirmada', 'puja_rechazada', 'item_cerrado', 'subasta_finalizada'].forEach((e) => socket.off(e));
      }
    };
  }, []);

  function pujar() {
    const valor = Number(monto);
    if (!item) return;
    if (!valor) { Alert.alert('Monto inválido', 'Ingresá un monto a ofertar.'); return; }
    if (valor < minimo) { Alert.alert('Muy bajo', `Mínimo: ${simbolo}${minimo.toFixed(0)}`); return; }
    if (!exento && valor > maximo) { Alert.alert('Muy alto', `Máximo: ${simbolo}${maximo.toFixed(0)}`); return; }
    setPujando(true);
    socketRef.current.emit('nueva_puja', {
      id_subasta: idSubasta, id_pieza: item.id_pieza, monto: valor, id_medio_pago: medio?.id,
    });
  }

  const BannerGanados = () => (ganados.length > 0 ? (
    <Tarjeta style={styles.ganados}>
      <Text style={styles.ganadosTit}>🏆 Ganaste {ganados.length} ítem{ganados.length > 1 ? 's' : ''}</Text>
      <Text style={styles.ganadosTxt} numberOfLines={2}>{ganados.map((g) => g.titulo).join(' · ')}</Text>
      <Boton title="PAGAR MIS COMPRAS" variant="dark" onPress={() => navigation.navigate('MisPujas')} />
    </Tarjeta>
  ) : null);

  // --- Estados no "en curso" ---
  if (estado === 'conectando') {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.naranja} /><Text style={styles.msg}>Conectando a la sala…</Text></View>;
  }
  if (estado === 'programada') {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>⏳</Text>
        <Text style={styles.msgTit}>La subasta todavía no comenzó</Text>
        <Text style={styles.msg}>Quedate en la sala: cuando arranque, vas a ver el ítem que se está rematando.</Text>
        <Boton title="Salir" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    );
  }
  if (estado === 'finalizada') {
    return (
      <ScrollView contentContainerStyle={styles.center}>
        <Text style={styles.emoji}>🏁</Text>
        <Text style={styles.msgTit}>La subasta finalizó</Text>
        <BannerGanados />
        <Boton title="Volver al catálogo" onPress={() => navigation.navigate('Main')} />
      </ScrollView>
    );
  }

  // --- En curso: ítem actual ---
  return (
    <ScrollView style={styles.container}>
      <View style={styles.live}>
        <Text style={styles.liveTxt}>🔴 EN VIVO · Subasta #{idSubasta}</Text>
        {segundos != null && <Text style={styles.timer}>⏱ {segundos}s</Text>}
      </View>

      <BannerGanados />

      {item ? (
        <View style={{ padding: 16 }}>
          <Text style={styles.orden}>Ítem {item.orden} de {item.total}</Text>
          {item.imagenes && item.imagenes[0]
            ? <Image source={{ uri: item.imagenes[0] }} style={styles.img} />
            : <View style={[styles.img, styles.ph]}><Text>Sin imagen</Text></View>}
          <Text style={styles.titulo}>{item.titulo}</Text>
          {item.artista ? <Text style={styles.meta}>{item.artista}</Text> : null}
          <Text style={styles.meta}>Pieza #{item.nro_pieza} · Base: {simbolo}{Number(base).toLocaleString()}</Text>

          <Tarjeta style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={styles.lbl}>Mejor oferta actual</Text>
            <Text style={styles.oferta}>{simbolo}{Number(oferta || base).toLocaleString()}</Text>
            {soyLider && <Text style={styles.lider}>Vas ganando este ítem 🎯</Text>}
            <TextInput style={styles.input} keyboardType="numeric"
              placeholder={`${simbolo}${minimo.toFixed(0)}`} value={monto} onChangeText={setMonto} />
            <Text style={styles.rango}>
              Mín {simbolo}{minimo.toFixed(0)}{exento ? ' · sin tope (oro/platino)' : ` · Máx ${simbolo}${maximo.toFixed(0)}`}
            </Text>
          </Tarjeta>

          <Boton title={pujando ? 'ESPERANDO CONFIRMACIÓN…' : 'PUJAR AHORA'} onPress={pujar} loading={pujando} />
          <Boton title="Salir de la sala" variant="secondary" onPress={() => navigation.goBack()} />
          <Text style={styles.nota}>Cuando cierre este ítem, sigue el próximo automáticamente.</Text>
        </View>
      ) : (
        <View style={styles.center}><ActivityIndicator color={colors.naranja} /><Text style={styles.msg}>Preparando el próximo ítem…</Text></View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.grisPerla },
  emoji: { fontSize: 56, marginBottom: 10 },
  msgTit: { fontSize: 18, fontWeight: '800', color: colors.azulMarino, textAlign: 'center', marginBottom: 6 },
  msg: { color: colors.grisTexto, textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 20 },
  live: { backgroundColor: colors.azulMarino, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTxt: { color: colors.blanco, fontWeight: '800' },
  timer: { color: colors.dorado, fontWeight: '900', fontSize: 16 },
  orden: { color: colors.naranja, fontWeight: '800', marginBottom: 8 },
  img: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.grisBorde },
  ph: { alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 20, fontWeight: '800', color: colors.azulMarino, marginTop: 10 },
  meta: { color: colors.grisTexto, marginTop: 2 },
  lbl: { color: colors.grisTexto, fontWeight: '600' },
  oferta: { fontSize: 30, fontWeight: '900', color: colors.verde, marginVertical: 4 },
  lider: { color: colors.verde, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 10, width: '100%', padding: 12, textAlign: 'center', fontSize: 18, marginTop: 10, backgroundColor: '#fff' },
  rango: { color: colors.grisTexto, fontSize: 12, marginTop: 8, textAlign: 'center' },
  nota: { color: colors.grisTexto, fontSize: 12, textAlign: 'center', marginTop: 8 },
  ganados: { margin: 14, marginBottom: 0, borderColor: colors.verde, borderWidth: 1 },
  ganadosTit: { color: colors.verde, fontWeight: '800', fontSize: 15 },
  ganadosTxt: { color: colors.textoOscuro, fontSize: 13, marginTop: 2, marginBottom: 4 },
});
