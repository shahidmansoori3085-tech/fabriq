/**
 * NVIDIA API Catalog (build.nvidia.com) via its OpenAI-compatible endpoint.
 *
 * A second free-tier option alongside Gemini — added specifically because
 * Gemini's free AI-Studio key turned out to have no quota at all for its
 * Pro-tier reasoning model (see gemini.ts), leaving photo-reading stuck on
 * the flash tier. NVIDIA hosts open-weight vision models (Llama 3.2 Vision)
 * at meaningful size (90B) under its own free per-account quota, no billing
 * required — the same "works out of the box for a fabricator" bar Gemini
 * was chosen for.
 *
 * Same OpenAI-compatible shape as Gemini and OpenRouter — one more fetch-
 * based client, no new SDK dependency.
 */
const BASE = "https://integrate.api.nvidia.com/v1";

/** Chat — a mid-size instruct model is plenty for Copilot's short replies. */
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

/** Vision + structured extraction — the 90B vision variant, for the same
 *  reason gemini.ts wanted a flagship reasoning tier for this: reading real
 *  handwriting and reasoning about an ambiguous sketch needs more than a
 *  small model reliably gives. */
export const NVIDIA_VISION_MODEL = process.env.NVIDIA_VISION_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

/** NVIDIA API-catalog keys look like `nvapi-…`. */
export function isNvidiaKey(key: string): boolean {
  return /^nvapi-/.test(key.trim());
}

interface TextPart { type: "text"; text: string }
interface ImagePart { type: "image_url"; image_url: { url: string } }
type Part = TextPart | ImagePart;

/**
 * `timeoutMs` matters here in a way it doesn't for the other providers: some
 * models on this catalogue simply never return on a complex image (a 90B
 * vision variant was left running past 200s during testing). Without a cap,
 * one of those would hold the whole request open until the platform killed
 * it, and the fabricator would watch a spinner instead of getting the
 * "enter the sizes yourself" fallback he could act on.
 */
async function call(body: unknown, apiKey: string, timeoutMs?: number): Promise<string> {
  const ac = new AbortController();
  const timer = timeoutMs ? setTimeout(() => ac.abort(), timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    if (ac.signal.aborted) throw new Error(`nvidia_timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`nvidia_${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("nvidia_no_text");
  return text;
}

/** Plain chat — used by the Copilot. */
export async function nvidiaChat(opts: {
  apiKey: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const text = await call({
    model: opts.model || NVIDIA_MODEL,
    max_tokens: opts.maxTokens ?? 700,
    messages: [{ role: "system", content: opts.system }, ...opts.messages],
  }, opts.apiKey);
  return text.trim();
}

/**
 * Structured extraction, with an optional image. Returns the parsed object.
 * NVIDIA NIM supports response_format:"json_schema" the same shape OpenAI
 * and Gemini do — confirmed against NVIDIA's own structured-generation docs
 * before wiring this in, rather than assumed.
 */
export async function nvidiaJson<T>(opts: {
  apiKey: string;
  system: string;
  userText: string;
  schema: object;
  images?: { data: string; mediaType: string }[];
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
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
    model: opts.model || NVIDIA_VISION_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: parts },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "result", schema: opts.schema },
    },
  }, opts.apiKey, opts.timeoutMs);

  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* fall through to the raw-text error below */ }
    }
    throw new Error(`nvidia_bad_json: ${text.slice(0, 400)}`);
  }
}
