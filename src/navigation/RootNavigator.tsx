import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import AuthNavigator         from './AuthNavigator';
import ClientNavigator       from './ClientNavigator';
import BarberNavigator       from './BarberNavigator';
import AdminNavigator        from './AdminNavigator';
import RoleSelectScreen      from '../screens/auth/RoleSelectScreen';
import PendingApprovalScreen from '../screens/auth/PendingApprovalScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, loading, profileLoaded } = useAuth();

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
          <Stack.Screen name="Auth"             component={AuthNavigator} />
        ) : !user.role ? (
          <Stack.Screen name="RoleSelect"       component={RoleSelectScreen} />
        ) : user.role === 'barber' && user.status !== 'active' ? (
          <Stack.Screen name="PendingApproval"  component={PendingApprovalScreen} />
        ) : user.role === 'barber' ? (
          <Stack.Screen name="Barber"           component={BarberNavigator} />
        ) : user.role === 'admin' ? (
          <Stack.Screen name="Admin"            component={AdminNavigator} />
        ) : (
          <Stack.Screen name="Client"           component={ClientNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}