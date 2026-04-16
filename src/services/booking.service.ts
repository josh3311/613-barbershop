import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Booking,
  BookingStatus,
  CreateBookingPayload,
  UpdateBookingStatusPayload,
} from '@/types/booking.types';
import { FirestoreResult } from '@/types/common.types';
import { bookingConverter } from './firestore.converters';

const toMs = (t: Timestamp | unknown): number =>
  t instanceof Timestamp ? t.toMillis() : Number(t);

const bookingsCol = () =>
  collection(db, 'bookings').withConverter(bookingConverter);

const bookingDoc = (id: string) =>
  doc(db, 'bookings', id).withConverter(bookingConverter);

export const BookingService = {
  async getById(id: string): Promise<FirestoreResult<Booking>> {
    try {
      const snap = await getDoc(bookingDoc(id));
      if (!snap.exists()) {
        return { success: false, error: `Booking ${id} not found` };
      }
      return { success: true, data: snap.data() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByClient(clientId: string): Promise<FirestoreResult<Booking[]>> {
    try {
      // Single-field query — no composite index required
      const q = query(
        bookingsCol(),
        where('clientId', '==', clientId),
      );
      const snap = await getDocs(q);
      // Sort newest-first in JS to avoid needing a composite Firestore index
      const docs = snap.docs
        .map((d) => d.data())
        .sort((a, b) => {
          const at = a.scheduledAt instanceof Timestamp ? a.scheduledAt.toMillis() : Number(a.scheduledAt);
          const bt = b.scheduledAt instanceof Timestamp ? b.scheduledAt.toMillis() : Number(b.scheduledAt);
          return bt - at;
        });
      return { success: true, data: docs };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByBarber(barberId: string): Promise<FirestoreResult<Booking[]>> {
    try {
      // Single-field filter — no composite index required; sort in JS
      const q = query(bookingsCol(), where('barberId', '==', barberId));
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map((d) => d.data())
        .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
      return { success: true, data: sorted };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByBarberAndDate(
    barberId: string,
    date: Date,
  ): Promise<FirestoreResult<Booking[]>> {
    try {
      // Single-field filter + JS date filter — avoids composite index
      const q = query(bookingsCol(), where('barberId', '==', barberId));
      const snap = await getDocs(q);
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      const filtered = snap.docs
        .map((d) => d.data())
        .filter((b) => {
          const ms = toMs(b.scheduledAt);
          return ms >= start.getTime() && ms <= end.getTime();
        })
        .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
      return { success: true, data: filtered };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /**
   * Real-time listener for a client's bookings.
   * Returns an unsubscribe function — call it on component unmount.
   */
  onSnapshotByClient(
    clientId: string,
    callback: (bookings: Booking[]) => void,
    onError?: (e: Error) => void,
  ): () => void {
    const q = query(bookingsCol(), where('clientId', '==', clientId));
    return onSnapshot(
      q,
      (snap) => {
        const sorted = snap.docs
          .map((d) => d.data())
          .sort((a, b) => toMs(b.scheduledAt) - toMs(a.scheduledAt)); // newest first
        callback(sorted);
      },
      onError,
    );
  },

  /**
   * Real-time listener for a barber's bookings.
   * Returns an unsubscribe function — call it on component unmount.
   */
  onSnapshotByBarber(
    barberId: string,
    callback: (bookings: Booking[]) => void,
    onError?: (e: Error) => void,
  ): () => void {
    const q = query(bookingsCol(), where('barberId', '==', barberId));
    return onSnapshot(
      q,
      (snap) => {
        const sorted = snap.docs
          .map((d) => d.data())
          .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
        callback(sorted);
      },
      onError,
    );
  },

  async create(payload: CreateBookingPayload): Promise<FirestoreResult<Booking>> {
    try {
      const ref = await addDoc(collection(db, 'bookings'), {
        ...payload,
        status: 'pending' as BookingStatus,
        cancelledAt:        null,
        cancelledBy:        null,
        cancellationReason: null,
        confirmedAt:        null,
        declinedAt:         null,
        declinedReason:     null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(
        doc(db, 'bookings', ref.id).withConverter(bookingConverter),
      );
      return { success: true, data: snap.data()! };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async updateStatus(
    id: string,
    payload: UpdateBookingStatusPayload,
  ): Promise<FirestoreResult<void>> {
    try {
      const extra: Record<string, unknown> = {};

      if (payload.status === 'cancelled') {
        extra.cancelledAt         = serverTimestamp();
        extra.cancelledBy         = payload.cancelledBy ?? null;
        extra.cancellationReason  = payload.cancellationReason ?? null;
      }
      if (payload.status === 'confirmed') {
        extra.confirmedAt = serverTimestamp();
        // TODO: Send push notification to client when status changes to 'confirmed'
      }
      if (payload.status === 'declined') {
        extra.declinedAt     = serverTimestamp();
        extra.declinedReason = payload.declinedReason ?? null;
        // TODO: Send push notification to client when booking is declined
      }

      await updateDoc(bookingDoc(id), {
        status: payload.status,
        ...extra,
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
