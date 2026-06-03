/**
 * RPGPanel
 *
 * Semi-transparent dark panel that floats over content (think
 * Red Dead Redemption pause-menu cards). Renders OrnamentalCorners
 * automatically as an overlay decoration.
 *
 * Pure RN primitives — Expo Go safe.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';

import OrnamentalCorners from './OrnamentalCorners';
import { theme } from '../../theme';

export interface RPGPanelProps {
  children: React.ReactNode;
  style?:   StyleProp<ViewStyle>;
  /** Override the inner padding. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Hide the corner decorations. */
  hideCorners?:  boolean;
}

function RPGPanelImpl({
  children, style, contentStyle, hideCorners = false,
}: RPGPanelProps) {
  return (
    <View style={[styles.panel, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
      {!hideCorners && <OrnamentalCorners />}
    </View>
  );
}

const RPGPanel = React.memo(RPGPanelImpl);
RPGPanel.displayName = 'RPGPanel';
export default RPGPanel;

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(8, 6, 4, 0.82)',
    borderWidth:     1,
    borderColor:     'rgba(212, 175, 55, 0.3)',
    borderRadius:    theme.radius.md,
    overflow:        'hidden',
  },
  content: {
    padding: theme.spacing.lg,
  },
});
