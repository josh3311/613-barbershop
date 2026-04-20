import { Platform } from 'react-native';

export interface StyleRecommendation {
  rank: number;
  style_name: string;
  suitability_score: number;
  why_it_suits_you: string;
  hair_texture_compatibility: string;
  maintenance_level: string;
  duration_minutes: number;
  best_for: string;
  category: string;
}

export interface ProfileRecord {
  ethnicity?: string;
  skin_tone?: string;
  face_shape?: string;
  hair_texture?: string;
  forehead?: string;
  jawline?: string;
  face_length?: string;
  current_style?: string;
}

export interface ProfileAnalysisResult {
  success: boolean;
  profile: ProfileRecord;
  styles: { recommendations: StyleRecommendation[] };
}

export function getAiBackendUrl(): string {
  const env = process.env.EXPO_PUBLIC_AI_BACKEND_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  if (!__DEV__) return 'https://your-render-url.onrender.com';
  if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
  return 'http://127.0.0.1:8080';
}

export const AIService = {
  analyzeProfileFromBase64: async (
    imageBase64: string,
    mediaType: string,
  ): Promise<ProfileAnalysisResult> => {
    const response = await fetch(`${getAiBackendUrl()}/api/analyze-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64: imageBase64,
        media_type: mediaType,
      }),
    });

    if (!response.ok) {
      let message = 'Failed to analyze profile';
      try {
        const err = (await response.json()) as { error?: string };
        if (typeof err?.error === 'string') message = err.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const data = (await response.json()) as ProfileAnalysisResult;
    const recs = data.styles?.recommendations;
    if (!Array.isArray(recs)) {
      data.styles = { recommendations: [] };
    }
    return data;
  },
};
