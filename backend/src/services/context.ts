import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface ParsedContext {
  location: string | null;
  area: string | null;
  city: string | null;
  durationMinutes: number | null;
  budget: number | null;
  firstVisit: boolean;
  preferences: string[];   // e.g. ["food", "culture"]
  avoidances: string[];    // e.g. ["touristy", "crowded"]
  intent: string | null;   // e.g. "discover", "relax", "eat"
  specificRequest: string | null;
}

const FALLBACK_CONTEXT: ParsedContext = {
  location: null, area: null, city: null,
  durationMinutes: null, budget: null,
  firstVisit: false, preferences: [], avoidances: [],
  intent: 'discover', specificRequest: null,
};

/** Use simple regex to deterministically extract what we can */
function deterministicParse(message: string): Partial<ParsedContext> {
  const m = message.toLowerCase();
  const ctx: Partial<ParsedContext> = {};

  // Duration: "2 hours", "90 minutes", "an hour", "half an hour"
  const hrMatch = m.match(/(\d+(?:\.\d+)?)\s*hour/);
  const minMatch = m.match(/(\d+)\s*min/);
  const halfHour = /half\s+an?\s+hour/.test(m);
  const anHour = /\ban?\s+hour\b/.test(m);
  if (hrMatch) ctx.durationMinutes = Math.round(parseFloat(hrMatch[1]) * 60);
  else if (minMatch) ctx.durationMinutes = parseInt(minMatch[1]);
  else if (halfHour) ctx.durationMinutes = 30;
  else if (anHour) ctx.durationMinutes = 60;

  // Budget: ₹2000, Rs 1500, "budget is 1000", "budget of 1000", "2000 rupees", "I have 1000"
  const budgetMatch = m.match(
    /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*)(?:\s*rupees?)?|budget\s+(?:is\s+|of\s+|:\s*)?(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*)|(?:i\s+have|with)\s+(?:₹|rs\.?\s*|inr\s*)?(\d[\d,]*)\s*(?:rupees?|bucks?)?/i,
  );
  if (budgetMatch) {
    const raw = (budgetMatch[1] || budgetMatch[2] || budgetMatch[3] || '').replace(/,/g, '');
    if (raw) ctx.budget = parseInt(raw, 10);
  }

  // First visit
  if (/new\s+place|first\s+time|never\s+been|new\s+to|first\s+visit/.test(m)) ctx.firstVisit = true;

  // Preferences
  const prefs: string[] = [];
  if (/\bfood\b|eat|lunch|dinner|breakfast|snack|culinary|restaurant|café|cafe/.test(m)) prefs.push('food');
  if (/\bculture\b|cultural|local\s+life|community/.test(m)) prefs.push('culture');
  if (/\bheritage\b|history|historic|temple|church|mosque|fort|colonial/.test(m)) prefs.push('heritage');
  if (/\bart\b|gallery|museum|craft|workshop|artisan/.test(m)) prefs.push('art');
  if (/nature|park|garden|beach|sea|waterfront|sunset|sunrise|view|promenade/.test(m)) prefs.push('nature');
  if (/relax|chill|slow|easy|peaceful|quiet/.test(m)) prefs.push('nature'); // map relaxation to nature
  if (prefs.length > 0) ctx.preferences = [...new Set(prefs)];

  // Avoidances
  const avoids: string[] = [];
  if (/don'?t\s+want\s+touristy|avoid\s+tourist|tourist\s+trap|too\s+touristy|over.?rated|non.?touristy|not\s+touristy|no\s+touristy|nothing\s+touristy|crowded|commercial/.test(m)) avoids.push('touristy');
  if (/expensive|costly|pricey/.test(m)) avoids.push('expensive');
  if (avoids.length > 0) ctx.avoidances = avoids;

  // Known Mumbai areas (check before city so "Bandra, Mumbai" gets area=Bandra)
  const areas = ['bandra west', 'bandra east', 'bandra', 'dharavi', 'worli', 'andheri west', 'andheri east', 'andheri',
    'versova', 'juhu', 'goregaon', 'malad', 'borivali', 'powai', 'vikhroli', 'khar', 'santacruz',
    'matunga', 'dadar', 'prabhadevi', 'lower parel', 'parel', 'wadala', 'chembur', 'ghatkopar',
    'mulund', 'thane', 'navi mumbai', 'panvel', 'kalyan', 'dombivli', 'kurla', 'sion',
    'fort', 'colaba', 'churchgate', 'marine drive', 'malabar hill', 'grant road', 'chor bazaar',
    'kala ghoda', 'gateway of india', 'mohammed ali road'];
  // Normalisation map: "bandra west" / "bandra east" → "Bandra" (matches DB area values)
  const areaNormMap: Record<string, string> = {
    'bandra west': 'Bandra', 'bandra east': 'Bandra',
    'andheri west': 'Andheri', 'andheri east': 'Andheri',
  };
  for (const area of areas) {
    if (m.includes(area)) {
      const titleCase = area.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      ctx.location = titleCase;                           // full user phrase
      ctx.area = areaNormMap[area] ?? titleCase;          // normalised DB value
      ctx.city = 'Mumbai';
      break;
    }
  }

  // City fallback
  if (!ctx.city) {
    if (/mumbai|bombay/.test(m)) ctx.city = 'Mumbai';
    else if (/delhi|new delhi/.test(m)) ctx.city = 'Delhi';
    else if (/jaipur/.test(m)) ctx.city = 'Jaipur';
    else if (/bangalore|bengaluru/.test(m)) ctx.city = 'Bangalore';
    else if (/pune/.test(m)) ctx.city = 'Pune';
    else if (/hyderabad/.test(m)) ctx.city = 'Hyderabad';
    else if (/chennai/.test(m)) ctx.city = 'Chennai';
  }

  return ctx;
}

export async function parseContext(message: string): Promise<{ context: ParsedContext; aiPowered: boolean }> {
  // Always run deterministic parse as baseline
  const base = deterministicParse(message);

  if (!ai) {
    return { context: { ...FALLBACK_CONTEXT, ...base }, aiPowered: false };
  }

  const prompt = `You are a travel intent parser for Lokora, an Indian local-experience platform.

Parse this user message and return ONLY strict JSON (no markdown, no extra text):

"${message}"

JSON schema:
{
  "location": "specific locality or area name, or null",
  "area": "specific neighbourhood/area, or null (e.g. 'Bandra West', 'Powai')",
  "city": "city name or null (e.g. 'Mumbai', 'Delhi', 'Jaipur')",
  "durationMinutes": integer or null,
  "budget": integer in INR or null,
  "firstVisit": boolean,
  "preferences": ["food"|"culture"|"heritage"|"art"|"nature"],
  "avoidances": ["touristy"|"crowded"|"expensive"|"commercial"],
  "intent": "discover"|"eat"|"relax"|"explore"|"learn"|null,
  "specificRequest": "any very specific request not captured above, or null"
}

Rules:
- Extract ONLY what the user explicitly said. Do NOT invent information.
- "2 hours" → durationMinutes: 120
- "₹2000" or "budget of 2000" → budget: 2000
- "new place" / "first time here" → firstVisit: true
- "touristy" avoidance → avoidances: ["touristy"]
- If the user says "Bandra", area = "Bandra", city = "Mumbai"
- preferences must only contain values from the allowed list above`;

  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    const raw = (response.text ?? '').replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const parsed = JSON.parse(raw);

    // Merge: Gemini wins where it has a value, deterministic fills gaps
    const merged: ParsedContext = {
      location: parsed.location ?? base.location ?? null,
      area: parsed.area ?? base.area ?? null,
      city: parsed.city ?? base.city ?? null,
      durationMinutes: parsed.durationMinutes ?? base.durationMinutes ?? null,
      budget: parsed.budget ?? base.budget ?? null,
      firstVisit: parsed.firstVisit ?? base.firstVisit ?? false,
      preferences: (parsed.preferences?.length ? parsed.preferences : base.preferences) ?? [],
      avoidances: (parsed.avoidances?.length ? parsed.avoidances : base.avoidances) ?? [],
      intent: parsed.intent ?? base.intent ?? 'discover',
      specificRequest: parsed.specificRequest ?? base.specificRequest ?? null,
    };
    return { context: merged, aiPowered: true };
  } catch (err) {
    console.warn('[Gemini context] parse failed, using deterministic:', (err as Error).message);
    return { context: { ...FALLBACK_CONTEXT, ...base }, aiPowered: false };
  }
}

/** Ask Gemini to rank candidate experience IDs for this context */
export async function rankExperiences(
  context: ParsedContext,
  candidates: Array<{ id: string; title: string; category: string; area: string; durationMinutes: number; price: number; description: string }>,
): Promise<string[]> {
  if (!ai || candidates.length === 0) return candidates.map(c => c.id);

  const prompt = `You are ranking local experiences for a traveler.

User context:
- Location: ${context.area || context.location || context.city || 'unknown'}
- Duration: ${context.durationMinutes ? context.durationMinutes + ' minutes' : 'flexible'}
- Budget: ${context.budget ? '₹' + context.budget : 'flexible'}
- First visit: ${context.firstVisit}
- Preferences: ${context.preferences.join(', ') || 'none specified'}
- Avoidances: ${context.avoidances.join(', ') || 'none'}
- Intent: ${context.intent || 'discover'}
- Specific request: ${context.specificRequest || 'none'}

Available experiences:
${candidates.map(c => `[${c.id}] "${c.title}" (${c.category}, ${c.area}, ${c.durationMinutes}min, ₹${c.price}) — ${c.description.substring(0, 80)}`).join('\n')}

Return ONLY a JSON array of experience IDs in order from MOST to LEAST relevant for this specific user context.
Include all IDs. Example: ["id1", "id2", "id3"]`;

  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    const raw = (response.text ?? '').replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    const ranked: string[] = JSON.parse(raw);
    const validIds = new Set(candidates.map(c => c.id));
    const filtered = ranked.filter(id => validIds.has(id));
    // Append any IDs Gemini missed
    const missing = candidates.map(c => c.id).filter(id => !filtered.includes(id));
    return [...filtered, ...missing];
  } catch {
    return candidates.map(c => c.id);
  }
}

/** Generate a human-friendly summary of the contextual plan */
export async function generatePlanSummary(
  context: ParsedContext,
  selectedTitles: string[],
  aiPowered: boolean,
): Promise<string> {
  if (!aiPowered || !ai || selectedTitles.length === 0) {
    const loc = context.area || context.location || context.city || 'your area';
    const time = context.durationMinutes ? `${context.durationMinutes} minutes` : 'your available time';
    return `A ${time} experience in ${loc} based on your request.`;
  }

  const prompt = `Write ONE concise sentence (max 25 words) summarising this local travel plan for someone in ${context.area || context.city}.
Context: ${context.durationMinutes}min, ₹${context.budget || 'flexible'}, ${context.firstVisit ? 'first visit' : 'returning'}, preferences: ${context.preferences.join(', ') || 'general'}.
Stops: ${selectedTitles.join(', ')}.
Be warm and specific. Do NOT start with "I" or "Here".`;

  try {
    const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    return (r.text ?? '').trim().replace(/^"+|"+$/g, '');
  } catch {
    return `A curated ${context.durationMinutes || ''}-minute plan in ${context.area || context.city}.`;
  }
}