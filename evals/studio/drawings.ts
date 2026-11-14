/**
 * Every system offered in Window, checked against its own catalogue drawings.
 *   npx tsx evals/studio/drawings.ts          (fails on a mismatch)
 *   npx tsx evals/studio/drawings.ts --table  (prints every number)
 *
 * For each system the window is built again from the traced sections:
 *  - shutter height: the shutter is stood on its roller / clip in the track
 *    (lib/studio/assemble.ts) — H minus that must equal the system's rule;
 *  - roller clip: the clear width between the side tracks' running tips;
 *  - glass: a 5 mm glass slid into each pocket stops; it is cut 3.9 mm short
 *    (the calibration that gives OMEO Domal shutter − 102 exactly);
 *  - with a slim interlock: its glass slot instead of the shutter's pocket.
 * Systems that run on the founder-checked engine (Normal 18, Domal 27, Z) are
 * shown for information; their rules come from real jobs.
 */
import { TEMPLATES, WINDOW_SYSTEMS, BUILT_IN_PROFILES } from "../../lib/studio/templates";
import { computeSizes, jobVars, matches } from "../../lib/studio/evaluate";
import { shapeOf } from "../../lib/studio/shapes";
import { solidOf, buildSliding, box, slideUntilTouch, rayToMaterial, place, runners, inside } from "../../lib/studio/assemble";
import type { StudioSystem, ProfileDef } from "../../lib/studio/model";

const table = process.argv.includes("--table");
const TOL = 0.35; // mm: drawings are traced from catalogue pictures
const CLEAR = 3.9;
const fails: string[] = [];
const rows: string[][] = [["system", "what", "app", "drawing", ""]];
const W = 60 * 25400, H = 48 * 25400;

const prof = (sys: StudioSystem, id: string): ProfileDef | undefined => sys.profiles.find((p) => p.id === id) ?? BUILT_IN_PROFILES.find((p) => p.id === id);
const shape = (sys: StudioSystem, id: string) => { const s = shapeOf(prof(sys, id)); return s ? { ...s, solid: solidOf(s.paths) } : undefined; };
const codeOf = (sys: StudioSystem, id: string) => { const s = shapeOf(prof(sys, id)); return s?.code; };

/** One end of a section (dir +1 = left end, -1 = right end): how far a 5 mm glass goes in.
 *  Same probe as the calibration (and the section tool): every 0.5 mm, just inside the
 *  drawn end — a little deeper only when the end is a lip all the way. */
function endProbe(s: NonNullable<ReturnType<typeof shape>>, dir: 1 | -1): { glass: number; deep: number } {
  // from the printed width, as the numbers in the app were worked out
  const edge = dir === 1 ? 0 : s.w;
  for (const inset of [1.2, 2.5]) {
    let glass = 0, deep = 0, seen = false;
    for (let y = 2; y <= s.h - 2; y += 0.5) {
      const x = edge + dir * inset; const up = rayToMaterial(s.solid, x, y, 0, -1, 30), dn = rayToMaterial(s.solid, x, y, 0, 1, 30), open = up + dn;
      if (open < 5.5 || open > 34) continue;
      const c = y + (dn - up) / 2, start = dir === 1 ? edge - 12 : edge + 2;
      const t = slideUntilTouch(box(start, c - 2.5, start + 10, c + 2.5), s.solid, dir, 0, s.w + 14).dist - 2;
      if (t >= s.w - 2) continue;
      if (t >= 4) seen = true;
      deep = Math.max(deep, t);
      if (t >= 8 && t < 24) glass = Math.max(glass, t);
    }
    if (seen) return { glass, deep };
  }
  return { glass: 0, deep: 0 };
}
/** glass slot on a slim's face (from the top or bottom) */
function slotTravel(s: NonNullable<ReturnType<typeof shape>>): number {
  let best = 0;
  for (const dir of [1, -1] as const) { const edge = dir === 1 ? 0 : s.h;
    for (let x = 2; x <= s.w - 2; x += 0.25) for (const d of [0.6, 1.2, 2, 3]) {
      const y = edge + dir * d; const l = rayToMaterial(s.solid, x, y, -1, 0, 30), r = rayToMaterial(s.solid, x, y, 1, 0, 30), open = l + r;
      if (open < 5.5 || open > 34) continue;
      const c = x + (r - l) / 2, start = dir === 1 ? -12 : s.h + 2;
      const t = slideUntilTouch(box(c - 2.5, start, c + 2.5, start + 10), s.solid, 0, dir, s.h + 14).dist - 2;
      if (t >= 6 && t <= 24 && t > best) best = t;
    } }
  return best;
}
/** distance from a shutter's outer (track) edge to the glass edge, from its glass pocket */
function lockOffset(s: NonNullable<ReturnType<typeof shape>>): number | null {
  const a = endProbe(s, 1), b = endProbe(s, -1);
  // the glass pocket is at the end without the deep track channel
  const g = a.deep <= b.deep ? (a.glass || b.glass) : (b.glass || a.glass);
  return g ? s.w - g + CLEAR : null;
}
/** slims whose trace cannot be probed, measured by hand on the drawing (offset from the meeting edge) */
/** systems whose glass is the checked engine set's, widened (see below) */
const FROM_CHECKED_SET = new Set(["normal-18-60"]);
const BY_HAND: Record<string, number> = { "BH-2503": 18.6 /* a T size mark sits on its middle wall */ };

const check = (sys: string, what: string, app: number | null, drawn: number | null, note = "") => {
  const ok = app === null || drawn === null || Math.abs(app - drawn) <= TOL;
  rows.push([sys, what, app === null ? "—" : app.toFixed(1), drawn === null ? "—" : drawn.toFixed(1), (ok ? "" : "✗ ") + note]);
  if (!ok) fails.push(`${sys}: ${what} — app ${app?.toFixed(1)}, drawing ${drawn?.toFixed(1)} ${note}`);
};

for (const w of WINDOW_SYSTEMS) {
  const sys = TEMPLATES.find((t) => t.id === w.id)!;
  const name = sys.name;
  const job = (sw: Record<string, string> = {}) => ({ id: "V", W, H, qty: 1, tracks: 2, mix: sys.layouts[0].mixes.find((m) => !m.includes("J")) ?? "GG", switches: sw });
  const pick = (partId: string, sw: Record<string, string> = {}) => {
    const p = sys.parts.find((x) => x.id === partId || x.place === partId);
    return p?.profile.find((c) => matches(c.when, jobVars(sys, job(sw))))?.id ?? "";
  };
  const v = computeSizes(sys, job()).values;

  const track = pick("frame-bottom"), clip = pick("trackClip"), lock = pick("shutterLock") || pick("sash-lock"), top = pick("shutterTop") || pick("sash-top");
  const tr = shape(sys, track), sh = shape(sys, lock), cl = clip ? shape(sys, clip) : undefined;
  if (!tr || !sh) { check(name, "drawings", null, null, `missing trace (track ${codeOf(sys, track)}, shutter ${codeOf(sys, lock)})`); continue; }
  const get = (code: string) => { const s = [tr, sh, cl].find((x) => x?.code === code)!; return s; };

  // 1. shutter height
  if (!w.engine || sys.heightFrom) {
    let best: ReturnType<typeof buildSliding> | null = null;
    for (const mouth of ["start", "end"] as const) {
      try {
        const r = buildSliding({ name, bottom: tr.code, top: tr.code, clip: cl?.code, shutter: sh.code, mouth }, get as never);
        if (r.clear && r.topGap >= r.wheel && (!best || Math.abs(r.takeOff) < Math.abs(best.takeOff) + 100)) best = best && best.clear ? best : r;
      } catch { /* this way round does not fit */ }
    }
    // a solid bar rail (no wings) stands on the U floor; the roller runs on its top
    if (cl && best && cl.paths.length === 1 && cl.paths[0].split("L").length <= 5) {
      const x = runners(place(tr.solid, 1, 0, 0, 0, -1, tr.h), tr.w, tr.h).at[0];
      let y = 0; while (y < tr.h && !inside(tr.solid, x, y)) y += 0.05;
      best = { ...best, takeOff: best.tipT + (tr.h - y + cl.h) - 24 };
    }
    if (w.engine) { rows.push([name, "shutter height H −", ((H - (v.shutterH ?? 0)) / 1000).toFixed(1), best ? best.takeOff.toFixed(1) : "—", "(from real jobs)"]); }
    else check(name, "shutter height H −", v.shutterH !== null ? (W && H - (v.shutterH ?? 0)) / 1000 : null, best ? best.takeOff : null, best ? "" : "shutter does not stand in the track");
  }

  // 2. roller clip: between the side tracks' running tips (45° frames; Gulf sides are their own)
  if (cl && v.clipW !== null && v.clipW !== undefined) {
    const side = shape(sys, pick("frame-left"));
    const tip = side ? buildSliding({ name, bottom: side.code, top: side.code, clip: cl.code, shutter: sh.code, mouth: "start" }, ((c: string) => [side, sh, cl].find((x) => x?.code === c)) as never).tipB : null;
    check(name, "roller clip W −", (W - v.clipW) / 1000, tip !== null ? 2 * tip : null, `side ${side?.code}`);
  }

  // 3. glass (engine systems: from real jobs — shown, not failed)
  const lockOff = lockOffset(sh);
  const topSh = shape(sys, top) ?? sh;
  const topOff = lockOffset(topSh);
  const meet = sys.switches.find((x) => x.id === "meet");
  // Normal 18 · 2½″ is the 1½″ set (glass from real jobs) with each piece 20 mm wider —
  // the same section shapes widened, so its glass follows the 1½″ jobs + 40, not the probe.
  const engine = !!w.engine || FROM_CHECKED_SET.has(w.id);
  if (topOff !== null && v.glassH !== null && v.glassH !== undefined) {
    const app = (v.shutterH! - v.glassH) / 1000, dr = 2 * topOff;
    if (engine) rows.push([name, "glass height shutter −", app.toFixed(1), dr.toFixed(1), "(from real jobs)"]); else check(name, "glass height shutter −", app, dr, `pocket ${topSh.code}`);
  }
  // every slim the shop can pick, not only the first
  const slims = sys.switches.find((x) => x.id === "pick_shutterMeet")?.options.map((o) => o.value) ?? [""];
  const cases = (meet ? meet.options.map((o) => o.value) : ["-"]).flatMap((m) => (m === "slim" ? slims.map((p) => [m, p]) : [[m, ""]]));
  for (const [m, slimPick] of cases) {
    const sw: Record<string, string> = m === "-" ? {} : { meet: m, ...(slimPick ? { pick_shutterMeet: slimPick } : {}) };
    const vv = computeSizes(sys, job(sw)).values;
    if (vv.glassW === null || vv.glassW === undefined || lockOff === null) continue;
    const app = (vv.shutterW! - vv.glassW) / 1000;
    let meetOff: number | null = lockOff; // the shutter itself meets
    let label = "glass width shutter −";
    if (m === "slim") {
      const slim = shape(sys, pick("shutterMeet", sw));
      if (!slim) continue;
      const st = slotTravel(slim);
      const e = Math.max(endProbe(slim, 1).glass, endProbe(slim, -1).glass);
      meetOff = BY_HAND[slim.code] ?? (st ? slim.h - st + CLEAR : e ? slim.w - e + CLEAR : null);
      label = `glass width with slim ${slim.code} shutter −`;
    } else if (m === "clip") label = "glass width with interlock clip shutter −";
    if (engine) { rows.push([name, label, app.toFixed(1), meetOff !== null ? (lockOff + meetOff).toFixed(1) : "—", "(from real jobs)"]); continue; }
    check(name, label, app, meetOff !== null ? lockOff + meetOff : null);
  }
}

if (table) {
  const wid = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  for (const r of rows) console.log(r.map((c, i) => c.padEnd(wid[i])).join("  "));
}
if (fails.length) { console.error(`\ndrawings: ${fails.length} differ\n - ` + fails.join("\n - ")); process.exit(1); }
console.log(`drawings: ${WINDOW_SYSTEMS.length} Window systems match their drawings (shutter height, roller clip, glass, slim) ✓`);
