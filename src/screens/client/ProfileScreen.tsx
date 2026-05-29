/**
 * ProfileScreen — V3 visual layer
 *
 * Visual upgrades:
 * - Avatar wrapped in a gold ring (plain View, Skia disabled during audit)
 * - Account info sections become GoldCards
 * - Loyalty stamps spring-bounce in with stagger (same pattern as Home)
 *
 * Logic preserved: birthday edit (MM-DD regex), sign-out alert,
 * loyalty math, all info rows.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Alert, ActivityIndicator,
} from 'react-native';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { theme } from '../../theme';
import { GoldCard, PremiumInput } from '../../components/ui';

const BIRTHDAY_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const RING_SIZE = 110;

export default function ProfileScreen() {
  const { user } = useAuth();
  const [signingOut,      setSigningOut]      = useState(false);
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthday,        setBirthday]        = useState(user?.birthday ?? '');
  const [savingBirthday,  setSavingBirthday]  = useState(false);

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
      ],
    );
  };

  const stamps     = user?.loyaltyStamps ?? 0;
  const stampsLeft = 10 - stamps;
  const firstName  = user?.displayName?.split(' ')[0] ?? '';
  const lastName   = user?.displayName?.split(' ').slice(1).join(' ') ?? '';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>PROFILE</Text>
        </View>

        {/* Avatar + Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarBlock}>
            {/* Plain gold ring — Skia rotating ring disabled during audit */}
            <View style={styles.avatarRing} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.displayName?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          </View>
          <Text style={styles.name}>{user?.displayName?.toUpperCase()}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role?.toUpperCase()}</Text>
          </View>
        </View>

        {/* Loyalty card */}
        <GoldCard entranceIndex={0} active={stamps >= 10}>
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
            {Array.from({ length: 10 }).map((_, i) => {
              const filled = i < stamps;
              return (
                <MotiView
                  key={i}
                  from={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type:    'spring',
                    damping: filled ? 9 : 14,
                    mass:    filled ? 0.6 : 1,
                    delay:   180 + i * 35,
                  }}
                  style={[styles.stamp, filled && styles.stampFilled]}
                >
                  {filled && (
                    <Ionicons name="checkmark" size={14} color={theme.colors.textInverse} />
                  )}
                </MotiView>
              );
            })}
          </View>
        </GoldCard>

        {/* Account info */}
        <Text style={styles.sectionTitle}>ACCOUNT INFO</Text>
        <GoldCard entranceIndex={1} contentStyle={{ padding: 0 }} flat>
          <InfoRow icon="person-outline"  label="FIRST NAME" value={firstName} />
          <Divider />
          <InfoRow icon="person-outline"  label="LAST NAME"  value={lastName || '—'} />
          <Divider />
          <InfoRow icon="mail-outline"    label="EMAIL"      value={user?.email ?? '—'} />
          <Divider />
          <InfoRow icon="call-outline"    label="PHONE"      value={user?.phone ?? 'Not added'} />
          <Divider />

          {/* Birthday row */}
          <Pressable
            style={styles.infoRow}
            onPress={() => {
              setBirthday(user?.birthday ?? '');
              setEditingBirthday(true);
            }}
            disabled={editingBirthday}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="gift-outline" size={18} color={theme.colors.gold} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>BIRTHDAY</Text>
              {editingBirthday ? (
                <View style={styles.birthdayEditRow}>
                  <PremiumInput
                    value={birthday}
                    onChangeText={setBirthday}
                    placeholder="MM-DD"
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                    editable={!savingBirthday}
                    containerStyle={{ flex: 1, marginBottom: 0 }}
                  />
                  <Pressable
                    style={styles.birthdaySaveBtn}
                    onPress={handleSaveBirthday}
                    disabled={savingBirthday}
                  >
                    {savingBirthday ? (
                      <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    ) : (
                      <Text style={styles.birthdaySaveText}>SAVE</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={styles.birthdayCancelBtn}
                    onPress={() => {
                      setEditingBirthday(false);
                      setBirthday(user?.birthday ?? '');
                    }}
                    disabled={savingBirthday}
                  >
                    <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.infoValue}>{user?.birthday ?? 'Not set'}</Text>
              )}
            </View>
            {!editingBirthday && (
              <Ionicons name="create-outline" size={16} color={theme.colors.textMuted} />
            )}
          </Pressable>
        </GoldCard>

        {/* App section */}
        <Text style={styles.sectionTitle}>APP</Text>
        <GoldCard entranceIndex={2} contentStyle={{ padding: 0 }} flat>
          <Pressable style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="notifications-outline" size={18} color={theme.colors.gold} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Divider />
          <Pressable style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-outline" size={18} color={theme.colors.gold} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
          <Divider />
          <Pressable style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.gold} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoValue}>About 613 Barbershop</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
          </Pressable>
        </GoldCard>

        {/* Sign out */}
        <Pressable
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
          <Text style={styles.signOutText}>
            {signingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
          </Text>
        </Pressable>

        <Text style={styles.version}>613 Barbershop v3.0</Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon, label, value,
}: {
  icon:  keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={theme.colors.gold} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    padding:       theme.spacing.lg,
    paddingTop:    theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
  },
  header:        { marginBottom: theme.spacing.xl },
  title: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 4,
  },

  avatarSection: { alignItems: 'center', marginBottom: theme.spacing.xl },
  avatarBlock: {
    width:          RING_SIZE,
    height:         RING_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   theme.spacing.md,
  },
  avatarRing: {
    position:     'absolute',
    width:        RING_SIZE,
    height:       RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth:  2,
    borderColor:  theme.colors.gold,
    opacity:      0.6,
  },
  avatar: {
    width:           90,
    height:          90,
    borderRadius:    45,
    backgroundColor: theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    ...theme.shadows.gold,
  },
  avatarText: {
    fontFamily: theme.fonts.heading,
    fontSize:   40,
    color:      theme.colors.textInverse,
  },
  name: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 3,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
    marginTop:  theme.spacing.xs,
  },
  roleBadge: {
    backgroundColor:   theme.colors.goldMuted,
    borderWidth:       1,
    borderColor:       theme.colors.gold,
    borderRadius:      theme.radius.full,
    paddingVertical:   4,
    paddingHorizontal: theme.spacing.md,
    marginTop:         theme.spacing.sm,
  },
  roleText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },

  loyaltyHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   theme.spacing.md,
  },
  loyaltyTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.textPrimary,
    letterSpacing: 3,
  },
  loyaltySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textSecondary,
    marginTop:  2,
  },
  loyaltyCount: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xl,
    color:      theme.colors.gold,
  },
  stampsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  stamp: {
    width:          36,
    height:         36,
    borderRadius:   theme.radius.full,
    borderWidth:    1.5,
    borderColor:    theme.colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  stampFilled: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },

  sectionTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textSecondary,
    letterSpacing: 4,
    marginTop:     theme.spacing.xl,
    marginBottom:  theme.spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       theme.spacing.md,
    gap:           theme.spacing.md,
  },
  infoIcon: {
    width:           36,
    height:          36,
    borderRadius:    theme.radius.sm,
    backgroundColor: theme.colors.goldMuted,
    alignItems:      'center',
    justifyContent:  'center',
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.textMuted,
    letterSpacing: 1,
  },
  infoValue: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textPrimary,
    marginTop:  1,
  },
  divider: {
    height:          1,
    backgroundColor: theme.colors.border,
    marginLeft:      theme.spacing.lg + 36 + theme.spacing.md,
  },

  birthdayEditRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.sm,
    marginTop:     theme.spacing.xs,
  },
  birthdaySaveBtn: {
    backgroundColor:   theme.colors.gold,
    borderRadius:      theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical:   6,
    alignItems:        'center',
    justifyContent:    'center',
    minWidth:          60,
  },
  birthdaySaveText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
  birthdayCancelBtn: { padding: theme.spacing.xs },

  signOutBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.sm,
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth:     1,
    borderColor:     theme.colors.error,
    borderRadius:    theme.radius.md,
    padding:         theme.spacing.md,
    marginTop:       theme.spacing.xl,
    marginBottom:    theme.spacing.lg,
  },
  signOutText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.error,
    letterSpacing: 2,
  },
  version: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
    textAlign:  'center',
  },
});