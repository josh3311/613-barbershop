/**
 * Firestore data converters enforce strict typing at the SDK boundary.
 * Every collection gets its own converter so `withConverter` calls
 * return the exact domain type instead of `DocumentData`.
 */

import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  serverTimestamp,
  WithFieldValue,
  DocumentData,
} from 'firebase/firestore';
import { User } from '@/types/user.types';
import { Barber } from '@/types/barber.types';
import { Service } from '@/types/service.types';
import { Booking } from '@/types/booking.types';
import { HaircutHistory } from '@/types/haircutHistory.types';

function buildConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: WithFieldValue<T>): DocumentData {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...data } = model as T & { id: string };
      return { ...data, updatedAt: serverTimestamp() };
    },
    fromFirestore(
      snapshot: QueryDocumentSnapshot,
      options: SnapshotOptions,
    ): T {
      const data = snapshot.data(options);
      return { ...data, id: snapshot.id } as T;
    },
  };
}

export const userConverter = buildConverter<User>();
export const barberConverter = buildConverter<Barber>();
export const serviceConverter = buildConverter<Service>();
export const bookingConverter = buildConverter<Booking>();
export const haircutHistoryConverter = buildConverter<HaircutHistory>();
