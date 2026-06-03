/**
 * DateTimeSelectionScreen — V3
 *
 * Date/time selection, navigation to BookingConfirm unchanged.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { theme } from '../../theme';
import { AnimatedHeader, PremiumButton } from '../../components/ui';

interface Props { navigation: any; route: any; }

const HOURS = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30',
];

interface TimeSlotProps {
  time:       string;
  selected:   boolean;
  disabled:   boolean;
  onPress:    () => void;
}

const TimeSlot = React.memo(function TimeSlot(props: TimeSlotProps) {
  const { time, selected, disabled, onPress } = props;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <View
        style={[
          styles.timeSlot,
          selected && styles.timeSlotSelected,
          disabled && styles.timeSlotDisabled,
        ]}
      >
        <Text
          style={[
            styles.timeText,
            selected && styles.timeTextSelected,
            disabled && styles.timeTextDisabled,
          ]}
        >
          {time}
        </Text>
      </View>
    </Pressable>
  );
});

export default function DateTimeSelectionScreen({ navigation, route }: Props) {
  const { service, barber } = route.params;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const getDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const dates = getDates();

  const formatDay = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };
  const formatMonth = (date: Date) => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[date.getMonth()];
  };
  const isToday = (date: Date) =>
    date.toDateString() === new Date().toDateString();

  const isTimeDisabled = (time: string) => {
    if (!selectedDate) return false;
    const today = new Date();
    if (selectedDate.toDateString() !== today.toDateString()) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    return slotTime <= today;
  };

  const handleContinue = () => {
    if (!selectedDate || !selectedTime) return;
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledAt = new Date(selectedDate);
    scheduledAt.setHours(hours, minutes, 0, 0);
    navigation.navigate('BookingConfirm', {
      service, barber, scheduledAt: scheduledAt.toISOString(),
    });
  };

  return (
    <View style={styles.container}>
      <AnimatedHeader
        title="PICK DATE & TIME"
        eyebrow="STEP 3 OF 4"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '75%' }]} />
      </View>

      <View style={styles.pills}>
        <View style={styles.pill}>
          <Ionicons name="cut-outline" size={12} color={theme.colors.gold} />
          <Text style={styles.pillText}>{service.name}</Text>
        </View>
        <View style={styles.pill}>
          <Ionicons name="person-outline" size={12} color={theme.colors.gold} />
          <Text style={styles.pillText}>{barber.displayName}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>SELECT DATE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesRow}
        >
          {dates.map((date, i) => {
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            return (
              <Pressable
                key={i}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  setSelectedDate(date);
                  setSelectedTime(null);
                }}
              >
                <Text style={[styles.dateDay, isSelected && styles.dateDaySelected]}>
                  {isToday(date) ? 'TODAY' : formatDay(date)}
                </Text>
                <Text style={[styles.dateNum, isSelected && styles.dateNumSelected]}>
                  {date.getDate()}
                </Text>
                <Text style={[styles.dateMon, isSelected && styles.dateMonSelected]}>
                  {formatMonth(date)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {selectedDate && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>
              SELECT TIME
            </Text>
            <View style={styles.timesGrid}>
              {HOURS.map((time) => (
                <TimeSlot
                  key={time}
                  time={time}
                  selected={selectedTime === time}
                  disabled={isTimeDisabled(time)}
                  onPress={() => setSelectedTime(time)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <PremiumButton
          label={selectedDate && selectedTime
            ? `CONFIRM — ${selectedTime}`
            : 'SELECT DATE & TIME'}
          fullWidth
          disabled={!selectedDate || !selectedTime}
          onPress={handleContinue}
          rightIcon={selectedDate && selectedTime ? (
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textInverse} />
          ) : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  progressBar: {
    height:           3,
    backgroundColor:  theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    borderRadius:     theme.radius.full,
    marginBottom:     theme.spacing.md,
  },
  progressFill: {
    height:          '100%',
    backgroundColor: theme.colors.gold,
    borderRadius:    theme.radius.full,
  },

  pills: {
    flexDirection:    'row',
    gap:              theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom:     theme.spacing.lg,
  },
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.xs,
    backgroundColor:   theme.colors.goldMuted,
    borderWidth:       1,
    borderColor:       theme.colors.gold,
    borderRadius:      theme.radius.full,
    paddingVertical:   theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  pillText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 1,
  },

  sectionTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom:  theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  datesRow: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.lg,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    padding:         theme.spacing.md,
    alignItems:      'center',
    minWidth:        64,
    ...theme.shadows.md,
  },
  dateCardSelected: {
    borderColor:     theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  dateDay: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.textMuted,
    letterSpacing: 1,
  },
  dateDaySelected: { color: theme.colors.gold },
  dateNum: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xxl,
    color:      theme.colors.textPrimary,
    lineHeight: 32,
  },
  dateNumSelected: { color: theme.colors.gold },
  dateMon: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
  },
  dateMonSelected: { color: theme.colors.goldDark },

  timesGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  timeSlot: {
    backgroundColor:   theme.colors.surface,
    borderColor:       theme.colors.border,
    borderRadius:      theme.radius.md,
    borderWidth:       1,
    paddingVertical:   theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth:          80,
    alignItems:        'center',
  },
  timeSlotSelected: {
    backgroundColor: theme.colors.gold,
    borderColor:     theme.colors.gold,
  },
  timeSlotDisabled: { opacity: 0.3, borderColor: theme.colors.border },
  timeText: {
    fontFamily: theme.fonts.medium,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textPrimary,
  },
  timeTextSelected: { color: theme.colors.textInverse },
  timeTextDisabled: { color: theme.colors.textMuted },

  footer: {
    position:         'absolute',
    bottom:           0,
    left:             0,
    right:            0,
    padding:          theme.spacing.lg,
    paddingBottom:    theme.spacing.xl,
    backgroundColor:  theme.colors.background,
    borderTopWidth:   1,
    borderTopColor:   theme.colors.border,
  },
});
