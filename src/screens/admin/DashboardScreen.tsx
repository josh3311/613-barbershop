import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import {
  collection, query, onSnapshot, orderBy,
  where, updateDoc, doc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking, User } from '../../types';
import { theme } from '../../theme';

interface PendingBarber {
  id:          string;
  displayName: string;
  email:       string;
  status?:     string;
}

interface BarberStats {
  name:     string;
  today:    number;
  week:     number;
  month:    number;
  bookings: number;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [bookings,  setBookings]  = useState<Booking[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'barbers' | 'bookings' | 'profile'>('overview');
  const [pendingBarbers, setPendingBarbers] = useState<PendingBarber[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      orderBy('scheduledAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Pending barber subscriptions: treat missing status as pending ──
  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('role', '==', 'barber'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: PendingBarber[] = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Partial<User> & { status?: string }) }))
        .filter(u => !u.status || u.status === 'pending')
        .map(u => ({
          id:          u.id,
          displayName: u.displayName ?? '—',
          email:       u.email ?? '—',
          status:      u.status,
        }));
      setPendingBarbers(list);
    });
    return () => unsub();
  }, []);

  const handleApprove = async (barberId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, barberId), { status: 'active' });
    } catch (e) {
      // swallow — onSnapshot will reflect server state
    }
  };

  const handleDecline = async (barberId: string) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, barberId), { status: 'declined' });
    } catch (e) {
      // swallow — onSnapshot will reflect server state
    }
  };

  // ── Date helpers ──
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const nonCancelled = bookings.filter(b => b.status !== 'cancelled');

  const todayBookings = nonCancelled.filter(b => b.scheduledAt >= todayStart);
  const weekBookings  = nonCancelled.filter(b => b.scheduledAt >= weekStart);
  const monthBookings = nonCancelled.filter(b => b.scheduledAt >= monthStart);

  const totalRevenue = (list: Booking[]) =>
    list.reduce((sum, b) => sum + (b.servicePrice ?? 0), 0);

  // ── Barber breakdown — grouped by name so old bookings with stale
  //    barberIds for the same barber merge into a single row ──
  const barberStats = (): BarberStats[] => {
    const map = new Map<string, BarberStats>();
    nonCancelled.forEach(b => {
      if (!b.barberName) return;
      if (!map.has(b.barberName)) {
        map.set(b.barberName, {
          name: b.barberName,
          today: 0, week: 0, month: 0, bookings: 0,
        });
      }
      const s = map.get(b.barberName)!;
      s.bookings += 1;
      if (b.scheduledAt >= todayStart) s.today += b.servicePrice ?? 0;
      if (b.scheduledAt >= weekStart)  s.week  += b.servicePrice ?? 0;
      if (b.scheduledAt >= monthStart) s.month += b.servicePrice ?? 0;
    });
    return Array.from(map.values()).sort((a, b) => b.month - a.month);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':   return theme.colors.warning;
      case 'confirmed': return theme.colors.success;
      case 'completed': return theme.colors.gold;
      case 'cancelled': return theme.colors.error;
      default:          return theme.colors.textMuted;
    }
  };

  const TABS = ['overview', 'barbers', 'bookings', 'profile'] as const;

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Panel</Text>
          <Text style={styles.name}>613{'\n'}BARBERSHOP</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut(auth)}>
          <Ionicons name="log-out-outline" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[styles.tabText, activeTab === tab && styles.tabTextActive]}
              numberOfLines={1}
            >
              {tab.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} size="large" style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ════════ OVERVIEW TAB ════════ */}
          {activeTab === 'overview' && (
            <>
              <Text style={styles.sectionTitle}>REVENUE</Text>
              <View style={styles.statsGrid}>

                {/* TODAY */}
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>TODAY</Text>
                  <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
                    ${totalRevenue(todayBookings)}
                  </Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {todayBookings.length} bookings
                  </Text>
                </View>

                {/* THIS WEEK */}
                <View style={[styles.statCard, styles.statCardGold]}>
                  <Text style={[styles.statLabel, { color: theme.colors.goldDark }]}>
                    THIS{'\n'}WEEK
                  </Text>
                  <Text
                    style={[styles.statValue, { color: theme.colors.gold }]}
                    adjustsFontSizeToFit
                    numberOfLines={1}
                  >
                    ${totalRevenue(weekBookings)}
                  </Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {weekBookings.length} bookings
                  </Text>
                </View>

                {/* MONTH — removed "THIS" so the word never breaks */}
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>MONTH</Text>
                  <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
                    ${totalRevenue(monthBookings)}
                  </Text>
                  <Text style={styles.statSub} numberOfLines={1}>
                    {monthBookings.length} bookings
                  </Text>
                </View>

              </View>

              <Text style={styles.sectionTitle}>BOOKING STATUS</Text>
              <View style={styles.statusGrid}>
                {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map(status => {
                  const count = bookings.filter(b => b.status === status).length;
                  return (
                    <View key={status} style={styles.statusCard}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(status) }]} />
                      <Text style={styles.statusCount}>{count}</Text>
                      <Text style={styles.statusLabel} numberOfLines={1} adjustsFontSizeToFit>
                        {status.toUpperCase()}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* ════════ BARBERS TAB ════════ */}
          {activeTab === 'barbers' && (
            <>
              <Text style={styles.sectionTitle}>BARBER EARNINGS</Text>
              {barberStats().map(barber => (
                <View key={barber.name} style={styles.barberCard}>
                  <View style={styles.barberHeader}>
                    <View style={styles.barberAvatar}>
                      <Text style={styles.barberAvatarText}>
                        {barber.name?.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.barberInfo}>
                      <Text style={styles.barberName}>{barber.name?.toUpperCase()}</Text>
                      <Text style={styles.barberBookings}>{barber.bookings} total bookings</Text>
                    </View>
                  </View>
                  <View style={styles.earningsRow}>
                    <View style={styles.earningItem}>
                      <Text style={styles.earningLabel}>TODAY</Text>
                      <Text style={styles.earningValue}>${barber.today}</Text>
                    </View>
                    <View style={styles.earningItem}>
                      <Text style={styles.earningLabel}>WEEK</Text>
                      <Text style={[styles.earningValue, { color: theme.colors.gold }]}>
                        ${barber.week}
                      </Text>
                    </View>
                    <View style={styles.earningItem}>
                      <Text style={styles.earningLabel}>MONTH</Text>
                      <Text style={styles.earningValue}>${barber.month}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ════════ BOOKINGS TAB ════════ */}
          {activeTab === 'bookings' && (
            <>
              <Text style={styles.sectionTitle}>ALL BOOKINGS ({bookings.length})</Text>
              {bookings.slice(0, 20).map(booking => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingLeft}>
                    <Text style={styles.bookingClient}>{booking.clientName}</Text>
                    <Text style={styles.bookingService}>
                      {booking.serviceName} · {booking.barberName}
                    </Text>
                    <Text style={styles.bookingDate}>
                      {booking.scheduledAt?.toLocaleDateString([], {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })} · {booking.scheduledAt?.toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.bookingRight}>
                    <Text style={styles.bookingPrice}>${booking.servicePrice}</Text>
                    <View style={[styles.statusPill, { borderColor: getStatusColor(booking.status) }]}>
                      <Text style={[styles.statusPillText, { color: getStatusColor(booking.status) }]}>
                        {booking.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ════════ PROFILE TAB ════════ */}
          {activeTab === 'profile' && (
            <>
              {/* Avatar + name + role badge */}
              <View style={styles.profileHeader}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>
                    {user?.displayName?.charAt(0).toUpperCase() ?? 'A'}
                  </Text>
                </View>
                <Text style={styles.profileName}>
                  {user?.displayName?.toUpperCase() ?? 'ADMIN'}
                </Text>
                <Text style={styles.profileEmail}>{user?.email ?? '—'}</Text>
                <View style={styles.adminBadge}>
                  <Ionicons name="shield-checkmark" size={12} color={theme.colors.gold} />
                  <Text style={styles.adminBadgeText}>ADMIN</Text>
                </View>
              </View>

              {/* Account info */}
              <Text style={styles.sectionTitle}>ACCOUNT</Text>
              <View style={styles.infoCard}>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="person-outline" size={18} color={theme.colors.gold} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>DISPLAY NAME</Text>
                    <Text style={styles.infoValue}>{user?.displayName ?? '—'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="mail-outline" size={18} color={theme.colors.gold} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>EMAIL</Text>
                    <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
                  </View>
                </View>

                <View style={styles.infoDivider} />

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.gold} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>ROLE</Text>
                    <Text style={styles.infoValue}>Admin</Text>
                  </View>
                </View>

              </View>

              {/* Pending barbers */}
              <Text style={styles.sectionTitle}>
                PENDING BARBERS ({pendingBarbers.length})
              </Text>
              {pendingBarbers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.emptyText}>No pending approvals</Text>
                </View>
              ) : (
                pendingBarbers.map(b => (
                  <View key={b.id} style={styles.pendingCard}>
                    <View style={styles.pendingHeader}>
                      <View style={styles.pendingAvatar}>
                        <Text style={styles.pendingAvatarText}>
                          {b.displayName?.charAt(0).toUpperCase() ?? '?'}
                        </Text>
                      </View>
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingName}>
                          {b.displayName?.toUpperCase()}
                        </Text>
                        <Text style={styles.pendingEmail}>{b.email}</Text>
                      </View>
                    </View>
                    <View style={styles.pendingActions}>
                      <TouchableOpacity
                        style={[styles.pendingBtn, styles.declineBtn]}
                        onPress={() => handleDecline(b.id)}
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={theme.colors.error}
                        />
                        <Text style={styles.declineBtnText}>DECLINE</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pendingBtn, styles.approveBtn]}
                        onPress={() => handleApprove(b.id)}
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={theme.colors.textInverse}
                        />
                        <Text style={styles.approveBtnText}>APPROVE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Sign out */}
              <TouchableOpacity
                style={styles.profileSignOutBtn}
                onPress={() => signOut(auth)}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                <Text style={styles.profileSignOutText}>SIGN OUT</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  signOutBtn: {
    padding: theme.spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.goldMuted,
    borderColor: theme.colors.gold,
  },
  tabText: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: theme.colors.gold,
  },
  loader: {
    flex: 1,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingTop: 0,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginTop: theme.spacing.sm,
  },

  // ── Revenue cards ──
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  statCardGold: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  statLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 14,
  },
  statValue: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  statSub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── Booking status ──
  statusGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusCount: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
  },
  statusLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 8,
    color: theme.colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
  },

  // ── Barber card ──
  barberCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  barberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  barberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barberAvatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textInverse,
  },
  barberInfo: {
    flex: 1,
  },
  barberName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  barberBookings: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  earningsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  earningValue: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    marginTop: 2,
  },

  // ── Booking card ──
  bookingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  bookingLeft: {
    flex: 1,
    gap: 2,
  },
  bookingClient: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  bookingService: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  bookingDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  bookingRight: {
    alignItems: 'flex-end',
    gap: theme.spacing.xs,
  },
  bookingPrice: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  statusPillText: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    letterSpacing: 1,
  },

  // ── Profile tab ──────────────────────────────────────────────
  profileHeader: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.gold,
  },
  profileAvatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: 40,
    color: theme.colors.textInverse,
  },
  profileName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
    marginTop: theme.spacing.xs,
  },
  profileEmail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.md,
    marginTop: 4,
  },
  adminBadgeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  infoValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.lg + 36,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  pendingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  pendingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingAvatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  pendingEmail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  pendingBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  declineBtn: {
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderColor: theme.colors.error,
  },
  declineBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.error,
    letterSpacing: 2,
  },
  approveBtn: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
    ...theme.shadows.gold,
  },
  approveBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
  profileSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  profileSignOutText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.error,
    letterSpacing: 3,
  },
});