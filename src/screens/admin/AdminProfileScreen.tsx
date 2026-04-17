import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthService } from '@/services/auth.service';
import { useAuth } from '@/hooks/useAuth';

const C = {
  bg:     '#0A0A0A',
  card:   '#141414',
  border: '#252525',
  gold:   '#D4AF37',
  white:  '#FFFFFF',
  sub:    '#666666',
  danger: '#CF6679',
  dangerBg: '#1A0A0A',
  dangerBdr: '#CF667944',
} as const;

export default function AdminProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const email = appUser?.email ?? firebaseUser?.email ?? '—';

  async function handleLogout(): Promise<void> {
    if (loggingOut) return;
    setLoggingOut(true);
    await AuthService.logout();
    setLoggingOut(false);
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <Text style={s.headerSub}>SHOP ADMIN</Text>
      </View>
      <View style={s.headerLine} />

      <View style={s.card}>
        <View style={s.row}>
          <Ionicons name="mail-outline" size={20} color={C.sub} />
          <View style={s.rowText}>
            <Text style={s.label}>Email</Text>
            <Text style={s.value} numberOfLines={2}>
              {email}
            </Text>
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Ionicons name="shield-checkmark-outline" size={20} color={C.gold} />
          <View style={s.rowText}>
            <Text style={s.label}>Role</Text>
            <Text style={[s.value, { color: C.gold }]}>admin</Text>
          </View>
        </View>
      </View>

      <Text style={s.hint}>
        Read-only account overview. Ratings and bookings are managed from the
        Dashboard tab.
      </Text>

      <TouchableOpacity
        style={[s.logoutBtn, loggingOut && s.logoutBusy]}
        onPress={() => void handleLogout()}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        {loggingOut ? (
          <ActivityIndicator color={C.danger} />
        ) : (
          <Ionicons name="log-out-outline" size={22} color={C.danger} />
        )}
        <Text style={s.logoutText}>
          {loggingOut ? 'Signing out…' : 'Log Out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  header: { alignItems: 'center', paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.white },
  headerSub: {
    fontSize: 10,
    color: C.gold,
    letterSpacing: 3,
    fontWeight: '700',
    marginTop: 4,
  },
  headerLine: {
    height: 1,
    backgroundColor: C.gold,
    opacity: 0.2,
    marginBottom: 20,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1 },
  label: {
    fontSize: 10,
    color: C.sub,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: { fontSize: 15, color: C.white, fontWeight: '600' },
  divider: {
    height: 1,
    backgroundColor: '#1C1C1C',
    marginVertical: 14,
  },
  hint: {
    fontSize: 12,
    color: C.sub,
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.dangerBg,
    borderWidth: 1.5,
    borderColor: C.dangerBdr,
    borderRadius: 14,
    paddingVertical: 16,
  },
  logoutBusy: { opacity: 0.7 },
  logoutText: { fontSize: 16, fontWeight: '800', color: C.danger },
});
