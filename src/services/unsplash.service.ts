import { getAiBackendUrl } from '@/services/ai.service';

export const STYLE_PHOTO_PLACEHOLDER_URL =
  'https://placehold.co/400x300/0A0A0A/D4AF37?text=Style';

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
   */
  async getStylePhoto(styleName: string): Promise<string> {
    try {
      const res = await fetch(`${getAiBackendUrl()}/api/style-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_name: styleName }),
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
