/**
 * Admin-only Firestore listeners. Requires `users/{uid}.role === 'admin'` in rules.
 * Uses a collection snapshot and filters to "today" in JS to avoid extra composite indexes.
 */

import {
  collection,
  onSnapshot,
  query,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Booking } from '@/types/booking.types';
import { bookingConverter } from './firestore.converters';
import { safeToDate } from '@/utils/date.utils';
const bookingsCol = () =>
  collection(db, 'bookings').withConverter(bookingConverter);

const toMs = (t: Timestamp | null | undefined): number =>
  safeToDate(t ?? null).getTime();

function startEndOfLocalDay(d: Date): { start: Date; end: Date } {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function filterBookingsForDay(bookings: Booking[], day: Date): Booking[] {
  const { start, end } = startEndOfLocalDay(day);
  const a = start.getTime();
  const b = end.getTime();
  return bookings.filter((bk) => {
    const ms = toMs(bk.scheduledAt);
    return ms >= a && ms <= b;
  });
}

/**
 * Real-time listener: all bookings, filtered to the given calendar day (local timezone).
 */
export function subscribeBookingsForDay(
  day: Date,
  onNext: (bookings: Booking[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(bookingsCol());
  return onSnapshot(
    q,
    (snap) => {
      const all = snap.docs.map((d) => d.data());
      onNext(filterBookingsForDay(all, day));
    },
    (err) => onError?.(err as Error),
  );
}
