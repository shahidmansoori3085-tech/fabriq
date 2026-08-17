/**
 * POST /api/ai/review
 * Fabrication Review AI — senior fabricator reviews the finished estimate.
 * Deterministic checks always run; Claude adds richer commentary when
 * ANTHROPIC_API_KEY is present. AI never changes numbers (D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";
import { nvidiaJson } from "@/lib/ai/nvidia";
import type { ReviewFinding } from "@/lib/engine/types";

const REVIEW_SCHEMA = {
  type: "object" as const,
  properties: {
    findings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          severity: { type: "string" as const, enum: ["ok", "suggestion", "warning", "blocker"] },
          category: { type: "string" as const },
          message: { type: "string" as const },
          savingEstimate: { type: "string" as const },
        },
        required: ["severity", "category", "message"],
        additionalProperties: false,
      },
    },
    confidenceAdjustment: { type: "integer" as const },
    summary: { type: "string" as const },
  },
  required: ["findings", "summary"],
  additionalProperties: false,
};

const SYSTEM = `You are a senior aluminium fabricator with 25 years of experience, reviewing a junior's estimate.

Write every finding in SIMPLE, PROFESSIONAL ENGLISH — short sentences, no slang, no Hindi or
Hinglish. The reader may not be a native English speaker, so keep the words plain. Keep the trade
vocabulary a workshop uses (Domal, Z-Section, track, sash, mullion, interlock, glazing clip, sut,
chokhat, palla), and say "mesh" rather than "jali".

Review:
1. Profile selection — is the section overkill or underkill for this size?
2. Scrap — where can waste be reduced? Which width, if adjusted, saves a bar?
3. Compatibility — do the top and bottom tracks match? Glass thickness against the clip?
4. Practical warnings — glass size safety, shutter weight, security
5. Chances to save money — give a concrete rupee estimate where possible (a 16' bar is roughly
   ₹280–350 for 40×18, and ₹700–900 for 92mm sections)

Rules:
- NEVER recalculate a number — the engine is deterministic. You give judgment only.
- Every finding short and actionable, the way a senior speaks on the shop floor
- The fabricator is an expert. Be respectful; do not lecture.
- If everything is sound, one or two "ok" findings are enough — do not pad with praise.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items, summary, deterministicFindings, apiKey } = body;

  const resolved = await resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json({ findings: [], source: "none" });
  }

  if (resolved.provider === "gemini") {
    try {
      const parsed = await geminiJson<{ findings: ReviewFinding[]; confidenceAdjustment?: number; summary: string }>({
        apiKey: resolved.apiKey, system: SYSTEM, schema: REVIEW_SCHEMA,
        userText: JSON.stringify({
          job_items: items, estimate_summary: summary, already_flagged_by_rules: deterministicFindings,
          note: "Do not repeat anything under already_flagged — give new insights only.",
        }),
      });
      return NextResponse.json({ ...parsed, source: "ai" });
    } catch {
      return NextResponse.json({ findings: [], source: "error" });
    }
  }

  if (resolved.provider === "nvidia") {
    try {
      const parsed = await nvidiaJson<{ findings: ReviewFinding[]; confidenceAdjustment?: number; summary: string }>({
        apiKey: resolved.apiKey, system: SYSTEM, schema: REVIEW_SCHEMA,
        userText: JSON.stringify({
          job_items: items, estimate_summary: summary, already_flagged_by_rules: deterministicFindings,
          note: "Do not repeat anything under already_flagged — give new insights only.",
        }),
      });
      return NextResponse.json({ ...parsed, source: "ai" });
    } catch {
      return NextResponse.json({ findings: [], source: "error" });
    }
  }

  try {
    const { client, model } = resolved;
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: REVIEW_SCHEMA } },
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            job_items: items,
            estimate_summary: summary,
            already_flagged_by_rules: deterministicFindings,
            note: "Do not repeat anything under already_flagged — give new insights only.",
          }),
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("no text");
    const parsed = JSON.parse(text.text) as {
      findings: ReviewFinding[];
      confidenceAdjustment?: number;
      summary: string;
    };
    return NextResponse.json({ ...parsed, source: "ai" });
  } catch {
    return NextResponse.json({ findings: [], source: "error" });
  }
}
