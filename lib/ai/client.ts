import Anthropic from "@anthropic-ai/sdk";
import { isGeminiKey } from "./gemini";
import { isNvidiaKey } from "./nvidia";

/** Model is a config value — revisited per eval run (doc 03). */
export const AI_MODEL = process.env.FABRIQ_AI_MODEL || "claude-opus-5";
/** Bedrock uses its own model-id format (often region-prefixed inference profiles). */
export const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-5-20250929-v1:0";

/** Reads an env var trying a few common casings (dashboard entries aren't always UPPER_SNAKE). */
function envAny(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
}

export const AWS_ACCESS_KEY = () => envAny("AWS_ACCESS_KEY_ID", "awsaccesskeyid", "AWSACCESSKEYID");
export const AWS_SECRET_KEY = () => envAny("AWS_SECRET_ACCESS_KEY", "awssecretaccesskey", "AWSSECRETACCESSKEY");
export const AWS_REGION = () => envAny("AWS_REGION", "awsregion", "AWSREGION") || "us-east-1";
export const hasBedrockCreds = () => !!(AWS_ACCESS_KEY() && AWS_SECRET_KEY());
/** Set once on the server, so no fabricator using the deployed app ever has
 *  to paste their own key — same idea as ANTHROPIC_API_KEY, but for the free
 *  Google AI Studio tier. */
export const GEMINI_SERVER_KEY = () => envAny("GEMINI_API_KEY", "geminiapikey", "GEMINIAPIKEY");
/** Same idea, for the NVIDIA API Catalog free tier — added after Gemini's
 *  free key turned out to have no quota at all for its Pro reasoning tier
 *  (see gemini.ts), so photo-reading had no path to a stronger model. */
export const NVIDIA_SERVER_KEY = () => envAny("NVIDIA_API_KEY", "nvidiaapikey", "NVIDIAAPIKEY");

export type ProviderChoice =
  | { provider: "anthropic" | "bedrock"; client: Anthropic; model: string }
  | { provider: "gemini"; apiKey: string }
  | { provider: "nvidia"; apiKey: string };

/**
 * Single source of truth for every AI route (vision + Copilot). Priority:
 *   1. caller-supplied key (Settings) — Anthropic, Gemini or NVIDIA, told apart by shape
 *   2. server ANTHROPIC_API_KEY — paid, highest quality, when the founder has set one
 *   3. server NVIDIA_API_KEY — free tier, a meaningfully larger vision model
 *      (Llama 3.2 90B) than Gemini's free tier can reach (see gemini.ts)
 *   4. server GEMINI_API_KEY — free tier, so the app works with zero setup
 *      for every fabricator once the founder sets this once
 *   5. AWS Bedrock (server AWS credentials)
 * Returns null only when nothing at all is configured.
 *
 * Async because the Bedrock branch dynamically imports @anthropic-ai/bedrock-sdk —
 * that SDK is unused on the hot path (Gemini/Anthropic-direct) but was previously
 * imported at module top level, bloating every AI route's serverless bundle and
 * slowing cold starts for all fabricators, not just the rare Bedrock deployment.
 */
export async function resolveProvider(apiKey?: string): Promise<ProviderChoice | null> {
  if (apiKey && isGeminiKey(apiKey)) return { provider: "gemini", apiKey };
  if (apiKey && isNvidiaKey(apiKey)) return { provider: "nvidia", apiKey };
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return { provider: "anthropic", client: new Anthropic({ apiKey: anthropicKey }), model: AI_MODEL };
  const serverNvidia = NVIDIA_SERVER_KEY();
  if (serverNvidia) return { provider: "nvidia", apiKey: serverNvidia };
  const serverGemini = GEMINI_SERVER_KEY();
  if (serverGemini) return { provider: "gemini", apiKey: serverGemini };
  const awsAccessKey = AWS_ACCESS_KEY();
  const awsSecretKey = AWS_SECRET_KEY();
  if (awsAccessKey && awsSecretKey) {
    const { AnthropicBedrock } = await import("@anthropic-ai/bedrock-sdk");
    const client = new AnthropicBedrock({ awsRegion: AWS_REGION(), awsAccessKey, awsSecretKey }) as unknown as Anthropic;
    return { provider: "bedrock", client, model: BEDROCK_MODEL };
  }
  return null;
}
