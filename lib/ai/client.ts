import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

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

/**
 * Picks the Anthropic-compatible client + model id for the AI vision/JSON routes.
 * Priority: caller-supplied key (Settings) → server ANTHROPIC_API_KEY → AWS Bedrock
 * (server AWS credentials, no client key needed). Returns null if nothing is configured.
 */
export function resolveAnthropicClient(
  apiKey?: string,
): { client: Anthropic; model: string } | null {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (key) return { client: new Anthropic({ apiKey: key }), model: AI_MODEL };
  const awsAccessKey = AWS_ACCESS_KEY();
  const awsSecretKey = AWS_SECRET_KEY();
  if (awsAccessKey && awsSecretKey) {
    // AnthropicBedrock mirrors the Anthropic SDK's messages.create() shape —
    // cast so callers get one consistent type regardless of provider.
    const client = new AnthropicBedrock({ awsRegion: AWS_REGION(), awsAccessKey, awsSecretKey }) as unknown as Anthropic;
    return { client, model: BEDROCK_MODEL };
  }
  return null;
}
