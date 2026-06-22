import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Boton, Campo, Tarjeta } from '../components/ui';
import { AuthAPI } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

/* Etapa 2: el usuario (invitado) espera la aprobación de la verificación externa
   y recién entonces genera su clave personal, validándola con el código que le
   llegó por mail al habilitarse la cuenta. NO se aprueba al instante. */
export default function CompletarRegistroScreen({ route }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => crearStyles(colors), [colors]);
  const { guardarSesion, invitado } = useAuth();
  // Datos de la solicitud: se capturan UNA vez al montar. Si se derivaran en vivo
  // de `invitado`, al activar la cuenta (que limpia el invitado) quedarían vacíos
  // y aparecería "No encontramos tu solicitud" antes de redirigir.
  const [id_solicitud] = useState(() => route.params?.id_solicitud || invitado?.id_solicitud);
  const [email] = useState(() => route.params?.email || invitado?.email);

  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoMail, setCodigoMail] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState('pendiente'); // pendiente | aprobada | rechazada
  const [categoria, setCategoria] = useState(null);
  const timer = useRef(null);

  // Consulta el estado de la verificación hasta que un administrador apruebe/rechace.
  useEffect(() => {
    let activo = true;
    async function consultar() {
      try {
        const r = await AuthAPI.estadoSolicitud(id_solicitud);
        if (!activo) return;
        setEstado(r.estado);
        setCategoria(r.categoria_asignada);
        // El "mail" se simula en la app: al aprobar, mostramos y precargamos el código.
        if (r.estado === 'aprobada' && r.codigo_validacion) {
          setCodigoMail(r.codigo_validacion);
          setCodigo((c) => c || String(r.codigo_validacion));
        }
        if (r.estado === 'pendiente') {
          timer.current = setTimeout(consultar, 4000);
        }
      } catch (e) {
        if (activo) timer.current = setTimeout(consultar, 5000);
      }
    }
    if (id_solicitud) consultar();
    return () => { activo = false; if (timer.current) clearTimeout(timer.current); };
  }, [id_solicitud]);

  async function activar() {
    if (!codigo) { Alert.alert('Falta el código', 'Ingresá el código que te llegó por mail.'); return; }
    if (password.length < 6) {
      Alert.alert('Clave débil', 'La clave debe tener al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    try {
      const data = await AuthAPI.registroEtapa2(id_solicitud, email, password, codigo);
      await guardarSesion({
        token: data.token,
        id_usuario: data.id_usuario,
        categoria: data.categoria,
        nombre: email.split('@')[0],
      });
    } catch (e) {
      Alert.alert('No se pudo activar', e.message);
    } finally {
      setCargando(false);
    }
  }

  if (!id_solicitud) {
    return (
      <View style={styles.container}>
        <Text style={styles.rechazo}>No encontramos tu solicitud. Volvé a registrarte.</Text>
      </View>
    );
  }

  if (estado === 'rechazada') {
    return (
      <View style={styles.container}>
        <Text style={styles.rechazo}>Tu solicitud fue rechazada por la verificación externa.</Text>
      </View>
    );
  }

  // Mientras la empresa verifica, no se puede generar la clave todavía.
  if (estado !== 'aprobada') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.naranja} />
        <Text style={styles.verificando}>Verificando tus datos…</Text>
        <Text style={styles.subtexto}>
          Estamos revisando tu documentación y antecedentes. Te vamos a enviar un
          mail con tu código de validación cuando tu cuenta sea habilitada.
        </Text>
        <Text style={styles.subtexto}>Podés seguir mirando las subastas como invitado mientras tanto.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Tarjeta style={{ borderColor: colors.verde, borderWidth: 1, marginBottom: 16 }}>
        <Text style={styles.mailTit}>✉️ Tu cuenta fue habilitada</Text>
        <Text style={styles.mailTxt}>
          Tu código de validación (simula el mail). Confirmalo abajo y generá tu clave personal.
        </Text>
        {codigoMail ? (
          <View style={styles.codigoBox}>
            <Text style={styles.codigoLbl}>Código</Text>
            <Text style={styles.codigoVal}>{codigoMail}</Text>
          </View>
        ) : null}
      </Tarjeta>

      <Text style={styles.ok}>Generá tu clave personal para terminar.</Text>
      {categoria ? <Text style={styles.cat}>Categoría asignada: {categoria.toUpperCase()}</Text> : null}
      <Campo label="Email Validado" value={email} editable={false} />
      <Campo label="Código de validación (del mail)" keyboardType="numeric"
        value={codigo} onChangeText={setCodigo} placeholder="6 dígitos" />
      <Campo label="Nueva Clave Personal" secureTextEntry value={password}
        onChangeText={setPassword} placeholder="••••••" />
      <Boton title="ACTIVAR CUENTA" onPress={activar} loading={cargando} />
    </View>
  );
}

const crearStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.grisPerla, padding: 22, justifyContent: 'center' },
  ok: { color: colors.verde, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  cat: { color: colors.azulMarino, fontWeight: '700', marginBottom: 18, textAlign: 'center' },
  verificando: { color: colors.azulMarino, fontWeight: '700', fontSize: 16, marginTop: 16, textAlign: 'center' },
  subtexto: { color: colors.grisTexto, fontSize: 13, marginTop: 8, textAlign: 'center' },
  rechazo: { color: colors.naranja, fontWeight: '700', textAlign: 'center', fontSize: 15 },
  mailTit: { color: colors.verde, fontWeight: '800', fontSize: 15, marginBottom: 4 },
  mailTxt: { color: colors.textoOscuro, fontSize: 13 },
  codigoBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.verdeSuave, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10,
  },
  codigoLbl: { color: colors.verdeOscuro, fontSize: 12, fontWeight: '600' },
  codigoVal: { color: colors.verdeOscuro, fontSize: 22, fontWeight: '900', letterSpacing: 4 },
});
