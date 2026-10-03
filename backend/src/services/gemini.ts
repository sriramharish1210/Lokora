import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface GeminiAdaptContext {
  destination: string;
  adaptationType: string;
  constraint: string; // human-readable e.g. "only 120 minutes available"
  preferences: string[];
  currentItems: Array<{
    id: string;
    title: string;
    category: string;
    durationMinutes: number;
    travelMinutes: number;
    price: number;
  }>;
  candidateItems?: Array<{
    id: string;
    title: string;
    category: string;
    durationMinutes: number;
    price: number;
  }>;
}

export interface GeminiAdaptResult {
  summary: string;
  reason: string;
  explanation: string;
  keptExperienceIds: string[];
  removedExperienceIds: string[];
  replacementExperienceIds: string[];
  aiPowered: boolean;
}

const FALLBACK = (constraint: string): GeminiAdaptResult => ({
  summary: `Your plan was adapted based on your updated situation.`,
  reason: constraint,
  explanation: 'Lokora kept experiences that best matched your preferences and removed activities that could no longer fit.',
  keptExperienceIds: [],
  removedExperienceIds: [],
  replacementExperienceIds: [],
  aiPowered: false,
});

export async function getGeminiAdaptation(ctx: GeminiAdaptContext): Promise<GeminiAdaptResult> {
  if (!ai) return FALLBACK(ctx.constraint);

  const prompt = `You are an adaptive travel itinerary assistant for Lokora, an Indian local-experience platform.

A traveler's plan for ${ctx.destination} needs to adapt because: ${ctx.constraint}
Adaptation type: ${ctx.adaptationType}
Preferences: ${ctx.preferences.join(', ') || 'general'}

Current itinerary items (ordered):
${ctx.currentItems.map((i, n) => `${n + 1}. [${i.id}] ${i.title} (${i.category}, ${i.durationMinutes}min, ₹${i.price}, travel:${i.travelMinutes}min)`).join('\n')}

${ctx.candidateItems?.length ? `Available replacement experiences:
${ctx.candidateItems.map(i => `- [${i.id}] ${i.title} (${i.category}, ${i.durationMinutes}min, ₹${i.price})`).join('\n')}` : ''}

Respond with ONLY valid JSON matching this exact schema (no markdown, no extra text):
{
  "summary": "one sentence shown to the user explaining what changed",
  "reason": "one sentence explaining why",
  "explanation": "2-3 sentences: what was kept, removed, and why it still matches preferences",
  "keptExperienceIds": ["id1", "id2"],
  "removedExperienceIds": ["id3"],
  "replacementExperienceIds": ["id4"]
}

Rules:
- Only include IDs from the lists provided above.
- keptExperienceIds + removedExperienceIds must account for all current item IDs.
- replacementExperienceIds may be empty.
- Keep preference categories wherever feasible.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const raw = response.text?.trim() ?? '';
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    // Validate all IDs are real
    const validCurrentIds = new Set(ctx.currentItems.map(i => i.id));
    const validCandidateIds = new Set((ctx.candidateItems ?? []).map(i => i.id));
    const allValidIds = new Set([...validCurrentIds, ...validCandidateIds]);

    const safeFilter = (ids: any[]) =>
      Array.isArray(ids) ? ids.filter((id: string) => allValidIds.has(id)) : [];

    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : ctx.constraint,
      reason: typeof parsed.reason === 'string' ? parsed.reason : ctx.constraint,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : '',
      keptExperienceIds: safeFilter(parsed.keptExperienceIds),
      removedExperienceIds: safeFilter(parsed.removedExperienceIds),
      replacementExperienceIds: safeFilter(parsed.replacementExperienceIds),
      aiPowered: true,
    };
  } catch (err) {
    console.warn('[Gemini] Failed, using deterministic fallback:', (err as Error).message);
    return FALLBACK(ctx.constraint);
  }
}
