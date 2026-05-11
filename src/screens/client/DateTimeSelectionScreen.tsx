import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

interface Props {
  navigation: any;
  route:      any;
}

const HOURS = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30',
];

export default function DateTimeSelectionScreen({ navigation, route }: Props) {
  const { service, barber } = route.params;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Generate next 14 days
  const getDates = () => {
    const dates = [];
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

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTimeDisabled = (time: string) => {
    if (!selectedDate) return false;
    const today = new Date();
    const isTodaySelected = selectedDate.toDateString() === today.toDateString();
    if (!isTodaySelected) return false;
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
      service,
      barber,
      scheduledAt: scheduledAt.toISOString(),
    });
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <View>
          <Text style={styles.stepText}>STEP 3 OF 4</Text>
          <Text style={styles.title}>PICK DATE & TIME</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '75%' }]} />
      </View>

      {/* Pills */}
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

        {/* Date Picker */}
        <Text style={styles.sectionTitle}>SELECT DATE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesRow}
        >
          {dates.map((date, i) => {
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            return (
              <TouchableOpacity
                key={i}
                style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                onPress={() => {
                  setSelectedDate(date);
                  setSelectedTime(null);
                }}
              >
                <Text style={[
                  styles.dateDay,
                  isSelected && styles.dateDaySelected
                ]}>
                  {isToday(date) ? 'TODAY' : formatDay(date)}
                </Text>
                <Text style={[
                  styles.dateNum,
                  isSelected && styles.dateNumSelected
                ]}>
                  {date.getDate()}
                </Text>
                <Text style={[
                  styles.dateMon,
                  isSelected && styles.dateMonSelected
                ]}>
                  {formatMonth(date)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Slots */}
        {selectedDate && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: theme.spacing.xl }]}>
              SELECT TIME
            </Text>
            <View style={styles.timesGrid}>
              {HOURS.map((time, i) => {
                const isSelected = selectedTime === time;
                const disabled   = isTimeDisabled(time);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.timeSlot,
                      isSelected && styles.timeSlotSelected,
                      disabled   && styles.timeSlotDisabled,
                    ]}
                    onPress={() => !disabled && setSelectedTime(time)}
                    disabled={disabled}
                  >
                    <Text style={[
                      styles.timeText,
                      isSelected && styles.timeTextSelected,
                      disabled   && styles.timeTextDisabled,
                    ]}>
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.button,
            (!selectedDate || !selectedTime) && styles.buttonDisabled
          ]}
          onPress={handleContinue}
          disabled={!selectedDate || !selectedTime}
        >
          <Text style={styles.buttonText}>
            {selectedDate && selectedTime
              ? `CONFIRM — ${selectedTime}`
              : 'SELECT DATE & TIME'}
          </Text>
          {selectedDate && selectedTime && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={theme.colors.textInverse}
            />
          )}
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
    marginBottom: theme.spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.full,
  },
  pills: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  pillText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 1,
  },
  sectionTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 4,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  datesRow: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  dateCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    minWidth: 64,
    ...theme.shadows.md,
  },
  dateCardSelected: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  dateDay: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  dateDaySelected: {
    color: theme.colors.gold,
  },
  dateNum: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    lineHeight: 32,
  },
  dateNumSelected: {
    color: theme.colors.gold,
  },
  dateMon: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  dateMonSelected: {
    color: theme.colors.goldDark,
  },
  timesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  timeSlot: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  timeSlotDisabled: {
    opacity: 0.3,
    borderColor: theme.colors.border,
  },
  timeText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textPrimary,
  },
  timeTextSelected: {
    color: theme.colors.textInverse,
    fontFamily: theme.fonts.bold,
  },
  timeTextDisabled: {
    color: theme.colors.textMuted,
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
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
});