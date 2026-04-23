import type { StyleRecommendation } from '@/services/ai.service';

export function friendlyMaintenance(level: string | undefined): string {
  const l = (level ?? '').toLowerCase();
  if (l.includes('low')) return 'Easy to keep up';
  if (l.includes('high')) return 'Needs daily care';
  if (l.includes('medium')) return 'Some regular upkeep';
  return 'Looks sharp with normal upkeep';
}

export function friendlyMatchLine(score: number): string {
  if (score >= 90) return 'Great match for you';
  if (score >= 75) return 'Good match for you';
  if (score >= 60) return 'Could work nicely for you';
  return 'Worth chatting about with your barber';
}

export function friendlyBestFor(raw: string | undefined): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ');
}

/** Plain-English hair note from API copy */
export function friendlyHairNote(text: string | undefined): string {
  if (!text) return '';
  let t = text.trim();
  t = t.replace(/\bcoily\b/gi, 'tight curls');
  t = t.replace(/\bkinky\b/gi, 'tight curls');
  t = t.replace(/\bcompatibility\b/gi, 'fit');
  t = t.replace(/\btexture\b/gi, 'hair type');
  return t;
}

export function stripBookStyleMarkers(text: string): string {
  let t = text.replace(/\[BOOK_STYLE:[^\]]+\]\s*\n?/g, '');
  t = t.replace(/\n*Barber notes:\s*[\s\S]+$/im, '').trim();
  return t.trim();
}

/** Text after [BOOK_STYLE:…] and "Barber notes:" (for Firestore requestedStyle.barberNotes). */
export function extractBarberNotesFromAssistantReply(text: string): string | null {
  const bookMatch = text.match(/\[BOOK_STYLE:[^\]]+\]/);
  if (!bookMatch || bookMatch.index === undefined) return null;
  const afterMarker = text.slice(bookMatch.index + bookMatch[0].length);
  const m = afterMarker.match(/\bBarber notes:\s*([\s\S]+)$/im);
  if (!m) return null;
  const notes = m[1].trim();
  return notes.length > 0 ? notes : null;
}

export function firstBookStyleName(text: string): string | null {
  const m = text.match(/\[BOOK_STYLE:([^\]]+)\]/);
  return m ? m[1].trim() : null;
}

export function findRecommendationByBookName(
  name: string,
  recs: StyleRecommendation[],
): StyleRecommendation | undefined {
  const n = name.trim().toLowerCase();
  return recs.find((r) => r.style_name.trim().toLowerCase() === n)
    ?? recs.find((r) => r.style_name.toLowerCase().includes(n) || n.includes(r.style_name.toLowerCase()));
}

export function mentionedRecommendationPhotos(
  text: string,
  recs: StyleRecommendation[],
  photos: Record<string, string>,
): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const r of recs) {
    if (text.includes(r.style_name)) {
      const url = photos[r.style_name];
      if (url && !seen.has(r.style_name)) {
        seen.add(r.style_name);
        out.push({ name: r.style_name, url });
      }
    }
  }
  return out;
}
