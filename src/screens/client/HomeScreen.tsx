import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import { ClientTabParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import { Booking } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  cards,
  loyalty,
  icons,
  animations,
  C,
} from '@/theme';

const { width: SW } = Dimensions.get('window');

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Haircut',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayMMDD(): string {
  const n = new Date();
  return `${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

type UserLoyaltyMeta = {
  birthday: string | null;
  loyaltyCount: number;
  hasFreecut: boolean;
};

function normalizeLoyaltyCount(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return Math.max(0, Math.min(6, Math.floor(v)));
  }
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(6, n));
  }
  return 0;
}

function toMs(t: Timestamp | null | undefined | unknown): number {
  if (t instanceof Timestamp || t === null || t === undefined) {
    return safeToDate(t as Timestamp | null | undefined).getTime();
  }
  return Number(t);
}

function pickNextUpcoming(bookings: Booking[]): Booking | null {
  const nowMs = Date.now();
  const todayStart = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

  const eligible = bookings.filter((b) => {
    if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'declined' || b.status === 'no_show') {
      return false;
    }
    const start = toMs(b.scheduledAt);
    if (b.status === 'in_progress') {
      const durationMs = (b.durationMinutes ?? 45) * 60_000;
      const graceMs = 30 * 60_000;
      return start <= nowMs && nowMs <= start + durationMs + graceMs;
    }
    if (b.status === 'pending' || b.status === 'confirmed') {
      return start >= todayStart;
    }
    return false;
  });

  if (eligible.length === 0) return null;

  const inChairToday = eligible.find((b) => {
    const ms = toMs(b.scheduledAt);
    return b.status === 'in_progress' && ms >= todayStart && ms <= todayEnd;
  });
  if (inChairToday) return inChairToday;

  eligible.sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
  return eligible[0] ?? null;
}

function formatSlot(ts: Timestamp | null | undefined): string {
  const d = safeToDate(ts);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

type Props = BottomTabScreenProps<ClientTabParamList, 'Home'>;

const QUICK_SERVICES = [
  { id: 's1', name: 'Fade', price: 40, duration: '30 min', iconName: icons.cut },
  { id: 's4', name: 'Haircut', price: 35, duration: '45 min', iconName: icons.cut },
  { id: 's3', name: 'Beard Trim', price: 25, duration: '20 min', iconName: icons.brush },
  { id: 's5', name: 'Beard + Cut', price: 50, duration: '60 min', iconName: icons.star },
];

// ─── Animated Card Component ────────────────────────────────────────────────

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
}

function AnimatedCard({ children, delay = 0 }: AnimatedCardProps): React.JSX.Element {
  const translateY = React.useRef(new Animated.Value(20)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: animations.normal,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: animations.normal,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, translateY, opacity]);

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
      }}
    >
      {children}
    </Animated.View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const firstName = (appUser?.displayName ?? firebaseUser?.displayName ?? 'there').split(' ')[0];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [userMeta, setUserMeta] = useState<UserLoyaltyMeta | null>(null);
  const [birthdayDismissed, setBirthdayDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setBookings([]);
      setBookingsLoading(false);
      return;
    }
    setBookingsLoading(true);
    const unsub = BookingService.onSnapshotByClient(
      firebaseUser.uid,
      (data) => {
        setBookings(data);
        setBookingsLoading(false);
      },
      () => setBookingsLoading(false),
    );
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      setUserMeta(null);
      return;
    }
    const ref = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data();
        const rawLc = d?.loyaltyCount;
        const loyaltyCount = normalizeLoyaltyCount(rawLc);
        console.log('[home] user snapshot loyaltyCount:', rawLc, 'normalized:', loyaltyCount);
        setUserMeta({
          birthday: typeof d?.birthday === 'string' ? d.birthday : null,
          loyaltyCount,
          hasFreecut: d?.hasFreecut === true,
        });
      },
      (err) => {
        console.error('[home] user snapshot error:', err);
      },
    );
    return unsub;
  }, [firebaseUser]);

  async function dismissFreeCutBanner(): Promise<void> {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        hasFreecut: false,
      });
    } catch (e) {
      Alert.alert(
        'Could not update',
        e instanceof Error ? e.message : 'Please try again.',
      );
    }
  }

  const showBirthdayBanner = useMemo(() => {
    if (!firebaseUser || !userMeta?.birthday) return false;
    if (userMeta.birthday !== todayMMDD()) return false;
    const key = `${firebaseUser.uid}|${userMeta.birthday}|${new Date().getFullYear()}`;
    return birthdayDismissed !== key;
  }, [firebaseUser, userMeta, birthdayDismissed]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const nextBooking = useMemo(() => pickNextUpcoming(bookings), [bookings]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <AnimatedCard delay={0}>
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.heroName}>{firstName}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name={icons.notifications} size={24} color={colors.white} />
            </TouchableOpacity>
          </View>
        </AnimatedCard>

        {/* ── Birthday Banner ── */}
        {firebaseUser && showBirthdayBanner && userMeta?.birthday ? (
          <AnimatedCard delay={50}>
            <View style={styles.birthdayBanner}>
              <View style={styles.birthdayIconWrap}>
                <Ionicons name={icons.gift} size={22} color={colors.background} />
              </View>
              <View style={styles.birthdayBannerTextWrap}>
                <Text style={styles.birthdayTitle}>
                  Happy Birthday — enjoy a free product on us today
                </Text>
                <Text style={styles.birthdaySub}>Show this to your barber when you arrive</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setBirthdayDismissed(`${firebaseUser.uid}|${userMeta.birthday}|${new Date().getFullYear()}`);
                }}
                style={styles.birthdayDismiss}
                accessibilityRole="button"
                accessibilityLabel="Dismiss birthday message"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name={icons.close} size={24} color={colors.background} />
              </TouchableOpacity>
            </View>
          </AnimatedCard>
        ) : null}

        {/* ── Next appointment / CTA ── */}
        <AnimatedCard delay={100}>
          <View style={styles.nextSection}>
            {bookingsLoading ? (
              <View style={styles.nextLoading} accessibilityLabel="Loading appointments">
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.nextLoadingText}>Checking your bookings…</Text>
              </View>
            ) : nextBooking ? (
              <View style={styles.nextCard} accessibilityRole="summary">
                <View style={styles.nextCardAccent} />
                <View style={styles.nextCardHeader}>
                  <View style={styles.nextCardTitleRow}>
                    <Ionicons name={icons.tabBookOutline} size={18} color={colors.gold} />
                    <Text style={styles.nextEyebrow}>YOUR NEXT APPOINTMENT</Text>
                  </View>
                  {nextBooking.status === 'in_progress' ? (
                    <View style={[styles.nextPill, { backgroundColor: 'rgba(33, 150, 243, 0.15)', borderColor: colors.blue }]}>
                      <Text style={[styles.nextPillText, { color: colors.blue }]}>In chair</Text>
                    </View>
                  ) : nextBooking.status === 'pending' ? (
                    <View style={[styles.nextPill, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderColor: colors.gold }]}>
                      <Text style={[styles.nextPillText, { color: colors.gold }]}>Pending</Text>
                    </View>
                  ) : (
                    <View style={[styles.nextPill, { backgroundColor: 'rgba(46, 125, 50, 0.15)', borderColor: colors.green }]}>
                      <Text style={[styles.nextPillText, { color: colors.green }]}>Confirmed</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.nextService}>
                  {SERVICE_NAMES[nextBooking.serviceId] ?? nextBooking.serviceId}
                </Text>
                <View style={styles.nextMetaRow}>
                  <Ionicons name={icons.person} size={14} color={colors.grey} />
                  <Text style={styles.nextMetaText}>{nextBooking.barberName ?? 'Your barber'}</Text>
                </View>
                <View style={styles.nextMetaRow}>
                  <Ionicons name={icons.time} size={14} color={colors.grey} />
                  <Text style={styles.nextMetaText}>{formatSlot(nextBooking.scheduledAt)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.nextDetailsBtn}
                  onPress={() => navigation.navigate('History')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View booking details in History"
                >
                  <Text style={styles.nextDetailsBtnText}>View Details</Text>
                  <Ionicons name={icons.forward} size={18} color={colors.background} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ctaCard}>
                <View style={styles.ctaCardAccent} />
                <Ionicons name={icons.cutOutline} size={28} color={colors.gold} style={{ marginBottom: spacing.md }} />
                <Text style={styles.ctaTitle}>Book your first cut</Text>
                <Text style={styles.ctaSub}>
                  You have no upcoming confirmed appointment. Pick a service and lock in your time.
                </Text>
                <TouchableOpacity
                  style={styles.ctaBtn}
                  onPress={() => navigation.navigate('Book')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Book your first cut"
                >
                  <Text style={styles.ctaBtnText}>Get started</Text>
                  <Ionicons name={icons.arrowForward} size={18} color={colors.background} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </AnimatedCard>

        {/* ── Services ── */}
        <AnimatedCard delay={150}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OUR SERVICES</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('Book')}
                accessibilityRole="button"
                accessibilityLabel="Book now"
              >
                <Text style={styles.sectionLink}>Book Now</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.serviceGrid}>
              {QUICK_SERVICES.map((svc, index) => (
                <AnimatedCard key={svc.id} delay={200 + index * 50}>
                  <TouchableOpacity
                    style={styles.serviceCard}
                    onPress={() => navigation.navigate('Book')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${svc.name}, $${svc.price}`}
                  >
                    <View style={styles.serviceIconWrap}>
                      <Ionicons name={svc.iconName} size={22} color={colors.gold} />
                    </View>
                    <Text style={styles.serviceName}>{svc.name}</Text>
                    <Text style={styles.serviceDuration}>{svc.duration}</Text>
                    <Text style={styles.servicePrice}>${svc.price}</Text>
                  </TouchableOpacity>
                </AnimatedCard>
              ))}
            </View>
          </View>
        </AnimatedCard>

        {/* ── Loyalty ── */}
        {firebaseUser && userMeta ? (
          <AnimatedCard delay={300}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LOYALTY REWARDS</Text>
              {userMeta.hasFreecut ? (
                <View style={styles.freeCutBanner}>
                  <View style={styles.freeCutIconWrap}>
                    <Ionicons name={icons.cut} size={22} color={colors.background} />
                  </View>
                  <View style={styles.freeCutTextCol}>
                    <Text style={styles.freeCutTitle}>You earned a free cut on your next booking</Text>
                    <Text style={styles.freeCutSub}>
                      Every 7 completed visits earns one free haircut in the app. Book whenever you are ready.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => void dismissFreeCutBanner()}
                    style={styles.freeCutDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss free cut message"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name={icons.close} size={24} color={colors.background} />
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.loyaltyCard}>
                <View style={styles.loyaltyCardAccent} />
                <Text style={styles.loyaltyStampHeading}>
                  Stamps · {userMeta.loyaltyCount} of 7
                </Text>
                <View style={styles.stampRow}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const earned = i < userMeta.loyaltyCount;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.stampSlot,
                          earned ? styles.stampEarned : styles.stampEmpty,
                        ]}
                      >
                        <Ionicons
                          name={icons.cut}
                          size={20}
                          color={earned ? colors.gold : colors.greyDark}
                        />
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.loyaltyHint}>
                  {userMeta.loyaltyCount === 0
                    ? 'Complete a visit to earn your first stamp'
                    : `${7 - userMeta.loyaltyCount} more visit${7 - userMeta.loyaltyCount === 1 ? '' : 's'} until a free cut`}
                </Text>
              </View>
            </View>
          </AnimatedCard>
        ) : null}

        {/* ── Why 613 ── */}
        <AnimatedCard delay={350}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WHY 613</Text>
            <View style={styles.featureCard}>
              {              [
                { icon: icons.ribbon, text: 'Premium cuts by experienced barbers' },
                { icon: icons.shield, text: 'Hygienic tools, cleaned between every client' },
                { icon: icons.flash, text: 'No wait — book your exact time slot' },
                { icon: icons.heart, text: 'Loyal clients get priority booking' },
              ].map(({ icon, text }) => (
                <View key={text} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={icon} size={18} color={colors.gold} />
                  </View>
                  <Text style={styles.featureText}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
        </AnimatedCard>

        {/* ── Footer ── */}
        <AnimatedCard delay={400}>
          <Text style={styles.footer}>613 Barbershop · 598 Rideau St, Ottawa, ON K1N 6A2</Text>
        </AnimatedCard>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  greeting: {
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: colors.grey,
    marginBottom: spacing.xs,
  },
  heroName: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['5xl'],
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
  },
  notificationBtn: {
    padding: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
  },

  // Next appointment / CTA
  nextSection: { marginBottom: spacing.xl },
  nextLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextLoadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
  },
  nextCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  nextCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
  },
  nextCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  nextCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextEyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    color: colors.grey,
    letterSpacing: fonts.letterSpacing.wider,
  },
  nextPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  nextPillText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
  },
  nextService: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xl,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  nextMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  nextMetaText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
  },
  nextDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  nextDetailsBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.background,
  },

  ctaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  ctaCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
  },
  ctaTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: colors.white,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  ctaSub: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
    marginBottom: spacing.lg,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
  },
  ctaBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.background,
  },

  // Section
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size.sm,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.widest,
  },
  sectionLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.sm,
    color: colors.gold,
  },

  // Service grid
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  serviceCard: {
    width: (SW - 48) / 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.sm,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  serviceName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.md,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  serviceDuration: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: colors.grey,
    marginBottom: spacing.md,
  },
  servicePrice: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size['2xl'],
    color: colors.gold,
  },

  // Feature card
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.goldGlow,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
  },

  // Birthday banner
  birthdayBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  birthdayIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10, 10, 10, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayBannerTextWrap: { flex: 1, minWidth: 0 },
  birthdayTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.background,
    lineHeight: fonts.lineHeight.normal * fonts.size.md,
  },
  birthdaySub: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.background,
    opacity: 0.85,
    marginTop: spacing.xs,
    lineHeight: fonts.lineHeight.normal * fonts.size.sm,
  },
  birthdayDismiss: { padding: spacing.xs, marginTop: -spacing.xs },

  // Loyalty card
  loyaltyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  loyaltyCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.gold,
  },
  loyaltyStampHeading: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.white,
    marginBottom: spacing.md,
  },
  stampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  stampSlot: {
    width: loyalty.stampSize,
    height: loyalty.stampSize,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stampEarned: {
    backgroundColor: loyalty.earnedBackground,
    borderColor: loyalty.earnedBorder,
  },
  stampEmpty: {
    backgroundColor: loyalty.emptyBackground,
    borderColor: loyalty.emptyBorder,
  },
  loyaltyHint: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
  },
  freeCutBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  freeCutIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(10, 10, 10, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeCutTextCol: { flex: 1, minWidth: 0 },
  freeCutTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.background,
    lineHeight: fonts.lineHeight.normal * fonts.size.md,
  },
  freeCutSub: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: colors.background,
    opacity: 0.9,
    marginTop: spacing.xs,
    lineHeight: fonts.lineHeight.normal * fonts.size.xs,
  },
  freeCutDismiss: { padding: spacing.xs, marginTop: -spacing.xs },

  // Footer
  footer: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: colors.grey,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
