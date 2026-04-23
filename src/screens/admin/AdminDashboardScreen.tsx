import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useAdminToday } from '@/context/AdminTodayContext';
import { AdminStackParamList } from '@/navigation/types';
import { Booking } from '@/types/booking.types';
import { Barber } from '@/types/barber.types';
import { BookingService } from '@/services/booking.service';

const C = {
  bg:     '#0A0A0A',
  card:   '#141414',
  border: '#252525',
  gold:   '#D4AF37',
  white:  '#FFFFFF',
  sub:    '#666666',
  muted:  '#444444',
  green:  '#4CAF50',
  red:    '#FF4444',
  grey:   '#666666',
} as const;

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Haircut',
};

function greetingPeriod(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function firstName(displayName: string | null | undefined): string {
  const t = displayName?.trim();
  if (!t) return 'Amir';
  return t.split(/\s+/)[0] ?? 'Amir';
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface BarberTodayStats {
  barberId: string;
  displayName: string;
  bookingsToday: number;
  earningsToday: number;
  rating: number;
  reviewCount: number;
}

function buildBarberOverview(
  bookings: Booking[],
  barbersById: Map<string, Barber>,
): BarberTodayStats[] {
  const map = new Map<string, BarberTodayStats>();

  for (const [id, barber] of barbersById) {
    map.set(id, {
      barberId: id,
      displayName: barber.displayName,
      bookingsToday: 0,
      earningsToday: 0,
      rating: typeof barber.rating === 'number' ? barber.rating : 0,
      reviewCount: typeof barber.reviewCount === 'number' ? barber.reviewCount : 0,
    });
  }

  for (const b of bookings) {
    let row = map.get(b.barberId);
    if (!row) {
      row = {
        barberId: b.barberId,
        displayName: b.barberName ?? 'Barber',
        bookingsToday: 0,
        earningsToday: 0,
        rating: 0,
        reviewCount: 0,
      };
      map.set(b.barberId, row);
    }
    row.bookingsToday += 1;
    if (b.status === 'completed') {
      row.earningsToday += typeof b.price === 'number' ? b.price : 0;
    }
    const barberDoc = barbersById.get(b.barberId);
    if (barberDoc) {
      row.displayName = barberDoc.displayName;
      row.rating = typeof barberDoc.rating === 'number' ? barberDoc.rating : 0;
      row.reviewCount =
        typeof barberDoc.reviewCount === 'number' ? barberDoc.reviewCount : 0;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

function Skeleton(): React.JSX.Element {
  return (
    <View style={sk.root}>
      <View style={sk.header} />
      <View style={sk.row3}>
        <View style={sk.card} />
        <View style={sk.card} />
        <View style={sk.card} />
      </View>
      <View style={sk.badges} />
      <View style={sk.long} />
      <View style={sk.long} />
    </View>
  );
}

const sk = StyleSheet.create({
  root:   { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  header: { height: 52, borderRadius: 10, backgroundColor: '#1A1A1A' },
  row3:   { flexDirection: 'row', gap: 8 },
  card:   { flex: 1, height: 88, borderRadius: 12, backgroundColor: '#1A1A1A' },
  badges: { height: 36, borderRadius: 10, backgroundColor: '#1A1A1A' },
  long:   { height: 72, borderRadius: 12, backgroundColor: '#1A1A1A' },
});

export default function AdminDashboardScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<AdminStackParamList>>();
  const { appUser } = useAuth();
  const { todayBookings, barbersById, loading, error } = useAdminToday();
  const [backfillBusy, setBackfillBusy] = useState(false);

  const stats = useMemo(() => {
    const total = todayBookings.length;
    const revenue = todayBookings.reduce((sum, b) => {
      if (b.status === 'completed') {
        return sum + (typeof b.price === 'number' ? b.price : 0);
      }
      return sum;
    }, 0);
    const pending = todayBookings.filter((b) => b.status === 'pending').length;
    const confirmed = todayBookings.filter((b) => b.status === 'confirmed')
      .length;
    const completed = todayBookings.filter((b) => b.status === 'completed')
      .length;
    const declined = todayBookings.filter((b) => b.status === 'declined').length;
    return {
      total,
      revenue,
      pending,
      confirmed,
      completed,
      declined,
    };
  }, [todayBookings]);

  const barberRows = useMemo(
    () => buildBarberOverview(todayBookings, barbersById),
    [todayBookings, barbersById],
  );

  const greet = greetingPeriod();
  const ownerName = firstName(appUser?.displayName);

  async function handleBackfillLoyalty(): Promise<void> {
    if (backfillBusy) return;
    const msg =
      'Award loyalty stamps for all completed bookings that are not marked loyaltyAwarded yet? ' +
      'Run once after fixing Firestore rules.';
    const go =
      Platform.OS === 'web'
        ? window.confirm(msg)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Backfill loyalty', msg, [
              { text: 'Cancel', onPress: () => resolve(false) },
              { text: 'Run', onPress: () => resolve(true) },
            ]);
          });
    if (!go) return;
    setBackfillBusy(true);
    try {
      const res = await BookingService.backfillLoyaltyForCompletedBookings();
      if (!res.success) {
        const err = res.error ?? 'Unknown error';
        if (Platform.OS === 'web') window.alert(err);
        else Alert.alert('Backfill failed', err);
        return;
      }
      const { processed, skipped, errors } = res.data;
      const detail =
        `Processed: ${processed}\nAlready stamped: ${skipped}` +
        (errors.length ? `\nIssues:\n${errors.slice(0, 8).join('\n')}` : '');
      if (Platform.OS === 'web') window.alert(detail);
      else Alert.alert('Backfill loyalty', detail);
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      if (Platform.OS === 'web') window.alert(err);
      else Alert.alert('Backfill failed', err);
    } finally {
      setBackfillBusy(false);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.greeting}>
          Good {greet}, {ownerName}
        </Text>
        <Text style={s.dateLine}>{formatTodayLong()}</Text>

        {error ? (
          <View style={s.errBanner}>
            <Ionicons name="warning-outline" size={18} color={C.red} />
            <Text style={s.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <Skeleton />
        ) : (
          <>
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statVal}>{stats.total}</Text>
                <Text style={s.statLabel}>Bookings today</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>${stats.revenue.toFixed(0)}</Text>
                <Text style={s.statLabel}>Revenue today</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>{stats.pending}</Text>
                <Text style={s.statLabel}>Pending</Text>
              </View>
            </View>

            <Text style={s.sectionLabel}>Status today</Text>
            <View style={s.badgeRow}>
              <View style={[s.badge, { borderColor: C.green + '50' }]}>
                <Text style={[s.badgeText, { color: C.green }]}>
                  Confirmed {stats.confirmed}
                </Text>
              </View>
              <View style={[s.badge, { borderColor: C.grey + '50' }]}>
                <Text style={[s.badgeText, { color: C.grey }]}>
                  Completed {stats.completed}
                </Text>
              </View>
              <View style={[s.badge, { borderColor: C.red + '50' }]}>
                <Text style={[s.badgeText, { color: C.red }]}>
                  Declined {stats.declined}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.backfillBtn}
              onPress={() => void handleBackfillLoyalty()}
              disabled={backfillBusy}
              accessibilityRole="button"
              accessibilityLabel="Backfill loyalty stamps for completed bookings"
            >
              {backfillBusy ? (
                <ActivityIndicator color={C.gold} />
              ) : (
                <Text style={s.backfillBtnText}>Backfill loyalty</Text>
              )}
            </TouchableOpacity>

            <Text style={s.sectionLabel}>Barbers</Text>
            {barberRows.length === 0 ? (
              <Text style={s.empty}>No bookings scheduled for today.</Text>
            ) : (
              barberRows.map((row) => (
                <TouchableOpacity
                  key={row.barberId}
                  style={s.barberCard}
                  onPress={() =>
                    navigation.navigate('BarberTodaySchedule', {
                      barberId: row.barberId,
                      barberName: row.displayName,
                    })
                  }
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.displayName} schedule for today`}
                >
                  <View style={s.barberCardTop}>
                    <Ionicons name="person-outline" size={20} color={C.gold} />
                    <Text style={s.barberName}>{row.displayName}</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={C.sub}
                      style={{ marginLeft: 'auto' }}
                    />
                  </View>
                  <View style={s.barberMeta}>
                    <Text style={s.metaText}>
                      {row.bookingsToday} booking
                      {row.bookingsToday === 1 ? '' : 's'}
                    </Text>
                    <Text style={s.metaGold}>
                      ${row.earningsToday.toFixed(0)} earned today
                    </Text>
                    <Text style={s.metaGold}>
                      {row.reviewCount > 0 && row.rating > 0
                        ? `${row.rating.toFixed(1)} avg rating`
                        : 'No rating yet'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: C.white,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  dateLine: {
    fontSize: 13,
    color: C.sub,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#1A0A0A',
    borderWidth: 1,
    borderColor: C.red + '40',
  },
  errText: { flex: 1, fontSize: 13, color: C.red },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: C.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  statVal: {
    fontSize: 20,
    fontWeight: '900',
    color: C.gold,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    color: C.sub,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    color: C.muted,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  backfillBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.gold + '55',
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  backfillBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: C.gold,
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#161616',
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  empty: {
    fontSize: 14,
    color: C.sub,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  barberCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
  },
  barberCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  barberName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
    flex: 1,
  },
  barberMeta: { gap: 4, paddingLeft: 30 },
  metaText: { fontSize: 12, color: C.sub, fontWeight: '600' },
  metaGold: { fontSize: 12, color: C.gold, fontWeight: '700' },
});
