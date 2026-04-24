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

// ─── Firebase error map ───────────────────────────────────────────────────────

const FB_ERRORS: Record<string, string> = {
  'auth/email-already-in-use':    'An account with this email already exists.',
  'auth/invalid-email':           'Please enter a valid email address.',
  'auth/weak-password':           'Password must be at least 6 characters.',
  'auth/network-request-failed':  'Network error. Check your connection.',
  'auth/too-many-requests':       'Too many attempts. Please try again later.',
};

function parseFbError(raw: string): string {
  const match = raw.match(/\(([^)]+)\)/);
  if (match) return FB_ERRORS[match[1]] ?? 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [nameErr, setNameErr]         = useState<string | null>(null);
  const [emailErr, setEmailErr]       = useState<string | null>(null);
  const [pwdErr, setPwdErr]           = useState<string | null>(null);
  const [confirmErr, setConfirmErr]   = useState<string | null>(null);

  const emailRef   = useRef<RNTextInput>(null);
  const pwdRef     = useRef<RNTextInput>(null);
  const confirmRef = useRef<RNTextInput>(null);
  const btnScale   = useRef(new Animated.Value(1)).current;

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): boolean {
    let ok = true;
    setNameErr(null); setEmailErr(null); setPwdErr(null); setConfirmErr(null); setError(null);

    if (!name.trim()) {
      setNameErr('Full name is required.'); ok = false;
    }
    if (!email.trim()) {
      setEmailErr('Email is required.'); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('Please enter a valid email address.'); ok = false;
    }
    if (!password) {
      setPwdErr('Password is required.'); ok = false;
    } else if (password.length < 6) {
      setPwdErr('Password must be at least 6 characters.'); ok = false;
    }
    if (!confirm) {
      setConfirmErr('Please confirm your password.'); ok = false;
    } else if (confirm !== password) {
      setConfirmErr('Passwords do not match.'); ok = false;
    }
    return ok;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleRegister(): Promise<void> {
    if (!validate()) return;
    setLoading(true);
    const result = await AuthService.register(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(parseFbError(result.error));
    }
  }

  // ── Button spring ───────────────────────────────────────────────────────────

  function pressIn():  void { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start(); }
  function pressOut(): void { Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 4 }).start(); }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function clearErr(): void { if (error) setError(null); }

  const FIELD_THEME = {
    colors: {
      primary: colors.gold,
      onSurfaceVariant: colors.grey,
      background: colors.surface,
      error: colors.red,
    },
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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

            <Text style={styles.cardTitle}>Create Account</Text>
            <Text style={styles.cardSub}>Join the 613 community</Text>

            {/* Success banner */}
            {success ? (
              <View
                style={styles.successBox}
                accessibilityRole="alert"
                accessibilityLabel="Account created successfully"
              >
                <View style={styles.successIconWrap}>
                  <Ionicons name={icons.check} size={20} color={colors.green} />
                </View>
                <View style={styles.successTextWrap}>
                  <Text style={styles.successTitle}>Account Created!</Text>
                  <Text style={styles.successBody}>
                    Welcome to 613 Barbershop,{' '}
                    <Text style={styles.successName}>{name.trim()}</Text>!
                    {'\n'}Taking you in now...
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Error banner */}
            {error ? (
              <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLabel={error}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}

            {/* Full name */}
            <View style={styles.fieldWrap}>
              <TextInput
                label="Full name"
                value={name}
                onChangeText={(v) => { setName(v); if (nameErr) setNameErr(null); clearErr(); }}
                mode="outlined"
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                blurOnSubmit={false}
                error={!!nameErr}
                disabled={loading}
                left={<TextInput.Icon icon={() => <Ionicons name={icons.person} size={20} color={nameErr ? colors.red : colors.greyDark} />} />}
                style={styles.input}
                outlineStyle={styles.outline}
                contentStyle={styles.inputContent}
                theme={FIELD_THEME}
                accessibilityLabel="Full name input"
              />
              {nameErr ? <Text style={styles.fieldErr} accessibilityRole="alert">{nameErr}</Text> : null}
            </View>

            {/* Email */}
            <View style={styles.fieldWrap}>
              <TextInput
                ref={emailRef}
                label="Email address"
                value={email}
                onChangeText={(v) => { setEmail(v); if (emailErr) setEmailErr(null); clearErr(); }}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => pwdRef.current?.focus()}
                blurOnSubmit={false}
                error={!!emailErr}
                disabled={loading}
                left={<TextInput.Icon icon={() => <Ionicons name={icons.mail} size={20} color={emailErr ? colors.red : colors.greyDark} />} />}
                style={styles.input}
                outlineStyle={styles.outline}
                contentStyle={styles.inputContent}
                theme={FIELD_THEME}
                accessibilityLabel="Email address input"
              />
              {emailErr ? <Text style={styles.fieldErr} accessibilityRole="alert">{emailErr}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldWrap}>
              <TextInput
                ref={pwdRef}
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); if (pwdErr) setPwdErr(null); clearErr(); }}
                mode="outlined"
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
                error={!!pwdErr}
                disabled={loading}
                left={<TextInput.Icon icon={() => <Ionicons name={icons.lock} size={20} color={pwdErr ? colors.red : colors.greyDark} />} />}
                right={<TextInput.Icon icon={() => <Ionicons name={showPwd ? icons.close : 'eye-outline'} size={20} color={colors.greyDark} />} onPress={() => setShowPwd(v => !v)} accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} />}
                style={styles.input}
                outlineStyle={styles.outline}
                contentStyle={styles.inputContent}
                theme={FIELD_THEME}
                accessibilityLabel="Password input"
              />
              {pwdErr ? <Text style={styles.fieldErr} accessibilityRole="alert">{pwdErr}</Text> : null}
            </View>

            {/* Confirm password */}
            <View style={styles.fieldWrap}>
              <TextInput
                ref={confirmRef}
                label="Confirm password"
                value={confirm}
                onChangeText={(v) => { setConfirm(v); if (confirmErr) setConfirmErr(null); clearErr(); }}
                mode="outlined"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
                error={!!confirmErr}
                disabled={loading}
                left={<TextInput.Icon icon={() => <Ionicons name={icons.lock} size={20} color={confirmErr ? colors.red : colors.greyDark} />} />}
                right={<TextInput.Icon icon={() => <Ionicons name={showConfirm ? icons.close : 'eye-outline'} size={20} color={colors.greyDark} />} onPress={() => setShowConfirm(v => !v)} accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'} />}
                style={styles.input}
                outlineStyle={styles.outline}
                contentStyle={styles.inputContent}
                theme={FIELD_THEME}
                accessibilityLabel="Confirm password input"
              />
              {confirmErr ? <Text style={styles.fieldErr} accessibilityRole="alert">{confirmErr}</Text> : null}
            </View>

            {/* Register button */}
            <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
              <TouchableOpacity
                onPress={handleRegister}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={loading}
                activeOpacity={1}
                style={[styles.btn, loading && styles.btnLoading]}
                accessibilityRole="button"
                accessibilityLabel="Create Account"
                accessibilityState={{ busy: loading, disabled: loading }}
              >
                {loading ? (
                  <View style={styles.btnLoadRow}>
                    <ActivityIndicator size={20} color={colors.background} />
                    <Text style={styles.btnLoadText}>Creating Account...</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.divRow} importantForAccessibility="no">
              <View style={styles.divLine} />
              <Text style={styles.divLabel}>or</Text>
              <View style={styles.divLine} />
            </View>

            {/* Sign in link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
              style={styles.linkBtn}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign In"
            >
              <Text style={styles.linkText}>
                Already have an account?{' '}
                <Text style={styles.linkAccent}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            By creating an account you agree to our Terms &amp; Privacy Policy
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
  cardTitle: { fontSize: fonts.size['2xl'], fontFamily: fonts.bodyBold, color: colors.white, marginBottom: spacing.xs, letterSpacing: 0.5 },
  cardSub:   { fontSize: fonts.size.md, color: colors.grey, marginBottom: spacing.lg },

  // Success box
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.green + '15',
    borderWidth: 1,
    borderColor: colors.green + '55',
    borderRadius: radius.sm,
    padding: spacing.lg,
    gap: 14,
    marginBottom: spacing.lg,
  },
  successIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.green + '22',
    borderWidth: 1,
    borderColor: colors.green + '66',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successTextWrap: { flex: 1 },
  successTitle: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.green,
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
  },
  successBody: {
    fontSize: fonts.size.md,
    color: colors.grey,
    lineHeight: 18,
  },
  successName: {
    color: colors.gold,
    fontFamily: fonts.bodyBold,
  },

  // Error banner
  errorBanner: {
    backgroundColor: colors.red + '1A',
    borderWidth: 1, borderColor: colors.red + '55',
    borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.lg,
  },
  errorBannerText: { color: colors.red, fontSize: fonts.size.md, fontFamily: fonts.bodySemiBold, lineHeight: 18 },

  // Fields
  fieldWrap: { marginBottom: spacing.md },
  input:        { backgroundColor: colors.surface },
  outline:      { borderRadius: radius.sm, borderColor: colors.border },
  inputContent: { color: colors.white, fontSize: fonts.size.md },
  fieldErr:     { fontSize: fonts.size.sm, color: colors.red, marginTop: spacing.xs, marginLeft: spacing.xs, fontFamily: fonts.bodySemiBold },

  // Button
  btnWrap: { position: 'relative', marginBottom: spacing.lg, marginTop: spacing.sm },
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
  linkText:  { fontSize: fonts.size.md, color: colors.grey, textAlign: 'center' },
  linkAccent:{ color: colors.gold, fontFamily: fonts.bodyBold },

  // Footer
  footer: {
    fontSize: fonts.size.sm, color: colors.greyDark, textAlign: 'center',
    marginTop: spacing.xl, letterSpacing: 0.3, lineHeight: 16,
  },
});
