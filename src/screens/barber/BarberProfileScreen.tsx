import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:          '#0A0A0A',
  surface:     '#111111',
  card:        '#161616',
  elevated:    '#1E1E1E',
  gold:        '#D4AF37',
  goldGlow:    '#D4AF3715',
  goldBorder:  '#D4AF3740',
  steel:       '#9E9E9E',
  steelGlow:   '#9E9E9E12',
  steelBorder: '#9E9E9E35',
  danger:      '#CF6679',
  dangerBg:    '#1A0A0A',
  dangerBdr:   '#CF667944',
  white:       '#FFFFFF',
  sub:         '#777777',
  muted:       '#444444',
  divider:     '#1C1C1C',
  icon:        '#666666',
} as const;

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  iconName, label, value, valueColor,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}): React.JSX.Element {
  return (
    <View style={s.infoRow} accessibilityLabel={`${label}: ${value}`}>
      <View style={s.infoIconWrap}>
        <Ionicons name={iconName} size={18} color={C.icon} />
      </View>
      <View style={s.infoText}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BarberProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser, appUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = appUser?.displayName ?? firebaseUser?.displayName ?? 'Barber';
  const email       = appUser?.email ?? firebaseUser?.email ?? '—';
  const role        = appUser?.role ?? '—';
  const initials    = getInitials(displayName);
  const isOwner     = role === 'admin';
  const memberSince = firebaseUser?.metadata?.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  async function handleLogout(): Promise<void> {
    if (loggingOut) return;
    setLoggingOut(true);
    await AuthService.logout();
    setLoggingOut(false);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={s.headerBar} accessibilityRole="header">
        <Text style={s.headerTitle}>My Profile</Text>
        <Text style={s.headerSub}>613 BARBERSHOP</Text>
      </View>
      <View style={s.headerLine} />

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar card ── */}
        <View style={s.avatarCard}>
          <View style={s.avatarCardAccent} />

          <View style={s.avatarOuter}>
            <View style={s.avatarInner}>
              <Text style={s.avatarInitials}>{initials}</Text>
            </View>
          </View>

          <Text style={s.displayName}>{displayName}</Text>

          <View style={s.rolePill}>
            <Ionicons
              name={isOwner ? 'shield-checkmark-outline' : 'cut-outline'}
              size={12}
              color={isOwner ? C.gold : C.steel}
            />
            <Text style={[s.rolePillText, isOwner && { color: C.gold }]}>
              {isOwner ? 'SHOP OWNER' : 'BARBER'}
            </Text>
          </View>

          <Text style={s.memberSince}>Member since {memberSince}</Text>
        </View>

        {/* ── Account info ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT INFO</Text>
          <View style={s.card}>
            <InfoRow iconName="mail-outline"           label="Email"   value={email} />
            <View style={s.divider} />
            <InfoRow iconName="key-outline"            label="User ID" value={(firebaseUser?.uid?.slice(0, 18) ?? '—') + '…'} />
            <View style={s.divider} />
            <InfoRow iconName="shield-checkmark-outline" label="Role"  value={role} valueColor={C.gold} />
          </View>
        </View>

        {/* ── Account actions ── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ACCOUNT</Text>
          <View style={s.card}>
            <TouchableOpacity
              style={s.actionRow}
              accessibilityRole="button"
              accessibilityLabel="Change password"
            >
              <View style={s.actionLeft}>
                <View style={s.actionIconWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={C.gold} />
                </View>
                <Text style={s.actionLabel}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout ── */}
        <View style={s.section}>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={[s.logoutBtn, loggingOut && s.logoutBtnBusy]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ busy: loggingOut }}
          >
            {loggingOut ? (
              <ActivityIndicator size={18} color={C.danger} />
            ) : (
              <Ionicons name="log-out-outline" size={20} color={C.danger} />
            )}
            <Text style={s.logoutText}>{loggingOut ? 'Signing out…' : 'Log Out'}</Text>
          </TouchableOpacity>
          <Text style={s.logoutHint}>You'll return to the role selection screen</Text>
        </View>

        <Text style={s.version}>613 Barbershop · Barber Portal · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  headerBar: { paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 10, color: C.gold, letterSpacing: 3, fontWeight: '700', marginTop: 2 },
  headerLine:  { height: 1, marginHorizontal: 20, backgroundColor: C.gold, opacity: 0.2, marginBottom: 8 },

  // Avatar card
  avatarCard: {
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 18, borderWidth: 1, borderColor: C.goldBorder,
    overflow: 'hidden', paddingBottom: 24,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  avatarCardAccent: { height: 4, width: '100%', backgroundColor: C.steel, marginBottom: 24 },
  avatarOuter: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: C.elevated, borderWidth: 2, borderColor: C.steelBorder,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: C.steel, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  avatarInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.steelGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.steelBorder,
  },
  avatarInitials: { fontSize: 26, fontWeight: '900', color: C.steel },
  displayName:    { fontSize: 21, fontWeight: '800', color: C.white, marginBottom: 10 },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.steelGlow, borderRadius: 20,
    borderWidth: 1, borderColor: C.steelBorder,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10,
  },
  rolePillText:  { fontSize: 10, fontWeight: '800', color: C.steel, letterSpacing: 2 },
  memberSince:   { fontSize: 12, color: C.sub },

  // Sections
  section:      { marginTop: 22 },
  sectionLabel: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.divider, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  divider: { height: 1, backgroundColor: C.divider, marginHorizontal: 16 },

  infoRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.elevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A2A', flexShrink: 0,
  },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  infoValue: { fontSize: 14, color: C.white, fontWeight: '600' },

  // Action rows
  actionRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  actionLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.goldGlow, borderWidth: 1, borderColor: C.goldBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionLabel: { fontSize: 14, color: C.white, fontWeight: '600' },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerBg, borderWidth: 1.5, borderColor: C.dangerBdr,
    borderRadius: 14, paddingVertical: 16,
  },
  logoutBtnBusy: { opacity: 0.65 },
  logoutText:    { fontSize: 16, fontWeight: '800', color: C.danger, letterSpacing: 0.5 },
  logoutHint:    { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },

  version: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 32 },
});
