import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';

export default function PendingApprovalScreen() {
  const { user } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel',   style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  return (
    <View style={styles.container}>

      {/* Icon */}
      <View style={styles.iconWrap}>
        <View style={styles.iconCircle}>
          <Ionicons
            name="hourglass-outline"
            size={80}
            color={theme.colors.gold}
          />
        </View>
      </View>

      {/* Title + subtitle */}
      <Text style={styles.title}>PENDING APPROVAL</Text>
      <Text style={styles.subtitle}>
        Your barber account is under review.{'\n'}
        The admin will approve your account shortly.
      </Text>

      {/* Account card */}
      <View style={styles.card}>

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="person-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>NAME</Text>
            <Text style={styles.rowValue}>{user?.displayName ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>EMAIL</Text>
            <Text style={styles.rowValue}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={theme.colors.gold}
            />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>STATUS</Text>
            <View style={styles.statusBadge}>
              <Ionicons name="time-outline" size={12} color={theme.colors.warning} />
              <Text style={styles.statusBadgeText}>PENDING</Text>
            </View>
          </View>
        </View>

      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl * 2,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: theme.spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.gold,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    overflow: 'hidden',
    ...theme.shadows.gold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  rowValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md + 36 + theme.spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 152, 0, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.full,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
    marginTop: 4,
  },
  statusBadgeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.warning,
    letterSpacing: 2,
  },
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
    marginTop: 'auto',
    width: '100%',
  },
  signOutText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.error,
    letterSpacing: 3,
  },
});
