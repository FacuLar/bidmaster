import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Header, BannerInvitado, Insignia, Divider, EmptyState } from '../components/ui';
import { UsuarioAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const capit = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'];
const colorCategoria = {
  comun: colors.grisTexto, especial: colors.azulInfo, plata: '#94A3B8',
  oro: colors.dorado, platino: '#0EA5E9',
};
const fmt = (n) => `$${Number(n || 0).toLocaleString()}`;

export default function PerfilScreen({ navigation }) {
  const { usuario, esInvitado, invitado, logout } = useAuth();
  const [metricas, setMetricas] = useState(null);
  const [multa, setMulta] = useState(null);

  const cargar = useCallback(async () => {
    if (esInvitado) return; // el invitado no tiene métricas (cuenta sin validar)
    try {
      setMetricas(await UsuarioAPI.metricas());
      const m = await UsuarioAPI.multas();
      setMulta(m.estado === 'con_deuda' ? m : null);
    } catch (e) { /* silencioso */ }
  }, [esInvitado]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  function confirmarSalir() {
    Alert.alert('¿Desea cerrar sesión?', '', [
      { text: 'NO', style: 'cancel' },
      { text: 'SI', onPress: logout },
    ]);
  }

  // Modo invitado: la cuenta todavía no está validada.
  if (esInvitado) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header titulo="Mi Perfil" subtitulo="Invitado (sin validar)" />
        <BannerInvitado onValidar={() => navigation.navigate('CompletarRegistro')} />
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
          <Tarjeta>
            <Text style={styles.linea}>Email: {invitado?.email}</Text>
            <Text style={[styles.linea, { color: colors.grisTexto, marginTop: 6 }]}>
              Tu cuenta está en verificación. Para pujar, registrar medios de pago y ver tus
              métricas necesitás validarla y generar tu clave.
            </Text>
          </Tarjeta>
          <Boton title="VALIDAR MI CUENTA" onPress={() => navigation.navigate('CompletarRegistro')} />
          <Boton title="Salir" variant="secondary" onPress={logout} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const nombre = metricas?.nombre || usuario?.nombre || 'Usuario';
  const apellido = metricas?.apellido || '';
  const categoria = (metricas?.categoria || usuario?.categoria || 'comun');
  const inicial = (nombre[0] || 'U').toUpperCase();
  const idxCat = CATEGORIAS.indexOf(categoria);
  const proxima = idxCat >= 0 && idxCat < CATEGORIAS.length - 1 ? CATEGORIAS[idxCat + 1] : null;

  const Stat = ({ icon, valor, label, color }) => (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValor, color && { color }]}>{valor}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        titulo="Mi Perfil"
        subtitulo={metricas?.email || ''}
        onAvisos={() => Alert.alert('Avisos', 'No tenés notificaciones nuevas.')}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>

        {/* Tarjeta de identidad */}
        <Tarjeta style={styles.idCard}>
          <View style={styles.idRow}>
            <View style={[styles.avatar, { backgroundColor: colorCategoria[categoria] || colors.azulClaro }]}>
              <Text style={styles.avatarTxt}>{inicial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{nombre} {apellido}</Text>
              {metricas?.email ? <Text style={styles.email}>{metricas.email}</Text> : null}
              <View style={{ marginTop: 6, flexDirection: 'row' }}>
                <Insignia texto={`★ ${capit(categoria)}`} color={colorCategoria[categoria] || colors.dorado} />
              </View>
            </View>
          </View>
          {metricas?.pais_origen ? (
            <>
              <Divider />
              <Text style={styles.metaLinea}>📍 {metricas.pais_origen}</Text>
            </>
          ) : null}
          {proxima ? (
            <Text style={styles.progreso}>
              Próxima categoría: <Text style={{ fontWeight: '800', color: colors.azulMarino }}>{capit(proxima)}</Text>.
              Participá y diversificá tus medios de pago para subir.
            </Text>
          ) : (
            <Text style={styles.progreso}>🏆 Alcanzaste la categoría máxima.</Text>
          )}
        </Tarjeta>

        {multa && (
          <Tarjeta style={{ borderColor: colors.rojo, borderWidth: 1.5, backgroundColor: colors.rojoSuave }}>
            <Text style={{ color: colors.rojo, fontWeight: '800' }}>⚠ Tenés una multa activa</Text>
            <Text style={{ color: colors.textoOscuro, fontSize: 13, marginTop: 4 }}>
              Monto: {fmt(multa.monto_multa)} · Te quedan {multa.horas_restantes}hs para regularizar.
            </Text>
            <Boton title="VER AVISO DE MULTA" variant="secondary"
              onPress={() => navigation.navigate('AvisoMulta', { multa })} />
          </Tarjeta>
        )}

        {/* Métricas */}
        <Text style={styles.subt}>Mi actividad</Text>
        <View style={styles.statsGrid}>
          <Stat icon="🎯" valor={metricas?.subastas_asistidas ?? '-'} label="Asistidas" />
          <Stat icon="🏆" valor={metricas?.subastas_ganadas ?? '-'} label="Ganadas" color={colors.verdeOscuro} />
          <Stat icon="🔨" valor={metricas?.cantidad_pujas ?? '-'} label="Pujas" />
        </View>
        <View style={styles.statsGrid}>
          <Stat icon="💸" valor={fmt(metricas?.total_ofertado)} label="Total ofertado" />
          <Stat icon="✅" valor={fmt(metricas?.total_invertido)} label="Total invertido" color={colors.azulMarino} />
        </View>

        {/* Historial */}
        <Text style={styles.subt}>Historial de piezas ganadas</Text>
        {metricas?.historial_pujas?.length
          ? metricas.historial_pujas.map((h, i) => (
              <Tarjeta key={i} style={styles.histCard}>
                <Text style={styles.histTit}>🏆 {h.titulo}</Text>
                <Text style={styles.histMonto}>{fmt(h.monto)} · {h.resultado}</Text>
              </Tarjeta>
            ))
          : <EmptyState icon="🪙" titulo="Todavía sin victorias" texto="Cuando ganes una subasta, tus piezas aparecen acá." />}

        {/* Acciones */}
        <Text style={styles.subt}>Acciones</Text>
        <Boton title="VER MIS PUJAS" icon="📜" variant="dark" onPress={() => navigation.navigate('MisPujas')} />
        <Boton title="SUBASTAR MI ARTÍCULO" icon="🏛️" onPress={() => navigation.navigate('SubastarArticulo')} />
        <Boton title="MIS ARTÍCULOS" variant="secondary" onPress={() => navigation.navigate('MisArticulos')} />
        <Boton title="Cerrar sesión" variant="outline" onPress={confirmarSalir} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.azulMarino },
  container: { flex: 1, backgroundColor: colors.grisPerla },
  linea: { color: colors.textoOscuro, marginVertical: 3 },

  idCard: { paddingVertical: 18 },
  idRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  avatarTxt: { color: colors.blanco, fontSize: 26, fontWeight: '900' },
  nombre: { fontSize: 19, fontWeight: '800', color: colors.azulMarino },
  email: { color: colors.grisTexto, fontSize: 13, marginTop: 1 },
  metaLinea: { color: colors.grisTexto, fontSize: 13 },
  progreso: { color: colors.grisTexto, fontSize: 12.5, lineHeight: 18, marginTop: 12 },

  subt: { fontWeight: '800', color: colors.azulMarino, marginTop: 18, marginBottom: 8, fontSize: 15 },
  statsGrid: { flexDirection: 'row', marginHorizontal: -5 },
  stat: {
    flex: 1, backgroundColor: colors.blanco, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8,
    marginHorizontal: 5, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#EEF1F5',
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValor: { fontSize: 16, fontWeight: '900', color: colors.azulMarino },
  statLabel: { fontSize: 11, color: colors.grisTexto, marginTop: 2, fontWeight: '600' },

  histCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  histTit: { fontWeight: '700', color: colors.textoOscuro, flex: 1, marginRight: 8 },
  histMonto: { color: colors.verdeOscuro, fontWeight: '800', fontSize: 13 },
});
