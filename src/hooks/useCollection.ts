import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreDataConverter,
} from 'firebase/firestore';

interface CollectionState<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Real-time Firestore collection subscription.
 * Accepts any typed Query and returns live data through `onSnapshot`.
 *
 * @example
 * const q = query(collection(db,'bookings').withConverter(bookingConverter), where('clientId','==',uid));
 * const { data, isLoading } = useCollection<Booking>(q);
 */
export function useCollection<T extends DocumentData>(
  queryRef: Query<T> | null,
): CollectionState<T> {
  const [state, setState] = useState<CollectionState<T>>({
    data: [],
    isLoading: true,
    error: null,
  });

  // Keep a stable reference so the effect doesn't re-run on every render
  const queryRefStr = queryRef ? JSON.stringify(queryRef) : null;

  useEffect(() => {
    if (!queryRef) {
      setState({ data: [], isLoading: false, error: null });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        setState({
          data: snapshot.docs.map((d) => d.data()),
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
  }, [queryRefStr]);

  return state;
}
