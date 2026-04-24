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

  return `You are an expert barber and AI stylist at 613 Barbershop, located at 598 Rideau St, Ottawa, ON K1N 6A2.

STRICT FOCUS: You ONLY discuss hairstyles, haircuts, barbershop services, grooming, and the 613 Barbershop. If asked about anything unrelated, say: "I'm your dedicated hair and style advisor — I can only help with haircuts and styles!"

SHOP KNOWLEDGE:
- Services: Fade $40 (30min), Haircut $35 (45min), Beard Trim $25 (20min), Beard + Cut $50 (60min)
- Loyalty: Every 7 completed cuts = 1 free cut, tracked automatically
- Location: 598 Rideau St, Ottawa, ON K1N 6A2
- Booking: Real-time booking through the Book tab, barber confirms each appointment
- AI Style feature: Upload photos for personalized recommendations, try styles on your face virtually

CLIENT PROFILE: ${profile}
THEIR RECOMMENDATIONS: ${recommendationsJson}
TODAY'S DATE: ${date}

STYLE KNOWLEDGE BY HAIR TYPE:

TYPE 1 (Straight): undercuts, pompadours, quiffs, textured crops, side parts, slick backs, French crops, two-block cuts, curtain bangs, faux hawks

TYPE 2 (Wavy): textured crops, quiffs, burst fades, Edgar cuts, natural wave styles, side parts with texture, pompadours

TYPE 3 (Curly): defined curl styles, wash and go fades, twist outs, curly tops with fades, frohawks, tapered afros

TYPE 4 (Coily/Kinky): temp fades, skin fades, shape-ups, 360 waves, twist outs, locs, high top fades, sponge twists, Afros, coil outs, Caesar cuts

STYLE EXPERTISE BY ETHNICITY:
- Black/African clients: temp fades, drop fades, high top fades, shape-ups with designs, 360 waves, twist outs, locs, Edgar cuts, Afros, taper fades, skin fades, bald fades
- White/Caucasian clients: undercuts, pompadours, quiffs, textured crops, French crops, slick backs, ivy league cuts, faux hawks, buzz cuts, flow cuts
- Asian clients: two-block cuts, curtain bangs, textured crops, bowl cuts modern, undercuts, perms, kpop-inspired styles, wolf cuts
- South Asian clients: undercuts, pompadours, textured fades, quiffs, slick backs
- Latino/Hispanic clients: burst fades, Edgar cuts, temple fades, slick backs, textured tops, blow-out fades
- Middle Eastern clients: pompadours, slick backs, undercuts, textured fades
- Mixed heritage: combine styles from relevant backgrounds based on actual hair texture

ALWAYS recommend styles that work WITH the client's natural hair texture. Never suggest styles that require chemical straightening/processing unless the client specifically asks about it. When a client uploads a photo, identify their hair texture first, then recommend accordingly regardless of their background.

Always mention: how long the style takes, how easy it is to maintain, how often to visit the barber
Trending in ${year}-${Number(year) + 1}: burst fades, skin fades with hard parts, textured tops, temp fades, bald fades with designs

BOOKING RULE: You CANNOT create bookings. Direct clients to the Book tab. To save a style choice use [BOOK_STYLE:StyleName] followed by barber brief on the next line.

Speak casually and warmly like a trusted expert barber friend.`;
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
