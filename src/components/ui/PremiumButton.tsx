/**
 * PremiumButton
 *
 * Single source of truth for buttons across the app.
 * - Spring scale on press (Reanimated)
 * - Light haptic on press
 * - Gold linear-gradient fill for the primary variant,
 *   outlined gold for the secondary variant, ghost for tertiary
 * - Animated opacity on disabled state
 *
 * Props are designed so that you can drop-in replace a
 * TouchableOpacity by changing the tag and forwarding `onPress`.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text,
  View, ViewStyle, TextStyle, StyleProp, GestureResponderEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { theme } from '../../theme';

export type PremiumButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface PremiumButtonProps {
  label:        string;
  onPress:      (e: GestureResponderEvent) => void;
  variant?:     PremiumButtonVariant;
  disabled?:    boolean;
  loading?:     boolean;
  leftIcon?:    React.ReactNode;
  rightIcon?:   React.ReactNode;
  style?:       StyleProp<ViewStyle>;
  labelStyle?:  StyleProp<TextStyle>;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
  fullWidth?:   boolean;
}

const SPRING_PRESS_IN  = { damping: 14, stiffness: 220 } as const;
const SPRING_PRESS_OUT = { damping: 12, stiffness: 180 } as const;

function PremiumButtonImpl({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  labelStyle,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  fullWidth = false,
}: PremiumButtonProps) {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(disabled ? 0.4 : 1);

  // Track disabled opacity changes
  React.useEffect(() => {
    opacity.value = withTiming(disabled ? 0.4 : 1, { duration: 180 });
  }, [disabled, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, SPRING_PRESS_IN);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_PRESS_OUT);
  };

  const handlePress = (e: GestureResponderEvent) => {
    // Haptics can fail on some devices (older Android) — swallow.
    Haptics.impactAsync(hapticStyle).catch(() => undefined);
    onPress(e);
  };

  const colors = useMemo(() => {
    if (variant === 'primary') {
      return [theme.colors.goldLight, theme.colors.gold, theme.colors.goldDark] as const;
    }
    return ['transparent', 'transparent'] as const;
  }, [variant]);

  const isPrimary   = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Animated.View
      style={[
        styles.root,
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading }}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.fill,
            isSecondary && styles.secondary,
            variant === 'ghost' && styles.ghost,
          ]}
        >
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator
                size="small"
                color={isPrimary ? theme.colors.textInverse : theme.colors.gold}
              />
            ) : (
              <>
                {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
                <Text
                  style={[
                    styles.label,
                    isPrimary    ? styles.labelPrimary
                                 : isSecondary ? styles.labelSecondary
                                              : styles.labelGhost,
                    labelStyle,
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
                {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
              </>
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const PremiumButton = React.memo(PremiumButtonImpl);
PremiumButton.displayName = 'PremiumButton';
export default PremiumButton;

const styles = StyleSheet.create({
  root: {
    borderRadius: theme.radius.md,
    overflow:     'hidden',
    ...theme.shadows.gold,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressable: { width: '100%' },
  fill: {
    paddingVertical:   theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems:        'center',
    justifyContent:    'center',
    borderRadius:      theme.radius.md,
    minHeight:         52,
  },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  content: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'center',
    gap:            theme.spacing.sm,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.lg,
    letterSpacing: 3,
  },
  labelPrimary:   { color: theme.colors.textInverse },
  labelSecondary: { color: theme.colors.gold },
  labelGhost:     { color: theme.colors.gold },
});
