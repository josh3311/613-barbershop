import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { UserService } from '@/services/user.service';
import { User } from '@/types/user.types';

interface AuthState {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * True once the Firestore profile fetch has completed (success OR failure).
   * RootNavigator waits for this before routing so it always has the correct role.
   */
  profileLoaded: boolean;
}

interface AuthReturn extends AuthState {
  /** Re-fetches the Firestore user profile and updates state. */
  refreshUser: () => Promise<void>;
}

export function useAuth(): AuthReturn {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    appUser: null,
    isLoading: true,
    isAuthenticated: false,
    profileLoaded: false,
  });

  const firebaseUserRef = useRef<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      firebaseUserRef.current = firebaseUser;

      if (!firebaseUser) {
        setState({
          firebaseUser: null,
          appUser: null,
          isLoading: false,
          isAuthenticated: false,
          profileLoaded: true, // no profile to load — resolved immediately
        });
        return;
      }

      // Mark auth as ready, but keep profileLoaded: false while we fetch the role
      setState({
        firebaseUser,
        appUser: null,
        isLoading: false,
        isAuthenticated: true,
        profileLoaded: false,
      });

      // Fetch Firestore profile with one automatic retry (handles registration
      // race-condition where Auth fires before the Firestore doc is written).
      const fetchProfile = async (attempt = 1): Promise<void> => {
        try {
          const result = await UserService.getById(firebaseUser.uid);
          if (result.success && result.data) {
            setState(prev => ({ ...prev, appUser: result.data, profileLoaded: true }));
          } else if (attempt < 3) {
            // Doc not written yet — wait briefly and retry
            await new Promise(r => setTimeout(r, 600 * attempt));
            return fetchProfile(attempt + 1);
          } else {
            // Give up — default to client role
            setState(prev => ({ ...prev, profileLoaded: true }));
          }
        } catch {
          if (attempt < 3) {
            await new Promise(r => setTimeout(r, 600 * attempt));
            return fetchProfile(attempt + 1);
          }
          setState(prev => ({ ...prev, profileLoaded: true }));
        }
      };
      fetchProfile();
    });

    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    const user = firebaseUserRef.current;
    if (!user) return;
    try {
      const result = await UserService.getById(user.uid);
      if (result.success) {
        setState(prev => ({ ...prev, appUser: result.data }));
      }
    } catch {
      // silently ignore refresh errors
    }
  }, []);

  return { ...state, refreshUser };
}
