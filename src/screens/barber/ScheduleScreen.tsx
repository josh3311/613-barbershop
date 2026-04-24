/**
 * ScheduleScreen.tsx
 *
 * Redesigned schedule screen with:
 * - Date strip: horizontal scroll, selected=gold pill bg
 * - Booking slots with status badges and action buttons
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Modal,
  Image,
  Pressable,
  Animated,
} from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';

import {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  icons,
  animations,
} from '@/theme';
import { BookingService } from '@/services/booking.service';
import { AIBarberGuideService, type BarberCutStep } from '@/services/aiBarberGuide.service';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { Booking, BookingStatus } from '@/types/booking.types';
import { safeToDate } from '@/utils/date.utils';
import { useAuth } from '@/hooks/useAuth';

// ─── Theme Constants ──────────────────────────────────────────────────────────

const C = {
  bg: colors.background,
  surface: colors.surface,
  surfaceRaised: colors.surfaceRaised,
  border: colors.border,
  gold: colors.gold,
  goldDim: colors.goldDim,
  green: colors.green,
  red: colors.red,
  white: colors.white,
  grey: colors.grey,
  greyDark: colors.greyDark,
  goldGlow: colors.goldGlow,
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_CFG: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: C.gold, bg: `${C.gold}20` },
  confirmed: { label: 'Confirmed', color: C.green, bg: `${C.green}20` },
  in_progress: { label: 'In Chair', color: '#2196F3', bg: '#2196F320' },
  completed: { label: 'Completed', color: C.greyDark, bg: `${C.greyDark}20` },
  declined: { label: 'Declined', color: C.red, bg: `${C.red}20` },
  cancelled: { label: 'Cancelled', color: C.red, bg: `${C.red}20` },
  no_show: { label: 'No Show', color: C.red, bg: `${C.red}20` },
};

const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Cut',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWeek(): Date[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h < 12 ? 'AM' : 'PM';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${m === 0 ? '00' : m < 10 ? '0' + m : m} ${period}`;
}

// ─── Date Strip Component ───────────────────────────────────────────────────

function DateStrip({
  week,
  selectedIndex,
  onSelect,
  bookings,
}: {
  week: Date[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  bookings: Booking[];
}) {
  const today = new Date();

  return (
    <View style={styles.dateStripContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateStrip}
      >
        {week.map((date, index) => {
          const isSelected = index === selectedIndex;
          const isToday = isSameDay(date, today);
          const dayBookings = bookings.filter((b) => isSameDay(safeToDate(b.scheduledAt), date));
          const hasBookings = dayBookings.length > 0;

          return (
            <DateStripButton
              key={index}
              date={date}
              index={index}
              isSelected={isSelected}
              isToday={isToday}
              hasBookings={hasBookings}
              onSelect={onSelect}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function DateStripButton({
  date,
  index,
  isSelected,
  isToday,
  hasBookings,
  onSelect,
}: {
  date: Date;
  index: number;
  isSelected: boolean;
  isToday: boolean;
  hasBookings: boolean;
  onSelect: (index: number) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  };

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <TouchableOpacity
      onPress={() => onSelect(index)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.dateButton,
        isSelected && styles.dateButtonSelected,
        animatedStyle,
      ]}
    >
      <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
        {isToday ? 'Today' : DAYS_SHORT[date.getDay()]}
      </Text>
      <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
        {date.getDate()}
      </Text>
      <View style={styles.pipContainer}>
        {hasBookings ? (
          <View style={[styles.pip, isSelected && styles.pipSelected]} />
        ) : (
          <View style={styles.pipEmpty} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Booking Card Component ───────────────────────────────────────────────────

function BookingCard({
  booking,
  onPatchStatus,
  onCompleteToast,
  index,
}: {
  booking: Booking;
  onPatchStatus: (id: string, status: BookingStatus) => void;
  onCompleteToast: () => void;
  index: number;
}) {
  const [styleModal, setStyleModal] = useState(false);
  const [guideModal, setGuideModal] = useState(false);
  const [guideSteps, setGuideSteps] = useState<BarberCutStep[] | null>(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideErr, setGuideErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cfg = STATUS_CFG[booking.status] ?? STATUS_CFG.pending;
  const time = formatTime(safeToDate(booking.scheduledAt));
  const svcName = SERVICE_NAMES[booking.serviceId] ?? booking.serviceId;
  const clientName = booking.clientName ?? booking.clientId.substring(0, 8);

  const isTerminal =
    booking.status === 'completed' ||
    booking.status === 'declined' ||
    booking.status === 'cancelled' ||
    booking.status === 'no_show';

  async function handleConfirm(): Promise<void> {
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'confirmed');
    const res = await BookingService.updateStatus(booking.id, { status: 'confirmed' });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    }
    setBusy(false);
  }

  async function handleDecline(): Promise<void> {
    const msg = `Decline this appointment?\n\nThis will notify ${clientName} that their booking has been declined.`;
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm(msg)
        : await new Promise<boolean>((resolve) => {
            Alert.alert('Decline Appointment?', msg, [
              { text: 'Keep', onPress: () => resolve(false) },
              { text: 'Decline', style: 'destructive', onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'declined');
    const res = await BookingService.updateStatus(booking.id, {
      status: 'declined',
      declinedReason: 'Barber unavailable',
    });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    }
    setBusy(false);
  }

  async function handleInChair(): Promise<void> {
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'in_progress');
    const res = await BookingService.updateStatus(booking.id, { status: 'in_progress' });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    }
    setBusy(false);
  }

  async function handleComplete(): Promise<void> {
    const prev = booking.status;
    setBusy(true);
    onPatchStatus(booking.id, 'completed');
    const res = await BookingService.updateStatus(booking.id, { status: 'completed' });
    if (!res.success) {
      onPatchStatus(booking.id, prev);
      Alert.alert('Could not update', res.error ?? 'Try again.');
    } else {
      onCompleteToast();
    }
    setBusy(false);
  }

  async function openCutGuide(): Promise<void> {
    const rs = booking.requestedStyle;
    if (!rs) return;
    setGuideBusy(true);
    setGuideErr(null);
    try {
      let hairTexture = 'varied';
      const snap = await getDoc(doc(db, COLLECTIONS.USERS, booking.clientId));
      const prof = snap.data()?.styleProfile as { profile?: Record<string, unknown> } | undefined;
      const p = prof?.profile;
      if (p) {
        const ht = p.hair_texture ?? p.hairTexture;
        if (typeof ht === 'string' && ht.trim()) {
          hairTexture = ht.trim();
        }
      }
      const guide = await AIBarberGuideService.getCutInstructions(rs.name, hairTexture);
      setGuideSteps(guide.steps);
      setStyleModal(false);
      setGuideModal(true);
    } catch (e) {
      setGuideErr(e instanceof Error ? e.message : 'Could not load instructions.');
    } finally {
      setGuideBusy(false);
    }
  }

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 80;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [index]);

  const cardAnimatedStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.bookingCard, isTerminal && styles.bookingCardTerminal, cardAnimatedStyle]}
        onPressIn={() => {
          Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
        }}
        activeOpacity={1}
      >
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardBody}>
          {/* Header: Time + Status */}
          <View style={styles.cardHeader}>
            <Text style={[styles.timeText, isTerminal && { color: C.greyDark }]}>{time}</Text>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Client */}
          <Text style={[styles.clientName, isTerminal && { color: C.greyDark }]}>{clientName}</Text>

          {/* Requested Style */}
          {booking.requestedStyle && (
            <TouchableOpacity
              style={styles.styleRow}
              onPress={() => setStyleModal(true)}
              activeOpacity={0.85}
            >
              <Image source={{ uri: booking.requestedStyle.photoURL }} style={styles.styleThumb} />
              <View style={styles.styleTextCol}>
                <Text style={styles.styleWantsText} numberOfLines={2}>
                  Client wants: {booking.requestedStyle.name}
                </Text>
                {booking.requestedStyle.barberNotes ? (
                  <Text style={styles.styleNotes} numberOfLines={3}>
                    {booking.requestedStyle.barberNotes}
                  </Text>
                ) : null}
              </View>
              <Ionicons name={icons.forward} size={18} color={C.gold} />
            </TouchableOpacity>
          )}

          {/* Service Info */}
          <View style={styles.serviceRow}>
            <Ionicons name="cut-outline" size={12} color={C.grey} style={{ marginRight: 4 }} />
            <Text style={styles.serviceText}>{svcName}</Text>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="time-outline" size={12} color={C.grey} style={{ marginRight: 3 }} />
            <Text style={styles.serviceText}>{booking.durationMinutes} min</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={[styles.serviceText, styles.priceText]}>${booking.price}</Text>
          </View>

          {/* Action Buttons */}
          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator size={18} color={C.gold} />
              <Text style={styles.busyText}>Updating...</Text>
            </View>
          ) : booking.status === 'pending' ? (
            <View style={styles.actionRow}>
              {/* Confirm: green outline */}
              <TouchableOpacity style={[styles.actionBtn, styles.confirmOutline]} onPress={handleConfirm}>
                <Ionicons name={icons.checkOutline} size={16} color={C.green} style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: C.green }]}>Confirm</Text>
              </TouchableOpacity>

              {/* Decline: red outline */}
              <TouchableOpacity style={[styles.actionBtn, styles.declineOutline]} onPress={handleDecline}>
                <Ionicons name={icons.close} size={16} color={C.red} style={{ marginRight: 6 }} />
                <Text style={[styles.actionBtnText, { color: C.red }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : booking.status === 'confirmed' ? (
            <View style={styles.actionRow}>
              {/* In Chair: gold filled */}
              <TouchableOpacity style={[styles.actionBtn, styles.inChairBtn]} onPress={handleInChair}>
                <Text style={styles.inChairText}>In Chair</Text>
              </TouchableOpacity>

              {/* Complete: green filled */}
              <TouchableOpacity style={[styles.actionBtn, styles.completeBtn]} onPress={handleComplete}>
                <Ionicons name={icons.checkOutline} size={16} color={C.bg} style={{ marginRight: 6 }} />
                <Text style={styles.completeText}>Complete</Text>
              </TouchableOpacity>
            </View>
          ) : booking.status === 'in_progress' ? (
            <TouchableOpacity style={[styles.fullWidthBtn, styles.completeBtn]} onPress={handleComplete}>
              <Ionicons name={icons.checkOutline} size={18} color={C.bg} style={{ marginRight: 8 }} />
              <Text style={styles.fullWidthBtnText}>Complete</Text>
            </TouchableOpacity>
          ) : null}

          {/* Declined Note */}
          {booking.status === 'declined' && (
            <View style={styles.declinedNote}>
              <Ionicons name={icons.information} size={13} color={C.red} style={{ marginRight: 6 }} />
              <Text style={styles.declinedNoteText}>Booking declined - client has been notified.</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Style Modal */}
      <Modal
        visible={styleModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setStyleModal(false);
          setGuideErr(null);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setStyleModal(false);
            setGuideErr(null);
          }}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{booking.requestedStyle?.name}</Text>
            {booking.requestedStyle && (
              <Image
                source={{ uri: booking.requestedStyle.photoURL }}
                style={styles.modalPhoto}
                resizeMode="cover"
              />
            )}
            <Text style={styles.modalDesc}>{booking.requestedStyle?.description}</Text>
            {booking.requestedStyle?.barberNotes ? (
              <View style={styles.modalNotesBlock}>
                <Text style={styles.modalNotesLabel}>Barber notes</Text>
                <Text style={styles.modalNotesBody}>{booking.requestedStyle.barberNotes}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.guideBtn} onPress={() => void openCutGuide()} disabled={guideBusy}>
              {guideBusy ? (
                <ActivityIndicator color={C.bg} size="small" />
              ) : (
                <Text style={styles.guideBtnText}>How do I do this cut?</Text>
              )}
            </TouchableOpacity>
            {guideErr ? <Text style={styles.guideErr}>{guideErr}</Text> : null}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setStyleModal(false);
                setGuideErr(null);
              }}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Guide Modal */}
      <Modal
        visible={guideModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setGuideModal(false);
          setGuideSteps(null);
        }}
      >
        <View style={styles.guideModalRoot}>
          <View style={styles.guideModalHeader}>
            <Text style={styles.guideModalTitle}>Step-by-step</Text>
            <TouchableOpacity
              onPress={() => {
                setGuideModal(false);
                setGuideSteps(null);
              }}
            >
              <Ionicons name={icons.close} size={26} color={C.white} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.guideScroll} showsVerticalScrollIndicator={false}>
            {guideSteps && guideSteps.length === 0 && (
              <Text style={styles.guideEmpty}>No steps came back. Try again in a moment.</Text>
            )}
            {(guideSteps ?? []).map((step) => (
              <View key={step.number} style={styles.stepCard}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{step.number}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.description}</Text>
                  {step.tools ? <Text style={styles.stepTools}>Tools: {step.tools}</Text> : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ScheduleScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { appUser, firebaseUser } = useAuth();

  const week = buildWeek();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [completeSnack, setCompleteSnack] = useState(false);

  const firstName = (appUser?.displayName ?? 'Barber').split(' ')[0];

  // Animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const dateLabelFadeAnim = useRef(new Animated.Value(0)).current;
  const earningsFadeAnim = useRef(new Animated.Value(0)).current;
  const earningsSlideAnim = useRef(new Animated.Value(20)).current;
  const emptyFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    Animated.timing(dateLabelFadeAnim, { toValue: 1, duration: 300, delay: 200, useNativeDriver: true }).start();
  }, []);

  function patchBookingStatus(bookingId: string, status: BookingStatus): void {
    setAllBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
  }

  // Real-time listener
  useEffect(() => {
    if (!firebaseUser) return;
    setLoading(true);
    const unsubscribe = BookingService.onSnapshotByBarber(
      firebaseUser.uid,
      (bookings) => {
        setAllBookings(bookings);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [firebaseUser]);

  const selectedDay = week[selectedIndex];
  const dayBookings = allBookings
    .filter((b) => isSameDay(safeToDate(b.scheduledAt), selectedDay))
    .sort((a, b) => safeToDate(a.scheduledAt).getTime() - safeToDate(b.scheduledAt).getTime());

  const confirmed = dayBookings.filter((b) => ['confirmed', 'in_progress', 'completed'].includes(b.status)).length;
  const pending = dayBookings.filter((b) => b.status === 'pending').length;
  const earnings = dayBookings
    .filter((b) => ['confirmed', 'in_progress', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + b.price, 0);

  // Animate earnings bar when day bookings change
  useEffect(() => {
    if (dayBookings.length > 0) {
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(earningsFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(earningsSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dayBookings.length]);

  // Animate empty state
  useEffect(() => {
    if (!loading && dayBookings.length === 0) {
      const timer = setTimeout(() => {
        Animated.timing(emptyFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, dayBookings.length]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
        <View>
          <Text style={styles.headerEyebrow}>MY SCHEDULE</Text>
          <Text style={styles.headerTitle}>{firstName}'s Schedule</Text>
        </View>
        <View style={styles.headerBadges}>
          {confirmed > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: `${C.green}20`, borderColor: C.green }]}>
              <Text style={[styles.headerBadgeText, { color: C.green }]}>{confirmed} confirmed</Text>
            </View>
          )}
          {pending > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: `${C.gold}20`, borderColor: C.gold }]}>
              <Text style={[styles.headerBadgeText, { color: C.gold }]}>{pending} pending</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Date Strip */}
      <DateStrip week={week} selectedIndex={selectedIndex} onSelect={setSelectedIndex} bookings={allBookings} />

      {/* Date Label */}
      <Animated.View style={{ opacity: dateLabelFadeAnim }}>
        <Text style={styles.dateLabel}>
          {DAYS_SHORT[selectedDay.getDay()]}, {MONTHS[selectedDay.getMonth()]} {selectedDay.getDate()}
          {selectedIndex === 0 ? ' — Today' : ''}
        </Text>
      </Animated.View>

      {/* Earnings Bar */}
      {dayBookings.length > 0 && (
        <Animated.View style={[styles.earningsBar, { opacity: earningsFadeAnim, transform: [{ translateY: earningsSlideAnim }] }]}>
          <Ionicons name="cash-outline" size={18} color={C.gold} />
          <Text style={styles.earningsText}>
            Estimated earnings: <Text style={styles.earningsValue}>${earnings}</Text>
          </Text>
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={28} color={C.gold} />
          <Text style={styles.loadingText}>Loading schedule...</Text>
        </View>
      ) : dayBookings.length === 0 ? (
        <Animated.View style={[styles.emptyContainer, { opacity: emptyFadeAnim }]}>
          <Ionicons name={icons.tabBookOutline} size={56} color={C.greyDark} />
          <Text style={styles.emptyTitle}>No appointments</Text>
          <Text style={styles.emptySubtitle}>
            {selectedIndex === 0
              ? 'You have no bookings today. Clients can book you from the app.'
              : 'No bookings on this day yet.'}
          </Text>
        </Animated.View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {dayBookings.map((booking, index) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onPatchStatus={patchBookingStatus}
              onCompleteToast={() => setCompleteSnack(true)}
              index={index}
            />
          ))}
        </ScrollView>
      )}

      {/* Snackbar */}
      <Snackbar
        visible={completeSnack}
        onDismiss={() => setCompleteSnack(false)}
        duration={2200}
        style={styles.snackbar}
        wrapperStyle={{ paddingHorizontal: spacing.lg }}
      >
        <Text style={styles.snackbarText}>Booking completed successfully</Text>
      </Snackbar>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerEyebrow: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    letterSpacing: fonts.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['3xl'],
    color: C.white,
    letterSpacing: fonts.letterSpacing.tight,
  },
  headerBadges: {
    gap: spacing.xs,
    alignItems: 'flex-end',
  },
  headerBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
  },

  // Date Strip
  dateStripContainer: {
    marginBottom: spacing.md,
  },
  dateStrip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dateButton: {
    width: 56,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  dateButtonSelected: {
    backgroundColor: C.gold,
    borderColor: C.gold,
    ...shadows.gold,
  },
  dayName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wide,
  },
  dayNameSelected: {
    color: C.bg,
  },
  dayNumber: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['2xl'],
    color: C.white,
    letterSpacing: fonts.letterSpacing.tight,
  },
  dayNumberSelected: {
    color: C.bg,
  },
  pipContainer: {
    height: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pip: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.gold,
  },
  pipSelected: {
    backgroundColor: C.bg,
    opacity: 0.5,
  },
  pipEmpty: {
    width: 5,
    height: 5,
  },

  // Date Label
  dateLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.sm,
    color: C.grey,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Earnings Bar
  earningsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: C.goldGlow,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  earningsText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },
  earningsValue: {
    fontFamily: fonts.bodyBold,
    color: C.gold,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
    paddingTop: spacing['3xl'],
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xl,
    color: C.white,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Booking Card
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  bookingCardTerminal: {
    opacity: 0.7,
  },
  cardAccent: {
    width: 3,
  },
  cardBody: {
    flex: 1,
    padding: spacing.lg,
  },

  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
  },
  statusBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statusText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    textTransform: 'uppercase',
    letterSpacing: fonts.letterSpacing.wide,
  },

  // Card Body
  clientName: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.white,
    marginBottom: spacing.sm,
  },

  // Style Row
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.goldGlow,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: C.gold,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  styleThumb: {
    width: 50,
    height: 50,
    borderRadius: radius.sm,
    backgroundColor: C.surfaceRaised,
  },
  styleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  styleWantsText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.white,
  },
  styleNotes: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
    marginTop: spacing.xs,
    lineHeight: 16,
  },

  // Service Row
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: spacing.md,
  },
  serviceText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },
  dot: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.greyDark,
    marginHorizontal: 2,
  },
  priceText: {
    fontFamily: fonts.bodyBold,
    color: C.gold,
  },

  // Actions
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  busyText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius['2xl'],
  },
  actionBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
  },

  // Button Variants
  confirmOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.green,
  },
  declineOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: C.red,
  },
  inChairBtn: {
    backgroundColor: C.gold,
    borderWidth: 0,
  },
  inChairText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },
  completeBtn: {
    backgroundColor: C.green,
    borderWidth: 0,
  },
  completeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },

  fullWidthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius['2xl'],
  },
  fullWidthBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.bg,
  },

  // Declined Note
  declinedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${C.red}15`,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  declinedNoteText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.red,
    flex: 1,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.gold,
    padding: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size.xl,
    color: C.white,
    marginBottom: spacing.md,
  },
  modalPhoto: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: C.surfaceRaised,
    marginBottom: spacing.md,
  },
  modalDesc: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalNotesBlock: {
    marginBottom: spacing.md,
    width: '100%',
  },
  modalNotesLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.gold,
    letterSpacing: fonts.letterSpacing.wide,
    marginBottom: spacing.xs,
  },
  modalNotesBody: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.white,
    lineHeight: 20,
  },
  guideBtn: {
    backgroundColor: C.gold,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  guideBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.bg,
  },
  guideErr: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.red,
    marginBottom: spacing.sm,
  },
  modalClose: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  modalCloseText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.gold,
  },

  // Guide Modal
  guideModalRoot: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: 52,
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  guideModalTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size.xl,
    color: C.gold,
  },
  guideScroll: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  guideEmpty: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.gold,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  stepNum: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: C.goldGlow,
    borderWidth: 1,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.gold,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
    marginBottom: spacing.xs,
  },
  stepDesc: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  stepTools: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    color: C.gold,
  },

  // Snackbar
  snackbar: {
    backgroundColor: C.gold,
    borderRadius: radius.md,
  },
  snackbarText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.bg,
  },
});
