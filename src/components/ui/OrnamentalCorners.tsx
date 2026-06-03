/**
 * OrnamentalCorners
 *
 * Four small X-shaped crosshair decorations, one at each corner of
 * the parent. Drawn purely with `View`s — Expo-Go safe, no Skia.
 *
 * Drop it inside any container as the LAST child; it absolutely
 * fills the parent and is `pointerEvents="none"` so it never
 * intercepts touches.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';

import { theme } from '../../theme';

export interface OrnamentalCornersProps {
  /** Line length (each of the two crossing lines is `size`px long). */
  size?:    number;
  /** Stroke colour. Defaults to theme gold. */
  color?:   string;
  /** Overall opacity of the decoration. */
  opacity?: number;
  /** Inset from the parent edges. */
  inset?:   number;
  style?:   StyleProp<ViewStyle>;
}

function OrnamentalCornersImpl({
  size = 16,
  color = theme.colors.gold,
  opacity = 0.6,
  inset = 6,
  style,
}: OrnamentalCornersProps) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }, style]}
    >
      <Corner position="topLeft"     size={size} color={color} inset={inset} />
      <Corner position="topRight"    size={size} color={color} inset={inset} />
      <Corner position="bottomLeft"  size={size} color={color} inset={inset} />
      <Corner position="bottomRight" size={size} color={color} inset={inset} />
    </View>
  );
}

interface CornerProps {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  size:     number;
  color:    string;
  inset:    number;
}

function Corner({ position, size, color, inset }: CornerProps) {
  const placement: ViewStyle = (() => {
    switch (position) {
      case 'topLeft':     return { top: inset,     left: inset     };
      case 'topRight':    return { top: inset,     right: inset    };
      case 'bottomLeft':  return { bottom: inset,  left: inset     };
      case 'bottomRight': return { bottom: inset,  right: inset    };
    }
  })();

  // Two 1-px wide lines crossed: one horizontal, one vertical.
  // Each is `size` long, centred on the same point.
  return (
    <View
      style={[
        styles.cornerBox,
        { width: size, height: size },
        placement,
      ]}
    >
      <View
        style={[
          styles.line,
          {
            top:             (size - 1) / 2,
            width:           size,
            height:          1,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.line,
          {
            left:            (size - 1) / 2,
            width:           1,
            height:          size,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

const OrnamentalCorners = React.memo(OrnamentalCornersImpl);
OrnamentalCorners.displayName = 'OrnamentalCorners';
export default OrnamentalCorners;

const styles = StyleSheet.create({
  cornerBox: { position: 'absolute' },
  line:      { position: 'absolute' },
});
