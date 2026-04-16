import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { User, CreateUserPayload, UpdateUserPayload } from '@/types/user.types';
import { FirestoreResult } from '@/types/common.types';
import { userConverter } from './firestore.converters';

const usersCol = () =>
  collection(db, 'users').withConverter(userConverter);

const userDoc = (uid: string) =>
  doc(db, 'users', uid).withConverter(userConverter);

export const UserService = {
  async getById(uid: string): Promise<FirestoreResult<User>> {
    try {
      const snap = await getDoc(userDoc(uid));
      if (!snap.exists()) {
        return { success: false, error: `User ${uid} not found` };
      }
      return { success: true, data: snap.data() };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async create(uid: string, payload: CreateUserPayload): Promise<FirestoreResult<User>> {
    try {
      const ref = doc(db, 'users', uid).withConverter(userConverter);
      await setDoc(ref, {
        ...payload,
        id: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } as User);
      const snap = await getDoc(ref);
      return { success: true, data: snap.data()! };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async getByRole(role: string): Promise<FirestoreResult<User[]>> {
    try {
      const q = query(usersCol(), where('role', '==', role));
      const snap = await getDocs(q);
      return { success: true, data: snap.docs.map((d) => d.data()) };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async update(uid: string, payload: UpdateUserPayload): Promise<FirestoreResult<void>> {
    try {
      await updateDoc(userDoc(uid), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
