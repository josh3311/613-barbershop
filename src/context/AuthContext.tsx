import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { COLLECTIONS } from '../constants/collections';
import { User } from '../types';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface AuthContextType {
  user:          User | null;
  firebaseUser:  FirebaseUser | null;
  loading:       boolean;
  profileLoaded: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user:          null,
  firebaseUser:  null,
  loading:       true,
  profileLoaded: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [loading, setLoading]           = useState<boolean>(true);
  const [profileLoaded, setProfileLoaded] = useState<boolean>(false);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);

      // Tear down the previous profile listener whenever auth changes.
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!fbUser) {
        setUser(null);
        setProfileLoaded(true);
        setLoading(false);
        return;
      }

      const userRef = doc(db, COLLECTIONS.USERS, fbUser.uid);
      let pushRegistered = false;
      unsubProfile = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setUser({ id: snap.id, ...snap.data() } as User);
        } else {
          setUser(null);
        }
        setProfileLoaded(true);
        setLoading(false);

        // Register for push notifications once per session — failures
        // must never block auth, so swallow them silently.
        if (snap.exists() && !pushRegistered) {
          pushRegistered = true;
          registerForPushNotificationsAsync(snap.id).catch(e => {
            console.log('Push registration failed (non-critical):', e);
          });
        }
      });
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, profileLoaded }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
