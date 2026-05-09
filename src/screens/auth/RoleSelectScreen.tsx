import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import { UserRole } from '../../types';

const ROLES: {
  role:        UserRole;
  title:       string;
  subtitle:    string;
  icon:        keyof typeof Ionicons.glyphMap;
  description: string;
}[] = [
  {
    role:        'client',
    title:       'CLIENT',
    subtitle:    'Book appointments',
    icon:        'person-outline',
    description: 'Browse barbers, book cuts, track your style history',
  },
  {
    role:        'barber',
    title:       'BARBER',
    subtitle:    'Manage your schedule',
    icon:        'cut-outline',
    description: 'View bookings, manage your calendar, chat with clients',
  },
  {
    role:        'admin',
    title:       'ADMIN',
    subtitle:    'Run the shop',
    icon:        'settings-outline',
    description: 'Full dashboard, analytics, manage staff and services',
  },
];

export default function RoleSelectScreen() {
  const { firebaseUser } = useAuth();
  const [selected, setSelected] = useState<UserRole | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!selected || !firebaseUser) return;
    setLoading(true);
    setError(null);
    try {
      await updateDoc(
        doc(db, COLLECTIONS.USERS, firebaseUser.uid),
        { role: selected }
      );
      // RootNavigator detects role change → routes automatically
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>613</Text>
          <Text style={styles.title}>WHO ARE YOU?</Text>
          <Text style={styles.subtitle}>Choose your role to continue</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cards}>
          {ROLES.map((item) => {
            const isSelected = selected === item.role;
            return (
              <TouchableOpacity
                key={item.role}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(item.role)}
                activeOpacity={0.8}
              >
                {/* Icon */}
                <View style={[
                  styles.iconContainer,
                  isSelected && styles.iconContainerSelected
                ]}>
                  <Ionicons
                    name={item.icon}
                    size={32}
                    color={isSelected
                      ? theme.colors.textInverse
                      : theme.colors.gold}
                  />
                </View>

                {/* Text */}
                <View style={styles.cardText}>
                  <Text style={[
                    styles.roleTitle,
                    isSelected && styles.roleTitleSelected
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={styles.roleSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.roleDescription}>
                    {item.description}
                  </Text>
                </View>

                {/* Checkmark */}
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.gold}
                    style={styles.checkmark}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          style={[
            styles.button,
            (!selected || loading) && styles.buttonDisabled
          ]}
          onPress={handleConfirm}
          disabled={!selected || loading}
        >
          {loading
            ? <ActivityIndicator color={theme.colors.textInverse} />
            : <Text style={styles.buttonText}>CONFIRM ROLE</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    fontFamily: theme.fonts.heading,
    fontSize: 64,
    color: theme.colors.gold,
    lineHeight: 64,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 6,
    marginTop: theme.spacing.xs,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    letterSpacing: 1,
  },
  cards: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  cardSelected: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  iconContainerSelected: {
    backgroundColor: theme.colors.gold,
  },
  cardText: {
    flex: 1,
  },
  roleTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },
  roleTitleSelected: {
    color: theme.colors.gold,
  },
  roleSubtitle: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  roleDescription: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    lineHeight: 16,
  },
  checkmark: {
    marginLeft: theme.spacing.sm,
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.gold,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 3,
  },
});