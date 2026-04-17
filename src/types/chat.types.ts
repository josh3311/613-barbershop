import { Timestamp } from 'firebase/firestore';

/** `conversations/{conversationId}/messages/{messageId}` */
export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Timestamp;
}
