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

type Props = CompositeScreenProps<
  NativeStackScreenProps<HistoryStackParamList, 'HistoryList'>,
  BottomTabScreenProps<ClientTabParamList>
>;

const C = {
  bg:         '#0A0A0A',
  card:       '#161616',
  elevated:   '#1E1E1E',
  gold:       '#D4AF37',
  goldGlow:   '#D4AF3715',
  goldBorder: '#D4AF3730',
  green:      '#4CAF50',
  greenBg:    '#0D200D',
  greenBdr:   '#4CAF5030',
  amber:      '#FF9800',
  amberBg:    '#1A1000',
  danger:     '#CF6679',
  dangerBg:   '#1A0A0A',
  dangerBdr:  '#CF667940',
  red:        '#FF4444',
  redBg:      '#2A0A0A',
  redBdr:     '#FF444430',
  white:      '#FFFFFF',
  sub:        '#888888',
  muted:      '#333333',
  divider:    '#1A1A1A',
} as const;

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade', s2: 'Lineup', s3: 'Beard Trim', s4: 'Haircut', s5: 'Beard + Haircut',
};
const SERVICE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  s1: 'cut-outline', s2: 'cut-outline', s3: 'brush-outline',
  s4: 'cut-outline', s5: 'star-outline',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending:     { label: 'Pending Confirmation', color: '#FF9800', bg: '#1A1000', icon: 'time-outline' },
  confirmed:   { label: 'Confirmed',            color: C.green,  bg: C.greenBg, icon: 'checkmark-circle-outline' },
  declined:    { label: 'Declined by Barber',   color: C.danger, bg: C.dangerBg, icon: 'close-circle-outline' },
  in_progress: { label: 'In Chair',             color: C.gold,   bg: C.goldGlow, icon: 'cut-outline' },
  completed:   { label: 'Completed',            color: '#4CAF50',bg: C.greenBg,  icon: 'checkmark-done-outline' },
  cancelled:   { label: 'Cancelled',            color: C.danger, bg: C.dangerBg, icon: 'close-circle-outline' },
  no_show:     { label: 'No Show',              color: C.danger, bg: C.dangerBg, icon: 'alert-circle-outline' },
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

/** Three-step cancel state — works on web AND native (no Alert.alert needed) */
type CancelState = 'idle' | 'confirm' | 'loading';

// Styles must be declared BEFORE components that reference them (avoids web bundle / TDZ issues)
const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  list:   { paddingHorizontal: 16, paddingTop: 8 },
  listEmpty: { flexGrow: 1 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10,
  },
  headerEyebrow: { fontSize: 10, color: C.muted, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: -0.3 },
  headerLine:    { height: 1, marginHorizontal: 18, backgroundColor: C.gold, opacity: 0.15, marginBottom: 6 },
  countBadge: {
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  countText: { fontSize: 13, fontWeight: '800', color: C.gold },
  loadingText: { fontSize: 13, color: C.muted },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A0A0A', borderWidth: 1, borderColor: C.danger + '40',
    borderRadius: 10, marginHorizontal: 16, marginBottom: 10,
    padding: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: C.danger },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.goldBorder,
    overflow: 'hidden', marginBottom: 12,
    ...Platform.select({
      ios:     { shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  cardDimmed: { opacity: 0.55 },
  cardAccent: { height: 3 },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  svcIconWrap: {
    width: 44, height: 44, borderRadius: 11,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  svcName:  { fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 3 },
  svcDate:  { fontSize: 11, color: C.sub },
  svcPrice: { fontSize: 24, fontWeight: '900', color: C.gold, letterSpacing: -0.5 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 12, gap: 10,
  },
  codeWrap:     { flexDirection: 'row', alignItems: 'center' },
  codeText:     { fontSize: 11, color: C.muted, fontFamily: 'monospace', letterSpacing: 1 },
  durationWrap: { flexDirection: 'row', alignItems: 'center' },
  durationText: { fontSize: 11, color: C.muted },
  statusBadge: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  barberRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8,
  },
  barberLabel: { fontSize: 12, color: C.gold, fontWeight: '600' },

  noticeRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16 },

  snackbar: {
    marginBottom: 80, marginHorizontal: 12, borderRadius: 12,
    borderWidth: 1,
  },
  snackbarSuccess: {
    backgroundColor: '#0D200D', borderColor: '#4CAF5060',
  },
  snackbarError: {
    backgroundColor: '#2A0A0A', borderColor: '#FF444440',
  },

  msgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.goldBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.elevated,
  },
  msgBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: C.white },

  rateSection: {
    borderTopWidth: 1,
    borderTopColor: C.goldBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.bg,
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
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.goldBorder,
    paddingVertical: 11,
    gap: 8,
  },
  rateBtnText: { fontSize: 13, fontWeight: '800', color: C.gold },
  ratedLabel: { fontSize: 13, fontWeight: '700', color: C.sub, textAlign: 'center' },

  cancelWrap: {
    borderTopWidth: 1, borderTopColor: C.redBdr,
    backgroundColor: C.redBg,
    paddingHorizontal: 14, paddingVertical: 12,
  },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.redBdr,
    borderRadius: 10, paddingVertical: 11,
    backgroundColor: '#3D0808',
  },
  cancelBtnText: { fontSize: 13, fontWeight: '800', color: C.red },

  confirmWrap:    { gap: 10 },
  confirmTextRow: { flexDirection: 'row', alignItems: 'flex-start' },
  confirmText:    { flex: 1, fontSize: 13, color: C.white, lineHeight: 18 },
  confirmBtns:    { flexDirection: 'row', gap: 10 },
  keepBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.muted,
    borderRadius: 10, paddingVertical: 11,
    backgroundColor: C.elevated,
  },
  keepBtnText:    { fontSize: 13, fontWeight: '700', color: C.sub },
  yesCancelBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, paddingVertical: 11,
    backgroundColor: C.red,
    ...Platform.select({
      ios:     { shadowColor: C.red, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  yesCancelBtnText: { fontSize: 13, fontWeight: '800', color: C.white },

  cancelLoadRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  cancelLoadText: { fontSize: 13, color: C.red },

  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12, paddingTop: 60,
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.elevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.divider, marginBottom: 8,
  },
  emptyTitle:  { fontSize: 20, fontWeight: '800', color: C.white, textAlign: 'center' },
  emptySub:    { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    backgroundColor: C.gold, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },
});

// ── Booking card (standalone component with own cancel state) ─────────────────

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
  const svcIcon     = SERVICE_ICONS[item.serviceId] ?? 'cut-outline';
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
    <View style={[s.card, isTerminal && s.cardDimmed]}>
      {/* Top accent stripe coloured by status */}
      <View style={[s.cardAccent, { backgroundColor: meta.color }]} />

      <View style={s.cardHeader}>
        <View style={s.svcIconWrap}>
          <Ionicons name={svcIcon} size={20} color={isTerminal ? C.muted : C.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.svcName, isTerminal && { color: C.sub }]}>{svcName}</Text>
          <Text style={s.svcDate}>{dateLabel}</Text>
        </View>
        <Text style={[s.svcPrice, isTerminal && { color: C.sub }]}>${item.price}</Text>
      </View>

      {/* Barber row */}
      <View style={s.barberRow}>
        <Ionicons name="cut-outline" size={12} color={isTerminal ? C.muted : C.gold} style={{ marginRight: 5 }} />
        <Text style={[s.barberLabel, isTerminal && { color: C.sub }]}>{barberLabel}</Text>
      </View>

      {/* Footer: code · duration · status badge */}
      <View style={s.cardFooter}>
        <View style={s.codeWrap}>
          <Ionicons name="barcode-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
          <Text style={s.codeText}>{shortCode}</Text>
        </View>
        <View style={s.durationWrap}>
          <Ionicons name="timer-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
          <Text style={s.durationText}>{item.durationMinutes} min</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color + '40' }]}>
          <Ionicons name={meta.icon} size={12} color={meta.color} style={{ marginRight: 4 }} />
          <Text style={[s.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Status-specific notice row */}
      {item.status === 'pending' && (
        <View style={[s.noticeRow, { borderTopColor: C.amber + '40', backgroundColor: C.amberBg }]}>
          <Ionicons name="time-outline" size={13} color={C.amber} style={{ marginRight: 6 }} />
          <Text style={[s.noticeText, { color: C.amber }]}>
            Awaiting barber confirmation. You'll be notified once confirmed.
          </Text>
        </View>
      )}
      {item.status === 'confirmed' && (
        <View style={[s.noticeRow, { borderTopColor: C.green + '30', backgroundColor: C.greenBg }]}>
          <Ionicons name="checkmark-circle-outline" size={13} color={C.green} style={{ marginRight: 6 }} />
          <Text style={[s.noticeText, { color: C.green }]}>
            Booking confirmed! See you at your appointment.
          </Text>
        </View>
      )}
      {item.status === 'declined' && (
        <View style={[s.noticeRow, { borderTopColor: C.danger + '30', backgroundColor: C.dangerBg }]}>
          <Ionicons name="close-circle-outline" size={13} color={C.danger} style={{ marginRight: 6 }} />
          <Text style={[s.noticeText, { color: C.danger }]}>
            This booking was declined by the barber. Please book a different time.
          </Text>
        </View>
      )}
      {item.status === 'cancelled' && (
        <View style={[s.noticeRow, { borderTopColor: C.red + '30', backgroundColor: C.redBg }]}>
          <Ionicons name="close-circle-outline" size={13} color={C.red} style={{ marginRight: 6 }} />
          <Text style={[s.noticeText, { color: C.red }]}>
            You cancelled this appointment.
          </Text>
        </View>
      )}

      {/* ── Message barber ── */}
      <TouchableOpacity
        style={s.msgBtn}
        onPress={onMessage}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Message ${barberLabel}`}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.gold} style={{ marginRight: 8 }} />
        <Text style={s.msgBtnText}>Message {barberLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color={C.sub} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {item.status === 'completed' && ratedState != null && (
        <View style={s.rateSection}>
          {ratedState === 'loading' && (
            <View style={s.rateLoading}>
              <ActivityIndicator size="small" color={C.gold} />
            </View>
          )}
          {ratedState === 'rated' && (
            <Text style={s.ratedLabel}>★ Rated</Text>
          )}
          {ratedState === 'unrated' && onRatePress != null && (
            <TouchableOpacity
              style={s.rateBtn}
              onPress={onRatePress}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Rate this cut"
            >
              <Ionicons name="star-outline" size={18} color={C.gold} />
              <Text style={s.rateBtnText}>Rate this cut</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Cancel section (only for pending / confirmed) ── */}
      {canCancel && (
        <View style={s.cancelWrap}>

          {/* Step 1 — idle: show "Cancel Appointment" link */}
          {cancelState === 'idle' && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setCancelState('confirm')}
              accessibilityRole="button"
              accessibilityLabel={`Cancel ${svcName} appointment`}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle-outline" size={15} color={C.red} style={{ marginRight: 6 }} />
              <Text style={s.cancelBtnText}>Cancel Appointment</Text>
            </TouchableOpacity>
          )}

          {/* Step 2 — confirm: ask "are you sure?" inline */}
          {cancelState === 'confirm' && (
            <View style={s.confirmWrap}>
              <View style={s.confirmTextRow}>
                <Ionicons name="warning-outline" size={14} color={C.red} style={{ marginRight: 6 }} />
                <Text style={s.confirmText}>
                  Cancel your <Text style={{ fontWeight: '800' }}>{svcName}</Text> with{' '}
                  <Text style={{ fontWeight: '800' }}>{barberLabel}</Text>?
                </Text>
              </View>
              <View style={s.confirmBtns}>
                <TouchableOpacity
                  style={s.keepBtn}
                  onPress={() => setCancelState('idle')}
                  accessibilityRole="button"
                  accessibilityLabel="Keep booking"
                  activeOpacity={0.8}
                >
                  <Text style={s.keepBtnText}>Keep It</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.yesCancelBtn}
                  onPress={doCancel}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm cancellation"
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={14} color={C.white} style={{ marginRight: 5 }} />
                  <Text style={s.yesCancelBtnText}>Yes, Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 3 — loading */}
          {cancelState === 'loading' && (
            <View style={s.cancelLoadRow}>
              <ActivityIndicator size={14} color={C.red} />
              <Text style={s.cancelLoadText}>Cancelling your appointment…</Text>
            </View>
          )}

        </View>
      )}
    </View>
  );
}

export default function HistoryScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [snack,      setSnack]      = useState<{ msg: string; error: boolean } | null>(null);

  /** `true` = already rated; `false` = not rated; missing key = still checking */
  const [ratedByBooking, setRatedByBooking] = useState<Record<string, boolean>>({});
  const [ratingCheckDone, setRatingCheckDone] = useState(false);

  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);

  // Real-time listener — status updates (pending → confirmed) appear instantly
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

    return () => {
      cancelled = true;
    };
  }, [bookings, firebaseUser]);

  function ratedStateFor(bookingId: string, isCompleted: boolean): 'loading' | 'rated' | 'unrated' | null {
    if (!isCompleted) return null;
    if (!ratingCheckDone) return 'loading';
    if (!(bookingId in ratedByBooking)) return 'unrated';
    return ratedByBooking[bookingId] ? 'rated' : 'unrated';
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  function EmptyState(): React.JSX.Element {
    return (
      <View style={s.emptyWrap}>
        <View style={s.emptyIconWrap}>
          <Ionicons name="calendar-outline" size={40} color={C.muted} />
        </View>
        <Text style={s.emptyTitle}>No bookings yet</Text>
        <Text style={s.emptySub}>Your appointment history will appear here once you book a service.</Text>
        <TouchableOpacity
          style={s.emptyBtn}
          onPress={() => navigation.navigate('Book')}
          accessibilityRole="button"
          accessibilityLabel="Book your first appointment"
        >
          <Text style={s.emptyBtnText}>Book Your First Appointment</Text>
        </TouchableOpacity>
      </View>
    );
  }


  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator size={36} color={C.gold} />
        <Text style={s.loadingText}>Loading bookings…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>MY BOOKINGS</Text>
          <Text style={s.headerTitle}>History</Text>
        </View>
        {bookings.length > 0 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{bookings.length}</Text>
          </View>
        )}
      </View>
      <View style={s.headerLine} />

      {error ? (
        <View style={s.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={C.danger} style={{ marginRight: 8 }} />
          <Text style={s.errorText}>{error}</Text>
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
          s.list,
          bookings.length === 0 && s.listEmpty,
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
            tintColor={C.gold}
            colors={[C.gold]}
          />
        }
      />

      {/* ── Success / error snackbar (Portal + plain text — reliable on web) ── */}
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

      <Portal>
        <Snackbar
          visible={snack !== null}
          onDismiss={() => setSnack(null)}
          duration={3500}
          style={[
            s.snackbar,
            snack?.error ? s.snackbarError : s.snackbarSuccess,
          ]}
          action={{
            label: 'OK',
            textColor: snack?.error ? C.red : C.green,
            onPress: () => setSnack(null),
          }}
        >
          {snack?.msg ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}
