import { Timestamp } from 'firebase/firestore';
import { UserRole, WithId } from './common.types';

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
