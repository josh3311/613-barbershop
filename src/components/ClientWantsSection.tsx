import React from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HaircutStyle } from '../types';
import { theme } from '../theme';

interface Props {
  style:         HaircutStyle;
  onShowGuide?:  () => void;
}

/**
 * CLIENT WANTS — pure presentational card section.
 *
 * Renders below the booking info on a barber's booking card. Shows the
 * style name, optional reference + try-on thumbnails, and an optional
 * description. If `onShowGuide` is provided, a HOW TO DO THIS STYLE
 * button is rendered at the bottom (Schedule screen only).
 *
 * No state, no Firestore — caller owns all data + handlers.
 */
export default function ClientWantsSection({ style, onShowGuide }: Props) {
  const hasName = typeof style.name === 'string' && style.name.trim().length > 0;
  if (!hasName) return null;

  const hasDescription =
    typeof style.description === 'string' && style.description.trim().length > 0;

  const referenceUrl = style.referenceImageUrl;
  const tryOnUrl     = style.tryOnImageUrl;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>CLIENT WANTS</Text>
      <Text style={styles.styleName} numberOfLines={2}>{style.name}</Text>

      <View style={styles.thumbsRow}>
        {/* Reference thumbnail */}
        <View style={styles.thumbSlot}>
          {/* spacer so the try-on label above doesn't push this row out of line */}
          <View style={styles.thumbLabelSpacer} />
          {referenceUrl ? (
            <Image
              source={{ uri: referenceUrl }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="cut" size={28} color={theme.colors.textMuted} />
            </View>
          )}
        </View>

        {/* Try-on thumbnail (with label) */}
        <View style={styles.thumbSlot}>
          <Text style={styles.tryOnLabel}>TRY-ON</Text>
          {tryOnUrl ? (
            <Image
              source={{ uri: tryOnUrl }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="cut" size={28} color={theme.colors.textMuted} />
            </View>
          )}
        </View>
      </View>

      {hasDescription ? (
        <Text style={styles.description} numberOfLines={2}>
          {style.description}
        </Text>
      ) : null}

      {onShowGuide ? (
        <TouchableOpacity
          style={styles.guideBtn}
          onPress={onShowGuide}
          activeOpacity={0.7}
        >
          <Text style={styles.guideBtnText}>HOW TO DO THIS STYLE</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const THUMB_SIZE = 80;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  label: {
    fontFamily: theme.fonts.heading,
    fontSize: 12,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  styleName: {
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-end',
  },
  thumbSlot: {
    alignItems: 'center',
    gap: 2,
  },
  thumbLabelSpacer: {
    // Matches tryOnLabel height so both thumbs align on the same baseline
    height: 14,
  },
  tryOnLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: 10,
    color: theme.colors.gold,
    letterSpacing: 2,
    height: 14,
    textAlign: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.surface,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  guideBtn: {
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: 13,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
});
