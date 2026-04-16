import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
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
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={s.root}>
        <View style={s.iconWrap}>
          <Text style={s.iconText}>⚠</Text>
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
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A0A0A',
    borderWidth: 2,
    borderColor: '#CF667944',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
    color: '#CF6679',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  detailBox: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 14,
    maxHeight: 120,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#222222',
  },
  detail: {
    fontSize: 11,
    color: '#CF6679',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#D4AF37',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    shadowColor: '#A8861A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: 1,
  },
});
