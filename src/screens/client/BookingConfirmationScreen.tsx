import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Linking,
  Platform,
  Image,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp, doc, getDoc } from 'firebase/firestore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookStackParamList } from '@/navigation/types';
import { BookingService } from '@/services/booking.service';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import type { Booking, RequestedStyle } from '@/types/booking.types';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0A0A0A',
  surface:     '#141414',
  card:        '#161616',
  elevated:    '#1C1C1C',
  gold:        '#D4AF37',
  goldDark:    '#A8861A',
  goldLight:   '#EDD060',
  goldGlow:    '#D4AF3718',
  goldBorder:  '#D4AF3760',
  success:     '#4CAF50',
  successBg:   '#0A1A0A',
  successBdr:  '#4CAF5044',
  danger:      '#CF6679',
  dangerBg:    '#1A0A0A',
  dangerBdr:   '#CF667944',
  white:       '#FFFFFF',
  sub:         '#888888',
  muted:       '#444444',
  divider:     '#1E1E1E',
} as const;

const { width: SW } = Dimensions.get('window');


// ─── Static service lookup ────────────────────────────────────────────────────

const SERVICE_MAP: Record<string, {
  name: string; price: number; durationMinutes: number;
  iconName: keyof typeof Ionicons.glyphMap; category: string;
}> = {
  s1: { name: 'Fade',            price: 40, durationMinutes: 30, iconName: 'cut-outline',        category: 'Haircut' },
  s2: { name: 'Lineup',          price: 15, durationMinutes: 15, iconName: 'cut-outline',        category: 'Haircut' },
  s3: { name: 'Beard Trim',      price: 25, durationMinutes: 20, iconName: 'brush-outline',      category: 'Beard'   },
  s4: { name: 'Haircut',         price: 35, durationMinutes: 45, iconName: 'cut-outline',        category: 'Haircut' },
  s5: { name: 'Beard + Haircut', price: 50, durationMinutes: 60, iconName: 'star-outline',       category: 'Combo'   },
};

const DEFAULT_SERVICE = {
  name: 'Service', price: 0, durationMinutes: 30,
  iconName: 'cut-outline' as keyof typeof Ionicons.glyphMap, category: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m === 0 ? '00' : '30'} ${period}`;
}

function buildGoogleCalendarUrl(title: string, startMs: number, durationMins: number): string {
  const start = new Date(startMs);
  const end   = new Date(startMs + durationMins * 60 * 1000);
  const fmt   = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent('Booked via 613 Barbershop app')}`
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props  = NativeStackScreenProps<BookStackParamList, 'BookingConfirm'>;
type Phase  = 'preview' | 'saving' | 'success' | 'error';

// ─── Row component ────────────────────────────────────────────────────────────

function SummaryRow({ iconName, label, value, valueStyle }: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string; value: string; valueStyle?: object;
}): React.JSX.Element {
  return (
    <View style={styles.summaryRow} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.summaryIconWrap}>
        <Ionicons name={iconName} size={16} color="#555555" />
      </View>
      <View style={styles.summaryRowText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BookingConfirmationScreen({ route, navigation }: Props): React.JSX.Element {
  const { barberId, barberName, serviceId, scheduledAt } = route.params;
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const service   = SERVICE_MAP[serviceId] ?? DEFAULT_SERVICE;
  const dateLabel = formatDate(scheduledAt);
  const timeLabel = formatTime(scheduledAt);

  const [phase,     setPhase]     = useState<Phase>('preview');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [savedStylePreview, setSavedStylePreview] = useState<RequestedStyle | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Derived from the real Firestore doc ID — not fake Math.random()
  const confCode = bookingId ? bookingId.substring(0, 6).toUpperCase() : '';

  // ── Animations ─────────────────────────────────────────────────────────────
  const checkScale   = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity  = useRef(new Animated.Value(0)).current;
  const btnScale     = useRef(new Animated.Value(1)).current;

  const playSuccess = useCallback(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1.15, useNativeDriver: true, speed: 20, bounciness: 8 }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 4 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [checkScale, checkOpacity, cardOpacity]);

  useEffect(() => {
    if (phase === 'success') playSuccess();
  }, [phase, playSuccess]);

  useEffect(() => {
    if (!firebaseUser || phase !== 'preview') return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
        if (cancelled) return;
        const s = snap.data()?.savedStyle as RequestedStyle & { savedAt?: unknown } | undefined;
        if (s?.name && s?.photoURL && s?.description) {
          setSavedStylePreview({
            name: s.name,
            photoURL: s.photoURL,
            description: s.description,
          });
        } else {
          setSavedStylePreview(null);
        }
      } catch {
        setSavedStylePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, phase]);

  // ── Confirm: write booking to Firestore ────────────────────────────────────

  async function handleConfirm(): Promise<void> {
    if (!firebaseUser) {
      setErrorMsg('You must be signed in to book.');
      setPhase('error');
      return;
    }

    setPhase('saving');
    setErrorMsg(null);

    const result = await BookingService.create({
      clientId:        firebaseUser.uid,
      clientName:      firebaseUser.displayName ?? firebaseUser.email ?? 'Client',
      barberId,
      barberName,
      serviceId,
      scheduledAt:     Timestamp.fromMillis(scheduledAt),
      durationMinutes: service.durationMinutes,
      price:           service.price,
      notes:           null,
    });

    if (!result.success) {
      const msg = result.error.toLowerCase();
      setErrorMsg(
        msg.includes('already') || msg.includes('taken') || msg.includes('conflict')
          ? 'That time slot is already taken. Please choose a different time.'
          : 'Could not complete booking. Please try a different time.',
      );
      setPhase('error');
      return;
    }

    setBookingId(result.data.id);
    setConfirmedBooking(result.data);
    setPhase('success');
  }

  // ── Calendar ───────────────────────────────────────────────────────────────

  function handleAddToCalendar(): void {
    const url = buildGoogleCalendarUrl(
      `613 Barbershop — ${service.name}`,
      scheduledAt,
      service.durationMinutes,
    );
    Linking.openURL(url).catch(() => {});
  }

  // ── Navigation actions ─────────────────────────────────────────────────────

  function goToHistory(): void {
    // Pop out of BookNavigator to the tab level, then switch tab
    navigation.getParent()?.navigate('History' as never);
  }

  function goBookAnother(): void {
    navigation.popToTop();
  }

  // ── Button spring ──────────────────────────────────────────────────────────

  function btnIn():  void { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }
  function btnOut(): void { Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }

  // ── Shared summary card ────────────────────────────────────────────────────

  const attachedStyle: RequestedStyle | null | undefined =
    phase === 'success' ? confirmedBooking?.requestedStyle : savedStylePreview;

  const summaryCard = (
    <View style={styles.summaryCard}>
      <View style={styles.summaryCardAccent} />
      <View style={styles.summaryCardHeader}>
        <View style={styles.serviceIconWrap}>
          <Ionicons name={service.iconName} size={22} color={C.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.serviceCategory}>{service.category}</Text>
        </View>
        <Text style={styles.servicePrice}>${service.price}</Text>
      </View>

      <View style={styles.divider} />

      <SummaryRow iconName="person-outline"   label="Barber"   value={barberName} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName="calendar-outline" label="Date"     value={dateLabel} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName="time-outline"     label="Time"     value={timeLabel} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName="timer-outline"    label="Duration" value={`${service.durationMinutes} min`} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName="cash-outline"     label="Price"    value={`$${service.price}`} valueStyle={styles.priceValue} />

      {phase === 'success' && confCode ? (
        <>
          <View style={styles.rowDivider} />
          <SummaryRow iconName="barcode-outline" label="Booking ID" value={confCode} valueStyle={styles.codeValue} />
        </>
      ) : null}

      {attachedStyle ? (
        <>
          <View style={styles.rowDivider} />
          <View style={styles.styleAttachBlock}>
            <Text style={styles.styleAttachLabel}>
              {phase === 'success' ? 'Style for this visit' : 'Style we will attach'}
            </Text>
            <View style={styles.styleAttachRow}>
              <Image source={{ uri: attachedStyle.photoURL }} style={styles.styleAttachThumb} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.styleAttachName} numberOfLines={2}>
                  {attachedStyle.name}
                </Text>
                <Text style={styles.styleAttachDesc} numberOfLines={3}>
                  {attachedStyle.description}
                </Text>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // ── RENDER ───────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header} accessibilityRole="header">
        {phase !== 'success' ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ) : <View style={styles.backBtn} />}

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {phase === 'success' ? 'Booking Confirmed!' : 'Confirm Booking'}
          </Text>
          <Text style={styles.headerSub}>613 BARBERSHOP</Text>
        </View>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.headerLine} />

      {/* ── SAVING overlay ── */}
      {phase === 'saving' && (
        <View style={styles.savingOverlay} accessibilityLiveRegion="polite">
          <View style={styles.savingCard}>
            <ActivityIndicator size={40} color={C.gold} />
            <Text style={styles.savingTitle}>Securing your slot…</Text>
            <Text style={styles.savingSub}>Please wait a moment</Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ══════════ SUCCESS STATE ══════════ */}
        {phase === 'success' && (
          <>
            {/* Animated checkmark */}
            <View style={styles.checkWrap} accessibilityLabel="Booking confirmed" accessibilityRole="image">
              <Animated.View style={[
                styles.checkRing,
                { transform: [{ scale: checkScale }], opacity: checkOpacity },
              ]}>
                <View style={styles.checkInner}>
                  <Ionicons name="checkmark" size={40} color={C.gold} />
                </View>
              </Animated.View>
            </View>

            <Text style={styles.successTitle}>Booking Request Sent!</Text>
            <Text style={styles.successSub}>
              {dateLabel} at {timeLabel}{'\n'}Your barber will confirm shortly.
            </Text>

            {/* Summary card fades in */}
            <Animated.View style={{ opacity: cardOpacity }}>
              {summaryCard}
            </Animated.View>

            {/* Status + confirmation badge */}
            <Animated.View style={[styles.codeBadge, { opacity: cardOpacity }]}>
              <View style={styles.pendingRow}>
                <Ionicons name="time-outline" size={16} color={C.gold} style={{ marginRight: 6 }} />
                <Text style={styles.pendingLabel}>PENDING BARBER CONFIRMATION</Text>
              </View>
              <Text style={styles.codeBadgeValue} accessibilityLabel={`Booking ID: ${confCode}`}>
                {confCode}
              </Text>
              <Text style={styles.codeBadgeHint}>
                You'll be notified once confirmed · Keep this ID
              </Text>
            </Animated.View>

            {/* Action buttons */}
            <Animated.View style={[styles.actionGroup, { opacity: cardOpacity }]}>
              {/* Add to Calendar */}
              <TouchableOpacity
                onPress={handleAddToCalendar}
                style={styles.calBtn}
                accessibilityRole="button"
                accessibilityLabel="Add to Calendar"
              >
                <Ionicons name="calendar-outline" size={18} color={C.bg} style={{ marginRight: 8 }} />
                <Text style={styles.calBtnText}>Add to Calendar</Text>
              </TouchableOpacity>

              {/* View My Bookings */}
              <TouchableOpacity
                onPress={goToHistory}
                style={styles.historyBtn}
                accessibilityRole="button"
                accessibilityLabel="View My Bookings"
              >
                <Text style={styles.historyBtnText}>View My Bookings</Text>
              </TouchableOpacity>

              {/* Book Another */}
              <TouchableOpacity
                onPress={goBookAnother}
                style={styles.anotherBtn}
                accessibilityRole="button"
                accessibilityLabel="Book Another Appointment"
              >
                <Text style={styles.anotherBtnText}>Book Another</Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* ══════════ ERROR STATE ══════════ */}
        {phase === 'error' && (
          <>
            <View style={styles.errorWrap} accessibilityRole="alert">
              <View style={styles.errorIcon}>
                <Ionicons name="close" size={36} color={C.danger} />
              </View>
              <Text style={styles.errorTitle}>Booking Failed</Text>
              <Text style={styles.errorMsg}>{errorMsg}</Text>
            </View>

            {summaryCard}

            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Choose a different time"
            >
              <Ionicons name="arrow-back" size={14} color={C.gold} style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Choose a Different Time</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ══════════ PREVIEW STATE ══════════ */}
        {(phase === 'preview' || phase === 'saving') && (
          <>
            <Text style={styles.previewIntro}>
              Please review your booking details before confirming.
            </Text>

            {summaryCard}

            {/* Info strip */}
            <View style={styles.infoStrip}>
              <Ionicons name="information-circle-outline" size={15} color="#555555" style={{ marginRight: 6 }} />
              <Text style={styles.infoStripText}>
                Free cancellation up to 2 hours before your appointment.
              </Text>
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Bottom bar (preview only) ── */}
      {(phase === 'preview' || phase === 'saving') && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
            <View style={styles.btnGlow} />
            <TouchableOpacity
              onPress={handleConfirm}
              onPressIn={btnIn}
              onPressOut={btnOut}
              disabled={phase === 'saving'}
              activeOpacity={1}
              style={[styles.btn, phase === 'saving' && styles.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Book Now"
              accessibilityState={{ busy: phase === 'saving' }}
            >
              {phase === 'saving' ? (
                <View style={styles.btnLoadRow}>
                  <ActivityIndicator size={18} color={C.bg} />
                  <Text style={styles.btnText}>Securing Slot…</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>Book Now  →</Text>
              )}
              {phase !== 'saving' && <View style={styles.btnDepth} />}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.btnHint}>
            ${service.price} will be payable at the shop
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn:     { width: 36, alignItems: 'center' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white, letterSpacing: 0.4 },
  headerSub:   { fontSize: 10, color: C.gold, letterSpacing: 3, fontWeight: '700', marginTop: 2 },
  headerLine:  {
    height: 1, marginHorizontal: 20, backgroundColor: C.gold,
    opacity: 0.3, marginBottom: 2,
  },

  // Saving overlay
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: '#0A0A0ACC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 20,
    minWidth: 220,
  },
  savingTitle: { fontSize: 17, fontWeight: '800', color: C.white },
  savingSub:   { fontSize: 13, color: C.sub },

  // Preview
  previewIntro: {
    fontSize: 13, color: C.sub, textAlign: 'center',
    marginTop: 14, marginBottom: 20, lineHeight: 18,
  },

  // Summary card
  summaryCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: 16,
  },
  summaryCardAccent: { height: 3, backgroundColor: C.gold },
  summaryCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
  },
  serviceIconWrap: {
    width: 48, height: 48, borderRadius: 13,
    backgroundColor: C.goldGlow,
    borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  serviceName:     { fontSize: 17, fontWeight: '800', color: C.white, letterSpacing: 0.3 },
  serviceCategory: { fontSize: 11, color: C.sub, marginTop: 2, fontWeight: '600' },
  servicePrice:    { fontSize: 28, fontWeight: '900', color: C.gold, letterSpacing: -0.5, flexShrink: 0 },
  divider:         { height: 1, backgroundColor: C.divider, marginHorizontal: 16 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13, gap: 14,
  },
  summaryIconWrap: { width: 26, alignItems: 'center' },
  summaryRowText:  { flex: 1 },
  summaryLabel:    { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
  summaryValue:    { fontSize: 15, fontWeight: '700', color: C.white },
  priceValue:      { color: C.gold, fontSize: 18 },
  codeValue:       { color: C.gold, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 3, fontSize: 18 },
  rowDivider:      { height: 1, backgroundColor: C.divider, marginHorizontal: 16 },

  styleAttachBlock: { paddingHorizontal: 16, paddingBottom: 16 },
  styleAttachLabel: {
    fontSize: 10,
    color: C.gold,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  styleAttachRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  styleAttachThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.goldBorder },
  styleAttachName: { fontSize: 15, fontWeight: '800', color: C.white, marginBottom: 4 },
  styleAttachDesc: { fontSize: 12, color: C.sub, lineHeight: 17 },

  // Info strip
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.goldGlow,
    borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 16,
  },
  infoStripText: { flex: 1, fontSize: 12, color: C.gold, lineHeight: 17 },

  // Success
  checkWrap: { alignItems: 'center', marginTop: 24, marginBottom: 20 },
  checkRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.successBg,
    borderWidth: 3, borderColor: C.success,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 14,
  },
  checkInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.success + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  successTitle: { fontSize: 20, fontWeight: '800', color: C.white, textAlign: 'center', marginBottom: 6 },
  successSub:   { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18, marginBottom: 24 },

  // Confirmation code badge
  codeBadge: {
    backgroundColor: C.elevated,
    borderWidth: 1.5, borderColor: C.goldBorder,
    borderRadius: 14,
    paddingVertical: 18, paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  pendingRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  pendingLabel: { fontSize: 10, color: C.gold, fontWeight: '700', letterSpacing: 1.5 },
  codeBadgeLabel: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  codeBadgeValue: {
    fontSize: 34,
    fontWeight: '900',
    color: C.gold,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  codeBadgeHint:  { fontSize: 11, color: C.sub },

  // Action buttons (success)
  actionGroup: { gap: 12, marginBottom: 24 },
  calBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1.5, borderColor: C.goldBorder,
    borderRadius: 14, height: 52,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  calBtnText: { fontSize: 15, fontWeight: '700', color: C.gold },
  historyBtn: {
    backgroundColor: C.gold,
    borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: C.goldDark, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 10,
  },
  historyBtnText: { fontSize: 15, fontWeight: '800', color: C.bg, letterSpacing: 0.5 },
  anotherBtn: {
    backgroundColor: C.elevated,
    borderRadius: 14, height: 48,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.divider,
  },
  anotherBtnText: { fontSize: 14, fontWeight: '700', color: C.sub },

  // Error
  errorWrap: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  errorIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.dangerBg,
    borderWidth: 2, borderColor: C.danger,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
  },
  errorTitle:    { fontSize: 20, fontWeight: '800', color: C.white, marginBottom: 10 },
  errorMsg:      { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  retryBtn: {
    flexDirection: 'row',
    marginTop: 8, marginBottom: 24,
    backgroundColor: C.elevated,
    borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.divider,
  },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: C.gold },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface,
    paddingTop: 14, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: C.divider,
    gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6, shadowRadius: 16, elevation: 20,
  },
  btnHint: { fontSize: 11, color: C.muted, textAlign: 'center' },
  btnWrap: { position: 'relative' },
  btnGlow: {
    position: 'absolute', top: 4, left: 10, right: 10, bottom: -4,
    backgroundColor: C.gold, borderRadius: 14, opacity: 0.2,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12,
  },
  btn: {
    height: 54, borderRadius: 14, backgroundColor: C.gold,
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: C.goldLight + '70',
    shadowColor: C.goldDark, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.8, shadowRadius: 10, elevation: 10,
    overflow: 'hidden',
  },
  btnDisabled: { backgroundColor: C.elevated, borderTopColor: 'transparent' },
  btnText:     { fontSize: 16, fontWeight: '800', color: C.bg, letterSpacing: 1 },
  btnLoadRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnDepth: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
    backgroundColor: C.goldDark, opacity: 0.5,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
});
