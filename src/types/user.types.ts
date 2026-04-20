import { Timestamp } from 'firebase/firestore';
import { UserRole, WithId } from './common.types';
import type { RequestedStyle } from './booking.types';

/**
 * Firestore collection: `users`
 * One document per authenticated user.
 */
export interface User extends WithId {
  email: string;
  displayName: string;
  phone: string;
  photoURL: string | null;
  role: UserRole;
  /** Push token: Expo `ExponentPushToken[…]` string (stored in this field) or FCM if you migrate */
  fcmToken: string | null;
  /** Client birthday for rewards, `MM-DD` (no year) */
  birthday?: string | null;
  /** Count of completed haircuts (loyalty: every 7 = free facial steam) */
  completedCuts?: number;
  /** Last claimed loyalty milestone (multiples of 7 cuts); hides “earned” until next milestone */
  loyaltyLastClaimedAtCut?: number;
  /** When client has no upcoming booking but picked a style in AI chat */
  savedStyle?: RequestedStyle & { savedAt: Timestamp };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Payload for creating a new user document (id assigned after write).
 */
export type CreateUserPayload = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Payload for partial user profile updates.
 */
export type UpdateUserPayload = Partial<
  Pick<User, 'displayName' | 'phone' | 'photoURL' | 'fcmToken'>
>;
