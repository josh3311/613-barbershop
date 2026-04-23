import type { ProfileRecord } from '@/services/ai.service';
import { getAiBackendUrl } from '@/services/ai.service';

export const STYLE_PHOTO_PLACEHOLDER_URL =
  'https://placehold.co/400x300/0A0A0A/D4AF37?text=Style';

/** Optional client profile hints for ethnicity-aware Unsplash queries (mirrors backend logic). */
export type StylePhotoProfile = {
  ethnicity?: string;
  hair_texture?: string;
  face_shape?: string;
};

/** Maps saved analysis profile fields (snake or camel) into `/api/style-photo` hints. */
export function stylePhotoHintsFromProfileRecord(p: ProfileRecord): StylePhotoProfile {
  const r = p as Record<string, unknown>;
  const s = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
  return {
    ethnicity: s(r.ethnicity),
    hair_texture: s(r.hair_texture ?? r.hairTexture),
    face_shape: s(r.face_shape ?? r.faceShape),
  };
}

/** True when we are showing the fallback image (or no URL yet). */
export function isStylePhotoPlaceholderUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.includes('placehold.co') ||
    url.includes('via.placeholder.com')
  );
}

export const UnsplashService = {
  /**
   * Fetches a style preview URL via the Go backend (Unsplash key stays server-side; works on web).
   * When `profile` is set, the backend builds an ethnicity-aware search query.
   */
  async getStylePhoto(styleName: string, profile?: StylePhotoProfile | null): Promise<string> {
    try {
      const body: Record<string, unknown> = { style_name: styleName };
      if (profile) {
        const eth = profile.ethnicity?.trim();
        const ht = profile.hair_texture?.trim();
        const fs = profile.face_shape?.trim();
        if (eth) body.ethnicity = eth;
        if (ht) body.hair_texture = ht;
        if (fs) body.face_shape = fs;
      }
      const res = await fetch(`${getAiBackendUrl()}/api/style-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return STYLE_PHOTO_PLACEHOLDER_URL;
      }
      const data = (await res.json()) as { photo_url?: string };
      if (typeof data.photo_url === 'string' && data.photo_url.length > 0) {
        return data.photo_url;
      }
      return STYLE_PHOTO_PLACEHOLDER_URL;
    } catch {
      return STYLE_PHOTO_PLACEHOLDER_URL;
    }
  },
};
