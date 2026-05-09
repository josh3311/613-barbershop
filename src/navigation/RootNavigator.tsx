import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

// Placeholder screens — we'll replace these one by one
import AuthNavigator   from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import BarberNavigator from './BarberNavigator';
import AdminNavigator  from './AdminNavigator';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading, profileLoaded } = useAuth();

  // Show spinner while Firebase loads
  if (loading || !profileLoaded) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ActivityIndicator color={theme.colors.gold} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Not logged in → Auth screens
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : user.role === 'barber' ? (
          <Stack.Screen name="Barber" component={BarberNavigator} />
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : (
          // Default → Client
          <Stack.Screen name="Client" component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}