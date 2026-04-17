import { Timestamp } from 'firebase/firestore';

export const safeToDate = (timestamp: Timestamp | null | undefined): Date => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  return new Date();
};

export const safeFormatTime = (timestamp: Timestamp | null | undefined): string => {
  const date = safeToDate(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const safeFormatDate = (timestamp: Timestamp | null | undefined): string => {
  const date = safeToDate(timestamp);
  return date.toLocaleDateString();
};
