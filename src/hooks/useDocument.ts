import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
} from 'firebase/firestore';

interface DocumentState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Real-time subscription for a single Firestore document.
 *
 * @example
 * const ref = doc(db, 'users', uid).withConverter(userConverter);
 * const { data: user, isLoading } = useDocument<User>(ref);
 */
export function useDocument<T extends DocumentData>(
  docRef: DocumentReference<T> | null,
): DocumentState<T> {
  const [state, setState] = useState<DocumentState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });

  const docPath = docRef?.path ?? null;

  useEffect(() => {
    if (!docRef) {
      setState({ data: null, isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setState({
          data: snapshot.exists() ? snapshot.data() : null,
          isLoading: false,
          error: null,
        });
      },
      (err) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message,
        }));
      },
    );

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPath]);

  return state;
}
