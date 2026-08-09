/**
 * POST /api/ai/review
 * Fabrication Review AI — senior fabricator reviews the finished estimate.
 * Deterministic checks always run; Claude adds richer commentary when
 * ANTHROPIC_API_KEY is present. AI never changes numbers (D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveAnthropicClient } from "@/lib/ai/client";
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

const SYSTEM = `Tum ek senior aluminium fabricator ho — 25 saal ka experience. Junior ka estimate review kar rahe ho.

Review karo (Hinglish mein, Roman script):
1. Profile selection — kya section overkill/underkill hai is size ke liye?
2. Scrap — kahan waste kam ho sakta hai? Konsi width adjust karne se bar bachega?
3. Compatibility — top/bottom track match? Glass thickness vs clip?
4. Practical warnings — glass size safety, shutter weight, security
5. Paisa bachane ke मौke — concrete rupees estimate jahan possible (16' bar ~₹280-350 for 40×18, ~₹700-900 for 92mm sections)

Rules:
- Tum numbers KABHI recalculate nahi karte — engine deterministic hai. Tum sirf judgment dete ho.
- Har finding short aur actionable — jaise senior workshop mein bolta hai
- Fabricator expert hai — usko respect se bolo, lecture mat do
- Agar sab sahi hai toh 1-2 "ok" findings kaafi hain, khaali tareef mat bharo`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { items, summary, deterministicFindings, apiKey } = body;

  const resolved = resolveAnthropicClient(apiKey);
  if (!resolved) {
    return NextResponse.json({ findings: [], source: "none" });
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
            note: "already_flagged wale points repeat mat karo — naye insights do",
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
