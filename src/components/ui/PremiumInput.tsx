/**
 * PremiumInput
 *
 * TextInput with an animated gold border that brightens on focus.
 * Drop-in replacement for the auth-screen inputs.
 */

import React, { useRef, useState } from 'react';
import {
  Animated, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, StyleProp,
} from 'react-native';

import { theme } from '../../theme';

export interface PremiumInputProps extends TextInputProps {
  label?: string;
  /** Style applied to the outer animated container. */
  containerStyle?: StyleProp<ViewStyle>;
}

function PremiumInputImpl({
  label, containerStyle, onFocus, onBlur, style, ...rest
}: PremiumInputProps) {
  const [focused, setFocused] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const animatedBorder = {
    borderColor: progress.interpolate({
      inputRange:  [0, 1],
      outputRange: [theme.colors.border, theme.colors.gold],
    }),
  };

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Animated.View style={[styles.box, animatedBorder]}>
        <TextInput
          {...rest}
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: false }).start();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: false }).start();
            onBlur?.(e);
          }}
        />
      </Animated.View>
      {/* keep `focused` referenced so accessibility tools have it */}
      <View accessibilityState={{ selected: focused }} />
    </View>
  );
}

const PremiumInput = React.memo(PremiumInputImpl);
PremiumInput.displayName = 'PremiumInput';
export default PremiumInput;

const styles = StyleSheet.create({
  label: {
    fontFamily:     theme.fonts.medium,
    fontSize:       theme.fontSizes.sm,
    color:          theme.colors.textSecondary,
    marginBottom:   theme.spacing.xs,
    letterSpacing:  1,
    textTransform:  'uppercase',
  },
  box: {
    backgroundColor: theme.colors.surface,
    borderWidth:     1,
    borderRadius:    theme.radius.md,
    marginBottom:    theme.spacing.md,
  },
  input: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical:   theme.spacing.md,
    color:             theme.colors.textPrimary,
    fontFamily:        theme.fonts.body,
    fontSize:          theme.fontSizes.md,
  },
});
