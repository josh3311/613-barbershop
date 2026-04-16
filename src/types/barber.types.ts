import { Timestamp } from 'firebase/firestore';
import { WithId, WorkingHours } from './common.types';

/**
 * Firestore collection: `barbers`
 * Extends user data with barber-specific professional info.
 * `id` mirrors the corresponding `users` document id.
 */
export interface Barber extends WithId {
  /** Reference to the matching `users` document */
  userId: string;
  displayName: string;
  bio: string;
  specialties: string[];
  photoURL: string | null;
  /** Aggregate average rating (1–5), recomputed on review write */
  rating: number;
  reviewCount: number;
  isAvailable: boolean;
  workingHours: WorkingHours;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateBarberPayload = Omit<
  Barber,
  'id' | 'rating' | 'reviewCount' | 'createdAt' | 'updatedAt'
>;

export type UpdateBarberPayload = Partial<
  Pick<
    Barber,
    'displayName' | 'bio' | 'specialties' | 'photoURL' | 'isAvailable' | 'workingHours'
  >
>;
