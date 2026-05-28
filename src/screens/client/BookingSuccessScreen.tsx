/**
 * BookingSuccessScreen
 *
 * V3 visual layer:
 * - Skia checkmark that draws itself in (path stroke progress
 *   animated from 0 → 1)
 * - 10-particle gold confetti burst expanding from the centre
 * - Title + summary animate in with Reanimated springs
 * - Summary card is a GoldCard, CTA is a PremiumButton (success
 *   notification haptic on press)
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeInUp, FadeIn, useSharedValue, useAnimatedStyle,
  withDelay, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import {
  Canvas, Path, Skia,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import { GoldCard, PremiumButton } from '../../components/ui';

interface Props {
  navigation: any;
  route:      any;
}

// ── Checkmark Skia layer ───────────────────────────────────────────
const CHECK_SIZE = 120;

const CheckmarkImpl = () => {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    // Drawn inside a 120x120 box. Tuned to look balanced.
    p.moveTo(32, 62);
    p.lineTo(54, 84);
    p.lineTo(92, 40);
    return p;
  }, []);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      280,
      withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
  }, [progress]);

  return (
    <Canvas style={{ width: CHECK_SIZE, height: CHECK_SIZE }}>
      <Path
        path={path}
        color={theme.colors.textInverse}
        style="stroke"
        strokeWidth={9}
        strokeJoin="round"
        strokeCap="round"
        start={0}
        end={progress}
      />
    </Canvas>
  );
};
const Checkmark = React.memo(CheckmarkImpl);

// ── Confetti particle ──────────────────────────────────────────────
interface ParticleProps {
  angle:    number;
  distance: number;
  delay:    number;
  color:    string;
  rotation: number;
}

const PARTICLE_COLORS = [
  theme.colors.gold,
  theme.colors.goldLight,
  theme.colors.textPrimary,
  theme.colors.goldDark,
];

const Particle = ({
  angle, distance, delay, color, rotation,
}: ParticleProps) => {
  const progress = useSharedValue(0);
  const opacity  = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [progress, opacity, delay]);

  const animatedStyle = useAnimatedStyle(() => {
    const dx = Math.cos(angle) * distance * progress.value;
    const dy = Math.sin(angle) * distance * progress.value;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${rotation * progress.value}deg` },
        { scale: 1 - progress.value * 0.4 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
};

// ── Screen ─────────────────────────────────────────────────────────
export default function BookingSuccessScreen({ navigation, route }: Props) {
  const { serviceName, barberName, scheduledAt } = route.params;
  const scheduled = new Date(scheduledAt);

  // Fire success haptic once on mount.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      .catch(() => undefined);
  }, []);

  const formatDate = (date: Date) => date.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  const formatTime = (date: Date) => date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  // 10 evenly-distributed particles + small per-particle jitter
  const particles = useMemo(() => {
    const count = 10;
    return Array.from({ length: count }).map((_, i) => {
      const base = (i / count) * Math.PI * 2;
      const angle = base + (Math.random() - 0.5) * 0.6;
      const distance = 110 + Math.random() * 60;
      const delay = 380 + i * 28;
      const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
      const rotation = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 180);
      return { angle, distance, delay, color, rotation };
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Confetti origin layer — sits behind the checkmark circle */}
      <View pointerEvents="none" style={styles.confettiOrigin}>
        {particles.map((p, i) => (
          <Particle
            key={i}
            angle={p.angle}
            distance={p.distance}
            delay={p.delay}
            color={p.color}
            rotation={p.rotation}
          />
        ))}
      </View>

      {/* Checkmark circle */}
      <Animated.View
        entering={FadeIn.duration(220)}
        style={styles.checkWrap}
      >
        <View style={styles.checkCircle}>
          <Checkmark />
        </View>
      </Animated.View>

      {/* Title + subtitle */}
      <Animated.View
        entering={FadeInUp.delay(180).springify().damping(15)}
        style={styles.titleWrap}
      >
        <Text style={styles.title}>BOOKING SENT!</Text>
        <Text style={styles.subtitle}>Waiting for barber confirmation</Text>
      </Animated.View>

      {/* Summary card */}
      <Animated.View
        entering={FadeInUp.delay(360).springify().damping(16)}
        style={styles.summaryWrap}
      >
        <GoldCard disableEntrance>
          <View style={styles.summaryRow}>
            <Ionicons name="cut-outline"      size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{serviceName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline"   size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{barberName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatDate(scheduled)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="time-outline"     size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatTime(scheduled)}</Text>
          </View>
        </GoldCard>

        <Animated.Text
          entering={FadeIn.delay(620).duration(500)}
          style={styles.hint}
        >
          You'll be notified once your barber confirms the appointment.
        </Animated.Text>
      </Animated.View>

      {/* Back to Home */}
      <View style={styles.footer}>
        <PremiumButton
          label="BACK TO HOME"
          fullWidth
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'ClientTabs' }],
          })}
        />
      </View>
    </View>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: theme.colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         theme.spacing.lg,
  },

  // Confetti origin point — centred over the checkmark
  confettiOrigin: {
    position: 'absolute',
    top:      '38%',
    left:     SCREEN_W / 2,
    width:    0,
    height:   0,
    alignItems:     'center',
    justifyContent: 'center',
  },
  particle: {
    position:     'absolute',
    width:        9,
    height:       9,
    borderRadius: 2,
  },

  // Checkmark
  checkWrap:   { marginBottom: theme.spacing.xl },
  checkCircle: {
    width:           140,
    height:          140,
    borderRadius:    70,
    backgroundColor: theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    ...theme.shadows.gold,
  },

  // Title
  titleWrap: { alignItems: 'center', marginBottom: theme.spacing.xl },
  title: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 4,
    marginBottom:  theme.spacing.sm,
  },
  subtitle: {
    fontFamily:    theme.fonts.body,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.textSecondary,
    letterSpacing: 1,
  },

  // Summary card
  summaryWrap: { width: '100%', alignItems: 'center' },
  summaryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.md,
    paddingVertical: 6,
  },
  summaryText: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textPrimary,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
    textAlign:  'center',
    lineHeight: 22,
    marginTop:  theme.spacing.lg,
  },

  // Footer CTA
  footer: {
    position: 'absolute',
    bottom:   theme.spacing.xxl,
    left:     theme.spacing.lg,
    right:    theme.spacing.lg,
  },
});
