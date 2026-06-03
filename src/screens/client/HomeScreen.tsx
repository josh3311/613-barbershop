/**
 * HomeScreen — "Legacy Barbershop" main-menu RPG layer
 *
 * Red Dead-style main menu: a cinematic dark backdrop, a big gold
 * "613 / BARBERSHOP" hero at the top, and gold-framed RPG panels
 * (Quick Actions + Loyalty) floating over the left side.
 *
 * BUSINESS LOGIC IS UNCHANGED: same auth, same birthday detection,
 * same loyalty count, same quick-action navigation, same sign-out.
 * Only the presentation is redesigned.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import Animated, { FadeInDown, FadeInLeft } from 'react-native-reanimated';
import { MotiView } from 'moti';
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
        <Animated.View
          entering={FadeInLeft.springify().delay(300)}
          style={styles.panelWrap}
        >
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
        <Animated.View
          entering={FadeInLeft.springify().delay(500)}
          style={styles.panelWrap}
        >
          <RPGPanel>
            <Text style={styles.panelTitle}>LOYALTY</Text>
            <ScissorDivider />

            <View style={styles.loyaltyHeader}>
              <Text style={styles.loyaltyTitle}>YOUR STAMPS</Text>
              <Text style={styles.loyaltyCount}>{stampsEarned}/10</Text>
            </View>

            {/* Existing MotiView stamp row — kept exactly as-is */}
            <View style={styles.stampsRow}>
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < stampsEarned;
                return (
                  <MotiView
                    key={i}
                    from={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      damping:  filled ? 9 : 14,
                      mass:     filled ? 0.6 : 1,
                      delay:    480 + i * 35,
                    }}
                    style={[styles.stamp, filled && styles.stampFilled]}
                  >
                    {filled && (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={theme.colors.textInverse}
                      />
                    )}
                  </MotiView>
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
        <Animated.Text
          entering={FadeInDown.springify().delay(100)}
          style={styles.heroNumber}
        >
          613
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.springify().delay(200)}
          style={styles.heroTitle}
        >
          BARBERSHOP
        </Animated.Text>
        <Animated.View
          entering={FadeInDown.springify().delay(300)}
          style={styles.heroDivider}
        >
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
        <Animated.View
          entering={FadeInDown.delay(80).springify()}
          style={[styles.birthdayBanner, { top: insets.top + theme.spacing.sm }]}
        >
          <Text style={styles.birthdayEmoji}>🎂</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.birthdayTitle}>HAPPY BIRTHDAY!</Text>
            <Text style={styles.birthdaySubtitle}>
              Your next haircut is FREE today only!
            </Text>
          </View>
        </Animated.View>
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
