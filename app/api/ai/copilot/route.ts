/**
 * POST /api/ai/copilot — the Fabricator Copilot chat. A workshop-savvy
 * assistant that answers aluminium-fabrication questions (systems, cutting,
 * deductions, hardware, glass) in simple Hinglish. Routes through the AI
 * gateway so it can run on Anthropic or any OpenRouter model.
 *
 * IMPORTANT: the copilot NEVER invents exact cut lengths / measurements — the
 * deterministic engine owns the math. It explains, guides, and clarifies.
 */
import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMsg, type Provider } from "@/lib/ai/gateway";
import { resolveProvider } from "@/lib/ai/client";

const SYSTEM = `You are FabriQ Copilot — an expert Indian aluminium-fabrication (aluminium-glass) master.
You help small fabricators with windows, doors, partitions, mesh/jali, glass and hardware.
Answer in short, simple HINGLISH (Roman Hindi + English terms the fabricator knows: shutter, palla,
interlock, chokhat, jali, sut, foot). Be practical and specific to the workshop.
Rules:
- NEVER invent exact cut lengths or measurements as if they were computed for a real job — that is the
  app's deterministic engine's job. If asked "what length to cut", explain the METHOD/formula and tell
  them to use the app's material list for exact numbers.
- Keep answers tight (2–6 lines). Use a short list when steps help. No fluff.
- If a question is unrelated to fabrication, gently steer back.`;

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "unknown";
  console.error("[copilot]", msg);
  return msg.includes("401") || msg.toLowerCase().includes("auth") || msg.includes("_401")
    ? "API key looks wrong — check Settings."
    : "Copilot abhi jawab nahi de paaya — dobara try karo.";
}

export async function POST(req: NextRequest) {
  const { messages, apiKey, provider, model } = (await req.json()) as {
    messages: ChatMsg[]; apiKey?: string; provider?: Provider; model?: string;
  };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "no_messages" }, { status: 400 });
  }

  // "openrouter" is an explicit choice made in Settings → Advanced; it's the
  // one case a client apiKey is required for and auto-detection is skipped.
  if (provider === "openrouter") {
    if (!apiKey) {
      return NextResponse.json({ error: "no_key", message: "OpenRouter key chahiye — Settings → Advanced." }, { status: 400 });
    }
    try {
      const reply = await chatComplete({ system: SYSTEM, messages: messages.slice(-10), apiKey, provider: "openrouter", model, maxTokens: 700 });
      return NextResponse.json({ reply });
    } catch (e) {
      return NextResponse.json({ error: "chat_failed", message: friendlyError(e) }, { status: 500 });
    }
  }

  const resolved = resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json({ error: "no_key", message: "Add an AI key in Settings to use the Copilot." }, { status: 400 });
  }
  const resolvedProvider: Provider = resolved.provider;
  // gateway.chatComplete builds its own Anthropic client from a key string —
  // it can't reuse resolved.client. Bedrock ignores this value (it reads AWS
  // creds itself); for "anthropic", resolveProvider only chose that branch
  // because one of these two was truthy, so this is always the right key.
  const key = resolved.provider === "gemini" ? resolved.apiKey : (apiKey || process.env.ANTHROPIC_API_KEY || "");
  try {
    const reply = await chatComplete({
      system: SYSTEM,
      messages: messages.slice(-10), // keep recent context
      apiKey: key,
      provider: resolvedProvider,
      model: model || (resolvedProvider === "anthropic" ? "claude-sonnet-5" : undefined),
      maxTokens: 700,
    });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: "chat_failed", message: friendlyError(e) }, { status: 500 });
  }
}
