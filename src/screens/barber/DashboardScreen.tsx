import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking } from '../../types';
import { theme } from '../../theme';

export default function BarberDashboardScreen() {
  const { user }  = useAuth();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('barberId', '==', user.id),
      where('status', 'in', ['pending', 'confirmed']),
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

  const pending   = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');
  const firstName = user?.displayName?.split(' ')[0] ?? 'Barber';

  const formatTime = (date: Date) => date?.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  }) ?? '';

  const formatDate = (date: Date) => {
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date?.toDateString() === today.toDateString())    return 'Today';
    if (date?.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date?.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric'
    }) ?? '';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, {
          opacity: fadeAnim, transform: [{ translateY: slideAnim }]
        }]}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={() => signOut(auth)}
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View style={[styles.statsRow, {
          opacity: fadeAnim, transform: [{ translateY: slideAnim }]
        }]}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pending.length}</Text>
            <Text style={styles.statLabel}>PENDING</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGold]}>
            <Text style={[styles.statNumber, styles.statNumberGold]}>
              {confirmed.length}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelGold]}>
              CONFIRMED
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{bookings.length}</Text>
            <Text style={styles.statLabel}>TOTAL</Text>
          </View>
        </Animated.View>

        {/* Pending Bookings */}
        {pending.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>NEEDS CONFIRMATION</Text>
            {pending.map(booking => (
              <View key={booking.id}
                style={[styles.bookingCard, styles.bookingCardPending]}>
                <View style={styles.bookingLeft}>
                  <View style={styles.statusDot} />
                  <View style={styles.bookingInfo}>
                    <Text style={styles.clientName}>{booking.clientName}</Text>
                    <Text style={styles.serviceName}>{booking.serviceName}</Text>
                    <Text style={styles.bookingTime}>
                      {formatDate(booking.scheduledAt)} · {formatTime(booking.scheduledAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingRight}>
                  <Text style={styles.bookingPrice}>${booking.servicePrice}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {/* Confirmed Bookings */}
        {confirmed.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>UPCOMING</Text>
            {confirmed.map(booking => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingLeft}>
                  <View style={[styles.statusDot, styles.statusDotConfirmed]} />
                  <View style={styles.bookingInfo}>
                    <Text style={styles.clientName}>{booking.clientName}</Text>
                    <Text style={styles.serviceName}>{booking.serviceName}</Text>
                    <Text style={styles.bookingTime}>
                      {formatDate(booking.scheduledAt)} · {formatTime(booking.scheduledAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingRight}>
                  <Text style={styles.bookingPrice}>${booking.servicePrice}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && bookings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={theme.colors.textMuted}
            />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySubtitle}>
              New bookings will appear here
            </Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  signOutBtn: {
    padding: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    minWidth: 0,
    ...theme.shadows.md,
  },
  statCardGold: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  statNumber: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
  },
  statNumberGold: {
    color: theme.colors.gold,
  },
  statLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
    textAlign: 'center',
  },
  statLabelGold: {
    color: theme.colors.goldDark,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  bookingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  bookingCardPending: {
    borderColor: theme.colors.warning,
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  bookingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  bookingInfo: {
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.warning,
  },
  statusDotConfirmed: {
    backgroundColor: theme.colors.success,
  },
  clientName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  serviceName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  bookingTime: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  bookingRight: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  bookingPrice: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
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
  emptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});