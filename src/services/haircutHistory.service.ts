import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  HaircutHistory,
  CreateHaircutHistoryPayload,
  SubmitReviewPayload,
} from '@/types/haircutHistory.types';
import { FirestoreResult } from '@/types/common.types';
import { haircutHistoryConverter } from './firestore.converters';
import { barberConverter } from './firestore.converters';

const historyCol = () =>
  collection(db, 'haircutHistory').withConverter(haircutHistoryConverter);

const historyDoc = (id: string) =>
  doc(db, 'haircutHistory', id).withConverter(haircutHistoryConverter);

export const HaircutHistoryService = {
  async getById(id: string): Promise<FirestoreResult<HaircutHistory>> {
    try {
      const snap = await getDoc(historyDoc(id));
      if (!snap.exists()) {
        return { success: false, error: `HaircutHistory ${id} not found` };
      }
      return { success: true, data: snap.data() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByClient(clientId: string): Promise<FirestoreResult<HaircutHistory[]>> {
    try {
      const q = query(
        historyCol(),
        where('clientId', '==', clientId),
        orderBy('completedAt', 'desc'),
      );
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByBarber(barberId: string): Promise<FirestoreResult<HaircutHistory[]>> {
    try {
      const q = query(
        historyCol(),
        where('barberId', '==', barberId),
        orderBy('completedAt', 'desc'),
      );
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async create(
    payload: CreateHaircutHistoryPayload,
  ): Promise<FirestoreResult<HaircutHistory>> {
    try {
      const ref = await addDoc(collection(db, 'haircutHistory'), {
        ...payload,
        rating: null,
        review: null,
        reviewedAt: null,
        createdAt: serverTimestamp(),
      });
      const snap = await getDoc(
        doc(db, 'haircutHistory', ref.id).withConverter(haircutHistoryConverter),
      );
      return { success: true, data: snap.data()! };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /**
   * Submits a client review and atomically updates the barber's aggregate rating.
   * NOTE: For true atomicity on rating aggregation, migrate this to a Cloud Function.
   */
  async submitReview(
    historyId: string,
    barberId: string,
    payload: SubmitReviewPayload,
  ): Promise<FirestoreResult<void>> {
    try {
      await updateDoc(historyDoc(historyId), {
        rating: payload.rating,
        review: payload.review,
        reviewedAt: serverTimestamp(),
      });

      // Optimistic barber rating aggregation (approximate — exact via Cloud Function)
      const barberRef = doc(db, 'barbers', barberId).withConverter(barberConverter);
      const barberSnap = await getDoc(barberRef);
      if (barberSnap.exists()) {
        const { rating, reviewCount } = barberSnap.data();
        const newCount = reviewCount + 1;
        const newRating = (rating * reviewCount + payload.rating) / newCount;
        await updateDoc(barberRef, {
          rating: Math.round(newRating * 10) / 10,
          reviewCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
