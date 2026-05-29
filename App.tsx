import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator   from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ui';

// GestureHandlerRootView MUST wrap the entire app for Reanimated 4 +
// React Navigation native-stack to work on Android. Without it the
// new-architecture screen container silently produces a white view.
//
// ErrorBoundary sits inside the gesture root so render-time exceptions
// in providers / navigator surface as readable text instead of a
// permanent blank screen.

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
