export const APP_NAME = '613 Barbershop';

/** Minimum minutes between bookable time slots */
export const SLOT_INTERVAL_MINUTES = 15;

/** Business hours fallback (overridden per-barber in Firestore) */
export const DEFAULT_OPEN_TIME = '09:00';
export const DEFAULT_CLOSE_TIME = '18:00';

/** How far ahead clients can book (in days) */
export const MAX_BOOKING_ADVANCE_DAYS = 30;

/** Rating constraints */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Storage paths */
export const STORAGE_PATHS = {
  USER_AVATARS: 'avatars/users',
  BARBER_AVATARS: 'avatars/barbers',
  HAIRCUT_PHOTOS: 'haircuts',
  SERVICE_IMAGES: 'services',
} as const;
