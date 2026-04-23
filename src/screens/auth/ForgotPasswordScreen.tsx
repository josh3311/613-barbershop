import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/types';
import { AuthService } from '@/services/auth.service';

// ─── Theme ────────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  background:      '#0A0A0A',
  surface:         '#1A1A1A',
  surfaceElevated: '#222222',
  gold:            '#D4AF37',
  goldDark:        '#A8861A',
  goldLight:       '#F0CC55',
  error:           '#CF6679',
  success:         '#4CAF50',
  successBg:       '#0D2010',
  textPrimary:     '#FFFFFF',
  textSecondary:   '#AAAAAA',
  textMuted:       '#666666',
  inputBg:         '#252525',
  inputBorder:     '#333333',
  divider:         '#2A2A2A',
} as const;

// ─── Firebase error map ───────────────────────────────────────────────────────

const FB_ERRORS: Record<string, string> = {
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/user-not-found':         'No account found with this email.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/too-many-requests':      'Too many attempts. Please try again later.',
};

function parseFbError(raw: string): string {
  const match = raw.match(/\(([^)]+)\)/);
  if (match) return FB_ERRORS[match[1]] ?? 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordScreen({ navigation }: Props): React.JSX.Element {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [sent, setSent]     = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    setEmailErr(null); setError(null);
    if (!email.trim()) { setEmailErr('Email is required.'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('Please enter a valid email address.'); return false;
    }
    return true;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleReset(): Promise<void> {
    if (!validate()) return;
    setLoading(true);
    const result = await AuthService.sendPasswordReset(email.trim().toLowerCase());
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(parseFbError(result.error));
    }
  }

  // ── Button spring ───────────────────────────────────────────────────────────

  function pressIn():  void { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); }
  function pressOut(): void { Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 4 }).start(); }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Brand ── */}
          <View style={styles.brand} accessibilityRole="header">
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <Text style={styles.logoNum}>613</Text>
              </View>
            </View>
            <Text style={styles.brandName}>613 BARBERSHOP</Text>
            <Text style={styles.brandTag}>Premium grooming experience</Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>
            <View style={styles.cardAccent} />

            {/* Lock icon */}
            <View style={styles.lockBadge} accessibilityElementsHidden>
              <Ionicons name="lock-closed" size={28} color={C.gold} />
            </View>

            <Text style={styles.cardTitle}>Reset Password</Text>
            <Text style={styles.cardSub}>
              Enter your email and we'll send you a link to reset your password.
            </Text>

            {/* ── Success state ── */}
            {sent ? (
              <View style={styles.successBox} accessibilityRole="alert" accessibilityLabel="Reset email sent">
                <Ionicons name="checkmark-circle" size={28} color={C.success} style={styles.successIcon} />
                <View style={styles.successTextWrap}>
                  <Text style={styles.successTitle}>Email Sent!</Text>
                  <Text style={styles.successBody}>
                    Check your inbox at{' '}
                    <Text style={styles.successEmail}>{email.trim().toLowerCase()}</Text>
                    {' '}for a password reset link.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {/* Error banner */}
                {error ? (
                  <View style={styles.errorBanner} accessibilityRole="alert">
                    <Text style={styles.errorBannerText}>{error}</Text>
                  </View>
                ) : null}

                {/* Email field */}
                <View style={styles.fieldWrap}>
                  <TextInput
                    label="Email address"
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      if (emailErr) setEmailErr(null);
                      if (error) setError(null);
                    }}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    returnKeyType="done"
                    onSubmitEditing={handleReset}
                    error={!!emailErr}
                    disabled={loading}
                    left={<TextInput.Icon icon="email-outline" color={emailErr ? C.error : C.textMuted} />}
                    style={styles.input}
                    outlineStyle={styles.outline}
                    contentStyle={styles.inputContent}
                    theme={{
                      colors: {
                        primary: C.gold,
                        onSurfaceVariant: C.textSecondary,
                        background: C.inputBg,
                        error: C.error,
                      },
                    }}
                    accessibilityLabel="Email address input"
                    accessibilityHint="Enter your registered email address"
                  />
                  {emailErr ? (
                    <Text style={styles.fieldErr} accessibilityRole="alert">{emailErr}</Text>
                  ) : null}
                </View>

                {/* Send button */}
                <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
                  <View style={styles.btnGlow} />
                  <TouchableOpacity
                    onPress={handleReset}
                    onPressIn={pressIn}
                    onPressOut={pressOut}
                    disabled={loading}
                    activeOpacity={1}
                    style={[styles.btn, loading && styles.btnLoading]}
                    accessibilityRole="button"
                    accessibilityLabel="Send Reset Link"
                    accessibilityState={{ busy: loading, disabled: loading }}
                  >
                    {loading ? (
                      <View style={styles.btnLoadRow}>
                        <ActivityIndicator size={20} color={C.background} />
                        <Text style={styles.btnLoadText}>Sending…</Text>
                      </View>
                    ) : (
                      <Text style={styles.btnText}>Send Reset Link</Text>
                    )}
                    <View style={styles.btnDepth} />
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {/* Divider */}
            <View style={styles.divRow} importantForAccessibility="no">
              <View style={styles.divLine} />
              <Text style={styles.divLabel}>or</Text>
              <View style={styles.divLine} />
            </View>

            {/* Back to login */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.linkBtn}
              accessibilityRole="button"
              accessibilityLabel="Back to Sign In"
            >
              <Text style={styles.linkText}>
                ‹ {'  '}
                <Text style={styles.linkAccent}>Back to Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Didn't receive the email? Check your spam folder or try again.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_W = Math.min(SCREEN_WIDTH - 32, 440);

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.background },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },

  // Brand
  brand: { alignItems: 'center', marginBottom: 32 },
  logoOuter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 18,
    borderWidth: 1.5, borderColor: C.gold + '55',
  },
  logoInner: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: C.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.gold + '33',
  },
  logoNum:   { fontSize: 20, fontWeight: '900', color: C.gold, letterSpacing: 1 },
  brandName: { fontSize: 22, fontWeight: '900', color: C.textPrimary, letterSpacing: 4, marginBottom: 4 },
  brandTag:  { fontSize: 12, color: C.gold, letterSpacing: 2, fontWeight: '500', textTransform: 'uppercase' },

  // Card
  card: {
    width: CARD_W,
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7, shadowRadius: 24, elevation: 24,
    borderWidth: 1, borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  cardAccent: {
    height: 3, backgroundColor: C.gold,
    marginHorizontal: -24, marginBottom: 24,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },
  lockBadge: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, alignSelf: 'center',
    borderWidth: 1, borderColor: C.gold + '33',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  lockIcon:  { fontSize: 26 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 6, letterSpacing: 0.5, textAlign: 'center' },
  cardSub:   { fontSize: 13, color: C.textSecondary, marginBottom: 22, lineHeight: 18, textAlign: 'center' },

  // Success box
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.successBg,
    borderWidth: 1, borderColor: C.success + '55',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  successIcon: { fontSize: 22, color: C.success, marginTop: 2 },
  successTextWrap: { flex: 1 },
  successTitle: { fontSize: 15, fontWeight: '800', color: C.success, marginBottom: 4 },
  successBody:  { fontSize: 13, color: C.textSecondary, lineHeight: 18 },
  successEmail: { color: C.gold, fontWeight: '700' },

  // Error banner
  errorBanner: {
    backgroundColor: C.error + '1A',
    borderWidth: 1, borderColor: C.error + '55',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 18,
  },
  errorBannerText: { color: C.error, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // Field
  fieldWrap: { marginBottom: 18 },
  input:        { backgroundColor: C.inputBg },
  outline:      { borderRadius: 12, borderColor: C.inputBorder },
  inputContent: { color: C.textPrimary, fontSize: 15 },
  fieldErr:     { fontSize: 12, color: C.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  // Button
  btnWrap: { position: 'relative', marginBottom: 22 },
  btnGlow: {
    position: 'absolute', top: 4, left: 8, right: 8, bottom: -4,
    backgroundColor: C.gold, borderRadius: 14, opacity: 0.22,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  btn: {
    backgroundColor: C.gold, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: C.goldLight + '88',
    shadowColor: C.goldDark, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 10,
    overflow: 'hidden',
  },
  btnLoading:   { opacity: 0.85 },
  btnDepth: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
    backgroundColor: C.goldDark, opacity: 0.55,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
  btnText:    { fontSize: 16, fontWeight: '800', color: C.background, letterSpacing: 1.5, textTransform: 'uppercase' },
  btnLoadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnLoadText:{ fontSize: 15, fontWeight: '700', color: C.background },

  // Divider
  divRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  divLine: { flex: 1, height: 1, backgroundColor: C.divider },
  divLabel:{ color: C.textMuted, fontSize: 13, marginHorizontal: 12, fontWeight: '500' },

  // Link
  linkBtn:   { alignItems: 'center', paddingVertical: 4 },
  linkText:  { fontSize: 14, color: C.textSecondary, textAlign: 'center' },
  linkAccent:{ color: C.gold, fontWeight: '700' },

  // Footer
  footer: {
    fontSize: 11, color: C.textMuted, textAlign: 'center',
    marginTop: 24, letterSpacing: 0.3, lineHeight: 16,
  },
});
