import React, { useState, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import {
  BebasNeue_400Regular,
} from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { configureNotificationHandler } from './src/services/push.service';
import { colors } from './src/theme';

configureNotificationHandler();

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    surface: colors.surface,
    onSurface: colors.white,
    onBackground: colors.white,
  },
  fonts: {
    ...MD3DarkTheme.fonts,
    displayLarge: { fontFamily: 'BebasNeue_400Regular' },
    displayMedium: { fontFamily: 'BebasNeue_400Regular' },
    displaySmall: { fontFamily: 'BebasNeue_400Regular' },
    headlineLarge: { fontFamily: 'Inter_700Bold' },
    headlineMedium: { fontFamily: 'Inter_600SemiBold' },
    headlineSmall: { fontFamily: 'Inter_600SemiBold' },
    titleLarge: { fontFamily: 'Inter_700Bold' },
    titleMedium: { fontFamily: 'Inter_600SemiBold' },
    titleSmall: { fontFamily: 'Inter_600SemiBold' },
    bodyLarge: { fontFamily: 'Inter_400Regular' },
    bodyMedium: { fontFamily: 'Inter_400Regular' },
    bodySmall: { fontFamily: 'Inter_400Regular' },
    labelLarge: { fontFamily: 'Inter_600SemiBold' },
    labelMedium: { fontFamily: 'Inter_600SemiBold' },
    labelSmall: { fontFamily: 'Inter_400Regular' },
  },
};

function LoadingScreen(): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color={colors.gold} />
    </View>
  );
}

export default function App(): React.JSX.Element {
  const [navKey, setNavKey] = useState(0);

  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const resetError = useCallback(() => {
    setNavKey((k) => k + 1);
  }, []);

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary resetError={resetError}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="light" />
          <RootNavigator key={navKey} />
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
