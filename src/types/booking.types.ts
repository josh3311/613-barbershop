import { Timestamp } from 'firebase/firestore';
import { WithId } from './common.types';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type CancelledBy = 'client' | 'barber' | 'admin';

/**
 * Firestore collection: `bookings`
 * Single appointment between a client and a barber.
 */
export interface Booking extends WithId {
  clientId: string;
  /** Denormalized display name saved at booking time */
  clientName?: string;
  barberId: string;
  /** Denormalized display name saved at booking time */
  barberName?: string;
  serviceId: string;
  status: BookingStatus;
  /** The scheduled start time of the appointment */
  scheduledAt: Timestamp;
  durationMinutes: number;
  /** Price snapshot at time of booking (may differ from service.price if edited) */
  price: number;
  notes: string | null;
  cancelledAt: Timestamp | null;
  cancelledBy: CancelledBy | null;
  cancellationReason: string | null;
  /** Set when barber confirms the booking */
  confirmedAt: Timestamp | null;
  /** Set when barber declines the booking */
  declinedAt: Timestamp | null;
  /** Optional reason provided when barber declines */
  declinedReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CreateBookingPayload = Omit<
  Booking,
  | 'id'
  | 'status'
  | 'cancelledAt'
  | 'cancelledBy'
  | 'cancellationReason'
  | 'confirmedAt'
  | 'declinedAt'
  | 'declinedReason'
  | 'createdAt'
  | 'updatedAt'
>;

export type UpdateBookingStatusPayload = {
  status: BookingStatus;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  declinedReason?: string;
};
