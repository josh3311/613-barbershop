import { getAiBackendUrl } from './ai.service';

export const STYLE_PHOTO_PLACEHOLDER_URL =
  'https://placehold.co/400x500/111111/D4AF37?text=Style';

export function isStylePhotoPlaceholderUrl(url: string | undefined): boolean {
  return !url || url.includes('placehold.co') || url.includes('placeholder');
}

function buildSearchQuery(styleName: string, ethnicity?: string): string {
  const eth = (ethnicity ?? '').toLowerCase();
  let keyword = '';
  if (eth.includes('black') || eth.includes('african')) keyword = 'Black man';
  else if (eth.includes('east asian') || (eth.includes('asian') && !eth.includes('south'))) keyword = 'Asian man';
  else if (eth.includes('latino') || eth.includes('hispanic')) keyword = 'Latino man';
  else if (eth.includes('middle eastern') || eth.includes('arab')) keyword = 'Middle Eastern man';
  else if (eth.includes('south asian') || eth.includes('indian')) keyword = 'South Asian man';
  else keyword = 'man';
  return `${styleName} haircut ${keyword}`;
}

export async function getStylePhoto(styleName: string, ethnicity?: string): Promise<string> {
  try {
    const query = buildSearchQuery(styleName, ethnicity);
    const res = await fetch(`${getAiBackendUrl()}/api/style-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style_name: query }),
    });
    if (!res.ok) return STYLE_PHOTO_PLACEHOLDER_URL;
    const data = (await res.json()) as { photo_url?: string };
    return data.photo_url && data.photo_url.length > 0
      ? data.photo_url
      : STYLE_PHOTO_PLACEHOLDER_URL;
  } catch {
    return STYLE_PHOTO_PLACEHOLDER_URL;
  }
}
