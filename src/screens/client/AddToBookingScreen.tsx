import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, where, getDocs,
  doc, getDoc, updateDoc,
} from 'firebase/firestore';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { useAuth } from '../../context/AuthContext';
import { sendPushNotification } from '../../services/notifications';
import { theme } from '../../theme';

// Minimal nav typing — this screen only ever calls goBack(), so empty stack.
type AddToBookingNavParams = Record<string, undefined>;

interface Props {
  navigation: NativeStackNavigationProp<AddToBookingNavParams>;
}

interface UpcomingBooking {
  id:           string;
  barberId:     string;
  barberName:   string;
  serviceName:  string;
  servicePrice: number;
  scheduledAt:  Date;
}

// Raw shape of a booking document — only the fields we actually read.
interface BookingDoc {
  barberId?:     string;
  barberName?:   string;
  serviceName?:  string;
  servicePrice?: number;
  scheduledAt?:  { toDate: () => Date } | Date | null;
}

export default function AddToBookingScreen({ navigation }: Props) {
  const { user } = useAuth();
  const savedStyle = user?.savedStyle;

  const [loading,  setLoading]  = useState<boolean>(true);
  const [bookings, setBookings] = useState<UpcomingBooking[]>([]);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  // ── Load upcoming bookings ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        // status filter is in-memory below to avoid composite-index needs.
        const q = query(
          collection(db, COLLECTIONS.BOOKINGS),
          where('clientId', '==', user.id),
          where('status',   'in', ['pending', 'confirmed']),
        );
        const snap = await getDocs(q);
        const now  = new Date();

        const rows: UpcomingBooking[] = snap.docs
          .map(d => {
            const data = d.data() as BookingDoc;
            const raw  = data.scheduledAt;
            const date =
              raw && typeof (raw as { toDate?: () => Date }).toDate === 'function'
                ? (raw as { toDate: () => Date }).toDate()
                : (raw instanceof Date ? raw : null);
            if (!date) return null;
            return {
              id:           d.id,
              barberId:     data.barberId       ?? '',
              barberName:   data.barberName     ?? 'Barber',
              serviceName:  data.serviceName    ?? 'Service',
              servicePrice: data.servicePrice   ?? 0,
              scheduledAt:  date,
            };
          })
          .filter((b): b is UpcomingBooking => b !== null)
          .filter(b => b.scheduledAt >= now)
          .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

        if (!cancelled) setBookings(rows);
      } catch {
        if (!cancelled) {
          setError('Could not load your bookings. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Attach style to a booking ────────────────────────────
  const handleAttach = async (booking: UpcomingBooking) => {
    if (!user || !savedStyle || attaching) return;
    setAttaching(booking.id);
    setError(null);
    setSuccess(null);

    try {
      const requestedStyle = {
        name:              savedStyle.name,
        description:       savedStyle.description       ?? null,
        referenceImageUrl: savedStyle.referenceImageUrl ?? null,
        tryOnImageUrl:     savedStyle.tryOnImageUrl     ?? null,
      };

      await updateDoc(doc(db, COLLECTIONS.BOOKINGS, booking.id), {
        requestedStyle,
      });

      // Fire-and-forget push to the barber — silent failures.
      try {
        const barberSnap = await getDoc(
          doc(db, COLLECTIONS.USERS, booking.barberId),
        );
        const barberToken = barberSnap.data()?.expoPushToken;
        if (typeof barberToken === 'string' && barberToken.length > 0) {
          await sendPushNotification(
            barberToken,
            'Client Added a Style Request 💈',
            `${user.displayName} wants ${savedStyle.name} — check their booking for reference photos`,
            { bookingId: booking.id },
          );
        }
      } catch {
        // Notification failure must never surface.
      }

      setSuccess('Style added to your booking.');
      setTimeout(() => {
        navigation.goBack();
      }, 1200);
    } catch {
      setError('Could not add style to that booking. Please try again.');
    } finally {
      setAttaching(null);
    }
  };

  // ── Render helpers ───────────────────────────────────────
  const formatWhen = (date: Date): string => {
    const datePart = date.toLocaleDateString([], {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    const timePart = date.toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit',
    });
    return `${datePart} • ${timePart}`;
  };

  const renderRow = ({ item }: { item: UpcomingBooking }) => {
    const busy = attaching === item.id;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleAttach(item)}
        disabled={busy || attaching !== null || success !== null}
        activeOpacity={0.85}
      >
        <View style={styles.rowIcon}>
          <Ionicons name="calendar-outline" size={20} color={theme.colors.gold} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.barberName} numberOfLines={1}>
            {item.barberName.toUpperCase()}
          </Text>
          <Text style={styles.serviceLine} numberOfLines={1}>
            {item.serviceName} — ${item.servicePrice}
          </Text>
          <Text style={styles.timeLine} numberOfLines={1}>
            {formatWhen(item.scheduledAt)}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.gold} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  // ── Body ─────────────────────────────────────────────────
  let body: React.ReactNode;
  if (loading) {
    body = (
      <View style={styles.centerWrap}>
        <ActivityIndicator size="large" color={theme.colors.gold} />
      </View>
    );
  } else if (bookings.length === 0) {
    body = (
      <View style={styles.centerWrap}>
        <Text style={styles.emptyText}>No upcoming bookings.</Text>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={bookings}
        keyExtractor={b => b.id}
        renderItem={renderRow}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ADD TO BOOKING</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Banners */}
      {success ? (
        <View style={styles.successBanner}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={theme.colors.success}
          />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={theme.colors.error}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        theme.spacing.xxl,
    paddingBottom:     theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    flex:          1,
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxl,
    color:         theme.colors.gold,
    letterSpacing: 4,
    textAlign:     'center',
  },
  headerSpacer: {
    width: 40,
  },

  centerWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        theme.spacing.lg,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textSecondary,
    textAlign:  'center',
  },

  list: {
    padding: theme.spacing.lg,
    gap:     theme.spacing.md,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.lg,
    padding:         theme.spacing.md,
    ...theme.shadows.sm,
  },
  rowIcon: {
    width:           44,
    height:          44,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rowBody: {
    flex: 1,
    gap:  2,
  },
  barberName: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.md,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
  serviceLine: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textPrimary,
  },
  timeLine: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textSecondary,
  },

  successBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.sm,
    marginHorizontal:  theme.spacing.lg,
    marginTop:         theme.spacing.md,
    paddingVertical:   theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor:   theme.colors.surface,
    borderWidth:       1,
    borderColor:       theme.colors.success,
    borderRadius:      theme.radius.md,
  },
  successText: {
    flex:       1,
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.success,
  },
  errorBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.sm,
    marginHorizontal:  theme.spacing.lg,
    marginTop:         theme.spacing.md,
    paddingVertical:   theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor:   theme.colors.surface,
    borderWidth:       1,
    borderColor:       theme.colors.error,
    borderRadius:      theme.radius.md,
  },
  errorText: {
    flex:       1,
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.error,
  },
});
