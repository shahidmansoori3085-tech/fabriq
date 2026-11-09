/**
 * Teach and check — FabriQ learns a shop's own constants from windows it has
 * already made, then checks them on another real window.
 *
 * Why the slope is NOT learned: it is fixed by geometry (a frame piece follows
 * W at 1, a half shutter at ½, three shared shutters at ⅓). Solving it from two
 * tape readings turns a 1-sut misread into ~1¼″ on a 10 ft window. So one job
 * sets each constant; the next job only checks it. Values are never averaged.
 */
import type { Um } from "../engine/units";
import type { StudioSystem, TaughtJob, SizeCase, Cond } from "./model";
import { computeSizes, jobVars, matches, type StudioJob } from "./evaluate";

/** ½ sut — closer than this is "the same cut" on a shop tape. */
export const TOLERANCE: Um = 1588;

const asJob = (t: TaughtJob): StudioJob => ({ id: t.id, W: t.W, H: t.H, qty: 1, tracks: t.tracks, mix: t.mix, switches: t.switches });

/** Measured length for each size, from the parts (and glass) the shop measured. */
function measuredSizes(sys: StudioSystem, t: TaughtJob): { bySize: Record<string, Um>; conflicts: string[] } {
  const bySize: Record<string, Um> = {};
  const conflicts: string[] = [];
  const put = (sizeId: string, v: Um, what: string) => {
    if (bySize[sizeId] !== undefined && Math.abs(bySize[sizeId] - v) > TOLERANCE) {
      conflicts.push(`${what} does not match another piece cut to the same size`);
      return;
    }
    bySize[sizeId] ??= v;
  };
  for (const [partId, v] of Object.entries(t.measured)) {
    const p = sys.parts.find((x) => x.id === partId);
    if (p && p.length !== "W" && p.length !== "H") put(p.length, v, p.role.replace(/\{.\}/g, "").trim());
  }
  if (t.glass?.w !== undefined) put(sys.infill.w, t.glass.w, "Glass width");
  if (t.glass?.h !== undefined) put(sys.infill.h, t.glass.h, "Glass height");
  return { bySize, conflicts };
}

/**
 * The layout a learned constant applies to: the same track count, plus every
 * switch this size's own rules look at (mode, track width, roller…). The glass
 * count only joins when the rule in use depends on it (equal share divides by
 * it); a half-each shutter is W/2 whether the mix is GG or GJ, so one job
 * covers both — the shop is not asked to teach what geometry already fixes.
 */
function scopeFor(sys: StudioSystem, sizeId: string, vars: Record<string, string>, used: SizeCase | undefined): Cond {
  const s = sys.sizes.find((x) => x.id === sizeId)!;
  const cond: Cond = { tracks: vars.tracks };
  for (const sw of sys.switches) {
    if (s.cases.some((c) => c.when && sw.id in c.when)) cond[sw.id] = vars[sw.id];
  }
  if (used?.when && "glass" in used.when) cond.glass = vars.glass;
  return cond;
}

export interface TeachResult {
  system: StudioSystem;
  learned: { size: string; label: string; constant: Um; changed: boolean }[];
  /** sizes the shop measured but that could not be learned, with the reason */
  skipped: { label: string; why: string }[];
  conflicts: string[];
}

/** Learn constants from one real job. Returns a NEW system (input untouched). */
export function teach(input: StudioSystem, t: TaughtJob): TeachResult {
  const sys: StudioSystem = structuredClone(input);
  const { bySize, conflicts } = measuredSizes(sys, t);
  const vars = jobVars(sys, asJob(t));
  const learned: TeachResult["learned"] = [];
  const skipped: TeachResult["skipped"] = [];
  const src = `Your job ${t.id}: ${(t.W / 25400).toFixed(3).replace(/\.?0+$/, "")}″ × ${(t.H / 25400).toFixed(3).replace(/\.?0+$/, "")}″, ${t.mix}`;

  for (const s of sys.sizes) {
    const measured = bySize[s.id];
    if (measured === undefined) continue;
    const { values } = computeSizes(sys, asJob(t)); // recomputed: earlier sizes may have just been learned
    const idx = s.cases.findIndex((c) => matches(c.when, vars));
    const cur: SizeCase | undefined = s.cases[idx];
    const tmpl = cur ?? s.cases[s.cases.length - 1];
    if (!tmpl) { skipped.push({ label: s.label, why: "this size has no rule" }); continue; }
    const base = values[tmpl.base];
    if (base == null) {
      skipped.push({ label: s.label, why: `teach "${sys.sizes.find((x) => x.id === tmpl.base)?.label ?? tmpl.base}" first` });
      continue;
    }
    const slopePart = Math.round((base * (tmpl.num ?? 1) + (tmpl.pre ?? 0)) / (tmpl.den ?? 1));
    const constant = measured - slopePart;

    if (cur && cur.add !== null && Math.abs(cur.add - constant) <= TOLERANCE) {
      // Same as what we already had: the job confirms it, nothing new to store.
      if (cur.evidence.status !== "verified") cur.evidence = { status: "verified", source: `${cur.evidence.source}; confirmed by ${src}` };
      learned.push({ size: s.id, label: s.label, constant: cur.add, changed: false });
      continue;
    }
    const scoped: SizeCase = {
      when: scopeFor(sys, s.id, vars, cur), base: tmpl.base, num: tmpl.num, den: tmpl.den, pre: tmpl.pre,
      add: constant, evidence: { status: "suggested", source: src },
    };
    const same = s.cases.findIndex((c) => JSON.stringify(c.when) === JSON.stringify(scoped.when));
    if (same >= 0) s.cases[same] = scoped; else s.cases.unshift(scoped);
    learned.push({ size: s.id, label: s.label, constant, changed: true });
  }

  sys.jobs = [...sys.jobs.filter((j) => j.id !== t.id), t];
  if (learned.some((l) => l.changed)) { sys.version += 1; sys.status = "teaching"; }
  return { system: sys, learned, skipped, conflicts };
}

export interface CheckRow {
  label: string;
  predicted: Um | null;
  measured: Um;
  diff: Um | null;
  ok: boolean;
}

/**
 * Compare what FabriQ would cut with what the shop really cut on another
 * window. All within ½ sut → the rules used are marked verified for this layout.
 */
export function check(input: StudioSystem, t: TaughtJob): { system: StudioSystem; rows: CheckRow[]; allOk: boolean } {
  const sys: StudioSystem = structuredClone(input);
  const { bySize } = measuredSizes(sys, t);
  const { values } = computeSizes(sys, asJob(t));
  const vars = jobVars(sys, asJob(t));
  const rows: CheckRow[] = sys.sizes.filter((s) => bySize[s.id] !== undefined).map((s) => {
    const predicted = values[s.id] ?? null;
    const diff = predicted === null ? null : bySize[s.id] - predicted;
    return { label: s.label, predicted, measured: bySize[s.id], diff, ok: diff !== null && Math.abs(diff) <= TOLERANCE };
  });
  const allOk = rows.length > 0 && rows.every((r) => r.ok);
  if (allOk) {
    for (const s of sys.sizes) {
      if (bySize[s.id] === undefined) continue;
      const c = s.cases.find((x) => matches(x.when, vars));
      if (c && c.evidence.status !== "verified") c.evidence = { status: "verified", source: `${c.evidence.source}; checked on job ${t.id}` };
    }
    sys.jobs = [...sys.jobs.filter((j) => j.id !== t.id), t];
    sys.status = "checked";
  }
  return { system: sys, rows, allOk };
}
