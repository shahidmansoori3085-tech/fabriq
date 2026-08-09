/**
 * FabriQ Question Brain — fallback rules.
 * When ANTHROPIC_API_KEY is set, /api/ai/questions asks Claude to analyze the
 * situation and generate contextual questions. Without a key, these
 * deterministic rules produce sensible questions so the app always works.
 * Format contract (both paths): 4 options + free-text "Apna khud likho".
 */
import { Um, mm, formatFtInSut } from "./units";

export interface Question {
  id: string;
  question: string; // Hinglish
  why: string; // one-liner: is sawaal ka faayda
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

export function generateQuestions(ctx: QuestionContext): Question[] {
  const qs: Question[] = [];
  const wide = ctx.width >= mm(1500);
  const sizeLabel = `${formatFtInSut(ctx.width)} × ${formatFtInSut(ctx.height)}`;

  if (ctx.type === "window") {
    if (!ctx.known.system) {
      qs.push({
        id: "system",
        question: `${sizeLabel} window — kaun sa system?`,
        why: "System se sections aur formula decide hota hai",
        options: [
          { value: "normal", label: "Normal Sliding", hint: "18mm — sabse common" },
          { value: "domal", label: "Domal", hint: "27-29mm — premium, alag construction" },
          { value: "z_section", label: "Z-Section", hint: "Hinge-openable — fixed/openable/door" },
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
          question: "Sliding ke UPAR fixed glass patti chahiye?",
          why: "Upar fix ho to SP partition pipe + glazing clip add hoti hai",
          options: [
            { value: "no", label: "Nahi, sirf sliding", hint: "Poora window sliding" },
            { value: "yes", label: "Haan, upar fix", hint: "Neeche sliding, upar fixed glass" },
          ],
        });
      }
      if (ctx.known.domalFix === "yes" && !ctx.known.domalFixFt) {
        qs.push({
          id: "domalFixFt",
          question: "Upar fix wala hissa kitna uncha (feet)?",
          why: "Isse coupler kahan lagega aur fixed glass ka size nikalta hai",
          options: [
            { value: "1", label: "1 ft", hint: "Patli patti" },
            { value: "1.5", label: "1.5 ft" },
            { value: "2", label: "2 ft", hint: "Sabse common" },
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
          question: "Konsi size ki pipe — small ya big?",
          why: "Size se outer/shutter/center sections aur weight badalta hai",
          options: [
            { value: "light", label: "Small (40×40)", hint: "Normal window ke liye" },
            { value: "heavy", label: "Big (40×55 / 70)", hint: "Bada window ya door ke liye" },
          ],
        });
      }
      // zType sets both the layout and the door flag in one question.
      if (!ctx.known.zType) {
        qs.push({
          id: "zType",
          question: "Kis type ka banega?",
          why: "Type se pura construction aur formula decide hota hai",
          options: [
            { value: "openable", label: "Openable window", hint: "Khulne wala — mullion + shutter" },
            { value: "combo", label: "Upar fix + neeche openable", hint: "Transom se bata — sabse common" },
            { value: "fixed", label: "Poora fixed (nahi khulega)", hint: "Sirf glass + clip, shutter nahi" },
            { value: "door", label: "Door", hint: "Single palla, mullion nahi" },
          ],
        });
      }
      const zType = ctx.known.zType ?? "openable";
      // For a combo: is the fixed part on TOP (horizontal transom) or on the
      // SIDE (vertical mullion)?
      if (zType === "combo" && !ctx.known.zComboDir) {
        qs.push({
          id: "zComboDir",
          question: "Fix wala hissa kahan?",
          why: "Upar ya side se transom/mullion aur dono glass ke size badalte hain",
          options: [
            { value: "top", label: "Upar (leti patti)", hint: "Upar fix, neeche khulega" },
            { value: "side", label: "Side (khadi patti)", hint: "Ek taraf fix, doosri khulegi" },
          ],
        });
      }
      // Sash count applies to the openable band (openable window OR the
      // openable part of a fix+openable combo). Not for a plain fixed or door.
      if ((zType === "openable" || zType === "combo") && !ctx.known.zSashCount) {
        qs.push({
          id: "zSashCount",
          question: "Khulne wale hisse me kitne sash?",
          why: "Sash count se mullion aur shutter count decide hota hai",
          options: [
            { value: "1", label: "1 Sash", hint: "Mullion nahi" },
            { value: "2", label: "2 Sash", hint: "1 mullion" },
            { value: "3", label: "3 Sash", hint: "2 mullion" },
          ],
        });
      }
      // For a combo, how big is the fixed part (height if top, width if side).
      if (zType === "combo" && !ctx.known.zFixedFt) {
        const side = ctx.known.zComboDir === "side";
        qs.push({
          id: "zFixedFt",
          question: side ? "Side fix wala hissa kitna chauda (feet)?"
            : "Upar fix wala hissa kitna uncha (feet)?",
          why: "Isse divider kahan lagega aur dono glass ke size nikalte hain",
          options: [
            { value: "1.5", label: "1.5 ft", hint: "Chhoti fixed patti" },
            { value: "2", label: "2 ft", hint: "Sabse common" },
            { value: "2.5", label: "2.5 ft" },
            { value: "3", label: "3 ft", hint: "Badi fixed patti" },
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
        question: "Kitne track?",
        why: "Track se bottom section aur shutter count decide hota hai",
        diagram: { kind: "tracks" },
        options: wide
          ? [
              { value: "3", label: "3 Track", hint: "Is width pe common" },
              { value: "2", label: "2 Track" },
              { value: "4", label: "4 Track" },
              { value: "2.5", label: "2 Track + Fix" },
            ]
          : [
              { value: "2", label: "2 Track", hint: "Is width pe kaafi hai" },
              { value: "3", label: "3 Track" },
              { value: "4", label: "4 Track" },
              { value: "2.5", label: "2 Track + Fix" },
            ],
      });
    }

    // Shutter mix — glass/jali, driven by track count, same for both systems
    if (!isZSection && !ctx.known.mix) {
      const tracks = ctx.known.tracks ?? (wide ? "3" : "2");
      if (tracks === "4") {
        qs.push({
          id: "mix",
          question: "Shutter kaise banaoge?",
          why: "Glass/jali mix se material list badalti hai",
          diagram: { kind: "shutter-mix", params: { tracks: "4" } },
          options: [
            { value: "GGGJ", label: "3 Glass + 1 Jali", hint: "Sabse common" },
            { value: "GGJJ", label: "2 Glass + 2 Jali" },
            { value: "GGGG", label: "4 Glass, jali nahi" },
            { value: "GJJJ", label: "1 Glass + 3 Jali" },
          ],
        });
      } else if (tracks === "3") {
        qs.push({
          id: "mix",
          question: "Shutter kaise banaoge?",
          why: "Glass/jali mix se material list badalti hai",
          diagram: { kind: "shutter-mix", params: { tracks: "3" } },
          options: [
            { value: "GGJ", label: "2 Glass + 1 Jali", hint: "Sabse common" },
            { value: "GGG", label: "3 Glass, jali nahi" },
            { value: "GJJ", label: "1 Glass + 2 Jali" },
            { value: "GG", label: "2 Glass (1 track khaali)" },
          ],
        });
      } else {
        qs.push({
          id: "mix",
          question: "Shutter kaise banaoge?",
          why: "Glass/jali mix se material list badalti hai",
          diagram: { kind: "shutter-mix", params: { tracks: "2" } },
          options: [
            { value: "GG", label: "2 Glass", hint: "Standard" },
            { value: "GJ", label: "1 Glass + 1 Jali" },
            { value: "JJ", label: "2 Jali" },
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
        question: "Chokhat (frame) pehle se lagi hai?",
        why: "Agar chokhat pehle se hai toh sirf palla ka estimate milega",
        options: [
          { value: "existing", label: "Haan, pehle se hai", hint: "Sirf palla banega" },
          { value: "needed", label: "Nahi, banani hai", hint: "Chokhat + palla dono" },
        ],
      });
    }
    if (!ctx.known.palla) {
      qs.push({
        id: "palla",
        question: "Palla (shutter) ka profile size kaunsa?",
        why: "Size se section code aur weight badalta hai",
        options: [
          { value: "60", label: "60×25mm", hint: "Moulding Handle — common" },
          { value: "75", label: "75×25mm", hint: "3×1 Handle — heavy" },
          { value: "50", label: "50×25mm", hint: "2×1 Handle — halka" },
        ],
      });
    }
    if (!ctx.known.rails) {
      qs.push({
        id: "rails",
        question: "Kitne center rail?",
        why: "Rail se door kitne hisso mein batega decide hota hai",
        options: [
          { value: "2", label: "2 Rail", hint: "3 hisse" },
          { value: "3", label: "3 Rail", hint: "4 hisse" },
        ],
      });
    }
    if (!ctx.known.zonemix) {
      const rails = ctx.known.rails ?? "2";
      qs.push({
        id: "zonemix",
        question: "Har hisse mein kya lagega?",
        why: "Sheet aur jali mix se material list badalti hai",
        options:
          rails === "3"
            ? [
                { value: "SSSJ", label: "3 Sheet + 1 Jali (upar)", hint: "Sabse common" },
                { value: "SSSS", label: "4 Sheet, jali nahi" },
                { value: "SSJJ", label: "2 Sheet + 2 Jali" },
              ]
            : [
                { value: "SSJ", label: "2 Sheet + 1 Jali (upar)", hint: "Sabse common" },
                { value: "SSS", label: "3 Sheet, jali nahi" },
                { value: "SJJ", label: "1 Sheet + 2 Jali" },
              ],
      });
    }
  }

  if (ctx.type === "partition") {
    // Door? → its width → bottom sheet band → glass bay width (drawing-driven).
    if (!ctx.known.partDoor) {
      qs.push({
        id: "partDoor",
        question: "Partition me door (darwaza) hai?",
        why: "Door ki jagah chhodkar baaki hisse me panels lagte hain",
        options: [
          { value: "no", label: "Nahi, sirf panels", hint: "Poora glass/sheet grid" },
          { value: "yes", label: "Haan, door hai", hint: "Std ~3ft, alag door palla" },
        ],
      });
    }
    if (ctx.known.partDoor === "yes" && !ctx.known.partDoorW) {
      qs.push({
        id: "partDoorW",
        question: "Door kitna chauda?",
        why: "Door width se baaki panels ki jagah bachti hai",
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
        question: "Har glass panel kitna chauda? (khade divider ka gap)",
        why: "Isse kitne khade divider lagenge aur har glass ka size nikalta hai",
        diagram: { kind: "partition-bays" },
        options: [
          { value: "2", label: "2 ft", hint: "Zyada divider, chhote panel" },
          { value: "2.5", label: "2.5 ft", hint: "Balanced — common" },
          { value: "3", label: "3 ft", hint: "Kam divider, bade panel" },
        ],
      });
    }
    if (!ctx.known.partRowFt) {
      qs.push({
        id: "partRowFt",
        question: "Glass ki har row kitni uunchi? (leta/horizontal divider ka gap)",
        why: "Isse kitne lete divider lagenge aur har glass ki height nikalti hai",
        diagram: { kind: "partition-rows" },
        options: [
          { value: "3", label: "3 ft", hint: "Zyada divider, chhoti row" },
          { value: "3.5", label: "3.5 ft", hint: "Balanced" },
          { value: "4", label: "4 ft", hint: "Kam divider, badi row" },
        ],
      });
    }
  }

  // Cap at 4 — sirf sabse zaroori
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
