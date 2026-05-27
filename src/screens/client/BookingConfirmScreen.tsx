import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import {
  collection, addDoc, serverTimestamp,
  doc, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { sendPushNotification } from '../../services/notifications';
import { syncBookingToSquare } from '../../services/squareSync';   // ← NEW
import { theme } from '../../theme';

interface Props {
  navigation: any;
  route:      any;
}

export default function BookingConfirmScreen({ navigation, route }: Props) {
  const { service, barber, scheduledAt } = route.params;
  const { user } = useAuth();
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [includeStyle, setIncludeStyle] = useState(true);

  const scheduled = new Date(scheduledAt);

  const stylePayload = route.params?.savedStyle ?? user?.savedStyle;
  const hasSavedStyle =
    stylePayload && typeof stylePayload.name === 'string';

  const styleImageUrl =
    stylePayload?.generatedImageUrl ??
    stylePayload?.tryOnImageUrl ??
    null;

  const isBirthday = (): boolean => {
    if (!user?.birthday) return false;
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return user.birthday === `${mm}-${dd}`;
  };

  const birthdayDiscount = isBirthday();
  const finalPrice = birthdayDiscount ? 0 : service.price;

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

    const barberId = barber.userId ?? barber.id;

    const requestedStyle =
      hasSavedStyle && includeStyle
        ? {
            name:              stylePayload.name,
            description:       stylePayload.description       ?? null,
            referenceImageUrl: stylePayload.referenceImageUrl ?? null,
            tryOnImageUrl:     stylePayload.tryOnImageUrl     ?? null,
            generatedImageUrl: stylePayload.generatedImageUrl ?? null,
          }
        : null;

    try {
      // ── 1. Write to Firestore (source of truth) ──────────────
      const newBookingRef = await addDoc(collection(db, COLLECTIONS.BOOKINGS), {
        clientId:       user.id,
        clientName:     user.displayName,
        clientPhotoURL: user.photoURL ?? null,
        barberId,
        barberName:     barber.displayName,
        serviceId:      service.id,
        serviceName:    service.name,
        servicePrice:   finalPrice,
        birthdayDiscount,
        status:         'pending',
        scheduledAt:    scheduled,
        createdAt:      serverTimestamp(),
        notes:          null,
        requestedStyle,
        rating:         null,
        review:         null,
      });

      // ── 2. Fire-and-forget Square sync ───────────────────────
      // Never awaited — never blocks the user if Square is down
      syncBookingToSquare({
        bookingId:    newBookingRef.id,
        customerName: user.displayName ?? 'Client',
        serviceName:  service.name,
        barberId,
        startAt:      scheduled.toISOString(),
        styleNote:    requestedStyle?.description  ?? '',
        tryOnImageUrl: requestedStyle?.tryOnImageUrl
                       ?? requestedStyle?.generatedImageUrl
                       ?? '',
      });

      // ── 3. Push notifications ────────────────────────────────
      try {
        const barberDocSnap = await getDoc(doc(db, COLLECTIONS.USERS, barberId));
        const barberToken = barberDocSnap.data()?.expoPushToken;
        if (barberToken) {
          await sendPushNotification(
            barberToken,
            'New Booking Request 💈',
            `${user.displayName} booked ${service.name}`,
            { bookingId: newBookingRef.id },
          );
          if (requestedStyle) {
            await sendPushNotification(
              barberToken,
              'Client Added a Style Request 💈',
              `${user.displayName} wants ${requestedStyle.name}`,
              { bookingId: newBookingRef.id },
            );
          }
        }
      } catch {
        // Push failure must never block booking
      }

      // ── 4. Navigate to success ───────────────────────────────
      navigation.replace('BookingSuccess', {
        serviceName: service.name,
        barberName:  barber.displayName,
        scheduledAt: scheduled.toISOString(),
      });

    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepText}>STEP 4 OF 4</Text>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            CONFIRM BOOKING
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

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
            <Text style={styles.detailPrice}>${finalPrice}</Text>
          </View>

          {birthdayDiscount && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Text style={{ fontSize: 16 }}>🎂</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>BIRTHDAY DISCOUNT</Text>
                <Text style={[styles.detailValue, { color: theme.colors.success }]}>
                  FREE HAIRCUT APPLIED!
                </Text>
              </View>
              <Text style={[styles.detailPrice, { color: theme.colors.success }]}>
                -${service.price}
              </Text>
            </View>
          )}

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
            {birthdayDiscount && (
              <Text style={styles.originalPrice}>
                Was ${service.price} CAD
              </Text>
            )}
            <Text style={styles.totalPrice}>${finalPrice} CAD</Text>
          </View>
        </View>

        {/* ── STYLE REQUEST CARD ── */}
        {hasSavedStyle && (
          <View style={[
            styles.styleCard,
            !includeStyle && styles.styleCardDisabled,
          ]}>

            <View style={styles.styleCardHeader}>
              <View style={styles.styleCardTitleRow}>
                <Ionicons
                  name="color-palette-outline"
                  size={16}
                  color={theme.colors.gold}
                />
                <Text style={styles.styleCardLabel}>STYLE REQUEST</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.styleToggle,
                  includeStyle && styles.styleToggleActive,
                ]}
                onPress={() => setIncludeStyle(prev => !prev)}
              >
                <Text style={[
                  styles.styleToggleText,
                  includeStyle && styles.styleToggleTextActive,
                ]}>
                  {includeStyle ? 'INCLUDED ✓' : '+ ADD'}
                </Text>
              </TouchableOpacity>
            </View>

            {styleImageUrl ? (
              <Image
                source={{ uri: styleImageUrl }}
                style={styles.styleImageFull}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.styleImagePlaceholder}>
                <Ionicons name="cut-outline" size={28} color="#444" />
                <Text style={styles.placeholderText}>
                  No preview — save a style from the Styles tab
                </Text>
              </View>
            )}

            <Text style={styles.styleName} numberOfLines={2}>
              {stylePayload.name.toUpperCase()}
            </Text>
            {stylePayload.description ? (
              <Text style={styles.styleDesc} numberOfLines={3}>
                {stylePayload.description}
              </Text>
            ) : null}

            {includeStyle && (
              <View style={styles.styleNoteRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={theme.colors.gold}
                />
                <Text style={styles.styleNote}>
                  Your barber will see this with your booking.
                </Text>
              </View>
            )}
          </View>
        )}

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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  stepText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
    textAlign: 'center',
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
  originalPrice: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
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
  styleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadows.gold,
  },
  styleCardDisabled: {
    borderColor: theme.colors.border,
    opacity: 0.45,
  },
  styleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  styleCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  styleCardLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 3,
  },
  styleToggle: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  styleToggleActive: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  styleToggleText: {
    fontFamily: theme.fonts.heading,
    fontSize: 11,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  styleToggleTextActive: {
    color: theme.colors.gold,
  },
  styleImageFull: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginBottom: theme.spacing.sm,
  },
  styleImagePlaceholder: {
    width: '100%',
    height: 90,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
    gap: 6,
  },
  placeholderText: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: '#555',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  styleName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  styleDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 18,
    marginBottom: theme.spacing.sm,
  },
  styleNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  styleNote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
    flex: 1,
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