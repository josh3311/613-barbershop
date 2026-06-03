/**
 * ScissorDivider
 *
 *   ───────── ✂ ─────────
 *
 * Thin gold horizontal rule with a scissor glyph in the middle.
 * Pure View + Text, no native modules.
 */

import React from 'react';
import { StyleSheet, View, Text, ViewStyle, StyleProp } from 'react-native';

import { theme } from '../../theme';

export interface ScissorDividerProps {
  /** Override the surrounding vertical margin. */
  marginVertical?: number;
  /** Override the line tint. */
  color?:          string;
  style?:          StyleProp<ViewStyle>;
}

function ScissorDividerImpl({
  marginVertical = 8,
  color = theme.colors.gold,
  style,
}: ScissorDividerProps) {
  return (
    <View style={[styles.row, { marginVertical }, style]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <Text style={[styles.scissor, { color }]}>✂</Text>
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
}

const ScissorDivider = React.memo(ScissorDividerImpl);
ScissorDivider.displayName = 'ScissorDivider';
export default ScissorDivider;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.sm,
  },
  line: {
    flex:    1,
    height:  1,
    opacity: 0.4,
  },
  scissor: {
    fontSize: 14,
    opacity:  0.9,
    // System font here — emoji renders consistently across Android/iOS
    // without relying on the loaded custom font weights.
  },
});
