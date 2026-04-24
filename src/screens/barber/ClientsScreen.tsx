/**
 * ClientsScreen.tsx
 *
 * Redesigned clients screen with:
 * - Modern card-based layout
 * - Search functionality
 * - Stats row at top
 * - React Native Animated API animations
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Animated,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  icons,
  animations,
} from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import { Booking } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';

// ─── Theme Constants ──────────────────────────────────────────────────────────

const C = {
  bg: colors.background,
  surface: colors.surface,
  surfaceRaised: colors.surfaceRaised,
  border: colors.border,
  gold: colors.gold,
  green: colors.green,
  white: colors.white,
  grey: colors.grey,
  greyDark: colors.greyDark,
  goldGlow: colors.goldGlow,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientSummary {
  clientId: string;
  clientName: string;
  visits: number;
  totalSpent: number;
  lastVisit: Date;
  favService: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Cut',
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    const visitDate = safeToDate(b.scheduledAt);
    const svcName = SERVICE_NAMES[b.serviceId] ?? b.serviceId;

    if (!existing) {
      map.set(b.clientId, {
        clientId: b.clientId,
        clientName: b.clientName ?? b.clientId.substring(0, 8),
        visits: 1,
        totalSpent: b.price,
        lastVisit: visitDate,
        favService: svcName,
      });
    } else {
      existing.visits += 1;
      existing.totalSpent += b.price;
      if (visitDate > existing.lastVisit) {
        existing.lastVisit = visitDate;
      }
      existing.favService = svcName;
    }
  }

  // Sort by last visit (most recent first)
  return Array.from(map.values()).sort((a, b) => b.lastVisit.getTime() - a.lastVisit.getTime());
}

// ─── Stat Card Component ──────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  delay = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delay?: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <Animated.View style={[styles.statCardWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.statCard, animatedStyle]}
        activeOpacity={0.9}
      >
        <View style={styles.statIconContainer}>
          <Ionicons name={icon} size={20} color={C.gold} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Client Card Component ────────────────────────────────────────────────────

function ClientCard({
  client,
  index,
}: {
  client: ClientSummary;
  index: number;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 50;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.clientCard, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(client.clientName)}</Text>
        </View>

        {/* Info */}
        <View style={styles.clientInfo}>
          <Text style={styles.clientName} numberOfLines={1}>
            {client.clientName}
          </Text>
          <Text style={styles.clientSub}>
            Fav: {client.favService} · Last: {formatDate(client.lastVisit)}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.clientStats}>
          <View style={styles.visitBadge}>
            <Text style={styles.visitCount}>{client.visits}x</Text>
          </View>
          <Text style={styles.clientSpent}>${client.totalSpent}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ClientsScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const searchFadeAnim = useRef(new Animated.Value(0)).current;
  const searchSlideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(searchFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(searchSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!firebaseUser) return;
      if (isRefresh) setRefreshing(true);

      const res = await BookingService.getByBarber(firebaseUser.uid);
      if (res.success) setBookings(res.data);

      setLoading(false);
      setRefreshing(false);
    },
    [firebaseUser]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Derive clients from bookings
  const clients = useMemo(() => deriveClients(bookings), [bookings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    return clients.filter(
      (c) =>
        c.clientName.toLowerCase().includes(search.toLowerCase()) ||
        c.favService.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  const totalVisits = clients.reduce((s, c) => s + c.visits, 0);
  const totalEarned = clients.reduce((s, c) => s + c.totalSpent, 0);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={32} color={C.gold} />
          <Text style={styles.loadingText}>Loading clients...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
        <View>
          <Text style={styles.headerEyebrow}>MY CLIENTS</Text>
          <Text style={styles.headerTitle}>Client Book</Text>
        </View>
        {clients.length > 0 && (
          <View style={styles.clientCountBadge}>
            <Text style={styles.clientCountText}>
              {clients.length} client{clients.length !== 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Stats Row */}
      {clients.length > 0 && (
        <View style={styles.statsRow}>
          <StatCard icon={icons.peopleOutline} label="Clients" value={String(clients.length)} delay={200} />
          <StatCard icon="repeat-outline" label="Total Visits" value={String(totalVisits)} delay={300} />
          <StatCard icon="cash-outline" label="Total Earned" value={`$${totalEarned}`} delay={400} />
        </View>
      )}

      {/* Search */}
      {clients.length > 0 && (
        <Animated.View style={[styles.searchContainer, { opacity: searchFadeAnim, transform: [{ translateY: searchSlideAnim }] }]}>
          <View style={styles.searchWrap}>
            <Ionicons name={icons.search} size={18} color={C.grey} style={{ marginRight: spacing.sm }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients or services..."
              placeholderTextColor={C.greyDark}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              underlineColorAndroid="transparent"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={icons.close} size={18} color={C.grey} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Client List */}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.clientId}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} colors={[C.gold]} />
        }
        ListEmptyComponent={
          search.trim() ? (
            <View style={styles.emptyContainer}>
              <Ionicons name={icons.search} size={48} color={C.greyDark} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySubtitle}>No clients match "{search}"</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name={icons.peopleOutline} size={64} color={C.greyDark} />
              <Text style={styles.emptyTitle}>No clients yet</Text>
              <Text style={styles.emptySubtitle}>
                Your client list builds automatically as bookings are confirmed and completed.
              </Text>
            </View>
          )
        }
        renderItem={({ item, index }) => <ClientCard client={item} index={index} />}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    letterSpacing: fonts.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['3xl'],
    color: C.white,
    letterSpacing: fonts.letterSpacing.tight,
  },
  clientCountBadge: {
    backgroundColor: C.goldGlow,
    borderWidth: 1,
    borderColor: C.gold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  clientCountText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.sm,
    color: C.gold,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: C.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.white,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wider,
  },

  // Search
  searchContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: C.white,
    height: 48,
    paddingVertical: 0,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // Client Card
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: C.goldGlow,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.gold,
  },
  clientInfo: {
    flex: 1,
    minWidth: 0,
  },
  clientName: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
    marginBottom: spacing.xs,
  },
  clientSub: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
  },
  clientStats: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  visitBadge: {
    backgroundColor: C.goldGlow,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  visitCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.gold,
  },
  clientSpent: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.md,
    paddingTop: spacing['3xl'],
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xl,
    color: C.white,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    textAlign: 'center',
    lineHeight: 20,
  },
});
