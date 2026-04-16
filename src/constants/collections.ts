/**
 * Firestore collection name constants.
 * Use these instead of raw strings to prevent typos.
 */
export const COLLECTIONS = {
  USERS: 'users',
  BARBERS: 'barbers',
  SERVICES: 'services',
  BOOKINGS: 'bookings',
  HAIRCUT_HISTORY: 'haircutHistory',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
