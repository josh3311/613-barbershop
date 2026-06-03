/**
 * RPGSelectionRow
 *
 * A single row in a Red Dead-style selection list.
 *
 *   ┌────┐
 *   │ ⚔  │   STYLE NAME                          ▶▶
 *   └────┘
 *
 * Selected state animates on the UI thread:
 *   - row scale springs to 1.02
 *   - border + background interpolate to gold tints
 *   - ">>" fades in and slides from translateX 10 → 0
 *
 * Entrance animates from below with a per-row stagger so a list of
 * rows cascades in.
 *
 * Expo Go safe — no Skia, no native modules beyond expo-haptics.
 */

import React, { useEffect } from 'react';
import {
  StyleSheet, Text, View, Pressable, ViewStyle, StyleProp,
} from 'react-native';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue,
  withSpring, withTiming, interpolate, interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { theme } from '../../theme';

export interface RPGSelectionRowProps {
  label:    string;
  icon:     keyof typeof Ionicons.glyphMap;
  /** Optional photo for the left slot. When set, a circular image is
   *  rendered in place of `icon` (e.g. a barber avatar). */
  imageUri?: string | null;
  selected: boolean;
  onPress:  () => void;
  /** Index in a list — used to stagger the entrance animation. */
  entranceIndex?: number;
  /** Skip the entrance animation (e.g. when the row is mounted alone). */
  disableEntrance?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Colour stops for the animated row (idle → selected).
const ROW_BORDER_IDLE     = 'rgba(212, 175, 55, 0.25)';
const ROW_BORDER_SELECTED = 'rgba(212, 175, 55, 0.9)';
const ROW_BG_IDLE         = 'rgba(8, 6, 4, 0.5)';
const ROW_BG_SELECTED     = 'rgba(212, 175, 55, 0.12)';
const ICON_BORDER_IDLE    = 'rgba(212, 175, 55, 0.35)';
const ICON_BORDER_SEL     = 'rgba(212, 175, 55, 0.9)';

function RPGSelectionRowImpl(props: RPGSelectionRowProps) {
  const {
    label, icon, imageUri, selected, onPress,
    entranceIndex = 0, disableEntrance = false, style,
  } = props;

  // Drives every selected-state animation. Lives on the UI thread.
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, {
      damping:   16,
      stiffness: 220,
      mass:      0.7,
    });
  }, [selected, progress]);

  // Row container — scale + border + bg interpolated.
  const rowStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.02]) },
    ],
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [ROW_BORDER_IDLE, ROW_BORDER_SELECTED],
    ),
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [ROW_BG_IDLE, ROW_BG_SELECTED],
    ),
  }));

  // Icon box border tints with the row.
  const iconBoxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [ICON_BORDER_IDLE, ICON_BORDER_SEL],
    ),
  }));

  // ">>" appears and slides in from the right when selected.
  const arrowStyle = useAnimatedStyle(() => ({
    opacity:   progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [10, 0]) },
    ],
  }));

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  const entering = disableEntrance
    ? undefined
    : FadeInDown.springify().damping(15).delay(entranceIndex * 60);

  return (
    <Animated.View entering={entering} style={style}>
      <Pressable onPress={handlePress} accessibilityRole="button">
        <Animated.View style={[styles.row, rowStyle]}>
          {/* Left — icon box (circular photo when `imageUri` is set) */}
          <Animated.View
            style={[styles.iconBox, imageUri ? styles.iconBoxRound : null, iconBoxStyle]}
          >
            {imageUri ? (
              <ExpoImage
                source={{ uri: imageUri }}
                style={styles.iconImage}
                contentFit="cover"
                transition={300}
              />
            ) : (
              <Ionicons name={icon} size={20} color={theme.colors.gold} />
            )}
          </Animated.View>

          {/* Centre — label */}
          <View style={styles.labelWrap}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>

          {/* Right — animated ">>" (always mounted; opacity does the show/hide) */}
          <Animated.Text style={[styles.arrow, arrowStyle]}>
            ▶▶
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const RPGSelectionRow = React.memo(RPGSelectionRowImpl);
RPGSelectionRow.displayName = 'RPGSelectionRow';
export default RPGSelectionRow;

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth:     1,
    borderRadius:    theme.radius.sm,
  },
  iconBox: {
    width:           40,
    height:          40,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    backgroundColor: 'rgba(8, 6, 4, 0.7)',
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  iconBoxRound: { borderRadius: 20 },
  iconImage:    { width: '100%', height: '100%' },
  labelWrap: { flex: 1 },
  label: {
    fontFamily:    theme.fonts.heading,   // BebasNeue per theme
    fontSize:      theme.fontSizes.lg,
    color:         theme.colors.textPrimary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  arrow: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.gold,
    letterSpacing: 1,
  },
});
