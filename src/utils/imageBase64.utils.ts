import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export async function readImageAsBase64(uri: string): Promise<string> {
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
