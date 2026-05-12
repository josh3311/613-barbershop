import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { theme } from '../../theme';

interface Props {
  navigation: any;
  route:      any;
}

export default function BookingConfirmScreen({ navigation, route }: Props) {
  const { service, barber, scheduledAt } = route.params;
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const scheduled = new Date(scheduledAt);

  const formatDate = (date: Date) => date.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const formatTime = (date: Date) => date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  const handleConfirm = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // ── Use barber.userId (auth UID) so Dashboard/Schedule queries match ──
    // Falls back to barber.id if userId isn't set yet on the barbers document
    const barberId = barber.userId ?? barber.id;

    try {
      await addDoc(collection(db, COLLECTIONS.BOOKINGS), {
        clientId:       user.id,
        clientName:     user.displayName,
        clientPhotoURL: user.photoURL ?? null,
        barberId,
        barberName:     barber.displayName,
        serviceId:      service.id,
        serviceName:    service.name,
        servicePrice:   service.price,
        status:         'pending',
        scheduledAt:    scheduled,
        createdAt:      serverTimestamp(),
        notes:          null,
        requestedStyle: null,
        rating:         null,
        review:         null,
      });

      navigation.replace('BookingSuccess', {
        serviceName: service.name,
        barberName:  barber.displayName,
        scheduledAt: scheduled.toISOString(),
      });

    } catch (e) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.stepText}>STEP 4 OF 4</Text>
          <Text style={styles.title}>CONFIRM BOOKING</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '100%' }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>

          <View style={styles.shopHeader}>
            <Text style={styles.shopName}>613</Text>
            <Text style={styles.shopSub}>BARBERSHOP</Text>
            <Text style={styles.shopAddress}>598 Rideau Street, Ottawa</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="cut-outline" size={18} color={theme.colors.gold} />
            </View>
            <View>
              <Text style={styles.detailLabel}>SERVICE</Text>
              <Text style={styles.detailValue}>{service.name}</Text>
            </View>
            <Text style={styles.detailPrice}>${service.price}</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="person-outline" size={18} color={theme.colors.gold} />
            </View>
            <View>
              <Text style={styles.detailLabel}>BARBER</Text>
              <Text style={styles.detailValue}>{barber.displayName}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="calendar-outline" size={18} color={theme.colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>DATE</Text>
              <Text style={styles.detailValue}>{formatDate(scheduled)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="time-outline" size={18} color={theme.colors.gold} />
            </View>
            <View>
              <Text style={styles.detailLabel}>TIME</Text>
              <Text style={styles.detailValue}>{formatTime(scheduled)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="timer-outline" size={18} color={theme.colors.gold} />
            </View>
            <View>
              <Text style={styles.detailLabel}>DURATION</Text>
              <Text style={styles.detailValue}>{service.durationMin} minutes</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalPrice}>${service.price} CAD</Text>
          </View>

        </View>

        {/* Info note */}
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={theme.colors.textMuted}
          />
          <Text style={styles.infoText}>
            Your booking will be confirmed by the barber.
            You'll be notified once confirmed.
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

      </ScrollView>

      {/* Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={theme.colors.textInverse} />
            : <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color={theme.colors.textInverse}
                />
                <Text style={styles.buttonText}>CONFIRM BOOKING</Text>
              </>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.full,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingBottom: 120,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    ...theme.shadows.gold,
  },
  shopHeader: {
    alignItems: 'center',
    paddingBottom: theme.spacing.lg,
  },
  shopName: {
    fontFamily: theme.fonts.heading,
    fontSize: 64,
    color: theme.colors.gold,
    lineHeight: 64,
  },
  shopSub: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
    letterSpacing: 6,
  },
  shopAddress: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  detailValue: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  detailPrice: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
    marginLeft: 'auto',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
  },
  totalLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
  },
  totalPrice: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.gold,
  },
  infoBox: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    flex: 1,
    lineHeight: 20,
  },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.gold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 3,
  },
});