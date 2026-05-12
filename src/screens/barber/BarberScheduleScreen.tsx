import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking } from '../../types';
import { theme } from '../../theme';

// ── Generate next 7 days ──────────────────────────────────────
const getWeek = (): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
};

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':   return theme.colors.warning;
    case 'confirmed': return theme.colors.success;
    case 'completed': return theme.colors.gold;
    case 'cancelled': return theme.colors.error;
    default:          return theme.colors.textMuted;
  }
};

export default function BarberScheduleScreen() {
  const { user } = useAuth();
  const week = getWeek();

  const [selectedDay, setSelectedDay] = useState<Date>(week[0]);
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('barberId', '==', user.id),
      orderBy('scheduledAt', 'asc'),
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

  // Filter bookings for the selected day
  const dayBookings = bookings.filter(
    b => b.scheduledAt && isSameDay(b.scheduledAt, selectedDay)
  );

  const dayRevenue = dayBookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.servicePrice ?? 0), 0);

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Your Schedule</Text>
        <Text style={styles.title}>WEEK VIEW</Text>
      </View>

      {/* ── Day picker ── */}
      <View style={styles.weekRow}>
        {week.map((day, i) => {
          const isSelected = isSameDay(day, selectedDay);
          const count = bookings.filter(
            b => b.scheduledAt && isSameDay(b.scheduledAt, day) && b.status !== 'cancelled'
          ).length;

          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCard, isSelected && styles.dayCardSelected]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {isToday(day) ? 'NOW' : DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {day.getDate()}
              </Text>
              {count > 0 && (
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Selected day header ── */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {isToday(selectedDay) ? 'TODAY' : selectedDay.toLocaleDateString([], {
            weekday: 'long', month: 'long', day: 'numeric'
          }).toUpperCase()}
        </Text>
        {dayRevenue > 0 && (
          <View style={styles.revenueTag}>
            <Text style={styles.revenueText}>${dayRevenue}</Text>
          </View>
        )}
      </View>

      {/* ── Bookings list ── */}
      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          size="large"
          style={styles.loader}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {dayBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No bookings</Text>
              <Text style={styles.emptySub}>
                {isToday(selectedDay)
                  ? 'Nothing scheduled for today'
                  : 'Nothing scheduled for this day'}
              </Text>
            </View>
          ) : (
            dayBookings.map(booking => (
              <View key={booking.id} style={styles.bookingCard}>

                {/* Time column */}
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>
                    {formatTime(booking.scheduledAt)}
                  </Text>
                  <View style={[
                    styles.statusLine,
                    { backgroundColor: getStatusColor(booking.status) }
                  ]} />
                </View>

                {/* Card */}
                <View style={[
                  styles.cardBody,
                  { borderLeftColor: getStatusColor(booking.status) }
                ]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.clientName}>{booking.clientName}</Text>
                    <Text style={styles.price}>${booking.servicePrice}</Text>
                  </View>
                  <Text style={styles.serviceName}>{booking.serviceName}</Text>
                  <View style={styles.cardBottom}>
                    <View style={[
                      styles.statusBadge,
                      { borderColor: getStatusColor(booking.status) }
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(booking.status) }
                      ]} />
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(booking.status) }
                      ]}>
                        {booking.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.duration}>
                      {booking.servicePrice ? `${booking.servicePrice >= 40 ? '60' : '30'} min` : ''}
                    </Text>
                  </View>
                </View>

              </View>
            ))
          )}
          <View style={{ height: 40 }} />
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
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },

  // ── Week row ──
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  dayCardSelected: {
    backgroundColor: theme.colors.goldMuted,
    borderColor: theme.colors.gold,
  },
  dayName: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  dayNameSelected: {
    color: theme.colors.gold,
  },
  dayNum: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
  },
  dayNumSelected: {
    color: theme.colors.gold,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
    marginTop: 1,
  },
  dotSelected: {
    backgroundColor: theme.colors.gold,
  },

  // ── Day header ──
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  dayTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 3,
  },
  revenueTag: {
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
  },
  revenueText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.gold,
  },

  loader: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },

  // ── Booking card ──
  bookingCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  timeCol: {
    width: 52,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  statusLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
    borderRadius: 1,
    opacity: 0.4,
  },
  cardBody: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    padding: theme.spacing.md,
    gap: 4,
    ...theme.shadows.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
  serviceName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    letterSpacing: 1,
  },
  duration: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
  },
  emptySub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});