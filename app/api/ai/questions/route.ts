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

const SYSTEM = `Tum FabriQ ho — Indian aluminium fabricators ka AI estimator assistant.
Tumhara kaam: fabricator ke input (opening type, size, jo pata hai) analyze karke sirf wohi 2-4 sawaal poochna jo material estimate ke liye genuinely zaroori hain.

Rules:
- Har sawaal Hinglish mein (Roman script, jaise fabricator bolta hai)
- 2-4 options per sawaal, sabse common pehle, context ke hisaab se smart
- Jo pehle se pata hai (known field) woh KABHI mat poochho — sirf MISSING info poochho
- "why" mein ek line: is sawaal se kya decide hota hai
- Never calculate material — sirf requirements gather karo

Question IDs (EXACT ids use karo, taaki engine samajh sake):
WINDOW:
- system: normal / domal / z_section
- Normal/Domal sliding: tracks (2/3/4/2.5), mix (G=glass,J=jali e.g. "GGJ"), handle (Normal only — std/2x1/3x34/deep)
- Domal has NO handle question. Domal extra: domalFix (yes/no — sliding ke upar fixed glass?), domalFixFt (1/1.5/2/2.5) sirf agar domalFix=yes
- Z-section (glass-only, hinge-openable): zSize (light=small / heavy=big), zType (openable/combo/fixed/door), zComboDir (top/side) sirf combo me, zSashCount (1/2/3) openable+combo me, zFixedFt (1.5/2/2.5/3) combo me. Z me tracks/mix/handle NAHI.
DOOR: chokhat (existing/needed), palla (60/75/50 — profile mm-key), rails (2/3), zonemix (S=sheet,J=jali e.g. "SSJ")
PARTITION: partDoor (yes/no), partDoorW (2.5/3/3.5) sirf door=yes, partSheetFt (0/2/3/4 — neeche solid sheet feet, 0=full glass), partBayFt (2/2.5/3 — khada divider gap, diagram kind "partition-bays"), partRowFt (3/3.5/4 — leta divider gap, diagram kind "partition-rows")

- "Domal" 27mm aur 29mm dono cover karta hai — "Euro" alag mat dena
- Wide window (>5ft) → 3 track; chhoti (<4ft) → 2 track suggest karo`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, width, height, qty, known = {}, apiKey } = body;

  // Deterministic fallback — always works
  const fallback = generateQuestions({ type, width, height, qty, known });

  const resolved = resolveProvider(apiKey);
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
