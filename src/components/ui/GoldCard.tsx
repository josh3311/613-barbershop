/**
 * GoldCard
 *
 * Premium surface card used across the app.
 * - Skia Canvas behind the content draws a radial gold glow from
 *   the centre and a thin gold rounded-rect border
 * - Reanimated entering animation (FadeInDown spring) by default
 * - Optional `onPress` turns it into a Pressable with a soft
 *   scale spring + light haptic
 *
 * Skia transparent caveat (see CLAUDE.md Architecture Notes):
 * never use the string "transparent" as a Skia colour — we use
 * fully-alpha-zero rgba() strings instead.
 */

import React, { useState } from 'react';
import {
  StyleSheet, View, Pressable, ViewStyle, StyleProp,
  LayoutChangeEvent, GestureResponderEvent,
} from 'react-native';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import {
  Canvas, RoundedRect, Paint, RadialGradient, vec,
} from '@shopify/react-native-skia';
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
  /** Disable the Skia layer (cheaper, used when there are many
   *  rows on screen at once). */
  flat?:            boolean;
}

const GLOW_GOLD_HEX     = '#D4AF37';
const GLOW_GOLD_RGBA    = 'rgba(212, 175, 55, 0.16)';   // visible
const GLOW_GOLD_RGBA_ZERO = 'rgba(212, 175, 55, 0)';    // explicit alpha-0
const BORDER_GOLD_RGBA  = 'rgba(212, 175, 55, 0.35)';
const BORDER_GOLD_ACTIVE = 'rgba(212, 175, 55, 0.7)';

// ── Skia layer (memoised — the parent re-renders on press but
//    the canvas only needs to redraw when size or `active` flip)
interface CanvasLayerProps { width: number; height: number; active: boolean; }

const SkiaLayerImpl = ({ width, height, active }: CanvasLayerProps) => {
  if (width === 0 || height === 0) return null;

  const radius = theme.radius.lg;
  const cx     = width / 2;
  const cy     = height / 2;
  // Glow reach — slightly larger than half the card so the falloff
  // doesn't hit the edge as a hard ring.
  const glowR  = Math.max(width, height) * 0.7;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Radial gold glow centred on the card */}
      <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
        <RadialGradient
          c={vec(cx, cy)}
          r={glowR}
          colors={[
            active ? 'rgba(212, 175, 55, 0.28)' : GLOW_GOLD_RGBA,
            GLOW_GOLD_RGBA_ZERO,
          ]}
        />
      </RoundedRect>

      {/* Thin gold stroked border */}
      <RoundedRect
        x={0.5}
        y={0.5}
        width={width - 1}
        height={height - 1}
        r={radius}
      >
        <Paint
          color={active ? BORDER_GOLD_ACTIVE : BORDER_GOLD_RGBA}
          style="stroke"
          strokeWidth={1}
        />
      </RoundedRect>
    </Canvas>
  );
};

const SkiaLayer = React.memo(SkiaLayerImpl);
SkiaLayer.displayName = 'GoldCard.SkiaLayer';

// ── Pressable wrapper (only mounted when onPress is provided)
function GoldCardImpl(props: GoldCardProps) {
  const {
    children, style, contentStyle, onPress, disableEntrance,
    entranceIndex = 0, active = false, flat = false,
  } = props;

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const scale = useSharedValue(1);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) {
      setSize({ w: width, h: height });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const entering = disableEntrance
    ? undefined
    : FadeInDown.springify().damping(15).delay(entranceIndex * 60);

  const inner = (
    <Animated.View
      onLayout={onLayout}
      entering={entering}
      style={[styles.card, animatedStyle, style]}
    >
      {!flat && (
        <SkiaLayer width={size.w} height={size.h} active={active} />
      )}
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
    overflow:         'hidden',
    // Subtle non-skia shadow so the card still has depth even
    // before its Skia layer is laid out.
    ...theme.shadows.md,
  },
  content: {
    padding: theme.spacing.lg,
    zIndex:  1,
  },
});
