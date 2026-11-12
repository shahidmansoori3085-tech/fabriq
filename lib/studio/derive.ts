/**
 * Work out cuts from the section drawings themselves.
 *
 * Domal type (founder's method, checked 2026-11-12): the frame legs point into
 * the opening. At the bottom the shutter runs over the leg tips on its roller;
 * at the top the leg tips go up into the shutter's channel. So the shutter is
 * the clear space between the top and bottom leg tips, plus the roller height:
 *
 *   shutter height = H − 2 × frame height + roller height
 *
 * OMEO 2062 (45.4 mm) with the 24 mm roller → H − 66.8 mm. The founder's real
 * 66×58 job gave H − 66.7 mm: 0.1 mm apart. See evals/studio/derive.ts.
 *
 * Only the height comes from this. Width stays the shop's choice (half each, or
 * equal share), and glass from the glass pocket is a check, not a rule.
 */
import type { Um } from "../engine/units";
import type { ProfileDef, SizeCase, StudioSystem } from "./model";
import { matches } from "./evaluate";

/** Every sliding roller in the market is 24 mm high (founder, 2026-11-12). */
export const DEFAULT_ROLLER_MM = 24;

/** The section's depth seen from the front — the second printed number ("80.5×45.4" → 45.4). */
export function frameHeightMm(p: ProfileDef | undefined): number | null {
  const m = p?.size?.match(/([\d.]+)\s*[×x*]\s*([\d.]+)/);
  const v = m ? parseFloat(m[2]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

export interface DrawingRule {
  tracks: number;
  /** the frame section used for this track count */
  frame: ProfileDef;
  frameMm: number;
  /** H − shutter height, µm (positive = taken off) */
  takeOff: Um;
  /** what the system cuts now for this track count, µm taken off; null = not known */
  current: Um | null;
  /** current − drawing, µm; null when there is no current rule */
  diff: Um | null;
}

/** ½ sut — closer than this is the same cut on a shop tape. */
const SAME: Um = 1588;
export const sameCut = (d: Um | null) => d !== null && Math.abs(d) <= SAME;

/**
 * Shutter height from the drawing, per track count. Needs a system marked
 * heightFrom "domal-legs" whose frame sides name a section with a printed size.
 */
export function shutterHeightFromDrawing(sys: StudioSystem, rollerMm: number, find: (id: string) => ProfileDef | undefined): DrawingRule[] {
  if (sys.heightFrom?.kind !== "domal-legs") return [];
  const side = sys.parts.find((p) => p.place === "frame-left" && p.enabled !== false);
  const sh = sys.sizes.find((s) => s.id === "shutterH");
  if (!side || !sh) return [];
  const out: DrawingRule[] = [];
  for (const lay of sys.layouts) {
    const vars = { tracks: String(lay.tracks) };
    const spec = side.profile.find((o) => matches(o.when, vars));
    const frame = spec?.id ? find(spec.id) : undefined;
    const fmm = frameHeightMm(frame);
    if (!frame || fmm === null) continue;
    const takeOff = Math.round((2 * fmm - rollerMm) * 1000);
    // the rule the system uses now for this track count (any glass / switch)
    const c = sh.cases.find((x) => !x.when || !x.when.tracks || matches({ tracks: x.when.tracks }, vars));
    const current = c && c.base === "H" && (c.den ?? 1) === 1 && !c.pre && c.add !== null ? -c.add : null;
    out.push({ tracks: lay.tracks, frame, frameMm: fmm, takeOff, current, diff: current === null ? null : current - takeOff });
  }
  return out;
}

/**
 * Use the drawing's shutter height where the system does not know one yet.
 * Rules checked on real jobs are never replaced.
 */
export function applyShutterHeight(sys: StudioSystem, rules: DrawingRule[], rollerMm: number): StudioSystem {
  const sh = sys.sizes.find((s) => s.id === "shutterH");
  if (!sh || !rules.length) return sys;
  const keep = sh.cases.filter((c) => c.evidence.status === "verified" && c.add !== null);
  const fresh: SizeCase[] = rules
    .filter((r) => !keep.some((c) => !c.when?.tracks || c.when.tracks === String(r.tracks) || (Array.isArray(c.when.tracks) && c.when.tracks.includes(String(r.tracks)))))
    .map((r) => ({
      when: { tracks: String(r.tracks) }, base: "H", add: -r.takeOff,
      evidence: { status: "suggested", source: `From the drawing: 2 × ${r.frameMm} mm frame − ${rollerMm} mm roller. Check on one window.` },
    }));
  if (!fresh.length) return sys;
  // keep one catch-all rule last, so a layout the drawing could not cover stays as it was
  const catchAll = sh.cases.find((c) => !c.when) ?? sh.cases[sh.cases.length - 1];
  const cases = [...fresh, ...keep];
  if (catchAll && !cases.includes(catchAll)) cases.push(catchAll);
  return {
    ...sys,
    version: sys.version + 1,
    sizes: sys.sizes.map((s) => (s.id !== "shutterH" ? s : { ...s, cases })),
  };
}
