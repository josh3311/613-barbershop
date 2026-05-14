import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import {
  collection, query, where, onSnapshot, orderBy,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Booking, HaircutStyle } from '../../types';
import { theme } from '../../theme';
import ClientWantsSection from '../../components/ClientWantsSection';

// ── Generate next 7 days ──────────────────────────────────────
const getWeek = (): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
};

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate();

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':   return theme.colors.warning;
    case 'confirmed': return theme.colors.success;
    case 'completed': return theme.colors.gold;
    case 'cancelled': return theme.colors.error;
    default:          return theme.colors.textMuted;
  }
};

const GUIDE_SYSTEM_PROMPT =
  'You are an expert barber trainer. Write clearly and professionally for barbers of all skill levels. Plain English only. No markdown, no asterisks, no hashtags, no bullet points. Short numbered steps if helpful, separated by blank lines.';

interface ActiveGuide {
  bookingId: string;
  style:     HaircutStyle;
}

export default function BarberScheduleScreen() {
  const { user } = useAuth();
  const week = getWeek();

  const [selectedDay, setSelectedDay] = useState<Date>(week[0]);
  const [bookings,    setBookings]    = useState<Booking[]>([]);
  const [loading,     setLoading]     = useState(true);

  // ── Guide modal state ──
  const [activeGuide,  setActiveGuide]  = useState<ActiveGuide | null>(null);
  const [guideCache,   setGuideCache]   = useState<Record<string, string>>({});
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError,   setGuideError]   = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, COLLECTIONS.BOOKINGS),
      where('barberId', '==', user.id),
      orderBy('scheduledAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setBookings(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking)));
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  // Filter bookings for the selected day
  const dayBookings = bookings.filter(
    b => b.scheduledAt && isSameDay(b.scheduledAt, selectedDay)
  );

  const dayRevenue = dayBookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.servicePrice ?? 0), 0);

  const isToday = (date: Date) => isSameDay(date, new Date());

  // ── Fetch Haiku-generated style guide ──
  const fetchGuide = useCallback(async (bookingId: string, style: HaircutStyle) => {
    setGuideLoading(true);
    setGuideError(null);

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setGuideError('API key not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env and restart Expo.');
      setGuideLoading(false);
      return;
    }

    const descriptionLine =
      typeof style.description === 'string' && style.description.trim().length > 0
        ? `Description: ${style.description}.`
        : '';

    const userMessage =
      `Explain clearly how to execute this haircut: ${style.name}.\n` +
      `${descriptionLine}\n` +
      `Write short steps in plain English. No markdown.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                 apiKey,
          'anthropic-version':                         '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system:     GUIDE_SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userMessage }],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.content?.[0]?.text) {
        setGuideError('Could not generate the guide. Please try again.');
        return;
      }

      const text = data.content[0].text as string;
      setGuideCache(prev => ({ ...prev, [bookingId]: text }));
    } catch {
      setGuideError('Network error. Please check your connection and try again.');
    } finally {
      setGuideLoading(false);
    }
  }, []);

  const openGuide = (bookingId: string, style: HaircutStyle) => {
    const name = style?.name;
    if (typeof name !== 'string' || name.trim().length === 0) return;
    setActiveGuide({ bookingId, style });
    setGuideError(null);
    // Fetch only if we don't already have this guide cached
    if (!guideCache[bookingId]) {
      fetchGuide(bookingId, style);
    }
  };

  const closeGuide = () => {
    setActiveGuide(null);
    setGuideError(null);
    setGuideLoading(false);
  };

  const retryGuide = () => {
    if (!activeGuide) return;
    fetchGuide(activeGuide.bookingId, activeGuide.style);
  };

  const cachedGuideText = activeGuide ? guideCache[activeGuide.bookingId] : undefined;

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Your Schedule</Text>
        <Text style={styles.title}>WEEK VIEW</Text>
      </View>

      {/* ── Day picker ── */}
      <View style={styles.weekRow}>
        {week.map((day, i) => {
          const isSelected = isSameDay(day, selectedDay);
          const count = bookings.filter(
            b => b.scheduledAt && isSameDay(b.scheduledAt, day) && b.status !== 'cancelled'
          ).length;

          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayCard, isSelected && styles.dayCardSelected]}
              onPress={() => setSelectedDay(day)}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {isToday(day) ? 'NOW' : DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {day.getDate()}
              </Text>
              {count > 0 && (
                <View style={[styles.dot, isSelected && styles.dotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Selected day header ── */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {isToday(selectedDay) ? 'TODAY' : selectedDay.toLocaleDateString([], {
            weekday: 'long', month: 'long', day: 'numeric'
          }).toUpperCase()}
        </Text>
        {dayRevenue > 0 && (
          <View style={styles.revenueTag}>
            <Text style={styles.revenueText}>${dayRevenue}</Text>
          </View>
        )}
      </View>

      {/* ── Bookings list ── */}
      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          size="large"
          style={styles.loader}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {dayBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No bookings</Text>
              <Text style={styles.emptySub}>
                {isToday(selectedDay)
                  ? 'Nothing scheduled for today'
                  : 'Nothing scheduled for this day'}
              </Text>
            </View>
          ) : (
            dayBookings.map(booking => (
              <View key={booking.id} style={styles.bookingCard}>

                {/* Time column */}
                <View style={styles.timeCol}>
                  <Text style={styles.timeText}>
                    {formatTime(booking.scheduledAt)}
                  </Text>
                  <View style={[
                    styles.statusLine,
                    { backgroundColor: getStatusColor(booking.status) }
                  ]} />
                </View>

                {/* Card */}
                <View style={[
                  styles.cardBody,
                  { borderLeftColor: getStatusColor(booking.status) }
                ]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.clientName}>{booking.clientName}</Text>
                    <Text style={styles.price}>${booking.servicePrice}</Text>
                  </View>
                  <Text style={styles.serviceName}>{booking.serviceName}</Text>
                  <View style={styles.cardBottom}>
                    <View style={[
                      styles.statusBadge,
                      { borderColor: getStatusColor(booking.status) }
                    ]}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(booking.status) }
                      ]} />
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(booking.status) }
                      ]}>
                        {booking.status.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.duration}>
                      {booking.servicePrice ? `${booking.servicePrice >= 40 ? '60' : '30'} min` : ''}
                    </Text>
                  </View>

                  {booking.requestedStyle && booking.requestedStyle.name ? (
                    <ClientWantsSection
                      style={booking.requestedStyle}
                      onShowGuide={() =>
                        booking.requestedStyle &&
                        openGuide(booking.id, booking.requestedStyle)
                      }
                    />
                  ) : null}
                </View>

              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── HOW TO DO THIS STYLE modal ── */}
      <Modal
        visible={activeGuide !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={closeGuide}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={2}>
              {activeGuide ? `HOW TO DO: ${activeGuide.style.name}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={closeGuide}
            >
              <Ionicons name="close" size={24} color={theme.colors.gold} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}
          >
            {guideLoading ? (
              <View style={styles.guideLoadingWrap}>
                <ActivityIndicator size="large" color={theme.colors.gold} />
                <Text style={styles.guideLoadingText}>Generating guide...</Text>
              </View>
            ) : guideError ? (
              <View style={styles.guideErrorWrap}>
                <Ionicons
                  name="alert-circle-outline"
                  size={32}
                  color={theme.colors.error}
                />
                <Text style={styles.guideErrorText}>{guideError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={retryGuide}>
                  <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : cachedGuideText ? (
              <Text style={styles.guideText}>{cachedGuideText}</Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  greeting: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },

  // ── Week row ──
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  dayCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 2,
  },
  dayCardSelected: {
    backgroundColor: theme.colors.goldMuted,
    borderColor: theme.colors.gold,
  },
  dayName: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  dayNameSelected: {
    color: theme.colors.gold,
  },
  dayNum: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
  },
  dayNumSelected: {
    color: theme.colors.gold,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.textMuted,
    marginTop: 1,
  },
  dotSelected: {
    backgroundColor: theme.colors.gold,
  },

  // ── Day header ──
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  dayTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 3,
  },
  revenueTag: {
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: 3,
    paddingHorizontal: theme.spacing.sm,
  },
  revenueText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.gold,
  },

  loader: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
  },

  // ── Booking card ──
  bookingCard: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  timeCol: {
    width: 52,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  statusLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
    borderRadius: 1,
    opacity: 0.4,
  },
  cardBody: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    padding: theme.spacing.md,
    gap: 4,
    ...theme.shadows.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clientName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
  },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.gold,
  },
  serviceName: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: theme.fonts.medium,
    fontSize: 9,
    letterSpacing: 1,
  },
  duration: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
  },
  emptySub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // ── Guide modal ──
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    flex: 1,
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
    letterSpacing: 3,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  guideLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  guideLoadingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  guideErrorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.error,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  guideErrorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  retryBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  guideText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },
});
