/**
 * POST /api/ai/read-card
 * Onboarding: Claude vision reads a fabricator's visiting card and extracts the
 * shop profile as structured JSON. Never invents data — only what is printed.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveProvider } from "@/lib/ai/client";
import { geminiJson } from "@/lib/ai/gemini";

const CARD_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },      // shop / business name
    tagline: { type: "string" as const },   // owner name or tagline/services
    mobile: { type: "string" as const },
    address: { type: "string" as const },
    gstin: { type: "string" as const },
    legible: { type: "boolean" as const },
  },
  required: ["legible"],
  additionalProperties: false,
};

const SYSTEM = `You read an aluminium/glass fabricator's printed VISITING CARD and extract the
shop profile. Return ONLY what is actually printed on the card — never invent or guess.
- name: the shop / business name (the biggest brand text, e.g. "M/s Sharma Aluminium & Glass").
- tagline: the owner's personal name OR the services line ("Aluminium Windows, Doors, Partitions").
- mobile: the phone / mobile number as printed (keep +91 / spaces).
- address: the full address line(s).
- gstin: the 15-char GST number if present, else omit.
If a field is not on the card, omit it. If the image is unreadable, set legible:false.`;

export async function POST(req: NextRequest) {
  const { image, mediaType, apiKey } = (await req.json()) as {
    image: string; mediaType: string; apiKey?: string;
  };
  const resolved = resolveProvider(apiKey);
  if (!resolved) {
    return NextResponse.json(
      { error: "no_key", message: "Add an AI key in Settings to scan the card." },
      { status: 400 },
    );
  }

  if (resolved.provider === "gemini") {
    try {
      const parsed = await geminiJson<{ legible: boolean; [k: string]: unknown }>({
        apiKey: resolved.apiKey, system: SYSTEM, schema: CARD_SCHEMA, image: { data: image, mediaType },
        userText: "Read this visiting card and extract the shop profile.",
      });
      if (parsed.legible === false) {
        return NextResponse.json({ error: "unreadable", message: "Card not clear — please fill in manually." }, { status: 200 });
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: "read_failed", message: "Could not read the card — please fill in manually." }, { status: 500 });
    }
  }

  try {
    const { client, model } = resolved;
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: CARD_SCHEMA } },
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
            { type: "text", text: "Read this visiting card and extract the shop profile." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new Error("refusal");
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("no text");
    const parsed = JSON.parse(text.text);
    if (parsed.legible === false) {
      return NextResponse.json({ error: "unreadable", message: "Card not clear — please fill in manually." }, { status: 200 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const friendly = msg.includes("401") || msg.toLowerCase().includes("auth")
      ? "API key looks wrong — check Settings."
      : "Could not read the card — please fill in manually.";
    return NextResponse.json({ error: "read_failed", message: friendly }, { status: 500 });
  }
}
