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
import { colors, fonts, spacing, radius, icons } from '@/theme';

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
          color={focused ? colors.gold : colors.greyDark}
        />
      </View>
      <TextInput
        style={f.input}
        placeholder={placeholder}
        placeholderTextColor={colors.greyDark}
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
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  focused:         { borderColor: colors.gold },
  iconBox: {
    width: 50, height: 56, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceRaised, borderRightWidth: 1, borderRightColor: colors.border,
  },
  iconBoxFocused:  { backgroundColor: colors.gold + '15', borderRightColor: colors.gold + '40' },
  input: {
    flex: 1, height: 56, paddingHorizontal: spacing.lg,
    color: colors.white, fontSize: fonts.size.md, fontFamily: fonts.body,
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

    // 3. Create a barbers profile doc
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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Back button ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to role selection"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name={icons.back} size={20} color={colors.grey} />
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
            <Ionicons name={icons.cutOutline} size={34} color={colors.grey} />
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
                  iconName={icons.mail}
                  placeholder="Work email address"
                  value={siEmail}
                  onChangeText={t => { setSiEmail(t); clearError(); }}
                  keyboardType="email-address"
                  focused={focused === 'si-email'}
                  onFocus={() => setFocused('si-email')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName={icons.lock}
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
                  iconName={icons.person}
                  placeholder="Full name"
                  value={suName}
                  onChangeText={t => { setSuName(t); clearError(); }}
                  autoCapitalize="words"
                  focused={focused === 'su-name'}
                  onFocus={() => setFocused('su-name')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName={icons.mail}
                  placeholder="Email address"
                  value={suEmail}
                  onChangeText={t => { setSuEmail(t); clearError(); }}
                  keyboardType="email-address"
                  focused={focused === 'su-email'}
                  onFocus={() => setFocused('su-email')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName={icons.lock}
                  placeholder="Create a password (min. 6 chars)"
                  value={suPassword}
                  onChangeText={t => { setSuPassword(t); clearError(); }}
                  secureTextEntry
                  focused={focused === 'su-pw'}
                  onFocus={() => setFocused('su-pw')}
                  onBlur={() => setFocused(null)}
                />
                <Field
                  iconName={icons.checkOutline}
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
                  <Ionicons name={icons.information} size={16} color={colors.grey} style={{ marginTop: 1 }} />
                  <Text style={s.noticeText}>
                    In the future, new accounts will require manager approval before access is granted. For now, accounts are activated immediately.
                  </Text>
                </View>
              </>
            )}

            {/* ── Error banner ── */}
            {error && (
              <View style={s.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name={icons.warning} size={16} color={colors.red} style={{ marginTop: 1 }} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* ── Success banner (sign up) ── */}
            {success && (
              <View style={s.successBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Ionicons name={icons.check} size={22} color={colors.green} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.successTitle}>Account Created!</Text>
                  <Text style={s.successText}>Welcome to 613 Barbershop. Logging you in...</Text>
                </View>
              </View>
            )}

            {/* ── Primary button ── */}
            {!success && (
              <Animated.View style={[s.btnWrap, { transform: [{ scale: btnScale }] }]}>
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
                      <ActivityIndicator size={18} color={colors.background} />
                      <Text style={s.btnText}>
                        {tab === 'signin' ? 'Signing In...' : 'Creating Account...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={s.btnText}>
                      {tab === 'signin' ? 'Sign In as Barber' : 'Create Account'}
                    </Text>
                  )}
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
  root:  { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing['2xl'] },

  // Back
  topBar:     { paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText:   { fontSize: fonts.size.md, color: colors.grey, fontFamily: fonts.bodySemiBold },

  // Header
  header:    { marginTop: 8, marginBottom: spacing.lg, alignItems: 'flex-start' },
  badgeRow:  { flexDirection: 'row', marginBottom: spacing.md },
  badge: {
    backgroundColor: colors.gold + '15', borderRadius: radius['2xl'],
    borderWidth: 1, borderColor: colors.gold + '40',
    paddingHorizontal: spacing.md, paddingVertical: 5,
  },
  badgeText: { fontSize: 9, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: 2.5 },
  poleCircle: {
    width: 68, height: 68, borderRadius: radius.full,
    backgroundColor: colors.gold + '15', borderWidth: 2, borderColor: colors.gold + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  title: {
    fontSize: 32, fontFamily: fonts.heading, color: colors.white,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: spacing.sm,
  },
  subtitle: { fontSize: fonts.size.md, color: colors.greyDark, lineHeight: 20 },

  // Tab switcher
  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.sm,
    padding: 5, marginBottom: spacing.lg,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  tabBtnActive:     { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  tabBtnText:       { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.greyDark },
  tabBtnTextActive: { color: colors.gold },

  // Form card
  formCard: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginBottom: spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  formCardAccent: { height: 3, backgroundColor: colors.gold },
  form:           { padding: spacing.lg, gap: spacing.md },

  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText:{ fontSize: fonts.size.md, color: colors.gold, fontFamily: fonts.bodySemiBold },

  // Notice box
  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.gold + '10', borderWidth: 1, borderColor: colors.gold + '35',
    borderRadius: radius.sm, padding: spacing.md,
  },
  noticeText: { flex: 1, fontSize: fonts.size.sm, color: colors.grey, lineHeight: 17 },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.red + '15', borderWidth: 1, borderColor: colors.red + '40',
    borderRadius: radius.sm, padding: spacing.md,
  },
  errorText: { flex: 1, fontSize: fonts.size.md, color: colors.red, lineHeight: 18 },

  // Success
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.green + '15', borderWidth: 1, borderColor: colors.green + '40',
    borderRadius: radius.sm, padding: spacing.md,
  },
  successTitle: { fontSize: fonts.size.lg, fontFamily: fonts.bodyBold, color: colors.green, marginBottom: 2 },
  successText:  { fontSize: fonts.size.sm, color: colors.grey, lineHeight: 16 },

  // Button
  btnWrap: { position: 'relative', marginTop: spacing.xs },
  btn: {
    height: 56, borderRadius: radius['2xl'], backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  btnDisabled: { backgroundColor: colors.surfaceRaised, shadowColor: 'transparent' },
  btnText:     { fontSize: fonts.size.lg, fontFamily: fonts.bodyBold, color: colors.background, letterSpacing: 0.8 },
  btnLoadRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Footer
  footerNote:      { alignItems: 'center', gap: 6 },
  footerNoteText:  { fontSize: fonts.size.md, color: colors.grey, textAlign: 'center' },
  footerNoteLink:  { color: colors.gold, fontFamily: fonts.bodyBold },
  footerNoteSub:   { fontSize: fonts.size.sm, color: colors.greyDark, textAlign: 'center' },
});
