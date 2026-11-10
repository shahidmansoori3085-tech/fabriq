/** Small display helpers for the Studio screens. */
import type { Um } from "../engine/units";
import { UM_PER_INCH, UM_PER_SUT, parseSizeIn } from "../engine/units";
import type { EvidenceStatus, SizeCase, StudioSystem, SystemStatus } from "./model";

export type StudioUnit = "in" | "mm";

/** 58″3s — the way the shop tape reads (inch + sut), or mm. */
export function fmtLen(um: Um, unit: StudioUnit): string {
  if (unit === "mm") return `${(um / 1000).toFixed(1).replace(/\.0$/, "")} mm`;
  const neg = um < 0;
  const total = Math.round(Math.abs(um) / UM_PER_SUT);
  const inch = Math.floor(total / 8), sut = total % 8;
  const off = Math.abs(Math.abs(um) - total * UM_PER_SUT) > 400 ? "~" : "";
  return `${neg ? "−" : ""}${off}${inch}″${sut ? ` ${sut}s` : ""}`;
}

/** "− 1″ 5s" with an explicit sign, for deductions. */
export function fmtDelta(um: Um, unit: StudioUnit): string {
  if (um === 0) return "± 0";
  return `${um < 0 ? "−" : "+"} ${fmtLen(Math.abs(um), unit)}`;
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
  const total = Math.round(Math.abs(um) / UM_PER_SUT);
  return `${Math.floor(total / 8)}${total % 8 ? `.${total % 8}` : ""}`;
}

export const STATUS_TEXT: Record<EvidenceStatus, { label: string; tone: "good" | "glass" | "warn" | "bad" }> = {
  verified: { label: "Checked", tone: "good" },
  observed: { label: "From shop videos", tone: "glass" },
  suggested: { label: "From your window", tone: "warn" },
  unknown: { label: "Not taught", tone: "bad" },
};

export const SYSTEM_STATUS: Record<SystemStatus, { label: string; tone: "good" | "glass" | "warn" | "bad" }> = {
  draft: { label: "Draft", tone: "bad" },
  teaching: { label: "Learning", tone: "warn" },
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
      bits.push(vals.map((x) => sw?.options.find((o) => o.value === x)?.label ?? x).join(" or "));
    }
  }
  return bits.join(", ");
}

/** "2-track" for sliding, "2 sashes" for casement */
export const layoutLabel = (sys: StudioSystem, n: number) => (sys.family === "casement" ? `${n} sash${n > 1 ? "es" : ""}` : `${n}-track`);

export const inchOf = (um: Um) => um / UM_PER_INCH;
