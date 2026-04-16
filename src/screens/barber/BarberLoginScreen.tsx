import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/types';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { BarberService } from '@/services/barber.service';
import { useAuth } from '@/hooks/useAuth';

// Default 9 AM – 7 PM Mon–Sat schedule for new barbers
const DEFAULT_WORKING_HOURS = {
  monday:    { isWorking: true,  startTime: '09:00', endTime: '19:00' },
  tuesday:   { isWorking: true,  startTime: '09:00', endTime: '19:00' },
  wednesday: { isWorking: true,  startTime: '09:00', endTime: '19:00' },
  thursday:  { isWorking: true,  startTime: '09:00', endTime: '19:00' },
  friday:    { isWorking: true,  startTime: '09:00', endTime: '19:00' },
  saturday:  { isWorking: true,  startTime: '09:00', endTime: '17:00' },
  sunday:    { isWorking: false, startTime: '10:00', endTime: '15:00' },
};

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0A0A0A',
  surface:     '#121212',
  card:        '#161616',
  elevated:    '#1E1E1E',
  gold:        '#D4AF37',
  goldGlow:    '#D4AF3715',
  goldBorder:  '#D4AF3730',
  steel:       '#9E9E9E',
  steelDark:   '#616161',
  steelLight:  '#BDBDBD',
  steelGlow:   '#9E9E9E12',
  steelBorder: '#9E9E9E35',
  steelSolid:  '#9E9E9E18',
  green:       '#4CAF50',
  greenBg:     '#0D1A0D',
  greenBdr:    '#4CAF5040',
  danger:      '#CF6679',
  dangerBg:    '#1A0A0A',
  dangerBdr:   '#CF667940',
  white:       '#FFFFFF',
  sub:         '#666666',
  muted:       '#333333',
  placeholder: '#444444',
  border:      '#242424',
} as const;

const { width: SW } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'BarberLogin'>;
type Tab   = 'signin' | 'signup';

// ─── Firebase error → readable message ───────────────────────────────────────

function mapError(raw: string): string {
  if (raw.includes('user-not-found'))     return 'No account found with this email.';
  if (raw.includes('wrong-password'))     return 'Incorrect password. Try again.';
  if (raw.includes('invalid-email'))      return 'Please enter a valid email address.';
  if (raw.includes('email-already'))      return 'An account with this email already exists.';
  if (raw.includes('too-many-requests'))  return 'Too many attempts. Please wait a moment.';
  if (raw.includes('network'))            return 'Network error. Check your connection.';
  if (raw.includes('invalid-credential')) return 'Email or password is incorrect.';
  if (raw.includes('weak-password'))      return 'Password must be at least 6 characters.';
  return 'Something went wrong. Please try again.';
}

// ─── Reusable text field ──────────────────────────────────────────────────────

function Field({
  iconName, placeholder, value, onChangeText,
  secureTextEntry, keyboardType, autoCapitalize,
  focused, onFocus, onBlur,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}): React.JSX.Element {
  return (
    <View style={[f.wrap, focused && f.focused]}>
      <View style={[f.iconBox, focused && f.iconBoxFocused]}>
        <Ionicons
          name={iconName}
          size={18}
          color={focused ? C.steel : C.steelDark}
        />
      </View>
      <TextInput
        style={f.input}
        placeholder={placeholder}
        placeholderTextColor={C.placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const f = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  focused:         { borderColor: C.steel },
  iconBox: {
    width: 50, height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.elevated, borderRightWidth: 1, borderRightColor: C.border,
  },
  iconBoxFocused:  { backgroundColor: C.steelSolid, borderRightColor: C.steelBorder },
  input: {
    flex: 1, height: 56, paddingHorizontal: 16,
    color: C.white, fontSize: 15, fontWeight: '500',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BarberLoginScreen({ navigation }: Props): React.JSX.Element {
  const { refreshUser } = useAuth();
  const insets   = useSafeAreaInsets();
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<Tab>('signin');

  // ── Sign-in fields ────────────────────────────────────────────────────────
  const [siEmail,    setSiEmail]    = useState('');
  const [siPassword, setSiPassword] = useState('');

  // ── Sign-up fields ────────────────────────────────────────────────────────
  const [suName,     setSuName]     = useState('');
  const [suEmail,    setSuEmail]    = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm,  setSuConfirm]  = useState('');

  // ── Shared state ──────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);
  const [focused,  setFocused]  = useState<string | null>(null);

  function clearError(): void { setError(null); }

  // ── Sign in ───────────────────────────────────────────────────────────────

  async function handleSignIn(): Promise<void> {
    if (!siEmail.trim())         { setError('Please enter your email.');    return; }
    if (!siEmail.includes('@'))  { setError('Enter a valid email address.'); return; }
    if (!siPassword)             { setError('Please enter your password.');  return; }

    setLoading(true);
    setError(null);
    const result = await AuthService.login(siEmail.trim().toLowerCase(), siPassword);
    if (!result.success) {
      setError(mapError(result.error));
      setLoading(false);
    }
    // On success: onAuthStateChanged fires → RootNavigator routes to BarberApp
  }

  // ── Sign up ───────────────────────────────────────────────────────────────

  async function handleSignUp(): Promise<void> {
    if (!suName.trim())           { setError('Please enter your full name.');         return; }
    if (!suEmail.trim())          { setError('Please enter your email.');              return; }
    if (!suEmail.includes('@'))   { setError('Enter a valid email address.');          return; }
    if (suPassword.length < 6)    { setError('Password must be at least 6 characters.'); return; }
    if (suPassword !== suConfirm) { setError('Passwords do not match.');              return; }

    setLoading(true);
    setError(null);

    // 1. Create Firebase Auth account
    const authResult = await AuthService.register(
      suEmail.trim().toLowerCase(),
      suPassword,
      suName.trim(),
    );

    if (!authResult.success) {
      setError(mapError(authResult.error));
      setLoading(false);
      return;
    }

    const uid  = authResult.data.uid;
    const name = suName.trim();

    // 2. Create Firestore user doc with role: 'barber'
    await UserService.create(uid, {
      email:       suEmail.trim().toLowerCase(),
      displayName: name,
      phone:       '',
      photoURL:    null,
      role:        'barber',
      fcmToken:    null,
    });

    // 3. Create a barbers profile doc (publicly readable — clients can discover this barber)
    await BarberService.create(uid, {
      userId:       uid,
      displayName:  name,
      bio:          '',
      specialties:  ['Fades', 'Haircuts'],
      photoURL:     null,
      isAvailable:  true,
      workingHours: DEFAULT_WORKING_HOURS,
    });

    // 4. Force-refresh the profile so RootNavigator routes to BarberApp immediately
    //    (avoids race condition where onAuthStateChanged fires before the doc exists)
    await refreshUser();

    setLoading(false);
    setSuccess(true);
  }

  // ── Button animation ──────────────────────────────────────────────────────

  function btnIn():  void { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }
  function btnOut(): void { Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }

  function switchTab(t: Tab): void {
    setTab(t);
    setError(null);
    setSuccess(false);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Back button ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to role selection"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="chevron-back" size={20} color={C.steel} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View style={s.header} accessibilityRole="header">
          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Text style={s.badgeText}>BARBER PORTAL</Text>
            </View>
          </View>
          <View style={s.poleCircle}>
            <Ionicons name="cut-outline" size={34} color={C.steel} />
          </View>
          <Text style={s.title}>
            {tab === 'signin' ? 'Welcome Back,\nPro.' : 'Join the Team.'}
          </Text>
          <Text style={s.subtitle}>
            {tab === 'signin'
              ? 'Sign in to manage your schedule\nand connect with your clients.'
              : 'Create your barber account to get\nstarted at 613 Barbershop.'}
          </Text>
        </View>

        {/* ── Tab switcher ── */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'signin' && s.tabBtnActive]}
            onPress={() => switchTab('signin')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'signin' }}
          >
            <Text style={[s.tabBtnText, tab === 'signin' && s.tabBtnTextActive]}>
              Sign In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabBtn, tab === 'signup' && s.tabBtnActive]}
            onPress={() => switchTab('signup')}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'signup' }}
          >
            <Text style={[s.tabBtnText, tab === 'signup' && s.tabBtnTextActive]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form card ── */}
        <View style={s.formCard}>
          <View style={s.formCardAccent} />
          <View style={s.form}>

            {/* ══ SIGN IN FORM ══ */}
            {tab === 'signin' && (
              <>
                <Field
                  iconName="mail-outline"
                  placeholder="Work email address"
                  value={siEmail}
                  onChangeText={t => { setSiEmail(t); clearError(); }}
                  keyboardType="email-address"
                  focused={focused === 'si-email'}
                  onFocus={() => setFocused('si-email')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName="lock-closed-outline"
                  placeholder="Password"
                  value={siPassword}
                  onChangeText={t => { setSiPassword(t); clearError(); }}
                  secureTextEntry
                  focused={focused === 'si-pw'}
                  onFocus={() => setFocused('si-pw')}
                  onBlur={() => setFocused(null)}
                />

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={s.forgotRow}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                >
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ══ SIGN UP FORM ══ */}
            {tab === 'signup' && (
              <>
                <Field
                  iconName="person-outline"
                  placeholder="Full name"
                  value={suName}
                  onChangeText={t => { setSuName(t); clearError(); }}
                  autoCapitalize="words"
                  focused={focused === 'su-name'}
                  onFocus={() => setFocused('su-name')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName="mail-outline"
                  placeholder="Email address"
                  value={suEmail}
                  onChangeText={t => { setSuEmail(t); clearError(); }}
                  keyboardType="email-address"
                  focused={focused === 'su-email'}
                  onFocus={() => setFocused('su-email')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName="lock-closed-outline"
                  placeholder="Create a password (min. 6 chars)"
                  value={suPassword}
                  onChangeText={t => { setSuPassword(t); clearError(); }}
                  secureTextEntry
                  focused={focused === 'su-pw'}
                  onFocus={() => setFocused('su-pw')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName="checkmark-outline"
                  placeholder="Confirm password"
                  value={suConfirm}
                  onChangeText={t => { setSuConfirm(t); clearError(); }}
                  secureTextEntry
                  focused={focused === 'su-confirm'}
                  onFocus={() => setFocused('su-confirm')}
                  onBlur={() => setFocused(null)}
                />

                {/* Future approval notice */}
                <View style={s.noticeBox}>
                  <Ionicons name="information-circle-outline" size={16} color={C.steel} style={{ marginTop: 1 }} />
                  <Text style={s.noticeText}>
                    In the future, new accounts will require manager approval before access is granted. For now, accounts are activated immediately.
                  </Text>
                </View>
              </>
            )}

            {/* ── Error banner ── */}
            {error && (
              <View style={s.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name="warning-outline" size={16} color={C.danger} style={{ marginTop: 1 }} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* ── Success banner (sign up) ── */}
            {success && (
              <View style={s.successBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={22} color={C.green} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.successTitle}>Account Created!</Text>
                  <Text style={s.successText}>Welcome to 613 Barbershop. Logging you in…</Text>
                </View>
              </View>
            )}

            {/* ── Primary button ── */}
            {!success && (
              <Animated.View style={[s.btnWrap, { transform: [{ scale: btnScale }] }]}>
                <View style={s.btnGlow} />
                <TouchableOpacity
                  onPress={tab === 'signin' ? handleSignIn : handleSignUp}
                  onPressIn={btnIn}
                  onPressOut={btnOut}
                  disabled={loading}
                  activeOpacity={1}
                  style={[s.btn, loading && s.btnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={tab === 'signin' ? 'Sign in as barber' : 'Create barber account'}
                  accessibilityState={{ busy: loading, disabled: loading }}
                >
                  {loading ? (
                    <View style={s.btnLoadRow}>
                      <ActivityIndicator size={18} color={C.bg} />
                      <Text style={s.btnText}>
                        {tab === 'signin' ? 'Signing In…' : 'Creating Account…'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.btnText}>
                      {tab === 'signin' ? 'Sign In as Barber  →' : 'Create Account  →'}
                    </Text>
                  )}
                  {!loading && <View style={s.btnDepth} />}
                </TouchableOpacity>
              </Animated.View>
            )}

          </View>
        </View>

        {/* ── Footer note ── */}
        <View style={s.footerNote}>
          {tab === 'signin' ? (
            <Text style={s.footerNoteText}>
              No account yet?{' '}
              <Text style={s.footerNoteLink} onPress={() => switchTab('signup')}>
                Create one here.
              </Text>
            </Text>
          ) : (
            <Text style={s.footerNoteText}>
              Already have an account?{' '}
              <Text style={s.footerNoteLink} onPress={() => switchTab('signin')}>
                Sign in.
              </Text>
            </Text>
          )}
          <Text style={s.footerNoteSub}>
            For access issues, contact your shop manager.
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24 },

  // Back
  topBar:     { paddingHorizontal: 20, paddingBottom: 4 },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText:   { fontSize: 14, color: C.steel, fontWeight: '600' },

  // Header
  header:    { marginTop: 8, marginBottom: 20, alignItems: 'flex-start' },
  badgeRow:  { flexDirection: 'row', marginBottom: 14 },
  badge: {
    backgroundColor: C.steelSolid, borderRadius: 20,
    borderWidth: 1, borderColor: C.steelBorder,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { fontSize: 9, fontWeight: '800', color: C.steel, letterSpacing: 2.5 },
  poleCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.steelSolid, borderWidth: 2, borderColor: C.steelBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: C.steel, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 32, fontWeight: '900', color: C.white,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: C.sub, lineHeight: 20 },

  // Tab switcher
  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: C.elevated, borderRadius: 14,
    padding: 5, marginBottom: 20,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive:     { backgroundColor: C.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  tabBtnText:       { fontSize: 13, fontWeight: '700', color: C.sub },
  tabBtnTextActive: { color: C.steel },

  // Form card
  formCard: {
    backgroundColor: C.card, borderRadius: 20,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  formCardAccent: { height: 3, backgroundColor: C.steel },
  form:           { padding: 20, gap: 14 },

  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText:{ fontSize: 13, color: C.steel, fontWeight: '600' },

  // Notice box
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.steelGlow, borderWidth: 1, borderColor: C.steelBorder,
    borderRadius: 12, padding: 12,
  },
  noticeText: { flex: 1, fontSize: 12, color: C.sub, lineHeight: 17 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBdr,
    borderRadius: 12, padding: 14,
  },
  errorText: { flex: 1, fontSize: 13, color: C.danger, lineHeight: 18 },

  // Success
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.greenBg, borderWidth: 1, borderColor: C.greenBdr,
    borderRadius: 12, padding: 14,
  },
  successTitle: { fontSize: 15, fontWeight: '800', color: C.green, marginBottom: 2 },
  successText:  { fontSize: 12, color: C.sub, lineHeight: 16 },

  // Button
  btnWrap: { position: 'relative', marginTop: 4 },
  btnGlow: {
    position: 'absolute', top: 4, left: 10, right: 10, bottom: -4,
    backgroundColor: C.steel, borderRadius: 14, opacity: 0.15,
    shadowColor: C.steel, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  btn: {
    height: 56, borderRadius: 14, backgroundColor: C.steel,
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: C.steelLight + '50',
    shadowColor: C.steelDark, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 10, overflow: 'hidden',
  },
  btnDisabled: { backgroundColor: C.elevated, borderTopColor: 'transparent' },
  btnText:     { fontSize: 16, fontWeight: '800', color: C.bg, letterSpacing: 0.8 },
  btnLoadRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnDepth: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
    backgroundColor: C.steelDark, opacity: 0.6,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },

  // Footer
  footerNote:      { alignItems: 'center', gap: 6 },
  footerNoteText:  { fontSize: 13, color: C.sub, textAlign: 'center' },
  footerNoteLink:  { color: C.steel, fontWeight: '700' },
  footerNoteSub:   { fontSize: 11, color: C.muted, textAlign: 'center' },
});
