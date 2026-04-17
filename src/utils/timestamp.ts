import { Timestamp } from 'firebase/firestore';
import { safeToDate } from './date.utils';

/** Convert a Firebase Timestamp to a JS Date */
export function toDate(timestamp: Timestamp | null | undefined): Date {
  return safeToDate(timestamp);
}

/** Convert a JS Date to a Firebase Timestamp */
export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Format a Firebase Timestamp as a locale date string */
export function formatDate(
  timestamp: Timestamp | null | undefined,
  locale = 'en-CA',
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  return safeToDate(timestamp).toLocaleDateString(locale, options);
}

/** Format a Firebase Timestamp as a locale time string */
export function formatTime(
  timestamp: Timestamp | null | undefined,
  locale = 'en-CA',
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return safeToDate(timestamp).toLocaleTimeString(locale, options);
}

/** Returns true if two Timestamps fall on the same calendar day */
export function isSameDay(a: Timestamp | null | undefined, b: Timestamp | null | undefined): boolean {
  const da = safeToDate(a);
  const db = safeToDate(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
