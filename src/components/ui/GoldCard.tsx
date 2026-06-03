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

import React, { useRef } from 'react';
import {
  Animated, StyleSheet, View, Pressable, ViewStyle, StyleProp,
  GestureResponderEvent,
} from 'react-native';
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

  // `disableEntrance` / `entranceIndex` are retained in the props API for
  // compatibility; entrance animations were removed with Reanimated.
  void disableEntrance;
  void entranceIndex;

  const scale = useRef(new Animated.Value(1)).current;

  const animatedStyle = {
    transform: [{ scale }],
  };

  const inner = (
    <Animated.View
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
    Animated.spring(scale, { toValue: 0.985, friction: 7, tension: 220, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }).start();
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
