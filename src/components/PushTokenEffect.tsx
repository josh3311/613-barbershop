import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PushService } from '@/services/push.service';

/**
 * Registers Expo push token on the signed-in user's Firestore document once per session.
 */
export function PushTokenEffect(): null {
  const { firebaseUser, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser?.uid) return;
    void PushService.register(firebaseUser.uid);
  }, [isAuthenticated, firebaseUser?.uid]);

  return null;
}
