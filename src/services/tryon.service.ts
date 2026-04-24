import { getAiBackendUrl } from './ai.service';

export interface TryOnRequest {
  selfieBase64: string;
  stylePrompt: string;
}

export interface TryOnResponse {
  resultUrl: string;
}

export const TryOnService = {
  /**
   * Call the FLUX Kontext try-on endpoint
   * @param request - The try-on request with selfie base64 and style prompt
   * @returns The result URL from the AI generation
   */
  async tryOnKontext(request: TryOnRequest): Promise<TryOnResponse> {
    const url = `${getAiBackendUrl()}/api/try-on-kontext`;

    // Fix 5: Log the call
    console.log('[tryon] calling:', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selfie_base64: request.selfieBase64,
        style_prompt: request.stylePrompt,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[tryon] API error:', res.status, text);
      throw new Error(`API error: ${res.status} - ${text}`);
    }

    const data = await res.json();

    if (!data.result_url) {
      throw new Error('No result_url in response');
    }

    return { resultUrl: data.result_url };
  },
};
