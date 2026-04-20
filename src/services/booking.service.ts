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
  increment,
  deleteField,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import {
  Booking,
  BookingStatus,
  CreateBookingPayload,
  RequestedStyle,
  UpdateBookingStatusPayload,
} from '@/types/booking.types';
import { FirestoreResult } from '@/types/common.types';
import { bookingConverter } from './firestore.converters';
import { safeToDate } from '@/utils/date.utils';

const toMs = (t: Timestamp | null | undefined | unknown): number => {
  if (t instanceof Timestamp || t === null || t === undefined) {
    return safeToDate(t as Timestamp | null | undefined).getTime();
  }
  return Number(t);
};

function findNextUpcomingBooking(bookings: Booking[]): Booking | null {
  const now = Date.now();
  const eligible = bookings.filter((b) => {
    if (b.status !== 'pending' && b.status !== 'confirmed' && b.status !== 'in_progress') {
      return false;
    }
    if (b.status === 'in_progress') return true;
    const start = toMs(b.scheduledAt);
    const end = start + (b.durationMinutes ?? 45) * 60_000;
    return start >= now || (now >= start && now <= end);
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
  return eligible[0];
}

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
          const at = toMs(a.scheduledAt);
          const bt = toMs(b.scheduledAt);
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
      const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, payload.clientId));
      const saved = userSnap.data()?.savedStyle as RequestedStyle & { savedAt?: unknown } | undefined;
      const hasSaved =
        saved &&
        typeof saved.name === 'string' &&
        typeof saved.photoURL === 'string' &&
        typeof saved.description === 'string';

      const bookingPayload: Record<string, unknown> = {
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
      };

      if (hasSaved) {
        bookingPayload.requestedStyle = {
          name: saved.name,
          photoURL: saved.photoURL,
          description: saved.description,
        };
      }

      const ref = await addDoc(collection(db, 'bookings'), bookingPayload);
      const snap = await getDoc(
        doc(db, 'bookings', ref.id).withConverter(bookingConverter),
      );

      if (hasSaved) {
        await updateDoc(doc(db, COLLECTIONS.USERS, payload.clientId), {
          savedStyle: deleteField(),
        });
      }

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
      const snap = await getDoc(bookingDoc(id));
      const prev = snap.exists() ? snap.data() : null;
      const prevStatus = prev?.status;
      const clientId = prev?.clientId;

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
      if (payload.rewardClaimed === true) {
        extra.rewardClaimed = true;
      }

      // Plain doc path: partial updates must not go through bookingConverter.toFirestore
      // (which would spread the full model and can break or omit fields).
      await updateDoc(doc(db, COLLECTIONS.BOOKINGS, id), {
        status: payload.status,
        ...extra,
        updatedAt: serverTimestamp(),
      });

      if (
        payload.status === 'completed' &&
        prevStatus !== 'completed' &&
        clientId
      ) {
        await updateDoc(doc(db, COLLECTIONS.USERS, clientId), {
          completedCuts: increment(1),
        });
      }

      if (payload.rewardClaimed === true && clientId) {
        const userSnap = await getDoc(doc(db, COLLECTIONS.USERS, clientId));
        const cuts = typeof userSnap.data()?.completedCuts === 'number'
          ? (userSnap.data()?.completedCuts as number)
          : 0;
        const milestone = Math.floor(cuts / 7) * 7;
        await updateDoc(doc(db, COLLECTIONS.USERS, clientId), {
          loyaltyLastClaimedAtCut: milestone,
        });
      }

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /**
   * If the client has an upcoming pending/confirmed booking, attach the requested look.
   * Otherwise store on the user document as `savedStyle` for when they book later.
   */
  async attachRequestedStyleForClient(
    clientId: string,
    requestedStyle: RequestedStyle,
  ): Promise<FirestoreResult<{ mode: 'booking' | 'saved'; bookingId?: string }>> {
    try {
      const listRes = await BookingService.getByClient(clientId);
      if (!listRes.success) {
        return { success: false, error: listRes.error };
      }
      const next = findNextUpcomingBooking(listRes.data);
      if (next) {
        await updateDoc(doc(db, COLLECTIONS.BOOKINGS, next.id), {
          requestedStyle,
          updatedAt: serverTimestamp(),
        });
        return { success: true, data: { mode: 'booking', bookingId: next.id } };
      }
      await updateDoc(doc(db, COLLECTIONS.USERS, clientId), {
        savedStyle: { ...requestedStyle, savedAt: serverTimestamp() },
      });
      return { success: true, data: { mode: 'saved' } };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
