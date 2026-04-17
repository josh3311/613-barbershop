import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, PaperProvider } from 'react-native-paper';
import RootNavigator from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { configureNotificationHandler } from './src/services/push.service';

configureNotificationHandler();

const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#D4AF37',
    background: '#0A0A0A',
    surface: '#1A1A1A',
    onSurface: '#FFFFFF',
    onBackground: '#FFFFFF',
  },
};

export default function App(): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <StatusBar style="light" />
          <RootNavigator />
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
