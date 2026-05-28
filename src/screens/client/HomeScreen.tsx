/**
 * HomeScreen
 *
 * V3 visual layer:
 * - Reanimated entering animations replace the old RN Animated fade/slide
 * - Hero is a GoldCard with a gyroscope tilt parallax (±4° clamp)
 * - Quick actions and loyalty card are GoldCards
 * - Section labels use Moti FadeInLeft
 * - Loyalty stamps spring-bounce in with a stagger
 *
 * Business logic (auth, navigation, birthday detection, loyalty count)
 * is unchanged from the prior version.
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
} from 'react-native';
import Animated, {
  FadeInDown, SensorType, useAnimatedSensor, useAnimatedStyle,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';

import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { GoldCard, PremiumButton } from '../../components/ui';

const { width } = Dimensions.get('window');

// ── Helpers ─────────────────────────────────────────────────────────
const radToDeg = (rad: number) => rad * (180 / Math.PI);
const clamp    = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

// Max tilt the hero is allowed to reach in either axis (degrees).
const MAX_TILT_DEG = 4;

// ── Quick action config (unchanged from prior) ──────────────────────
const QUICK_ACTIONS = [
  { label: 'Book Cut',  icon: 'calendar-outline'      },
  { label: 'My Styles', icon: 'color-palette-outline' },
  { label: 'History',   icon: 'time-outline'          },
  { label: 'Chat',      icon: 'chatbubble-outline'    },
] as const;

type QuickActionLabel = (typeof QUICK_ACTIONS)[number]['label'];

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  // ── Gyro tilt — drives the hero parallax ──────────────────────────
  // useAnimatedSensor is safe to call: on devices without the sensor it
  // simply returns zeroed values, the hero stays flat.
  const rotation = useAnimatedSensor(SensorType.ROTATION, { interval: 50 });

  const heroTiltStyle = useAnimatedStyle(() => {
    'worklet';
    const { roll, pitch } = rotation.sensor.value;
    // Map device roll/pitch (radians) to small visual tilt (deg).
    const rotY = clamp(radToDeg(roll)  * 0.3, -MAX_TILT_DEG, MAX_TILT_DEG);
    const rotX = clamp(radToDeg(pitch) * 0.3, -MAX_TILT_DEG, MAX_TILT_DEG);
    return {
      transform: [
        { perspective: 900 },
        { rotateY: `${rotY}deg` },
        { rotateX: `${-rotX}deg` },
      ],
    };
  });

  // Per-layer parallax — three depth tiers, hooks called in stable order.
  // Larger depth = more movement.
  const glowLayer = useAnimatedStyle(() => {
    'worklet';
    const { roll, pitch } = rotation.sensor.value;
    const d = 12;
    return {
      transform: [
        { translateX: clamp(roll  * d, -d, d) },
        { translateY: clamp(pitch * d, -d, d) },
      ],
    };
  });

  const numberLayer = useAnimatedStyle(() => {
    'worklet';
    const { roll, pitch } = rotation.sensor.value;
    const d = 8;
    return {
      transform: [
        { translateX: clamp(roll  * d, -d, d) },
        { translateY: clamp(pitch * d, -d, d) },
      ],
    };
  });

  const titleLayer = useAnimatedStyle(() => {
    'worklet';
    const { roll, pitch } = rotation.sensor.value;
    const d = 4;
    return {
      transform: [
        { translateX: clamp(roll  * d, -d, d) },
        { translateY: clamp(pitch * d, -d, d) },
      ],
    };
  });

  // ── Derived view-state ────────────────────────────────────────────
  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View
          entering={FadeInDown.springify().damping(16)}
          style={styles.header}
        >
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}</Text>
          </View>
          <Pressable
            style={styles.signOutBtn}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
          </Pressable>
        </Animated.View>

        {/* ── Birthday banner ── */}
        {isBirthday() && (
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={styles.birthdayBanner}
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

        {/* ── Hero card with gyro parallax ── */}
        <Animated.View style={heroTiltStyle}>
          <GoldCard
            entranceIndex={1}
            contentStyle={{ padding: theme.spacing.xl }}
          >
            <Animated.View style={glowLayer}>
              <Text style={styles.heroNumber}>613</Text>
            </Animated.View>
            <Animated.View style={numberLayer}>
              <Text
                style={styles.heroTitle}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                BARBERSHOP
              </Text>
            </Animated.View>
            <Animated.View style={titleLayer}>
              <Text style={styles.heroSubtitle}>Ottawa's finest cuts</Text>
            </Animated.View>

            <View style={styles.heroBtnWrap}>
              <PremiumButton
                label="BOOK NOW"
                onPress={() => navigation.navigate('BookingFlow')}
                rightIcon={
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={theme.colors.textInverse}
                  />
                }
                style={styles.heroBtn}
                labelStyle={styles.heroBtnLabel}
              />
            </View>
          </GoldCard>
        </Animated.View>

        {/* ── Quick actions ── */}
        <MotiView
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', delay: 200, damping: 16 }}
        >
          <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        </MotiView>

        <View style={styles.actions}>
          {QUICK_ACTIONS.map((action, i) => (
            <GoldCard
              key={action.label}
              entranceIndex={2 + i}
              onPress={() => handleQuickAction(action.label)}
              style={styles.actionCard}
              contentStyle={styles.actionCardContent}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name={action.icon}
                  size={24}
                  color={theme.colors.gold}
                />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </GoldCard>
          ))}
        </View>

        {/* ── Loyalty card ── */}
        <MotiView
          from={{ opacity: 0, translateX: -20 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', delay: 420, damping: 16 }}
        >
          <Text style={styles.sectionTitle}>LOYALTY</Text>
        </MotiView>

        <GoldCard entranceIndex={7} active={stampsEarned >= 10}>
          <View style={styles.loyaltyHeader}>
            <Text style={styles.loyaltyTitle}>YOUR STAMPS</Text>
            <Text style={styles.loyaltyCount}>{stampsEarned}/10</Text>
          </View>

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

          <Text style={styles.loyaltyHint}>
            {Math.max(0, 10 - stampsEarned)} more cuts until your free haircut!
          </Text>
        </GoldCard>
      </ScrollView>
    </View>
  );
}

// ── Styles (preserving the v2 visual identity) ─────────────────────
const styles = StyleSheet.create({
  container: {
    flex:             1,
    backgroundColor:  theme.colors.background,
  },
  scroll: {
    padding:    theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },

  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   theme.spacing.xl,
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textSecondary,
  },
  name: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 4,
  },
  signOutBtn: { padding: theme.spacing.sm },

  // ── Hero ─────────────────────────────────────────────────────────
  heroNumber: {
    fontFamily: theme.fonts.heading,
    fontSize:   80,
    color:      theme.colors.gold,
    lineHeight: 80,
  },
  heroTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xl,
    color:         theme.colors.textPrimary,
    letterSpacing: 6,
  },
  heroSubtitle: {
    fontFamily:    theme.fonts.body,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textSecondary,
    marginTop:     theme.spacing.xs,
    marginBottom:  theme.spacing.lg,
    letterSpacing: 2,
  },
  heroBtnWrap:   { alignSelf: 'flex-start' },
  heroBtn: {
    borderRadius:      theme.radius.full,
    paddingHorizontal: 0,
    minHeight:         44,
  },
  heroBtnLabel: { fontSize: theme.fontSizes.md, letterSpacing: 2 },

  // ── Section titles ───────────────────────────────────────────────
  sectionTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textSecondary,
    letterSpacing: 4,
    marginTop:     theme.spacing.xl,
    marginBottom:  theme.spacing.md,
  },

  // ── Quick actions grid ───────────────────────────────────────────
  actions: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           theme.spacing.md,
  },
  actionCard: {
    width: (width - theme.spacing.lg * 2 - theme.spacing.md) / 2,
  },
  actionCardContent: {
    alignItems: 'center',
    padding:    theme.spacing.lg,
  },
  actionIcon: {
    width:           48,
    height:          48,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    theme.spacing.sm,
  },
  actionLabel: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textPrimary,
  },

  // ── Loyalty card ─────────────────────────────────────────────────
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
    width:           28,
    height:          28,
    borderRadius:    theme.radius.full,
    borderWidth:     1.5,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stampFilled: {
    backgroundColor: theme.colors.gold,
    borderColor:     theme.colors.gold,
  },
  loyaltyHint: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
    marginTop:  theme.spacing.xs,
  },

  // ── Birthday banner ─────────────────────────────────────────────
  birthdayBanner: {
    backgroundColor: theme.colors.goldMuted,
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.md,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.md,
    marginBottom:    theme.spacing.md,
  },
  birthdayEmoji:   { fontSize: 32 },
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
