import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/types';
import { AuthService } from '@/services/auth.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  background: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceElevated: '#222222',
  gold: '#D4AF37',
  goldDark: '#A8861A',
  goldLight: '#F0CC55',
  error: '#CF6679',
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#666666',
  inputBackground: '#252525',
  inputBorder: '#333333',
  inputBorderFocused: '#D4AF37',
  divider: '#2A2A2A',
} as const;

// ─── Firebase error → friendly message map ────────────────────────────────────

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
};

function parseFirebaseError(raw: string): string {
  const match = raw.match(/\(([^)]+)\)/);
  if (match) {
    const code = match[1];
    return FIREBASE_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordRef = useRef<RNTextInput>(null);
  const buttonScale = useRef(new Animated.Value(1)).current;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validateForm(): boolean {
    let valid = true;
    setEmailError(null);
    setPasswordError(null);
    setError(null);

    if (!email.trim()) {
      setEmailError('Email is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }

    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      valid = false;
    }

    return valid;
  }

  // ── Sign In ─────────────────────────────────────────────────────────────────

  async function handleSignIn(): Promise<void> {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    const result = await AuthService.login(email.trim().toLowerCase(), password);

    setLoading(false);

    if (!result.success) {
      setError(parseFirebaseError(result.error));
    }
  }

  // ── Button press animation ──────────────────────────────────────────────────

  function onButtonPressIn(): void {
    Animated.spring(buttonScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  function onButtonPressOut(): void {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Brand Header ── */}
          <View style={styles.headerSection} accessibilityRole="header">
            <View style={styles.logoContainer} accessible accessibilityLabel="613 Barbershop logo">
              <View style={styles.logoOuter}>
                <View style={styles.logoInner}>
                  <Text style={styles.logoNumber}>613</Text>
                </View>
              </View>
            </View>

            <Text style={styles.brandName} accessibilityRole="header">
              613 BARBERSHOP
            </Text>
            <Text style={styles.brandTagline}>Premium grooming experience</Text>
          </View>

          {/* ── Login Card ── */}
          <View style={styles.card} accessibilityRole="none">
            {/* Card top-edge gold accent line */}
            <View style={styles.cardGoldAccent} />

            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            {/* ── Global error banner ── */}
            {error ? (
              <View
                style={styles.errorBanner}
                accessible
                accessibilityRole="alert"
                accessibilityLabel={`Error: ${error}`}
              >
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* ── Email field ── */}
            <View style={styles.inputWrapper}>
              <TextInput
                label="Email address"
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (emailError) setEmailError(null);
                  if (error) setError(null);
                }}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
                error={!!emailError}
                disabled={loading}
                left={
                  <TextInput.Icon
                    icon="email-outline"
                    color={emailError ? COLORS.error : COLORS.textMuted}
                  />
                }
                style={styles.textInput}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    primary: COLORS.gold,
                    onSurfaceVariant: COLORS.textSecondary,
                    background: COLORS.inputBackground,
                    error: COLORS.error,
                  },
                }}
                accessibilityLabel="Email address input"
                accessibilityHint="Enter your registered email address"
              />
              {emailError ? (
                <Text
                  style={styles.fieldError}
                  accessibilityRole="alert"
                  accessibilityLabel={`Email error: ${emailError}`}
                >
                  {emailError}
                </Text>
              ) : null}
            </View>

            {/* ── Password field ── */}
            <View style={styles.inputWrapper}>
              <TextInput
                ref={passwordRef}
                label="Password"
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (passwordError) setPasswordError(null);
                  if (error) setError(null);
                }}
                mode="outlined"
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                error={!!passwordError}
                disabled={loading}
                left={
                  <TextInput.Icon
                    icon="lock-outline"
                    color={passwordError ? COLORS.error : COLORS.textMuted}
                  />
                }
                right={
                  <TextInput.Icon
                    icon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    color={COLORS.textMuted}
                    onPress={() => setPasswordVisible((v) => !v)}
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  />
                }
                style={styles.textInput}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    primary: COLORS.gold,
                    onSurfaceVariant: COLORS.textSecondary,
                    background: COLORS.inputBackground,
                    error: COLORS.error,
                  },
                }}
                accessibilityLabel="Password input"
                accessibilityHint="Enter your account password"
              />
              {passwordError ? (
                <Text
                  style={styles.fieldError}
                  accessibilityRole="alert"
                  accessibilityLabel={`Password error: ${passwordError}`}
                >
                  {passwordError}
                </Text>
              ) : null}
            </View>

            {/* ── Forgot password ── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={loading}
              style={styles.forgotPasswordButton}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              accessibilityHint="Navigate to password reset screen"
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* ── Sign In button ── */}
            <Animated.View style={[styles.signInButtonWrapper, { transform: [{ scale: buttonScale }] }]}>
              {/* Outer glow shadow layer */}
              <View style={styles.buttonGlowLayer} />

              <TouchableOpacity
                onPress={handleSignIn}
                onPressIn={onButtonPressIn}
                onPressOut={onButtonPressOut}
                disabled={loading}
                activeOpacity={1}
                style={[styles.signInButton, loading && styles.signInButtonLoading]}
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                accessibilityHint="Sign in to your 613 Barbershop account"
                accessibilityState={{ busy: loading, disabled: loading }}
              >
                {loading ? (
                  <View style={styles.buttonLoadingContent}>
                    <ActivityIndicator
                      size={20}
                      color={COLORS.background}
                      accessibilityLabel="Signing in, please wait"
                    />
                    <Text style={styles.buttonLoadingText}>Signing In...</Text>
                  </View>
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
                {/* Bottom depth layer */}
                <View style={styles.buttonDepthLayer} />
              </TouchableOpacity>
            </Animated.View>

            {/* ── Divider ── */}
            <View style={styles.dividerRow} accessibilityRole="none" importantForAccessibility="no">
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Register link ── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
              style={styles.registerButton}
              accessibilityRole="button"
              accessibilityLabel="Create a new account"
              accessibilityHint="Navigate to the registration screen"
            >
              <Text style={styles.registerText}>
                Don't have an account?{' '}
                <Text style={styles.registerTextAccent}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <Text style={styles.footerText}>
            By signing in you agree to our Terms &amp; Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 440);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    // Semi-3D: multi-layer shadows
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: COLORS.gold + '55',
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold + '33',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  logoNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 1,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 4,
    marginBottom: 6,
  },
  brandTagline: {
    fontSize: 13,
    color: COLORS.gold,
    letterSpacing: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 28,
    // Semi-3D elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  cardGoldAccent: {
    height: 3,
    backgroundColor: COLORS.gold,
    marginHorizontal: -24,
    marginBottom: 28,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 24,
    letterSpacing: 0.2,
  },

  // ── Error banner ─────────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: COLORS.error + '1A',
    borderWidth: 1,
    borderColor: COLORS.error + '55',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  errorBannerText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  inputWrapper: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: COLORS.inputBackground,
  },
  inputOutline: {
    borderRadius: 12,
    borderColor: COLORS.inputBorder,
  },
  inputContent: {
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  fieldError: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },

  // ── Forgot password ──────────────────────────────────────────────────────────
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    marginBottom: 28,
    marginTop: -4,
  },
  forgotPasswordText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Sign In button ───────────────────────────────────────────────────────────
  signInButtonWrapper: {
    position: 'relative',
    marginBottom: 24,
  },
  buttonGlowLayer: {
    position: 'absolute',
    top: 4,
    left: 8,
    right: 8,
    bottom: -4,
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    opacity: 0.25,
    // Blur simulation via elevation
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 0,
  },
  signInButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    // Semi-3D top highlight
    borderTopWidth: 1,
    borderTopColor: COLORS.goldLight + '88',
    // Deep shadow
    shadowColor: COLORS.goldDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  signInButtonLoading: {
    opacity: 0.85,
  },
  buttonDepthLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.goldDark,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.background,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  buttonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonLoadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.5,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
    fontWeight: '500',
  },

  // ── Register link ─────────────────────────────────────────────────────────────
  registerButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  registerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  registerTextAccent: {
    color: COLORS.gold,
    fontWeight: '700',
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 28,
    letterSpacing: 0.3,
    lineHeight: 16,
  },
});
