import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Image,
} from 'react-native';
import {
  collection, query, where, onSnapshot,
  orderBy, updateDoc, doc, getDoc, runTransaction,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { sendPushNotification } from '../../services/notifications';
import { Booking } from '../../types';
import { theme } from '../../theme';

interface Props {
  navigation: {
    navigate: (screen: string, params?: object) => void;
  };
}

// Resolve the best available image URL from a requestedStyle object.
// LightX saves under generatedImageUrl; old FLUX flow used tryOnImageUrl.
function resolveAfterUrl(style: Booking['requestedStyle']): string | null {
  return style?.generatedImageUrl ?? style?.tryOnImageUrl ?? null;
}

function resolveBeforeUrl(style: Booking['requestedStyle']): string | null {
  return style?.selfieUrl ?? style?.referenceImageUrl ?? null;
}

// ── Inline CLIENT WANTS section ──────────────────────────────────────────────
function ClientWantsCard({ style }: { style: NonNullable<Booking['requestedStyle']> }) {
  const afterUrl  = resolveAfterUrl(style);
  const beforeUrl = resolveBeforeUrl(style);

  return (
    <View style={cwStyles.wrapper}>
      <Text style={cwStyles.label}>CLIENT WANTS</Text>
      <Text style={cwStyles.styleName}>{style.name}</Text>

      {style.description ? (
        <Text style={cwStyles.description} numberOfLines={2}>
          {style.description}
        </Text>
      ) : null}

      {/* Show before/after images only when URLs exist — no placeholder icons */}
      {(beforeUrl || afterUrl) ? (
        <View style={cwStyles.imagesRow}>
          {beforeUrl ? (
            <View style={cwStyles.imageBlock}>
              <Text style={cwStyles.imageLabel}>BEFORE</Text>
              <Image
                source={{ uri: beforeUrl }}
                style={cwStyles.image}
                resizeMode="cover"
              />
            </View>
          ) : null}
          {afterUrl ? (
            <View style={cwStyles.imageBlock}>
              <Text style={[cwStyles.imageLabel, cwStyles.imageLabelGold]}>
                AI TRY-ON
              </Text>
              <Image
                source={{ uri: afterUrl }}
                style={[cwStyles.image, cwStyles.imageAfter]}
                resizeMode="cover"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const cwStyles = StyleSheet.create({
  wrapper: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.goldMuted,
  },
  label: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 3,
    marginBottom: theme.spacing.xs,
  },
  styleName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  description: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  imagesRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  imageBlock: {
    flex: 1,
    gap: 4,
  },
  imageLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  imageLabelGold: {
    color: theme.colors.gold,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  imageAfter: {
    borderColor: theme.colors.gold,
    borderWidth: 1.5,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function BarberDashboardScreen({ navigation }: Props) {
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

  const formatTime = (date: Date) =>
    date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '';

  const formatDate = (date: Date) => {
    const today    = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date?.toDateString() === today.toDateString())    return 'Today';
    if (date?.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date?.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric',
    }) ?? '';
  };

  const updateBookingStatus = async (
    bookingId: string,
    status: 'confirmed' | 'cancelled' | 'completed',
  ) => {
    const booking = bookings.find(b => b.id === bookingId);

    try {
      await updateDoc(doc(db, COLLECTIONS.BOOKINGS, bookingId), { status });
    } catch (e) {
      console.error('Failed to update booking:', e);
      return;
    }

    if (status === 'confirmed' && booking?.clientId) {
      try {
        const clientDocSnap = await getDoc(doc(db, COLLECTIONS.USERS, booking.clientId));
        const clientToken = clientDocSnap.data()?.expoPushToken;
        if (clientToken) {
          await sendPushNotification(
            clientToken,
            'Booking Confirmed ✅',
            `Your ${booking.serviceName} is confirmed!`,
            { bookingId },
          );
        }
      } catch (e) {
        console.log('Client notification failed:', e);
      }
    }

    if (status === 'completed' && booking?.clientId) {
      try {
        await runTransaction(db, async (transaction) => {
          const clientRef  = doc(db, COLLECTIONS.USERS, booking.clientId);
          const clientSnap = await transaction.get(clientRef);
          const current    = (clientSnap.data()?.loyaltyStamps as number | undefined) ?? 0;
          const newStamps  = current >= 9 ? 0 : current + 1;
          transaction.update(clientRef, { loyaltyStamps: newStamps });
        });
      } catch (e) {
        console.log('Loyalty stamp update failed:', e);
      }
    }
  };

  const STATS = [
    { label: 'PEND.',  value: pending.length,   gold: false },
    { label: 'CONF.',  value: confirmed.length, gold: true  },
    { label: 'TOTAL',  value: bookings.length,  gold: false },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View style={[styles.header, {
          opacity: fadeAnim, transform: [{ translateY: slideAnim }],
        }]}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
            <Ionicons name="log-out-outline" size={24} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* ── Stats Row ── */}
        <Animated.View style={[styles.statsRow, {
          opacity: fadeAnim, transform: [{ translateY: slideAnim }],
        }]}>
          {STATS.map(s => (
            <View key={s.label} style={[styles.statCard, s.gold && styles.statCardGold]}>
              <Text style={[styles.statNumber, s.gold && styles.statNumberGold]}>
                {s.value}
              </Text>
              <Text style={[styles.statLabel, s.gold && styles.statLabelGold]}
                numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Pending ── */}
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
                </View>

                {/* CLIENT WANTS — only render when name exists */}
                {booking.requestedStyle?.name ? (
                  <ClientWantsCard style={booking.requestedStyle} />
                ) : null}

                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => updateBookingStatus(booking.id, 'cancelled')}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.error} />
                    <Text style={styles.declineBtnText}>DECLINE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={() => updateBookingStatus(booking.id, 'confirmed')}
                  >
                    <Ionicons name="checkmark" size={18} color={theme.colors.textInverse} />
                    <Text style={styles.confirmBtnText}>CONFIRM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── Confirmed / Upcoming ── */}
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
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </View>

                {/* CLIENT WANTS — only render when name exists */}
                {booking.requestedStyle?.name ? (
                  <ClientWantsCard style={booking.requestedStyle} />
                ) : null}

                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => updateBookingStatus(booking.id, 'completed')}
                >
                  <Ionicons name="checkmark-done" size={16} color={theme.colors.textInverse} />
                  <Text style={styles.completeBtnText}>MARK COMPLETE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cutGuideBtn}
                  onPress={() => navigation.navigate('CutGuide', {
                    bookingId:      booking.id,
                    serviceName:    booking.serviceName,
                    clientName:     booking.clientName,
                    scheduledAt:    booking.scheduledAt?.toISOString() ?? '',
                    // Pass the full style so CutGuide can show images + use it in the prompt
                    requestedStyle: booking.requestedStyle ?? null,
                  })}
                >
                  <Ionicons name="bulb-outline" size={16} color={theme.colors.gold} />
                  <Text style={styles.cutGuideBtnText}>CUT GUIDE</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && bookings.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptySubtitle}>New bookings will appear here</Text>
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
    fontSize: 8,
    color: theme.colors.textMuted,
    letterSpacing: 0,
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
    position: 'absolute',
    right: theme.spacing.lg,
    top: theme.spacing.lg,
  },
  bookingPrice: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  declineBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.error,
    letterSpacing: 1,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.gold,
  },
  confirmBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textInverse,
    letterSpacing: 1,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  completeBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
  cutGuideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cutGuideBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
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