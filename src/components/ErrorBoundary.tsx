import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, icons } from '@/theme';

interface Props {
  children: React.ReactNode;
  /** Called after Try Again clears the error and remounts children (e.g. bump parent state). */
  resetError?: () => void;
}

interface State {
  hasError: boolean;
  error: string | null;
  /** Incremented on retry so children remount with fresh state. */
  resetKey: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // In production, send to crash reporting (e.g. Sentry, Crashlytics)
    // For now, log to console in dev only
    if (__DEV__) {
      console.error('[ErrorBoundary]', error.message, info.componentStack);
    }
  }

  handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1,
    }));
    this.props.resetError?.();
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return (
        <React.Fragment key={this.state.resetKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    return (
      <View style={s.root}>
        <View style={s.iconWrap}>
          <Ionicons
            name={icons.warning}
            size={36}
            color={colors.red}
          />
        </View>

        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.subtitle}>
          An unexpected error occurred. Please try again.
        </Text>

        {__DEV__ && this.state.error ? (
          <ScrollView style={s.detailBox} showsVerticalScrollIndicator={false}>
            <Text style={s.detail}>{this.state.error}</Text>
          </ScrollView>
        ) : null}

        <TouchableOpacity
          style={s.retryBtn}
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={s.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fonts.size.md,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    marginBottom: spacing.xl,
  },
  detailBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    maxHeight: 120,
    width: '100%',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detail: {
    fontSize: fonts.size.sm,
    color: colors.red,
    fontFamily: 'monospace',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
  },
  retryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['3xl'],
    shadowColor: colors.goldDim,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  retryText: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.wide,
  },
});
