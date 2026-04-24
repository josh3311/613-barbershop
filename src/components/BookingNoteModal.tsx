import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, radius, shadows } from '@/theme';

interface BookingNoteModalProps {
  visible: boolean;
  styleName: string;
  /** Called when the user confirms. Will receive a trimmed note (or empty string if skipped). */
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/**
 * Pre-confirmation note modal shown right before "Book this style" finalises.
 * Spec FIX 5: title in white bold, multi-line text input with gold border on
 * `#1A1A1A`, "Skip" + "Confirm booking" actions.
 */
export default function BookingNoteModal({
  visible,
  styleName,
  onConfirm,
  onCancel,
}: BookingNoteModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) setNote('');
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <Pressable
            style={[styles.card, { marginBottom: insets.bottom + spacing.lg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.title}>Add a note for your barber</Text>
            {styleName ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                Booking: {styleName}
              </Text>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="e.g. Keep it longer on top, fade the sides low..."
              placeholderTextColor={colors.greyDark}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
              accessibilityLabel="Note for your barber"
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => onConfirm('')}
                accessibilityRole="button"
                accessibilityLabel="Skip note and confirm booking"
              >
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => onConfirm(note.trim())}
                accessibilityRole="button"
                accessibilityLabel="Confirm booking"
              >
                <Text style={styles.confirmBtnText}>Confirm booking</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: '#111111',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing.lg,
    ...shadows.md,
  },
  title: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.body,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 84,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fonts.size.md,
    fontFamily: fonts.body,
    color: colors.white,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  skipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  skipBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodySemiBold,
    color: colors.grey,
  },
  confirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
  },
  confirmBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
  },
});
