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
import { colors, fonts, spacing, radius, icons } from '@/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 440);

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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

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
              <Ionicons name="lock-closed" size={28} color={colors.gold} />
            </View>

            <Text style={styles.cardTitle}>Reset Password</Text>
            <Text style={styles.cardSub}>
              Enter your email and we'll send you a link to reset your password.
            </Text>

            {/* ── Success state ── */}
            {sent ? (
              <View style={styles.successBox} accessibilityRole="alert" accessibilityLabel="Reset email sent">
                <Ionicons name={icons.check} size={28} color={colors.green} style={styles.successIcon} />
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
                    left={<TextInput.Icon icon={() => <Ionicons name={icons.mail} size={20} color={emailErr ? colors.red : colors.greyDark} />} />}
                    style={styles.input}
                    outlineStyle={styles.outline}
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
                  {emailErr ? (
                    <Text style={styles.fieldErr} accessibilityRole="alert">{emailErr}</Text>
                  ) : null}
                </View>

                {/* Send button */}
                <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
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
                        <ActivityIndicator size={20} color={colors.background} />
                        <Text style={styles.btnLoadText}>Sending...</Text>
                      </View>
                    ) : (
                      <Text style={styles.btnText}>Send Reset Link</Text>
                    )}
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
              <View style={styles.backLinkRow}>
                <Ionicons name={icons.back} size={16} color={colors.gold} />
                <View style={styles.backLinkGap} />
                <Text style={styles.linkAccent}>Back to Sign In</Text>
              </View>
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

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.background },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.lg,
  },

  // Brand
  brand: { alignItems: 'center', marginBottom: spacing['3xl'] },
  logoOuter: {
    width: 80, height: 80, borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 18,
    borderWidth: 1.5, borderColor: colors.gold + '55',
  },
  logoInner: {
    width: 62, height: 62, borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.gold + '33',
  },
  logoNum:   { fontSize: 20, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: 1 },
  brandName: { fontSize: 22, fontFamily: fonts.heading, color: colors.white, letterSpacing: 4, marginBottom: spacing.xs },
  brandTag:  { fontSize: 12, color: colors.gold, letterSpacing: 2, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase' },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing['2xl'],
    paddingTop: 0,
    paddingBottom: spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7, shadowRadius: 24, elevation: 24,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  cardAccent: {
    height: 3, backgroundColor: colors.gold,
    marginHorizontal: -spacing['2xl'], marginBottom: spacing.xl,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },
  lockBadge: {
    width: 56, height: 56, borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg, alignSelf: 'center',
    borderWidth: 1, borderColor: colors.gold + '33',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cardTitle: { fontSize: fonts.size['2xl'], fontFamily: fonts.bodyBold, color: colors.white, marginBottom: spacing.sm, letterSpacing: 0.5, textAlign: 'center' },
  cardSub:   { fontSize: fonts.size.md, color: colors.grey, marginBottom: spacing.lg, lineHeight: 18, textAlign: 'center' },

  // Success box
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.green + '15',
    borderWidth: 1, borderColor: colors.green + '55',
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: 14,
    marginBottom: spacing.lg,
  },
  successIcon: { fontSize: 22, color: colors.green, marginTop: 2 },
  successTextWrap: { flex: 1 },
  successTitle: { fontSize: fonts.size.lg, fontFamily: fonts.bodyBold, color: colors.green, marginBottom: spacing.xs },
  successBody:  { fontSize: fonts.size.md, color: colors.grey, lineHeight: 18 },
  successEmail: { color: colors.gold, fontFamily: fonts.bodyBold },

  // Error banner
  errorBanner: {
    backgroundColor: colors.red + '1A',
    borderWidth: 1, borderColor: colors.red + '55',
    borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  errorBannerText: { color: colors.red, fontSize: fonts.size.md, fontFamily: fonts.bodySemiBold, lineHeight: 18 },

  // Field
  fieldWrap: { marginBottom: spacing.lg },
  input:        { backgroundColor: colors.surface },
  outline:      { borderRadius: radius.sm, borderColor: colors.border },
  inputContent: { color: colors.white, fontSize: fonts.size.md },
  fieldErr:     { fontSize: fonts.size.sm, color: colors.red, marginTop: spacing.xs, marginLeft: spacing.xs, fontFamily: fonts.bodySemiBold },

  // Button
  btnWrap: { position: 'relative', marginBottom: spacing.lg },
  btn: {
    backgroundColor: colors.gold, borderRadius: radius['2xl'], height: 54,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  btnLoading:   { opacity: 0.85 },
  btnText:    { fontSize: fonts.size.lg, fontFamily: fonts.bodyBold, color: colors.background, letterSpacing: 1.5, textTransform: 'uppercase' },
  btnLoadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnLoadText:{ fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.background },

  // Divider
  divRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divLabel:{ color: colors.greyDark, fontSize: fonts.size.md, marginHorizontal: spacing.md, fontFamily: fonts.bodySemiBold },

  // Link
  linkBtn:   { alignItems: 'center', paddingVertical: spacing.xs },
  backLinkRow: { flexDirection: 'row', alignItems: 'center' },
  backLinkGap: { width: spacing.sm },
  linkAccent:{ color: colors.gold, fontFamily: fonts.bodyBold },

  // Footer
  footer: {
    fontSize: fonts.size.sm, color: colors.greyDark, textAlign: 'center',
    marginTop: spacing.xl, letterSpacing: 0.3, lineHeight: 16,
  },
});
