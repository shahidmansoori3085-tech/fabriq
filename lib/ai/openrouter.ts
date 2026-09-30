/**
 * OpenRouter — one more free-form path to a vision model when the server's
 * own keys (Gemini, NVIDIA) are rate-limited or down, and the fabricator (or
 * the founder testing against a real sheet) has an OpenRouter key handy.
 * Same OpenAI-compatible chat/completions shape as gemini.ts, so the
 * extraction prompt, schema and parsing all stay identical — only the base
 * URL, model name and key format differ.
 */
const BASE = "https://openrouter.ai/api/v1";

/** OpenRouter keys look like `sk-or-v1-…`. */
export function isOpenRouterKey(key: string): boolean {
  return /^sk-or-/.test(key.trim());
}

/** A capable, cheap vision model with reliable JSON-schema output — this is
 *  a founder-testing fallback, not the primary path, so cost matters more
 *  than squeezing out the last bit of accuracy. Override with
 *  OPENROUTER_VISION_MODEL for a deployment that wants a different one. */
export const OPENROUTER_VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "google/gemini-2.5-flash";

interface TextPart { type: "text"; text: string }
interface ImagePart { type: "image_url"; image_url: { url: string } }
type Part = TextPart | ImagePart;

async function call(body: unknown, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://fabriq.app",
      "X-Title": "FabriQ",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`openrouter_${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("openrouter_no_text");
  return text;
}

/** Structured extraction, with an optional image — same contract as
 *  geminiJson/nvidiaJson so the read-sheet route can treat all three
 *  interchangeably. */
export async function openrouterJson<T>(opts: {
  apiKey: string;
  system: string;
  userText: string;
  schema: object;
  images?: { data: string; mediaType: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const parts: Part[] = [];
  for (const img of opts.images ?? []) {
    parts.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } });
  }
  parts.push({ type: "text", text: opts.userText });

  const text = await call({
    model: opts.model || OPENROUTER_VISION_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: parts },
    ],
    // Not strict: EXTRACT_SCHEMA (shared with Gemini) leaves most fields
    // optional by design — a sheet rarely states all of them — and OpenAI's
    // strict mode rejects any schema where every property isn't marked
    // required, which fails on this schema outright rather than mattering
    // to which items make output.
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", schema: opts.schema },
    },
  }, opts.apiKey);

  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("openrouter_bad_json");
  }
}
