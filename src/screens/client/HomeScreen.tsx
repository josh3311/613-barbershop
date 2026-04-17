import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import { ClientTabParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import { Booking } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';

const { width: SW } = Dimensions.get('window');

const C = {
  bg:         '#0A0A0A',
  surface:    '#141414',
  card:       '#161616',
  elevated:   '#1E1E1E',
  gold:       '#D4AF37',
  goldGlow:   '#D4AF3715',
  goldBorder: '#D4AF3730',
  cardBorder: '#252525',
  white:      '#FFFFFF',
  sub:        '#888888',
  muted:      '#666666',
  divider:    '#1E1E1E',
  green:      '#4CAF50',
  blue:       '#2196F3',
} as const;

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Haircut',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toMs(t: Timestamp | null | undefined | unknown): number {
  if (t instanceof Timestamp || t === null || t === undefined) {
    return safeToDate(t as Timestamp | null | undefined).getTime();
  }
  return Number(t);
}

/** Next visit: in-chair first, else earliest future confirmed appointment */
function pickNextUpcoming(bookings: Booking[]): Booking | null {
  const now = Date.now();
  const inChair = bookings.find((b) => b.status === 'in_progress');
  if (inChair) return inChair;

  const upcoming = bookings
    .filter((b) => b.status === 'confirmed' && toMs(b.scheduledAt) >= now)
    .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
  return upcoming[0] ?? null;
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
  { id: 's1', name: 'Fade',           price: 40, duration: '30 min', iconName: 'cut-outline'   as const },
  { id: 's4', name: 'Haircut',        price: 35, duration: '45 min', iconName: 'cut-outline'   as const },
  { id: 's3', name: 'Beard Trim',     price: 25, duration: '20 min', iconName: 'brush-outline' as const },
  { id: 's5', name: 'Beard + Cut',    price: 50, duration: '60 min', iconName: 'star-outline'  as const },
];

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const firstName = (appUser?.displayName ?? firebaseUser?.displayName ?? 'there').split(' ')[0];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

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

  const nextBooking = useMemo(() => pickNextUpcoming(bookings), [bookings]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View style={s.heroRing} />
          <Text style={s.greeting}>{greeting},</Text>
          <Text style={s.heroName}>{firstName}</Text>
          <Text style={s.heroSub}>Ready for a fresh cut?</Text>

          <TouchableOpacity
            style={s.heroBtn}
            onPress={() => navigation.navigate('Book')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Book an appointment"
          >
            <Ionicons name="calendar-outline" size={18} color={C.bg} style={{ marginRight: 8 }} />
            <Text style={s.heroBtnText}>Book an Appointment</Text>
          </TouchableOpacity>
        </View>

        {/* ── Next appointment / CTA (PROJECT_STATUS Priority 1) ── */}
        {firebaseUser && (
          <View style={s.nextSection}>
            {bookingsLoading ? (
              <View style={s.nextLoading} accessibilityLabel="Loading appointments">
                <ActivityIndicator size="small" color={C.gold} />
                <Text style={s.nextLoadingText}>Checking your bookings…</Text>
              </View>
            ) : nextBooking ? (
              <View style={s.nextCard} accessibilityRole="summary">
                <View style={s.nextCardAccent} />
                <View style={s.nextCardHeader}>
                  <View style={s.nextCardTitleRow}>
                    <Ionicons name="calendar-outline" size={18} color={C.gold} />
                    <Text style={s.nextEyebrow}>YOUR NEXT APPOINTMENT</Text>
                  </View>
                  {nextBooking.status === 'in_progress' ? (
                    <View style={[s.nextPill, { borderColor: C.blue + '66', backgroundColor: '#0A1520' }]}>
                      <Text style={[s.nextPillText, { color: C.blue }]}>In chair</Text>
                    </View>
                  ) : (
                    <View style={[s.nextPill, { borderColor: C.green + '66', backgroundColor: '#0D200D' }]}>
                      <Text style={[s.nextPillText, { color: C.green }]}>Confirmed</Text>
                    </View>
                  )}
                </View>
                <Text style={s.nextService}>
                  {SERVICE_NAMES[nextBooking.serviceId] ?? nextBooking.serviceId}
                </Text>
                <View style={s.nextMetaRow}>
                  <Ionicons name="person-outline" size={14} color={C.sub} />
                  <Text style={s.nextMetaText}>{nextBooking.barberName ?? 'Your barber'}</Text>
                </View>
                <View style={s.nextMetaRow}>
                  <Ionicons name="time-outline" size={14} color={C.sub} />
                  <Text style={s.nextMetaText}>{formatSlot(nextBooking.scheduledAt)}</Text>
                </View>
                <TouchableOpacity
                  style={s.nextDetailsBtn}
                  onPress={() => navigation.navigate('History')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="View booking details in History"
                >
                  <Text style={s.nextDetailsBtnText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={18} color={C.bg} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.ctaCard}>
                <View style={s.ctaCardAccent} />
                <Ionicons name="cut-outline" size={28} color={C.gold} style={{ marginBottom: 10 }} />
                <Text style={s.ctaTitle}>Book your first cut</Text>
                <Text style={s.ctaSub}>
                  You have no upcoming confirmed appointment. Pick a service and lock in your time.
                </Text>
                <TouchableOpacity
                  style={s.ctaBtn}
                  onPress={() => navigation.navigate('Book')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Book your first cut"
                >
                  <Text style={s.ctaBtnText}>Get started</Text>
                  <Ionicons name="arrow-forward" size={18} color={C.bg} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Shop info strip ── */}
        <View style={s.infoStrip}>
          <View style={s.infoItem}>
            <Ionicons name="time-outline" size={16} color={C.gold} />
            <Text style={s.infoLabel}>Mon–Sat</Text>
            <Text style={s.infoValue}>9 AM – 7 PM</Text>
          </View>
          <View style={s.infoDivider} />
          <View style={s.infoItem}>
            <Ionicons name="location-outline" size={16} color={C.gold} />
            <Text style={s.infoLabel}>Ottawa, ON</Text>
            <Text style={s.infoValue}>613 Area</Text>
          </View>
          <View style={s.infoDivider} />
          <View style={s.infoItem}>
            <Ionicons name="star-outline" size={16} color={C.gold} />
            <Text style={s.infoLabel}>Rating</Text>
            <Text style={s.infoValue}>5.0 ★</Text>
          </View>
        </View>

        {/* ── Services ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>OUR SERVICES</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Book')}
              accessibilityRole="button"
              accessibilityLabel="Book now"
            >
              <Text style={s.sectionLink}>Book Now →</Text>
            </TouchableOpacity>
          </View>

          <View style={s.serviceGrid}>
            {QUICK_SERVICES.map((svc) => (
              <TouchableOpacity
                key={svc.id}
                style={s.serviceCard}
                onPress={() => navigation.navigate('Book')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${svc.name}, $${svc.price}`}
              >
                <View style={s.serviceCardAccent} />
                <View style={s.serviceIconWrap}>
                  <Ionicons name={svc.iconName} size={22} color={C.gold} />
                </View>
                <Text style={s.serviceName}>{svc.name}</Text>
                <Text style={s.serviceDuration}>{svc.duration}</Text>
                <Text style={s.servicePrice}>${svc.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Why 613 ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>WHY 613</Text>
          <View style={s.featureCard}>
            <View style={s.featureCardAccent} />
            {[
              { icon: 'ribbon-outline' as const,    text: 'Premium cuts by experienced barbers' },
              { icon: 'shield-checkmark-outline' as const, text: 'Hygienic tools, cleaned between every client' },
              { icon: 'flash-outline' as const,     text: 'No wait — book your exact time slot' },
              { icon: 'heart-outline' as const,     text: 'Loyal clients get priority booking' },
            ].map(({ icon, text }) => (
              <View key={text} style={s.featureRow}>
                <View style={s.featureIconWrap}>
                  <Ionicons name={icon} size={18} color={C.gold} />
                </View>
                <Text style={s.featureText}>{text}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.footer}>613 Barbershop · Ottawa, ON</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 18, paddingTop: 4 },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 36,
    position: 'relative',
  },
  heroRing: {
    position: 'absolute',
    width: SW * 1.4,
    height: SW * 1.4,
    borderRadius: SW * 0.7,
    borderWidth: 1,
    borderColor: C.goldBorder,
    top: -SW * 0.55,
  },
  greeting:  { fontSize: 16, color: C.sub, marginBottom: 4 },
  heroName:  { fontSize: 36, fontWeight: '900', color: C.white, letterSpacing: -0.5, marginBottom: 6 },
  heroSub:   { fontSize: 14, color: C.gold, letterSpacing: 1, marginBottom: 28 },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  heroBtnText: { fontSize: 15, fontWeight: '800', color: C.bg, letterSpacing: 0.5 },

  // Next appointment / CTA (Priority 1)
  nextSection: { marginBottom: 22 },
  nextLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  nextLoadingText: { fontSize: 13, color: C.muted },

  nextCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  nextCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.gold,
  },
  nextCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextEyebrow: { fontSize: 10, color: C.muted, fontWeight: '800', letterSpacing: 1.5 },
  nextPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  nextPillText: { fontSize: 10, fontWeight: '800' },
  nextService: { fontSize: 20, fontWeight: '900', color: C.white, marginBottom: 8 },
  nextMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nextMetaText: { fontSize: 13, color: C.sub },
  nextDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
    gap: 6,
  },
  nextDetailsBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },

  ctaCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 20,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  ctaCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.gold,
  },
  ctaTitle:  { fontSize: 18, fontWeight: '900', color: C.white, marginBottom: 6, textAlign: 'center' },
  ctaSub:    { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.gold,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  ctaBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },

  // Info strip
  infoStrip: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
    paddingVertical: 16,
    marginBottom: 28,
  },
  infoItem:    { flex: 1, alignItems: 'center', gap: 4 },
  infoDivider: { width: 1, backgroundColor: C.divider },
  infoLabel:   { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  infoValue:   { fontSize: 12, color: C.white, fontWeight: '700' },

  // Section
  section:       { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { fontSize: 11, color: C.muted, fontWeight: '800', letterSpacing: 2 },
  sectionLink:   { fontSize: 12, color: C.gold, fontWeight: '700' },

  // Service grid
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: (SW - 48) / 2,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    padding: 14,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: C.gold },
  serviceIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  serviceName:     { fontSize: 14, fontWeight: '800', color: C.white, marginBottom: 2 },
  serviceDuration: { fontSize: 11, color: C.sub, marginBottom: 8 },
  servicePrice:    { fontSize: 20, fontWeight: '900', color: C.gold },

  // Feature card
  featureCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
    overflow: 'hidden',
    padding: 16,
    gap: 14,
  },
  featureCardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: C.gold },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  featureText: { flex: 1, fontSize: 13, color: C.sub, lineHeight: 18 },

  footer: { fontSize: 11, color: C.muted, textAlign: 'center', marginBottom: 8 },
});
