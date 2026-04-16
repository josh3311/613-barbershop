import { Timestamp } from 'firebase/firestore';

/** Convert a Firebase Timestamp to a JS Date */
export function toDate(timestamp: Timestamp): Date {
  return timestamp.toDate();
}

/** Convert a JS Date to a Firebase Timestamp */
export function toTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

/** Format a Firebase Timestamp as a locale date string */
export function formatDate(
  timestamp: Timestamp,
  locale = 'en-CA',
  options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  return timestamp.toDate().toLocaleDateString(locale, options);
}

/** Format a Firebase Timestamp as a locale time string */
export function formatTime(
  timestamp: Timestamp,
  locale = 'en-CA',
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return timestamp.toDate().toLocaleTimeString(locale, options);
}

/** Returns true if two Timestamps fall on the same calendar day */
export function isSameDay(a: Timestamp, b: Timestamp): boolean {
  const da = a.toDate();
  const db = b.toDate();
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}
