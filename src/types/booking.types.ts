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

/** Client-chosen look from AI Style chat, shown to the barber on the schedule */
export type RequestedStyle = {
  name: string;
  photoURL: string;
  description: string;
};

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
  /** Barber marks loyalty facial-steam reward redeemed on this visit */
  rewardClaimed?: boolean;
  /** From AI Style — what the client asked their barber to prepare for */
  requestedStyle?: RequestedStyle;
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
  | 'rewardClaimed'
  | 'createdAt'
  | 'updatedAt'
>;

export type UpdateBookingStatusPayload = {
  status: BookingStatus;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  declinedReason?: string;
  /** When completing a visit, barber can mark that the client redeemed their loyalty reward */
  rewardClaimed?: boolean;
};
