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
  textPrimary:     '#FFFFFF',
  textSecondary:   '#AAAAAA',
  textMuted:       '#666666',
  inputBg:         '#252525',
  inputBorder:     '#333333',
  divider:         '#2A2A2A',
} as const;

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
      // Firebase auth state change will navigate automatically after a moment
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
      primary: C.gold,
      onSurfaceVariant: C.textSecondary,
      background: C.inputBg,
      error: C.error,
    },
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.background} />

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
                  <Text style={styles.successCheckmark}>✓</Text>
                </View>
                <View style={styles.successTextWrap}>
                  <Text style={styles.successTitle}>Account Created!</Text>
                  <Text style={styles.successBody}>
                    Welcome to 613 Barbershop,{' '}
                    <Text style={styles.successName}>{name.trim()}</Text>!
                    {'\n'}Taking you in now…
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
                left={<TextInput.Icon icon="account-outline" color={nameErr ? C.error : C.textMuted} />}
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
                left={<TextInput.Icon icon="email-outline" color={emailErr ? C.error : C.textMuted} />}
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
                left={<TextInput.Icon icon="lock-outline" color={pwdErr ? C.error : C.textMuted} />}
                right={<TextInput.Icon icon={showPwd ? 'eye-off-outline' : 'eye-outline'} color={C.textMuted} onPress={() => setShowPwd(v => !v)} accessibilityLabel={showPwd ? 'Hide password' : 'Show password'} />}
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
                left={<TextInput.Icon icon="lock-check-outline" color={confirmErr ? C.error : C.textMuted} />}
                right={<TextInput.Icon icon={showConfirm ? 'eye-off-outline' : 'eye-outline'} color={C.textMuted} onPress={() => setShowConfirm(v => !v)} accessibilityLabel={showConfirm ? 'Hide confirm password' : 'Show confirm password'} />}
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
              <View style={styles.btnGlow} />
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
                    <ActivityIndicator size={20} color={C.background} />
                    <Text style={styles.btnLoadText}>Creating Account…</Text>
                  </View>
                ) : (
                  <Text style={styles.btnText}>Create Account</Text>
                )}
                <View style={styles.btnDepth} />
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

const CARD_W = Math.min(SCREEN_WIDTH - 32, 440);

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.background },
  flex:  { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
  cardTitle: { fontSize: 22, fontWeight: '800', color: C.textPrimary, marginBottom: 4, letterSpacing: 0.5 },
  cardSub:   { fontSize: 13, color: C.textSecondary, marginBottom: 20 },

  // Success box
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D2010',
    borderWidth: 1,
    borderColor: '#4CAF5055',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    marginBottom: 20,
  },
  successIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF5022',
    borderWidth: 1,
    borderColor: '#4CAF5066',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  successCheckmark: {
    fontSize: 20,
    color: '#4CAF50',
    fontWeight: '900',
    lineHeight: 24,
  },
  successTextWrap: { flex: 1 },
  successTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4CAF50',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  successBody: {
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 18,
  },
  successName: {
    color: C.gold,
    fontWeight: '700',
  },

  // Error banner
  errorBanner: {
    backgroundColor: C.error + '1A',
    borderWidth: 1, borderColor: C.error + '55',
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 18,
  },
  errorBannerText: { color: C.error, fontSize: 13, fontWeight: '500', lineHeight: 18 },

  // Fields
  fieldWrap: { marginBottom: 14 },
  input:        { backgroundColor: C.inputBg },
  outline:      { borderRadius: 12, borderColor: C.inputBorder },
  inputContent: { color: C.textPrimary, fontSize: 15 },
  fieldErr:     { fontSize: 12, color: C.error, marginTop: 4, marginLeft: 4, fontWeight: '500' },

  // Button
  btnWrap: { position: 'relative', marginBottom: 22, marginTop: 8 },
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
