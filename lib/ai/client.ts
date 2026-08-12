import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { isGeminiKey } from "./gemini";

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

export type ProviderChoice =
  | { provider: "anthropic" | "bedrock"; client: Anthropic; model: string }
  | { provider: "gemini"; apiKey: string };

/**
 * Single source of truth for every AI route (vision + Copilot). Priority:
 *   1. caller-supplied key (Settings) — Anthropic or Gemini, told apart by shape
 *   2. server ANTHROPIC_API_KEY
 *   3. server GEMINI_API_KEY — free tier, so the app works with zero setup
 *      for every fabricator once the founder sets this once
 *   4. AWS Bedrock (server AWS credentials)
 * Returns null only when nothing at all is configured.
 */
export function resolveProvider(apiKey?: string): ProviderChoice | null {
  if (apiKey && isGeminiKey(apiKey)) return { provider: "gemini", apiKey };
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) return { provider: "anthropic", client: new Anthropic({ apiKey: anthropicKey }), model: AI_MODEL };
  const serverGemini = GEMINI_SERVER_KEY();
  if (serverGemini) return { provider: "gemini", apiKey: serverGemini };
  const awsAccessKey = AWS_ACCESS_KEY();
  const awsSecretKey = AWS_SECRET_KEY();
  if (awsAccessKey && awsSecretKey) {
    const client = new AnthropicBedrock({ awsRegion: AWS_REGION(), awsAccessKey, awsSecretKey }) as unknown as Anthropic;
    return { provider: "bedrock", client, model: BEDROCK_MODEL };
  }
  return null;
}
