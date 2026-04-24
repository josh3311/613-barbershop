import { Timestamp } from 'firebase/firestore';
import { UserRole, WithId } from './common.types';
import type { RequestedStyle } from './booking.types';

/** Saved virtual try-on result in `users/{uid}.savedTryOns` */
export interface SavedTryOn {
  resultUrl: string;
  styleName: string;
  selfieUrl: string;
  createdAt: string;
}

/**
 * Rich saved look stored in `users/{uid}.savedLooks`. Includes the original
 * selfie (before) AND the FLUX Kontext result (after) so the client can
 * review them later, share them in the AI chat, and book a style with the
 * full preview attached for the barber.
 */
export interface SavedLook {
  id: string;
  styleName: string;
  /** Base64 data URL of the original selfie */
  beforeUrl: string;
  /** FLUX Kontext result URL */
  afterUrl: string;
  /** Plain English description from the style card */
  styleDescription: string;
  /** Detailed barber instructions (guards, fade height, etc.) */
  barberNotes: string;
  /** ISO timestamp string when the look was saved (used by client UI for sorting / display) */
  savedAt: string;
}

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
  /** @deprecated Prefer loyaltyCount for stamp UI; may still exist on older docs */
  completedCuts?: number;
  /** @deprecated Legacy facial-steam milestone; prefer hasFreecut */
  loyaltyLastClaimedAtCut?: number;
  /** Loyalty stamp count toward free cut (0–6); resets when client earns a free cut */
  loyaltyCount?: number;
  /** When true, client earned a free haircut (every 7 completed visits) */
  hasFreecut?: boolean;
  /** When client has no upcoming booking but picked a style in AI chat */
  savedStyle?: RequestedStyle & { savedAt: Timestamp };
  /** AI virtual try-on gallery (latest first in UI) */
  savedTryOns?: SavedTryOn[];
  /** Rich before/after looks generated via FLUX Kontext, ordered newest-first in UI */
  savedLooks?: SavedLook[];
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
