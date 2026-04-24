import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing, radius, icons } from '@/theme';

export interface RatingModalProps {
  visible: boolean;
  barberName: string;
  serviceName: string;
  dateLabel: string;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

export default function RatingModal({
  visible,
  barberName,
  serviceName,
  dateLabel,
  onClose,
  onSubmit,
}: RatingModalProps): React.JSX.Element {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStars(0);
      setComment('');
      setSubmitting(false);
    }
  }, [visible]);

  async function handleSubmit(): Promise<void> {
    if (stars < 1 || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(stars, comment.trim());
      onClose();
    } catch {
      // Parent may show an error; keep modal open
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = stars >= 1 && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>
            How was your cut with {barberName}?
          </Text>
          <Text style={styles.subtitle}>
            {serviceName}
            {' · '}
            {dateLabel}
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setStars(n)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                accessibilityState={{ selected: stars >= n }}
              >
                <Ionicons
                  name={stars >= n ? icons.star : icons.starOutline}
                  size={40}
                  color={stars >= n ? colors.gold : colors.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Leave a comment (optional)"
            placeholderTextColor={colors.grey}
            value={comment}
            onChangeText={setComment}
            multiline
            textAlignVertical="top"
            numberOfLines={3}
            editable={!submitting}
          />

          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Submit rating"
          >
            {submitting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text
                style={[
                  styles.submitBtnText,
                  !canSubmit && styles.submitBtnTextDisabled,
                ]}
              >
                Submit Rating
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.cancelWrap}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['4xl'] : spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fonts.size.md,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.lg,
    opacity: 0.95,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.white,
    fontSize: fonts.size.md,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  submitBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.border,
  },
  submitBtnText: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.background,
  },
  submitBtnTextDisabled: {
    color: colors.greyDark,
  },
  cancelWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: fonts.size.md,
    color: colors.grey,
    fontFamily: fonts.bodySemiBold,
  },
});
