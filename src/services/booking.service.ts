import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
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

/** Resolve the client's Firebase uid from raw Firestore booking fields (supports legacy names). */
function resolveBookingClientUserId(
  raw: Record<string, unknown> | undefined,
): string | null {
  if (!raw) return null;
  const c = raw.clientId;
  if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  const u = raw.userId;
  if (typeof u === 'string' && u.trim().length > 0) return u.trim();
  const cu = raw.customerUserId;
  if (typeof cu === 'string' && cu.trim().length > 0) return cu.trim();
  return null;
}

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
  /**
   * Loyalty stamps: read loyaltyCount (default 0), increment; at 7 reset to 0 and set hasFreecut.
   * `clientUserId` is the client's Firebase Auth uid (field on booking: `clientId`, or legacy `userId` / `customerUserId`).
   */
  async incrementClientLoyalty(clientUserId: string): Promise<FirestoreResult<void>> {
    console.log('[loyalty] start for user:', clientUserId);
    try {
      const uid = (clientUserId ?? '').trim();
      if (!uid) {
        console.log('[loyalty] skip empty clientUserId');
        return { success: false, error: 'Missing client user id' };
      }

      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const snap = await getDoc(userRef);
      const readCount =
        snap.exists() && typeof snap.data()?.loyaltyCount === 'number'
          ? (snap.data()?.loyaltyCount as number)
          : 0;
      console.log('[loyalty] read loyaltyCount:', readCount, 'userDocExists:', snap.exists());

      const nextStamp = readCount + 1;
      let newCount: number;
      let hasFreecut: boolean | undefined;

      if (nextStamp >= 7) {
        newCount = 0;
        hasFreecut = true;
      } else {
        newCount = nextStamp;
        hasFreecut = undefined;
      }

      const patch: Record<string, unknown> = {
        loyaltyCount: newCount,
        updatedAt: serverTimestamp(),
      };
      if (hasFreecut === true) {
        patch.hasFreecut = true;
      }

      await setDoc(userRef, patch, { merge: true });
      console.log(
        '[loyalty] wrote loyaltyCount:',
        newCount,
        'hasFreecut:',
        hasFreecut === true ? true : '(unchanged)',
      );
      return { success: true, data: undefined };
    } catch (err) {
      console.error('[loyalty] FAILED:', err);
      return { success: false, error: String(err) };
    }
  },

  /**
   * One-time / admin: award loyalty for completed bookings missing `loyaltyAwarded`.
   */
  async backfillLoyaltyForCompletedBookings(): Promise<
    FirestoreResult<{ processed: number; skipped: number; errors: string[] }>
  > {
    console.log('[updateStatus] backfill loyalty scan start');
    try {
      const q = query(
        collection(db, COLLECTIONS.BOOKINGS),
        where('status', '==', 'completed'),
      );
      const snap = await getDocs(q);
      let processed = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const d of snap.docs) {
        const raw = d.data() as Record<string, unknown>;
        if (raw.loyaltyAwarded === true) {
          skipped += 1;
          continue;
        }
        const clientUserId = resolveBookingClientUserId(raw);
        if (!clientUserId) {
          errors.push(`${d.id}: no client uid on booking`);
          continue;
        }
        console.log('[updateStatus] backfill processing booking:', d.id, 'client:', clientUserId);
        const loy = await BookingService.incrementClientLoyalty(clientUserId);
        if (!loy.success) {
          errors.push(`${d.id}: ${loy.error}`);
          continue;
        }
        try {
          await updateDoc(doc(db, COLLECTIONS.BOOKINGS, d.id), {
            loyaltyAwarded: true,
            updatedAt: serverTimestamp(),
          });
          processed += 1;
        } catch (e) {
          console.error('[updateStatus] backfill FAILED flag booking:', d.id, e);
          errors.push(`${d.id}: loyaltyAwarded flag ${String(e)}`);
        }
      }

      console.log(
        '[updateStatus] backfill loyalty done processed:',
        processed,
        'skipped:',
        skipped,
      );
      return { success: true, data: { processed, skipped, errors } };
    } catch (err) {
      console.error('[updateStatus] backfill loyalty FAILED:', err);
      return { success: false, error: String(err) };
    }
  },

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
          ...(typeof saved.beforePhotoURL === 'string' && saved.beforePhotoURL.trim().length > 0
            ? { beforePhotoURL: saved.beforePhotoURL.trim() }
            : {}),
          ...(typeof saved.barberNotes === 'string' && saved.barberNotes.trim().length > 0
            ? { barberNotes: saved.barberNotes.trim() }
            : {}),
          ...(typeof saved.clientNote === 'string' && saved.clientNote.trim().length > 0
            ? { clientNote: saved.clientNote.trim() }
            : {}),
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
    console.log('[updateStatus] to:', payload.status, 'booking:', id);
    try {
      const bookingRef = doc(db, COLLECTIONS.BOOKINGS, id);
      const rawSnap = await getDoc(bookingRef);
      if (!rawSnap.exists()) {
        return { success: false, error: `Booking ${id} not found` };
      }
      const raw = rawSnap.data() as Record<string, unknown>;
      const loyaltyAlreadyAwarded = raw.loyaltyAwarded === true;
      const clientUserId = resolveBookingClientUserId(raw);

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
      await updateDoc(bookingRef, {
        status: payload.status,
        ...extra,
        updatedAt: serverTimestamp(),
      });

      // Award loyalty whenever the booking is (or stays) completed and has not been
      // stamped yet. Do NOT require prevStatus !== 'completed': if status was already
      // completed but a prior increment failed (e.g. rules not deployed), barber apps
      // often send { status: 'completed' } again — we must still stamp once.
      if (payload.status === 'completed') {
        if (loyaltyAlreadyAwarded) {
          console.log('[updateStatus] skip loyalty, already awarded booking:', id);
        } else if (!clientUserId) {
          console.log('[updateStatus] skip loyalty, no client uid on booking:', id);
        } else {
          console.log('[updateStatus] triggering loyalty for:', clientUserId);
          const loy = await BookingService.incrementClientLoyalty(clientUserId);
          if (loy.success) {
            try {
              await updateDoc(bookingRef, {
                loyaltyAwarded: true,
                updatedAt: serverTimestamp(),
              });
              console.log('[updateStatus] loyaltyAwarded set true booking:', id);
            } catch (err) {
              console.error('[updateStatus] FAILED setting loyaltyAwarded:', err);
            }
          } else {
            console.log('[updateStatus] loyalty increment failed:', loy.error);
          }
        }
      }

      return { success: true, data: undefined };
    } catch (e) {
      console.error('[updateStatus] FAILED:', e);
      return { success: false, error: String(e) };
    }
  },

  /**
   * If the client has an upcoming pending/confirmed booking, attach the requested look.
   * Otherwise store on the user document as `savedStyle` for when they book later.
   * Strips out optional fields that are undefined / empty so Firestore never
   * receives `undefined` (which would throw at write time).
   */
  async attachRequestedStyleForClient(
    clientId: string,
    requestedStyle: RequestedStyle,
  ): Promise<FirestoreResult<{ mode: 'booking' | 'saved'; bookingId?: string }>> {
    try {
      const cleaned: RequestedStyle = {
        name: requestedStyle.name,
        photoURL: requestedStyle.photoURL,
        description: requestedStyle.description,
        ...(typeof requestedStyle.beforePhotoURL === 'string' &&
        requestedStyle.beforePhotoURL.trim().length > 0
          ? { beforePhotoURL: requestedStyle.beforePhotoURL.trim() }
          : {}),
        ...(typeof requestedStyle.barberNotes === 'string' &&
        requestedStyle.barberNotes.trim().length > 0
          ? { barberNotes: requestedStyle.barberNotes.trim() }
          : {}),
        ...(typeof requestedStyle.clientNote === 'string' &&
        requestedStyle.clientNote.trim().length > 0
          ? { clientNote: requestedStyle.clientNote.trim() }
          : {}),
      };

      const listRes = await BookingService.getByClient(clientId);
      if (!listRes.success) {
        return { success: false, error: listRes.error };
      }
      const next = findNextUpcomingBooking(listRes.data);
      if (next) {
        await updateDoc(doc(db, COLLECTIONS.BOOKINGS, next.id), {
          requestedStyle: cleaned,
          updatedAt: serverTimestamp(),
        });
        return { success: true, data: { mode: 'booking', bookingId: next.id } };
      }
      await updateDoc(doc(db, COLLECTIONS.USERS, clientId), {
        savedStyle: { ...cleaned, savedAt: serverTimestamp() },
      });
      return { success: true, data: { mode: 'saved' } };
    } catch (e) {
      console.error('[attachRequestedStyleForClient] FAILED:', e);
      return { success: false, error: String(e) };
    }
  },
} as const;
