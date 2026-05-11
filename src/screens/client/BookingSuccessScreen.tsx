import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

interface Props {
  navigation: any;
  route:      any;
}

export default function BookingSuccessScreen({ navigation, route }: Props) {
  const { serviceName, barberName, scheduledAt } = route.params;
  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const scheduled   = new Date(scheduledAt);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1, tension: 50, friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatDate = (date: Date) => date.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric'
  });

  const formatTime = (date: Date) => date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <View style={styles.container}>

      {/* Animated checkmark */}
      <Animated.View style={[
        styles.iconWrapper,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={styles.iconCircle}>
          <Ionicons
            name="checkmark"
            size={64}
            color={theme.colors.textInverse}
          />
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.title}>BOOKING SENT!</Text>
        <Text style={styles.subtitle}>
          Waiting for barber confirmation
        </Text>

        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Ionicons name="cut-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{serviceName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{barberName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatDate(scheduled)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatTime(scheduled)}</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          You'll be notified once your barber confirms the appointment.
        </Text>
      </Animated.View>

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.reset({
          index: 0,
          routes: [{ name: 'ClientTabs' }],
        })}
      >
        <Text style={styles.buttonText}>BACK TO HOME</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  iconWrapper: {
    marginBottom: theme.spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.gold,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    letterSpacing: 1,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    width: '100%',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.gold,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  summaryText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    alignItems: 'center',
    position: 'absolute',
    bottom: theme.spacing.xxl,
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    ...theme.shadows.gold,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 3,
  },
});