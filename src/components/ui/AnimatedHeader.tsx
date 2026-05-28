/**
 * AnimatedHeader
 *
 * The 3-column header used across every screen.
 *
 * Layout:
 *   [ back button 40px ]  [ flex-1 centred title ]  [ right slot 40px ]
 *
 * - Reanimated FadeInDown spring on mount
 * - Haptic feedback when the back button is pressed
 * - `onBack` falsy → renders an invisible spacer in the back column so
 *   the title stays perfectly centred
 */

import React from 'react';
import {
  StyleSheet, Text, View, Pressable, ViewStyle, StyleProp,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../../theme';

export interface AnimatedHeaderProps {
  title:    string;
  subtitle?: string;
  /** "STEP 2 OF 4" style label rendered above the title. */
  eyebrow?: string;
  /** Provide to render the back button. */
  onBack?:  () => void;
  /** Custom right-side node (icon button etc). Falls back to a 40px spacer. */
  rightSlot?: React.ReactNode;
  style?:   StyleProp<ViewStyle>;
}

function AnimatedHeaderImpl({
  title, subtitle, eyebrow, onBack, rightSlot, style,
}: AnimatedHeaderProps) {

  const handleBack = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onBack?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16)}
      style={[styles.header, style]}
    >
      {/* Left column */}
      {onBack ? (
        <Pressable
          onPress={handleBack}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.colors.textPrimary}
          />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {/* Centre column */}
      <View style={styles.center}>
        {eyebrow ? (
          <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
        ) : null}
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Right column */}
      {rightSlot ? (
        <View style={styles.rightSlot}>{rightSlot}</View>
      ) : (
        <View style={styles.spacer} />
      )}
    </Animated.View>
  );
}

const AnimatedHeader = React.memo(AnimatedHeaderImpl);
AnimatedHeader.displayName = 'AnimatedHeader';
export default AnimatedHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        theme.spacing.xxl,
    paddingBottom:     theme.spacing.md,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  spacer:    { width: 40, height: 40 },
  rightSlot: {
    width:          40, height: 40,
    alignItems:     'center', justifyContent: 'center',
  },
  center:    {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 2,
    marginBottom:  2,
  },
  title: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 4,
    textAlign:     'center',
  },
  subtitle: {
    fontFamily:    theme.fonts.body,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.textSecondary,
    marginTop:     2,
  },
});
