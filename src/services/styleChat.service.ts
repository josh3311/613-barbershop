import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import type { ProfileAnalysisResult, ProfileRecord } from '@/services/ai.service';
import type { StyleChatSessionDoc, StyleChatStoredMessage } from '@/types/chat.types';

function styleChatsCol(uid: string) {
  return collection(db, COLLECTIONS.USERS, uid, COLLECTIONS.STYLE_CHATS);
}

/** Local calendar day `YYYY-MM-DD` for session grouping */
export function styleChatLocalDayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function titleFromFirstUserText(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return 'New chat';
  return t.length <= 50 ? t : `${t.slice(0, 47)}…`;
}

export async function findTodaysStyleChat(
  uid: string,
): Promise<{ id: string; data: StyleChatSessionDoc } | null> {
  const dk = styleChatLocalDayKey();
  const q = query(styleChatsCol(uid), where('dayKey', '==', dk), limit(5));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const sorted = snap.docs
    .map((d) => ({ id: d.id, data: d.data() as StyleChatSessionDoc }))
    .sort((a, b) => {
      const at = a.data.updatedAt?.toMillis?.() ?? 0;
      const bt = b.data.updatedAt?.toMillis?.() ?? 0;
      return bt - at;
    });
  return sorted[0] ?? null;
}

export async function createStyleChatSession(uid: string): Promise<string> {
  const ref = await addDoc(styleChatsCol(uid), {
    dayKey: styleChatLocalDayKey(),
    title: 'New chat',
    messages: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateStyleChatSession(
  uid: string,
  chatId: string,
  messages: StyleChatStoredMessage[],
  title?: string,
): Promise<void> {
  const payload: Record<string, unknown> = {
    messages,
    updatedAt: serverTimestamp(),
  };
  if (title) payload.title = title;
  await updateDoc(doc(db, COLLECTIONS.USERS, uid, COLLECTIONS.STYLE_CHATS, chatId), payload);
}

export async function listStyleChatSessions(
  uid: string,
  max = 40,
): Promise<Array<{ id: string; data: StyleChatSessionDoc }>> {
  const snap = await getDocs(styleChatsCol(uid));
  const rows = snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as StyleChatSessionDoc,
  }));
  rows.sort(
    (a, b) =>
      (b.data.updatedAt?.toMillis?.() ?? 0) - (a.data.updatedAt?.toMillis?.() ?? 0),
  );
  return rows.slice(0, max);
}

export async function mergeChatPhotoAnalysisIntoUser(
  uid: string,
  analysis: ProfileAnalysisResult,
): Promise<void> {
  const uref = doc(db, COLLECTIONS.USERS, uid);
  const snap = await getDoc(uref);
  const prevSp = snap.data()?.styleProfile as Record<string, unknown> | undefined;
  const prev = prevSp as
    | { profile?: ProfileRecord; styles?: ProfileAnalysisResult['styles'] }
    | undefined;
  const mergedProfile: ProfileRecord = {
    ...(prev?.profile ?? {}),
    ...(analysis.profile ?? {}),
  };
  await updateDoc(uref, {
    styleProfile: {
      ...(prevSp ?? {}),
      profile: mergedProfile,
      styles: analysis.styles ?? { recommendations: [] },
      updatedAt: serverTimestamp(),
    },
  });
}
