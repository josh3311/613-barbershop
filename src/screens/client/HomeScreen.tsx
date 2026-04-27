import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
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
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore';
import Svg, { Ellipse } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
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
  loyalty,
  icons,
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
  { id: 's3', name: 'Beard Trim', price: 25, duration: '20 min', iconName: icons.brush },
  { id: 's5', name: 'Beard + Cut', price: 50, duration: '60 min', iconName: icons.star },
];

// ─── Floating Shapes Component (Section 1) ────────────────────────────────────

function FloatingShapes(): React.JSX.Element {
  const floatY1 = useRef(new Animated.Value(0)).current;
  const floatY2 = useRef(new Animated.Value(0)).current;
  const floatY3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createFloatAnimation = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -12,
            duration: 2800,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 2800,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createFloatAnimation(floatY1, 0);
    const anim2 = createFloatAnimation(floatY2, 600);
    const anim3 = createFloatAnimation(floatY3, 1200);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [floatY1, floatY2, floatY3]);

  return (
    <View style={styles.floatingShapesContainer} pointerEvents="none">
      <Animated.View style={[styles.shapeWrap, { transform: [{ translateY: floatY1 }] }]}>
        <Svg width={120} height={80} viewBox="0 0 120 80">
          <Ellipse cx={60} cy={40} rx={50} ry={30} fill={colors.gold} opacity={0.15} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.shapeWrap2, { transform: [{ translateY: floatY2 }] }]}>
        <Svg width={80} height={60} viewBox="0 0 80 60">
          <Ellipse cx={40} cy={30} rx={35} ry={22} fill="#252525" opacity={0.15} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.shapeWrap3, { transform: [{ translateY: floatY3 }] }]}>
        <Svg width={100} height={70} viewBox="0 0 100 70">
          <Ellipse cx={50} cy={35} rx={40} ry={25} fill={colors.gold} opacity={0.1} />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── Service Card with Animation (Section 2) ─────────────────────────────────

interface ServiceCardProps {
  svc: typeof QUICK_SERVICES[0];
  index: number;
  onPress: () => void;
}

function ServiceCard({ svc, index, onPress }: ServiceCardProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 120 + index * 120);
    return () => clearTimeout(timer);
  }, [index, opacity, translateY]);

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${svc.name}, $${svc.price}`}
    >
      <Animated.View
        style={[
          styles.serviceCard,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <View style={styles.serviceCardBorder} />
        <View style={styles.serviceIconWrap}>
          <Ionicons name={svc.iconName} size={22} color={colors.gold} />
        </View>
        <Text style={styles.serviceName}>{svc.name}</Text>
        <Text style={styles.serviceDuration}>{svc.duration}</Text>
        <Text style={styles.servicePrice}>${svc.price}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Loyalty Shimmer Banner (Section 3) ───────────────────────────────────────

function LoyaltyBanner({ userMeta, onDismiss }: { userMeta: UserLoyaltyMeta; onDismiss: () => void }): React.JSX.Element {
  const shimmerX = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: SW,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerX]);

  return (
    <View style={styles.loyaltyBanner}>
      <Ionicons name="cut-outline" size={28} color={colors.background} />
      <View style={styles.loyaltyBannerTextCol}>
        <Text style={styles.loyaltyBannerTitle}>Loyalty Rewards</Text>
        <Text style={styles.loyaltyBannerSub}>
          {userMeta.loyaltyCount} of 7 stamps · {7 - userMeta.loyaltyCount} more visits until a free cut
        </Text>
      </View>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: shimmerX }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
      {userMeta.hasFreecut && (
        <TouchableOpacity onPress={onDismiss} style={styles.loyaltyBannerDismiss} accessibilityRole="button">
          <Ionicons name={icons.close} size={22} color={colors.background} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Stamp Circle with Pulse Animation (Section 4) ───────────────────────────

interface StampProps {
  earned: boolean;
  index: number;
  totalCompleted: number;
}

function Stamp({ earned, index, totalCompleted }: StampProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (earned) {
      const delay = index * 80;
      const timer = setTimeout(() => {
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 200, useNativeDriver: true }),
        ]).start();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [earned, index, scale]);

  return (
    <Animated.View
      style={[
        styles.stampSlot,
        earned ? styles.stampEarned : styles.stampEmpty,
        { transform: [{ scale }] },
      ]}
    >
      <Ionicons name={icons.cut} size={20} color={earned ? colors.white : '#444'} />
    </Animated.View>
  );
}

// ─── Marquee Strip (Section 5) ───────────────────────────────────────────────

const MARQUEE_CONTENT = 'Premium Cuts  ✦  Expert Barbers  ✦  No Wait  ✦  Priority Booking  ✦  Hygienic Tools  ✦  ';
const CONTENT_WIDTH = 380;

function MarqueeStrip(): React.JSX.Element {
  const marqueeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(marqueeX, {
        toValue: -CONTENT_WIDTH,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [marqueeX]);

  return (
    <View style={styles.marqueeContainer}>
      <Animated.View style={[styles.marqueeContent, { transform: [{ translateX: marqueeX }] }]}>
        <Text style={styles.marqueeText}>{MARQUEE_CONTENT}</Text>
        <Text style={styles.marqueeText}>{MARQUEE_CONTENT}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Feature Card with Scroll Reveal (Section 6) ─────────────────────────────

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  index: number;
  scrollY: Animated.Value;
}

function FeatureCard({ icon, text, index }: FeatureCardProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-30)).current;
  const [hasRevealed, setHasRevealed] = useState(false);

  const onLayout = useCallback(() => {
    if (!hasRevealed) {
      const delay = 400 + index * 100;
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => setHasRevealed(true));
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [hasRevealed, index, opacity, translateX]);

  return (
    <Animated.View
      style={[styles.featureRow, { opacity, transform: [{ translateX }] }]}
      onLayout={onLayout}
    >
      <View style={styles.featureIconWrapGold}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const firstName = (appUser?.displayName ?? firebaseUser?.displayName ?? 'there').split(' ')[0];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [userMeta, setUserMeta] = useState<UserLoyaltyMeta | null>(null);
  const [birthdayDismissed, setBirthdayDismissed] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  // Hero animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(heroTranslateY, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [heroOpacity, heroTranslateY]);

  const nextCardOpacity = useRef(new Animated.Value(0)).current;
  const nextCardTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(nextCardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(nextCardTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 100);
    return () => clearTimeout(timer);
  }, [nextCardOpacity, nextCardTranslateY]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <Animated.ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Section 1: Hero Header with Floating Shapes ── */}
        <View style={styles.heroSection}>
          <FloatingShapes />
          <Animated.View style={{ opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.heroName}>{firstName}</Text>
          </Animated.View>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => {}}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name={icons.notifications} size={24} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* ── Birthday Banner ── */}
        {firebaseUser && showBirthdayBanner && userMeta?.birthday ? (
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
        ) : null}

        {/* ── Next appointment / CTA ── */}
        <Animated.View
          style={[
            styles.nextSection,
            { opacity: nextCardOpacity, transform: [{ translateY: nextCardTranslateY }] },
          ]}
        >
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
        </Animated.View>

        {/* ── Section 2: Service Cards ── */}
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
              <ServiceCard
                key={svc.id}
                svc={svc}
                index={index}
                onPress={() => navigation.navigate('Book')}
              />
            ))}
          </View>
        </View>

        {/* ── Section 3 & 4: Loyalty Rewards with Stamps ── */}
        {firebaseUser && userMeta ? (
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

            <LoyaltyBanner userMeta={userMeta} onDismiss={() => void dismissFreeCutBanner()} />

            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyCardAccent} />
              <Text style={styles.loyaltyStampHeading}>
                Stamps · {userMeta.loyaltyCount} of 7
              </Text>
              <View style={styles.stampRow}>
                {Array.from({ length: 7 }, (_, i) => {
                  const earned = i < userMeta.loyaltyCount;
                  return (
                    <Stamp
                      key={i}
                      earned={earned}
                      index={i}
                      totalCompleted={userMeta.loyaltyCount}
                    />
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
        ) : null}

        {/* ── Section 5: Marquee Strip ── */}
        <MarqueeStrip />

        {/* ── Section 6: Why 613 Feature Cards ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHY 613</Text>
          <View style={styles.featureCard}>
            {[
              { icon: icons.ribbon, text: 'Premium cuts by experienced barbers' },
              { icon: icons.shield, text: 'Hygienic tools, cleaned between every client' },
              { icon: icons.flash, text: 'No wait — book your exact time slot' },
              { icon: icons.heart, text: 'Loyal clients get priority booking' },
            ].map(({ icon, text }, idx) => (
              <FeatureCard key={text} icon={icon} text={text} index={idx} scrollY={scrollY} />
            ))}
          </View>
        </View>

        {/* ── Footer ── */}
        <Text style={styles.footer}>613 Barbershop · 598 Rideau St, Ottawa, ON K1N 6A2</Text>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Section 1: Hero Header with Floating Shapes
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  floatingShapesContainer: {
    ...StyleSheet.absoluteFillObject,
    top: -20,
    left: -20,
    zIndex: 0,
  },
  shapeWrap: {
    position: 'absolute',
    left: 20,
    top: 10,
  },
  shapeWrap2: {
    position: 'absolute',
    left: 140,
    top: 40,
  },
  shapeWrap3: {
    position: 'absolute',
    left: 60,
    top: 60,
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
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#252525',
    zIndex: 1,
  },

  // Next appointment / CTA
  nextSection: { marginBottom: spacing.xl },
  nextLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xl,
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
  },
  nextLoadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
  },
  nextCard: {
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
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
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
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

  // Section header
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

  // Section 2: Service Cards
  serviceGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
    overflow: 'hidden',
    padding: spacing.md,
    ...shadows.sm,
    position: 'relative',
  },
  serviceCardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
  },
  serviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#1A1A00',
    borderWidth: 1,
    borderColor: colors.gold,
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

  // Section 3: Loyalty Banner with Shimmer
  loyaltyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  loyaltyBannerTextCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  loyaltyBannerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: colors.background,
  },
  loyaltyBannerSub: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.background,
    opacity: 0.85,
  },
  loyaltyBannerDismiss: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
  },
  shimmerGradient: {
    width: 100,
    height: '100%',
  },

  // Section 4: Stamps
  loyaltyCard: {
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
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
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  stampEmpty: {
    backgroundColor: '#252525',
    borderColor: '#252525',
  },
  loyaltyHint: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: colors.grey,
  },

  // Section 5: Marquee
  marqueeContainer: {
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  marqueeContent: {
    flexDirection: 'row',
    width: CONTENT_WIDTH * 2,
  },
  marqueeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.sm,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.wide,
    width: CONTENT_WIDTH,
  },

  // Section 6: Feature Cards
  featureCard: {
    backgroundColor: '#141414',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#252525',
    padding: spacing.lg,
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconWrapGold: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1A1A00',
    borderWidth: 1,
    borderColor: colors.gold,
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
  },
  birthdayDismiss: { padding: spacing.xs, marginTop: -spacing.xs },

  // Free cut banner
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
