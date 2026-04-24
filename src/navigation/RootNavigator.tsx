import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import BarberNavigator from './BarberNavigator';
import AdminNavigator from './AdminNavigator';
import { PushTokenEffect } from '@/components/PushTokenEffect';
import { colors, fonts, spacing } from '@/theme';

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
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Starting up…' : 'Loading your profile…'}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <>
        {isAuthenticated ? <PushTokenEffect /> : null}
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          ) : appUser?.role === 'admin' ? (
            <Stack.Screen name="AdminApp" component={AdminNavigator} />
          ) : appUser?.role === 'barber' ? (
            <Stack.Screen name="BarberApp" component={BarberNavigator} />
          ) : (
            <Stack.Screen name="ClientApp" component={ClientNavigator} />
          )}
        </Stack.Navigator>
      </>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fonts.size.md,
    color: colors.greyDark,
    letterSpacing: fonts.letterSpacing.normal,
  },
});
