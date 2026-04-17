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

const BG = '#0A0A0A';
const GOLD = '#D4AF37';
const GREY_STAR = '#333333';
const INPUT_BG = '#141414';

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
                  name={stars >= n ? 'star' : 'star-outline'}
                  size={40}
                  color={stars >= n ? GOLD : GREY_STAR}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Leave a comment (optional)"
            placeholderTextColor="#888888"
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
              <ActivityIndicator color={BG} />
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
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderColor: '#252525',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: GOLD,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.95,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 18,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252525',
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
  },
  submitBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#333333',
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: BG,
  },
  submitBtnTextDisabled: {
    color: '#666666',
  },
  cancelWrap: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '600',
  },
});
