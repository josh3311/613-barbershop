import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { theme } from '../../theme';

interface Stats {
  total:     number;
  pending:   number;
  confirmed: number;
  completed: number;
  revenue:   number;
}

export default function BarberProfileScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    total: 0, pending: 0, confirmed: 0, completed: 0, revenue: 0,
  });

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('barberId', '==', user.id),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => d.data());
      setStats({
        total:     docs.length,
        pending:   docs.filter(d => d.status === 'pending').length,
        confirmed: docs.filter(d => d.status === 'confirmed').length,
        completed: docs.filter(d => d.status === 'completed').length,
        revenue:   docs
          .filter(d => d.status !== 'cancelled')
          .reduce((sum, d) => sum + (d.servicePrice ?? 0), 0),
      });
    });
    return () => unsub();
  }, [user?.id]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel',   style: 'cancel'                        },
      { text: 'Sign Out', style: 'destructive',
        onPress: () => signOut(auth) },
    ]);
  };

  const initial = user?.displayName?.charAt(0).toUpperCase() ?? '?';

  const STAT_CARDS = [
    { label: 'ALL',  value: stats.total,     color: theme.colors.textPrimary },
    { label: 'PEND', value: stats.pending,   color: theme.colors.warning     },
    { label: 'CONF', value: stats.confirmed, color: theme.colors.success     },
    { label: 'DONE', value: stats.completed, color: theme.colors.gold        },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageLabel}>Barber</Text>
        <Text style={styles.pageTitle}>PROFILE</Text>
      </View>

      {/* ── Avatar + Name ── */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.displayName}>
          {user?.displayName?.toUpperCase() ?? 'BARBER'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="cut-outline" size={12} color={theme.colors.gold} />
          <Text style={styles.roleText}>BARBER</Text>
        </View>
      </View>

      {/* ── Stats ── */}
      <Text style={styles.sectionTitle}>BOOKINGS</Text>
      <View style={styles.statsGrid}>
        {STAT_CARDS.map(card => (
          <View key={card.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: card.color }]}>
              {card.value}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1}>
              {card.label}
            </Text>
          </View>
        ))}
      </View>

      {/* ── Revenue card ── */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueIcon}>
          <Ionicons name="cash-outline" size={22} color={theme.colors.gold} />
        </View>
        <View style={styles.revenueMid}>
          {/* No numberOfLines — let the text breathe */}
          <Text style={styles.revenueLabel}>REVENUE</Text>
          <Text style={styles.revenueNote}>All non-cancelled</Text>
        </View>
        <Text style={styles.revenueValue}>${stats.revenue}</Text>
      </View>

      {/* ── Account info ── */}
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
            <Text style={styles.infoValue}>Barber</Text>
          </View>
        </View>

      </View>

      {/* ── App info ── */}
      <Text style={styles.sectionTitle}>APP</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>VERSION</Text>
            <Text style={styles.infoValue}>613 Barbershop v2.0</Text>
          </View>
        </View>
      </View>

      {/* ── Sign Out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  pageLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  pageTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.gold,
  },
  avatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: 40,
    color: theme.colors.textInverse,
  },
  displayName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
    marginTop: theme.spacing.xs,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  roleBadge: {
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
  roleText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  statValue: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
  },
  statLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Revenue card ──────────────────────────────────────────────
  revenueCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.gold,
  },
  revenueIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  revenueMid: {
    flex: 1,
  },
  revenueLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  revenueNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  revenueValue: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
    flexShrink: 0,
  },

  // ── Info card ─────────────────────────────────────────────────
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

  // ── Sign out ──────────────────────────────────────────────────
  signOutBtn: {
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
  signOutText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.error,
    letterSpacing: 3,
  },
});