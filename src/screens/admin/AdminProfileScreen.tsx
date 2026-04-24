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
import { colors, fonts, spacing, radius, icons } from '@/theme';

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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
        <Text style={s.headerSub}>SHOP ADMIN</Text>
      </View>
      <View style={s.headerLine} />

      <View style={s.card}>
        <View style={s.row}>
          <Ionicons name={icons.mail} size={20} color={colors.grey} />
          <View style={s.rowText}>
            <Text style={s.label}>Email</Text>
            <Text style={s.value} numberOfLines={2}>
              {email}
            </Text>
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.row}>
          <Ionicons name={icons.shield} size={20} color={colors.gold} />
          <View style={s.rowText}>
            <Text style={s.label}>Role</Text>
            <Text style={[s.value, { color: colors.gold }]}>admin</Text>
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
          <ActivityIndicator color={colors.red} />
        ) : (
          <Ionicons name={icons.logOut} size={22} color={colors.red} />
        )}
        <Text style={s.logoutText}>
          {loggingOut ? 'Signing out...' : 'Log Out'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  header: { alignItems: 'center', paddingVertical: 16 },
  headerTitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.white },
  headerSub: {
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 3,
    fontFamily: fonts.bodyBold,
    marginTop: 4,
  },
  headerLine: {
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.2,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowText: { flex: 1 },
  label: {
    fontSize: 10,
    color: colors.grey,
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  value: { fontSize: 15, color: colors.white, fontFamily: fonts.bodySemiBold },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  hint: {
    fontSize: 12,
    color: colors.grey,
    lineHeight: 18,
    marginTop: 16,
    marginBottom: 24,
    fontFamily: fonts.body,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.red + '15',
    borderWidth: 1.5,
    borderColor: colors.red + '40',
    borderRadius: radius.md,
    paddingVertical: 16,
  },
  logoutBusy: { opacity: 0.7 },
  logoutText: { fontSize: 16, fontFamily: fonts.bodyBold, color: colors.red },
});
