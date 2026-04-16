import { Timestamp } from 'firebase/firestore';

export interface TimestampedDocument {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WithId {
  id: string;
}

export type UserRole = 'client' | 'barber' | 'admin';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * HH:mm formatted time string, e.g. "09:00", "17:30"
 */
export type TimeString = string;

export interface DaySchedule {
  isWorking: boolean;
  startTime: TimeString;
  endTime: TimeString;
  breakStart?: TimeString;
  breakEnd?: TimeString;
}

export type WorkingHours = Record<DayOfWeek, DaySchedule>;

/**
 * Generic Firestore API response wrapper used by all service methods.
 */
export type FirestoreResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
