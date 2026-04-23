import { getAiBackendUrl } from '@/services/ai.service';
import type { ProfileRecord, StyleRecommendation } from '@/services/ai.service';
import { SHOP_KNOWLEDGE } from '@/services/shopKnowledge';

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
  const profile = JSON.stringify(styleProfile ?? {});
  const recommendationsJson = JSON.stringify(recommendations ?? []);
  const now = new Date();
  const year = String(now.getFullYear());
  const date = now.toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  });

  return `You are an expert barber and AI stylist at 613 Barbershop, 598 Rideau St, Ottawa, ON K1N 6A2.

Client profile: ${profile}
Their current style recommendations: ${recommendationsJson}
Today's date: ${date}

SHOP KNOWLEDGE: ${SHOP_KNOWLEDGE}

Answer questions about the shop, services, pricing, address, booking rules, and loyalty only from SHOP KNOWLEDGE above. If something is not listed there, say you are not sure and suggest they confirm in the app or with the shop. When it fits the conversation, proactively mention benefits such as the loyalty program (every 7 completed cuts earns a free cut).

CONTEXT — TRENDING HAIR (use ${year}, not outdated looks):
Today's date is ${date}. You are aware of current trending haircut styles for ${year}. Always recommend styles that are currently trending when it fits the client.
For Black men in ${year}, trending styles often include: high top fades, temp fades, drop fades, Edgar cuts, twist outs, loc styles, 360 waves, and shape-ups with designs.

YOUR JOB:
- Recommend the most current trending styles for ${year} that suit this specific client
- Always consider: their face shape, hair texture, skin tone, ethnicity, and lifestyle
- For Black clients with coily/kinky hair, prioritize: temp fades, drop fades, high top fades, shape-ups with designs, 360 waves, twist outs, locs, Edgar cuts
- For Asian clients: two-block cuts, textured crops, perms, curtain bangs
- For Latino clients: temple fades, Edgar cuts, slick backs, burst fades
- Always mention HOW LONG the style takes and HOW EASY it is to maintain
- If client doesn't know what they want, ask 3 quick questions: occasion, maintenance preference, how often they visit the barber
- Then recommend 3 specific styles with reasons why each suits them personally
- NEVER recommend outdated styles
- Speak casually like a friendly expert barber — not like a robot
- Do not use emojis in replies

BOOKING INTEGRATION:
- When client picks a style, ask: "Want me to add this to your booking with full specs for your barber?"
- When they say yes, create a detailed barber brief and use [BOOK_STYLE:StyleName] marker
- The barber brief format: Style name + specific details (guard numbers, fade height, design details, texture treatment) + client's hair texture + any special requests
- Example: [BOOK_STYLE:Temp Fade with 360 Waves] followed by "Barber notes: Start with #1.5 on sides, temp fade at the temple, blend to skin, 360 wave pattern on top, shape-up the hairline, client has coily type 4 hair"

YOU CANNOT create bookings or see the calendar. Direct booking time to the Book tab.`;
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
