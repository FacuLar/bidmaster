import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../theme/colors';

/* Pantalla introductoria con el logo (martillo dorado sobre azul marino). */
export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Login'), 1800);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.martillo}>🔨</Text>
      <Text style={styles.titulo}>BIDMASTER</Text>
      <Text style={styles.subtitulo}>SUBASTAS EXCLUSIVAS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.azulMarino, alignItems: 'center', justifyContent: 'center' },
  martillo: { fontSize: 90, color: colors.dorado },
  titulo: { color: colors.blanco, fontSize: 30, fontWeight: '800', letterSpacing: 2, marginTop: 10 },
  subtitulo: { color: colors.dorado, fontSize: 12, letterSpacing: 3, marginTop: 6 },
});
