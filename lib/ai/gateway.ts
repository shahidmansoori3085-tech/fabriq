/**
 * FabriQ AI gateway — one text-chat entry point that routes to either
 * Anthropic (native SDK) or an OpenRouter-style OpenAI-compatible gateway
 * (300+ models, cost control, fallback). The caller picks the provider/model;
 * everything else in the app stays provider-agnostic.
 *
 * NOTE: vision/JSON-schema routes (read-sheet, read-card) stay on the Anthropic
 * SDK — this gateway is for the free-form COPILOT chat where model choice and
 * cost matter most.
 */
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, BEDROCK_MODEL, AWS_ACCESS_KEY, AWS_SECRET_KEY, AWS_REGION } from "./client";
import { geminiChat } from "./gemini";
import { nvidiaChat } from "./nvidia";

export type Provider = "anthropic" | "openrouter" | "bedrock" | "gemini" | "nvidia";

export interface ChatMsg { role: "user" | "assistant"; content: string }

export interface ChatOpts {
  system: string;
  messages: ChatMsg[];
  apiKey: string;
  provider?: Provider;
  model?: string;
  maxTokens?: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function chatComplete(opts: ChatOpts): Promise<string> {
  const provider: Provider = opts.provider ?? "anthropic";
  const maxTokens = opts.maxTokens ?? 700;

  if (provider === "openrouter") {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "FabriQ",
      },
      body: JSON.stringify({
        model: opts.model || "anthropic/claude-3.5-sonnet",
        max_tokens: maxTokens,
        messages: [{ role: "system", content: opts.system }, ...opts.messages],
      }),
    });
    if (!res.ok) throw new Error(`openrouter_${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("openrouter_no_text");
    return text.trim();
  }

  if (provider === "gemini") {
    return geminiChat({
      apiKey: opts.apiKey, system: opts.system, messages: opts.messages, model: opts.model, maxTokens,
    });
  }

  if (provider === "nvidia") {
    return nvidiaChat({
      apiKey: opts.apiKey, system: opts.system, messages: opts.messages, model: opts.model, maxTokens,
    });
  }

  if (provider === "bedrock") {
    // AWS credentials come from server env (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) —
    // no client-entered key needed, so opts.apiKey is ignored here.
    const awsAccessKey = AWS_ACCESS_KEY();
    const awsSecretKey = AWS_SECRET_KEY();
    if (!awsAccessKey || !awsSecretKey) throw new Error("bedrock_no_creds");
    const { AnthropicBedrock } = await import("@anthropic-ai/bedrock-sdk");
    const client = new AnthropicBedrock({ awsRegion: AWS_REGION(), awsAccessKey, awsSecretKey });
    const response = await client.messages.create({
      model: opts.model || BEDROCK_MODEL,
      max_tokens: maxTokens,
      system: opts.system,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("bedrock_no_text");
    return block.text.trim();
  }

  // default: Anthropic native
  const client = new Anthropic({ apiKey: opts.apiKey });
  const response = await client.messages.create({
    model: opts.model || AI_MODEL,
    max_tokens: maxTokens,
    system: opts.system,
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
  });
  if (response.stop_reason === "refusal") throw new Error("refusal");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("anthropic_no_text");
  return block.text.trim();
}
