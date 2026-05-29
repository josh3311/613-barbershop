/**
 * ErrorBoundary
 *
 * Wraps the root of the app so a render-time exception surfaces as a
 * readable screen instead of a permanent white view. Without this an
 * uncaught error during the first render (auth context, navigator,
 * a missing native module, etc.) just leaves the user staring at a
 * blank window with no logcat clue.
 *
 * Class component because `componentDidCatch` has no hook equivalent.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { theme } from '../../theme';

interface Props { children: React.ReactNode; }
interface State {
  error:     Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to native console so it shows up in `npx react-native log-android`
    // and Expo's dev tools.
    console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ error: null, errorInfo: null });
  };

  render() {
    const { error, errorInfo } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>STARTUP CRASH</Text>
          <Text style={styles.title}>{error.name}</Text>
          <Text style={styles.message}>{error.message}</Text>

          {error.stack ? (
            <>
              <Text style={styles.sectionLabel}>STACK</Text>
              <Text style={styles.stack} selectable>
                {error.stack}
              </Text>
            </>
          ) : null}

          {errorInfo?.componentStack ? (
            <>
              <Text style={styles.sectionLabel}>COMPONENT TREE</Text>
              <Text style={styles.stack} selectable>
                {errorInfo.componentStack}
              </Text>
            </>
          ) : null}

          <Pressable style={styles.retryBtn} onPress={this.handleReset}>
            <Text style={styles.retryText}>TRY AGAIN</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: theme.colors.background,
    paddingTop:      48,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap:     theme.spacing.md,
  },
  label: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.error,
    letterSpacing: 4,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xxl,
    color:      theme.colors.textPrimary,
    letterSpacing: 2,
  },
  message: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 3,
    marginTop:     theme.spacing.md,
  },
  stack: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    borderWidth:   1,
    borderColor:   theme.colors.border,
    borderRadius:  theme.radius.sm,
    padding:       theme.spacing.md,
    lineHeight:    16,
  },
  retryBtn: {
    backgroundColor: theme.colors.gold,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.md,
    alignItems:      'center',
    marginTop:       theme.spacing.lg,
  },
  retryText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
});
