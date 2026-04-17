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

  /** Updates Firebase Auth profile (display name + photo URL shown in Auth). */
  async updateAuthProfile(updates: {
    displayName?: string;
    photoURL?: string | null;
  }): Promise<FirestoreResult<void>> {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not signed in' };
    try {
      const profile: { displayName?: string | null; photoURL?: string | null } = {};
      if (updates.displayName !== undefined) profile.displayName = updates.displayName;
      if (updates.photoURL !== undefined) profile.photoURL = updates.photoURL;
      await updateProfile(user, profile);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
} as const;
