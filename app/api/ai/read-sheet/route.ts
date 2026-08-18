/**
 * POST /api/ai/read-sheet
 * Photo flow (FR2): Claude vision reads the hand-drawn measurement sheet and
 * extracts items as structured JSON. Model never converts units, never
 * calculates — raw values + confidence only (D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";
import { nvidiaJson } from "@/lib/ai/nvidia";
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
          z_axis: { type: "string" as const, enum: ["cols", "rows"] },
          z_panels: { type: "string" as const },
          part_columns: { type: "integer" as const },
          part_rows: { type: "integer" as const },
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
- A window box split into sections labelled "fix" and "openable" (sometimes with a width against each, e.g. "fix 22\" | openable | fix 22\"") is a multi-panel Z-section window. Report ONE item for the whole box using its overall width/height. THE APP CANNOT ASK A GOOD FOLLOW-UP QUESTION ABOUT SOMETHING THE SHEET ALREADY ANSWERED — so when the panel order and each fixed panel's size are legible, fill z_axis ("cols" for side-by-side panels, "rows" for stacked) and z_panels: a left-to-right (or top-to-bottom) comma list, "F" plus the size in FEET for a fixed panel, "O" for an openable one — e.g. fix 22in | openable | fix 22in -> z_axis "cols", z_panels "F1.83,O,F1.83". This lets the app skip asking a question it already has the answer to. Still put the exact wording in "notes" too, including anything that doesn't fit the panel list cleanly (an odd extra label like "top fix 30\"" on part of a panel) — that stays as a quote for the fabricator to check, not something to silently fold into z_panels or guess about. If the panel sizes are NOT given (just the order, e.g. "openable | fix | openable" with no width on the fix), leave z_panels empty and quote the order into notes instead — the app will ask for the missing size, which is a real gap, not a redundant question.
- A partition box drawn with an internal grid (extra lines dividing it into rows/columns of cells) — count the columns and rows and fill part_columns/part_rows (best count you can make from the drawing), so the app can work out bay/row spacing itself instead of asking the fabricator to state a spacing the drawing already shows. Also quote the grid into "notes" for the fabricator to double check, e.g. "grid ~4 columns x 3 rows".
- W (window), D (door), quantity written as "x5" or "5 nos"

Rules (CRITICAL):
- Width × Height order: Indian fabricators usually write W×H
- NEVER guess a digit. If a number is unclear, set confidence "low" and give your best reading
- NEVER convert units — put exactly what is written into width_raw/height_raw (e.g. "4'6\"", "54", "4-6-4")
- unit_guess: small numbers (2-12) = feet; 24-96 = inches; 300+ = mm
- qty defaults to 1 when not written
- tracks: "2"/"3" when the sheet says or draws it, otherwise omit
- mix: G=glass, J=mesh, e.g. "GGJ" when visible, otherwise omit
- z_axis/z_panels, part_columns/part_rows: fill these whenever the drawing actually shows them (see rules above) — the whole point is to ask the fabricator only about what the sheet DIDN'T already tell you. Never fill them from a guess; leave empty/omitted when genuinely not legible.
- notes: for each item, anything extra written next to that box — including the exact panel wording and grid counts per the rules above, even when you also filled the structured fields
- If the photo is blurred or unreadable, return legible: false and items: []
- Do NOT hallucinate — report only what is actually visible

"notes" and "sheet_notes" are QUOTES OF THE PAPER, not your own writing. Copy what is
written exactly as written, in its own script and words — the app shows it back as
"Written on the sheet: …", so translating it would misquote the fabricator's own note.
Anything you write in your own voice stays simple, professional English.`;

/**
 * Turn a provider error into something the fabricator can act on.
 *
 * Every failure used to render as the same "Could not read the photo. Try
 * again" — which is actively wrong advice when the cause is a rate limit
 * (trying again immediately is the one thing that cannot work) and useless
 * when the key is bad. The `reason` code is a short slug, never the raw
 * provider text: it is enough to diagnose from a log or a bug report without
 * leaking provider internals to the client.
 */
function readFailure(e: unknown): { error: string; message: string; reason: string } {
  const raw = e instanceof Error ? e.message : String(e);
  const status = raw.match(/_(\d{3})\b/)?.[1];
  const lower = raw.toLowerCase();

  if (status === "429" || lower.includes("quota") || lower.includes("rate limit")) {
    return {
      error: "read_failed", reason: "rate_limited",
      message: "Too many photo reads just now. Wait a minute and try again — or enter the sizes yourself.",
    };
  }
  if (status === "401" || status === "403" || lower.includes("auth") || lower.includes("api key")) {
    return {
      error: "read_failed", reason: "bad_key",
      message: "The AI key was rejected — check it under Settings (⚙).",
    };
  }
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("etimedout")) {
    return {
      error: "read_failed", reason: "timeout",
      message: "Reading the photo took too long. Try a clearer or smaller photo, or enter the sizes yourself.",
    };
  }
  if (lower.includes("bad_json") || lower.includes("no_text")) {
    return {
      error: "read_failed", reason: "bad_response",
      message: "The photo could not be read cleanly. Try again, or enter the sizes yourself.",
    };
  }
  return {
    error: "read_failed", reason: "unknown",
    message: "Could not read the photo. Try again, or enter the sizes yourself.",
  };
}

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
      return NextResponse.json(readFailure(e), { status: 500 });
    }
  }

  if (resolved.provider === "nvidia") {
    try {
      const parsed = await nvidiaJson({
        apiKey: resolved.apiKey, system: SYSTEM, schema: EXTRACT_SCHEMA, images: shots, userText,
      });
      return NextResponse.json(parsed);
    } catch (e) {
      console.error("[read-sheet/nvidia]", e);
      return NextResponse.json(readFailure(e), { status: 500 });
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
