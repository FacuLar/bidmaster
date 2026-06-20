import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert, ScrollView,
} from 'react-native';
import { Boton, Tarjeta } from '../components/ui';
import { conectarSocket } from '../api/socket';
import { PujaAPI } from '../api/endpoints';
import colors from '../theme/colors';

/**
 * Sala de subasta EN VIVO. Recibe en tiempo real la oferta líder y permite
 * pujar. Bloquea la puja hasta recibir confirmación (secuencialidad).
 * Una vez que pujaste no podés salir hasta que la subasta termine (al minuto).
 */
export default function SubastaEnVivoScreen({ route, navigation }) {
  const { pieza, subasta, medio } = route.params;
  const idSubasta = subasta.id_subasta || subasta.id;
  const [ofertaActual, setOfertaActual] = useState(pieza.oferta_actual || pieza.precio_base || 0);
  const [soyLider, setSoyLider] = useState(false);
  const [monto, setMonto] = useState('');
  const [pujando, setPujando] = useState(false);
  const [estado, setEstado] = useState('Conectando...');
  const [pujé, setPujé] = useState(false);       // ya pujé → no puedo salir
  const [cerrada, setCerrada] = useState(false);  // la subasta terminó
  const [segundos, setSegundos] = useState(null); // countdown al cierre
  const socketRef = useRef(null);
  const cierreTsRef = useRef(null);
  const pujéRef = useRef(false);
  const soyLiderRef = useRef(false);

  const base = pieza.precio_base || 0;
  const minimo = ofertaActual + 0.01 * base;
  const exento = subasta.categoria_requerida === 'oro' || subasta.categoria_requerida === 'platino';
  const maximo = ofertaActual + 0.20 * base;

  useEffect(() => {
    let socket;
    let tick;
    (async () => {
      socket = await conectarSocket();
      socketRef.current = socket;

      socket.emit('join_subasta', { id_subasta: idSubasta });

      socket.on('sala_unida', () => setEstado('🔴 EN VIVO'));
      socket.on('error_sala', (e) => {
        Alert.alert('No se pudo entrar', e.motivo);
        navigation.goBack();
      });

      socket.on('oferta_actualizada', (data) => {
        if (String(data.id_pieza) === String(pieza.id_pieza)) {
          setOfertaActual(data.nueva_oferta_lider);
        }
      });

      socket.on('puja_confirmada', (data) => {
        if (String(data.id_pieza) === String(pieza.id_pieza)) {
          setSoyLider(true);
          setPujando(false);
          setMonto('');
          setPujé(true);
          pujéRef.current = true;
        }
      });

      socket.on('puja_rechazada', (e) => {
        setPujando(false);
        Alert.alert('Puja rechazada', e.motivo);
      });

      // Reloj de cierre (arranca con el primer puja de la subasta).
      socket.on('subasta_timer', ({ cierra_ts }) => {
        cierreTsRef.current = cierra_ts;
      });

      // La subasta terminó: se declara ganador y se libera el bloqueo de salida.
      socket.on('subasta_cerrada', ({ resultados }) => {
        setCerrada(true);
        setSegundos(0);
        const mio = resultados?.find((r) => String(r.id_pieza) === String(pieza.id_pieza));
        const gané = mio && pujéRef.current && soyLiderRef.current;
        Alert.alert(
          'Subasta finalizada',
          gané ? '¡Ganaste la pieza! Pasá a ver la liquidación.' : 'La subasta terminó.',
        );
      });
    })();

    // Tick del countdown (1s).
    tick = setInterval(() => {
      if (cierreTsRef.current) {
        const s = Math.max(0, Math.round((cierreTsRef.current - Date.now()) / 1000));
        setSegundos(s);
      }
    }, 1000);

    return () => {
      if (tick) clearInterval(tick);
      if (socket) {
        socket.emit('leave_subasta', { id_subasta: idSubasta });
        socket.off('oferta_actualizada');
        socket.off('puja_confirmada');
        socket.off('puja_rechazada');
        socket.off('sala_unida');
        socket.off('error_sala');
        socket.off('subasta_timer');
        socket.off('subasta_cerrada');
      }
    };
  }, []);

  // Mantiene una ref de soyLider para usar dentro del handler de cierre.
  useEffect(() => { soyLiderRef.current = soyLider; }, [soyLider]);

  // Bloqueo de salida: una vez que pujaste no podés salir hasta que termine.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (pujéRef.current && !cerrada) {
        e.preventDefault();
        Alert.alert('No podés salir', 'Ya pujaste en esta subasta. Tenés que esperar a que termine.');
      }
    });
    return sub;
  }, [navigation, cerrada]);

  function pujar() {
    const valor = Number(monto);
    if (!valor) { Alert.alert('Monto inválido', 'Ingresá un monto a ofertar.'); return; }
    if (valor < minimo) { Alert.alert('Muy bajo', `Mínimo: $${minimo.toFixed(0)}`); return; }
    if (!exento && valor > maximo) { Alert.alert('Muy alto', `Máximo: $${maximo.toFixed(0)}`); return; }

    setPujando(true);
    socketRef.current.emit('nueva_puja', {
      id_subasta: idSubasta,
      id_pieza: pieza.id_pieza,
      monto: valor,
      id_medio_pago: medio?.id, // medio definido al iniciar la subasta (#18)
    });
  }

  async function verFactura() {
    try {
      const f = await PujaAPI.factura(pieza.id_pieza);
      navigation.navigate('SubastaGanada', { factura: f, pieza });
    } catch (e) {
      Alert.alert('Aún no', e.message);
    }
  }

  const simbolo = subasta.moneda === 'USD' ? 'US$' : '$';

  return (
    <ScrollView style={styles.container}>
      <View style={styles.live}>
        <Text style={styles.liveTxt}>{cerrada ? '⏹ FINALIZADA' : estado}: Subasta #{idSubasta}</Text>
        {segundos != null && !cerrada && (
          <Text style={styles.timer}>⏱ Cierra en {segundos}s</Text>
        )}
      </View>
      <View style={styles.stream}><Text style={styles.streamTxt}>▶ Streaming del Rematador</Text></View>

      <View style={{ padding: 16 }}>
        <Text style={styles.titulo}>{pieza.titulo}</Text>
        <Text style={styles.meta}>Pieza #{pieza.nro_pieza} · Precio base: {simbolo}{base.toLocaleString()}</Text>

        {medio && (
          <Text style={styles.medio}>
            Medio de pago: {medio.tipo} {medio.numero} ✓ (saldo {simbolo}{Number(medio.saldo_disponible).toLocaleString()})
          </Text>
        )}

        <Tarjeta style={{ alignItems: 'center' }}>
          <Text style={styles.lbl}>Mejor oferta actual:</Text>
          <Text style={styles.oferta}>{simbolo}{Number(ofertaActual).toLocaleString()}</Text>
          {soyLider && <Text style={styles.lider}>{cerrada ? '¡Ganaste!' : '¡Sos el mejor postor!'}</Text>}

          {!cerrada && (
            <>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={`${simbolo}${minimo.toFixed(0)}`}
                value={monto}
                onChangeText={setMonto}
              />
              <Text style={styles.rango}>
                Mín: +1% ({simbolo}{minimo.toFixed(0)})
                {exento ? '  ·  Sin tope (oro/platino)' : `  ·  Máx: +20% (${simbolo}${maximo.toFixed(0)})`}
              </Text>
            </>
          )}
        </Tarjeta>

        {!cerrada && (
          <Boton title={pujando ? 'ESPERANDO CONFIRMACIÓN...' : 'PUJAR AHORA'}
            onPress={pujar} loading={pujando} />
        )}

        {pujé && !cerrada && (
          <Text style={styles.aviso}>🔒 Ya pujaste: no podés salir ni entrar a otra subasta hasta que esta termine.</Text>
        )}

        {(soyLider || cerrada) && (
          <Boton title="VER LIQUIDACIÓN (si ganás)" variant="dark" onPress={verFactura} />
        )}

        {(cerrada || !pujé) && (
          <Boton title="SALIR DE LA SUBASTA" variant="secondary" onPress={() => navigation.goBack()} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla },
  live: { backgroundColor: colors.azulMarino, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTxt: { color: colors.blanco, fontWeight: '800' },
  timer: { color: colors.dorado, fontWeight: '800' },
  stream: { backgroundColor: '#000', height: 150, alignItems: 'center', justifyContent: 'center' },
  streamTxt: { color: colors.blanco },
  titulo: { fontSize: 19, fontWeight: '800', color: colors.azulMarino },
  meta: { color: colors.grisTexto, marginBottom: 6 },
  medio: { color: colors.azulMarino, fontWeight: '600', fontSize: 12.5, marginBottom: 4 },
  lbl: { color: colors.grisTexto, fontWeight: '600' },
  oferta: { fontSize: 30, fontWeight: '900', color: colors.verde, marginVertical: 4 },
  lider: { color: colors.verde, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.grisBorde, borderRadius: 10, width: '100%',
    padding: 12, textAlign: 'center', fontSize: 18, marginTop: 10, backgroundColor: '#fff',
  },
  rango: { color: colors.grisTexto, fontSize: 12, marginTop: 8, textAlign: 'center' },
  aviso: { color: '#92400E', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, fontSize: 12.5, marginTop: 6, textAlign: 'center' },
});
