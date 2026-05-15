import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {
  collection, query, where,
  onSnapshot, orderBy,
} from 'firebase/firestore';
import { Ionicons }    from '@expo/vector-icons';
import { db }          from '../../config/firebase';
import { useAuth }     from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking, BookingStatus } from '../../types';
import { theme }       from '../../theme';
import RatingModal     from '../../components/RatingModal';

interface Props {
  navigation: any;
}

type FilterType = 'all' | BookingStatus;

// ── Tiny star display ──────────────────────────────────────
function StarRow({ rating }: { rating: number }) {
  return (
    <View style={starStyles.row}>
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

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});

export default function BookingHistoryScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [bookings,  setBookings]  = useState<Booking[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<FilterType>('all');
  const [ratingFor, setRatingFor] = useState<Booking | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('clientId', '==', user.id),
      orderBy('scheduledAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking)));
      setLoading(false);
    });
  }, [user?.id]);

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const formatDate = (date: Date) =>
    date?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) ?? '';

  const formatTime = (date: Date) =>
    date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '';

  const statusColor = (s: string) => ({
    pending:   theme.colors.warning,
    confirmed: theme.colors.success,
    completed: theme.colors.gold,
    cancelled: theme.colors.error,
  }[s] ?? theme.colors.textMuted);

  const statusIcon = (s: string): keyof typeof Ionicons.glyphMap => ({
    pending:   'time-outline',
    confirmed: 'checkmark-circle-outline',
    completed: 'trophy-outline',
    cancelled: 'close-circle-outline',
  }[s] as keyof typeof Ionicons.glyphMap ?? 'help-outline');

  const FILTERS: FilterType[] = ['all', 'pending', 'confirmed', 'completed', 'cancelled'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MY BOOKINGS</Text>
        <Text style={styles.subtitle}>
          {bookings.length} total appointment{bookings.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} size="large" style={styles.loader} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={56} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all' ? 'Your appointments will appear here' : `No ${filter} bookings found`}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {filtered.map(booking => (
            <View key={booking.id} style={styles.card}>
              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{booking.serviceName}</Text>
                  <Text style={styles.barberName}>with {booking.barberName}</Text>
                </View>
                <Text style={styles.price}>${booking.servicePrice}</Text>
              </View>

              {/* Date */}
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>{formatDate(booking.scheduledAt)}</Text>
                <Ionicons name="time-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.dateText}>{formatTime(booking.scheduledAt)}</Text>
              </View>

              {/* Status row */}
              <View style={styles.cardBottom}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor(booking.status) + '20', borderColor: statusColor(booking.status) },
                ]}>
                  <Ionicons name={statusIcon(booking.status)} size={12} color={statusColor(booking.status)} />
                  <Text style={[styles.statusText, { color: statusColor(booking.status) }]}>
                    {booking.status.toUpperCase()}
                  </Text>
                </View>

                {/* Chat button — active bookings only */}
                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Chat', {
                      bookingId: booking.id, recipientName: booking.barberName,
                    })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={theme.colors.gold} />
                    <Text style={styles.actionBtnText}>CHAT</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Completed bookings — rating + style card ── */}
              {booking.status === 'completed' && (
                <View style={styles.completedSection}>
                  {/* Show existing rating */}
                  {booking.rating ? (
                    <View style={styles.ratingRow}>
                      <StarRow rating={booking.rating} />
                      {booking.review ? (
                        <Text style={styles.reviewText} numberOfLines={2}>
                          "{booking.review}"
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    // Rate button — only if not yet rated
                    <TouchableOpacity
                      style={styles.rateBtn}
                      onPress={() => setRatingFor(booking)}
                    >
                      <Ionicons name="star-outline" size={14} color={theme.colors.gold} />
                      <Text style={styles.rateBtnText}>RATE THIS SESSION</Text>
                    </TouchableOpacity>
                  )}

                  {/* Style card link — if barber documented the style */}
                  {booking.styleCardId ? (
                    <TouchableOpacity
                      style={styles.styleCardBtn}
                      onPress={() => navigation.navigate('StyleCardView', {
                        styleCardId: booking.styleCardId,
                        clientId:    booking.clientId,
                      })}
                    >
                      <Ionicons name="camera-outline" size={14} color={theme.colors.textPrimary} />
                      <Text style={styles.styleCardBtnText}>VIEW STYLE CARD</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Rating Modal */}
      {ratingFor && (
        <RatingModal
          visible={!!ratingFor}
          bookingId={ratingFor.id}
          barberId={ratingFor.barberId}
          barberName={ratingFor.barberName}
          onClose={() => setRatingFor(null)}
          onSubmitted={() => setRatingFor(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  header:     { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl, marginBottom: theme.spacing.md },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xxxl,
    color:      theme.colors.textPrimary,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
    marginTop:  theme.spacing.xs,
  },
  filtersRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom:     theme.spacing.md,
    gap:               theme.spacing.sm,
  },
  filterPill: {
    paddingVertical:   theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius:      theme.radius.full,
    borderWidth: 1,
    borderColor:       theme.colors.border,
    backgroundColor:   theme.colors.surface,
    height: 36,
    justifyContent: 'center',
  },
  filterPillActive: { borderColor: theme.colors.gold, backgroundColor: theme.colors.goldMuted },
  filterText: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
    letterSpacing: 1,
  },
  filterTextActive: { color: theme.colors.gold },
  loader:     { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  emptyTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.textSecondary, letterSpacing: 2 },
  emptySubtitle: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center' },
  scroll:     { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    borderWidth: 1,
    borderColor:     theme.colors.border,
    padding:         theme.spacing.lg,
    gap:             theme.spacing.sm,
    ...theme.shadows.md,
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceInfo: { flex: 1 },
  serviceName: { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md, color: theme.colors.textPrimary },
  barberName:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary, marginTop: 2 },
  price:       { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.gold },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  dateText:    { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    paddingVertical: 4, paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full, borderWidth: 1,
  },
  statusText:  { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, letterSpacing: 1 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full, paddingVertical: 4, paddingHorizontal: theme.spacing.sm,
  },
  actionBtnText: { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1 },
  // ── completed section ───────────────────────────────────
  completedSection: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ratingRow:  { gap: 4 },
  reviewText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, fontStyle: 'italic' },
  rateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  rateBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 2 },
  styleCardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
    justifyContent: 'center',
  },
  styleCardBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.textPrimary, letterSpacing: 2 },
});