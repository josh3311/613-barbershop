import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { theme } from '../../theme';
import { AuthNavProp } from '../../navigation/types';

interface Props {
  navigation: AuthNavProp;
}

export default function LoginScreen({ navigation }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // RootNavigator handles redirect automatically
    } catch (e: any) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">

        {/* Logo / Title */}
        <View style={styles.header}>
          <Text style={styles.logo}>613</Text>
          <Text style={styles.subtitle}>BARBERSHOP</Text>
          <Text style={styles.tagline}>Premium cuts. Real style.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={theme.colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.colors.textInverse} />
              : <Text style={styles.buttonText}>SIGN IN</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>
              No account?{' '}
              <Text style={styles.registerTextBold}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  logo: {
    fontFamily: theme.fonts.heading,
    fontSize: 96,
    color: theme.colors.gold,
    lineHeight: 96,
  },
  subtitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    color: theme.colors.textPrimary,
    letterSpacing: 8,
  },
  tagline: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    letterSpacing: 2,
  },
  form: {
    width: '100%',
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  label: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    marginBottom: theme.spacing.md,
  },
  button: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.gold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 3,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  registerText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  registerTextBold: {
    fontFamily: theme.fonts.bold,
    color: theme.colors.gold,
  },
});