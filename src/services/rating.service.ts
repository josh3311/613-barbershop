import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { RatingData } from '@/types/rating.types';

export const RatingService = {
  /**
   * Persists a rating document, then recomputes the barber's aggregate rating and review count.
   */
  async submitRating(data: RatingData): Promise<void> {
    const ratingsRef = collection(db, COLLECTIONS.RATINGS);
    await addDoc(ratingsRef, {
      bookingId: data.bookingId,
      clientId: data.clientId,
      barberId: data.barberId,
      rating: data.rating,
      comment: data.comment,
      createdAt: serverTimestamp(),
    });

    const barberRef = doc(db, COLLECTIONS.BARBERS, data.barberId);
    let currentRating = 0;
    let currentCount = 0;
    try {
      const barberSnap = await getDoc(barberRef);
      if (barberSnap.exists()) {
        const raw = barberSnap.data();
        currentRating = typeof raw?.rating === 'number' ? raw.rating : 0;
        currentCount = typeof raw?.reviewCount === 'number' ? raw.reviewCount : 0;
      }
    } catch (e) {
      console.warn('[RatingService] could not read barber doc for aggregate:', e);
    }

    const newCount = currentCount + 1;
    const newAvg =
      (currentRating * currentCount + data.rating) / newCount;

    try {
      await setDoc(
        barberRef,
        {
          rating: Math.round(newAvg * 10) / 10,
          reviewCount: newCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      console.error('[RatingService] barber aggregate update failed:', e);
    }
  },

  async hasRated(bookingId: string): Promise<boolean> {
    const q = query(
      collection(db, COLLECTIONS.RATINGS),
      where('bookingId', '==', bookingId),
      limit(1),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  },
} as const;
