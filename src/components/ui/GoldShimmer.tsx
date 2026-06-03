/**
 * GoldShimmer
 *
 * Skeleton placeholder with a horizontal gold sweep. Replaces
 * ActivityIndicator inside list / card loading states.
 *
 * Two ways to use it:
 *
 *   // Standalone block of a given size
 *   <GoldShimmer width={120} height={16} />
 *
 *   // As a wrapper (fills its parent, useful inside an existing card)
 *   <GoldShimmer fill />
 *
 * The sweep is a translated linear gradient — no Skia needed, so this
 * is cheap to render in long lists.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '../../theme';

export interface GoldShimmerProps {
  width?:  number | `${number}%`;
  height?: number;
  /** Fill the parent instead of using width/height. */
  fill?:   boolean;
  /** Override the corner radius (defaults to theme.radius.md). */
  radius?: number;
  style?:  StyleProp<ViewStyle>;
}

const SWEEP_DURATION = 1300;

function GoldShimmerImpl({
  width = 120, height = 16, fill = false,
  radius = theme.radius.md, style,
}: GoldShimmerProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue:        1,
        duration:       SWEEP_DURATION,
        easing:         Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  // Slide a gradient strip across the placeholder. We translate
  // from -1×width to +1×width so the highlight sweeps fully off
  // each side before looping. For percentage widths we approximate
  // with a 300px base (each side off-screen).
  const baseWidth = typeof width === 'number' ? width : 300;
  const sweepStyle = {
    transform: [
      {
        translateX: progress.interpolate({
          inputRange:  [0, 1],
          outputRange: [-baseWidth, baseWidth],
        }),
      },
    ],
  };

  return (
    <View
      style={[
        styles.base,
        fill ? styles.fill : { width, height },
        { borderRadius: radius },
        style,
      ]}
    >
      <Animated.View style={[styles.sweepWrap, sweepStyle]}>
        <LinearGradient
          colors={[
            'rgba(212, 175, 55, 0)',
            'rgba(212, 175, 55, 0.22)',
            'rgba(212, 175, 55, 0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const GoldShimmer = React.memo(GoldShimmerImpl);
GoldShimmer.displayName = 'GoldShimmer';
export default GoldShimmer;

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    overflow:        'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  sweepWrap: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
  },
});
