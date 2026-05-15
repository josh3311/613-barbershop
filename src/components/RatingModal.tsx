import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet,
  TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons }   from '@expo/vector-icons';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db }          from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { theme }       from '../theme';

interface Props {
  visible:     boolean;
  bookingId:   string;
  barberId:    string;
  barberName:  string;
  onClose:     () => void;
  onSubmitted: () => void;
}

export default function RatingModal({
  visible, bookingId, barberId, barberName, onClose, onSubmitted,
}: Props) {
  const [stars,      setStars]      = useState(0);
  const [review,     setReview]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const reset = () => { setStars(0); setReview(''); setError(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (stars === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), {
        rating: stars,
        review: review.trim() || null,
      });
      await runTransaction(db, async (transaction) => {
        const barberRef  = doc(db, COLLECTIONS.USERS, barberId);
        const barberSnap = await transaction.get(barberRef);
        const curAvg     = (barberSnap.data()?.averageRating as number) ?? 0;
        const curCount   = (barberSnap.data()?.reviewCount   as number) ?? 0;
        const newCount   = curCount + 1;
        const newAvg     = Math.round(((curAvg * curCount + stars) / newCount) * 10) / 10;
        transaction.update(barberRef, { averageRating: newAvg, reviewCount: newCount });
      });
      reset();
      onSubmitted();
    } catch (e) {
      console.error('Rating submit failed:', e);
      setError('Could not save rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="star" size={20} color={theme.colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>RATE YOUR SESSION</Text>
                <Text style={styles.subtitle}>with {barberName}</Text>
              </View>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                  <Ionicons
                    name={n <= stars ? 'star' : 'star-outline'}
                    size={44}
                    color={n <= stars ? theme.colors.gold : theme.colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {stars > 0 && <Text style={styles.starLabel}>{LABELS[stars]}</Text>}

            {/* color inside style — NOT as a prop (fixes TS error) */}
            <TextInput
              style={styles.input}
              placeholder="Leave a review (optional)..."
              placeholderTextColor={theme.colors.textMuted}
              value={review}
              onChangeText={setReview}
              multiline
              maxLength={300}
              editable={!submitting}
              textAlignVertical="top"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.btns}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleClose} disabled={submitting}>
                <Text style={styles.skipText}>SKIP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (stars === 0 || submitting) && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={stars === 0 || submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
                  : <Text style={styles.submitText}>SUBMIT</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.gold,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconWrap: {
    width: 40, height: 40, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.textPrimary, letterSpacing: 3 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  starLabel: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.sm, color: theme.colors.gold, letterSpacing: 2, textAlign: 'center' },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    // color in style (not as prop) — fixes TypeScript error
    color: '#FFFFFF',
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.error, textAlign: 'center' },
  btns: { flexDirection: 'row', gap: theme.spacing.sm },
  skipBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: theme.spacing.sm, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, minHeight: 48,
  },
  skipText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, letterSpacing: 2 },
  submitBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    padding: theme.spacing.sm, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.gold, minHeight: 48, ...theme.shadows.gold,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.textInverse, letterSpacing: 2 },
});