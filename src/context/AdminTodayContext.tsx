import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeBookingsForDay } from '@/services/admin.service';
import { BarberService } from '@/services/barber.service';
import { Booking } from '@/types/booking.types';
import { Barber } from '@/types/barber.types';

interface AdminTodayValue {
  todayBookings: Booking[];
  barbersById: Map<string, Barber>;
  loading: boolean;
  error: string | null;
}

const AdminTodayContext = createContext<AdminTodayValue | null>(null);

export function AdminTodayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [barbersById, setBarbersById] = useState<Map<string, Barber>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubBookings = subscribeBookingsForDay(
      new Date(),
      (list) => {
        setTodayBookings(list);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );

    const unsubBarbers = BarberService.subscribeAll((list) => {
      setBarbersById(new Map(list.map((b) => [b.id, b])));
    });

    return () => {
      unsubBookings();
      unsubBarbers();
    };
  }, []);

  const value = useMemo<AdminTodayValue>(
    () => ({
      todayBookings,
      barbersById,
      loading,
      error,
    }),
    [todayBookings, barbersById, loading, error],
  );

  return (
    <AdminTodayContext.Provider value={value}>{children}</AdminTodayContext.Provider>
  );
}

export function useAdminToday(): AdminTodayValue {
  const ctx = useContext(AdminTodayContext);
  if (!ctx) {
    throw new Error('useAdminToday must be used within AdminTodayProvider');
  }
  return ctx;
}
