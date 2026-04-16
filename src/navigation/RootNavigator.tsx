import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { RootStackParamList } from './types';
import AuthNavigator   from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import BarberNavigator from './BarberNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.JSX.Element {
  const { isLoading, isAuthenticated, appUser, profileLoaded } = useAuth();

  /**
   * Show spinner while:
   *  1. Firebase auth state is resolving (initial cold start), OR
   *  2. The Firestore role fetch hasn't completed yet.
   *
   * profileLoaded becomes true as soon as the fetch resolves (success OR error),
   * so the spinner can never get stuck even if Firestore is unavailable.
   */
  if (isLoading || !profileLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.loadingText}>
          {isLoading ? 'Starting up…' : 'Loading your profile…'}
        </Text>
      </View>
    );
  }

  const isBarberOrAdmin =
    appUser?.role === 'barber' || appUser?.role === 'admin';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth"      component={AuthNavigator} />
        ) : isBarberOrAdmin ? (
          <Stack.Screen name="BarberApp" component={BarberNavigator} />
        ) : (
          <Stack.Screen name="ClientApp" component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    color: '#555555',
    letterSpacing: 0.3,
  },
});
