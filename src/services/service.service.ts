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
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import {
  Service,
  CreateServicePayload,
  UpdateServicePayload,
  ServiceCategory,
} from '@/types/service.types';
import { FirestoreResult } from '@/types/common.types';
import { serviceConverter } from './firestore.converters';

const servicesCol = () =>
  collection(db, 'services').withConverter(serviceConverter);

const serviceDoc = (id: string) =>
  doc(db, 'services', id).withConverter(serviceConverter);

export const ServiceService = {
  async getById(id: string): Promise<FirestoreResult<Service>> {
    try {
      const snap = await getDoc(serviceDoc(id));
      if (!snap.exists()) {
        return { success: false, error: `Service ${id} not found` };
      }
      return { success: true, data: snap.data() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getAll(): Promise<FirestoreResult<Service[]>> {
    try {
      const q = query(servicesCol(), where('isActive', '==', true));
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByCategory(
    category: ServiceCategory,
  ): Promise<FirestoreResult<Service[]>> {
    try {
      const q = query(
        servicesCol(),
        where('category', '==', category),
        where('isActive', '==', true),
      );
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async create(payload: CreateServicePayload): Promise<FirestoreResult<Service>> {
    try {
      const ref = await addDoc(collection(db, 'services'), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(
        doc(db, 'services', ref.id).withConverter(serviceConverter),
      );
      return { success: true, data: snap.data()! };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async update(
    id: string,
    payload: UpdateServicePayload,
  ): Promise<FirestoreResult<void>> {
    try {
      await updateDoc(serviceDoc(id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
