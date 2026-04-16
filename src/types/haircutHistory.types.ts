import { Timestamp } from 'firebase/firestore';
import { WithId } from './common.types';

/**
 * Firestore collection: `haircutHistory`
 * Created when a booking transitions to `completed`.
 * Holds the permanent record, optional photos, and the client's review.
 */
export interface HaircutHistory extends WithId {
  /** Source booking that produced this record */
  bookingId: string;
  clientId: string;
  barberId: string;
  serviceId: string;
  completedAt: Timestamp;
  beforePhotoURL: string | null;
  afterPhotoURL: string | null;
  /** Barber's internal notes about the cut */
  notes: string | null;
  /** Client rating 1–5, null until review is submitted */
  rating: number | null;
  /** Client's written review text */
  review: string | null;
  /** Timestamp when the client submitted a rating/review */
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
}

export type CreateHaircutHistoryPayload = Omit<
  HaircutHistory,
  'id' | 'rating' | 'review' | 'reviewedAt' | 'createdAt'
>;

export interface SubmitReviewPayload {
  /** Integer 1–5 */
  rating: number;
  review: string | null;
}
