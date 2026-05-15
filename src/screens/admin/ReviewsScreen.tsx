import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons }    from '@expo/vector-icons';
import { db }          from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { Booking }     from '../../types';
import { theme }       from '../../theme';

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={14}
          color={n <= rating ? theme.colors.gold : theme.colors.textMuted}
        />
      ))}
    </View>
  );
}

export default function ReviewsScreen() {
  const [bookings,       setBookings]       = useState<Booking[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');
  const [barbers,        setBarbers]        = useState<string[]>([]);

  useEffect(() => {
    // Single-field where only — avoids composite index requirement.
    // Filtering for rating > 0 and sorting done client-side.
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('status', '==', 'completed'),
    );
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking));

      // Filter to only rated bookings, sort newest first
      const rated = all
        .filter(b => b.rating !== null && b.rating !== undefined)
        .sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0));

      setBookings(rated);

      const names = [...new Set(rated.map(b => b.barberName).filter(Boolean))];
      setBarbers(names);
      setLoading(false);
    });
  }, []);

  const filtered = selectedBarber === 'all'
    ? bookings
    : bookings.filter(b => b.barberName === selectedBarber);

  const avgRating = bookings.length > 0
    ? bookings.reduce((sum, b) => sum + (b.rating ?? 0), 0) / bookings.length
    : 0;

  const formatDate = (date: Date) =>
    date?.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' }) ?? '';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>REVIEWS</Text>
        <Text style={styles.subtitle}>
          {bookings.length} review{bookings.length !== 1 ? 's' : ''} · avg{' '}
          <Text style={{ color: theme.colors.gold }}>
            {avgRating > 0 ? avgRating.toFixed(1) : '—'} ★
          </Text>
        </Text>
      </View>

      {/* Barber filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {['all', ...barbers].map(name => (
          <TouchableOpacity
            key={name}
            style={[styles.filterPill, selectedBarber === name && styles.filterPillActive]}
            onPress={() => setSelectedBarber(name)}
          >
            <Text style={[styles.filterText, selectedBarber === name && styles.filterTextActive]}>
              {name === 'all' ? 'ALL BARBERS' : name.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} size="large" style={{ flex: 1 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptySubtitle}>Reviews appear after clients rate their sessions</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {filtered.map(booking => (
            <View key={booking.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{booking.clientName}</Text>
                  <Text style={styles.serviceText}>
                    {booking.serviceName} · {booking.barberName}
                  </Text>
                </View>
                <Text style={styles.dateText}>{formatDate(booking.scheduledAt)}</Text>
              </View>

              <StarRow rating={booking.rating ?? 0} />

              {booking.review ? (
                <Text style={styles.reviewText}>"{booking.review}"</Text>
              ) : (
                <Text style={styles.noReviewText}>No written review</Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },
  header:       { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl, marginBottom: theme.spacing.sm },
  title:        { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xxxl, color: theme.colors.textPrimary, letterSpacing: 4 },
  subtitle:     { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  filtersRow:   { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: theme.spacing.sm },
  filterPill: {
    paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, height: 36, justifyContent: 'center',
  },
  filterPillActive: { borderColor: theme.colors.gold, backgroundColor: theme.colors.goldMuted },
  filterText:       { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, letterSpacing: 1 },
  filterTextActive: { color: theme.colors.gold },
  emptyState:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingBottom: 60 },
  emptyTitle:   { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.textSecondary, letterSpacing: 2 },
  emptySubtitle:{ fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center' },
  scroll:       { padding: theme.spacing.lg, gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg,
    gap: theme.spacing.sm, ...theme.shadows.md,
  },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  clientName:   { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md, color: theme.colors.textPrimary },
  serviceText:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  dateText:     { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  reviewText:   { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },
  noReviewText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, fontStyle: 'italic' },
});