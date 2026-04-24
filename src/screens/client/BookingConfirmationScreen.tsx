import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Linking,
  Platform,
  Image,
  Animated,
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
  category: string;
}> = {
  s1: { name: 'Fade', price: 40, durationMinutes: 30, iconName: icons.cutOutline, category: 'Haircut' },
  s2: { name: 'Lineup', price: 15, durationMinutes: 15, iconName: icons.cutOutline, category: 'Haircut' },
  s3: { name: 'Beard Trim', price: 25, durationMinutes: 20, iconName: icons.brush, category: 'Beard' },
  s4: { name: 'Haircut', price: 35, durationMinutes: 45, iconName: icons.cutOutline, category: 'Haircut' },
  s5: { name: 'Beard + Haircut', price: 50, durationMinutes: 60, iconName: icons.starOutline, category: 'Combo' },
};

const DEFAULT_SERVICE = {
  name: 'Service',
  price: 0,
  durationMinutes: 30,
  iconName: icons.cutOutline as keyof typeof Ionicons.glyphMap,
  category: '',
};

// ==========================================
// Helpers
// ==========================================
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  const end = new Date(startMs + durationMins * 60 * 1000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return (
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${encodeURIComponent('Booked via 613 Barbershop app')}`
  );
}

// ==========================================
// Types
// ==========================================
type Props = NativeStackScreenProps<BookStackParamList, 'BookingConfirm'>;
type Phase = 'preview' | 'saving' | 'success' | 'error';

// ==========================================
// Animated Components
// ==========================================
function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }): React.JSX.Element {
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

// ==========================================
// Summary Row Component
// ==========================================
function SummaryRow({ iconName, label, value, valueStyle }: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueStyle?: object;
}): React.JSX.Element {
  return (
    <View style={styles.summaryRow} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.summaryIconWrap}>
        <Ionicons name={iconName} size={16} color={colors.greyDark} />
      </View>
      <View style={styles.summaryRowText}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={[styles.summaryValue, valueStyle]}>{value}</Text>
      </View>
    </View>
  );
}

// ==========================================
// Main Screen Component
// ==========================================
export default function BookingConfirmationScreen({ route, navigation }: Props): React.JSX.Element {
  const { barberId, barberName, serviceId, scheduledAt } = route.params;
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const service = SERVICE_MAP[serviceId] ?? DEFAULT_SERVICE;
  const dateLabel = formatDate(scheduledAt);
  const timeLabel = formatTime(scheduledAt);

  const [phase, setPhase] = useState<Phase>('preview');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedStylePreview, setSavedStylePreview] = useState<RequestedStyle | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const confCode = bookingId ? bookingId.substring(0, 6).toUpperCase() : '';

  // Animations
  const checkScaleAnim = useRef(new Animated.Value(0)).current;
  const checkOpacityAnim = useRef(new Animated.Value(0)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  const playSuccess = useCallback(() => {
    Animated.spring(checkScaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 40 }).start();
    Animated.timing(checkOpacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(cardOpacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 200);
  }, []);

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

  async function handleConfirm(): Promise<void> {
    if (!firebaseUser) {
      setErrorMsg('You must be signed in to book.');
      setPhase('error');
      return;
    }

    setPhase('saving');
    setErrorMsg(null);

    const result = await BookingService.create({
      clientId: firebaseUser.uid,
      clientName: firebaseUser.displayName ?? firebaseUser.email ?? 'Client',
      barberId,
      barberName,
      serviceId,
      scheduledAt: Timestamp.fromMillis(scheduledAt),
      durationMinutes: service.durationMinutes,
      price: service.price,
      notes: null,
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

  function handleAddToCalendar(): void {
    const url = buildGoogleCalendarUrl(
      `613 Barbershop — ${service.name}`,
      scheduledAt,
      service.durationMinutes,
    );
    Linking.openURL(url).catch(() => { });
  }

  function goToHistory(): void {
    navigation.getParent()?.navigate('History' as never);
  }

  function goBookAnother(): void {
    navigation.popToTop();
  }

  function btnIn(): void {
    Animated.spring(btnScaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  }

  function btnOut(): void {
    Animated.spring(btnScaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  }

  const attachedStyle: RequestedStyle | null | undefined =
    phase === 'success' ? confirmedBooking?.requestedStyle : savedStylePreview;

  const summaryCard = (
    <View style={styles.summaryCard}>
      <View style={styles.summaryCardAccent} />
      <View style={styles.summaryCardHeader}>
        <View style={styles.serviceIconWrap}>
          <Ionicons name={service.iconName} size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.serviceName}>{service.name}</Text>
          <Text style={styles.serviceCategory}>{service.category}</Text>
        </View>
        <Text style={styles.servicePrice}>${service.price}</Text>
      </View>

      <View style={styles.divider} />

      <SummaryRow iconName={icons.person} label="Barber" value={barberName} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName={icons.tabBookOutline} label="Date" value={dateLabel} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName={icons.time} label="Time" value={timeLabel} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName={icons.time} label="Duration" value={`${service.durationMinutes} min`} />
      <View style={styles.rowDivider} />
      <SummaryRow iconName={icons.alertCircle} label="Price" value={`$${service.price}`} valueStyle={styles.priceValue} />

      {phase === 'success' && confCode ? (
        <>
          <View style={styles.rowDivider} />
          <SummaryRow iconName={icons.information} label="Booking ID" value={confCode} valueStyle={styles.codeValue} />
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header} accessibilityRole="header">
        {phase !== 'success' ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          >
            <Ionicons name={icons.back} size={22} color={colors.white} />
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

      {/* Saving overlay */}
      {phase === 'saving' && (
        <View style={styles.savingOverlay} accessibilityLiveRegion="polite">
          <View style={styles.savingCard}>
            <ActivityIndicator size={40} color={colors.gold} />
            <Text style={styles.savingTitle}>Securing your slot…</Text>
            <Text style={styles.savingSub}>Please wait a moment</Text>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success State */}
        {phase === 'success' && (
          <>
            {/* Animated checkmark */}
            <Animated.View
              style={[
                styles.checkWrap,
                { transform: [{ scale: checkScaleAnim }], opacity: checkOpacityAnim },
              ]}
              accessibilityLabel="Booking confirmed"
              accessibilityRole="image"
            >
              <View style={styles.checkRing}>
                <View style={styles.checkInner}>
                  <Ionicons name={icons.checkmark} size={40} color={colors.gold} />
                </View>
              </View>
            </Animated.View>

            <Text style={styles.successTitle}>Booking Request Sent!</Text>
            <Text style={styles.successSub}>
              {dateLabel} at {timeLabel}{'\n'}Your barber will confirm shortly.
            </Text>

            {/* Summary card fades in */}
            <Animated.View style={{ opacity: cardOpacityAnim }}>
              {summaryCard}
            </Animated.View>

            {/* Status + confirmation badge */}
            <Animated.View style={[styles.codeBadge, { opacity: cardOpacityAnim }]}>
              <View style={styles.pendingRow}>
                <Ionicons name={icons.time} size={16} color={colors.gold} style={{ marginRight: 6 }} />
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
            <Animated.View style={[styles.actionGroup, { opacity: cardOpacityAnim }]}>
              {/* Add to Calendar */}
              <TouchableOpacity
                onPress={handleAddToCalendar}
                style={styles.calBtn}
                accessibilityRole="button"
                accessibilityLabel="Add to Calendar"
              >
                <Ionicons name={icons.tabBookOutline} size={18} color={colors.background} style={{ marginRight: 8 }} />
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

        {/* Error State */}
        {phase === 'error' && (
          <>
            <View style={styles.errorWrap} accessibilityRole="alert">
              <View style={styles.errorIcon}>
                <Ionicons name={icons.close} size={36} color={colors.red} />
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
              <Ionicons name={icons.arrowBack} size={14} color={colors.gold} style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Choose a Different Time</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Preview State */}
        {(phase === 'preview' || phase === 'saving') && (
          <>
            <FadeInView>
              <Text style={styles.previewIntro}>
                Please review your booking details before confirming.
              </Text>
            </FadeInView>

            <FadeInView delay={50}>
              {summaryCard}
            </FadeInView>

            {/* Info strip */}
            <FadeInView delay={100}>
              <View style={styles.infoStrip}>
                <Ionicons name={icons.information} size={15} color={colors.greyDark} style={{ marginRight: 6 }} />
                <Text style={styles.infoStripText}>
                  Free cancellation up to 2 hours before your appointment.
                </Text>
              </View>
            </FadeInView>
          </>
        )}
      </ScrollView>

      {/* Bottom bar (preview only) */}
      {(phase === 'preview' || phase === 'saving') && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <Animated.View style={[styles.btnWrap, { transform: [{ scale: btnScaleAnim }] }]}>
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
                  <ActivityIndicator size={18} color={colors.background} />
                  <Text style={styles.btnText}>Securing Slot…</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>Book Now</Text>
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

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
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
  headerSub: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.wider,
    fontFamily: fonts.bodyBold,
    marginTop: spacing.xs,
  },
  headerLine: {
    height: 1,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    opacity: 0.3,
    marginBottom: spacing.xs,
  },

  // Saving overlay
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99,
    backgroundColor: `${colors.background}CC`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 36,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    ...shadows.md,
    minWidth: 220,
  },
  savingTitle: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  savingSub: {
    fontSize: fonts.size.md,
    color: colors.grey,
    fontFamily: fonts.body,
  },

  // Preview
  previewIntro: {
    fontSize: fonts.size.md,
    color: colors.grey,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    fontFamily: fonts.body,
  },

  // Summary card
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
    ...shadows.md,
    marginBottom: spacing.lg,
  },
  summaryCardAccent: {
    height: 3,
    backgroundColor: colors.gold,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  serviceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  serviceName: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
  },
  serviceCategory: {
    fontSize: fonts.size.xs,
    color: colors.grey,
    marginTop: 2,
    fontFamily: fonts.bodySemiBold,
  },
  servicePrice: {
    fontSize: fonts.size['3xl'],
    fontFamily: fonts.bodyBold,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.tight,
    flexShrink: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    gap: spacing.md,
  },
  summaryIconWrap: {
    width: 26,
    alignItems: 'center',
  },
  summaryRowText: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: fonts.size.xs,
    color: colors.greyDark,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wide,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  priceValue: {
    color: colors.gold,
    fontSize: fonts.size.xl,
  },
  codeValue: {
    color: colors.gold,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 3,
    fontSize: fonts.size.xl,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  styleAttachBlock: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  styleAttachLabel: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wide,
    marginBottom: spacing.md,
  },
  styleAttachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  styleAttachThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  styleAttachName: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: 4,
  },
  styleAttachDesc: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
    fontFamily: fonts.body,
  },

  // Info strip
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  infoStripText: {
    flex: 1,
    fontSize: fonts.size.sm,
    color: colors.gold,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
    fontFamily: fonts.body,
  },

  // Success
  checkWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  checkRing: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: colors.goldGlow,
    borderWidth: 3,
    borderColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  checkInner: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: `${colors.green}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.heading,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successSub: {
    fontSize: fonts.size.md,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    marginBottom: spacing.xl,
    fontFamily: fonts.body,
  },

  // Confirmation code badge
  codeBadge: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 18,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pendingLabel: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
  },
  codeBadgeValue: {
    fontSize: fonts.size['4xl'],
    color: colors.gold,
    letterSpacing: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: spacing.sm,
  },
  codeBadgeHint: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    fontFamily: fonts.body,
  },

  // Action buttons (success)
  actionGroup: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  calBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius['2xl'],
    height: 52,
    ...shadows.sm,
  },
  calBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },
  historyBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.gold,
  },
  historyBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.normal,
  },
  anotherBtn: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius['2xl'],
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  anotherBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.grey,
  },

  // Error
  errorWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: `${colors.red}22`,
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  errorTitle: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.heading,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  errorMsg: {
    fontSize: fonts.size.md,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.body,
  },
  retryBtn: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius['2xl'],
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
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
    gap: spacing.sm,
    ...shadows.md,
  },
  btnHint: {
    fontSize: fonts.size.xs,
    color: colors.greyDark,
    textAlign: 'center',
    fontFamily: fonts.body,
  },
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
  },
  btnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.normal,
  },
  btnLoadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
