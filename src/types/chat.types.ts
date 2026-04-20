import { Timestamp } from 'firebase/firestore';

/** `conversations/{conversationId}/messages/{messageId}` */
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}

/** Stored in `users/{uid}/styleChats/{chatId}.messages` */
export type StyleChatStoredRole = 'user' | 'assistant';

export interface StyleChatStoredMessage {
  role: StyleChatStoredRole;
  content: string;
  /** Optional image URL when persisted (remote https only; local URIs are not stored) */
  imageUrl?: string;
  /** When true, message is sent to the AI only and must not be shown in the chat UI */
  hidden?: boolean;
}

/** Document shape: `users/{uid}/styleChats/{chatId}` */
export interface StyleChatSessionDoc {
  dayKey: string;
  title: string;
  messages: StyleChatStoredMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
