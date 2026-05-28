import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { theme } from '../../theme';

const BIRTHDAY_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export default function ProfileScreen() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [savingBirthday, setSavingBirthday] = useState(false);

  const handleSaveBirthday = async () => {
    if (!user) return;
    const trimmed = birthday.trim();
    if (!BIRTHDAY_REGEX.test(trimmed)) {
      Alert.alert('Invalid format', 'Please enter birthday as MM-DD (e.g. 05-13).');
      return;
    }
    try {
      setSavingBirthday(true);
      await updateDoc(doc(db, COLLECTIONS.USERS, user.id), { birthday: trimmed });
      setEditingBirthday(false);
      Alert.alert('Saved', 'Your birthday has been updated.');
    } catch {
      Alert.alert('Error', 'Could not save birthday. Please try again.');
    } finally {
      setSavingBirthday(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut(auth);
          },
        },
      ]
    );
  };

  const stamps      = user?.loyaltyStamps ?? 0;
  const stampsLeft  = 10 - stamps;
  const firstName   = user?.displayName?.split(' ')[0] ?? '';
  const lastName    = user?.displayName?.split(' ').slice(1).join(' ') ?? '';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PROFILE</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.name}>
            {user?.displayName?.toUpperCase()}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Loyalty Card */}
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <View>
              <Text style={styles.loyaltyTitle}>LOYALTY STAMPS</Text>
              <Text style={styles.loyaltySubtitle}>
                {stampsLeft > 0
                  ? `${stampsLeft} more cuts until free haircut`
                  : 'You earned a free haircut! 🎉'}
              </Text>
            </View>
            <Text style={styles.loyaltyCount}>{stamps}/10</Text>
          </View>
          <View style={styles.stampsGrid}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stamp,
                  i < stamps && styles.stampFilled,
                ]}
              >
                {i < stamps && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={theme.colors.textInverse}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>FIRST NAME</Text>
                <Text style={styles.infoValue}>{firstName}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>LAST NAME</Text>
                <Text style={styles.infoValue}>
                  {lastName || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>EMAIL</Text>
                <Text style={styles.infoValue}>{user?.email}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>PHONE</Text>
                <Text style={styles.infoValue}>
                  {user?.phone ?? 'Not added'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => {
                setBirthday(user?.birthday ?? '');
                setEditingBirthday(true);
              }}
              disabled={editingBirthday}
            >
              <View style={styles.infoIcon}>
                <Ionicons
                  name="gift-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>BIRTHDAY</Text>
                {editingBirthday ? (
                  <View style={styles.birthdayEditRow}>
                    <TextInput
                      style={styles.birthdayInput}
                      value={birthday}
                      onChangeText={setBirthday}
                      placeholder="MM-DD"
                      placeholderTextColor={theme.colors.textMuted}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      autoFocus
                      editable={!savingBirthday}
                    />
                    <TouchableOpacity
                      style={styles.birthdaySaveBtn}
                      onPress={handleSaveBirthday}
                      disabled={savingBirthday}
                    >
                      {savingBirthday ? (
                        <ActivityIndicator size="small" color={theme.colors.textInverse} />
                      ) : (
                        <Text style={styles.birthdaySaveText}>SAVE</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.birthdayCancelBtn}
                      onPress={() => {
                        setEditingBirthday(false);
                        setBirthday(user?.birthday ?? '');
                      }}
                      disabled={savingBirthday}
                    >
                      <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.infoValue}>
                    {user?.birthday ?? 'Not set'}
                  </Text>
                )}
              </View>
              {!editingBirthday && (
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={theme.colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP</Text>
          <View style={styles.infoCard}>

            <TouchableOpacity style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>Notifications</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="shield-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>Privacy Policy</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={theme.colors.gold}
                />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoValue}>About 613 Barbershop</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>

          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={theme.colors.error}
          />
          <Text style={styles.signOutText}>
            {signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
          </Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>613 Barbershop v3.0</Text>

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
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.gold,
  },
  avatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: 40,
    color: theme.colors.textInverse,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  roleBadge: {
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  roleText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  loyaltyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.gold,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  loyaltyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },
  loyaltySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  loyaltyCount: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
  },
  stampsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  stamp: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampFilled: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
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
    letterSpacing: 1,
  },
  infoValue: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.lg + 36 + theme.spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  signOutText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.error,
    letterSpacing: 2,
  },
  version: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  birthdayEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  birthdayInput: {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  birthdaySaveBtn: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  birthdaySaveText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
  birthdayCancelBtn: {
    padding: theme.spacing.xs,
  },
});