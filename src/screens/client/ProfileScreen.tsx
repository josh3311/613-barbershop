import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClientTabParamList } from '@/navigation/types';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A0A0A',
  surface:      '#141414',
  card:         '#161616',
  elevated:     '#1C1C1C',
  gold:         '#D4AF37',
  goldDark:     '#A8861A',
  goldLight:    '#EDD060',
  goldGlow:     '#D4AF3715',
  goldBorder:   '#D4AF3740',
  danger:       '#CF6679',
  dangerBg:     '#2A1010',
  dangerBorder: '#CF667944',
  white:        '#FFFFFF',
  sub:          '#999999',
  muted:        '#555555',
  divider:      '#1E1E1E',
} as const;

const { width: SW } = Dimensions.get('window');

type Props = BottomTabScreenProps<ClientTabParamList, 'Profile'>;

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function InfoRow({
  iconName, label, value,
}: {
  iconName: keyof typeof Ionicons.glyphMap; label: string; value: string;
}): React.JSX.Element {
  return (
    <View style={styles.infoRow} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={iconName} size={18} color="#555555" />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = firebaseUser?.displayName ?? null;
  const email       = firebaseUser?.email ?? '—';
  const initials    = getInitials(displayName);
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
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar card ── */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCardAccent} />

          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.displayName}>{displayName ?? 'Member'}</Text>
          <Text style={styles.memberBadge}>613 BARBERSHOP MEMBER</Text>

          <View style={styles.memberSinceRow}>
            <Text style={styles.memberSinceLabel}>Member since</Text>
            <Text style={styles.memberSinceValue}>{memberSince}</Text>
          </View>
        </View>

        {/* ── Account info ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
          <View style={styles.card}>
            <InfoRow iconName="mail-outline"    label="Email"   value={email} />
            <View style={styles.cardDivider} />
            <InfoRow iconName="person-outline"  label="Name"    value={displayName ?? '—'} />
            <View style={styles.cardDivider} />
            <InfoRow iconName="key-outline"     label="User ID" value={(firebaseUser?.uid?.slice(0, 16) ?? '—') + '…'} />
          </View>
        </View>

        {/* ── Account actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              onPress={() => {}}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIconWrap, styles.actionIconGold]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#D4AF37" />
                </View>
                <Text style={styles.actionLabel}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#444444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Logout button ── */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleLogout}
            disabled={loggingOut}
            style={[styles.logoutBtn, loggingOut && styles.logoutBtnBusy]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityHint="Signs you out of 613 Barbershop"
            accessibilityState={{ busy: loggingOut, disabled: loggingOut }}
          >
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#CF6679"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.logoutText}>
              {loggingOut ? 'Signing out…' : 'Log Out'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.logoutHint}>You'll be returned to the login screen</Text>
        </View>

        <Text style={styles.version}>613 Barbershop · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 40 },

  avatarCard: {
    backgroundColor: C.card, alignItems: 'center', paddingBottom: 28,
    borderBottomWidth: 1, borderBottomColor: C.divider,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8, overflow: 'hidden',
  },
  avatarCardAccent: {
    height: 3, width: '100%', backgroundColor: C.gold, marginBottom: 32,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 6,
  },
  avatarWrap:   { position: 'relative', marginBottom: 16 },
  avatarGlow: {
    position: 'absolute', top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 55, backgroundColor: C.gold, opacity: 0.08,
  },
  avatarOuter: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.goldBorder,
    shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  avatarInner: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.goldGlow,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.gold + '55',
  },
  avatarInitials: { fontSize: 28, fontWeight: '900', color: C.gold, letterSpacing: 1 },
  displayName:    { fontSize: 22, fontWeight: '800', color: C.white, letterSpacing: 0.3, marginBottom: 4 },
  memberBadge:    { fontSize: 10, color: C.gold, letterSpacing: 2.5, fontWeight: '700', marginBottom: 14 },
  memberSinceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.elevated, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.divider,
  },
  memberSinceLabel: { fontSize: 12, color: C.sub },
  memberSinceValue: { fontSize: 12, color: C.gold, fontWeight: '700' },

  section:      { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 10 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.divider, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cardDivider: { height: 1, backgroundColor: C.divider, marginHorizontal: 16 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 14,
  },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2A2A2A', flexShrink: 0,
  },
  infoIcon:  { fontSize: 16 },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: C.muted, fontWeight: '600', marginBottom: 2, letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: C.white, fontWeight: '500' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  actionLeft:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, flexShrink: 0,
  },
  actionIconGold: { backgroundColor: C.goldGlow, borderColor: C.goldBorder },
  actionIcon:     { fontSize: 16 },
  actionLabel:    { fontSize: 14, color: C.white, fontWeight: '600' },
  actionChevron:  { fontSize: 22, color: C.muted, lineHeight: 26 },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerBg, borderWidth: 1.5, borderColor: C.dangerBorder,
    borderRadius: 14, paddingVertical: 16,
    shadowColor: C.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  logoutBtnBusy: { opacity: 0.65 },
  logoutIcon:    { fontSize: 20, color: C.danger },
  logoutText:    { fontSize: 16, fontWeight: '800', color: C.danger, letterSpacing: 0.5 },
  logoutHint:    { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8, letterSpacing: 0.3 },

  version: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 36, letterSpacing: 0.5 },
});
