import { getAiBackendUrl } from '@/services/ai.service';

export type BarberCutStep = {
  number: number;
  title: string;
  description: string;
  tools: string;
};

export type BarberCutGuideResult = {
  steps: BarberCutStep[];
};

export const AIBarberGuideService = {
  async getCutInstructions(
    styleName: string,
    hairTexture: string,
  ): Promise<BarberCutGuideResult> {
    const response = await fetch(`${getAiBackendUrl()}/api/barber-cut-guide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        style_name: styleName,
        hair_texture: hairTexture || 'typical',
      }),
    });

    if (!response.ok) {
      let message = 'Could not load cut instructions. Try again shortly.';
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

    const data = (await response.json()) as { steps?: unknown };
    const rawSteps = data.steps;
    if (!Array.isArray(rawSteps)) {
      throw new Error('Instructions came back in an unexpected format.');
    }

    const steps: BarberCutStep[] = rawSteps.map((s, i) => {
      const row = s as Record<string, unknown>;
      const num = typeof row.number === 'number' ? row.number : i + 1;
      const title = typeof row.title === 'string' ? row.title : `Step ${i + 1}`;
      const description =
        typeof row.description === 'string' ? row.description : '';
      const tools = typeof row.tools === 'string' ? row.tools : '';
      return { number: num, title, description, tools };
    });

    return { steps };
  },
};
