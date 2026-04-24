import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, RefreshControl, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Snackbar, Portal } from 'react-native-paper';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientTabParamList, HistoryStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import { Timestamp } from 'firebase/firestore';
import { Booking, BookingStatus } from '@/types/booking.types';
import { safeFormatTime, safeToDate } from '@/utils/date.utils';
import RatingModal from '@/components/RatingModal';
import { RatingService } from '@/services/rating.service';
import { colors, fonts, spacing, radius, icons } from '@/theme';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HistoryStackParamList, 'HistoryList'>,
  BottomTabScreenProps<ClientTabParamList>
>;

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade', s2: 'Lineup', s3: 'Beard Trim', s4: 'Haircut', s5: 'Beard + Haircut',
};
const SERVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  s1: icons.cutOutline, s2: icons.cutOutline, s3: icons.brush,
  s4: icons.cutOutline, s5: icons.starOutline,
};

// Status colors using theme
const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:     { label: 'Pending', color: colors.gold,  bg: colors.gold + '15', icon: icons.time },
  confirmed:   { label: 'Confirmed', color: colors.green, bg: colors.green + '15', icon: icons.checkOutline },
  declined:    { label: 'Declined', color: colors.red, bg: colors.red + '15', icon: icons.close },
  in_progress: { label: 'In Chair', color: colors.blue || '#2196F3', bg: (colors.blue || '#2196F3') + '15', icon: icons.cut },
  completed:   { label: 'Completed', color: colors.green, bg: colors.green + '15', icon: icons.check },
  cancelled:   { label: 'Cancelled', color: colors.red, bg: colors.red + '15', icon: icons.close },
  no_show:     { label: 'No Show', color: colors.red, bg: colors.red + '15', icon: icons.warning },
};

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatBookingDate(ts: Timestamp | null | undefined): string {
  if (ts == null) return '—';
  const d = safeToDate(ts);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${safeFormatTime(ts)}`;
}

/** Statuses the client can still cancel */
const CANCELLABLE: BookingStatus[] = ['pending', 'confirmed'];

/** Three-step cancel state */
type CancelState = 'idle' | 'confirm' | 'loading';

// ─── Booking Card Component ───────────────────────────────────────────────────

function BookingCard({
  item,
  onCancelled,
  onMessage,
  ratedState,
  onRatePress,
}: {
  item: Booking;
  onCancelled: (msg: string, isError?: boolean) => void;
  onMessage: () => void;
  ratedState?: 'loading' | 'rated' | 'unrated';
  onRatePress?: () => void;
}): React.JSX.Element {
  const [cancelState, setCancelState] = useState<CancelState>('idle');

  const meta        = STATUS_META[item.status] ?? STATUS_META.pending;
  const svcName     = SERVICE_NAMES[item.serviceId] ?? item.serviceId;
  const svcIcon     = SERVICE_ICONS[item.serviceId] ?? icons.cutOutline;
  const dateLabel   = formatBookingDate(item.scheduledAt);
  const shortCode   = item.id.substring(0, 6).toUpperCase();
  const barberLabel = item.barberName ?? 'Your Barber';
  const canCancel   = CANCELLABLE.includes(item.status);
  const isTerminal  = ['cancelled', 'declined', 'no_show'].includes(item.status);

  async function doCancel(): Promise<void> {
    setCancelState('loading');
    const result = await BookingService.updateStatus(item.id, {
      status:             'cancelled',
      cancelledBy:        'client',
      cancellationReason: 'Cancelled by client',
    });
    setCancelState('idle');
    if (result.success) {
      onCancelled(`Your ${svcName} appointment has been cancelled.`);
    } else {
      onCancelled('Could not cancel. Please try again.', true);
    }
  }

  return (
    <View style={[styles.card, isTerminal && styles.cardDimmed]}>
      {/* Left status bar */}
      <View style={[styles.leftStatusBar, { backgroundColor: meta.color }]} />

      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.svcIconWrap}>
            <Ionicons name={svcIcon} size={20} color={isTerminal ? colors.greyDark : colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.svcName, isTerminal && { color: colors.grey }]}>{svcName}</Text>
            <Text style={styles.svcDate}>{dateLabel}</Text>
          </View>
          <Text style={[styles.svcPrice, isTerminal && { color: colors.grey }]}>${item.price}</Text>
        </View>

        {/* Barber row */}
        <View style={styles.barberRow}>
          <Ionicons name={icons.cutOutline} size={12} color={isTerminal ? colors.greyDark : colors.gold} style={{ marginRight: 5 }} />
          <Text style={[styles.barberLabel, isTerminal && { color: colors.grey }]}>{barberLabel}</Text>
        </View>

        {/* Footer: code · duration · status badge pill */}
        <View style={styles.cardFooter}>
          <View style={styles.codeWrap}>
            <Ionicons name="barcode-outline" size={12} color={colors.greyDark} style={{ marginRight: 4 }} />
            <Text style={styles.codeText}>{shortCode}</Text>
          </View>
          <View style={styles.durationWrap}>
            <Ionicons name={icons.time} size={12} color={colors.greyDark} style={{ marginRight: 4 }} />
            <Text style={styles.durationText}>{item.durationMinutes} min</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color + '50' }]}>
            <Ionicons name={meta.icon} size={12} color={meta.color} style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* Status-specific notice row */}
        {item.status === 'pending' && (
          <View style={[styles.noticeRow, { borderTopColor: colors.gold + '30', backgroundColor: colors.gold + '10' }]}>
            <Ionicons name={icons.time} size={13} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={[styles.noticeText, { color: colors.gold }]}>
              Awaiting barber confirmation. You'll be notified once confirmed.
            </Text>
          </View>
        )}
        {item.status === 'confirmed' && (
          <View style={[styles.noticeRow, { borderTopColor: colors.green + '30', backgroundColor: colors.green + '10' }]}>
            <Ionicons name={icons.checkOutline} size={13} color={colors.green} style={{ marginRight: 6 }} />
            <Text style={[styles.noticeText, { color: colors.green }]}>
              Booking confirmed! See you at your appointment.
            </Text>
          </View>
        )}
        {item.status === 'declined' && (
          <View style={[styles.noticeRow, { borderTopColor: colors.red + '30', backgroundColor: colors.red + '10' }]}>
            <Ionicons name={icons.close} size={13} color={colors.red} style={{ marginRight: 6 }} />
            <Text style={[styles.noticeText, { color: colors.red }]}>
              This booking was declined by the barber. Please book a different time.
            </Text>
          </View>
        )}
        {item.status === 'cancelled' && (
          <View style={[styles.noticeRow, { borderTopColor: colors.red + '30', backgroundColor: colors.red + '10' }]}>
            <Ionicons name={icons.close} size={13} color={colors.red} style={{ marginRight: 6 }} />
            <Text style={[styles.noticeText, { color: colors.red }]}>
              You cancelled this appointment.
            </Text>
          </View>
        )}

        {/* Message barber */}
        <TouchableOpacity
          style={styles.msgBtn}
          onPress={onMessage}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Message ${barberLabel}`}
        >
          <Ionicons name={icons.chatOutline} size={16} color={colors.gold} style={{ marginRight: 8 }} />
          <Text style={styles.msgBtnText}>Message {barberLabel}</Text>
          <Ionicons name={icons.forward} size={16} color={colors.greyDark} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* Rate this cut - gold outline button */}
        {item.status === 'completed' && ratedState != null && (
          <View style={styles.rateSection}>
            {ratedState === 'loading' && (
              <View style={styles.rateLoading}>
                <ActivityIndicator size="small" color={colors.gold} />
              </View>
            )}
            {ratedState === 'rated' && (
              <View style={styles.ratedLabelRow}>
                <Ionicons name={icons.star} size={14} color={colors.gold} />
                <Text style={styles.ratedLabel}>Rated</Text>
              </View>
            )}
            {ratedState === 'unrated' && onRatePress != null && (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={onRatePress}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Rate this cut"
              >
                <Ionicons name={icons.starOutline} size={18} color={colors.gold} />
                <Text style={styles.rateBtnText}>Rate this cut</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Cancel section */}
        {canCancel && (
          <View style={styles.cancelWrap}>
            {cancelState === 'idle' && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCancelState('confirm')}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${svcName} appointment`}
                activeOpacity={0.75}
              >
                <Ionicons name={icons.close} size={15} color={colors.red} style={{ marginRight: 6 }} />
                <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
              </TouchableOpacity>
            )}
            {cancelState === 'confirm' && (
              <View style={styles.confirmWrap}>
                <View style={styles.confirmTextRow}>
                  <Ionicons name={icons.warning} size={14} color={colors.red} style={{ marginRight: 6 }} />
                  <Text style={styles.confirmText}>
                    Cancel your <Text style={{ fontFamily: fonts.bodyBold }}>{svcName}</Text> with{' '}
                    <Text style={{ fontFamily: fonts.bodyBold }}>{barberLabel}</Text>?
                  </Text>
                </View>
                <View style={styles.confirmBtns}>
                  <TouchableOpacity
                    style={styles.keepBtn}
                    onPress={() => setCancelState('idle')}
                    accessibilityRole="button"
                    accessibilityLabel="Keep booking"
                    activeOpacity={0.8}
                  >
                    <Text style={styles.keepBtnText}>Keep It</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.yesCancelBtn}
                    onPress={doCancel}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm cancellation"
                    activeOpacity={0.8}
                  >
                    <Ionicons name={icons.close} size={14} color={colors.white} style={{ marginRight: 5 }} />
                    <Text style={styles.yesCancelBtnText}>Yes, Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {cancelState === 'loading' && (
              <View style={styles.cancelLoadRow}>
                <ActivityIndicator size={14} color={colors.red} />
                <Text style={styles.cancelLoadText}>Cancelling your appointment...</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen Component ────────────────────────────────────────────────────

export default function HistoryScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [snack,      setSnack]      = useState<{ msg: string; error: boolean } | null>(null);

  const [ratedByBooking, setRatedByBooking] = useState<Record<string, boolean>>({});
  const [ratingCheckDone, setRatingCheckDone] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);

  // Real-time listener
  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const unsubscribe = BookingService.onSnapshotByClient(
      firebaseUser.uid,
      (data) => {
        setBookings(data);
        setLoading(false);
        setError(null);
      },
      () => {
        setError('Could not load bookings. Pull to retry.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const completed = bookings.filter((b) => b.status === 'completed');
    if (completed.length === 0) {
      setRatedByBooking({});
      setRatingCheckDone(true);
      return;
    }

    let cancelled = false;
    setRatingCheckDone(false);

    void (async () => {
      try {
        const entries = await Promise.all(
          completed.map(
            async (b) => [b.id, await RatingService.hasRated(b.id)] as const,
          ),
        );
        if (cancelled) return;
        setRatedByBooking(Object.fromEntries(entries));
      } catch {
        if (!cancelled) {
          setRatedByBooking(
            Object.fromEntries(completed.map((b) => [b.id, false] as const)),
          );
          setSnack({
            msg: 'Could not check rating status. Pull to refresh.',
            error: true,
          });
        }
      } finally {
        if (!cancelled) setRatingCheckDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [bookings, firebaseUser]);

  function ratedStateFor(bookingId: string, isCompleted: boolean): 'loading' | 'rated' | 'unrated' | null {
    if (!isCompleted) return null;
    if (!ratingCheckDone) return 'loading';
    if (!(bookingId in ratedByBooking)) return 'unrated';
    return ratedByBooking[bookingId] ? 'rated' : 'unrated';
  }

  function EmptyState(): React.JSX.Element {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name={icons.tabBookOutline} size={40} color={colors.greyDark} />
        </View>
        <Text style={styles.emptyTitle}>No bookings yet</Text>
        <Text style={styles.emptySub}>Your appointment history will appear here once you book a service.</Text>
        <TouchableOpacity
          style={styles.emptyBtn}
          onPress={() => navigation.navigate('Book')}
          accessibilityRole="button"
          accessibilityLabel="Book your first appointment"
        >
          <Text style={styles.emptyBtnText}>Book Your First Appointment</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <ActivityIndicator size={36} color={colors.gold} />
        <Text style={styles.loadingText}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>MY BOOKINGS</Text>
          <Text style={styles.headerTitle}>History</Text>
        </View>
        {bookings.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{bookings.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.headerLine} />

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name={icons.warning} size={16} color={colors.red} style={{ marginRight: 8 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingCard
            item={item}
            onCancelled={(msg, isError) => setSnack({ msg, error: !!isError })}
            onMessage={() => {
              if (!firebaseUser) return;
              navigation.navigate('Chat', {
                clientId: firebaseUser.uid,
                clientName: firebaseUser.displayName ?? 'Client',
                barberId: item.barberId,
                barberName: item.barberName ?? 'Barber',
                bookingId: item.id,
              });
            }}
            ratedState={ratedStateFor(item.id, item.status === 'completed') ?? undefined}
            onRatePress={() => setRatingBooking(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          bookings.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 600);
            }}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      />

      {/* Rating Modal */}
      {firebaseUser != null && ratingBooking != null && (
        <RatingModal
          visible
          barberName={ratingBooking.barberName ?? 'Your barber'}
          serviceName={SERVICE_NAMES[ratingBooking.serviceId] ?? ratingBooking.serviceId}
          dateLabel={formatBookingDate(ratingBooking.scheduledAt)}
          onClose={() => setRatingBooking(null)}
          onSubmit={async (rating, comment) => {
            try {
              await RatingService.submitRating({
                bookingId: ratingBooking.id,
                clientId: firebaseUser.uid,
                barberId: ratingBooking.barberId,
                rating,
                comment,
              });
              setRatedByBooking((prev) => ({ ...prev, [ratingBooking.id]: true }));
              setRatingBooking(null);
              setSnack({ msg: 'Thanks for your feedback.', error: false });
            } catch {
              setSnack({
                msg: 'Could not save your rating. Please try again.',
                error: true,
              });
              throw new Error('submitRating failed');
            }
          }}
        />
      )}

      {/* Snackbar */}
      <Portal>
        <Snackbar
          visible={snack !== null}
          onDismiss={() => setSnack(null)}
          duration={3500}
          style={[
            styles.snackbar,
            snack?.error ? styles.snackbarError : styles.snackbarSuccess,
          ]}
          action={{
            label: 'OK',
            textColor: snack?.error ? colors.red : colors.green,
            onPress: () => setSnack(null),
          }}
        >
          {snack?.msg ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 14 },
  list:   { paddingHorizontal: spacing.lg, paddingTop: 8 },
  listEmpty: { flexGrow: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10,
  },
  headerEyebrow: { fontSize: 10, color: colors.greyDark, fontFamily: fonts.bodyBold, letterSpacing: 2, marginBottom: 2 },
  headerTitle:   { fontSize: 22, fontFamily: fonts.heading, color: colors.white, letterSpacing: -0.3 },
  headerLine:    { height: 1, marginHorizontal: 18, backgroundColor: colors.gold, opacity: 0.15, marginBottom: 6 },
  countBadge: {
    backgroundColor: colors.gold + '15', borderWidth: 1, borderColor: colors.gold + '40',
    borderRadius: radius['2xl'], paddingHorizontal: 12, paddingVertical: 5,
  },
  countText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.gold },
  loadingText: { fontSize: 13, color: colors.greyDark },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.red + '15', borderWidth: 1, borderColor: colors.red + '40',
    borderRadius: radius.sm, marginHorizontal: 16, marginBottom: 10,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.red },

  // Card with left status bar
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  cardDimmed: { opacity: 0.55 },
  leftStatusBar: {
    width: 3,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  svcIconWrap: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.gold + '15', borderWidth: 1, borderColor: colors.gold + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  svcName:  { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.white, marginBottom: 3 },
  svcDate:  { fontSize: 11, color: colors.grey },
  svcPrice: { fontSize: 24, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: -0.5 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12, gap: 10,
  },
  codeWrap:     { flexDirection: 'row', alignItems: 'center' },
  codeText:     { fontSize: 11, color: colors.greyDark, fontFamily: 'monospace', letterSpacing: 1 },
  durationWrap: { flexDirection: 'row', alignItems: 'center' },
  durationText: { fontSize: 11, color: colors.greyDark },

  // Status badge pill
  statusBadge: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.sm, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: fonts.bodyBold },

  barberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8,
  },
  barberLabel: { fontSize: 12, color: colors.gold, fontFamily: fonts.bodySemiBold },

  noticeRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16 },

  // Snackbar
  snackbar: {
    marginBottom: 80, marginHorizontal: 12, borderRadius: radius.sm,
    borderWidth: 1,
  },
  snackbarSuccess: {
    backgroundColor: colors.green + '15', borderColor: colors.green + '40',
  },
  snackbarError: {
    backgroundColor: colors.red + '15', borderColor: colors.red + '40',
  },

  // Message button
  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceRaised,
  },
  msgBtnText: { flex: 1, fontSize: 13, fontFamily: fonts.bodyBold, color: colors.white },

  // Rate section with gold outline button
  rateSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  rateLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    paddingVertical: 11,
    gap: 8,
  },
  rateBtnText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.gold },
  ratedLabel: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.grey },
  ratedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  // Cancel section
  cancelWrap: {
    borderTopWidth: 1, borderTopColor: colors.red + '30',
    backgroundColor: colors.red + '10',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.red + '40',
    borderRadius: radius.sm, paddingVertical: 11,
    backgroundColor: colors.red + '20',
  },
  cancelBtnText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.red },

  confirmWrap:    { gap: 10 },
  confirmTextRow: { flexDirection: 'row', alignItems: 'flex-start' },
  confirmText:    { flex: 1, fontSize: 13, color: colors.white, lineHeight: 18 },
  confirmBtns:    { flexDirection: 'row', gap: 10 },
  keepBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingVertical: 11,
    backgroundColor: colors.surfaceRaised,
  },
  keepBtnText:    { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.grey },
  yesCancelBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, paddingVertical: 11,
    backgroundColor: colors.red,
    ...Platform.select({
      ios:     { shadowColor: colors.red, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  yesCancelBtnText: { fontSize: 13, fontFamily: fonts.bodyBold, color: colors.white },

  cancelLoadRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  cancelLoadText: { fontSize: 13, color: colors.red },

  // Empty state
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12, paddingTop: 60,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, marginBottom: 8,
  },
  emptyTitle:  { fontSize: 20, fontFamily: fonts.heading, color: colors.white, textAlign: 'center' },
  emptySub:    { fontSize: 13, color: colors.grey, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    backgroundColor: colors.gold, borderRadius: radius['2xl'],
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.background },
});
