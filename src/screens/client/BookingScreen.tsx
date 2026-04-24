import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Animated,
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
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

const { width: SW } = Dimensions.get('window');

// ==========================================
// Static service lookup
// ==========================================
const SERVICE_MAP: Record<string, {
  name: string;
  price: number;
  durationMinutes: number;
  iconName: keyof typeof Ionicons.glyphMap;
}> = {
  s1: { name: 'Fade', price: 40, durationMinutes: 30, iconName: icons.cutOutline },
  s2: { name: 'Lineup', price: 15, durationMinutes: 15, iconName: icons.cutOutline },
  s3: { name: 'Beard Trim', price: 25, durationMinutes: 20, iconName: icons.brush },
  s4: { name: 'Haircut', price: 35, durationMinutes: 45, iconName: icons.cutOutline },
  s5: { name: 'Beard + Haircut', price: 50, durationMinutes: 60, iconName: icons.starOutline },
};

const DEFAULT_SERVICE = {
  name: 'Service',
  price: 0,
  durationMinutes: 30,
  iconName: icons.cutOutline as keyof typeof Ionicons.glyphMap,
};

// ==========================================
// Types
// ==========================================
interface TimeSlot {
  key: string;
  label: string;
  hour: number;
  minute: number;
}

type Props = NativeStackScreenProps<BookStackParamList, 'SelectDateTime'>;

// ==========================================
// Calendar helpers
// ==========================================
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

// ==========================================
// Animated Components
// ==========================================
function AnimatedCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }): React.JSX.Element {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: animations.normal, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: animations.normal, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

function AnimatedSlot({
  slot,
  disabled,
  booked,
  past,
  isSelected,
  onPress,
  index,
}: {
  slot: TimeSlot;
  disabled: boolean;
  booked: boolean;
  past: boolean;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: animations.fast, useNativeDriver: true }).start();
    }, index * 30);
    return () => clearTimeout(timeout);
  }, []);

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
    }
  }, [disabled]);

  const handlePressOut = useCallback(() => {
    if (!disabled) {
      Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
    }
  }, [disabled]);

  return (
    <Animated.View style={[styles.slotWrapper, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}>
      <TouchableOpacity
        key={slot.key}
        onPress={onPress}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={disabled ? 1 : 0.75}
        style={[
          styles.slot,
          disabled && styles.slotDisabled,
          isSelected && styles.slotSelected,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${slot.label}${booked ? ', booked' : past ? ', past' : ''}`}
        accessibilityState={{ disabled, selected: isSelected }}
      >
        {isSelected && (
          <View style={styles.slotCheck} importantForAccessibility="no">
            <Ionicons name={icons.checkmark} size={12} color={colors.background} />
          </View>
        )}
        <Text style={[
          styles.slotTime,
          disabled && styles.slotTimeDisabled,
          isSelected && styles.slotTimeSelected,
        ]}>
          {slot.label}
        </Text>
        {(booked || past) && (
          <Text style={styles.slotSubLabel}>
            {booked ? 'Booked' : 'Past'}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ==========================================
// Main Screen Component
// ==========================================
export default function BookingScreen({ route, navigation }: Props): React.JSX.Element {
  const { barberId, serviceId, barberName } = route.params;
  const insets = useSafeAreaInsets();
  const service = SERVICE_MAP[serviceId] ?? DEFAULT_SERVICE;

  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [selectedDay, setSelectedDay] = useState<Date>(todayStart);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookedKeys, setBookedKeys] = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [barberDoc, setBarberDoc] = useState<Barber | null>(null);
  const [barberLoading, setBarberLoading] = useState(true);
  const [barberLoadError, setBarberLoadError] = useState<string | null>(null);

  const btnScaleAnim = useRef(new Animated.Value(1)).current;

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

  const fetchBookings = useCallback(async (day: Date): Promise<void> => {
    setLoadingSlots(true);
    setSelectedSlot(null);

    const result = await BookingService.getByBarberAndDate(barberId, day);

    if (result.success) {
      const BLOCKING = new Set(['pending', 'confirmed', 'in_progress', 'completed']);
      const taken = new Set<string>();
      result.data.forEach((b: Booking) => {
        if (b.scheduledAt == null) return;
        if (!BLOCKING.has(b.status)) return;
        const d = safeToDate(b.scheduledAt);
        const h = String(d.getHours()).padStart(2, '0');
        const m = d.getMinutes() === 0 ? '00' : '30';
        taken.add(`${h}:${m}`);
      });
      setBookedKeys(taken);
    } else {
      setBookedKeys(new Set());
    }

    setLoadingSlots(false);
  }, [barberId]);

  useEffect(() => {
    fetchBookings(selectedDay);
  }, [selectedDay, fetchBookings]);

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

  function btnIn(): void {
    if (!selectedSlot) return;
    Animated.spring(btnScaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  }

  function btnOut(): void {
    Animated.spring(btnScaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  }

  const canConfirm = !!selectedSlot && daySlots.length > 0;

  const selectedSummary = selectedSlot
    ? `${DAY_LABELS[selectedDay.getDay()]}, ${MONTH_LABELS[selectedDay.getMonth()]} ${selectedDay.getDate()} · ${selectedSlot.label}`
    : null;

  if (barberLoading) {
    return (
      <View style={[styles.root, styles.centerMsg, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadBarberText}>Loading schedule…</Text>
      </View>
    );
  }

  if (barberLoadError || !barberDoc) {
    return (
      <View style={[styles.root, styles.centerMsg, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <Ionicons name={icons.alertCircle} size={44} color={colors.red} />
        <Text style={styles.errTitle}>{barberLoadError ?? 'Could not load barber.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.retryBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name={icons.back} size={22} color={colors.white} />
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
        {/* Service summary card */}
        <AnimatedCard delay={0}>
          <View style={styles.serviceCard} accessibilityLabel={`${service.name}, $${service.price}`}>
            <View style={styles.serviceCardAccent} />
            <View style={styles.serviceCardInner}>
              <View style={styles.serviceIconWrap}>
                <Ionicons name={service.iconName} size={22} color={colors.gold} />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name={icons.time} size={12} color={colors.greyDark} />
                  <Text style={styles.serviceMeta}>{service.durationMinutes} min</Text>
                </View>
              </View>
              <Text style={styles.servicePrice}>${service.price}</Text>
            </View>
          </View>
        </AnimatedCard>

        {/* Calendar strip */}
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

        {/* Time slots */}
        <View style={styles.section}>
          <View style={styles.slotHeaderRow}>
            <Text style={styles.sectionLabel}>AVAILABLE TIMES</Text>
            {loadingSlots && (
              <ActivityIndicator
                size={14}
                color={colors.gold}
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
              {daySlots.map((slot, idx) => {
                const disabled = isDisabled(slot);
                const booked = isBooked(slot);
                const past = isPast(slot);
                const isSel = selectedSlot?.key === slot.key;

                return (
                  <AnimatedSlot
                    key={slot.key}
                    slot={slot}
                    disabled={disabled}
                    booked={booked}
                    past={past}
                    isSelected={isSel}
                    onPress={() => setSelectedSlot(s => s?.key === slot.key ? null : slot)}
                    index={idx}
                  />
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
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
        <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScaleAnim }] }]}>
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
              Review & Confirm
            </Text>
            {canConfirm && <View style={styles.btnDepth} />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ==========================================
// Styles
// ==========================================
const SLOT_GAP = 10;
const SLOT_COLS = 3;
const SLOT_W = (SW - 40 - SLOT_GAP * (SLOT_COLS - 1)) / SLOT_COLS;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingTop: spacing.xs,
  },

  centerMsg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadBarberText: {
    color: colors.grey,
    fontSize: fonts.size.md,
    fontFamily: fonts.body,
  },
  errTitle: {
    color: colors.white,
    fontSize: fonts.size.lg,
    textAlign: 'center',
    fontFamily: fonts.bodyBold,
  },
  retryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: 22,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryBtnText: {
    color: colors.background,
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
  },
  noDaysText: {
    color: colors.grey,
    fontSize: fonts.size.md,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    marginBottom: spacing.md,
    fontFamily: fonts.body,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.heading,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.wide,
  },
  headerShop: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.wider,
    fontFamily: fonts.bodyBold,
    marginTop: spacing.xs,
  },
  headerSub: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    fontFamily: fonts.bodySemiBold,
    marginTop: spacing.xs,
  },
  headerLine: {
    height: 1,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    opacity: 0.3,
    marginBottom: spacing.xs,
  },

  // Service card
  serviceCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
    ...shadows.md,
  },
  serviceCardAccent: {
    height: 3,
    backgroundColor: colors.gold,
  },
  serviceCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  serviceIconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
  },
  serviceMeta: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    marginTop: spacing.xs,
    fontFamily: fonts.body,
  },
  servicePrice: {
    fontSize: fonts.size['3xl'],
    fontFamily: fonts.bodyBold,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.tight,
    flexShrink: 0,
  },

  // Section
  section: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: fonts.size.xs,
    color: colors.greyDark,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
    marginBottom: spacing.md,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  // Calendar strip
  calStrip: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  dayCard: {
    width: 62,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadows.sm,
  },
  dayCardSelected: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.gold,
    ...shadows.gold,
  },
  dayName: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.bodyBold,
    color: colors.grey,
    letterSpacing: fonts.letterSpacing.normal,
  },
  dayNameSelected: {
    color: colors.gold,
  },
  dayNum: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  dayNumSelected: {
    color: colors.gold,
  },
  dayMonth: {
    fontSize: fonts.size.xs,
    fontFamily: fonts.bodySemiBold,
    color: colors.greyDark,
    letterSpacing: fonts.letterSpacing.normal,
  },
  dayMonthSelected: {
    color: colors.gold,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: spacing.xs,
  },

  // Slot grid
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SLOT_GAP,
  },
  slotWrapper: {
    width: SLOT_W,
    height: 60,
  },
  slot: {
    width: SLOT_W,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
    position: 'relative',
  },
  slotSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
    ...shadows.gold,
  },
  slotDisabled: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  slotTime: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
  },
  slotTimeSelected: {
    color: colors.background,
  },
  slotTimeDisabled: {
    color: colors.greyDark,
    fontSize: fonts.size.sm,
  },
  slotSubLabel: {
    fontSize: 9,
    color: colors.greyDark,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: fonts.letterSpacing.normal,
    marginTop: 2,
  },
  slotCheck: {
    position: 'absolute',
    top: 4,
    right: 6,
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
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    opacity: 0.5,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
    ...shadows.md,
  },
  hintText: {
    fontSize: fonts.size.sm,
    color: colors.greyDark,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
  summary: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  summaryLabel: {
    fontSize: 9,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
    marginBottom: 3,
  },
  summaryValue: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },

  // Button
  btnWrap: {
    position: 'relative',
  },
  btnGlow: {
    position: 'absolute',
    top: 4,
    left: 10,
    right: 10,
    bottom: -4,
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    opacity: 0.2,
    ...shadows.gold,
  },
  btn: {
    height: 54,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    overflow: 'hidden',
  },
  btnDisabled: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.background,
    shadowOpacity: 0.2,
    elevation: 2,
  },
  btnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  btnTextDisabled: {
    color: colors.greyDark,
  },
  btnDepth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.goldDim,
    opacity: 0.5,
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
});
