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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/types';
import { AuthService } from '@/services/auth.service';
import { colors, fonts, spacing, radius, icons } from '@/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 440);

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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

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
                    icon={() => <Ionicons name={icons.mail} size={20} color={emailError ? colors.red : colors.greyDark} />}
                  />
                }
                style={styles.textInput}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    primary: colors.gold,
                    onSurfaceVariant: colors.grey,
                    background: colors.surface,
                    error: colors.red,
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
                    icon={() => <Ionicons name={icons.lock} size={20} color={passwordError ? colors.red : colors.greyDark} />}
                  />
                }
                right={
                  <TextInput.Icon
                    icon={() => (
                      <Ionicons
                        name={passwordVisible ? icons.close : 'eye-outline'}
                        size={20}
                        color={colors.greyDark}
                        onPress={() => setPasswordVisible((v) => !v)}
                      />
                    )}
                    onPress={() => setPasswordVisible((v) => !v)}
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  />
                }
                style={styles.textInput}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                theme={{
                  colors: {
                    primary: colors.gold,
                    onSurfaceVariant: colors.grey,
                    background: colors.surface,
                    error: colors.red,
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
                      color={colors.background}
                      accessibilityLabel="Signing in, please wait"
                    />
                    <Text style={styles.buttonLoadingText}>Signing In...</Text>
                  </View>
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: colors.gold + '55',
  },
  logoInner: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold + '33',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  logoNumber: {
    fontSize: 22,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
    letterSpacing: 1,
  },
  brandName: {
    fontSize: 26,
    fontFamily: fonts.heading,
    color: colors.white,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  brandTagline: {
    fontSize: 13,
    color: colors.gold,
    letterSpacing: 2,
    fontFamily: fonts.bodySemiBold,
    textTransform: 'uppercase',
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing['2xl'],
    paddingTop: 0,
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardGoldAccent: {
    height: 3,
    backgroundColor: colors.gold,
    marginHorizontal: -spacing['2xl'],
    marginBottom: spacing.xl,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: fonts.size['3xl'],
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: fonts.size.md,
    color: colors.grey,
    marginBottom: spacing.xl,
    letterSpacing: 0.2,
  },

  // ── Error banner ─────────────────────────────────────────────────────────────
  errorBanner: {
    backgroundColor: colors.red + '1A',
    borderWidth: 1,
    borderColor: colors.red + '55',
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  errorBannerText: {
    color: colors.red,
    fontSize: fonts.size.md,
    fontFamily: fonts.bodySemiBold,
    lineHeight: 18,
  },

  // ── Inputs ───────────────────────────────────────────────────────────────────
  inputWrapper: {
    marginBottom: spacing.md,
  },
  textInput: {
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: radius.sm,
    borderColor: colors.border,
  },
  inputContent: {
    color: colors.white,
    fontSize: fonts.size.md,
  },
  fieldError: {
    fontSize: fonts.size.sm,
    color: colors.red,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Forgot password ──────────────────────────────────────────────────────────
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xl,
    marginTop: -spacing.xs,
  },
  forgotPasswordText: {
    color: colors.gold,
    fontSize: fonts.size.md,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: 0.2,
  },

  // ── Sign In button ───────────────────────────────────────────────────────────
  signInButtonWrapper: {
    position: 'relative',
    marginBottom: spacing.lg,
  },
  signInButton: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  signInButtonLoading: {
    opacity: 0.85,
  },
  signInButtonText: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  buttonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonLoadingText: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: 0.5,
  },

  // ── Divider ──────────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.greyDark,
    fontSize: fonts.size.md,
    marginHorizontal: spacing.md,
    fontFamily: fonts.bodySemiBold,
  },

  // ── Register link ─────────────────────────────────────────────────────────────
  registerButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  registerText: {
    fontSize: fonts.size.md,
    color: colors.grey,
    textAlign: 'center',
  },
  registerTextAccent: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
  },

  // ── Footer ───────────────────────────────────────────────────────────────────
  footerText: {
    fontSize: fonts.size.sm,
    color: colors.greyDark,
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 0.3,
    lineHeight: 16,
  },
});
