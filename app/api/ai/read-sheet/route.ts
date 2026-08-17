/**
 * POST /api/ai/read-sheet
 * Photo flow (FR2): Claude vision reads the hand-drawn measurement sheet and
 * extracts items as structured JSON. Model never converts units, never
 * calculates — raw values + confidence only (D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";
import { SHEET_READING_KNOWLEDGE } from "@/lib/engine/knowledge";

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

const SYSTEM = `You are FabriQ, an expert at reading an Indian aluminium fabricator's hand-drawn measurement sheet.

You know how these windows are actually built, so you know which marks on the paper change the
build and must never be flattened away:
${SHEET_READING_KNOWLEDGE}

What these sheets contain (this describes the INPUT — the paper is written in local trade shorthand):
- Ballpoint-pen rectangles (windows, doors, partitions) with sizes written on them
- Sizes: "4x3" (usually FEET), "4'6\"x3'", "54x42" (inches when the numbers are large), "4-6-4" = 4 feet 6 inch 4 sut, "57\"2sut" = 57 inches + 2 sut (no feet component — a bare quote mark plus "sut" is still ft-in-sut shorthand, just missing the feet term)
- Hindi/Urdu labels — "जाली"/"jali" means mesh, "दो पट्टी"/"2 patti" means 2 track
- System shorthand: "domal", "18mm", "section", "Z"
- A heading written once above a GROUP of boxes ("Normal 3 track", "Z section openable+fix window", "Domal", ...) applies to EVERY box in that group, not just the first — carry it down to each box until a new heading appears. Missing this is a common misread; double-check every box in a group got the heading's system/track info before moving to the next group.
- A window box split into sections labelled "fix" and "openable" (sometimes with a width against each, e.g. "fix 22\" | openable | fix 22\"") is a multi-panel Z-section window. Report ONE item for the whole box using its overall width/height, and put the panel order and each labelled size into "notes" exactly as written, in order — the order is part of the build, so never drop it or reorder it.
- A partition box drawn with an internal grid (extra lines dividing it into rows/columns of cells) — quote the grid into "notes", e.g. "grid ~4 columns x 3 rows" (count the cells as best you can), so the fabricator can set bay/row spacing correctly. Do not guess bay spacing yourself.
- W (window), D (door), quantity written as "x5" or "5 nos"

Rules (CRITICAL):
- Width × Height order: Indian fabricators usually write W×H
- NEVER guess a digit. If a number is unclear, set confidence "low" and give your best reading
- NEVER convert units — put exactly what is written into width_raw/height_raw (e.g. "4'6\"", "54", "4-6-4")
- unit_guess: small numbers (2-12) = feet; 24-96 = inches; 300+ = mm
- qty defaults to 1 when not written
- tracks: "2"/"3" when the sheet says or draws it, otherwise omit
- mix: G=glass, J=mesh, e.g. "GGJ" when visible, otherwise omit
- notes: for each item, anything extra written next to that box — including panel breakdowns and grid counts per the rules above
- If the photo is blurred or unreadable, return legible: false and items: []
- Do NOT hallucinate — report only what is actually visible

"notes" and "sheet_notes" are QUOTES OF THE PAPER, not your own writing. Copy what is
written exactly as written, in its own script and words — the app shows it back as
"Written on the sheet: …", so translating it would misquote the fabricator's own note.
Anything you write in your own voice stays simple, professional English.`;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { image, mediaType, images, notes, apiKey } = body as {
    image?: string; mediaType?: string;
    images?: { data: string; mediaType: string }[];
    notes?: string;
    apiKey?: string;
  };

  // A sheet is often several photos — separate pages, or a close-up of a corner
  // the wide shot could not read. The single-image shape is still accepted so
  // older callers keep working.
  const shots = images?.length
    ? images
    : image ? [{ data: image, mediaType: mediaType || "image/jpeg" }] : [];
  if (!shots.length) {
    return NextResponse.json({ error: "no_image", message: "No photo received." }, { status: 400 });
  }

  // The fabricator's own note is context, never a source of dimensions — the
  // rules above still forbid inventing a number that isn't drawn on the sheet.
  const userText = [
    shots.length > 1
      ? `These are ${shots.length} photos of ONE job. Read them together and extract every item. If the same item appears in two photos, list it only once.`
      : "Read this measurement sheet and extract the items.",
    notes?.trim() ? `\nThe fabricator added this note (context only — never take a dimension from it):\n"${notes.trim()}"` : "",
  ].join("");

  const resolved = await resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json(
      { error: "no_key", message: "An API key is needed to read photos — add one under Settings (⚙)." },
      { status: 400 }
    );
  }

  if (resolved.provider === "gemini") {
    try {
      const parsed = await geminiJson({
        apiKey: resolved.apiKey, system: SYSTEM, schema: EXTRACT_SCHEMA, images: shots, userText,
      });
      return NextResponse.json(parsed);
    } catch (e) {
      console.error("[read-sheet/gemini]", e);
      return NextResponse.json(
        { error: "read_failed", message: "Could not read the photo. Try again, or enter the sizes yourself." },
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
            ...shots.map((s) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: s.mediaType as "image/jpeg" | "image/png" | "image/webp",
                data: s.data,
              },
            })),
            { type: "text" as const, text: userText },
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
      ? "That API key is wrong — check it under Settings (⚙)."
      : "Could not read the photo. Try again, or enter the sizes yourself.";
    return NextResponse.json({ error: "read_failed", message: friendly }, { status: 500 });
  }
}
