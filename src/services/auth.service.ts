import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { FirestoreResult } from '@/types/common.types';

export const AuthService = {
  async register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<FirestoreResult<FirebaseUser>> {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      return { success: true, data: credential.user };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async login(
    email: string,
    password: string,
  ): Promise<FirestoreResult<FirebaseUser>> {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, data: credential.user };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async logout(): Promise<FirestoreResult<void>> {
    try {
      await signOut(auth);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async sendPasswordReset(email: string): Promise<FirestoreResult<void>> {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  },
} as const;
