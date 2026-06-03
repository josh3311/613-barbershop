/**
 * RPGSelectionRow
 *
 * A single row in a Red Dead-style selection list.
 *
 *   ┌────┐
 *   │ ⚔  │   STYLE NAME                          >>
 *   └────┘
 *
 * Expo Go safe — uses ONLY React Native's built-in Animated API
 * (no Reanimated / worklets):
 *   - entrance: Animated.timing on opacity + translateY (native driver)
 *   - selected scale: Animated.spring to 1.02 (native driver)
 *   - selected border/background: direct color switch (no interpolation)
 *   - ">>" indicator: simple conditional render when selected
 */

import React, { useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, ViewStyle, StyleProp, Animated,
} from 'react-native';
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

// Colours for the row (idle vs selected) — switched directly, no interpolation.
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

  // Entrance (opacity + slide up) and selected-scale, both on the native driver.
  const entrance   = useRef(new Animated.Value(disableEntrance ? 1 : 0)).current;
  const selectAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (disableEntrance) {
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue:        1,
      duration:       320,
      delay:          entranceIndex * 60,
      useNativeDriver: true,
    }).start();
  }, [disableEntrance, entrance, entranceIndex]);

  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue:        selected ? 1 : 0,
      friction:       7,
      tension:        220,
      useNativeDriver: true,
    }).start();
  }, [selected, selectAnim]);

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  const entranceStyle = {
    opacity:   entrance,
    transform: [
      { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  };

  const scaleStyle = {
    transform: [
      { scale: selectAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
    ],
  };

  return (
    <Animated.View style={[entranceStyle, style]}>
      <Pressable onPress={handlePress} accessibilityRole="button" accessibilityState={{ selected }}>
        <Animated.View
          style={[
            styles.row,
            {
              borderColor:     selected ? ROW_BORDER_SELECTED : ROW_BORDER_IDLE,
              backgroundColor: selected ? ROW_BG_SELECTED : ROW_BG_IDLE,
            },
            scaleStyle,
          ]}
        >
          {/* Left — icon box (circular photo when `imageUri` is set) */}
          <View
            style={[
              styles.iconBox,
              imageUri ? styles.iconBoxRound : null,
              { borderColor: selected ? ICON_BORDER_SEL : ICON_BORDER_IDLE },
            ]}
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
          </View>

          {/* Centre — label */}
          <View style={styles.labelWrap}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
          </View>

          {/* Right — ">>" appears when selected */}
          {selected ? <Text style={styles.arrow}>{'>>'}</Text> : null}
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
