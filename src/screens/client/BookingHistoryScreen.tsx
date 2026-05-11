import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {
  collection, query, where,
  onSnapshot, orderBy,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking, BookingStatus } from '../../types';
import { theme } from '../../theme';

type FilterType = 'all' | BookingStatus;

export default function BookingHistoryScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<FilterType>('all');

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('clientId', '==', user.id),
      orderBy('scheduledAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter(b => b.status === filter);

  const formatDate = (date: Date) => date?.toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric'
  }) ?? '';

  const formatTime = (date: Date) => date?.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  }) ?? '';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':   return theme.colors.warning;
      case 'confirmed': return theme.colors.success;
      case 'completed': return theme.colors.gold;
      case 'cancelled': return theme.colors.error;
      default:          return theme.colors.textMuted;
    }
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'pending':   return 'time-outline';
      case 'confirmed': return 'checkmark-circle-outline';
      case 'completed': return 'trophy-outline';
      case 'cancelled': return 'close-circle-outline';
      default:          return 'help-outline';
    }
  };

  const FILTERS: FilterType[] = [
    'all', 'pending', 'confirmed', 'completed', 'cancelled'
  ];

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
            style={[
              styles.filterPill,
              filter === f && styles.filterPillActive,
            ]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              filter === f && styles.filterTextActive,
            ]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          size="large"
          style={styles.loader}
        />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="calendar-outline"
            size={56}
            color={theme.colors.textMuted}
          />
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
          {filtered.map(booking => (
            <View key={booking.id} style={styles.card}>

              {/* Top row */}
              <View style={styles.cardTop}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>
                    {booking.serviceName}
                  </Text>
                  <Text style={styles.barberName}>
                    with {booking.barberName}
                  </Text>
                </View>
                <Text style={styles.price}>
                  ${booking.servicePrice}
                </Text>
              </View>

              {/* Date + Time */}
              <View style={styles.dateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.dateText}>
                  {formatDate(booking.scheduledAt)}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={theme.colors.textMuted}
                />
                <Text style={styles.dateText}>
                  {formatTime(booking.scheduledAt)}
                </Text>
              </View>

              {/* Status badge */}
              <View style={[
                styles.statusBadge,
                {
                  backgroundColor: getStatusColor(booking.status) + '20',
                  borderColor:     getStatusColor(booking.status),
                }
              ]}>
                <Ionicons
                  name={getStatusIcon(booking.status)}
                  size={12}
                  color={getStatusColor(booking.status)}
                />
                <Text style={[
                  styles.statusText,
                  { color: getStatusColor(booking.status) }
                ]}>
                  {booking.status.toUpperCase()}
                </Text>
              </View>

            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  filtersRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterPill: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    height: 36,
    justifyContent: 'center',
  },
  filterPillActive: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  filterText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  filterTextActive: {
    color: theme.colors.gold,
  },
  loader: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  emptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  barberName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  dateText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    letterSpacing: 1,
  },
});