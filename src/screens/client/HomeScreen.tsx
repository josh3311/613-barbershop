/**
 * HomeScreen — "Legacy Barbershop" main-menu RPG layer
 *
 * Red Dead-style main menu: a cinematic dark backdrop, a big gold
 * "613 / BARBERSHOP" hero at the top, and gold-framed RPG panels
 * (Quick Actions + Loyalty) floating over the left side.
 *
 * Expo Go safe — entrance animations use ONLY React Native's built-in
 * Animated API (no Reanimated, no moti).
 *
 * BUSINESS LOGIC IS UNCHANGED: same auth, same birthday detection,
 * same loyalty count, same quick-action navigation, same sign-out.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import {
  OrnamentalCorners,
  RPGPanel,
  RPGSelectionRow,
  ScissorDivider,
  // CinematicBackground — enable once a shop photo asset exists, e.g.:
  // <CinematicBackground source={require('../../../assets/shop-bg.jpg')} />
} from '../../components/ui';

const { height } = Dimensions.get('window');
const HERO_TOP = height * 0.15;

// ── Quick action config (labels unchanged — handleQuickAction keys on them) ──
const QUICK_ACTIONS = [
  { label: 'Book Cut',  icon: 'cut-outline'           },
  { label: 'My Styles', icon: 'color-palette-outline' },
  { label: 'History',   icon: 'time-outline'          },
  { label: 'Chat',      icon: 'chatbubble-outline'    },
] as const;

type QuickActionLabel = (typeof QUICK_ACTIONS)[number]['label'];

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // ── Entrance animations (React Native Animated, native driver) ────
  const heroNum      = useRef(new Animated.Value(0)).current;
  const heroTitleV   = useRef(new Animated.Value(0)).current;
  const heroDivV     = useRef(new Animated.Value(0)).current;
  const qaPanelV     = useRef(new Animated.Value(0)).current;
  const loyaltyPanelV = useRef(new Animated.Value(0)).current;
  const stampAnims   = useRef(Array.from({ length: 10 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const fade = (v: Animated.Value, delay: number) =>
      Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true });
    Animated.parallel([
      fade(heroNum, 100),
      fade(heroTitleV, 200),
      fade(heroDivV, 300),
      fade(qaPanelV, 300),
      fade(loyaltyPanelV, 500),
      ...stampAnims.map((v, i) =>
        Animated.spring(v, {
          toValue: 1, delay: 480 + i * 35, friction: 6, tension: 120, useNativeDriver: true,
        }),
      ),
    ]).start();
    // Animated.Values are stable refs; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeUp = (v: Animated.Value) => ({
    opacity:   v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  });
  const fadeLeft = (v: Animated.Value) => ({
    opacity:   v,
    transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
  });

  // ── Derived view-state ────────────────────────────────────────────
  const isBirthday = (): boolean => {
    if (!user?.birthday) return false;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return user.birthday === `${mm}-${dd}`;
  };

  const stampsEarned = user?.loyaltyStamps ?? 0;

  // ── Handlers (unchanged) ──────────────────────────────────────────
  const handleSignOut = async () => { await signOut(auth); };

  const handleQuickAction = (label: QuickActionLabel) => {
    switch (label) {
      case 'Book Cut':  navigation.navigate('BookingFlow'); break;
      case 'History':   navigation.navigate('History');     break;
      case 'Chat':      navigation.navigate('StyleAI');     break;
      case 'My Styles': navigation.navigate('StyleAI');     break;
    }
  };

  return (
    <View style={styles.container}>
      {/* 1 — Cinematic backdrop (dark gradient placeholder) */}
      <LinearGradient
        colors={['#1A140B', '#0A0A0A', '#050302']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 — Ornamental crosshairs framing the whole screen */}
      <OrnamentalCorners size={24} opacity={0.5} />

      {/* 4 + 5 — Scrolling panel column (left side), cleared past the hero */}
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: HERO_TOP + 170, paddingBottom: insets.bottom + 72 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick actions */}
        <Animated.View style={[styles.panelWrap, fadeLeft(qaPanelV)]}>
          <RPGPanel>
            <Text style={styles.panelTitle}>QUICK ACTIONS</Text>
            <ScissorDivider />
            <View style={styles.rowStack}>
              {QUICK_ACTIONS.map((action, i) => (
                <RPGSelectionRow
                  key={action.label}
                  label={action.label}
                  icon={action.icon}
                  selected={false}
                  onPress={() => handleQuickAction(action.label)}
                  entranceIndex={i}
                />
              ))}
            </View>
          </RPGPanel>
        </Animated.View>

        {/* Loyalty */}
        <Animated.View style={[styles.panelWrap, fadeLeft(loyaltyPanelV)]}>
          <RPGPanel>
            <Text style={styles.panelTitle}>LOYALTY</Text>
            <ScissorDivider />

            <View style={styles.loyaltyHeader}>
              <Text style={styles.loyaltyTitle}>YOUR STAMPS</Text>
              <Text style={styles.loyaltyCount}>{stampsEarned}/10</Text>
            </View>

            {/* Stamp row — RN Animated scale/opacity pop-in stagger */}
            <View style={styles.stampsRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < stampsEarned;
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.stamp,
                      filled && styles.stampFilled,
                      { opacity: stampAnims[i], transform: [{ scale: stampAnims[i] }] },
                    ]}
                  >
                    {filled && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={theme.colors.textInverse}
                      />
                    )}
                  </Animated.View>
                );
              })}
            </View>

            <Text style={{ fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 4 }}>
              {10 - stampsEarned} more cuts until your free haircut!
            </Text>
          </RPGPanel>
        </Animated.View>
      </ScrollView>

      {/* 3 — Top hero (absolute, centred, ~top 15%) */}
      <View
        pointerEvents="none"
        style={[styles.heroWrap, { top: HERO_TOP }]}
      >
        <Animated.Text style={[styles.heroNumber, fadeUp(heroNum)]}>
          613
        </Animated.Text>
        <Animated.Text style={[styles.heroTitle, fadeUp(heroTitleV)]}>
          BARBERSHOP
        </Animated.Text>
        <Animated.View style={[styles.heroDivider, fadeUp(heroDivV)]}>
          <ScissorDivider />
        </Animated.View>
      </View>

      {/* 6 — Sign out: small gold text button, bottom-right */}
      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        hitSlop={8}
        style={[styles.signOutBtn, { bottom: insets.bottom + theme.spacing.md }]}
      >
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </Pressable>

      {/* 7 — Birthday banner overlay at the top of the screen */}
      {isBirthday() && (
        <View style={[styles.birthdayBanner, { top: insets.top + theme.spacing.sm }]}>
          <Text style={styles.birthdayEmoji}>🎂</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.birthdayTitle}>HAPPY BIRTHDAY!</Text>
            <Text style={styles.birthdaySubtitle}>
              Your next haircut is FREE today only!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  scroll: {
    paddingHorizontal: theme.spacing.lg,
  },

  // ── Hero ─────────────────────────────────────────────────────────
  heroWrap: {
    position:   'absolute',
    left:       0,
    right:      0,
    alignItems: 'center',
    zIndex:     5,
  },
  heroNumber: {
    fontFamily: theme.fonts.heading, // BebasNeue
    fontSize:   88,
    lineHeight: 92,
    color:      theme.colors.gold,
  },
  heroTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      24,
    color:         theme.colors.textPrimary,
    letterSpacing: 8,
  },
  heroDivider: { width: 220 },

  // ── Panels ───────────────────────────────────────────────────────
  panelWrap: {
    width:        '70%',
    alignSelf:    'flex-start',
    marginBottom: theme.spacing.lg,
  },
  panelTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xl,
    color:         theme.colors.gold,
    letterSpacing: 4,
  },
  rowStack: { gap: theme.spacing.sm },

  // ── Loyalty ──────────────────────────────────────────────────────
  loyaltyHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   theme.spacing.md,
  },
  loyaltyTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.textPrimary,
    letterSpacing: 3,
  },
  loyaltyCount: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.gold,
  },
  stampsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           theme.spacing.xs,
    marginBottom:  theme.spacing.sm,
  },
  stamp: {
    width:          28,
    height:         28,
    borderRadius:   theme.radius.full,
    borderWidth:    1.5,
    borderColor:    theme.colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stampFilled: {
    backgroundColor: theme.colors.gold,
    borderColor:     theme.colors.gold,
  },

  // ── Sign out ─────────────────────────────────────────────────────
  signOutBtn: {
    position: 'absolute',
    right:    theme.spacing.lg,
    zIndex:   20,
    padding:  theme.spacing.sm,
  },
  signOutText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.gold,
    letterSpacing: 3,
  },

  // ── Birthday banner ──────────────────────────────────────────────
  birthdayBanner: {
    position:        'absolute',
    left:            theme.spacing.lg,
    right:           theme.spacing.lg,
    zIndex:          30,
    backgroundColor: 'rgba(8, 6, 4, 0.92)',
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.md,
  },
  birthdayEmoji: { fontSize: 32 },
  birthdayTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
  birthdaySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textSecondary,
    marginTop:  2,
  },
});
