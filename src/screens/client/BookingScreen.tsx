import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  FlatList,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookStackParamList } from '@/navigation/types';
import { BarberService } from '@/services/barber.service';
import { BookingService } from '@/services/booking.service';
import { Barber } from '@/types/barber.types';
import { Booking } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';
import { buildHalfHourSlots, buildWorkingDates, dayKeyFromDate } from '@/utils/workingHours.utils';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A0A0A',
  surface:      '#141414',
  card:         '#161616',
  elevated:     '#1C1C1C',
  gold:         '#D4AF37',
  goldDark:     '#A8861A',
  goldLight:    '#EDD060',
  goldGlow:     '#D4AF3718',
  goldBorder:   '#D4AF3770',
  booked:       '#1A1A1A',
  bookedText:   '#3A3A3A',
  bookedBorder: '#252525',
  white:        '#FFFFFF',
  sub:          '#888888',
  muted:        '#444444',
  divider:      '#1E1E1E',
  danger:       '#CF6679',
} as const;

const { width: SW } = Dimensions.get('window');

// ─── Static service lookup (mirrors ServicesScreen catalogue) ─────────────────

const SERVICE_MAP: Record<string, {
  name: string; price: number; durationMinutes: number;
  iconName: keyof typeof Ionicons.glyphMap;
}> = {
  s1: { name: 'Fade',           price: 40, durationMinutes: 30, iconName: 'cut-outline'   },
  s2: { name: 'Lineup',         price: 15, durationMinutes: 15, iconName: 'cut-outline'   },
  s3: { name: 'Beard Trim',     price: 25, durationMinutes: 20, iconName: 'brush-outline' },
  s4: { name: 'Haircut',        price: 35, durationMinutes: 45, iconName: 'cut-outline'   },
  s5: { name: 'Beard + Haircut',price: 50, durationMinutes: 60, iconName: 'star-outline'  },
};

const DEFAULT_SERVICE = {
  name: 'Service', price: 0, durationMinutes: 30,
  iconName: 'cut-outline' as keyof typeof Ionicons.glyphMap,
};

// ─── Time slots come from the barber's working hours (30-minute steps) ─────────

interface TimeSlot {
  key: string;
  label: string;
  hour: number;
  minute: number;
}

// ─── Calendar day helpers ─────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<BookStackParamList, 'SelectDateTime'>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingScreen({ route, navigation }: Props): React.JSX.Element {
  const { barberId, serviceId, barberName } = route.params;
  const insets = useSafeAreaInsets();
  const service = SERVICE_MAP[serviceId] ?? DEFAULT_SERVICE;

  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [selectedDay, setSelectedDay]     = useState<Date>(todayStart);
  const [selectedSlot, setSelectedSlot]   = useState<TimeSlot | null>(null);
  const [bookedKeys, setBookedKeys]       = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots]   = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [barberDoc, setBarberDoc]         = useState<Barber | null>(null);
  const [barberLoading, setBarberLoading] = useState(true);
  const [barberLoadError, setBarberLoadError] = useState<string | null>(null);

  const btnScale = useRef(new Animated.Value(1)).current;

  const availableDays = useMemo(
    () => buildWorkingDates(barberDoc?.workingHours, 21),
    [barberDoc],
  );

  const daySlots: TimeSlot[] = useMemo(() => {
    if (!barberDoc) return [];
    const key = dayKeyFromDate(selectedDay);
    const sch = barberDoc.workingHours[key];
    if (!sch?.isWorking) return [];
    return buildHalfHourSlots(sch.startTime, sch.endTime);
  }, [barberDoc, selectedDay]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBarberLoading(true);
      setBarberLoadError(null);
      const res = await BarberService.getById(barberId);
      if (cancelled) return;
      if (res.success && res.data) {
        setBarberDoc(res.data);
      } else {
        setBarberDoc(null);
        setBarberLoadError(res.success ? 'Barber not found.' : res.error);
      }
      setBarberLoading(false);
    })();
    return () => { cancelled = true; };
  }, [barberId]);

  useEffect(() => {
    if (availableDays.length === 0) return;
    const ok = availableDays.some((d) => isSameDay(d, selectedDay));
    if (!ok) setSelectedDay(availableDays[0]);
  }, [availableDays, selectedDay]);

  // ── Fetch booked slots whenever selected day changes ───────────────────────

  const fetchBookings = useCallback(async (day: Date): Promise<void> => {
    setLoadingSlots(true);
    setLoadError(null);
    setSelectedSlot(null);

    const result = await BookingService.getByBarberAndDate(barberId, day);

    if (result.success) {
      // Build a set of "HH:MM" keys that are taken
      const taken = new Set<string>();
      result.data.forEach((b: Booking) => {
        if (b.scheduledAt == null) return;
        const d = safeToDate(b.scheduledAt);
        const h = String(d.getHours()).padStart(2, '0');
        const m = d.getMinutes() === 0 ? '00' : '30';
        taken.add(`${h}:${m}`);
      });
      setBookedKeys(taken);
    } else {
      // Firestore error — treat all slots as available, show notice
      setBookedKeys(new Set());
      setLoadError('Could not check live availability. All slots shown as open.');
    }

    setLoadingSlots(false);
  }, [barberId]);

  useEffect(() => {
    fetchBookings(selectedDay);
  }, [selectedDay, fetchBookings]);

  // ── Slot state helpers ─────────────────────────────────────────────────────

  function isBooked(slot: TimeSlot): boolean {
    return bookedKeys.has(slot.key);
  }

  function isPast(slot: TimeSlot): boolean {
    const now = new Date();
    if (!isToday(selectedDay)) return false;
    const slotTime = new Date(selectedDay);
    slotTime.setHours(slot.hour, slot.minute, 0, 0);
    return slotTime <= now;
  }

  function isDisabled(slot: TimeSlot): boolean {
    return isBooked(slot) || isPast(slot);
  }

  // ── Confirm booking ────────────────────────────────────────────────────────

  function handleConfirm(): void {
    if (!selectedSlot) return;
    const dt = new Date(selectedDay);
    dt.setHours(selectedSlot.hour, selectedSlot.minute, 0, 0);
    navigation.navigate('BookingConfirm', {
      barberId,
      barberName,
      serviceId,
      scheduledAt: dt.getTime(),
    });
  }

  // ── Button animation ───────────────────────────────────────────────────────

  function btnIn():  void { Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }
  function btnOut(): void { Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 60, bounciness: 3 }).start(); }

  const canConfirm = !!selectedSlot && daySlots.length > 0;

  // ── Format selected summary ────────────────────────────────────────────────

  const selectedSummary = selectedSlot
    ? `${DAY_LABELS[selectedDay.getDay()]}, ${MONTH_LABELS[selectedDay.getMonth()]} ${selectedDay.getDate()} · ${selectedSlot.label}`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (barberLoading) {
    return (
      <View style={[styles.root, styles.centerMsg, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadBarberText}>Loading schedule…</Text>
      </View>
    );
  }

  if (barberLoadError || !barberDoc) {
    return (
      <View style={[styles.root, styles.centerMsg, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Ionicons name="alert-circle-outline" size={44} color={C.danger} />
        <Text style={styles.errTitle}>{barberLoadError ?? 'Could not load barber.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.retryBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Date & Time</Text>
          <Text style={styles.headerShop}>613 BARBERSHOP</Text>
          <Text style={styles.headerSub}>with {barberName}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Gold separator */}
      <View style={styles.headerLine} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Service summary card ── */}
        <View style={styles.serviceCard} accessibilityLabel={`${service.name}, $${service.price}`}>
          <View style={styles.serviceCardAccent} />
          <View style={styles.serviceCardInner}>
            <View style={styles.serviceIconWrap}>
              <Ionicons name={service.iconName} size={22} color="#D4AF37" />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="timer-outline" size={12} color="#666666" />
                <Text style={styles.serviceMeta}>{service.durationMinutes} min</Text>
              </View>
            </View>
            <Text style={styles.servicePrice}>${service.price}</Text>
          </View>
        </View>

        {/* ── Calendar strip ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SELECT DATE</Text>
          {availableDays.length === 0 ? (
            <Text style={styles.noDaysText}>
              This barber has no working days set in the next few weeks. Ask them to update hours in their profile.
            </Text>
          ) : null}
          <FlatList
            data={availableDays}
            keyExtractor={(d) => d.toISOString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calStrip}
            renderItem={({ item: day }) => {
              const sel = isSameDay(day, selectedDay);
              const todayDay = isToday(day);
              return (
                <TouchableOpacity
                  onPress={() => setSelectedDay(day)}
                  style={[styles.dayCard, sel && styles.dayCardSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={`${DAY_LABELS[day.getDay()]} ${day.getDate()}`}
                  accessibilityState={{ selected: sel }}
                >
                  <Text style={[styles.dayName, sel && styles.dayNameSelected]}>
                    {todayDay ? 'Today' : DAY_LABELS[day.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, sel && styles.dayNumSelected]}>
                    {day.getDate()}
                  </Text>
                  <Text style={[styles.dayMonth, sel && styles.dayMonthSelected]}>
                    {MONTH_LABELS[day.getMonth()]}
                  </Text>
                  {sel && <View style={styles.dayDot} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* ── Load error notice ── */}
        {loadError ? (
          <View style={styles.noticeBanner} accessibilityRole="alert">
            <Text style={styles.noticeText}>ℹ {loadError}</Text>
          </View>
        ) : null}

        {/* ── Time slots ── */}
        <View style={styles.section}>
          <View style={styles.slotHeaderRow}>
            <Text style={styles.sectionLabel}>AVAILABLE TIMES</Text>
            {loadingSlots && (
              <ActivityIndicator
                size={14}
                color={C.gold}
                accessibilityLabel="Loading available times"
              />
            )}
          </View>

          {loadingSlots ? (
            <View style={styles.loadingGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={styles.slotSkeleton} />
              ))}
            </View>
          ) : daySlots.length === 0 ? (
            <Text style={styles.noDaysText}>No time slots for this day.</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {daySlots.map((slot) => {
                const disabled = isDisabled(slot);
                const booked   = isBooked(slot);
                const past     = isPast(slot);
                const isSel    = selectedSlot?.key === slot.key;

                return (
                  <TouchableOpacity
                    key={slot.key}
                    onPress={() => !disabled && setSelectedSlot(s => s?.key === slot.key ? null : slot)}
                    disabled={disabled}
                    activeOpacity={disabled ? 1 : 0.75}
                    style={[
                      styles.slot,
                      disabled && styles.slotDisabled,
                      isSel   && styles.slotSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${slot.label}${booked ? ', booked' : past ? ', past' : ''}`}
                    accessibilityState={{ disabled, selected: isSel }}
                  >
                    {isSel && (
                      <View style={styles.slotCheck} importantForAccessibility="no">
                        <Text style={styles.slotCheckMark}>✓</Text>
                      </View>
                    )}
                    <Text style={[
                      styles.slotTime,
                      disabled && styles.slotTimeDisabled,
                      isSel   && styles.slotTimeSelected,
                    ]}>
                      {slot.label}
                    </Text>
                    {(booked || past) && (
                      <Text style={styles.slotSubLabel}>
                        {booked ? 'Booked' : 'Past'}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        {/* Selection summary */}
        {selectedSummary ? (
          <View style={styles.summary} accessibilityLabel={`Selected: ${selectedSummary}`}>
            <Text style={styles.summaryLabel}>APPOINTMENT</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>{selectedSummary}</Text>
          </View>
        ) : (
          <Text style={styles.hintText}>Select a date and time slot above</Text>
        )}

        {/* Confirm button */}
        <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScale }] }]}>
          {canConfirm && <View style={styles.btnGlow} />}
          <TouchableOpacity
            onPress={handleConfirm}
            onPressIn={btnIn}
            onPressOut={btnOut}
            disabled={!canConfirm}
            activeOpacity={1}
            style={[styles.btn, !canConfirm && styles.btnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Continue to confirm booking"
            accessibilityHint={canConfirm ? `Confirm ${service.name} at ${selectedSlot!.label}` : 'Select a time slot first'}
            accessibilityState={{ disabled: !canConfirm }}
          >
            <Text style={[styles.btnText, !canConfirm && styles.btnTextDisabled]}>
              Review & Confirm →
            </Text>
            {canConfirm && <View style={styles.btnDepth} />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const SLOT_GAP   = 10;
const SLOT_COLS  = 3;
const SLOT_W     = (SW - 40 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingTop: 4 },

  centerMsg:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadBarberText:  { color: C.sub, fontSize: 14 },
  errTitle:        { color: C.white, fontSize: 16, textAlign: 'center', fontWeight: '700' },
  retryBtn:        { marginTop: 8, backgroundColor: C.gold, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  retryBtnText:    { color: C.bg, fontWeight: '800', fontSize: 15 },
  noDaysText:      { color: C.sub, fontSize: 13, lineHeight: 20, marginBottom: 10 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn:     { width: 36, alignItems: 'center' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white, letterSpacing: 0.4 },
  headerShop:  { fontSize: 10, color: C.gold, letterSpacing: 2, fontWeight: '700', marginTop: 2 },
  headerSub:   { fontSize: 12, color: C.sub, fontWeight: '600', marginTop: 4 },
  headerLine:  {
    height: 1, marginHorizontal: 20, backgroundColor: C.gold,
    opacity: 0.3, marginBottom: 2,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 4,
  },

  // Service card
  serviceCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  serviceCardAccent: { height: 3, backgroundColor: C.gold },
  serviceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  serviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.goldGlow,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceInfo:  { flex: 1 },
  serviceName:  { fontSize: 16, fontWeight: '800', color: C.white, letterSpacing: 0.3 },
  serviceMeta:  { fontSize: 12, color: C.sub, marginTop: 2 },
  servicePrice: { fontSize: 26, fontWeight: '900', color: C.gold, letterSpacing: -0.5, flexShrink: 0 },

  // Section
  section:       { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel:  { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  slotHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },

  // Calendar strip
  calStrip: { gap: 10, paddingBottom: 4 },
  dayCard: {
    width: 62,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.divider,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  dayCardSelected: {
    backgroundColor: C.goldGlow,
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.25,
    elevation: 10,
  },
  dayName:         { fontSize: 11, fontWeight: '700', color: C.sub,   letterSpacing: 0.5 },
  dayNameSelected: { color: C.gold },
  dayNum:          { fontSize: 22, fontWeight: '900', color: C.white },
  dayNumSelected:  { color: C.gold },
  dayMonth:        { fontSize: 10, fontWeight: '600', color: C.muted,  letterSpacing: 0.5 },
  dayMonthSelected:{ color: C.gold },
  dayDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: C.gold, marginTop: 2,
  },

  // Notice banner
  noticeBanner: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: C.goldGlow,
    borderWidth: 1,
    borderColor: C.goldBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  noticeText: { fontSize: 12, color: C.gold, fontWeight: '500', lineHeight: 16 },

  // Slot grid
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
  },
  slot: {
    width: SLOT_W,
    height: 60,
    borderRadius: 12,
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.divider,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  slotSelected: {
    backgroundColor: C.gold,
    borderColor: C.goldLight,
    shadowColor: C.gold,
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  slotDisabled: {
    backgroundColor: C.booked,
    borderColor: C.bookedBorder,
    shadowOpacity: 0,
    elevation: 0,
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.2,
  },
  slotTimeSelected: { color: C.bg },
  slotTimeDisabled: { color: C.bookedText, fontSize: 12 },
  slotSubLabel: {
    fontSize: 9,
    color: C.muted,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  slotCheck: {
    position: 'absolute',
    top: 4,
    right: 6,
  },
  slotCheckMark: {
    fontSize: 11,
    fontWeight: '900',
    color: C.bg,
    lineHeight: 14,
  },

  // Loading skeleton for slots
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
  },
  slotSkeleton: {
    width: SLOT_W,
    height: 60,
    borderRadius: 12,
    backgroundColor: C.elevated,
    opacity: 0.5,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: C.divider,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 20,
  },
  hintText: { fontSize: 12, color: C.muted, textAlign: 'center' },
  summary: {
    backgroundColor: C.elevated,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  summaryLabel: { fontSize: 9, color: C.gold, fontWeight: '800', letterSpacing: 2, marginBottom: 3 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: C.white },

  // Button
  btnWrap: { position: 'relative' },
  btnGlow: {
    position: 'absolute',
    top: 4, left: 10, right: 10, bottom: -4,
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
  btnDisabled: {
    backgroundColor: C.elevated, borderTopColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.2, elevation: 2,
  },
  btnText:         { fontSize: 16, fontWeight: '800', color: C.bg, letterSpacing: 1.5, textTransform: 'uppercase' },
  btnTextDisabled: { color: C.muted },
  btnDepth: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
    backgroundColor: C.goldDark, opacity: 0.5,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
  },
});
