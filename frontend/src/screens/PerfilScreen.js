import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Tarjeta, Boton, Header, BannerInvitado } from '../components/ui';
import { UsuarioAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

const capit = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header
        titulo="Mi Perfil"
        subtitulo={`Categoría: ${capit(usuario?.categoria)}`}
        onAvisos={() => Alert.alert('Avisos', 'No tenés notificaciones nuevas.')}
      />
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {multa && (
        <Tarjeta style={{ borderColor: colors.rojo, borderWidth: 1 }}>
          <Text style={{ color: colors.rojo, fontWeight: '800' }}>⚠ Tenés una multa activa</Text>
          <Boton title="VER AVISO DE MULTA" variant="secondary"
            onPress={() => navigation.navigate('AvisoMulta', { multa })} />
        </Tarjeta>
      )}

      <Tarjeta>
        <Text style={styles.linea}>Subastas asistidas: {metricas?.subastas_asistidas ?? '-'}</Text>
        <Text style={[styles.linea, { color: colors.verde }]}>Subastas ganadas: {metricas?.subastas_ganadas ?? '-'}</Text>
        <Text style={styles.linea}>Total invertido: ${Number(metricas?.total_invertido || 0).toLocaleString()}</Text>
      </Tarjeta>

      <Text style={styles.subt}>Historial de Pujas</Text>
      {metricas?.historial_pujas?.length
        ? metricas.historial_pujas.map((h, i) => (
            <Tarjeta key={i}><Text>🏆 {h.titulo} - {h.resultado} - ${Number(h.monto).toLocaleString()}</Text></Tarjeta>
          ))
        : <Text style={styles.vacio}>Sin pujas ganadas todavía.</Text>}

      <Boton title="VER MIS PUJAS" variant="dark" onPress={() => navigation.navigate('MisPujas')} />
      <Boton title="SUBASTAR MI ARTÍCULO" onPress={() => navigation.navigate('SubastarArticulo')} />
      <Boton title="MIS ARTÍCULOS" variant="secondary" onPress={() => navigation.navigate('MisArticulos')} />

      <Boton title="Cerrar Sesión" variant="secondary" onPress={confirmarSalir} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.azulMarino },
  container: { flex: 1, backgroundColor: colors.grisPerla },
  head: { marginBottom: 10 },
  nombre: { fontSize: 24, fontWeight: '800', color: colors.azulMarino, marginBottom: 6 },
  linea: { color: colors.textoOscuro, marginVertical: 3 },
  subt: { fontWeight: '800', color: colors.azulMarino, marginTop: 14, marginBottom: 4 },
  vacio: { color: colors.grisTexto, marginVertical: 8 },
});
