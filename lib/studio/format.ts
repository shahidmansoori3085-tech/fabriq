/** Small display helpers for the Studio screens. */
import type { Um } from "../engine/units";
import { UM_PER_INCH, UM_PER_SUT, parseSizeIn, formatTradeSize } from "../engine/units";
import type { EvidenceStatus, SizeCase, StudioSystem, SystemStatus } from "./model";

/** ft = feet.inch.sut (4.6.2), in = inch.sut (58.3), mm */
export type StudioUnit = "ft" | "in" | "mm";

/** How a length is typed in this unit, for labels. */
export const UNIT_HINT: Record<StudioUnit, string> = {
  ft: "feet.inch.sut — 4.6.2 = 4′ 6″ 2 sut",
  in: "inch.sut — 58.3 = 58″ 3 sut",
  mm: "mm",
};
export const UNIT_SHORT: Record<StudioUnit, string> = { ft: "ft.in.sut", in: "inch.sut", mm: "mm" };
/** Small amounts (add / take off) are typed in inches even when sizes are in feet. */
export const deltaUnit = (u: StudioUnit): StudioUnit => (u === "ft" ? "in" : u);

/** 58″3s — the way the shop tape reads (inch + sut), or mm. */
export function fmtLen(um: Um, unit: StudioUnit): string {
  if (unit === "mm") return `${(um / 1000).toFixed(1).replace(/\.0$/, "")} mm`;
  const neg = um < 0;
  const total = Math.round(Math.abs(um) / UM_PER_SUT);
  const inch = Math.floor(total / 8), sut = total % 8;
  const off = Math.abs(Math.abs(um) - total * UM_PER_SUT) > 400 ? "~" : "";
  if (unit === "ft" && inch >= 12) {
    const ft = Math.floor(inch / 12), rest = inch % 12;
    return `${neg ? "−" : ""}${off}${ft}′ ${rest}″${sut ? ` ${sut}s` : ""}`;
  }
  return `${neg ? "−" : ""}${off}${inch}″${sut ? ` ${sut}s` : ""}`;
}

/** "− 1″ 5s" with an explicit sign, for deductions. */
export function fmtDelta(um: Um, unit: StudioUnit): string {
  if (um === 0) return "± 0";
  const sign = um < 0 ? "−" : "+";
  // under an inch the shop says sut: "− 6 sut", not "− 0″ 6s" (founder 2026-11-17)
  if (unit !== "mm" && Math.abs(um) < 25400 - UM_PER_SUT / 2) return `${sign} ${Math.round(Math.abs(um) / UM_PER_SUT)} sut`;
  return `${sign} ${fmtLen(Math.abs(um), unit).replace(/^~/, "")}`;
}

/** Read a typed length in the Studio unit: "58.3" = 58″ 3 sut, or mm. */
export function readLen(raw: string, unit: StudioUnit): Um | null {
  const t = raw.trim().replace(/[″"]/g, "");
  if (!t) return null;
  return parseSizeIn(t, unit);
}

/** A typed length back into the box. */
export function lenToInput(um: Um, unit: StudioUnit): string {
  if (unit === "mm") return String(Math.round(um / 100) / 10);
  if (unit === "ft") return formatTradeSize(Math.abs(um));
  const total = Math.round(Math.abs(um) / UM_PER_SUT);
  return `${Math.floor(total / 8)}${total % 8 ? `.${total % 8}` : ""}`;
}

export const STATUS_TEXT: Record<EvidenceStatus, { label: string; tone: "good" | "glass" | "warn" | "bad" }> = {
  verified: { label: "Checked", tone: "good" },
  observed: { label: "Shop practice", tone: "glass" },
  suggested: { label: "Check once", tone: "warn" },
  unknown: { label: "Not known yet", tone: "bad" },
};

/** Where a number came from, in a few words: the badge next to a rule. */
/** Where a formula came from, in plain shop words (no internal notes or names). */
export function sourceText(s: string): string {
  return noMaker(s)
    .replace(/^From the drawings \(window built from the sections\):\s*/i, "From the catalogue drawings: ")
    .replace(/^From the drawings:\s*/i, "From the catalogue drawings: ")
    .replace(/^Founder job:\s*/i, "Measured on a real window: ")
    .replace(/^Founder:\s*/i, "Shop practice: ")
    .replace(/\s*\([^()]*\bfounder\b[^()]*\)/gi, "")
    .replace(/,?\s*\bfounder\b[^.;:)]*/gi, "")
    .replace(/\s*Check on one window\.?/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function evidenceBadge(status: EvidenceStatus, source = "", known = true): { label: string; tone: "good" | "glass" | "warn" | "bad" } {
  if (!known || status === "unknown") return STATUS_TEXT.unknown;
  if (status === "verified") return { label: "Verified on a real window", tone: "good" };
  if (status === "observed") return { label: /video/i.test(source) ? "From shop videos" : "Shop practice", tone: "glass" };
  if (/^Your job/i.test(source)) return { label: "From your window · verify once", tone: "warn" };
  if (/drawing/i.test(source)) return { label: "From catalogue drawings · verify once", tone: "warn" };
  return STATUS_TEXT.suggested;
}

export const SYSTEM_STATUS: Record<SystemStatus, { label: string; tone: "good" | "glass" | "warn" | "bad" }> = {
  draft: { label: "Not verified yet", tone: "warn" },
  teaching: { label: "Being set up", tone: "warn" },
  checked: { label: "Ready", tone: "good" },
  verified: { label: "Ready", tone: "good" },
};

/** Standard glass / mesh mixes per track count. */
export const MIXES: Record<number, string[]> = {
  1: ["G"],
  2: ["GG", "GJ", "JJ"],
  3: ["GGJ", "GGG", "GJJ", "GG"],
  4: ["GGGJ", "GGJJ", "GGGG"],
  5: ["GGGGJ", "GGGGG", "GGGJJ"],
};

export const mixText = (mix: string) => {
  const g = [...mix].filter((c) => c !== "J").length, j = mix.length - g;
  return [g ? `${g} glass` : "", j ? `${j} mesh` : ""].filter(Boolean).join(" + ");
};

/** A size rule in shop words: "H − 1″ 5s", "(W − 7″ 4s) ÷ 3 + 80 mm". */
export function ruleText(c: SizeCase, baseLabel: string, unit: StudioUnit): string {
  const num = c.num ?? 1, den = c.den ?? 1;
  let f = num === 1 ? baseLabel : `${num} × ${baseLabel}`;
  if (c.pre) f = `(${f} ${fmtDelta(c.pre, unit)})`;
  if (den !== 1) f = `${f} ÷ ${den}`;
  if (c.add === null) return `${f}  ± ?`;
  if (c.add) f = `${f} ${fmtDelta(c.add, unit)}`;
  return f;
}

/** "3-track", "3-track, 3 glass share", "Equal share" — when a rule applies. */
export function whenText(sys: StudioSystem, when: SizeCase["when"]): string {
  if (!when) return "All layouts";
  const bits: string[] = [];
  for (const [k, v] of Object.entries(when)) {
    const vals = Array.isArray(v) ? v : [v];
    if (k === "tracks") bits.push(sys.family === "casement" ? `${vals.join(" or ")} sash` : `${vals.join(" or ")}-track`);
    else if (k === "shutters" && sys.family === "casement") bits.push(`${vals.join(" or ")} sash`);
    else if (k === "glass") bits.push(`${vals.join(" or ")} glass shutters`);
    else if (k === "mix") bits.push(vals.map(mixText).join(" or "));
    else {
      const sw = sys.switches.find((s) => s.id === k);
      // "45°" alone does not say what is cut at 45°: "Track cutting 45°"
      const lab = vals.map((x) => sw?.options.find((o) => o.value === x)?.label ?? x).join(" or ");
      bits.push(sw && /°$/.test(lab) ? `${sw.label} ${lab}` : lab);
    }
  }
  return bits.join(", ");
}

/** "2-track" for sliding, "2 sashes" for casement */
export const layoutLabel = (sys: StudioSystem, n: number) => (sys.family === "casement" ? `${n} sash${n > 1 ? "es" : ""}` : `${n}-track`);

export const inchOf = (um: Um) => um / UM_PER_INCH;

/** Text without company names (founder, 2026-11-13): "Ample 914400" → "914400", "BH-6001" → "6001". */
export function noMaker(t: string): string {
  return t
    .replace(/\b(Ample|Banu Hashim|Eleanor|OMEO|Alucoat|Jindal|ALPRO)\b\s*/g, "")
    .replace(/\bBH[- ]?(?=\d)/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** A section's name without a mm size in it ("Interlock Stile 40×18" → "Interlock Stile"):
 *  the size is shown on its own line, small (founder, 2026-11-14). Inch names stay. */
export function noSize(t: string): string {
  return t
    .replace(/\s*\(?\b\d+(\.\d+)?\s*[×x]\s*\d+(\.\d+)?\b(?![″"'.\d])\)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
/** How a section's name is shown: no company, no mm size. */
export const sectionTitle = (t: string) => noSize(noMaker(t));

/**
 * A length typed any way a shop types it (founder 2026-11-18: "unit kuch bhi daal sake"):
 * "46.5" or "46 5s" or 46″ 5s (inch.sut), "1180 mm", "118 cm", "3'10.5" or "3 ft 10" (feet).
 * A plain number over 300 is taken as mm (no pipe is 300 inches).
 */
export function readAnyLen(raw: string): Um | null {
  const t = raw.trim().toLowerCase().replace(/[″"]/g, " in ").replace(/[′']/g, " ft ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = /^(\d+(?:\.\d+)?) ?mm$/.exec(t);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  m = /^(\d+(?:\.\d+)?) ?cm$/.exec(t);
  if (m) return Math.round(parseFloat(m[1]) * 10000);
  m = /^(\d+) ?(?:ft|feet) ?(?:(\d+)(?:[. ](\d))?)? ?(?:in|inch)? ?(?:(\d) ?(?:s|sut))?$/.exec(t);
  if (m) {
    const sut = parseInt(m[3] ?? m[4] ?? "0", 10);
    if (sut > 7) return null;
    return parseInt(m[1], 10) * 304800 + parseInt(m[2] ?? "0", 10) * UM_PER_INCH + sut * UM_PER_SUT;
  }
  m = /^(\d+) ?(?:in|inch)? ?(\d) ?(?:s|sut)$/.exec(t);
  if (m) return parseInt(m[2], 10) > 7 ? null : parseInt(m[1], 10) * UM_PER_INCH + parseInt(m[2], 10) * UM_PER_SUT;
  m = /^(\d+)(?:\.(\d))? ?(?:in|inch)?$/.exec(t);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!m[2] && n > 300) return n * 1000; // a big plain number is mm
    const sut = m[2] ? parseInt(m[2], 10) : 0;
    return sut > 7 ? null : n * UM_PER_INCH + sut * UM_PER_SUT;
  }
  return null;
}
