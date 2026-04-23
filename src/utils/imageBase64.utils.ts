import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export async function readImageAsBase64(uri: string): Promise<string> {
  const trimmedAll = uri.trim();
  if (/^data:/i.test(trimmedAll)) {
    const comma = trimmedAll.indexOf(',');
    if (comma < 0) {
      throw new Error('Invalid data URL');
    }
    return trimmedAll.slice(comma + 1);
  }
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result;
        if (typeof r !== 'string') {
          reject(new Error('Failed to read image'));
          return;
        }
        const comma = r.indexOf(',');
        resolve(comma >= 0 ? r.slice(comma + 1) : r);
      };
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(blob);
    });
  }

  const trimmed = uri.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const ext = inferImageMediaType(trimmed).includes('png') ? 'png' : 'jpg';
    const baseDir = FileSystem.cacheDirectory ?? '';
    const localPath = `${baseDir}readimg_${Date.now()}.${ext}`;
    const { uri: localUri, status } = await FileSystem.downloadAsync(trimmed, localPath);
    if (status < 200 || status > 299) {
      throw new Error(`Could not download image (HTTP ${status})`);
    }
    try {
      return await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } finally {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    }
  }

  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function inferImageMediaType(uri: string, override?: string | null): string {
  if (override) return override;
  const lower = uri.toLowerCase();
  if (lower.includes('.png') || lower.includes('image/png')) return 'image/png';
  return 'image/jpeg';
}
