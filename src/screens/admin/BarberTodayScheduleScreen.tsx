import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAdminToday } from '@/context/AdminTodayContext';
import { AdminStackParamList } from '@/navigation/types';
import { Booking, BookingStatus } from '@/types/booking.types';
import { safeFormatTime } from '@/utils/date.utils';
const SERVICE_NAMES: Record<string, string> = {
  s1: 'Fade',
  s2: 'Lineup',
  s3: 'Beard Trim',
  s4: 'Haircut',
  s5: 'Beard + Haircut',
};

const C = {
  bg:     '#0A0A0A',
  card:   '#141414',
  border: '#252525',
  gold:   '#D4AF37',
  white:  '#FFFFFF',
  sub:    '#888888',
  orange: '#FFA500',
  green:  '#4CAF50',
  red:    '#FF4444',
  grey:   '#666666',
  blue:   '#2196F3',
} as const;

const STATUS_STYLE: Record<
  BookingStatus,
  { label: string; color: string; bg: string }
> = {
  pending:     { label: 'Pending',     color: C.orange, bg: '#1A1000' },
  confirmed:   { label: 'Confirmed',   color: C.green,  bg: '#0D200D' },
  declined:  { label: 'Declined',    color: C.red,    bg: '#2A0A0A' },
  in_progress: { label: 'In chair',   color: C.blue,   bg: '#0A1520' },
  completed: { label: 'Completed',   color: C.grey,   bg: '#1A1A1A' },
  cancelled: { label: 'Cancelled',     color: C.red,    bg: '#2A0A0A' },
  no_show:   { label: 'No show',       color: C.red,    bg: '#2A0A0A' },
};

type Props = NativeStackScreenProps<AdminStackParamList, 'BarberTodaySchedule'>;

export default function BarberTodayScheduleScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { barberId, barberName } = route.params;
  const { todayBookings } = useAdminToday();

  const list = useMemo(() => {
    return todayBookings
      .filter((b) => b.barberId === barberId)
      .sort((a, b) => {
        const at = a.scheduledAt?.toMillis?.() ?? 0;
        const bt = b.scheduledAt?.toMillis?.() ?? 0;
        return at - bt;
      });
  }, [todayBookings, barberId]);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
        >
          <Ionicons name="chevron-back" size={24} color={C.gold} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title} numberOfLines={1}>
            {barberName}
          </Text>
          <Text style={s.subtitle}>Today&apos;s schedule</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.headerLine} />

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <Text style={s.empty}>No bookings for this barber today.</Text>
        }
        renderItem={({ item }) => {
          const meta = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
          const svc = SERVICE_NAMES[item.serviceId] ?? item.serviceId;
          const client = item.clientName ?? 'Client';
          const time = safeFormatTime(item.scheduledAt);
          return (
            <View style={s.row}>
              <View style={s.rowTop}>
                <Text style={s.clientName} numberOfLines={1}>
                  {client}
                </Text>
                <View style={[s.badge, { borderColor: meta.color + '55', backgroundColor: meta.bg }]}>
                  <Text style={[s.badgeText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>
              <Text style={s.serviceLine}>{svc}</Text>
              <Text style={s.timeLine}>{time}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, alignItems: 'center' },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: C.white,
    maxWidth: '90%',
  },
  subtitle: { fontSize: 11, color: C.sub, marginTop: 2 },
  headerLine: {
    height: 1,
    backgroundColor: C.border,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  row: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  clientName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: C.white,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  serviceLine: { fontSize: 13, color: C.gold, fontWeight: '600', marginBottom: 4 },
  timeLine: { fontSize: 12, color: C.sub, fontWeight: '600' },
  empty: {
    textAlign: 'center',
    color: C.sub,
    marginTop: 40,
    fontSize: 14,
  },
});
