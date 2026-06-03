/**
 * CinematicBackground
 *
 * Full-screen image background with a top-to-bottom dark gradient
 * overlay so foreground text stays legible. Renders behind whatever
 * is mounted on top of it.
 *
 * Use as the FIRST child of a flex:1 screen container:
 *
 *   <View style={{ flex: 1 }}>
 *     <CinematicBackground source={require('../assets/bg.jpg')} />
 *     ...rest of the screen...
 *   </View>
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Image as ExpoImage, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export interface CinematicBackgroundProps {
  /** Anything expo-image accepts: require() result, URI object,
   *  remote string, or a blurhash placeholder. */
  source:   ImageSource | number | string;
  /** Override the gradient strength. Defaults to subtle top → strong bottom. */
  topAlpha?:    number;
  bottomAlpha?: number;
  style?:   StyleProp<ViewStyle>;
  /** How quickly the image fades in once it loads. */
  transitionMs?: number;
}

function CinematicBackgroundImpl({
  source,
  topAlpha    = 0.1,
  bottomAlpha = 0.6,
  style,
  transitionMs = 400,
}: CinematicBackgroundProps) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <ExpoImage
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={transitionMs}
      />
      <LinearGradient
        colors={[
          `rgba(0,0,0,${topAlpha})`,
          `rgba(0,0,0,${bottomAlpha})`,
        ]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const CinematicBackground = React.memo(CinematicBackgroundImpl);
CinematicBackground.displayName = 'CinematicBackground';
export default CinematicBackground;
