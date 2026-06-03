/**
 * BookingHistoryScreen — V3 visual layer
 *
 * Visual upgrades:
 * - Booking cards now use GoldCard with staggered entrance
 * - Status badges keep their colour map; PENDING badges pulse via Moti
 * - GoldShimmer placeholders replace ActivityIndicator
 *
 * Logic preserved exactly: Firestore subscription, filter state,
 * RatingModal trigger, StyleCardView navigation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking, BookingStatus } from '../../types';
import { theme } from '../../theme';
import RatingModal from '../../components/RatingModal';
import { GoldCard, GoldShimmer } from '../../components/ui';

interface Props { navigation: any; }

type FilterType = 'all' | BookingStatus;

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

// ── Pulse badge — only used for PENDING ────────────────────────────
function PulseBadge({
  label, color,
}: { label: string; color: string }) {
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.statusBadge,
        { backgroundColor: color + '20', borderColor: color, opacity },
      ]}
    >
      <Ionicons name="time-outline" size={12} color={color} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </Animated.View>
  );
}

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
    date?.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric',
    }) ?? '';
  const formatTime = (date: Date) =>
    date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '';

  const statusColor = (s: string) => ({
    pending:   theme.colors.warning,
    confirmed: theme.colors.success,
    completed: theme.colors.gold,
    cancelled: theme.colors.error,
  }[s] ?? theme.colors.textMuted);

  const statusIcon = (s: string): keyof typeof import('@expo/vector-icons').Ionicons.glyphMap => ({
    pending:   'time-outline',
    confirmed: 'checkmark-circle-outline',
    completed: 'trophy-outline',
    cancelled: 'close-circle-outline',
  }[s] as keyof typeof import('@expo/vector-icons').Ionicons.glyphMap ?? 'help-outline');

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

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => (
          <Pressable
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              filter === f && styles.filterTextActive,
            ]}>
              {f.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.shimmerStack}>
          {Array.from({ length: 3 }).map((_, i) => (
            <GoldShimmer
              key={i}
              width="100%"
              height={130}
              radius={theme.radius.lg}
            />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={56} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>
            {filter === 'all'
              ? 'Your appointments will appear here'
              : `No ${filter} bookings found`}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((booking, i) => (
            <GoldCard
              key={booking.id}
              entranceIndex={i}
              contentStyle={styles.cardContent}
            >
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
                {booking.status === 'pending' ? (
                  <PulseBadge label="PENDING" color={statusColor('pending')} />
                ) : (
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusColor(booking.status) + '20',
                      borderColor:     statusColor(booking.status),
                    },
                  ]}>
                    <Ionicons
                      name={statusIcon(booking.status)}
                      size={12}
                      color={statusColor(booking.status)}
                    />
                    <Text style={[
                      styles.statusText,
                      { color: statusColor(booking.status) },
                    ]}>
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                )}

                {(booking.status === 'pending' || booking.status === 'confirmed') && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('Chat', {
                      bookingId: booking.id,
                      recipientName: booking.barberName,
                    })}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={theme.colors.gold} />
                    <Text style={styles.actionBtnText}>CHAT</Text>
                  </Pressable>
                )}
              </View>

              {/* Completed section */}
              {booking.status === 'completed' && (
                <View style={styles.completedSection}>
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
                    <Pressable
                      style={styles.rateBtn}
                      onPress={() => setRatingFor(booking)}
                    >
                      <Ionicons name="star-outline" size={14} color={theme.colors.gold} />
                      <Text style={styles.rateBtnText}>RATE THIS SESSION</Text>
                    </Pressable>
                  )}

                  {booking.styleCardId ? (
                    <Pressable
                      style={styles.styleCardBtn}
                      onPress={() => navigation.navigate('StyleCardView', {
                        styleCardId: booking.styleCardId,
                        clientId:    booking.clientId,
                      })}
                    >
                      <Ionicons name="camera-outline" size={14} color={theme.colors.textPrimary} />
                      <Text style={styles.styleCardBtnText}>VIEW STYLE CARD</Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </GoldCard>
          ))}
        </ScrollView>
      )}

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
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    padding:        theme.spacing.lg,
    paddingTop:     theme.spacing.xxl,
    marginBottom:   theme.spacing.md,
  },
  title: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxxl,
    color:         theme.colors.textPrimary,
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
    borderWidth:       1,
    borderColor:       theme.colors.border,
    backgroundColor:   theme.colors.surface,
    height:            36,
    justifyContent:    'center',
  },
  filterPillActive: {
    borderColor:     theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  filterText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.textMuted,
    letterSpacing: 1,
  },
  filterTextActive: { color: theme.colors.gold },

  shimmerStack: {
    paddingHorizontal: theme.spacing.lg,
    gap:               theme.spacing.md,
  },
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            theme.spacing.md,
    paddingBottom:  theme.spacing.xxl,
  },
  emptyTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xl,
    color:         theme.colors.textSecondary,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
    textAlign:  'center',
  },

  scroll: {
    padding:    theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap:        theme.spacing.md,
  },
  cardContent: {
    padding: theme.spacing.lg,
    gap:     theme.spacing.sm,
  },
  cardTop: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  serviceInfo: { flex: 1 },
  serviceName: {
    fontFamily: theme.fonts.bold,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textPrimary,
  },
  barberName: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
    marginTop:  2,
  },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xl,
    color:      theme.colors.gold,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.xs,
  },
  dateText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
  },
  cardBottom: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius:    theme.radius.full,
    borderWidth:     1,
  },
  statusText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    letterSpacing: 1,
  },
  actionBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted,
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    borderRadius:    theme.radius.full,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
  },
  actionBtnText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 1,
  },

  completedSection: {
    gap:           theme.spacing.sm,
    paddingTop:    theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  ratingRow:  { gap: 4 },
  reviewText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textSecondary,
    fontStyle:  'italic',
  },
  rateBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted,
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.sm,
    justifyContent:  'center',
  },
  rateBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
  styleCardBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.sm,
    justifyContent:  'center',
  },
  styleCardBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.textPrimary,
    letterSpacing: 2,
  },
});
