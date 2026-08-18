/**
 * FabriQ Question Brain — fallback rules.
 * When ANTHROPIC_API_KEY is set, /api/ai/questions asks Claude to analyze the
 * situation and generate contextual questions. Without a key, these
 * deterministic rules produce sensible questions so the app always works.
 * Format contract (both paths): 4 options + a free-text "Enter your own".
 *
 * Copy rule for everything a fabricator reads: plain professional English,
 * short sentences, no slang. Trade names that a shop actually says out loud —
 * Domal, Z-Section, track, sash, mullion, interlock, chokhat, palla — stay,
 * because translating them would make the app harder to use, not easier. The
 * two Hindi words that DO have a clear English equivalent lead in English with
 * the trade word in brackets on first use: Frame (chokhat), Shutter (palla).
 */
import { Um, mm, formatFtInSut } from "./units";

export interface Question {
  id: string;
  question: string;
  /** one line on why the answer matters */
  why: string;
  options: { value: string; label: string; hint?: string }[];
  /** diagram hint for the SVG renderer */
  diagram?: { kind: "tracks" | "shutter-mix" | "profile" | "partition-type" | "partition-bays" | "partition-rows"; params?: Record<string, string> };
}

export interface QuestionContext {
  type: "window" | "door" | "partition";
  width: Um;
  height: Um;
  qty: number;
  known: Record<string, string>; // answers so far / profile defaults
}

/**
 * Questions a shop answers ONCE for a whole job rather than per opening.
 *
 * A photographed sheet with six windows used to run six separate rounds of the
 * same interrogation — "which system?" asked six times for a job that is
 * obviously all one system. These four are the ones that are uniform in
 * practice: the shop builds a job in one system, one pipe size, one palla
 * profile. Everything else (tracks, mix, fixed bands, bays) genuinely differs
 * opening to opening and stays per-item.
 */
export const JOB_LEVEL_IDS = new Set(["system", "zSize", "chokhat", "palla"]);

/**
 * The job-level round, worded for a whole job instead of one opening.
 *
 * Only asks what is still unknown, and only for the types actually present on
 * the sheet. Returns [] when there is nothing worth asking once — the caller
 * should then skip the round entirely rather than show an empty screen.
 */
export function jobLevelQuestions(opts: {
  types: ("window" | "door" | "partition")[];
  count: number;
  known: Record<string, string>;
}): Question[] {
  const { types, count, known } = opts;
  const qs: Question[] = [];
  const many = count > 1;
  const all = many ? `all ${count}` : "this";

  if (types.includes("window") && !known.system) {
    qs.push({
      id: "system",
      question: `Which system for ${all} window${many ? "s" : ""}?`,
      why: many ? "Answer once — we will not ask again for each window" : "The system decides the sections and the formula",
      options: [
        { value: "normal", label: "Normal Sliding", hint: "18mm — most common" },
        { value: "domal", label: "Domal", hint: "27–29mm — premium, different build" },
        { value: "z_section", label: "Z-Section", hint: "Hinge-openable — fixed, openable or door" },
      ],
    });
  }

  // Only meaningful once Z-section is the chosen system.
  if (types.includes("window") && known.system === "z_section" && !known.zSize) {
    qs.push({
      id: "zSize",
      question: `Which pipe size for ${all} window${many ? "s" : ""}?`,
      why: "Size changes the outer, shutter and center sections, and the weight",
      options: [
        { value: "light", label: "Small (40×40)", hint: "For normal windows" },
        { value: "heavy", label: "Big (40×55 / 70)", hint: "For large windows and doors" },
      ],
    });
  }

  if (types.includes("door")) {
    if (!known.chokhat) {
      qs.push({
        id: "chokhat",
        question: "Is the door frame (chokhat) already fitted?",
        why: "If the frame is already there, you only need an estimate for the shutter",
        options: [
          { value: "existing", label: "Yes, already fitted", hint: "Shutter only" },
          { value: "needed", label: "No, we have to make it", hint: "Frame + shutter" },
        ],
      });
    }
    if (!known.palla) {
      qs.push({
        id: "palla",
        question: "Which shutter (palla) profile size?",
        why: "Size changes the section code and the weight",
        options: [
          { value: "60", label: "60×25mm", hint: "Moulding handle — common" },
          { value: "75", label: "75×25mm", hint: "3×1 handle — heavy" },
          { value: "50", label: "50×25mm", hint: "2×1 handle — light" },
        ],
      });
    }
  }

  return qs;
}

export function generateQuestions(ctx: QuestionContext): Question[] {
  const qs: Question[] = [];
  const wide = ctx.width >= mm(1500);
  const sizeLabel = `${formatFtInSut(ctx.width)} × ${formatFtInSut(ctx.height)}`;

  if (ctx.type === "window") {
    if (!ctx.known.system) {
      qs.push({
        id: "system",
        question: `${sizeLabel} window — which system?`,
        why: "The system decides the sections and the formula",
        options: [
          { value: "normal", label: "Normal Sliding", hint: "18mm — most common" },
          { value: "domal", label: "Domal", hint: "27–29mm — premium, different build" },
          { value: "z_section", label: "Z-Section", hint: "Hinge-openable — fixed, openable or door" },
        ],
      });
    }

    const chosenSystem = ctx.known.system ?? "normal";
    const isDomal = chosenSystem === "domal";
    const isZSection = chosenSystem === "z_section";

    // Domal "sliding + upar fix" — an optional fixed glass band on top of the
    // sliding window, framed in SP partition pipe (founder-confirmed 2026-08-04).
    if (isDomal) {
      if (!ctx.known.domalFix) {
        qs.push({
          id: "domalFix",
          question: "Fixed glass band ABOVE the sliding?",
          why: "A fixed band adds SP partition pipe and glazing clip",
          options: [
            { value: "no", label: "No, sliding only", hint: "Full window slides" },
            { value: "yes", label: "Yes, fixed on top", hint: "Sliding below, fixed glass above" },
          ],
        });
      }
      if (ctx.known.domalFix === "yes" && !ctx.known.domalFixFt) {
        qs.push({
          id: "domalFixFt",
          question: "How tall is the fixed band on top (feet)?",
          why: "This sets where the coupler sits and the size of the fixed glass",
          options: [
            { value: "1", label: "1 ft", hint: "Narrow band" },
            { value: "1.5", label: "1.5 ft" },
            { value: "2", label: "2 ft", hint: "Most common" },
            { value: "2.5", label: "2.5 ft" },
          ],
        });
      }
    }

    if (isZSection) {
      // Z-section is a GLASS-only system in this shop (founder-confirmed
      // 2026-08-03: "only glass lagta hai") — no jali/sheet mix is asked.
      if (!ctx.known.zSize) {
        qs.push({
          id: "zSize",
          question: "Which pipe size — small or big?",
          why: "Size changes the outer, shutter and center sections, and the weight",
          options: [
            { value: "light", label: "Small (40×40)", hint: "For normal windows" },
            { value: "heavy", label: "Big (40×55 / 70)", hint: "For large windows and doors" },
          ],
        });
      }
      // zType sets both the layout and the door flag in one question.
      if (!ctx.known.zType) {
        qs.push({
          id: "zType",
          question: "Which type will this be?",
          why: "The type decides the whole build and the formula",
          options: [
            { value: "openable", label: "Openable window", hint: "Mullion + shutter" },
            { value: "combo", label: "Fixed on top, openable below", hint: "Split by a transom — most common" },
            { value: "fixed", label: "Fully fixed (does not open)", hint: "Glass + clip only, no shutter" },
            { value: "door", label: "Door", hint: "Single shutter, no mullion" },
          ],
        });
      }
      const zType = ctx.known.zType ?? "openable";

      // A panel row read off a photographed sheet can carry the ORDER
      // without every fixed panel's size — "openable | fix | openable" with
      // no width written against the fix. The layout is NOT the gap there
      // (the sheet showed it, and the preset layouts above cannot even
      // express that shape); the one missing size is. Ask for exactly that,
      // one panel at a time, so the fabricator is never made to restate a
      // layout he already drew.
      if (zType === "row" && ctx.known.zOrder && !ctx.known.zPanels) {
        const order = ctx.known.zOrder.split(",").map((s) => s.trim()).filter(Boolean);
        const idx = order.findIndex(
          (tok, i) => tok === "F" && !(parseFloat(ctx.known[`zPanelFt${i}`] ?? "") > 0));
        if (idx >= 0) {
          const sideways = ctx.known.zAxis !== "rows";
          const dim = sideways ? "wide" : "tall";
          const fixedCount = order.filter((t) => t === "F").length;
          const nth = order.slice(0, idx + 1).filter((t) => t === "F").length;
          const which = fixedCount === 1
            ? "the fixed panel"
            : `fixed panel ${nth} of ${fixedCount} (position ${idx + 1} in the row)`;
          const drawn = order.map((t) => (t === "F" ? "fix" : "openable")).join(" | ");
          qs.push({
            id: `zPanelFt${idx}`,
            question: `How ${dim} is ${which}?`,
            why: `Your sheet shows ${drawn} — only this size was not written on it`,
            options: [
              { value: "2", label: "2 ft", hint: "Most common" },
              { value: "1.5", label: "1.5 ft" },
              { value: "2.5", label: "2.5 ft" },
              { value: "3", label: "3 ft" },
            ],
          });
        }
      }

      // For a combo: is the fixed part on TOP (horizontal transom) or on the
      // SIDE (vertical mullion)?
      if (zType === "combo" && !ctx.known.zComboDir) {
        qs.push({
          id: "zComboDir",
          question: "Where is the fixed part?",
          why: "Top or side changes the transom/mullion and both glass sizes",
          options: [
            { value: "top", label: "On top (horizontal band)", hint: "Fixed above, opens below" },
            { value: "side", label: "On one side (vertical band)", hint: "One side fixed, other opens" },
            { value: "both", label: "On both sides", hint: "Fixed | openable | fixed — openable in the middle" },
            { value: "center", label: "In the middle", hint: "Openable | fixed | openable — fixed in the middle" },
          ],
        });
      }
      // Sash count applies to the openable band (openable window OR the
      // openable part of a fix+openable combo). Not for a plain fixed or door.
      // For "center", it means sashes on EACH side of the fixed middle, not
      // the window total — there are two separate openable groups there.
      if ((zType === "openable" || zType === "combo") && !ctx.known.zSashCount) {
        const perSide = zType === "combo" && ctx.known.zComboDir === "center";
        qs.push({
          id: "zSashCount",
          question: perSide ? "How many sashes on EACH side of the fixed middle?" : "How many sashes in the openable part?",
          why: "Sash count decides the number of mullions and shutters",
          options: [
            { value: "1", label: "1 sash", hint: "No mullion" },
            { value: "2", label: "2 sashes", hint: "1 mullion" },
            { value: "3", label: "3 sashes", hint: "2 mullions" },
          ],
        });
      }
      // For a combo, how big is the fixed part (height if top, width if side/centre).
      if (zType === "combo" && !ctx.known.zFixedFt) {
        const dir = ctx.known.zComboDir;
        qs.push({
          id: "zFixedFt",
          question: dir === "both" ? "How wide is EACH fixed side (feet)?"
            : dir === "center" ? "How wide is the fixed part in the middle (feet)?"
            : dir === "side" ? "How wide is the fixed part on the side (feet)?"
            : "How tall is the fixed part on top (feet)?",
          why: dir === "both"
            ? "Both fixed strips are cut to this same width — this sets where both dividers sit"
            : "This sets where the divider sits and the size of both glass panels",
          options: [
            { value: "1.5", label: "1.5 ft", hint: "Small fixed band" },
            { value: "2", label: "2 ft", hint: "Most common" },
            { value: "2.5", label: "2.5 ft" },
            { value: "3", label: "3 ft", hint: "Large fixed band" },
          ],
        });
      }
    }

    // Track / mix / handle questions apply only to the SLIDING systems
    // (Normal + Domal). Z-section is hinge-openable — it has no tracks and
    // its own layout questions above, so skip all of these for it.
    // Track count — same concept for Normal Sliding AND Domal
    if (!isZSection && !ctx.known.tracks) {
      qs.push({
        id: "tracks",
        question: "How many tracks?",
        why: "Track count decides the bottom section and the number of shutters",
        diagram: { kind: "tracks" },
        options: wide
          ? [
              { value: "3", label: "3 track", hint: "Common at this width" },
              { value: "2", label: "2 track" },
              { value: "4", label: "4 track" },
              { value: "2.5", label: "2 track + fixed" },
            ]
          : [
              { value: "2", label: "2 track", hint: "Enough at this width" },
              { value: "3", label: "3 track" },
              { value: "4", label: "4 track" },
              { value: "2.5", label: "2 track + fixed" },
            ],
      });
    }

    // Shutter mix — glass/jali, driven by track count, same for both systems
    if (!isZSection && !ctx.known.mix) {
      const tracks = ctx.known.tracks ?? (wide ? "3" : "2");
      if (tracks === "4") {
        qs.push({
          id: "mix",
          question: "How should the shutters be split?",
          why: "The glass and mesh mix changes the material list",
          diagram: { kind: "shutter-mix", params: { tracks: "4" } },
          options: [
            { value: "GGGJ", label: "3 glass + 1 mesh", hint: "Most common" },
            { value: "GGJJ", label: "2 glass + 2 mesh" },
            { value: "GGGG", label: "4 glass, no mesh" },
            { value: "GJJJ", label: "1 glass + 3 mesh" },
          ],
        });
      } else if (tracks === "3") {
        qs.push({
          id: "mix",
          question: "How should the shutters be split?",
          why: "The glass and mesh mix changes the material list",
          diagram: { kind: "shutter-mix", params: { tracks: "3" } },
          options: [
            { value: "GGJ", label: "2 glass + 1 mesh", hint: "Most common" },
            { value: "GGG", label: "3 glass, no mesh" },
            { value: "GJJ", label: "1 glass + 2 mesh" },
            { value: "GG", label: "2 glass (1 track empty)" },
          ],
        });
      } else {
        qs.push({
          id: "mix",
          question: "How should the shutters be split?",
          why: "The glass and mesh mix changes the material list",
          diagram: { kind: "shutter-mix", params: { tracks: "2" } },
          options: [
            { value: "GG", label: "2 glass", hint: "Standard" },
            { value: "GJ", label: "1 glass + 1 mesh" },
            { value: "JJ", label: "2 mesh" },
          ],
        });
      }
    }

    // Handle profile defaults to Standard 3/4"×1.5" (the 80% case) — no longer
    // asked. Advanced handle choice can be surfaced on the item card later.
  }

  if (ctx.type === "door") {
    if (!ctx.known.chokhat) {
      qs.push({
        id: "chokhat",
        question: "Is the frame (chokhat) already fitted?",
        why: "If the frame is already there, you only need an estimate for the shutter",
        options: [
          { value: "existing", label: "Yes, already fitted", hint: "Shutter only" },
          { value: "needed", label: "No, we have to make it", hint: "Frame + shutter" },
        ],
      });
    }
    if (!ctx.known.palla) {
      qs.push({
        id: "palla",
        question: "Which shutter (palla) profile size?",
        why: "Size changes the section code and the weight",
        options: [
          { value: "60", label: "60×25mm", hint: "Moulding handle — common" },
          { value: "75", label: "75×25mm", hint: "3×1 handle — heavy" },
          { value: "50", label: "50×25mm", hint: "2×1 handle — light" },
        ],
      });
    }
    if (!ctx.known.rails) {
      qs.push({
        id: "rails",
        question: "How many center rails?",
        why: "Rails decide how many panels the door is split into",
        options: [
          { value: "2", label: "2 rails", hint: "3 panels" },
          { value: "3", label: "3 rails", hint: "4 panels" },
        ],
      });
    }
    if (!ctx.known.zonemix) {
      const rails = ctx.known.rails ?? "2";
      qs.push({
        id: "zonemix",
        question: "What goes in each panel?",
        why: "The sheet and mesh mix changes the material list",
        options:
          rails === "3"
            ? [
                { value: "SSSJ", label: "3 sheet + 1 mesh (top)", hint: "Most common" },
                { value: "SSSS", label: "4 sheet, no mesh" },
                { value: "SSJJ", label: "2 sheet + 2 mesh" },
              ]
            : [
                { value: "SSJ", label: "2 sheet + 1 mesh (top)", hint: "Most common" },
                { value: "SSS", label: "3 sheet, no mesh" },
                { value: "SJJ", label: "1 sheet + 2 mesh" },
              ],
      });
    }
  }

  if (ctx.type === "partition") {
    // Door? → its width → bottom sheet band → glass bay width (drawing-driven).
    if (!ctx.known.partDoor) {
      qs.push({
        id: "partDoor",
        question: "Is there a door in the partition?",
        why: "The door takes its own space; panels fill the rest",
        options: [
          { value: "no", label: "No, panels only", hint: "Full glass or sheet grid" },
          { value: "yes", label: "Yes, there is a door", hint: "Usually ~3 ft, separate door shutter" },
        ],
      });
    }
    if (ctx.known.partDoor === "yes" && !ctx.known.partDoorW) {
      qs.push({
        id: "partDoorW",
        question: "How wide is the door?",
        why: "The door width decides how much space is left for the panels",
        options: [
          { value: "2.5", label: "2.5 ft (30\")" },
          { value: "3", label: "3 ft (36\")", hint: "Standard" },
          { value: "3.5", label: "3.5 ft (42\")" },
        ],
      });
    }
    // Sheet-band question removed — defaults to full glass (partSheetFt="0").
    // Sheet-bottom partitions can be set as an advanced option on the item card.
    if (!ctx.known.partBayFt) {
      qs.push({
        id: "partBayFt",
        question: "How wide is each glass panel? (gap between vertical dividers)",
        why: "This decides how many vertical dividers you need and the size of each glass",
        diagram: { kind: "partition-bays" },
        options: [
          { value: "2", label: "2 ft", hint: "More dividers, smaller panels" },
          { value: "2.5", label: "2.5 ft", hint: "Balanced — common" },
          { value: "3", label: "3 ft", hint: "Fewer dividers, larger panels" },
        ],
      });
    }
    if (!ctx.known.partRowFt) {
      qs.push({
        id: "partRowFt",
        question: "How tall is each row of glass? (gap between horizontal dividers)",
        why: "This decides how many horizontal dividers you need and the height of each glass",
        diagram: { kind: "partition-rows" },
        options: [
          { value: "3", label: "3 ft", hint: "More dividers, shorter rows" },
          { value: "3.5", label: "3.5 ft", hint: "Balanced" },
          { value: "4", label: "4 ft", hint: "Fewer dividers, taller rows" },
        ],
      });
    }
  }

  // Cap at 4 — only what genuinely changes the answer
  return qs.slice(0, 4);
}

/** turn answers into shutter config */
export function mixToShutters(mix: string): { kind: "glass" | "jali" }[] {
  return mix.split("").map((c) => ({ kind: c === "J" ? "jali" : "glass" }));
}

/** turn door zone-mix answer into zone configs (S=sheet, J=jali) */
export function doorMixToZones(mix: string): { kind: "sheet" | "jali" }[] {
  return mix.split("").map((c) => ({ kind: c === "J" ? "jali" : "sheet" }));
}

/** turn partition zone-mix answer into zone configs (S=sheet, G=glass) */
export function partitionMixToZones(mix: string): { kind: "sheet" | "glass" }[] {
  return mix.split("").map((c) => ({ kind: c === "G" ? "glass" : "sheet" }));
}

/** turn Z-section sash-mix answer into sash configs (G=glass, J=jali, S=sheet) */
export function zMixToSashes(mix: string): { kind: "glass" | "jali" | "sheet" }[] {
  return mix.split("").map((c) => ({
    kind: c === "J" ? "jali" : c === "S" ? "sheet" : "glass",
  }));
}
