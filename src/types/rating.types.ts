/**
 * Firestore collection: `ratings`
 * One document per client rating tied to a completed booking.
 */
export interface RatingData {
  bookingId: string;
  clientId: string;
  barberId: string;
  /** Integer 1–5 */
  rating: number;
  comment: string;
}
