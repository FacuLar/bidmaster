import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import colors from '../theme/colors';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegistroScreen from '../screens/RegistroScreen';
import CompletarRegistroScreen from '../screens/CompletarRegistroScreen';
import ValidarCuentaScreen from '../screens/ValidarCuentaScreen';
import RecuperarPasswordScreen from '../screens/RecuperarPasswordScreen';

import HomeScreen from '../screens/HomeScreen';
import HistoriaObjetoScreen from '../screens/HistoriaObjetoScreen';
import SubastaEnVivoScreen from '../screens/SubastaEnVivoScreen';
import SubastaGanadaScreen from '../screens/SubastaGanadaScreen';

import BilleteraScreen from '../screens/BilleteraScreen';
import PerfilScreen from '../screens/PerfilScreen';
import MisPujasScreen from '../screens/MisPujasScreen';
import AvisoMultaScreen from '../screens/AvisoMultaScreen';
import SubastarArticuloScreen from '../screens/SubastarArticuloScreen';
import UbicacionSeguroScreen from '../screens/UbicacionSeguroScreen';
import MisArticulosScreen from '../screens/MisArticulosScreen';
import FacturaFleteScreen from '../screens/FacturaFleteScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Ícono de tab con Ionicons (relleno cuando está activo, contorno si no).
const tabIcon = (base) => ({ focused, color, size }) => (
  <Ionicons name={focused ? base : `${base}-outline`} size={size ?? 23} color={color} />
);

/* Tabs principales una vez logueado: Catálogo, Billetera, Perfil. */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // cada pantalla renderiza su propio header navy (ver components/ui Header)
        tabBarActiveTintColor: colors.naranja,
        tabBarInactiveTintColor: colors.grisTexto,
      }}
    >
      <Tab.Screen name="Catálogo" component={HomeScreen}
        options={{ tabBarIcon: tabIcon('hammer') }} />
      <Tab.Screen name="Billetera" component={BilleteraScreen}
        options={{ tabBarIcon: tabIcon('wallet') }} />
      <Tab.Screen name="Perfil" component={PerfilScreen}
        options={{ tabBarIcon: tabIcon('person') }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { usuario, invitado, cargando } = useAuth();
  if (cargando) return null;
  const dentro = usuario || invitado; // sesión completa O invitado (no validado)

  // Discriminador de sesión: al cambiar (anónimo → invitado → usuario), fuerza el
  // re-montaje del stack para que arranque en su pantalla inicial. Esto evita
  // quedar "atrapado" en Completar Registro después de activar la cuenta.
  const sesionKey = usuario ? 'auth' : invitado ? 'guest' : 'anon';

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={sesionKey}
        screenOptions={{
          headerStyle: { backgroundColor: colors.azulMarino },
          headerTintColor: colors.blanco,
        }}
      >
        {!dentro ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Registro" component={RegistroScreen} options={{ title: 'Creá tu cuenta' }} />
            <Stack.Screen name="ValidarCuenta" component={ValidarCuentaScreen} options={{ title: 'Validar mi cuenta' }} />
            <Stack.Screen name="CompletarRegistro" component={CompletarRegistroScreen} options={{ title: 'Completar Registro' }} />
            <Stack.Screen name="RecuperarPassword" component={RecuperarPasswordScreen} options={{ title: 'Recuperar contraseña' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            {/* Accesible para el invitado: generar la clave y validar la cuenta. */}
            <Stack.Screen name="CompletarRegistro" component={CompletarRegistroScreen} options={{ title: 'Validar mi cuenta' }} />
            <Stack.Screen name="HistoriaObjeto" component={HistoriaObjetoScreen} options={{ title: 'Historia del Objeto' }} />
            <Stack.Screen name="SubastaEnVivo" component={SubastaEnVivoScreen} options={{ title: 'EN VIVO' }} />
            <Stack.Screen name="SubastaGanada" component={SubastaGanadaScreen} options={{ title: 'Subasta Ganada' }} />
            <Stack.Screen name="MisPujas" component={MisPujasScreen} options={{ title: 'Mis Pujas' }} />
            <Stack.Screen name="AvisoMulta" component={AvisoMultaScreen} options={{ title: 'Aviso de Multa' }} />
            <Stack.Screen name="SubastarArticulo" component={SubastarArticuloScreen} options={{ title: 'Subastar mi artículo' }} />
            <Stack.Screen name="UbicacionSeguro" component={UbicacionSeguroScreen} options={{ title: 'Ubicación y Seguro' }} />
            <Stack.Screen name="MisArticulos" component={MisArticulosScreen} options={{ title: 'Mis Artículos' }} />
            <Stack.Screen name="FacturaFlete" component={FacturaFleteScreen} options={{ title: 'Factura de Flete' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
