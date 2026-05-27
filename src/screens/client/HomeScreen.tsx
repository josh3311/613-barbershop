import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  const isBirthday = (): boolean => {
    if (!user?.birthday) return false;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return user.birthday === `${mm}-${dd}`;
  };

  const handleQuickAction = (label: string) => {
    switch (label) {
      case 'Book Cut':
        navigation.navigate('BookingFlow');
        break;
      case 'History':
        navigation.navigate('History');
        break;
      case 'Chat':
        navigation.navigate('StyleAI');   // ← fixed: chat lives in StylesScreen
        break;
      case 'My Styles':
        navigation.navigate('StyleAI');   // ← fixed: was 'Styles', now 'StyleAI'
        break;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[
          styles.header,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>{firstName.toUpperCase()}</Text>
          </View>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
          >
            <Ionicons
              name="log-out-outline"
              size={24}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        </Animated.View>

        {isBirthday() && (
          <View style={styles.birthdayBanner}>
            <Text style={styles.birthdayEmoji}>🎂</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.birthdayTitle}>HAPPY BIRTHDAY!</Text>
              <Text style={styles.birthdaySubtitle}>
                Your next haircut is FREE today only!
              </Text>
            </View>
          </View>
        )}

        {/* Hero Card */}
        <Animated.View style={[
          styles.heroCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <Text style={styles.heroNumber}>613</Text>
          <Text style={styles.heroTitle} adjustsFontSizeToFit numberOfLines={1}>BARBERSHOP</Text>
          <Text style={styles.heroSubtitle}>Ottawa's finest cuts</Text>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => navigation.navigate('BookingFlow')}
          >
            <Text style={styles.bookBtnText}>BOOK NOW</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={theme.colors.textInverse}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.actions}>
          {QUICK_ACTIONS.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionCard}
              onPress={() => handleQuickAction(action.label)}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name={action.icon}
                  size={24}
                  color={theme.colors.gold}
                />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Loyalty Card */}
        <Text style={styles.sectionTitle}>LOYALTY</Text>
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyHeader}>
            <Text style={styles.loyaltyTitle}>YOUR STAMPS</Text>
            <Text style={styles.loyaltyCount}>
              {user?.loyaltyStamps ?? 0}/10
            </Text>
          </View>
          <View style={styles.stampsRow}>
            {Array.from({ length: 10 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.stamp,
                  i < (user?.loyaltyStamps ?? 0) && styles.stampFilled,
                ]}
              >
                {i < (user?.loyaltyStamps ?? 0) && (
                  <Ionicons
                    name="checkmark"
                    size={12}
                    color={theme.colors.textInverse}
                  />
                )}
              </View>
            ))}
          </View>
          <Text style={styles.loyaltyHint}>
            {10 - (user?.loyaltyStamps ?? 0)} more cuts until your free haircut!
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const QUICK_ACTIONS = [
  { label: 'Book Cut',  icon: 'calendar-outline'       },
  { label: 'My Styles', icon: 'color-palette-outline'  },
  { label: 'History',   icon: 'time-outline'            },
  { label: 'Chat',      icon: 'chatbubble-outline'      },
] as const;

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textSecondary,
  },
  name: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  signOutBtn: {
    padding: theme.spacing.sm,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    alignItems: 'flex-start',
    ...theme.shadows.gold,
  },
  heroNumber: {
    fontFamily: theme.fonts.heading,
    fontSize: 80,
    color: theme.colors.gold,
    lineHeight: 80,
  },
  heroTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    letterSpacing: 6,
  },
  heroSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
    letterSpacing: 2,
  },
  bookBtn: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  bookBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    alignItems: 'center',
    width: (width - theme.spacing.lg * 2 - theme.spacing.md) / 2,
    ...theme.shadows.md,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  actionLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textPrimary,
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
    marginBottom: theme.spacing.md,
  },
  loyaltyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },
  loyaltyCount: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.gold,
  },
  stampsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  stamp: {
    width: 28,
    height: 28,
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
  loyaltyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  birthdayBanner: {
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  birthdayEmoji: {
    fontSize: 32,
  },
  birthdayTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  birthdaySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});