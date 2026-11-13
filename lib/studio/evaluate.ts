/**
 * Runs a StudioSystem for one window: sizes → cut pieces, infill panels and
 * hardware, plus a trace of where every size came from.
 * Pure and deterministic — same input, same output, no AI.
 */
import type { Um } from "../engine/units";
import { toFeet } from "../engine/units";
import type { CutPiece, ShutterKind } from "../engine/types";
import type { Cond, SizeCase, StudioSystem, EvidenceStatus } from "./model";

export interface StudioJob {
  id: string;            // "W1"
  W: Um;
  H: Um;
  qty: number;
  tracks: number;
  /** one letter per shutter, left to right: G glass, J mesh, S sheet */
  mix: string;
  switches?: Record<string, string>;
  /** choices made on one shutter only, left to right (e.g. which slim interlock) */
  perShutter?: Record<string, string>[];
  /** label text for the cut list ("6'0×4'0"); optional */
  sizeLabel?: string;
}

export interface SizeTrace {
  id: string;
  label: string;
  value: Um | null;
  /** human formula actually used: "W ÷ 2", "H − 41.3 mm" */
  formula: string;
  status: EvidenceStatus;
  source: string;
}

export interface StudioResult {
  pieces: CutPiece[];
  panels: { kind: ShutterKind; w: Um; h: Um; count: number }[];
  /** quantities before any rounding (running items in feet, before wastage) */
  hardware: { id: string; name: string; formula: string; qty: number; unit: string }[];
  sizes: SizeTrace[];
  /** sizes that are still unknown for this layout — cutting must not go ahead */
  missing: string[];
}

export class StudioUnknownError extends Error {
  constructor(public missing: string[]) {
    super(`Not taught yet: ${missing.join(", ")}`);
    this.name = "StudioUnknownError";
  }
}

const KIND: Record<string, ShutterKind> = { G: "glass", J: "jali", S: "sheet" };

export function jobVars(sys: StudioSystem, job: StudioJob): Record<string, string> {
  const kinds = [...job.mix].map((c) => KIND[c] ?? "glass");
  const glass = kinds.filter((k) => k !== "jali").length;
  const sw: Record<string, string> = {};
  for (const s of sys.switches) sw[s.id] = job.switches?.[s.id] ?? s.default;
  return {
    ...sw,
    tracks: String(job.tracks),
    shutters: String(kinds.length),
    glass: String(glass),
    mix: job.mix,
  };
}

export function matches(cond: Cond | undefined, vars: Record<string, string>): boolean {
  if (!cond) return true;
  return Object.entries(cond).every(([k, v]) => (Array.isArray(v) ? v.includes(vars[k]) : vars[k] === v));
}

const fmtMm = (u: Um) => `${Math.abs(u / 1000).toFixed(u % 1000 === 0 ? 0 : 3).replace(/\.?0+$/, "")} mm`;

function describe(c: SizeCase, baseLabel: string): string {
  const num = c.num ?? 1, den = c.den ?? 1;
  let f = num === 1 ? baseLabel : `${num} × ${baseLabel}`;
  if (c.pre) f = `(${f} ${c.pre < 0 ? "−" : "+"} ${fmtMm(c.pre)})`;
  if (den !== 1) f = `${f} ÷ ${den}`;
  if (c.add === null) return `${f} ± ?`;
  if (c.add) f = `${f} ${c.add < 0 ? "−" : "+"} ${fmtMm(c.add)}`;
  return f;
}

/** Compute every named size for this job, in order. */
export function computeSizes(sys: StudioSystem, job: StudioJob): { values: Record<string, Um | null>; trace: SizeTrace[] } {
  const vars = jobVars(sys, job);
  const values: Record<string, Um | null> = { W: job.W, H: job.H };
  const labels: Record<string, string> = { W: "W", H: "H" };
  const trace: SizeTrace[] = [];
  for (const s of sys.sizes) {
    labels[s.id] = s.label;
    const c = s.cases.find((x) => matches(x.when, vars));
    if (!c) {
      values[s.id] = null;
      trace.push({ id: s.id, label: s.label, value: null, formula: "no rule for this layout", status: "unknown", source: "" });
      continue;
    }
    const base = values[c.base];
    const value = base == null || c.add === null
      ? null
      : Math.round((base * (c.num ?? 1) + (c.pre ?? 0)) / (c.den ?? 1)) + c.add;
    values[s.id] = value;
    trace.push({
      id: s.id, label: s.label, value,
      formula: describe(c, labels[c.base] ?? c.base),
      status: value === null ? "unknown" : c.evidence.status,
      source: c.evidence.source,
    });
  }
  return { values, trace };
}

/** Build the full result. Throws StudioUnknownError if a needed size is unknown. */
export function evaluate(sys: StudioSystem, job: StudioJob, opts: { allowUnknown?: boolean } = {}): StudioResult {
  const vars = jobVars(sys, job);
  const { values, trace } = computeSizes(sys, job);
  const kinds = [...job.mix].map((c) => KIND[c] ?? "glass");
  const glassCount = kinds.filter((k) => k !== "jali").length;
  const meetings = Math.max(0, glassCount - 1);

  const parts = sys.parts.filter((p) => p.enabled !== false && matches(p.when, vars));
  const needed = new Set<string>([
    ...parts.map((p) => p.length),
    ...(kinds.length ? [sys.infill.w, sys.infill.h] : []),
  ]);
  const len = (id: string) => values[id] ?? 0;
  const profileFor = (p: (typeof parts)[number], shutter?: number) => {
    const v = shutter !== undefined && job.perShutter?.[shutter] ? { ...vars, ...job.perShutter[shutter] } : vars;
    return (p.profile.find((x) => matches(x.when, v)) ?? p.profile[p.profile.length - 1])?.id ?? "";
  };
  const missing = [...needed].filter((id) => values[id] === null || values[id] === undefined)
    .map((id) => trace.find((t) => t.id === id)?.label ?? id);
  // a part with no section chosen cannot be bought or packed
  for (const p of parts) {
    const used = p.scope === "meeting" ? meetings > 0 : p.scope === "between" ? kinds.length > 1 : p.scope === "shutter" ? kinds.length > 0 : true;
    if (used && !profileFor(p)) missing.push(`Section for ${p.role.replace(/\{.\}/g, "").trim()}`);
  }
  if (missing.length && !opts.allowUnknown) throw new StudioUnknownError(missing);

  const pieces: CutPiece[] = [];
  for (let q = 0; q < job.qty; q++) {
    const wId = `${job.id}${job.qty > 1 ? `.${q + 1}` : ""}`;
    const push = (sectionId: string, length: Um, role: string, angle: 90 | 45) =>
      pieces.push({ sectionId, length, itemId: wId, role, angle, label: `${wId}${job.sizeLabel ? ` ${job.sizeLabel}` : ""} — ${role}` });

    for (const p of parts.filter((x) => x.scope === "window")) {
      for (let c = 0; c < p.count; c++) push(profileFor(p), len(p.length), p.role.replace("{k}", String(c + 1)), p.angle);
    }
    kinds.forEach((kind, i) => {
      for (const p of parts.filter((x) => x.scope === "shutter")) {
        if (p.onlyGlass && kind !== "glass") continue;
        const sec = kind === "jali" && p.meshProfile ? p.meshProfile : profileFor(p, i);
        const role = p.role.replace("{s}", `S${i + 1}`).replace("{tag}", kind === "jali" ? " (Mesh)" : "");
        for (let c = 0; c < p.count; c++) push(sec, len(p.length), role, p.angle);
      }
    });
    for (const p of parts.filter((x) => x.scope === "between")) {
      for (let c = 0; c < p.count * Math.max(0, kinds.length - 1); c++) push(profileFor(p), len(p.length), p.role.replace("{k}", String(c + 1)), p.angle);
    }
    let k = 0;
    for (const p of parts.filter((x) => x.scope === "meeting")) {
      for (let c = 0; c < p.count * meetings; c++) push(profileFor(p), len(p.length), p.role.replace("{k}", String(++k)), p.angle);
    }
  }

  // Panels: a shutter can carry its own section on one side (a small slim
  // interlock on one, a big one on the next), so its glass is sized with its own picks.
  const panels: StudioResult["panels"] = [];
  const sizeFor = (i: number) => {
    const own = job.perShutter?.[i];
    if (!own || !Object.keys(own).length) return { w: len(sys.infill.w), h: len(sys.infill.h) };
    const v = computeSizes(sys, { ...job, switches: { ...(job.switches ?? {}), ...own } }).values;
    return { w: v[sys.infill.w] ?? 0, h: v[sys.infill.h] ?? 0 };
  };
  for (const kind of ["glass", "jali", "sheet"] as ShutterKind[]) {
    const groups = new Map<string, { w: Um; h: Um; n: number }>();
    kinds.forEach((k, i) => {
      if (k !== kind) return;
      const { w, h } = sizeFor(i);
      const g = groups.get(`${w}x${h}`) ?? { w, h, n: 0 };
      g.n++;
      groups.set(`${w}x${h}`, g);
    });
    for (const g of groups.values()) panels.push({ kind, w: g.w, h: g.h, count: g.n * job.qty });
  }

  const hardware: StudioResult["hardware"] = [];
  for (const e of sys.extras) {
    if (e.kind === "count") {
      const qty = e.qty * (e.per === "shutter" ? kinds.length : 1) * job.qty;
      if (qty) hardware.push({ id: e.id, name: e.name, formula: e.formula, qty, unit: e.unit });
    } else {
      // a running item whose size is not taught yet is left out, not guessed
      if (values[e.of[0]] == null || values[e.of[1]] == null) continue;
      const ft =2 * (toFeet(len(e.of[0])) + toFeet(len(e.of[1]))) * kinds.length * job.qty;
      if (ft) hardware.push({ id: e.id, name: e.name, formula: e.formula, qty: ft, unit: e.unit });
    }
  }
  return { pieces, panels, hardware, sizes: trace, missing };
}
