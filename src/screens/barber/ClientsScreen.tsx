import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, StatusBar, TextInput, RefreshControl,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarberTabParamList } from '@/navigation/types';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import { Booking } from '@/types/booking.types';

type Props = BottomTabScreenProps<BarberTabParamList, 'Clients'>;

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:         '#0A0A0A',
  card:       '#161616',
  elevated:   '#1E1E1E',
  gold:       '#D4AF37',
  goldGlow:   '#D4AF3715',
  goldBorder: '#D4AF3730',
  white:      '#FFFFFF',
  sub:        '#666666',
  muted:      '#333333',
  divider:    '#1A1A1A',
  inputBg:    '#141414',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientSummary {
  clientId:    string;
  clientName:  string;
  visits:      number;
  totalSpent:  number;
  lastVisit:   Date;
  favService:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade', s2: 'Lineup', s3: 'Beard Trim', s4: 'Haircut', s5: 'Beard + Cut',
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function deriveClients(bookings: Booking[]): ClientSummary[] {
  const map = new Map<string, ClientSummary>();

  for (const b of bookings) {
    // Only count non-cancelled bookings
    if (b.status === 'cancelled' || b.status === 'no_show') continue;

    const existing = map.get(b.clientId);
    const visitDate = b.scheduledAt.toDate();
    const svcName = SERVICE_NAMES[b.serviceId] ?? b.serviceId;

    if (!existing) {
      map.set(b.clientId, {
        clientId:   b.clientId,
        clientName: b.clientName ?? b.clientId.substring(0, 8),
        visits:     1,
        totalSpent: b.price,
        lastVisit:  visitDate,
        favService: svcName,
      });
    } else {
      existing.visits    += 1;
      existing.totalSpent += b.price;
      if (visitDate > existing.lastVisit) {
        existing.lastVisit = visitDate;
      }
      // Fav service = most recently booked service (simplistic)
      existing.favService = svcName;
    }
  }

  // Sort by last visit (most recent first)
  return Array.from(map.values()).sort(
    (a, b) => b.lastVisit.getTime() - a.lastVisit.getTime(),
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ClientsScreen(_: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!firebaseUser) return;
    if (isRefresh) setRefreshing(true);
    const res = await BookingService.getByBarber(firebaseUser.uid);
    if (res.success) setBookings(res.data);
    setLoading(false);
    setRefreshing(false);
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  // ── Derive clients from bookings ───────────────────────────────────────────
  const clients = useMemo(() => deriveClients(bookings), [bookings]);

  const filtered = useMemo(() =>
    search.trim()
      ? clients.filter(c =>
          c.clientName.toLowerCase().includes(search.toLowerCase()) ||
          c.favService.toLowerCase().includes(search.toLowerCase()),
        )
      : clients,
  [clients, search]);

  const totalVisits  = clients.reduce((s, c) => s + c.visits,     0);
  const totalEarned  = clients.reduce((s, c) => s + c.totalSpent, 0);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator size={32} color={C.gold} />
        <Text style={s.loadingText}>Loading clients…</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerEyebrow}>MY CLIENTS</Text>
          <Text style={s.headerTitle}>Client Book</Text>
        </View>
        {clients.length > 0 && (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{clients.length} client{clients.length !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
      <View style={s.headerLine} />

      {/* Stats — only when there are clients */}
      {clients.length > 0 && (
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="people-outline" size={18} color={C.gold} />
            <Text style={s.statValue}>{clients.length}</Text>
            <Text style={s.statLabel}>Clients</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="repeat-outline" size={18} color={C.gold} />
            <Text style={s.statValue}>{totalVisits}</Text>
            <Text style={s.statLabel}>Total Visits</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="cash-outline" size={18} color={C.gold} />
            <Text style={s.statValue}>${totalEarned}</Text>
            <Text style={s.statLabel}>Total Earned</Text>
          </View>
        </View>
      )}

      {/* Search */}
      {clients.length > 0 && (
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={C.sub} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search clients or services…"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            accessibilityLabel="Search clients"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={16} color={C.sub} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Client list */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.clientId}
        contentContainerStyle={[
          s.scroll,
          filtered.length === 0 && s.scrollEmpty,
          { paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.gold}
            colors={[C.gold]}
          />
        }
        ListEmptyComponent={
          search.trim() ? (
            <View style={s.emptyWrap}>
              <Ionicons name="search-outline" size={40} color={C.muted} />
              <Text style={s.emptyTitle}>No results</Text>
              <Text style={s.emptySub}>No clients match "{search}"</Text>
            </View>
          ) : (
            <View style={s.emptyWrap}>
              <Ionicons name="people-outline" size={52} color={C.muted} />
              <Text style={s.emptyTitle}>No clients yet</Text>
              <Text style={s.emptySub}>
                Your client list builds automatically as bookings are confirmed and completed.
              </Text>
            </View>
          )
        }
        renderItem={({ item: client }) => (
          <View style={s.clientCard}>
            {/* Avatar */}
            <View style={s.avatar}>
              <Text style={s.avatarText}>{getInitials(client.clientName)}</Text>
            </View>

            {/* Info */}
            <View style={s.clientInfo}>
              <Text style={s.clientName}>{client.clientName}</Text>
              <Text style={s.clientSub}>
                Fav: {client.favService}
                {'  ·  '}
                Last: {formatDate(client.lastVisit)}
              </Text>
            </View>

            {/* Stats */}
            <View style={s.clientStats}>
              <Text style={s.clientVisits}>{client.visits}x</Text>
              <Text style={s.clientSpent}>${client.totalSpent}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14 },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  scrollEmpty: { flexGrow: 1 },
  loadingText: { fontSize: 13, color: C.muted },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10,
  },
  headerEyebrow: { fontSize: 10, color: C.sub, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitle:   { fontSize: 22, fontWeight: '900', color: C.white, letterSpacing: -0.3 },
  headerLine:    { height: 1, marginHorizontal: 18, backgroundColor: C.gold, opacity: 0.15, marginBottom: 12 },
  headerBadge: {
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  headerBadgeText: { fontSize: 12, fontWeight: '700', color: C.gold },

  // Stats
  statsRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, marginBottom: 14,
  },
  statCard: {
    flex: 1, backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.goldBorder,
    paddingVertical: 12, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '900', color: C.white },
  statLabel: { fontSize: 9, color: C.sub, fontWeight: '700', letterSpacing: 0.5 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, borderWidth: 1, borderColor: C.divider,
    paddingHorizontal: 14, height: 44,
  },
  searchInput: { flex: 1, color: C.white, fontSize: 14 },

  // Client card
  clientCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.divider,
    padding: 14, marginBottom: 8, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: C.goldGlow, borderWidth: 1.5, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:   { fontSize: 14, fontWeight: '900', color: C.gold },
  clientInfo:   { flex: 1 },
  clientName:   { fontSize: 14, fontWeight: '800', color: C.white, marginBottom: 3 },
  clientSub:    { fontSize: 11, color: C.sub },
  clientStats:  { alignItems: 'flex-end', gap: 2 },
  clientVisits: { fontSize: 12, fontWeight: '800', color: C.gold },
  clientSpent:  { fontSize: 11, color: C.sub },

  // Empty
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12, paddingTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.white, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: C.sub, textAlign: 'center', lineHeight: 18 },
});
