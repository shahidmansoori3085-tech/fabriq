/**
 * POST /api/ai/questions
 * AI-driven dynamic question generation (D11). Claude analyzes the situation
 * and returns 3-4 contextual questions with 4 options each.
 * Falls back to deterministic rules when no ANTHROPIC_API_KEY.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";
import { generateQuestions, type Question } from "@/lib/engine/questions";
import { formatFtInSut } from "@/lib/engine/units";

const QUESTION_SCHEMA = {
  type: "object" as const,
  properties: {
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          question: { type: "string" as const },
          why: { type: "string" as const },
          options: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                value: { type: "string" as const },
                label: { type: "string" as const },
                hint: { type: "string" as const },
              },
              required: ["value", "label"],
              additionalProperties: false,
            },
          },
          diagram: {
            type: "object" as const,
            properties: {
              kind: { type: "string" as const,
                enum: ["tracks", "shutter-mix", "profile", "partition-type", "partition-bays", "partition-rows"] },
            },
            required: ["kind"],
            additionalProperties: false,
          },
        },
        required: ["id", "question", "why", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

const SYSTEM = `You are FabriQ — an estimating assistant for Indian aluminium fabricators.
Your job: read the fabricator's input (opening type, size, what is already known) and ask ONLY the
2-4 questions genuinely needed to produce a material estimate.

Language:
- Write every question, "why" line, option label and hint in SIMPLE, PROFESSIONAL ENGLISH.
  Short sentences, no slang, no Hindi or Hinglish. The reader may not be a native English
  speaker, so keep the words plain.
- Keep the trade vocabulary a workshop actually uses: Domal, Z-Section, track, sash, mullion,
  transom, interlock, bearing, coupler, glazing clip, sut, chokhat, palla.
- Where a Hindi trade word has a clear English equivalent, lead with the English and put the
  trade word in brackets: frame (chokhat), shutter (palla). Say "mesh", not "jali".

Rules:
- 2-4 options per question, most common first, chosen sensibly for the context
- NEVER ask about anything already in the "known" field — ask only what is MISSING
- "why" is one line: what this answer decides
- Never calculate material — only gather requirements

Question IDs (use these EXACT ids so the engine understands them):
WINDOW:
- system: normal / domal / z_section
- Normal/Domal sliding: tracks (2/3/4/2.5), mix (G=glass, J=mesh, e.g. "GGJ"), handle (Normal only — std/2x1/3x34/deep)
- Domal has NO handle question. Domal extras: domalFix (yes/no — a fixed glass band above the sliding?), domalFixFt (1/1.5/2/2.5), only when domalFix=yes
- Z-section (glass-only, hinge-openable): zSize (light=small / heavy=big), zType (openable/combo/fixed/door), zComboDir (top/side/both — "both" = fixed strips on both sides, openable in the middle) only for combo, zSashCount (1/2/3) for openable and combo, zFixedFt (1.5/2/2.5/3 — for "both", the width of EACH side) for combo. Z-section has NO tracks, mix or handle.
DOOR: chokhat (existing/needed), palla (60/75/50 — profile mm key), rails (2/3), zonemix (S=sheet, J=mesh, e.g. "SSJ")
PARTITION: partDoor (yes/no), partDoorW (2.5/3/3.5) only when door=yes, partSheetFt (0/2/3/4 — feet of solid sheet at the bottom, 0=full glass), partBayFt (2/2.5/3 — vertical divider gap, diagram kind "partition-bays"), partRowFt (3/3.5/4 — horizontal divider gap, diagram kind "partition-rows")

- "Domal" covers both 27mm and 29mm — do not offer "Euro" separately
- Wide window (>5ft) → suggest 3 track; small (<4ft) → suggest 2 track`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, width, height, qty, known = {}, apiKey } = body;

  // Deterministic fallback — always works
  const fallback = generateQuestions({ type, width, height, qty, known });

  const resolved = await resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json({ questions: fallback, source: "rules" });
  }

  if (resolved.provider === "gemini") {
    try {
      const parsed = await geminiJson<{ questions: Question[] }>({
        apiKey: resolved.apiKey, system: SYSTEM, schema: QUESTION_SCHEMA,
        userText: JSON.stringify({
          opening_type: type,
          size_display: `${formatFtInSut(width)} × ${formatFtInSut(height)}`,
          width_um: width, height_um: height, qty, already_known: known,
        }),
      });
      return NextResponse.json({ questions: parsed.questions.slice(0, 4), source: "ai" });
    } catch {
      return NextResponse.json({ questions: fallback, source: "rules-fallback" });
    }
  }

  try {
    const { client, model } = resolved;
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: QUESTION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            opening_type: type,
            size_display: `${formatFtInSut(width)} × ${formatFtInSut(height)}`,
            width_um: width,
            height_um: height,
            qty,
            already_known: known,
          }),
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("no text");
    const parsed = JSON.parse(text.text) as { questions: Question[] };
    return NextResponse.json({ questions: parsed.questions.slice(0, 4), source: "ai" });
  } catch {
    return NextResponse.json({ questions: fallback, source: "rules-fallback" });
  }
}
