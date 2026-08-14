/**
 * Gemini via its OpenAI-compatible endpoint.
 *
 * Google AI Studio hands a fabricator a free-tier key, which removes the
 * biggest onboarding wall this app had: photo-reading previously needed a paid
 * Anthropic key before it would do anything at all.
 *
 * We talk to the OpenAI-compatible surface rather than adding Google's SDK —
 * one fetch, no extra dependency, and the same request shape already used for
 * the OpenRouter path.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/** Fast, cheap and free-tier friendly; override per deployment if needed. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/** Google AI Studio keys look like `AIza…`; Anthropic's look like `sk-ant-…`. */
export function isGeminiKey(key: string): boolean {
  return /^AIza/.test(key.trim());
}

interface TextPart { type: "text"; text: string }
interface ImagePart { type: "image_url"; image_url: { url: string } }
type Part = TextPart | ImagePart;

async function call(body: unknown, apiKey: string): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gemini_${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("gemini_no_text");
  return text;
}

/** Plain chat — used by the Copilot. */
export async function geminiChat(opts: {
  apiKey: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const text = await call({
    model: opts.model || GEMINI_MODEL,
    max_tokens: opts.maxTokens ?? 700,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  }, opts.apiKey);
  return text.trim();
}

/**
 * Structured extraction, with an optional image. Returns the parsed object.
 * The schema is enforced by the model; we still parse defensively, because a
 * malformed response must fail loudly rather than quietly yield wrong sizes.
 */
export async function geminiJson<T>(opts: {
  apiKey: string;
  system: string;
  userText: string;
  schema: object;
  /** One sheet is often several photos — pages, or close-ups of one page. */
  images?: { data: string; mediaType: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const parts: Part[] = [];
  for (const img of opts.images ?? []) {
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mediaType};base64,${img.data}` },
    });
  }
  parts.push({ type: "text", text: opts.userText });

  const text = await call({
    model: opts.model || GEMINI_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: parts },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", schema: opts.schema },
    },
  }, opts.apiKey);

  try {
    return JSON.parse(text) as T;
  } catch {
    // Some responses arrive fenced in ```json … ``` — recover rather than fail
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("gemini_bad_json");
  }
}
