import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
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
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

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
  if (!mmdd || /^\d{2}-\d{2}$/.test(mmdd)) return { month: 1, day: 1 };
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
        <Ionicons name={iconName} size={18} color={colors.greyDark} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

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

  // Animation refs
  const avatarAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    // Initialize card animation values
    cardAnims.length = 0;
    [0, 1, 2, 3].forEach(() => cardAnims.push(new Animated.Value(0)));

    // Staggered entrance animations
    Animated.sequence([
      Animated.timing(avatarAnim, {
        toValue: 1,
        duration: animations.normal,
        useNativeDriver: true,
      }),
      Animated.stagger(100, cardAnims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: animations.normal,
          useNativeDriver: true,
        })
      )),
    ]).start();
  }, []);

  const getCardStyle = (index: number) => {
    const animValue = cardAnims[index] || new Animated.Value(1);
    return {
      opacity: animValue,
      transform: [
        {
          translateY: animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [animations.slideUp.from, animations.slideUp.to],
          }),
        },
      ],
    };
  };

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

  // Button press animation
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar card */}
        <Animated.View style={[styles.avatarCard, getCardStyle(0)]}>
          <View style={styles.avatarCardAccent} />

          <Animated.View style={[styles.avatarWrap, { opacity: avatarAnim }]}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={styles.displayName}>{displayName ?? 'Member'}</Text>
          <Text style={styles.memberBadge}>613 BARBERSHOP MEMBER</Text>

          <View style={styles.memberSinceRow}>
            <Text style={styles.memberSinceLabel}>Member since</Text>
            <Text style={styles.memberSinceValue}>{memberSince}</Text>
          </View>
        </Animated.View>

        {/* Account info */}
        <Animated.View style={[styles.section, getCardStyle(1)]}>
          <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
          <View style={styles.card}>
            <InfoRow iconName={icons.mail} label="Email" value={email} />
            <View style={styles.cardDivider} />
            <InfoRow iconName={icons.tabProfileOutline} label="Name" value={displayName ?? '—'} />
            <View style={styles.cardDivider} />
            <TouchableOpacity
              style={styles.birthdayRow}
              onPress={() => setBirthdayModalOpen(true)}
              onPressIn={() => setPressedButton('birthday')}
              onPressOut={() => setPressedButton(null)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Set birthday"
            >
              <View style={[
                styles.birthdayIconWrap,
                pressedButton === 'birthday' && { transform: [{ scale: animations.pressScale }] },
              ]}>
                <Ionicons name={icons.gift} size={18} color={colors.gold} />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Birthday</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {formatBirthdayDisplay(birthdayMMDD)}
                </Text>
              </View>
              <Ionicons name={icons.forward} size={16} color={colors.greyDark} />
            </TouchableOpacity>
            <View style={styles.cardDivider} />
            <InfoRow iconName={icons.lock} label="User ID" value={(firebaseUser?.uid?.slice(0, 16) ?? '—') + '...'} />
          </View>
        </Animated.View>

        {/* AI style */}
        <Animated.View style={[styles.section, getCardStyle(2)]}>
          <Text style={styles.sectionTitle}>AI STYLE</Text>
          <View style={styles.card}>
            {checkingStyle ? (
              <Text style={styles.aiHint}>Checking style profile...</Text>
            ) : hasStyleProfile ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.aiPrimaryBtn,
                    pressedButton === 'viewStyle' && { transform: [{ scale: animations.pressScale }] },
                  ]}
                  onPress={openSavedStyleProfile}
                  onPressIn={() => setPressedButton('viewStyle')}
                  onPressOut={() => setPressedButton(null)}
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
                  style={[
                    styles.aiPrimaryBtn,
                    pressedButton === 'getStyle' && { transform: [{ scale: animations.pressScale }] },
                  ]}
                  onPress={() => navigateToStyleFromProfile(navigation, 'StyleOnboarding')}
                  onPressIn={() => setPressedButton('getStyle')}
                  onPressOut={() => setPressedButton(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Get style recommendations"
                >
                  <Text style={styles.aiPrimaryBtnText}>Get Style Recommendations</Text>
                </TouchableOpacity>
                <Text style={styles.aiPowered}>Powered by Claude AI</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Account actions */}
        <Animated.View style={[styles.section, getCardStyle(3)]}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              onPress={() => void handleChangePassword()}
              onPressIn={() => setPressedButton('password')}
              onPressOut={() => setPressedButton(null)}
            >
              <View style={styles.actionLeft}>
                <View style={[
                  styles.actionIconWrap,
                  styles.actionIconGold,
                  pressedButton === 'password' && { transform: [{ scale: animations.pressScale }] },
                ]}>
                  <Ionicons name={icons.lock} size={18} color={colors.gold} />
                </View>
                <Text style={styles.actionLabel}>Change Password</Text>
              </View>
              <Ionicons name={icons.forward} size={16} color={colors.greyDark} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Logout button */}
        <Animated.View style={[styles.section, getCardStyle(3)]}>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={[
              styles.logoutBtn,
              loggingOut && styles.logoutBtnBusy,
              pressedButton === 'logout' && { transform: [{ scale: animations.pressScale }] },
            ]}
            onPressIn={() => setPressedButton('logout')}
            onPressOut={() => setPressedButton(null)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Signs you out of 613 Barbershop"
            accessibilityState={{ busy: loggingOut, disabled: loggingOut }}
          >
            <Ionicons
              name={icons.logOut}
              size={20}
              color={colors.red}
              style={{ marginRight: spacing.sm }}
            />
            <Text style={styles.logoutText}>
              {loggingOut ? 'Signing out...' : 'Log Out'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.logoutHint}>You'll be returned to the login screen</Text>
        </Animated.View>

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
                <Text style={styles.bModalSaveText}>{savingBirthday ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing['3xl'] },

  avatarCard: {
    backgroundColor: colors.surface, alignItems: 'center', paddingBottom: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  avatarCardAccent: {
    height: 3, width: '100%', backgroundColor: colors.gold, marginBottom: spacing.xl,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 6,
  },
  avatarWrap:   { position: 'relative', marginBottom: spacing.md },
  avatarGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 55, backgroundColor: colors.gold, opacity: 0.08,
  },
  avatarOuter: {
    width: 90, height: 90, borderRadius: radius.full, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.border,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  avatarInner: {
    width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.goldGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${colors.gold}55`,
  },
  avatarInitials: { fontSize: 28, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: 1 },
  displayName:    { fontSize: fonts.size['2xl'], fontFamily: fonts.heading, color: colors.white, letterSpacing: fonts.letterSpacing.normal, marginBottom: spacing.xs },
  memberBadge:    { fontSize: fonts.size.xs, color: colors.gold, letterSpacing: fonts.letterSpacing.widest, fontFamily: fonts.bodyBold, marginBottom: spacing.md },
  memberSinceRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.border,
  },
  memberSinceLabel: { fontSize: fonts.size.sm, color: colors.grey },
  memberSinceValue: { fontSize: fonts.size.sm, color: colors.gold, fontFamily: fonts.bodyBold },

  section:      { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { fontSize: fonts.size.xs, color: colors.greyDark, fontFamily: fonts.bodyBold, letterSpacing: fonts.letterSpacing.wider, marginBottom: spacing.sm, textTransform: 'uppercase' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cardDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, flexShrink: 0,
  },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: fonts.size.xs, color: colors.greyDark, fontFamily: fonts.bodySemiBold, marginBottom: spacing.xs, letterSpacing: fonts.letterSpacing.normal },
  infoValue: { fontSize: fonts.size.md, color: colors.white, fontFamily: fonts.body },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  actionLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  actionIconGold: { backgroundColor: colors.goldGlow, borderColor: colors.border },
  actionLabel:    { fontSize: fonts.size.md, color: colors.white, fontFamily: fonts.bodySemiBold },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(229, 57, 53, 0.1)', borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.md, paddingVertical: spacing.md,
    shadowColor: colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  logoutBtnBusy: { opacity: 0.65 },
  logoutText:    { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.red, letterSpacing: fonts.letterSpacing.normal },
  logoutHint:    { fontSize: fonts.size.sm, color: colors.greyDark, textAlign: 'center', marginTop: spacing.sm, letterSpacing: fonts.letterSpacing.normal },

  version: { fontSize: fonts.size.sm, color: colors.greyDark, textAlign: 'center', marginTop: spacing.xl, letterSpacing: fonts.letterSpacing.normal },

  birthdayRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md,
  },
  birthdayIconWrap: {
    width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.goldGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, flexShrink: 0,
  },

  bModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.67)', justifyContent: 'center', padding: spacing.lg,
  },
  bModalCard: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, maxHeight: '90%',
  },
  bModalTitle:   { fontSize: fonts.size.xl, fontFamily: fonts.bodyBold, color: colors.white, marginBottom: spacing.xs },
  bModalSub:     { fontSize: fonts.size.sm, color: colors.grey, marginBottom: spacing.md, lineHeight: fonts.lineHeight.normal * fonts.size.sm },
  bModalLabel:   { fontSize: fonts.size.xs, color: colors.greyDark, fontFamily: fonts.bodyBold, letterSpacing: fonts.letterSpacing.wide, marginBottom: spacing.sm, textTransform: 'uppercase' },
  bChipScroll:   { marginBottom: spacing.md },
  bChip:         { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  bChipSel:      { borderColor: colors.gold, backgroundColor: colors.goldGlow },
  bChipText:     { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.grey },
  bChipTextSel:  { color: colors.gold },
  bDayGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xl },
  bDayCell:      { width: (SW - 88) / 7 - 4, minWidth: 36, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  bDayCellSel:   { borderColor: colors.gold, backgroundColor: colors.goldGlow },
  bDayText:      { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.grey },
  bDayTextSel:   { color: colors.gold },
  bModalActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  bModalCancel:  { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  bModalCancelText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.grey },
  bModalSave:    { backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  bModalSaveText:{ fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.background },

  aiHint:         { fontSize: fonts.size.md, color: colors.grey, padding: spacing.lg, textAlign: 'center' },
  aiPrimaryBtn:   { marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.gold, borderRadius: radius['2xl'], paddingVertical: spacing.md, alignItems: 'center' },
  aiPrimaryBtnText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.background, letterSpacing: fonts.letterSpacing.normal },
  aiPowered:      { fontSize: fonts.size.xs, color: colors.greyDark, textAlign: 'center', paddingBottom: spacing.md, letterSpacing: fonts.letterSpacing.normal },
});
