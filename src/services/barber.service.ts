import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Barber,
  CreateBarberPayload,
  UpdateBarberPayload,
} from '@/types/barber.types';
import { WorkingHours } from '@/types/common.types';
import { FirestoreResult } from '@/types/common.types';
import { barberConverter } from './firestore.converters';

const barbersCol = () =>
  collection(db, 'barbers').withConverter(barberConverter);

const barberDoc = (id: string) =>
  doc(db, 'barbers', id).withConverter(barberConverter);

export const BarberService = {
  async getById(id: string): Promise<FirestoreResult<Barber>> {
    try {
      const snap = await getDoc(barberDoc(id));
      if (!snap.exists()) {
        return { success: false, error: `Barber ${id} not found` };
      }
      return { success: true, data: snap.data() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getAll(): Promise<FirestoreResult<Barber[]>> {
    try {
      const snap = await getDocs(barbersCol());
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /**
   * Real-time listener for the entire `barbers` collection (admin / dashboards).
   */
  subscribeAll(callback: (barbers: Barber[]) => void): () => void {
    return onSnapshot(barbersCol(), (snap) => {
      callback(snap.docs.map((d) => d.data()));
    });
  },

  async getAvailable(): Promise<FirestoreResult<Barber[]>> {
    try {
      const q = query(barbersCol(), where('isAvailable', '==', true));
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async create(
    id: string,
    payload: CreateBarberPayload,
  ): Promise<FirestoreResult<Barber>> {
    try {
      const ref = barberDoc(id);
      await setDoc(ref, {
        ...payload,
        id,
        rating: 0,
        reviewCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as Barber);
      const snap = await getDoc(ref);
      return { success: true, data: snap.data()! };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async update(
    id: string,
    payload: UpdateBarberPayload,
  ): Promise<FirestoreResult<void>> {
    try {
      await updateDoc(barberDoc(id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  /**
   * Creates `barbers/{uid}` if missing, otherwise updates. Fixes Save when the doc
   * was never created (e.g. legacy accounts, admin-only user docs).
   */
  async saveProfile(
    uid: string,
    data: {
      displayName: string;
      bio: string;
      photoURL: string | null;
      specialties: string[];
      isAvailable: boolean;
      workingHours: WorkingHours;
    },
  ): Promise<FirestoreResult<void>> {
    try {
      const ref = barberDoc(uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const created = await this.create(uid, {
          userId: uid,
          displayName: data.displayName,
          bio: data.bio,
          specialties: data.specialties,
          photoURL: data.photoURL,
          isAvailable: data.isAvailable,
          workingHours: data.workingHours,
        });
        return created.success
          ? { success: true, data: undefined }
          : { success: false, error: created.error };
      }
      return await this.update(uid, {
        displayName: data.displayName,
        bio: data.bio,
        specialties: data.specialties,
        photoURL: data.photoURL,
        isAvailable: data.isAvailable,
        workingHours: data.workingHours,
      });
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
