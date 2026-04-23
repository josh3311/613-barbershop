import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Modal,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { NavigationProp } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type {
  ClientTabParamList,
  ProfileStackParamList,
  StyleStackParamList,
} from '@/navigation/types';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import type { ProfileAnalysisResult } from '@/services/ai.service';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A0A0A',
  surface:      '#141414',
  card:         '#161616',
  elevated:     '#1C1C1C',
  gold:         '#D4AF37',
  goldDark:     '#A8861A',
  goldLight:    '#EDD060',
  goldGlow:     '#D4AF3715',
  goldBorder:   '#D4AF3740',
  danger:       '#CF6679',
  dangerBg:     '#2A1010',
  dangerBorder: '#CF667944',
  white:        '#FFFFFF',
  sub:          '#999999',
  muted:        '#555555',
  divider:      '#1E1E1E',
} as const;

const { width: SW } = Dimensions.get('window');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function daysInMonth(month1to12: number): number {
  const m = month1to12;
  if (m === 2) return 29;
  if ([4, 6, 9, 11].includes(m)) return 30;
  return 31;
}

function formatBirthdayDisplay(mmdd: string | null): string {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return 'Tap to add';
  const [mm, dd] = mmdd.split('-').map((x) => parseInt(x, 10));
  if (!mm || !dd) return 'Tap to add';
  return `${MONTH_NAMES[mm - 1]?.slice(0, 3) ?? ''} ${dd}`;
}

function parseMMDD(mmdd: string | null): { month: number; day: number } {
  if (!mmdd || !/^\d{2}-\d{2}$/.test(mmdd)) return { month: 1, day: 1 };
  const [mm, dd] = mmdd.split('-').map((x) => parseInt(x, 10));
  const month = Math.min(12, Math.max(1, mm || 1));
  const maxD = daysInMonth(month);
  const day = Math.min(maxD, Math.max(1, dd || 1));
  return { month, day };
}

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

function navigateToStyleFromProfile(
  nav: NavigationProp<ProfileStackParamList>,
  screen: 'StyleOnboarding',
): void;
function navigateToStyleFromProfile(
  nav: NavigationProp<ProfileStackParamList>,
  screen: 'StyleResults',
  params: StyleStackParamList['StyleResults'],
): void;
function navigateToStyleFromProfile(
  nav: NavigationProp<ProfileStackParamList>,
  screen: keyof StyleStackParamList,
  params?: StyleStackParamList['StyleResults'],
): void {
  const tab = nav.getParent<NavigationProp<ClientTabParamList>>();
  if (!tab) return;
  if (screen === 'StyleOnboarding') {
    tab.navigate('Style', { screen: 'StyleOnboarding' });
  } else {
    tab.navigate('Style', { screen: 'StyleResults', params: params! });
  }
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InfoRow({
  iconName, label, value,
}: {
  iconName: keyof typeof Ionicons.glyphMap; label: string; value: string;
}): React.JSX.Element {
  return (
    <View style={styles.infoRow} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={iconName} size={18} color="#555555" />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [hasStyleProfile, setHasStyleProfile] = useState(false);
  const [checkingStyle, setCheckingStyle] = useState(true);
  const [birthdayMMDD, setBirthdayMMDD] = useState<string | null>(null);
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false);
  const [pickMonth, setPickMonth] = useState(1);
  const [pickDay, setPickDay] = useState(1);
  const [savingBirthday, setSavingBirthday] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const uid = firebaseUser?.uid;
        if (!uid) {
          setHasStyleProfile(false);
          setCheckingStyle(false);
          setBirthdayMMDD(null);
          return;
        }
        setCheckingStyle(true);
        try {
          const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
          const data = snap.data();
          const sp = data?.styleProfile as
            | { profile?: unknown; styles?: unknown }
            | undefined;
          const ok = !!(sp?.profile && sp?.styles);
          const b = data?.birthday;
          if (!cancelled) {
            setHasStyleProfile(ok);
            setBirthdayMMDD(typeof b === 'string' ? b : null);
          }
        } catch {
          if (!cancelled) {
            setHasStyleProfile(false);
            setBirthdayMMDD(null);
          }
        } finally {
          if (!cancelled) setCheckingStyle(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [firebaseUser?.uid]),
  );

  useEffect(() => {
    if (!birthdayModalOpen) return;
    const { month, day } = parseMMDD(birthdayMMDD);
    setPickMonth(month);
    setPickDay(Math.min(day, daysInMonth(month)));
  }, [birthdayModalOpen, birthdayMMDD]);

  const maxDayPick = useMemo(() => daysInMonth(pickMonth), [pickMonth]);

  useEffect(() => {
    if (pickDay > maxDayPick) setPickDay(maxDayPick);
  }, [pickDay, maxDayPick]);

  async function saveBirthday(): Promise<void> {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    const mmdd = `${pad2(pickMonth)}-${pad2(pickDay)}`;
    setSavingBirthday(true);
    try {
      await setDoc(
        doc(db, COLLECTIONS.USERS, uid),
        { birthday: mmdd, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setBirthdayMMDD(mmdd);
      setBirthdayModalOpen(false);
    } finally {
      setSavingBirthday(false);
    }
  }

  async function openSavedStyleProfile(): Promise<void> {
    const uid = firebaseUser?.uid;
    if (!uid) return;
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    const sp = snap.data()?.styleProfile as {
      profile: ProfileAnalysisResult['profile'];
      styles: ProfileAnalysisResult['styles'];
    } | undefined;
    if (!sp?.profile || !sp?.styles) return;
    const analysis: ProfileAnalysisResult = {
      success: true,
      profile: sp.profile,
      styles: sp.styles,
    };
    navigateToStyleFromProfile(navigation, 'StyleResults', { analysis, readOnly: true });
  }

  const displayName = firebaseUser?.displayName ?? null;
  const email       = firebaseUser?.email ?? '—';
  const initials    = getInitials(displayName);
  const memberSince = firebaseUser?.metadata?.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  async function handleChangePassword(): Promise<void> {
    const email = (firebaseUser?.email ?? '').trim();
    if (!email) {
      if (Platform.OS === 'web') {
        window.alert('We could not find an email address on your account.');
      } else {
        Alert.alert('Change Password', 'We could not find an email address on your account.');
      }
      return;
    }
    const message =
      `Send a password-reset email to ${email}?\n\n` +
      'You will receive a secure link from Firebase to set a new password.';
    const confirmed =
      Platform.OS === 'web' ? window.confirm(message) : await new Promise<boolean>((resolve) => {
        Alert.alert('Change Password', message, [
          { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Send email', onPress: () => resolve(true) },
        ]);
      });
    if (!confirmed) return;

    try {
      const res = await AuthService.sendPasswordReset(email);
      if (!res.success) {
        const errMsg = res.error || 'Could not send reset email. Please try again.';
        if (Platform.OS === 'web') window.alert(errMsg);
        else Alert.alert('Change Password', errMsg);
        return;
      }
      const ok = 'Password reset email sent. Check your inbox.';
      if (Platform.OS === 'web') window.alert(ok);
      else Alert.alert('Change Password', ok);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send reset email.';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Change Password', msg);
    }
  }

  async function handleLogout(): Promise<void> {
    if (loggingOut) return;
    setLoggingOut(true);
    await AuthService.logout();
    setLoggingOut(false);
  }

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCardAccent} />

          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.displayName}>{displayName ?? 'Member'}</Text>
          <Text style={styles.memberBadge}>613 BARBERSHOP MEMBER</Text>

          <View style={styles.memberSinceRow}>
            <Text style={styles.memberSinceLabel}>Member since</Text>
            <Text style={styles.memberSinceValue}>{memberSince}</Text>
          </View>
        </View>

        {/* ── Account info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
          <View style={styles.card}>
            <InfoRow iconName="mail-outline"    label="Email"   value={email} />
            <View style={styles.cardDivider} />
            <InfoRow iconName="person-outline"  label="Name"    value={displayName ?? '—'} />
            <View style={styles.cardDivider} />
            <TouchableOpacity
              style={styles.birthdayRow}
              onPress={() => setBirthdayModalOpen(true)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Set birthday"
            >
              <View style={styles.birthdayIconWrap}>
                <FontAwesome5 name="birthday-cake" size={16} color={C.gold} solid />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Birthday</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {formatBirthdayDisplay(birthdayMMDD)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#444444" />
            </TouchableOpacity>
            <View style={styles.cardDivider} />
            <InfoRow iconName="key-outline"     label="User ID" value={(firebaseUser?.uid?.slice(0, 16) ?? '—') + '…'} />
          </View>
        </View>

        {/* ── AI style ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI STYLE</Text>
          <View style={styles.card}>
            {checkingStyle ? (
              <Text style={styles.aiHint}>Checking style profile…</Text>
            ) : hasStyleProfile ? (
              <>
                <TouchableOpacity
                  style={styles.aiPrimaryBtn}
                  onPress={openSavedStyleProfile}
                  accessibilityRole="button"
                  accessibilityLabel="View my style profile"
                >
                  <Text style={styles.aiPrimaryBtnText}>View My Style Profile</Text>
                </TouchableOpacity>
                <Text style={styles.aiPowered}>Powered by Claude AI</Text>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.aiPrimaryBtn}
                  onPress={() => navigateToStyleFromProfile(navigation, 'StyleOnboarding')}
                  accessibilityRole="button"
                  accessibilityLabel="Get style recommendations"
                >
                  <Text style={styles.aiPrimaryBtnText}>Get Style Recommendations</Text>
                </TouchableOpacity>
                <Text style={styles.aiPowered}>Powered by Claude AI</Text>
              </>
            )}
          </View>
        </View>

        {/* ── Account actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              onPress={() => void handleChangePassword()}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, styles.actionIconGold]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={styles.actionLabel}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#444444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout button ── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={[styles.logoutBtn, loggingOut && styles.logoutBtnBusy]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Signs you out of 613 Barbershop"
            accessibilityState={{ busy: loggingOut, disabled: loggingOut }}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#CF6679"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.logoutText}>
              {loggingOut ? 'Signing out…' : 'Log Out'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.logoutHint}>You'll be returned to the login screen</Text>
        </View>

        <Text style={styles.version}>613 Barbershop · v1.0.0</Text>
      </ScrollView>

      <Modal
        visible={birthdayModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBirthdayModalOpen(false)}
      >
        <Pressable style={styles.bModalOverlay} onPress={() => setBirthdayModalOpen(false)}>
          <View style={styles.bModalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.bModalTitle}>Your birthday</Text>
            <Text style={styles.bModalSub}>Month and day only (for birthday rewards)</Text>

            <Text style={styles.bModalLabel}>Month</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bChipScroll}>
              {MONTH_NAMES.map((name, i) => {
                const m = i + 1;
                const sel = pickMonth === m;
                return (
                  <Pressable
                    key={name}
                    onPress={() => setPickMonth(m)}
                    style={[styles.bChip, sel && styles.bChipSel]}
                  >
                    <Text style={[styles.bChipText, sel && styles.bChipTextSel]}>{name.slice(0, 3)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.bModalLabel}>Day</Text>
            <View style={styles.bDayGrid}>
              {Array.from({ length: maxDayPick }, (_, i) => i + 1).map((d) => {
                const sel = pickDay === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setPickDay(d)}
                    style={[styles.bDayCell, sel && styles.bDayCellSel]}
                  >
                    <Text style={[styles.bDayText, sel && styles.bDayTextSel]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.bModalActions}>
              <TouchableOpacity
                style={styles.bModalCancel}
                onPress={() => setBirthdayModalOpen(false)}
                accessibilityRole="button"
              >
                <Text style={styles.bModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bModalSave, savingBirthday && { opacity: 0.6 }]}
                onPress={saveBirthday}
                disabled={savingBirthday}
                accessibilityRole="button"
              >
                <Text style={styles.bModalSaveText}>{savingBirthday ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },

  avatarCard: {
    backgroundColor: C.card, alignItems: 'center', paddingBottom: 28,
    borderBottomWidth: 1, borderBottomColor: C.divider,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  avatarCardAccent: {
    height: 3, width: '100%', backgroundColor: C.gold, marginBottom: 32,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 6,
  },
  avatarWrap:   { position: 'relative', marginBottom: 16 },
  avatarGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 55, backgroundColor: C.gold, opacity: 0.08,
  },
  avatarOuter: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.goldBorder,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  avatarInner: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.goldGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.gold + '55',
  },
  avatarInitials: { fontSize: 28, fontWeight: '900', color: C.gold, letterSpacing: 1 },
  displayName:    { fontSize: 22, fontWeight: '800', color: C.white, letterSpacing: 0.3, marginBottom: 4 },
  memberBadge:    { fontSize: 10, color: C.gold, letterSpacing: 2.5, fontWeight: '700', marginBottom: 14 },
  memberSinceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.elevated, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.divider,
  },
  memberSinceLabel: { fontSize: 12, color: C.sub },
  memberSinceValue: { fontSize: 12, color: C.gold, fontWeight: '700' },

  section:      { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.divider, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cardDivider: { height: 1, backgroundColor: C.divider, marginHorizontal: 16 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A2A', flexShrink: 0,
  },
  infoIcon:  { fontSize: 16 },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: C.white, fontWeight: '500' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  actionLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  actionIconGold: { backgroundColor: C.goldGlow, borderColor: C.goldBorder },
  actionIcon:     { fontSize: 16 },
  actionLabel:    { fontSize: 14, color: C.white, fontWeight: '600' },
  actionChevron:  { fontSize: 22, color: C.muted, lineHeight: 26 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerBg, borderWidth: 1.5, borderColor: C.dangerBorder,
    borderRadius: 14, paddingVertical: 16,
    shadowColor: C.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  logoutBtnBusy: { opacity: 0.65 },
  logoutIcon:    { fontSize: 20, color: C.danger },
  logoutText:    { fontSize: 16, fontWeight: '800', color: C.danger, letterSpacing: 0.5 },
  logoutHint:    { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8, letterSpacing: 0.3 },

  version: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 36, letterSpacing: 0.5 },

  birthdayRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  birthdayIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.goldGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.goldBorder, flexShrink: 0,
  },

  bModalOverlay: {
    flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: 24,
  },
  bModalCard: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.divider,
    padding: 20, maxHeight: '90%',
  },
  bModalTitle:   { fontSize: 18, fontWeight: '800', color: C.white, marginBottom: 6 },
  bModalSub:     { fontSize: 12, color: C.sub, marginBottom: 16, lineHeight: 17 },
  bModalLabel:   { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  bChipScroll:   { marginBottom: 14 },
  bChip:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.divider, marginRight: 8 },
  bChipSel:      { borderColor: C.gold, backgroundColor: C.goldGlow },
  bChipText:     { fontSize: 13, fontWeight: '700', color: C.sub },
  bChipTextSel:  { color: C.gold },
  bDayGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  bDayCell:      { width: (SW - 88) / 7 - 4, minWidth: 36, paddingVertical: 10, borderRadius: 10, backgroundColor: C.elevated, borderWidth: 1, borderColor: C.divider, alignItems: 'center' },
  bDayCellSel:   { borderColor: C.gold, backgroundColor: C.goldGlow },
  bDayText:      { fontSize: 14, fontWeight: '700', color: C.sub },
  bDayTextSel:   { color: C.gold },
  bModalActions: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  bModalCancel:  { paddingVertical: 12, paddingHorizontal: 18 },
  bModalCancelText: { fontSize: 14, fontWeight: '700', color: C.sub },
  bModalSave:    { backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  bModalSaveText:{ fontSize: 14, fontWeight: '800', color: C.bg },

  aiHint:         { fontSize: 13, color: C.sub, padding: 16, textAlign: 'center' },
  aiPrimaryBtn:   { marginHorizontal: 16, marginTop: 14, marginBottom: 8, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  aiPrimaryBtnText: { fontSize: 15, fontWeight: '800', color: C.bg, letterSpacing: 0.3 },
  aiPowered:      { fontSize: 11, color: C.muted, textAlign: 'center', paddingBottom: 14, letterSpacing: 0.3 },
});
