/**
 * BookingSuccessScreen
 *
 * Booking summary + navigation back to ClientTabs.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '../../theme';
import { GoldCard, PremiumButton } from '../../components/ui';

interface Props {
  navigation: any;
  route:      any;
}

const CHECK_SIZE = 120;

const Checkmark = React.memo(function Checkmark() {
  return (
    <View style={checkStyles.wrap}>
      <Ionicons name="checkmark" size={84} color={theme.colors.textInverse} />
    </View>
  );
});

const checkStyles = StyleSheet.create({
  wrap: {
    width:          CHECK_SIZE,
    height:         CHECK_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

export default function BookingSuccessScreen({ navigation, route }: Props) {
  const { serviceName, barberName, scheduledAt } = route.params;
  const scheduled = new Date(scheduledAt);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      .catch(() => undefined);
  }, []);

  const formatDate = (date: Date) => date.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric'
  });
  const formatTime = (date: Date) => date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <View style={styles.container}>
      <View style={styles.checkWrap}>
        <View style={styles.checkCircle}>
          <Checkmark />
        </View>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.title}>BOOKING SENT!</Text>
        <Text style={styles.subtitle}>Waiting for barber confirmation</Text>
      </View>

      <View style={styles.summaryWrap}>
        <GoldCard disableEntrance>
          <View style={styles.summaryRow}>
            <Ionicons name="cut-outline"      size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{serviceName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline"   size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{barberName}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatDate(scheduled)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="time-outline"     size={16} color={theme.colors.gold} />
            <Text style={styles.summaryText}>{formatTime(scheduled)}</Text>
          </View>
        </GoldCard>

        <Text style={styles.hint}>
          You'll be notified once your barber confirms the appointment.
        </Text>
      </View>

      <View style={styles.footer}>
        <PremiumButton
          label="BACK TO HOME"
          fullWidth
          onPress={() => navigation.reset({
            index: 0,
            routes: [{ name: 'ClientTabs' }],
          })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: theme.colors.background,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         theme.spacing.lg,
  },

  checkWrap:   { marginBottom: theme.spacing.xl },
  checkCircle: {
    width:           140,
    height:          140,
    borderRadius:    70,
    backgroundColor: theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    ...theme.shadows.gold,
  },

  titleWrap: { alignItems: 'center', marginBottom: theme.spacing.xl },
  title: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxxl,
    color:         theme.colors.textPrimary,
    letterSpacing: 4,
    marginBottom:  theme.spacing.sm,
  },
  subtitle: {
    fontFamily:    theme.fonts.body,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.textSecondary,
    letterSpacing: 1,
  },

  summaryWrap: { width: '100%', alignItems: 'center' },
  summaryRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.md,
    paddingVertical: 6,
  },
  summaryText: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textPrimary,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
    textAlign:  'center',
    lineHeight: 22,
    marginTop:  theme.spacing.lg,
  },

  footer: {
    position: 'absolute',
    bottom:   theme.spacing.xxl,
    left:     theme.spacing.lg,
    right:    theme.spacing.lg,
  },
});
