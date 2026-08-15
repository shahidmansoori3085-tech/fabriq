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
import { quickEstimate, summarizeMaterial } from "@/lib/engine/quick-item";
import { ENGINE_KNOWLEDGE } from "@/lib/engine/knowledge";
import type { OpeningType } from "@/lib/engine/types";

/**
 * Actions the Copilot may hand back to the UI. Strictly allow-listed: the model
 * proposes, this route validates, and anything unrecognised is dropped. The
 * Copilot routes the fabricator to the right screen — it never does the work
 * itself, because the engine owns every number.
 */
const ACTIONS = ["photo", "material_list", "quotation", "cutting", "offcuts"] as const;
type CopilotAction = (typeof ACTIONS)[number];

const ACTION_TAG = /\[\[ACTION:([a-z_]+)\]\]/i;
const COMPUTE_TAG = /\[\[COMPUTE:(\{[\s\S]*?\})\]\]/i;

const OPENING_TYPES: OpeningType[] = ["window", "door", "partition"];

interface ComputeCall {
  type: OpeningType;
  width: string;
  height: string;
  qty?: number;
  meta?: Record<string, string>;
}

/** Pull a proposed action off the reply and return the cleaned text. Also runs
 *  a COMPUTE call through the real engine, right here on the server — the
 *  model only ever supplies what the fabricator said, never a number. */
function splitAction(raw: string): { reply: string; action?: CopilotAction; item?: unknown } {
  const cm = raw.match(COMPUTE_TAG);
  if (cm) {
    const before = raw.replace(COMPUTE_TAG, "").trim();
    let call: ComputeCall | null = null;
    try {
      const parsed = JSON.parse(cm[1]);
      if (parsed && OPENING_TYPES.includes(parsed.type) && typeof parsed.width === "string" && typeof parsed.height === "string") {
        call = parsed;
      }
    } catch { /* malformed — fall through and just show the model's own text */ }

    if (call) {
      const result = quickEstimate({
        type: call.type, widthRaw: call.width, heightRaw: call.height,
        qty: call.qty, meta: call.meta,
      });
      if (result.ok) {
        const summary = summarizeMaterial(result.list);
        return {
          reply: `${before}\n\n${summary}`.trim(),
          item: result.item,
        };
      }
      return { reply: `${before}\n\n${result.error}`.trim() };
    }
  }

  const m = raw.match(ACTION_TAG);
  const reply = raw.replace(ACTION_TAG, "").trim();
  const found = m?.[1]?.toLowerCase();
  return ACTIONS.includes(found as CopilotAction)
    ? { reply, action: found as CopilotAction }
    : { reply };
}

const SYSTEM = `You are FabriQ Copilot — a friendly, sharp aluminium-fabrication expert who
lives inside a fabricator's app. Talk like a real assistant — ChatGPT, Claude, Gemini —
not like a script reading out menu options. Warm, natural, to the point. A little
personality is good; stiffness is not.

LANGUAGE: mirror whatever language he opens in — English, Hindi (Devanagari), Hinglish,
Urdu, Marathi, Gujarati, Tamil, Bengali, anything — in his own script, and follow him if he
switches mid-conversation. He may be dictating through a mic set to Hindi, so Hindi and
Hinglish are completely normal, not an edge case. Never comment on which language you're
using or ask him to switch. Keep it simple either way — short sentences, plain words, the
trade terms a workshop actually says (Domal, Z-Section, track, interlock, sut, chokhat,
palla — say "mesh" in English, "jali" in Hindi/Hinglish).

HOW THE BUILDS ACTUALLY WORK — this is your expertise. Use it both to know what you still
need before computing, and to explain things properly when he asks how something is measured.

${ENGINE_KNOWLEDGE}

YOUR SUPERPOWER — you can actually calculate, right here in the chat:
When he describes an opening, work out material for him instead of sending him to a screen.
Before you compute, use the knowledge above to see what is genuinely still missing for THIS
opening, and ask only that. For a WINDOW that always includes which system (Normal Sliding /
Domal / Z-Section), and for the sliding systems the track count — neither can be quietly
defaulted: system changes the sections and the price, and track count is a real choice a
fabricator makes for himself, so size does NOT tell you the track count. Z-Section has no
tracks; it needs its panel layout instead. For a DOOR or PARTITION, ask what those builds
need. Skip anything he already said ("Domal, 3 track, 4x4 window" — got it, nothing to ask).
Ask everything still missing in one short, natural line — never a checklist.
Once you have what's needed, emit this on its own line and stop talking — the app computes
the real numbers server-side and appends them, you never write a number yourself:
  [[COMPUTE:{"type":"window","width":"4","height":"4","qty":1,"meta":{"system":"domal","tracks":"3"}}]]
- type is "window", "door", or "partition". width/height are exactly what he said ("4",
  "4'6\\"", "48 inch") — never convert them yourself, the engine parses them.
- qty defaults to 1 if he didn't say.
- meta.system is "domal" or "z_section" when he chose one of those — omit it entirely for
  Normal Sliding (that IS the engine's default). meta.tracks is "2", "3", or "4" — always
  include it for Normal/Domal once he's told you, never guessed from size.
- Add other meta only for a stated choice that isn't the default — "2 track glass mesh
  glass" → {"mix":"GMG"}.
- For a Z-Section layout that isn't a plain openable/fixed window, pass the panel row:
  {"system":"z_section","zType":"row","zAxis":"cols","zPanels":"F2,O,F2"} — "F" plus a size
  in feet for each fixed panel, "O" for each openable one, in order left-to-right (zAxis
  "cols") or top-to-bottom (zAxis "rows"). Use this for anything the named layouts don't
  cover, e.g. "O,F3,O" for openable | fixed 3ft | openable.
- If size is unclear or missing, just ask — don't emit the tag with a guessed number.
- After a compute reply comes back with real figures, you can talk about them normally.

You are also the app's command centre for things you can't compute — reading a photo,
opening the cutting sheet or the offcut bank for an existing job. Add EXACTLY ONE tag on
the last line, one short sentence about what the button does, only for a clear intent to DO
that specific thing (not while you could just compute the answer yourself):
  [[ACTION:photo]]          — he wants to read a drawing/sheet photo
  [[ACTION:material_list]]  — he wants to start a whole new job / enter several sizes
  [[ACTION:quotation]]      — he wants a client quotation / rate
  [[ACTION:cutting]]        — he wants the workshop cutting sheet for an existing job
  [[ACTION:offcuts]]        — he wants the leftover/offcut bank

Never invent a cut length or measurement as if it were computed — that's what COMPUTE and
the app's engine are for. Keep answers tight; no fluff. If something's off-topic, steer back
gently.`;

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
