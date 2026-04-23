import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, Alert, Platform,
  Modal, Image, Pressable,
} from 'react-native';
import { ActivityIndicator, Snackbar, Text as PaperText } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarberTabParamList, ScheduleStackParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { BookingService } from '@/services/booking.service';
import { AIBarberGuideService, type BarberCutStep } from '@/services/aiBarberGuide.service';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { Booking, BookingStatus } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';

type Props = CompositeScreenProps<
  NativeStackScreenProps<ScheduleStackParamList, 'ScheduleList'>,
  BottomTabScreenProps<BarberTabParamList>
>;

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0A0A0A',
  card:        '#161616',
  cardBorder:  '#222222',
  gold:        '#D4AF37',
  goldDark:    '#A8861A',
  goldGlow:    '#D4AF3715',
  goldBorder:  '#D4AF3730',
  amber:       '#FF9800',
  amberBg:     '#1A1000',
  amberBdr:    '#FF980040',
  green:       '#4CAF50',
  greenBg:     '#0D200D',
  greenBdr:    '#4CAF5040',
  blue:        '#4FC3F7',
  blueBg:      '#071520',
  blueBdr:     '#4FC3F740',
  red:         '#FF4444',
  redBg:       '#2A0A0A',
  redBdr:      '#FF444440',
  grey:        '#888888',
  greyBg:      '#1A1A1A',
  greyBdr:     '#33333340',
  white:       '#FFFFFF',
  sub:         '#666666',
  muted:       '#333333',
  divider:     '#1E1E1E',
} as const;

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<BookingStatus, {
  label: string; color: string; bg: string; border: string;
  iconName: keyof typeof Ionicons.glyphMap;
}> = {
  pending:     { label: 'Pending Approval', color: C.amber, bg: C.amberBg, border: C.amberBdr, iconName: 'time-outline' },
  confirmed:   { label: 'Confirmed',        color: C.green, bg: C.greenBg, border: C.greenBdr, iconName: 'checkmark-circle-outline' },
  declined:    { label: 'Declined',         color: C.red,   bg: C.redBg,   border: C.redBdr,   iconName: 'close-circle-outline' },
  in_progress: { label: 'In Chair',         color: C.blue,  bg: C.blueBg,  border: C.blueBdr,  iconName: 'cut-outline' },
  completed:   { label: 'Completed',        color: C.grey,  bg: C.greyBg,  border: C.greyBdr,  iconName: 'checkmark-done-outline' },
  cancelled:   { label: 'Cancelled',        color: C.red,   bg: C.redBg,   border: C.redBdr,   iconName: 'close-circle-outline' },
  no_show:     { label: 'No Show',          color: C.red,   bg: C.redBg,   border: C.redBdr,   iconName: 'alert-circle-outline' },
};

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade', s2: 'Lineup', s3: 'Beard Trim', s4: 'Haircut', s5: 'Beard + Cut',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildWeek(): Date[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i); return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m === 0 ? '00' : m < 10 ? '0' + m : m} ${period}`;
}

// ─── Booking card subcomponent ────────────────────────────────────────────────

function BookingCard({
  booking,
  onMessage,
  onPatchStatus,
  onCompleteToast,
}: {
  booking: Booking;
  onMessage: () => void;
  onPatchStatus: (bookingId: string, status: BookingStatus) => void;
  onCompleteToast: () => void;
}): React.JSX.Element {
  const [styleModal, setStyleModal] = useState(false);
  const [guideModal, setGuideModal] = useState(false);
  const [guideSteps, setGuideSteps] = useState<BarberCutStep[] | null>(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);

  const [busy,    setBusy]    = useState(false);
  const cfg        = STATUS_CFG[booking.status] ?? STATUS_CFG.pending;
  const time       = formatTime(safeToDate(booking.scheduledAt));
  const svcName    = SERVICE_NAMES[booking.serviceId] ?? booking.serviceId;
  const clientName = booking.clientName ?? booking.clientId.substring(0, 8);

  // Advance flow for confirmed → in_progress → completed
  const advanceLabel = booking.status === 'confirmed'   ? 'Mark In Chair'
                     : booking.status === 'in_progress' ? 'Complete'
                     : null;
  const advanceNext: BookingStatus | null =
    booking.status === 'confirmed'   ? 'in_progress' :
    booking.status === 'in_progress' ? 'completed'   : null;

  async function handleConfirm(): Promise<void> {
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'confirmed');
    const res = await BookingService.updateStatus(booking.id, { status: 'confirmed' });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    }
    setBusy(false);
  }

  async function handleDecline(): Promise<void> {
    Alert.alert(
      'Decline Appointment?',
      `This will notify ${clientName} that their booking has been declined.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            const prev = booking.status;
            setBusy(true);
            onPatchStatus(booking.id, 'declined');
            const res = await BookingService.updateStatus(booking.id, {
              status: 'declined',
              declinedReason: 'Barber unavailable',
            });
            if (!res.success) {
              onPatchStatus(booking.id, prev);
              Alert.alert('Could not update', res.error ?? 'Try again.');
            }
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
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, advanceNext);
    const res = await BookingService.updateStatus(booking.id, { status: advanceNext });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    }
    setBusy(false);
  }

  async function completeVisit(rewardClaimed: boolean): Promise<void> {
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'completed');
    const res = await BookingService.updateStatus(booking.id, {
      status: 'completed',
      ...(rewardClaimed ? { rewardClaimed: true } : {}),
    });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    } else {
      onCompleteToast();
    }
    setBusy(false);
  }

  const isTerminal = booking.status === 'completed' ||
                     booking.status === 'declined'   ||
                     booking.status === 'cancelled'  ||
                     booking.status === 'no_show';

  async function openCutGuide(): Promise<void> {
    const rs = booking.requestedStyle;
    if (!rs) return;
    setGuideBusy(true);
    setGuideErr(null);
    try {
      let hairTexture = 'varied';
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, booking.clientId));
      const prof = snap.data()?.styleProfile as { profile?: Record<string, unknown> } | undefined;
      const p = prof?.profile;
      if (p) {
        const ht = p.hair_texture ?? p.hairTexture;
        if (typeof ht === 'string' && ht.trim()) {
          hairTexture = ht.trim();
        }
      }
      const guide = await AIBarberGuideService.getCutInstructions(rs.name, hairTexture);
      setGuideSteps(guide.steps);
      setStyleModal(false);
      setGuideModal(true);
    } catch (e) {
      setGuideErr(e instanceof Error ? e.message : 'Could not load instructions.');
    } finally {
      setGuideBusy(false);
    }
  }

  return (
    <View style={s.cardWrap}>
    <View style={[
      s.card,
      booking.status === 'declined' && s.cardDeclined,
      booking.status === 'completed' && s.cardCompleted,
    ]}>
      {/* Left accent bar */}
      <View style={[s.cardAccent, { backgroundColor: cfg.color }]} />

      <View style={s.cardBody}>
        {/* Top row: time + status badge */}
        <View style={s.cardTopRow}>
          <Text style={[s.cardTime, isTerminal && { color: C.sub }]}>{time}</Text>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
            <Ionicons name={cfg.iconName} size={12} color={cfg.color} style={{ marginRight: 4 }} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Client + service */}
        <Text style={[s.cardClient, isTerminal && { color: C.sub }]}>{clientName}</Text>

        {booking.requestedStyle && (
          <TouchableOpacity
            style={s.requestedRow}
            onPress={() => setStyleModal(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Client wants ${booking.requestedStyle.name}`}
          >
            <Image
              source={{ uri: booking.requestedStyle.photoURL }}
              style={s.requestedThumb}
            />
            <View style={s.requestedTextCol}>
              <Text style={s.requestedWantsLine} numberOfLines={2}>
                Client wants: {booking.requestedStyle.name}
              </Text>
              {booking.requestedStyle.barberNotes ? (
                <Text style={s.requestedBarberNotes} numberOfLines={4}>
                  {booking.requestedStyle.barberNotes}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.gold} />
          </TouchableOpacity>
        )}

        <View style={s.cardMeta}>
          <Ionicons name="cut-outline" size={12} color={C.sub} style={{ marginRight: 4 }} />
          <Text style={s.cardMetaText}>{svcName}</Text>
          <Text style={s.cardDot}>·</Text>
          <Ionicons name="timer-outline" size={12} color={C.sub} style={{ marginRight: 3 }} />
          <Text style={s.cardMetaText}>{booking.durationMinutes} min</Text>
          <Text style={s.cardDot}>·</Text>
          <Text style={[s.cardMetaText, { color: C.gold, fontWeight: '700' }]}>${booking.price}</Text>
        </View>

        <TouchableOpacity
          style={s.msgRow}
          onPress={onMessage}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Message ${clientName}`}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={15} color={C.gold} style={{ marginRight: 8 }} />
          <Text style={s.msgRowText}>Message {clientName}</Text>
          <Ionicons name="chevron-forward" size={16} color={C.sub} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ── Action buttons ── */}
        {busy ? (
          <View style={s.busyRow}>
            <ActivityIndicator size={18} color={C.gold} />
            <Text style={s.busyText}>Updating…</Text>
          </View>
        ) : booking.status === 'pending' ? (
          <View style={s.actionRow}>
            {/* Confirm */}
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm appointment"
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color={C.bg} style={{ marginRight: 6 }} />
              <Text style={s.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>

            {/* Decline */}
            <TouchableOpacity
              style={s.declineBtn}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel="Decline appointment"
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color={C.red} style={{ marginRight: 6 }} />
              <Text style={s.declineBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : advanceLabel && advanceNext ? (
          /* Advance flow: In Chair → Complete */
          <TouchableOpacity
            style={s.advanceBtn}
            onPress={handleAdvance}
            accessibilityRole="button"
            accessibilityLabel={advanceLabel}
            activeOpacity={0.8}
          >
            <Text style={s.advanceBtnText}>{advanceLabel}  →</Text>
          </TouchableOpacity>
        ) : null}

        {/* Declined reason note */}
        {booking.status === 'declined' && (
          <View style={s.declinedNote}>
            <Ionicons name="information-circle-outline" size={13} color={C.red} style={{ marginRight: 6 }} />
            <Text style={s.declinedNoteText}>
              Booking declined — client has been notified.
            </Text>
          </View>
        )}
      </View>
    </View>

    <Modal
      visible={styleModal}
      transparent
      animationType="fade"
      onRequestClose={() => { setStyleModal(false); setGuideErr(null); }}
    >
      <Pressable style={s.modalBackdrop} onPress={() => { setStyleModal(false); setGuideErr(null); }}>
        <Pressable style={s.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={s.modalTitle}>{booking.requestedStyle?.name}</Text>
          {booking.requestedStyle && (
            <Image source={{ uri: booking.requestedStyle.photoURL }} style={s.modalPhoto} resizeMode="cover" />
          )}
          <Text style={s.modalDesc}>{booking.requestedStyle?.description}</Text>
          {booking.requestedStyle?.barberNotes ? (
            <View style={s.modalNotesBlock}>
              <Text style={s.modalNotesLabel}>Barber notes</Text>
              <Text style={s.modalNotesBody}>{booking.requestedStyle.barberNotes}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={s.guideBtn}
            onPress={() => void openCutGuide()}
            disabled={guideBusy}
            accessibilityRole="button"
            accessibilityLabel="How do I do this cut"
          >
            {guideBusy ? (
              <ActivityIndicator color={C.bg} size="small" />
            ) : (
              <Text style={s.guideBtnText}>How do I do this cut?</Text>
            )}
          </TouchableOpacity>
          {guideErr ? <Text style={s.guideErr}>{guideErr}</Text> : null}
          <TouchableOpacity style={s.modalClose} onPress={() => { setStyleModal(false); setGuideErr(null); }}>
            <Text style={s.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={guideModal}
      transparent
      animationType="slide"
      onRequestClose={() => { setGuideModal(false); setGuideSteps(null); }}
    >
      <View style={s.guideModalRoot}>
        <View style={s.guideModalHeader}>
          <Text style={s.guideModalTitle}>Step-by-step</Text>
          <TouchableOpacity onPress={() => { setGuideModal(false); setGuideSteps(null); }}>
            <Ionicons name="close" size={26} color={C.white} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={s.guideScroll} showsVerticalScrollIndicator={false}>
          {guideSteps && guideSteps.length === 0 && (
            <Text style={s.guideEmpty}>No steps came back. Try again in a moment.</Text>
          )}
          {(guideSteps ?? []).map((step) => (
            <View key={step.number} style={s.stepCard}>
              <View style={s.stepNum}>
                <Text style={s.stepNumText}>{step.number}</Text>
              </View>
              <View style={s.stepBody}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDesc}>{step.description}</Text>
                {step.tools ? (
                  <Text style={s.stepTools}>Tools: {step.tools}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ScheduleScreen({ navigation }: Props): React.JSX.Element {
  const insets    = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const firstName = (appUser?.displayName ?? 'Barber').split(' ')[0];

  const week = buildWeek();
  const [selIdx,      setSelIdx]      = useState(0);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [completeSnack, setCompleteSnack] = useState(false);

  function patchBookingStatus(bookingId: string, status: BookingStatus): void {
    setAllBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status } : b)),
    );
  }

  // ── Real-time listener ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const unsubscribe = BookingService.onSnapshotByBarber(
      firebaseUser.uid,
      (bookings) => { setAllBookings(bookings); setLoading(false); },
      ()         => setLoading(false),
    );
    return unsubscribe;
  }, [firebaseUser]);

  const selDay = week[selIdx];
  const dayBookings = allBookings
    .filter(b => isSameDay(safeToDate(b.scheduledAt), selDay))
    .sort((a, b) => safeToDate(a.scheduledAt).getTime() - safeToDate(b.scheduledAt).getTime());

  const confirmed = dayBookings.filter(b => ['confirmed','in_progress','completed'].includes(b.status)).length;
  const pending   = dayBookings.filter(b => b.status === 'pending').length;
  const earnings  = dayBookings
    .filter(b => ['confirmed','in_progress','completed'].includes(b.status))
    .reduce((sum, b) => sum + b.price, 0);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>MY SCHEDULE</Text>
          <Text style={s.headerTitle}>{firstName}'s Day</Text>
        </View>
        <View style={s.statPills}>
          {confirmed > 0 && (
            <View style={[s.pill, { backgroundColor: C.greenBg, borderColor: C.greenBdr }]}>
              <Text style={[s.pillText, { color: C.green }]}>{confirmed} booked</Text>
            </View>
          )}
          {pending > 0 && (
            <View style={[s.pill, { backgroundColor: C.amberBg, borderColor: C.amberBdr }]}>
              <Text style={[s.pillText, { color: C.amber }]}>{pending} pending</Text>
            </View>
          )}
        </View>
      </View>
      <View style={s.headerLine} />

      {/* ── Week strip ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.weekStrip}
      >
        {week.map((d, i) => {
          const sel     = i === selIdx;
          const isToday = i === 0;
          const cnt     = allBookings.filter(b => isSameDay(safeToDate(b.scheduledAt), d)).length;
          return (
            <TouchableOpacity
              key={i}
              style={[s.dayBtn, sel && s.dayBtnSel]}
              onPress={() => setSelIdx(i)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${isToday ? 'Today' : DAYS_SHORT[d.getDay()]} ${d.getDate()}${cnt > 0 ? `, ${cnt} bookings` : ''}`}
              accessibilityState={{ selected: sel }}
            >
              <Text style={[s.dayName, sel && s.dayNameSel]}>
                {isToday ? 'Today' : DAYS_SHORT[d.getDay()]}
              </Text>
              <Text style={[s.dayNum, sel && s.dayNumSel]}>{d.getDate()}</Text>
              <View style={s.dayPipWrap}>
                {cnt > 0
                  ? <View style={[s.dayPip, sel ? s.dayPipSel : s.dayPipDefault]} />
                  : <View style={s.dayPipEmpty} />
                }
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Date label ── */}
      <Text style={s.dateLabel}>
        {DAYS_SHORT[selDay.getDay()]}, {MONTHS[selDay.getMonth()]} {selDay.getDate()}
        {selIdx === 0 ? ' — Today' : ''}
      </Text>

      {/* ── Earnings bar ── */}
      {dayBookings.length > 0 && (
        <View style={s.earningsBar}>
          <Ionicons name="cash-outline" size={15} color={C.gold} />
          <Text style={s.earningsText}>
            Est. earnings: <Text style={s.earningsValue}>${earnings}</Text>
          </Text>
        </View>
      )}

      {/* ── Content ── */}
      {loading ? (
        <View style={s.centerWrap}>
          <ActivityIndicator size={28} color={C.gold} />
          <Text style={s.centerText}>Loading schedule…</Text>
        </View>
      ) : dayBookings.length === 0 ? (
        <View style={s.centerWrap}>
          <Ionicons name="calendar-outline" size={52} color={C.muted} />
          <Text style={s.emptyTitle}>No appointments</Text>
          <Text style={s.emptySub}>
            {selIdx === 0
              ? 'You have no bookings today. Clients can book you from the app.'
              : 'No bookings on this day yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {dayBookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onPatchStatus={patchBookingStatus}
              onCompleteToast={() => setCompleteSnack(true)}
              onMessage={() =>
                navigation.navigate('Chat', {
                  clientId: b.clientId,
                  clientName: b.clientName ?? 'Client',
                  barberId: b.barberId,
                  barberName: appUser?.displayName ?? 'Barber',
                  bookingId: b.id,
                })
              }
            />
          ))}
        </ScrollView>
      )}

      <Snackbar
        visible={completeSnack}
        onDismiss={() => setCompleteSnack(false)}
        duration={2200}
        style={{ backgroundColor: C.gold }}
        wrapperStyle={{ paddingHorizontal: 16 }}
      >
        <PaperText style={{ color: C.bg, fontWeight: '800' }}>Booking completed</PaperText>
      </Snackbar>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10,
  },
  headerEyebrow: { fontSize: 10, color: C.sub, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: -0.3 },
  headerLine:    { height: 1, marginHorizontal: 18, backgroundColor: C.gold, opacity: 0.15, marginBottom: 4 },

  statPills: { gap: 6 },
  pill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillText:  { fontSize: 11, fontWeight: '700' },

  // Week strip
  weekStrip: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, alignItems: 'center' },
  dayBtn: {
    width: 56, height: 76, borderRadius: 14,
    alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.divider,
  },
  dayBtnSel: {
    backgroundColor: C.gold, borderColor: C.gold,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  dayName:    { fontSize: 10, fontWeight: '700', color: C.sub, letterSpacing: 0.5, textTransform: 'uppercase' },
  dayNameSel: { color: '#0A0A0ACC' },
  dayNum:     { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: -0.5 },
  dayNumSel:  { color: C.bg },
  dayPipWrap:    { height: 6, justifyContent: 'center', alignItems: 'center' },
  dayPip:        { width: 5, height: 5, borderRadius: 3 },
  dayPipDefault: { backgroundColor: C.gold },
  dayPipSel:     { backgroundColor: '#0A0A0A88' },
  dayPipEmpty:   { width: 5, height: 5 },

  dateLabel: { fontSize: 12, color: C.sub, paddingHorizontal: 18, marginBottom: 8, fontWeight: '600' },

  earningsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14,
  },
  earningsText:  { fontSize: 13, color: C.sub },
  earningsValue: { color: C.gold, fontWeight: '800' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  centerText: { fontSize: 13, color: C.sub },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  emptySub:   { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18 },

  cardWrap: { marginBottom: 12 },

  // ── Booking card ────────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  cardDeclined: { opacity: 0.6 },
  cardCompleted: { opacity: 0.75 },
  cardAccent:   { width: 4 },
  cardBody:     { flex: 1, padding: 14 },

  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTime:   { fontSize: 14, fontWeight: '800', color: C.white },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  cardClient:   { fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 5 },
  cardMeta:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, marginBottom: 10 },
  cardMetaText: { fontSize: 12, color: C.sub },
  cardDot:      { fontSize: 12, color: C.muted, marginHorizontal: 2 },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#141414',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  msgRowText: { fontSize: 13, fontWeight: '700', color: C.white, flex: 1 },

  requestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.gold,
    backgroundColor: '#1A1708',
    gap: 10,
  },
  requestedThumb: { width: 50, height: 50, borderRadius: 8, backgroundColor: C.greyBg },
  requestedTextCol: { flex: 1, minWidth: 0 },
  requestedWantsLine: { fontSize: 14, fontWeight: '800', color: C.white },
  requestedBarberNotes: {
    marginTop: 6,
    fontSize: 12,
    color: C.sub,
    lineHeight: 17,
    fontWeight: '500',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.goldBorder,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: C.white, marginBottom: 12 },
  modalPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: C.greyBg,
    marginBottom: 12,
  },
  modalDesc: { fontSize: 14, color: C.sub, lineHeight: 21, marginBottom: 16 },
  modalNotesBlock: { marginBottom: 16, width: '100%' },
  modalNotesLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  modalNotesBody: { fontSize: 13, color: C.white, lineHeight: 20 },
  guideBtn: {
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  guideBtnText: { fontSize: 15, fontWeight: '800', color: C.bg },
  guideErr: { fontSize: 13, color: C.red, marginBottom: 8 },
  modalClose: { alignItems: 'center', paddingVertical: 8 },
  modalCloseText: { fontSize: 14, fontWeight: '700', color: C.gold },

  guideModalRoot: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 52,
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  guideModalTitle: { fontSize: 18, fontWeight: '800', color: C.gold },
  guideScroll: { padding: 16, paddingBottom: 40 },
  guideEmpty: { fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 24 },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1A1708',
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 16, fontWeight: '900', color: C.gold },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 15, fontWeight: '800', color: C.white, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 6 },
  stepTools: { fontSize: 12, color: C.gold, fontWeight: '600' },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10 },

  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.gold, borderRadius: 10, height: 42,
    ...Platform.select({
      ios: { shadowColor: C.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  confirmBtnText: { fontSize: 13, fontWeight: '800', color: C.bg },

  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.redBg, borderRadius: 10, height: 42,
    borderWidth: 1, borderColor: C.redBdr,
  },
  declineBtnText: { fontSize: 13, fontWeight: '800', color: C.red },

  advanceBtn: {
    backgroundColor: C.card, borderRadius: 10, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.goldBorder,
  },
  advanceBtnText: { fontSize: 13, fontWeight: '700', color: C.gold },

  busyRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  busyText: { fontSize: 13, color: C.sub },

  declinedNote: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.redBg, borderRadius: 8,
    borderWidth: 1, borderColor: C.redBdr,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 2,
  },
  declinedNoteText: { flex: 1, fontSize: 11, color: C.red, lineHeight: 15 },
});
