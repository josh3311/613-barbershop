/**
 * DashboardScreen.tsx
 *
 * Barber dashboard with redesigned UI:
 * - Header: "Good morning, [name]" in BebasNeue 28px
 * - Stats row: 3 cards - Appointments, Completed, Earnings
 * - Appointment cards with action buttons per design spec
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  icons,
  animations,
} from '@/theme';
import { BookingService } from '@/services/booking.service';
import { BookingStatus } from '@/types/booking.types';
import { useAuth } from '@/hooks/useAuth';
import { safeToDate } from '@/utils/date.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichBooking {
  id: string;
  clientName: string;
  serviceName: string;
  serviceIcon: keyof typeof Ionicons.glyphMap;
  barberId: string;
  barberName: string;
  timeLabel: string;
  sortMs: number;
  price: number;
  durationMinutes: number;
  status: BookingStatus;
}

// ─── Theme Constants ──────────────────────────────────────────────────────────

const C = {
  bg: colors.background,
  surface: colors.surface,
  surfaceRaised: colors.surfaceRaised,
  border: colors.border,
  gold: colors.gold,
  goldDim: colors.goldDim,
  green: colors.green,
  red: colors.red,
  white: colors.white,
  grey: colors.grey,
  greyDark: colors.greyDark,
  goldGlow: colors.goldGlow,
  goldGlowStrong: colors.goldGlowStrong,
};

const SERVICE_MAP: Record<string, { name: string; iconName: keyof typeof Ionicons.glyphMap }> = {
  s1: { name: 'Fade', iconName: 'cut-outline' },
  s2: { name: 'Lineup', iconName: 'cut-outline' },
  s3: { name: 'Beard Trim', iconName: 'cut-outline' },
  s4: { name: 'Haircut', iconName: 'cut-outline' },
  s5: { name: 'Beard + Cut', iconName: 'star-outline' },
};

const STATUS_CFG: Record<BookingStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: C.gold },
  confirmed: { label: 'Confirmed', color: C.green },
  in_progress: { label: 'In Chair', color: '#2196F3' },
  completed: { label: 'Completed', color: C.greyDark },
  declined: { label: 'Declined', color: C.red },
  cancelled: { label: 'Cancelled', color: C.red },
  no_show: { label: 'No Show', color: C.red },
};

const TODAY = new Date();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTimeLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m === 0 ? '00' : m < 10 ? '0' + m : m} ${period}`;
}

function bookingToRich(bk: import('@/types/booking.types').Booking, fallbackName: string): RichBooking {
  const svc = SERVICE_MAP[bk.serviceId] ?? { name: bk.serviceId, iconName: 'cut-outline' as keyof typeof Ionicons.glyphMap };
  const ms = safeToDate(bk.scheduledAt).getTime();
  return {
    id: bk.id,
    clientName: bk.clientName ?? bk.clientId.substring(0, 8),
    serviceName: svc.name,
    serviceIcon: svc.iconName,
    barberId: bk.barberId,
    barberName: bk.barberName ?? fallbackName,
    timeLabel: formatTimeLabel(safeToDate(bk.scheduledAt)),
    sortMs: ms,
    price: bk.price,
    durationMinutes: bk.durationMinutes,
    status: bk.status,
  };
}

// ─── Animated Card Component ──────────────────────────────────────────────────

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 100;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ─── Stat Card Component ────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delay?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <Animated.View style={[styles.statCardWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.statCard, animatedStyle]}
        activeOpacity={0.9}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name={icon} size={22} color={C.gold} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Appointment Card Component ───────────────────────────────────────────────

function AppointmentCard({
  item,
  onAction,
  index,
}: {
  item: RichBooking;
  onAction: (id: string, status: BookingStatus) => void;
  index: number;
}) {
  const [busy, setBusy] = useState(false);
  const cfg = STATUS_CFG[item.status];
  const isTerminal = ['completed', 'declined', 'cancelled', 'no_show'].includes(item.status);

  const handleConfirm = async () => {
    setBusy(true);
    await onAction(item.id, 'confirmed');
    setBusy(false);
  };

  const handleDecline = async () => {
    const msg = `Decline this appointment?\n\nThis will notify ${item.clientName} that their booking has been declined.`;
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(msg)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Decline Appointment?', msg, [
              { text: 'Keep', onPress: () => resolve(false) },
              { text: 'Decline', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    setBusy(true);
    await onAction(item.id, 'declined');
    setBusy(false);
  };

  const handleInChair = async () => {
    setBusy(true);
    await onAction(item.id, 'in_progress');
    setBusy(false);
  };

  const handleComplete = async () => {
    setBusy(true);
    await onAction(item.id, 'completed');
    setBusy(false);
  };

  return (
    <AnimatedCard index={index}>
      <View style={[styles.appointmentCard, isTerminal && styles.appointmentCardTerminal]}>
        {/* Status indicator line */}
        <View style={[styles.statusLine, { backgroundColor: cfg.color }]} />

        <View style={styles.cardContent}>
          {/* Header: Time + Status */}
          <View style={styles.cardHeader}>
            <Text style={styles.timeText}>{item.timeLabel}</Text>
            <View style={[styles.statusBadge, { borderColor: cfg.color, backgroundColor: `${cfg.color}20` }]}>
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Client Name */}
          <Text style={styles.clientName}>{item.clientName}</Text>

          {/* Service Info */}
          <View style={styles.serviceRow}>
            <Ionicons name={item.serviceIcon} size={14} color={C.grey} />
            <Text style={styles.serviceText}>{item.serviceName}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.serviceText}>{item.durationMinutes} min</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={[styles.serviceText, styles.priceText]}>${item.price}</Text>
          </View>

          {/* Action Buttons */}
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size={16} color={C.gold} />
              <Text style={styles.busyText}>Updating...</Text>
            </View>
          ) : item.status === 'pending' ? (
            <View style={styles.actionRow}>
              {/* Confirm: green outline */}
              <TouchableOpacity
                style={[styles.actionButton, styles.confirmOutlineBtn]}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Ionicons name={icons.checkOutline} size={16} color={C.green} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: C.green }]}>Confirm</Text>
              </TouchableOpacity>

              {/* Decline: red outline */}
              <TouchableOpacity
                style={[styles.actionButton, styles.declineOutlineBtn]}
                onPress={handleDecline}
                activeOpacity={0.8}
              >
                <Ionicons name={icons.close} size={16} color={C.red} style={{ marginRight: 6 }} />
                <Text style={[styles.actionButtonText, { color: C.red }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : item.status === 'confirmed' ? (
            <View style={styles.actionRow}>
              {/* In Chair: gold filled */}
              <TouchableOpacity
                style={[styles.actionButton, styles.inChairBtn]}
                onPress={handleInChair}
                activeOpacity={0.8}
              >
                <Text style={styles.inChairText}>In Chair</Text>
              </TouchableOpacity>

              {/* Complete: green filled */}
              <TouchableOpacity
                style={[styles.actionButton, styles.completeBtn]}
                onPress={handleComplete}
                activeOpacity={0.8}
              >
                <Ionicons name={icons.checkOutline} size={16} color={C.bg} style={{ marginRight: 6 }} />
                <Text style={styles.completeText}>Complete</Text>
              </TouchableOpacity>
            </View>
          ) : item.status === 'in_progress' ? (
            <TouchableOpacity
              style={[styles.fullWidthButton, styles.completeBtn]}
              onPress={handleComplete}
              activeOpacity={0.8}
            >
              <Ionicons name={icons.checkOutline} size={18} color={C.bg} style={{ marginRight: 8 }} />
              <Text style={styles.fullWidthButtonText}>Complete</Text>
            </TouchableOpacity>
          ) : null}

          {/* Declined note */}
          {item.status === 'declined' && (
            <View style={styles.declinedNote}>
              <Ionicons name={icons.information} size={14} color={C.red} />
              <Text style={styles.declinedNoteText}>Booking declined - client has been notified.</Text>
            </View>
          )}
        </View>
      </View>
    </AnimatedCard>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();

  const [bookings, setBookings] = useState<RichBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completeSnack, setCompleteSnack] = useState(false);

  const firstName = (appUser?.displayName ?? 'Barber').split(' ')[0];

  // Header animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const nextUpFadeAnim = useRef(new Animated.Value(0)).current;
  const nextUpSlideAnim = useRef(new Animated.Value(20)).current;
  const emptyFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!loading && bookings.length === 0) {
      const timer = setTimeout(() => {
        Animated.timing(emptyFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [loading, bookings.length]);

  // Real-time listener
  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);

    const myName = appUser?.displayName ?? 'Barber';
    const start = new Date(TODAY);
    start.setHours(0, 0, 0, 0);
    const end = new Date(TODAY);
    end.setHours(23, 59, 59, 999);

    const unsubscribe = BookingService.onSnapshotByBarber(
      firebaseUser.uid,
      (rawBookings) => {
        const today = rawBookings.filter((b) => {
          const ms = safeToDate(b.scheduledAt).getTime();
          return ms >= start.getTime() && ms <= end.getTime();
        });
        setBookings(today.map((b) => bookingToRich(b, myName)));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, [firebaseUser, appUser]);

  // Handle status action
  const handleStatusAction = useCallback(
    async (bookingId: string, newStatus: BookingStatus) => {
      const prevStatus = bookings.find((b) => b.id === bookingId)?.status;

      try {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
        );

        const result = await BookingService.updateStatus(bookingId, { status: newStatus });

        if (!result.success) {
          if (prevStatus) {
            setBookings((prev) =>
              prev.map((b) => (b.id === bookingId ? { ...b, status: prevStatus } : b))
            );
          }
          Alert.alert('Could not update', result.error ?? 'Please try again.');
          return;
        }

        if (newStatus === 'completed') {
          setCompleteSnack(true);
        }
      } catch (err: unknown) {
        if (prevStatus) {
          setBookings((prev) =>
            prev.map((b) => (b.id === bookingId ? { ...b, status: prevStatus } : b))
          );
        }
        const msg = err instanceof Error ? err.message : String(err);
        Alert.alert('Error', msg);
      }
    },
    [bookings]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Stats
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter((b) => b.status === 'completed').length;
  const earnings = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + b.price, 0);

  const pendingAndConfirmed = bookings
    .filter((b) => b.status === 'pending' || b.status === 'confirmed')
    .sort((a, b) => a.sortMs - b.sortMs);
  const nextUp = pendingAndConfirmed[0];

  // Animate next up card when it appears
  useEffect(() => {
    if (nextUp) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(nextUpFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(nextUpSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [nextUp]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} colors={[C.gold]} />
        }
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.name}>{firstName}</Text>
        </Animated.View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard icon={icons.tabBookOutline} label="Appointments" value={String(totalBookings)} delay={200} />
          <StatCard icon={icons.check} label="Completed" value={String(completedBookings)} delay={300} />
          <StatCard icon="cash-outline" label="Earnings" value={`$${earnings}`} delay={400} />
        </View>

        {/* Next Up Card */}
        {nextUp && (
          <Animated.View style={[styles.nextUpContainer, { opacity: nextUpFadeAnim, transform: [{ translateY: nextUpSlideAnim }] }]}>
            <View style={styles.nextUpCard}>
              <View style={styles.nextUpIndicator} />
              <View style={styles.nextUpContent}>
                <Text style={styles.nextUpLabel}>Next Up</Text>
                <Text style={styles.nextUpClient}>{nextUp.clientName}</Text>
                <Text style={styles.nextUpDetails}>
                  {nextUp.serviceName} at {nextUp.timeLabel}
                </Text>
              </View>
              <Ionicons name={icons.arrowForward} size={24} color={C.gold} />
            </View>
          </Animated.View>
        )}

        {/* Appointments Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Appointments</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{bookings.length}</Text>
          </View>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={24} color={C.gold} />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && bookings.length === 0 && (
          <Animated.View style={[styles.emptyContainer, { opacity: emptyFadeAnim }]}>
            <Ionicons name={icons.tabBookOutline} size={56} color={C.greyDark} />
            <Text style={styles.emptyTitle}>No appointments today</Text>
            <Text style={styles.emptySubtitle}>Your schedule is clear. Time to relax or grab a coffee.</Text>
          </Animated.View>
        )}

        {/* Appointment Cards */}
        {!loading &&
          bookings.map((booking, index) => (
            <AppointmentCard
              key={booking.id}
              item={booking}
              onAction={handleStatusAction}
              index={index}
            />
          ))}
      </ScrollView>

      {/* Success Snackbar */}
      <Snackbar
        visible={completeSnack}
        onDismiss={() => setCompleteSnack(false)}
        duration={2200}
        style={styles.snackbar}
        wrapperStyle={{ paddingHorizontal: spacing.lg }}
      >
        <Text style={styles.snackbarText}>Booking completed successfully</Text>
      </Snackbar>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  greeting: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['3xl'],
    color: C.grey,
    letterSpacing: fonts.letterSpacing.wide,
  },
  name: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['4xl'],
    color: C.gold,
    letterSpacing: fonts.letterSpacing.tight,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: C.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size['2xl'],
    color: C.white,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wider,
  },

  // Next Up
  nextUpContainer: {
    marginBottom: spacing.xl,
  },
  nextUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.gold,
    padding: spacing.lg,
    ...shadows.gold,
  },
  nextUpIndicator: {
    width: 4,
    height: 50,
    backgroundColor: C.gold,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  nextUpContent: {
    flex: 1,
  },
  nextUpLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wider,
    marginBottom: spacing.xs,
  },
  nextUpClient: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.white,
    marginBottom: spacing.xs,
  },
  nextUpDetails: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
    flex: 1,
  },
  countBadge: {
    backgroundColor: C.goldGlow,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.gold,
  },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xl,
    color: C.white,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // Cards
  cardContainer: {
    marginBottom: spacing.md,
  },
  appointmentCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  appointmentCardTerminal: {
    opacity: 0.7,
  },
  statusLine: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    padding: spacing.lg,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
  },
  statusBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wide,
  },

  // Card Body
  clientName: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.white,
    marginBottom: spacing.sm,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  serviceText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },
  dot: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.greyDark,
  },
  priceText: {
    fontFamily: fonts.bodyBold,
    color: C.gold,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius['2xl'],
  },
  actionButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
  },

  // Button Variants
  confirmOutlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.green,
  },
  declineOutlineBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.red,
  },
  inChairBtn: {
    backgroundColor: C.gold,
    borderWidth: 0,
  },
  inChairText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },
  completeBtn: {
    backgroundColor: C.green,
    borderWidth: 0,
  },
  completeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },

  fullWidthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius['2xl'],
  },
  fullWidthButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.bg,
  },

  // Busy State
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  busyText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Declined Note
  declinedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: `${C.red}15`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  declinedNoteText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.red,
    flex: 1,
  },

  // Snackbar
  snackbar: {
    backgroundColor: C.gold,
    borderRadius: radius.md,
  },
  snackbarText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },
});
