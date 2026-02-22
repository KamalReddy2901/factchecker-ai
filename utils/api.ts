import type { Source, FactCheckResult, Verdict } from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Ordered list of models to try — primary first, fallbacks when quota is exceeded
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-exp',
];

function isQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('too many requests')
  );
}

interface ClaimExtraction {
  claim: string;
  search_query: string;
  has_verifiable_claim: boolean;
}

interface GroundingChunk {
  web?: { uri: string; title: string };
}

async function geminiCall(
  key: string,
  model: string,
  body: object
): Promise<{ data: any; ok: boolean; status: number }> {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error?.message ?? `Gemini error ${res.status}`);
  }
  return { data, ok: res.ok, status: res.status };
}

// ─── Pass 1: Extract verifiable claim from image or text ─────────────────────
export async function extractClaim(
  geminiKey: string,
  model: string,
  imageBase64: string | null,
  text: string | null
): Promise<ClaimExtraction> {
  const parts: object[] = [];

  if (imageBase64) {
    parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } });
  }

  const inputDesc = imageBase64
    ? 'the image above'
    : `the following text: "${text}"`;

  parts.push({
    text: `You are a precise claim-extraction engine. Analyze ${inputDesc} and identify the primary verifiable factual claim.

Respond ONLY with raw JSON (no markdown fences):
{
  "has_verifiable_claim": true or false,
  "claim": "the specific factual assertion (empty string if none)",
  "search_query": "optimal Google-style query to verify this claim (empty string if none)"
}

Rules:
- Opinions, satire, and questions are NOT verifiable claims → return false
- Quotes, statistics, historical facts, news assertions ARE verifiable
- Keep claim concise but complete enough to be checked`,
  });

  const { data } = await geminiCall(geminiKey, model, {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(raw) as ClaimExtraction;
}

// ─── Pass 2: Search & ground via Gemini's built-in Google Search tool ────────
// NOTE: google_search grounding and JSON structured output are mutually exclusive
// in the Gemini API. This pass uses grounding (natural text output) intentionally.
// Pass 3 then structures the result into JSON.
export async function groundedSearch(
  geminiKey: string,
  model: string,
  claim: string,
  searchQuery: string
): Promise<{ summary: string; sources: Source[] }> {
  const { data } = await geminiCall(geminiKey, model, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Search the web and fact-check this claim using real, current sources. Be thorough and objective.

CLAIM TO VERIFY: "${claim}"
SEARCH QUERY: "${searchQuery}"

Instructions:
- Search for this claim across news outlets, fact-checkers, and community discussions including Reddit
- Describe what the sources say — both confirming and contradicting evidence
- Note if there is strong consensus or major disagreement across sources
- Be specific about what each source says`,
          },
        ],
      },
    ],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1 },
  });

  const candidate = data.candidates?.[0];
  const responseText: string =
    candidate?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';

  // Extract sources from groundingMetadata.groundingChunks
  const chunks: GroundingChunk[] =
    candidate?.groundingMetadata?.groundingChunks ?? [];

  const sources: Source[] = chunks
    .filter((c) => c.web?.uri && c.web?.title)
    .map((c) => {
      const raw = c.web!;
      // Attempt to extract the real domain from the proxied vertexaisearch URI
      // Fall back to the title which Gemini sets to the domain name
      let domain = raw.title ?? '';
      // Clean up domain: remove www., strip anything after first slash
      domain = domain.replace(/^www\./, '').split('/')[0].trim();
      const isReddit = domain.toLowerCase().includes('reddit');
      return {
        title: raw.title ?? domain,
        url: raw.uri,
        domain,
        type: isReddit ? 'reddit' : 'news',
      } satisfies Source;
    })
    // Deduplicate by domain
    .filter((s, i, arr) => arr.findIndex((x) => x.domain === s.domain) === i)
    .slice(0, 6);

  return { summary: responseText, sources };
}

// ─── Pass 3: Render structured JSON verdict from grounded evidence ────────────
export async function renderVerdict(
  geminiKey: string,
  model: string,
  claim: string,
  groundedSummary: string,
  sources: Source[]
): Promise<Omit<FactCheckResult, 'timestamp' | 'pageUrl' | 'pageTitle'>> {
  const sourcesText =
    sources.length > 0
      ? sources
          .map((s, i) => `[${i}] ${s.title} (${s.domain})`)
          .join('\n')
      : 'None listed.';

  const { data } = await geminiCall(geminiKey, model, {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a strict, impartial fact-checking AI. Based on the research below, render a final structured verdict.

CLAIM: "${claim}"

RESEARCH FROM WEB SOURCES:
${groundedSummary}

SOURCES CITED IN RESEARCH:
${sourcesText}

Respond ONLY with raw JSON (no markdown fences):
{
  "verdict": "TRUE" or "FALSE" or "MISLEADING" or "UNVERIFIABLE",
  "confidence": number between 0-100,
  "summary": "2-3 sentence plain-English verdict explanation citing specific evidence",
  "sources_used": [0, 1, 2]
}

Verdict rules:
- TRUE: research clearly confirms the claim
- FALSE: research clearly contradicts the claim
- MISLEADING: technically true but missing crucial context that changes the meaning
- UNVERIFIABLE: insufficient or conflicting evidence — never guess, never fabricate
- confidence reflects evidence quality, not your prior beliefs
- sources_used must be 0-based indices into the SOURCES list above`,
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(raw);

  const usedIndices: number[] = (parsed.sources_used ?? []).filter(
    (i: unknown) => typeof i === 'number' && i >= 0 && i < sources.length
  );
  const usedSources =
    usedIndices.length > 0 ? usedIndices.map((i) => sources[i]) : sources.slice(0, 3);

  return {
    verdict: (['TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE'].includes(parsed.verdict)
      ? parsed.verdict
      : 'UNVERIFIABLE') as Verdict,
    confidence: Math.min(100, Math.max(0, Math.round(parsed.confidence ?? 0))),
    summary: parsed.summary ?? 'Unable to analyze this claim.',
    sources: usedSources,
    claim,
  };
}

// ─── Full 3-pass pipeline orchestrator with model fallback ───────────────────
export async function runFactCheck(
  geminiKey: string,
  input: { imageBase64?: string; text?: string },
  meta: { pageUrl: string; pageTitle: string },
  onStatus: (s: string) => void
): Promise<FactCheckResult> {
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];

    if (i > 0) {
      // Let the UI show a brief "switching model" state before retrying
      onStatus('switching_model');
      await new Promise((r) => setTimeout(r, 900));
    }

    try {
      onStatus('reading');
      const extraction = await extractClaim(
        geminiKey,
        model,
        input.imageBase64 ?? null,
        input.text ?? null
      );

      if (!extraction.has_verifiable_claim || !extraction.claim) {
        throw new Error('NO_CLAIM');
      }

      onStatus('searching');
      const { summary: groundedSummary, sources } = await groundedSearch(
        geminiKey,
        model,
        extraction.claim,
        extraction.search_query || extraction.claim
      );

      onStatus('analyzing');
      const verdict = await renderVerdict(
        geminiKey,
        model,
        extraction.claim,
        groundedSummary,
        sources
      );

      return {
        ...verdict,
        timestamp: Date.now(),
        pageUrl: meta.pageUrl,
        pageTitle: meta.pageTitle,
      };
    } catch (err) {
      // Never retry on NO_CLAIM — the content just isn't verifiable
      if (err instanceof Error && err.message === 'NO_CLAIM') throw err;

      if (isQuotaError(err)) {
        if (i < GEMINI_MODELS.length - 1) {
          // More models to try — loop to next
          continue;
        }
        // All models exhausted
        throw new Error('ALL_MODELS_QUOTA_EXCEEDED');
      }

      // Non-quota error — propagate immediately
      throw err;
    }
  }

  // Should never reach here, but satisfies TypeScript
  throw new Error('ALL_MODELS_QUOTA_EXCEEDED');
}
