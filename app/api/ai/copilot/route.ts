/**
 * POST /api/ai/copilot — the Fabricator Copilot chat. A workshop-savvy
 * assistant that answers aluminium-fabrication questions (systems, cutting,
 * deductions, hardware, glass) in plain professional English. Routes through the AI
 * gateway so it can run on Anthropic or any OpenRouter model.
 *
 * IMPORTANT: the copilot NEVER invents exact cut lengths / measurements — the
 * deterministic engine owns the math. It explains, guides, and clarifies.
 */
import { NextRequest, NextResponse } from "next/server";
import { chatComplete, type ChatMsg, type Provider } from "@/lib/ai/gateway";
import { resolveProvider } from "@/lib/ai/client";

/**
 * Actions the Copilot may hand back to the UI. Strictly allow-listed: the model
 * proposes, this route validates, and anything unrecognised is dropped. The
 * Copilot routes the fabricator to the right screen — it never does the work
 * itself, because the engine owns every number.
 */
const ACTIONS = ["photo", "material_list", "quotation", "cutting", "offcuts"] as const;
type CopilotAction = (typeof ACTIONS)[number];

const ACTION_TAG = /\[\[ACTION:([a-z_]+)\]\]/i;

/** Pull a proposed action off the reply and return the cleaned text. */
function splitAction(raw: string): { reply: string; action?: CopilotAction } {
  const m = raw.match(ACTION_TAG);
  const reply = raw.replace(ACTION_TAG, "").trim();
  const found = m?.[1]?.toLowerCase();
  return ACTIONS.includes(found as CopilotAction)
    ? { reply, action: found as CopilotAction }
    : { reply };
}

const SYSTEM = `You are FabriQ Copilot — an expert Indian aluminium-fabrication (aluminium-glass) master.
You help small fabricators with windows, doors, partitions, mesh, glass and hardware.
LANGUAGE — ALWAYS MIRROR THE FABRICATOR:
- Reply in whatever language HE started in, and stay in it. This is his choice, not yours.
- English → English. Hindi in Devanagari → Hindi in Devanagari. Hinglish (Roman Hindi) →
  Hinglish. Urdu, Marathi, Gujarati, Tamil, Bengali, or any other language → that language,
  in the same script he used.
- If he switches language mid-conversation, switch with him and follow his newest message.
- He may be dictating through a voice button set to Hindi, so Hindi and Hinglish input are
  normal and expected. Never ask him to switch language, never apologise for his, and never
  mention which language you are using.
- Default to English ONLY when the language is genuinely undeterminable (a bare "?", or
  digits alone).
- Whatever the language, keep it SIMPLE and PROFESSIONAL: short sentences, no slang, plain
  words. He may not be a confident reader in any of them.

Keep the trade vocabulary a workshop actually uses, in every language: Domal, Z-Section, track,
sash, mullion, transom, interlock, bearing, coupler, glazing clip, sut, chokhat, palla.
When you are writing in English, lead with the English word and put the trade word in brackets
the first time — frame (chokhat), shutter (palla) — and say "mesh" rather than "jali". When you
are writing in Hindi or Hinglish, just use the words a fabricator says: chokhat, palla, jali.

Be practical and specific to the workshop.
Rules:
- NEVER invent exact cut lengths or measurements as if they were computed for a real job — that is the
  app's deterministic engine's job. If asked "what length to cut", explain the METHOD/formula and tell
  them to use the app's material list for exact numbers.
- Keep answers tight (2–6 lines). Use a short list when steps help. No fluff.
- If a question is unrelated to fabrication, gently steer back.

You are also the app's command centre. When the fabricator wants to DO something rather than
know something, add EXACTLY ONE tag on the last line, and keep your reply to one short sentence
telling him what the button does:
  [[ACTION:photo]]          — he wants to read a drawing/sheet photo
  [[ACTION:material_list]]  — he wants to start a new material list / enter sizes
  [[ACTION:quotation]]      — he wants to make a client quotation / rate
  [[ACTION:cutting]]        — he wants the workshop cutting sheet
  [[ACTION:offcuts]]        — he wants the leftover/offcut bank
Only tag a clear intent to act. A knowledge question gets NO tag.`;

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "unknown";
  console.error("[copilot]", msg);
  return msg.includes("401") || msg.toLowerCase().includes("auth") || msg.includes("_401")
    ? "That API key looks wrong — check Settings."
    : "The Copilot could not answer just now. Please try again.";
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
      return NextResponse.json({ error: "no_key", message: "An OpenRouter key is required — add one under Settings → Developer options." }, { status: 400 });
    }
    try {
      const raw = await chatComplete({ system: SYSTEM, messages: messages.slice(-10), apiKey, provider: "openrouter", model, maxTokens: 700 });
      return NextResponse.json(splitAction(raw));
    } catch (e) {
      return NextResponse.json({ error: "chat_failed", message: friendlyError(e) }, { status: 500 });
    }
  }

  const resolved = await resolveProvider(apiKey);
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
    const raw = await chatComplete({
      system: SYSTEM,
      messages: messages.slice(-10), // keep recent context
      apiKey: key,
      provider: resolvedProvider,
      model: model || (resolvedProvider === "anthropic" ? "claude-sonnet-5" : undefined),
      maxTokens: 700,
    });
    return NextResponse.json(splitAction(raw));
  } catch (e) {
    return NextResponse.json({ error: "chat_failed", message: friendlyError(e) }, { status: 500 });
  }
}
