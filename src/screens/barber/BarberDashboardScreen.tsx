/**
 * BarberDashboardScreen
 *
 * Role-aware dashboard:
 *  • admin  → Owner view  (Amir): full shop stats, all barbers, reassign
 *  • barber → Staff view         : personal schedule, status action flow
 *
 * Loads mock data immediately so the UI is always populated for demos.
 * Real Firestore data (BarberService / BookingService) loads in parallel
 * and replaces mock data once available.
 */

import React, {
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
  Modal,
  Platform,
  Alert,
  Text as RNText,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarberService } from '@/services/barber.service';
import { BookingService } from '@/services/booking.service';
import { BookingStatus } from '@/types/booking.types';
import { useAuth } from '@/hooks/useAuth';
import { safeToDate } from '@/utils/date.utils';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:         '#0A0A0A',
  surface:    '#141414',
  card:       '#161616',
  elevated:   '#1C1C1C',
  border:     '#222222',
  gold:       '#D4AF37',
  goldDark:   '#A8861A',
  goldLight:  '#EDD060',
  goldGlow:   '#D4AF3715',
  goldBorder: '#D4AF3740',
  green:      '#4CAF50',
  greenBg:    '#0D1A0D',
  greenBdr:   '#4CAF5040',
  amber:      '#FF9800',
  amberBg:    '#1A1000',
  amberBdr:   '#FF980040',
  grey:       '#888888',
  greyBg:     '#1A1A1A',
  greyBdr:    '#33333340',
  danger:     '#CF6679',
  dangerBg:   '#1A0A0A',
  dangerBdr:  '#CF667940',
  red:        '#FF4444',
  white:      '#FFFFFF',
  sub:        '#666666',
  muted:      '#333333',
} as const;

const { width: SW } = Dimensions.get('window');

// ─── Static lookups ───────────────────────────────────────────────────────────

const SERVICE_MAP: Record<string, { name: string; iconName: keyof typeof Ionicons.glyphMap }> = {
  s1: { name: 'Fade',            iconName: 'cut-outline'  },
  s2: { name: 'Lineup',          iconName: 'cut-outline'  },
  s3: { name: 'Beard Trim',      iconName: 'cut-outline'  },
  s4: { name: 'Haircut',         iconName: 'cut-outline'  },
  s5: { name: 'Beard + Haircut', iconName: 'star-outline' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RichBooking {
  id:              string;
  clientName:      string;
  serviceName:     string;
  serviceIcon:     keyof typeof Ionicons.glyphMap;
  barberId:        string;
  barberName:      string;
  timeLabel:       string;
  sortMs:          number;
  price:           number;
  durationMinutes: number;
  status:          BookingStatus;
}

interface MockBarber {
  id:          string;
  displayName: string;
  initials:    string;
}

const TODAY = new Date();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLabel(): string {
  const d = TODAY;
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color, iconName,
}: {
  label: string; value: string; sub?: string; color?: string;
  iconName: keyof typeof Ionicons.glyphMap;
}): React.JSX.Element {
  return (
    <View style={sc.card} accessibilityLabel={`${label}: ${value}`}>
      <View style={sc.iconRow}>
        <Ionicons name={iconName} size={20} color={color ?? C.sub} />
        {sub ? <Text style={sc.sub}>{sub}</Text> : null}
      </View>
      <RNText
        style={[sc.value, color ? { color } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
      </RNText>
      <RNText
        style={sc.label}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {label}
      </RNText>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1, minWidth: 0, backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.goldBorder,
    padding: 14,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
  },
  iconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  icon:  { fontSize: 20 },
  sub:   { fontSize: 10, color: C.sub, fontWeight: '600' },
  value: { fontSize: 22, fontWeight: '900', color: C.gold, letterSpacing: -0.5, marginBottom: 4 },
  label: { fontSize: 10, color: C.sub, fontWeight: '600', letterSpacing: 0.8 },
});

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: 'Pending Approval', color: C.amber,   bg: C.amberBg,  border: C.amberBdr  },
  confirmed:   { label: 'Confirmed',        color: C.gold,    bg: C.goldGlow, border: C.goldBorder },
  declined:    { label: 'Declined',         color: C.danger,  bg: C.dangerBg, border: C.dangerBdr  },
  in_progress: { label: 'In Chair',         color: '#4FC3F7', bg: '#0A1520',  border: '#4FC3F740'  },
  completed:   { label: 'Completed',        color: C.green,   bg: C.greenBg,  border: C.greenBdr   },
  cancelled:   { label: 'Cancelled',        color: C.danger,  bg: C.dangerBg, border: C.dangerBdr  },
  no_show:     { label: 'No Show',          color: C.danger,  bg: C.dangerBg, border: C.dangerBdr  },
};

function StatusBadge({ status }: { status: BookingStatus }): React.JSX.Element {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[badge.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
});

// ─── Appointment card (OWNER) ─────────────────────────────────────────────────

function OwnerAppointmentCard({
  item,
  barbers,
  onReassign,
}: {
  item: RichBooking;
  barbers: MockBarber[];
  onReassign: (bookingId: string, newBarberId: string) => void;
}): React.JSX.Element {
  const [showReassign, setShowReassign] = useState(false);
  const slideX = useRef(new Animated.Value(0)).current;

  function toggleReassign(): void {
    const toValue = showReassign ? 0 : -90;
    Animated.spring(slideX, { toValue, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
    setShowReassign(v => !v);
  }

  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.pending;

  return (
    <View style={oc.outer} accessibilityRole="button" accessibilityLabel={`${item.clientName}, ${item.serviceName}, ${item.timeLabel}`}>
      {/* Swipe-reveal reassign strip */}
      <View style={oc.reassignStrip}>
        {barbers.filter(b => b.id !== item.barberId).map(b => (
          <TouchableOpacity
            key={b.id}
            style={oc.reassignBtn}
            onPress={() => { onReassign(item.id, b.id); setShowReassign(false); slideX.setValue(0); }}
            accessibilityLabel={`Assign to ${b.displayName}`}
          >
            <Text style={oc.reassignInitials}>{b.initials}</Text>
            <Text style={oc.reassignName}>{b.displayName}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={[oc.card, { transform: [{ translateX: slideX }] }]}>
        {/* Left accent bar */}
        <View style={[oc.accent, { backgroundColor: cfg.color }]} />

        <View style={oc.body}>
          <View style={oc.topRow}>
            <Text style={oc.time}>{item.timeLabel}</Text>
            <StatusBadge status={item.status} />
          </View>

          <Text style={oc.client}>{item.clientName}</Text>

          <View style={oc.metaRow}>
            <Ionicons name={item.serviceIcon} size={13} color={C.sub} />
            <Text style={oc.metaText}>{item.serviceName}</Text>
            <Text style={oc.metaDot}>·</Text>
            <Text style={oc.metaText}>{item.durationMinutes} min</Text>
            <Text style={oc.metaDot}>·</Text>
            <Text style={[oc.metaText, { color: C.gold }]}>${item.price}</Text>
          </View>

          <View style={oc.bottomRow}>
          <View style={oc.barberPill}>
                <Ionicons name="cut-outline" size={11} color={C.gold} />
                <Text style={oc.barberPillText}>{item.barberName}</Text>
              </View>
            {item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'no_show' && (
              <TouchableOpacity onPress={toggleReassign} style={oc.swipeHint}>
                <Text style={oc.swipeHintText}>{showReassign ? 'Cancel' : '⇄ Reassign'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const oc = StyleSheet.create({
  outer:         { position: 'relative', marginBottom: 10, borderRadius: 14, overflow: 'hidden' },
  reassignStrip: {
    position: 'absolute', top: 0, bottom: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.elevated, borderRadius: 14, paddingHorizontal: 6,
  },
  reassignBtn:      { alignItems: 'center', justifyContent: 'center', width: 56, gap: 2 },
  reassignInitials: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder, textAlign: 'center', lineHeight: 32, fontSize: 11, fontWeight: '800', color: C.gold },
  reassignName:     { fontSize: 9, color: C.sub, fontWeight: '700' },
  card: {
    flexDirection: 'row', backgroundColor: C.card,
    borderRadius: 14, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  accent: { width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  body:   { flex: 1, padding: 13 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  time:   { fontSize: 13, fontWeight: '800', color: C.white },
  client: { fontSize: 15, fontWeight: '700', color: C.white, marginBottom: 5 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  metaIcon:  { fontSize: 12 },
  metaText:  { fontSize: 12, color: C.grey },
  metaDot:   { fontSize: 12, color: C.muted },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barberPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  barberPillText: { fontSize: 11, color: C.gold, fontWeight: '700' },
  swipeHint:      { padding: 6 },
  swipeHintText:  { fontSize: 11, color: C.gold, fontWeight: '700' },
});

// ─── Appointment card (BARBER) ────────────────────────────────────────────────

function BarberAppointmentCard({
  item,
  onAction,
}: {
  item: RichBooking;
  onAction: (id: string, nextSt: BookingStatus, declinedReason?: string, rewardClaimed?: boolean) => void;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.pending;

  // Single-button advance for post-confirm statuses
  const advanceLabel = item.status === 'confirmed'   ? 'Mark In Chair'
                     : item.status === 'in_progress' ? 'Complete'
                     : null;
  const advanceNext: BookingStatus | null =
    item.status === 'confirmed'   ? 'in_progress' :
    item.status === 'in_progress' ? 'completed'   : null;

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    await onAction(item.id, 'confirmed');
    setBusy(false);
  }

  async function handleDecline(): Promise<void> {
    Alert.alert(
      'Decline Appointment?',
      `This will notify ${item.clientName} that their booking has been declined.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await onAction(item.id, 'declined', 'Barber unavailable');
            setBusy(false);
          },
        },
      ],
    );
  }

  async function handleAdvance(): Promise<void> {
    if (!advanceNext) return;
    if (advanceNext === 'completed') {
      Alert.alert(
        'Complete visit',
        'Did this client redeem a free facial steam loyalty reward on this visit?',
        [
          { text: 'No', style: 'cancel', onPress: () => { void completeVisit(false); } },
          { text: 'Yes, redeemed', onPress: () => { void completeVisit(true); } },
        ],
      );
      return;
    }
    setBusy(true);
    await onAction(item.id, advanceNext);
    setBusy(false);
  }

  async function completeVisit(rewardClaimed: boolean): Promise<void> {
    setBusy(true);
    await onAction(item.id, 'completed', undefined, rewardClaimed);
    setBusy(false);
  }

  const isTerminal = ['completed','declined','cancelled','no_show'].includes(item.status);

  return (
    <View
      style={[bc.card, { borderLeftColor: cfg.color }, isTerminal && { opacity: 0.7 }]}
      accessibilityLabel={`${item.clientName}, ${item.serviceName}, ${item.timeLabel}, ${cfg.label}`}
    >
      <View style={bc.topRow}>
        <Text style={bc.time}>{item.timeLabel}</Text>
        <StatusBadge status={item.status} />
      </View>

      <Text style={bc.client}>{item.clientName}</Text>

      <View style={bc.metaRow}>
        <Ionicons name={item.serviceIcon} size={13} color={C.sub} />
        <Text style={bc.metaText}>{item.serviceName}</Text>
        <Text style={bc.metaDot}>·</Text>
        <Text style={bc.metaText}>{item.durationMinutes} min</Text>
        <Text style={bc.metaDot}>·</Text>
        <Text style={[bc.metaText, { color: C.gold }]}>${item.price}</Text>
      </View>

      {busy ? (
        <View style={bc.busyRow}>
          <ActivityIndicator size={16} color={C.gold} />
          <Text style={bc.busyText}>Updating…</Text>
        </View>
      ) : item.status === 'pending' ? (
        <View style={bc.actionRow}>
          <TouchableOpacity
            style={bc.confirmBtn}
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm appointment"
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={14} color={C.bg} style={{ marginRight: 5 }} />
            <Text style={bc.confirmBtnText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={bc.declineBtn}
            onPress={handleDecline}
            accessibilityRole="button"
            accessibilityLabel="Decline appointment"
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={14} color={C.red} style={{ marginRight: 5 }} />
            <Text style={bc.declineBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : advanceLabel && advanceNext ? (
        <TouchableOpacity
          onPress={handleAdvance}
          style={bc.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={advanceLabel}
          activeOpacity={0.8}
        >
          <Text style={bc.actionBtnText}>{advanceLabel}  →</Text>
        </TouchableOpacity>
      ) : null}

      {item.status === 'declined' && (
        <View style={bc.declinedNote}>
          <Ionicons name="information-circle-outline" size={12} color={C.red} style={{ marginRight: 5 }} />
          <Text style={bc.declinedNoteText}>Booking declined — client notified.</Text>
        </View>
      )}
    </View>
  );
}

const bc = StyleSheet.create({
  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    borderLeftWidth: 4,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  topRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  time:    { fontSize: 13, fontWeight: '800', color: C.white },
  client:  { fontSize: 15, fontWeight: '700', color: C.white, marginBottom: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  metaIcon:{ fontSize: 12 },
  metaText:{ fontSize: 12, color: C.grey },
  metaDot: { fontSize: 12, color: C.muted },
  actionBtn: {
    backgroundColor: C.card, borderRadius: 10,
    height: 38, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.goldBorder,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: C.gold },

  actionRow:      { flexDirection: 'row', gap: 10 },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold, borderRadius: 10, height: 40,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: C.bg },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.dangerBg, borderRadius: 10, height: 40,
    borderWidth: 1, borderColor: C.dangerBdr,
  },
  declineBtnText: { fontSize: 13, fontWeight: '800', color: C.red },

  busyRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  busyText: { fontSize: 13, color: C.sub },

  declinedNote: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.dangerBg, borderRadius: 8,
    borderWidth: 1, borderColor: C.dangerBdr,
    paddingHorizontal: 10, paddingVertical: 7, marginTop: 4,
  },
  declinedNoteText: { flex: 1, fontSize: 11, color: C.red },
});

// ─── Add Walk-in Modal (stub) ─────────────────────────────────────────────────

function AddWalkInModal({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={wm.overlay} onPress={onClose} activeOpacity={1}>
        <View style={wm.sheet}>
          <View style={wm.handle} />
          <Text style={wm.title}>Add Walk-In Client</Text>
          <Text style={wm.sub}>
            Full walk-in booking form coming soon.{'\n'}This will let you assign a barber, service, and instant slot.
          </Text>
          <TouchableOpacity style={wm.closeBtn} onPress={onClose}>
            <Text style={wm.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const wm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.elevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: 'center', gap: 12 },
  handle:     { width: 36, height: 4, backgroundColor: C.muted, borderRadius: 2, marginBottom: 8 },
  title:      { fontSize: 18, fontWeight: '800', color: C.white },
  sub:        { fontSize: 13, color: C.grey, textAlign: 'center', lineHeight: 18 },
  closeBtn:   { marginTop: 8, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40 },
  closeBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────

function bookingToRich(bk: import('@/types/booking.types').Booking, fallbackBarberName: string): RichBooking {
  const svc = SERVICE_MAP[bk.serviceId] ?? { name: bk.serviceId, iconName: 'cut-outline' as keyof typeof Ionicons.glyphMap };
  const ms  = safeToDate(bk.scheduledAt).getTime();
  const d   = new Date(ms);
  const h   = d.getHours();
  const m   = d.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return {
    id:              bk.id,
    clientName:      bk.clientName ?? bk.clientId.substring(0, 8),
    serviceName:     svc.name,
    serviceIcon:     svc.iconName,
    barberId:        bk.barberId,
    barberName:      bk.barberName ?? fallbackBarberName,
    timeLabel:       `${displayH}:${m === 0 ? '00' : m < 10 ? '0' + m : m} ${period}`,
    sortMs:          ms,
    price:           bk.price,
    durationMinutes: bk.durationMinutes,
    status:          bk.status,
  };
}

export default function BarberDashboardScreen(): React.JSX.Element {
  const insets   = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const isOwner  = appUser?.role === 'admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [barbers,    setBarbers]    = useState<MockBarber[]>([]);
  const [bookings,   setBookings]   = useState<RichBooking[]>([]);
  const [activeTab,  setActiveTab]  = useState<string>('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal,  setShowModal]  = useState(false);

  // ── Real-time listener (barber view) ───────────────────────────────────────
  useEffect(() => {
    if (!firebaseUser || isOwner) return;

    setLoading(true);
    const myName = appUser?.displayName ?? 'Barber';

    const unsubscribe = BookingService.onSnapshotByBarber(
      firebaseUser.uid,
      (rawBookings) => {
        // Filter to today only
        const start = new Date(TODAY); start.setHours(0, 0, 0, 0);
        const end   = new Date(TODAY); end.setHours(23, 59, 59, 999);
        const today = rawBookings.filter((b) => {
          const ms = safeToDate(b.scheduledAt).getTime();
          return ms >= start.getTime() && ms <= end.getTime();
        });
        setBookings(today.map((b) => bookingToRich(b, myName)));
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [firebaseUser, isOwner, appUser]);

  // ── Owner: one-time fetch (can be refreshed) ───────────────────────────────
  async function fetchOwnerData(): Promise<void> {
    if (!isOwner) return;
    try {
      const bRes = await BarberService.getAll();
      if (bRes.success && bRes.data.length > 0) {
        const mapped: MockBarber[] = bRes.data.map(b => ({
          id:          b.id,
          displayName: b.displayName,
          initials:    b.displayName.substring(0, 2).toUpperCase(),
        }));
        setBarbers(mapped);
        const allBookings: RichBooking[] = [];
        await Promise.all(
          bRes.data.map(async (barber) => {
            const bkRes = await BookingService.getByBarberAndDate(barber.id, TODAY);
            if (bkRes.success) {
              bkRes.data.forEach(bk => allBookings.push(bookingToRich(bk, barber.displayName)));
            }
          }),
        );
        setBookings(allBookings.sort((a, b) => a.sortMs - b.sortMs));
      }
    } catch (_) {
      // leave empty
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isOwner) { setLoading(true); fetchOwnerData(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  async function onRefresh(): Promise<void> {
    if (isOwner) {
      setRefreshing(true);
      await fetchOwnerData();
    } else {
      // Barber: real-time listener auto-updates; just show a brief indicator
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 800);
    }
  }

  // ── Status action (barber only) ────────────────────────────────────────────
  async function handleStatusAction(
    bookingId: string,
    newStatus: BookingStatus,
    declinedReason?: string,
    rewardClaimed?: boolean,
  ): Promise<void> {
    const prevStatus = bookings.find((b) => b.id === bookingId)?.status;
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b)),
    );
    const result = await BookingService.updateStatus(bookingId, {
      status: newStatus,
      ...(declinedReason ? { declinedReason } : {}),
      ...(rewardClaimed ? { rewardClaimed: true } : {}),
    });
    if (!result.success) {
      if (prevStatus !== undefined) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: prevStatus } : b)),
        );
      }
      Alert.alert('Could not update', result.error ?? 'Please try again.');
      return;
    }
    // TODO: Send push notification to client when status changes
  }

  // ── Reassign (owner only) ──────────────────────────────────────────────────
  function handleReassign(bookingId: string, newBarberId: string): void {
    const newBarber = barbers.find(b => b.id === newBarberId);
    if (!newBarber) return;
    setBookings(prev =>
      prev.map(b =>
        b.id === bookingId
          ? { ...b, barberId: newBarberId, barberName: newBarber.displayName }
          : b,
      ),
    );
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const todayBookings = bookings;
  const totalRevenue  = todayBookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.price, 0);
  const totalCount    = todayBookings.length;
  const activeCount   = barbers.length;

  const myEarnings = todayBookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.price, 0);
  const myCount    = todayBookings.length;
  const nextUp     = todayBookings
    .filter(b => b.status === 'pending' || b.status === 'confirmed')
    .sort((a, b) => a.sortMs - b.sortMs)[0];

  const filteredBookings = activeTab === 'all'
    ? todayBookings
    : todayBookings.filter(b => b.barberId === activeTab);

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <Ionicons
              name={isOwner ? 'shield-checkmark-outline' : 'cut-outline'}
              size={11}
              color="#555555"
            />
            <Text style={s.headerEyebrow}>{isOwner ? 'OWNER VIEW' : 'MY SCHEDULE'}</Text>
          </View>
          <Text style={s.headerTitle} accessibilityRole="header">
            {isOwner ? 'Shop Dashboard' : `Hi, ${appUser?.displayName?.split(' ')[0] ?? 'Barber'}`}
          </Text>
          <Text style={s.headerDate}>{todayLabel()}</Text>
        </View>
        <View style={s.avatarWrap} accessibilityLabel="Profile">
          <Text style={s.avatarText}>
            {(appUser?.displayName ?? 'U').substring(0, 2).toUpperCase()}
          </Text>
        </View>
      </View>
      <View style={s.headerLine} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.gold}
            colors={[C.gold]}
          />
        }
      >

        {/* ── Stats row ── */}
        <View style={s.statsRow}>
          {isOwner ? (
            <>
              <StatCard iconName="cash-outline"     label="Revenue Today"  value={`$${totalRevenue}`} color={C.gold} />
              <StatCard iconName="calendar-outline" label="Bookings"       value={String(totalCount)} />
              <StatCard iconName="people-outline"   label="Active Barbers" value={String(activeCount)} />
            </>
          ) : (
            <>
              <StatCard iconName="cash-outline"     label="My Earnings" value={`$${myEarnings}`} color={C.gold} />
              <StatCard iconName="calendar-outline" label="My Bookings" value={String(myCount)} />
              <StatCard iconName="alarm-outline"    label="Next Up"     value={nextUp?.timeLabel ?? '—'} />
            </>
          )}
        </View>

        {/* ── Owner: quick action row ── */}
        {isOwner && (
          <View style={s.ownerActions}>
            <TouchableOpacity style={s.ownerActionBtn} onPress={() => setShowModal(true)}
              accessibilityRole="button" accessibilityLabel="Add walk-in client">
              <Ionicons name="add-circle-outline"  size={24} color={C.gold} />
              <Text style={s.ownerActionText}>Walk-In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.ownerActionBtn}
              accessibilityRole="button" accessibilityLabel="Block time slot">
              <Ionicons name="lock-closed-outline" size={24} color={C.sub} />
              <Text style={s.ownerActionText}>Block Slot</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.ownerActionBtn}
              accessibilityRole="button" accessibilityLabel="View revenue report">
              <Ionicons name="bar-chart-outline"   size={24} color={C.sub} />
              <Text style={s.ownerActionText}>Reports</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.ownerActionBtn}
              accessibilityRole="button" accessibilityLabel="Manage barbers">
              <Ionicons name="people-outline"      size={24} color={C.sub} />
              <Text style={s.ownerActionText}>Barbers</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Owner: barber filter tabs ── */}
        {isOwner && (
          <>
            <Text style={s.sectionLabel}>FILTER BY BARBER</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.tabRow}
            >
              <TouchableOpacity
                style={[s.tab, activeTab === 'all' && s.tabActive]}
                onPress={() => setActiveTab('all')}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === 'all' }}
              >
                <Text style={[s.tabText, activeTab === 'all' && s.tabTextActive]}>
                  All  ({totalCount})
                </Text>
              </TouchableOpacity>

              {barbers.map(b => {
                const count = bookings.filter(bk => bk.barberId === b.id).length;
                const isActive = activeTab === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[s.tab, isActive && s.tabActive]}
                    onPress={() => setActiveTab(b.id)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={[s.tabAvatar, isActive && s.tabAvatarActive]}>
                      <Text style={[s.tabAvatarText, isActive && { color: C.bg }]}>{b.initials}</Text>
                    </View>
                    <Text style={[s.tabText, isActive && s.tabTextActive]}>{b.displayName}  ({count})</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* ── Appointments section header ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionLabel}>
            {isOwner ? "TODAY'S APPOINTMENTS" : 'MY APPOINTMENTS'}
          </Text>
          <View style={s.countBadge}>
            <Text style={s.countText}>{filteredBookings.length}</Text>
          </View>
        </View>

        {/* ── Loading shimmer ── */}
        {loading && (
          <View style={s.loadingRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size={22} color={C.gold} />
            <Text style={s.loadingText}>Loading appointments…</Text>
          </View>
        )}

        {/* ── Appointment cards ── */}
        {filteredBookings.length === 0 && !loading ? (
          <View style={s.empty}>
            <Ionicons name="calendar-outline" size={48} color="#333333" />
            <Text style={s.emptyTitle}>All clear!</Text>
            <Text style={s.emptySub}>No appointments for today{activeTab !== 'all' ? ' with this barber' : ''}.</Text>
          </View>
        ) : isOwner ? (
          filteredBookings.map(item => (
            <OwnerAppointmentCard
              key={item.id}
              item={item}
              barbers={barbers}
              onReassign={handleReassign}
            />
          ))
        ) : (
          filteredBookings.map(item => (
            <BarberAppointmentCard
              key={item.id}
              item={item}
              onAction={handleStatusAction}
            />
          ))
        )}

        {/* ── Barber: next-up highlight ── */}
        {!isOwner && nextUp && (
          <View style={s.nextUpBanner}>
            <View style={s.nextUpDot} />
            <Text style={s.nextUpText}>
              Next: <Text style={{ color: C.gold, fontWeight: '800' }}>{nextUp.clientName}</Text>
              {'  ·  '}{nextUp.serviceName}{'  ·  '}{nextUp.timeLabel}
            </Text>
          </View>
        )}

      </ScrollView>

      <AddWalkInModal visible={showModal} onClose={() => setShowModal(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 18, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, gap: 12,
  },
  headerEyebrow: { fontSize: 10, color: C.gold, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: 0.2 },
  headerDate:    { fontSize: 12, color: C.sub, marginTop: 2 },
  headerLine:    { height: 1, marginHorizontal: 18, backgroundColor: C.gold, opacity: 0.2, marginBottom: 4 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.goldGlow, borderWidth: 2, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: C.gold },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 16 },

  // Owner action row
  ownerActions: {
    flexDirection: 'row', gap: 10, marginBottom: 20,
  },
  ownerActionBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 12, alignItems: 'center', gap: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 5, elevation: 3,
  },
  ownerActionText: { fontSize: 10, color: C.grey, fontWeight: '700', letterSpacing: 0.5 },

  // Filter tabs
  tabRow: { paddingBottom: 16, gap: 8 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.card, borderRadius: 24,
    borderWidth: 1, borderColor: C.border,
  },
  tabActive:       { backgroundColor: C.gold, borderColor: C.gold },
  tabAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  tabAvatarActive: { backgroundColor: C.bg, borderColor: C.bg },
  tabAvatarText:   { fontSize: 9, fontWeight: '800', color: C.gold },
  tabText:         { fontSize: 12, color: C.grey, fontWeight: '700' },
  tabTextActive:   { color: C.bg },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionLabel:  { fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 2, flex: 1 },
  countBadge:    { backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  countText:     { fontSize: 11, color: C.gold, fontWeight: '800' },

  // Loading
  loadingRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: C.sub },

  // Empty
  empty:     { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyTitle:{ fontSize: 17, fontWeight: '800', color: C.white },
  emptySub:  { fontSize: 13, color: C.sub, textAlign: 'center' },

  // Next-up banner (barber)
  nextUpBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    marginTop: 6, gap: 10,
  },
  nextUpDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold },
  nextUpText: { fontSize: 12, color: C.grey, flex: 1 },
});
