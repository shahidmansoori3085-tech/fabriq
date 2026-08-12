/**
 * POST /api/ai/read-sheet
 * Photo flow (FR2): Claude vision reads the hand-drawn measurement sheet and
 * extracts items as structured JSON. Model never converts units, never
 * calculates — raw values + confidence only (D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";

const EXTRACT_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          type: { type: "string" as const, enum: ["window", "door", "partition"] },
          width_raw: { type: "string" as const },
          height_raw: { type: "string" as const },
          unit_guess: { type: "string" as const, enum: ["feet", "inches", "mm", "ft-in-sut"] },
          qty: { type: "integer" as const },
          tracks: { type: "string" as const },
          mix: { type: "string" as const },
          system: { type: "string" as const },
          notes: { type: "string" as const },
          confidence: { type: "string" as const, enum: ["high", "medium", "low"] },
        },
        required: ["type", "width_raw", "height_raw", "unit_guess", "qty", "confidence"],
        additionalProperties: false,
      },
    },
    sheet_notes: { type: "string" as const },
    legible: { type: "boolean" as const },
  },
  required: ["items", "legible"],
  additionalProperties: false,
};

const SYSTEM = `Tum FabriQ ho — Indian aluminium fabricator ki hand-drawn measurement sheet padhne wale expert.

Sheet mein kya hota hai:
- Ballpoint pen se bane rectangles (windows/doors/partitions) with sizes
- Sizes: "4x3" (usually FEET), "4'6\"x3'", "54x42" (inches agar bade numbers), "4-6-4" = 4 feet 6 inch 4 sut
- Hindi/Urdu labels, "जाली"/"jali" = mesh, "दो पट्टी"/"2 patti" = 2 track
- System slang: "domal", "18mm", "section", "Z"
- Diagonal strokes inside box = glass
- W (window), D (door), qty like "x5" or "5 nos"

Rules (CRITICAL):
- Width×Height order: Indian fabricators usually write W×H
- NEVER guess a digit. Agar number unclear hai → confidence "low" aur best guess
- NEVER convert units — jo likha hai wahi width_raw/height_raw mein do (e.g. "4'6\"", "54", "4-6-4")
- unit_guess: chhote numbers (2-12) = feet; 24-96 = inches; 300+ = mm
- qty default 1 agar nahi likha
- tracks: "2"/"3" agar sheet pe likha ya draw kiya hai, warna omit
- mix: G=glass J=jali, e.g. "GGJ" agar dikh raha hai, warna omit
- Har item ka notes: jo bhi extra likha hai us box ke paas
- Agar photo dhundhli/unreadable hai → legible: false, items: []
- Hallucinate MAT karo — jo dikhta hai sirf wahi`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { image, mediaType, apiKey } = body as {
    image: string; mediaType: string; apiKey?: string;
  };

  const resolved = resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json(
      { error: "no_key", message: "AI photo padhne ke liye API key chahiye — Settings (⚙) mein daalo." },
      { status: 400 }
    );
  }

  if (resolved.provider === "gemini") {
    try {
      const parsed = await geminiJson({
        apiKey: resolved.apiKey, system: SYSTEM, schema: EXTRACT_SCHEMA, image: { data: image, mediaType },
        userText: "Is measurement sheet ko padho aur items extract karo.",
      });
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(
        { error: "read_failed", message: "Photo padhne mein dikkat aayi — dobara try karo ya haath se bharo." },
        { status: 500 },
      );
    }
  }

  try {
    const { client, model } = resolved;
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/webp",
                data: image,
              },
            },
            { type: "text", text: "Is measurement sheet ko padho aur items extract karo." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("no text");
    const parsed = JSON.parse(text.text);
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const friendly = msg.includes("401") || msg.toLowerCase().includes("auth")
      ? "API key galat hai — Settings (⚙) mein check karo."
      : "Photo padhne mein dikkat aayi — dobara try karo ya haath se bharo.";
    return NextResponse.json({ error: "read_failed", message: friendly }, { status: 500 });
  }
}
