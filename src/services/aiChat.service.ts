import { getAiBackendUrl } from '@/services/ai.service';
import type { ProfileRecord, StyleRecommendation } from '@/services/ai.service';

export type StyleChatRole = 'user' | 'assistant';

export type StyleChatTurn = {
  role: StyleChatRole;
  content: string;
  /** Shown in UI; sent to the API as text with URL context */
  imageUrl?: string;
  /** When true, omitted from UI but still included in API requests */
  hidden?: boolean;
};

function isLocalStyleChatImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.startsWith('data:') ||
    u.startsWith('blob:') ||
    u.startsWith('file:') ||
    u.startsWith('content:')
  );
}

export function styleChatMessagesForApi(messages: StyleChatTurn[]): StyleChatTurn[] {
  return messages.map((m) => {
    if (!m.imageUrl) {
      return { role: m.role, content: m.content };
    }
    const imagePart = isLocalStyleChatImageUrl(m.imageUrl)
      ? '[Client shared a photo from their device]'
      : `[Client shared a photo](${m.imageUrl})`;
    return {
      role: m.role,
      content: `${imagePart}\n${m.content}`.trim(),
    };
  });
}

function buildStyleChatSystem(
  styleProfile: ProfileRecord,
  recommendations: StyleRecommendation[],
): string {
  const profileStr = JSON.stringify(styleProfile ?? {});
  const recStr = JSON.stringify(recommendations ?? []);
  return (
    'You are a friendly barber at 613 Barbershop helping a client choose their next haircut. ' +
    `You know their style profile: ${profileStr}. ` +
    `Their top recommendations are: ${recStr}. ` +
    'Speak casually and in plain English. No jargon. ' +
    'When recommending a style, mention it by its exact name from the recommendations list. ' +
    'You CANNOT create or modify bookings directly. You do not have access to the calendar. ' +
    'Never say you booked them, confirmed a time, or put them on the schedule. ' +
    'If a client mentions a specific time (e.g. 3:30pm) or asks to book (e.g. "book me for 3:30"), respond with exactly this idea in your own warm tone: ' +
    "\"I can save your style choice, but to book a time you'll need to use the Book tab. Want me to save the Low Skin Fade to your next booking?\" " +
    'Replace Low Skin Fade with the exact style name from the recommendations list that fits what they asked for. ' +
    'Then, on its own line, use the marker: [BOOK_STYLE:Exact Style Name Here]. ' +
    'If they only want to attach a style and are not asking for a time slot, you may still use [BOOK_STYLE:…] when appropriate.'
  );
}

export const AIChatService = {
  async sendStyleChatMessage(
    messages: StyleChatTurn[],
    styleProfile: ProfileRecord,
    recommendations: StyleRecommendation[],
  ): Promise<string> {
    const system = buildStyleChatSystem(styleProfile, recommendations);
    const apiMessages = styleChatMessagesForApi(messages);
    const response = await fetch(`${getAiBackendUrl()}/api/style-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages.map(({ role, content }) => ({ role, content })),
        system,
      }),
    });

    if (!response.ok) {
      let message = 'We could not reach the stylist just now. Try again in a moment.';
      try {
        const err = (await response.json()) as { error?: string };
        if (typeof err?.error === 'string' && err.error.length > 0) {
          message = err.error;
        }
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const data = (await response.json()) as { message?: string };
    if (typeof data.message !== 'string' || !data.message.trim()) {
      throw new Error('The stylist sent an empty reply. Please try again.');
    }
    return data.message.trim();
  },
};
