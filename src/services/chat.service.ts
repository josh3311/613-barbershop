import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ChatMessage } from '@/types/chat.types';
import { FirestoreResult } from '@/types/common.types';

/** Deterministic id so client + barber resolve the same thread */
export function makeConversationId(clientId: string, barberId: string): string {
  return [clientId, barberId].sort().join('_');
}

const convRef = (conversationId: string) => doc(db, 'conversations', conversationId);
const messagesCol = (conversationId: string) =>
  collection(db, 'conversations', conversationId, 'messages');

export const ChatService = {
  makeConversationId,

  async ensureConversation(
    clientId: string,
    barberId: string,
  ): Promise<FirestoreResult<string>> {
    try {
      const conversationId = makeConversationId(clientId, barberId);
      const ref = convRef(conversationId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          participantIds: [clientId, barberId].sort(),
          clientId,
          barberId,
          updatedAt: serverTimestamp(),
        });
      }
      return { success: true, data: conversationId };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ): Promise<FirestoreResult<void>> {
    const trimmed = text.trim();
    if (!trimmed) return { success: false, error: 'Empty message' };
    if (trimmed.length > 2000) return { success: false, error: 'Message too long' };
    try {
      await addDoc(messagesCol(conversationId), {
        senderId,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      await setDoc(
        convRef(conversationId),
        { updatedAt: serverTimestamp() },
        { merge: true },
      );
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  subscribeToMessages(
    conversationId: string,
    onNext: (messages: ChatMessage[]) => void,
    onError?: (e: Error) => void,
  ): () => void {
    const q = query(messagesCol(conversationId), orderBy('createdAt', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            senderId: data.senderId as string,
            text: data.text as string,
            createdAt: data.createdAt as Timestamp,
          };
        });
        onNext(list);
      },
      (err) => onError?.(err),
    );
  },
} as const;
