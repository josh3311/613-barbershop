/**
 * GoldCard
 *
 * Premium surface card used across the app.
 *
 * SKIA TEMPORARILY DISABLED — see the comments in the audit branch.
 * The original implementation drew a radial gold glow and a thin gold
 * stroked border with @shopify/react-native-skia. The Skia layer is
 * commented out and replaced with a plain View that uses real
 * borderWidth + theme.shadows.gold so the card still reads as
 * "premium" without any Skia.
 *
 * All Reanimated behaviour is preserved exactly (entrance animation,
 * press scale spring, active border-color flip).
 */

import React from 'react';
import {
  StyleSheet, View, Pressable, ViewStyle, StyleProp,
  GestureResponderEvent,
} from 'react-native';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
// import {
//   Canvas, RoundedRect, Paint, RadialGradient, vec,
// } from '@shopify/react-native-skia';   // disabled during Android Skia audit
import * as Haptics from 'expo-haptics';

import { theme } from '../../theme';

export interface GoldCardProps {
  children: React.ReactNode;
  style?:   StyleProp<ViewStyle>;
  /** Override the inner content padding (e.g. set padding: 0 if the
   *  child manages its own padding). */
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: (e: GestureResponderEvent) => void;
  /** Skip the entrance animation when the card is rendered inside
   *  a list that already animates each row. */
  disableEntrance?: boolean;
  /** Index in a list — used to stagger entrance. */
  entranceIndex?:   number;
  /** Tint the glow stronger when the card is "active". */
  active?:          boolean;
  /** Was used to opt out of the Skia layer. Kept as a no-op prop so
   *  callers don't need to be edited. */
  flat?:            boolean;
}

function GoldCardImpl(props: GoldCardProps) {
  const {
    children, style, contentStyle, onPress, disableEntrance,
    entranceIndex = 0, active = false,
  } = props;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const entering = disableEntrance
    ? undefined
    : FadeInDown.springify().damping(15).delay(entranceIndex * 60);

  const inner = (
    <Animated.View
      entering={entering}
      style={[
        styles.card,
        active && styles.cardActive,
        animatedStyle,
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </Animated.View>
  );

  if (!onPress) return inner;

  const handlePressIn = () => {
    scale.value = withSpring(0.985, { damping: 16, stiffness: 220 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
  };
  const handlePress = (e: GestureResponderEvent) => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {inner}
    </Pressable>
  );
}

const GoldCard = React.memo(GoldCardImpl);
GoldCard.displayName = 'GoldCard';
export default GoldCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor:  theme.colors.surface,
    borderRadius:     theme.radius.lg,
    borderWidth:      1,
    borderColor:      'rgba(212, 175, 55, 0.35)',   // mimics Skia border tint
    overflow:         'hidden',
    ...theme.shadows.md,
  },
  cardActive: {
    borderColor:      'rgba(212, 175, 55, 0.7)',
    backgroundColor:  'rgba(212, 175, 55, 0.06)',   // mimics the Skia glow
    ...theme.shadows.gold,
  },
  content: {
    padding: theme.spacing.lg,
    zIndex:  1,
  },
});
