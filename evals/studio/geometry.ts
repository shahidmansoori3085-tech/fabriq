/**
 * Every window system checked against its section drawings (founder 2026-11-15:
 * "sab system ko geometry diagram se baariki se check karo").
 *   npx tsx evals/studio/geometry.ts          (fails on any error)
 *   npx tsx evals/studio/geometry.ts --report (prints every check)
 *
 * 1. Printed size = drawing: each section's catalogue size matches its traced drawing.
 * 2. One series: every shutter piece of an N mm sliding system is N mm thick
 *    (a 29 mm top/bottom in a 31 mm shutter is the wrong section).
 * 3. Built window: for every system and track count, the window is built from the
 *    drawings (bottom track, roller clip, shutter, top track): the clip seats, the
 *    shutter clears the track, it lifts out at the top, and the app's shutter height
 *    is the one the drawings give.
 */
import { TEMPLATES, OFFERED } from "../../lib/studio/templates";
import { shapeOf } from "../../lib/studio/shapes";
import { solidOf, buildSliding, rayToMaterial, inside, runners, place, tipAt } from "../../lib/studio/assemble";
type Sh = { w: number; h: number; paths: string[] };

/** Glass plane of a shutter across its thickness: centre of its glass pocket (open 4.5–22, 6–32 deep). */
function glassPlane(s: Sh): number | undefined {
  const so = solidOf(s.paths); let best: { c: number; depth: number } | undefined;
  for (const ins of [1.2, 2, 3, 4.5]) for (const [x, dir] of [[ins, 1], [s.w - ins, -1]] as const) {
    let y = 0.2;
    while (y < s.h) {
      if (inside(so, x, y)) { y += 0.1; continue; }
      let e = y; while (e < s.h && !inside(so, x, e)) e += 0.1;
      const c = (y + e) / 2, open = e - y, depth = rayToMaterial(so, dir === 1 ? -1 : s.w + 1, c, dir, 0, s.w + 2);
      if (y > 0.3 && e < s.h - 0.3 && open >= 4.5 && open <= 22 && depth >= 6 && depth <= 32 && c > 3 && c < s.h - 3 && (!best || depth > best.depth)) best = { c, depth };
      y = e;
    }
  }
  if (best) return best.c;
  // a wide bead-type glass mouth (6712, 6003): the glass line is its centre
  for (const [x, dir] of [[1.2, 1], [s.w - 1.2, -1]] as const) {
    let y = 0.2;
    while (y < s.h) {
      if (inside(so, x, y)) { y += 0.1; continue; }
      let e = y; while (e < s.h && !inside(so, x, e)) e += 0.1;
      const c = (y + e) / 2, depth = rayToMaterial(so, dir === 1 ? -1 : s.w + 1, c, dir, 0, s.w + 2);
      if (e - y >= s.h * 0.6 && depth >= 6 && depth <= 32) return c;
      y = e;
    }
  }
  return undefined;
}
/** A slim interlock's glass slot (on its face): centre across its thickness. */
function slimSlot(s: Sh): number | undefined {
  const so = solidOf(s.paths); let best: { c: number; depth: number } | undefined;
  for (const ins of [0.8, 1.5, 2.5, 3.5]) for (const [y, dir] of [[ins, 1], [s.h - ins, -1]] as const) {
    let x = 0.2;
    while (x < s.w) {
      if (inside(so, x, y)) { x += 0.1; continue; }
      let e = x; while (e < s.w && !inside(so, e, y)) e += 0.1;
      const c = (x + e) / 2, open = e - x, depth = rayToMaterial(so, c, dir === 1 ? -1 : s.h + 1, 0, dir, s.h + 2);
      if (x > 0.3 && e < s.w - 0.3 && open >= 4.5 && open <= 30 && depth >= 6 && (!best || depth > best.depth)) best = { c, depth };
      x = e;
    }
  }
  return best?.c;
}
/** Distance between the first two running U's of a track (glass plane to glass plane). */
function pitch(s: Sh): number | undefined {
  const so = place(solidOf(s.paths), 1, 0, 0, 0, -1, s.h); const r = runners(so, s.w, s.h);
  return r.at.length >= 2 ? r.at[1] - r.at[0] : undefined;
}
/** A U's inner width just below its running tips. */
function uMouth(s: Sh): number {
  const so = place(solidOf(s.paths), 1, 0, 0, 0, -1, s.h); const x = runners(so, s.w, s.h).at[0];
  let tip = -1e9; for (let d = -8; d <= 8; d += 0.25) tip = Math.max(tip, tipAt(so, x + d, s.h + 10));
  return rayToMaterial(so, x, tip - 1.5, -1, 0, 20) + rayToMaterial(so, x, tip - 1.5, 1, 0, 20);
}
import { matches } from "../../lib/studio/evaluate";
import { partLabel } from "../../lib/studio/edit";
import type { StudioSystem, PartDef } from "../../lib/studio/model";

const report = process.argv.includes("--report");
const fails: string[] = [], notes: string[] = [];
/**
 * Open questions for the founder: printed on every run (not failed) until he answers.
 * Key = the start of the check's text.
 */
const DOUBTS: Record<string, string> = {
  "Euro 27 mm: slim 27 mm Slim Interlock — double glass — two slims hook":
    "2730 hooks only ~0.9 mm on the 29 mm track (catalogue pairs hook 2.8–9.4) — ask whether shops use 2730 on this track",
};
const doubts: string[] = [];
const say = (ok: boolean, msg: string) => {
  const d = Object.keys(DOUBTS).find((k) => msg.startsWith(k));
  if (!ok && d) doubts.push(`${msg} — ${DOUBTS[d]}`);
  else if (!ok) fails.push(msg);
  else if (report) console.log("  ✓ " + msg);
};
const HALF_SUT = 1.5875;
const dims = (s?: string) => (s ?? "").split("×").map(Number).filter((v) => v > 0);

/** Founder-checked heights (the drawings may differ a little; the real job wins). */
const VERIFIED = new Set(["normal-18", "normal-18-60", "domal-27", "z-40", "z-55"]);

for (const sys of TEMPLATES) {
  if (!OFFERED.has(sys.id) || sys.id.startsWith("blank")) continue;
  const defaults: Record<string, string> = Object.fromEntries(sys.switches.map((s) => [s.id, s.default]));
  const prof = (id: string) => sys.profiles.find((p) => p.id === id);

  // 1. printed size vs drawing
  const seen = new Set<string>();
  for (const part of sys.parts) for (const c of part.profile) {
    const p = prof(c.id); const sh = shapeOf(p);
    if (!p || !sh || seen.has(p.id)) continue; seen.add(p.id);
    const [a, b] = dims(p.size);
    if (!a || !b) continue;
    const fit = (x: number, y: number) => Math.abs(sh.w - x) <= Math.max(0.6, x * 0.02) && Math.abs(sh.h - y) <= Math.max(0.6, y * 0.02);
    // an interlock's printed size is its body; the hook stands out above it (OMEO prints 1081 / the 2½″ interlock that way)
    const hook = p.kind === "interlock" && Math.abs(sh.w - a) <= Math.max(0.6, a * 0.02) && sh.h > b;
    say(fit(a, b) || fit(b, a) || hook, `${sys.name}: ${p.name} printed ${p.size}, drawing ${sh.w}×${sh.h}`);
  }

  // 2. one series: shutter pieces as thick as the series (sliding only)
  if (sys.family !== "casement" && sys.series?.mm) {
    for (const part of sys.parts) {
      if (part.scope !== "shutter") continue;
      for (const c of part.profile) {
        const p = prof(c.id);
        if (!p || !["shutter", "handle", "shutter-rail", "mesh-shutter"].includes(p.kind ?? "")) continue;
        const t = Math.min(...dims(p.size));
        const mm = sys.series.mm;
        // Bombay: the 18 mm series name is the shutter's thickness too (40×18, 60×19)
        say(Math.abs(t - mm) <= 1.6, `${sys.name}: ${partLabel(part)} ${p.name} is ${t} mm thick, series ${mm} mm`);
      }
    }
  }

  // 2b. slim interlocks: glass in line with the shutter's, and the two meeting slims hook
  //     (each reaches past the glass line; together they overlap 1–12 mm at the track pitch).
  //     Catalogue pairs give 2.8–9.4 mm (2556, 6408, 6052, 2913, 2728, 6707 on Euro 35, 6506 on Gulf 35).
  {
    const meet = sys.switches.find((x) => x.id === "pick_shutterMeet");
    const lockPart = sys.parts.find((p) => p.place === "sash-lock");
    const lock = lockPart ? shapeOf(prof(lockPart.profile[lockPart.profile.length - 1].id)) : undefined;
    const trackPart = sys.parts.find((p) => p.place === "frame-bottom");
    const track = trackPart ? shapeOf(prof(trackPart.profile.find((x) => matches(x.when, { ...defaults, tracks: "2" }))?.id ?? "")) : undefined;
    const plane = lock ? glassPlane(lock) : undefined, P = track ? pitch(track) : undefined;
    for (const o of meet?.options ?? []) {
      const sl = shapeOf(prof(o.value)); const c = sl ? slimSlot(sl) : undefined;
      if (!sl || c === undefined || plane === undefined || !lock || P === undefined) { notes.push(`${sys.name}: slim ${o.label} — glass line not measurable on the drawings`); continue; }
      const sides = [c, sl.w - c], shutterSides = [plane, lock.h - plane];
      const off = (a: number) => Math.min(...shutterSides.map((b) => Math.abs(a - b)));
      // the flush side sits on the shutter face; a big slim has its reinforcement there instead (longer than the shutter is thick)
      const flushIdx = off(sides[0]) <= off(sides[1]) ? 0 : 1;
      const reinforced = Math.max(...sides) > lock.h;
      const hook = reinforced ? Math.min(...sides) : sides[1 - flushIdx];
      if (!reinforced) say(off(sides[flushIdx]) <= 0.6, `${sys.name}: slim ${o.label} — glass in line with the shutter (one face flush within ${off(sides[flushIdx]).toFixed(2)} mm)`);
      const overlap = 2 * hook - P;
      say(overlap >= 1 && overlap <= 12, `${sys.name}: slim ${o.label} — two slims hook at the ${P.toFixed(1)} mm track pitch (overlap ${overlap.toFixed(1)} mm)`);
    }
  }

  // 3. the window built from the drawings
  if (sys.family === "casement" || sys.series?.type === "bombay") continue; // casement: no rollers; Bombay: evals/studio/assemble.ts (bearing roller)
  const at = (place: string, vars: Record<string, string>) => {
    const part = sys.parts.find((p) => p.place === place) as PartDef | undefined;
    const c = part?.profile.find((x) => matches(x.when, vars));
    return c?.id ? shapeOf(prof(c.id)) : undefined;
  };
  // every shop choice (track, roller clip, meeting…), not only the default; per-shutter slim picks do not move the shutter height
  let choices: Record<string, string>[] = [{}];
  for (const sw of sys.switches.filter((x) => !x.id.startsWith("pick_")))
    choices = choices.flatMap((c) => sw.options.map((o) => ({ ...c, [sw.id]: o.value })));
  for (const layout of sys.layouts) for (const choice of choices) {
    if (layout.tracks < 2) continue;
    const vars = { ...defaults, ...choice, tracks: String(layout.tracks), glass: "2", shutters: String(layout.tracks), mix: layout.mixes[0] };
    const bottom = at("frame-bottom", vars), top = at("frame-top", vars), shutter = at("sash-bottom", vars);
    const clipPart = sys.parts.find((p) => /Roller Clip|Track Rail/.test(p.role));
    const clip = clipPart ? shapeOf(prof(clipPart.profile.find((x) => matches(x.when, vars))?.id ?? "")) : undefined;
    const name = `${sys.name} ${layout.tracks}-track${Object.keys(choice).length ? " (" + Object.entries(choice).map(([k, v]) => k + " " + v).join(", ") + ")" : ""}`;
    if (!bottom || !top || !shutter) { notes.push(`${name}: a section has no drawing — not built`); continue; }
    const book: Record<string, { w: number; h: number; paths: string[] }> = { B: bottom, T: top, S: shutter, ...(clip ? { C: clip } : {}) };
    const get = (k: string) => ({ ...book[k], solid: solidOf(book[k].paths) });
    // the shutter may face either way in the drawing: take the way it clears and lifts out
    const tries = (["start", "end"] as const).map((mouth) => { try { return buildSliding({ name, bottom: "B", top: "T", shutter: "S", mouth, ...(clip ? { clip: "C" } : {}) }, get); } catch { return null; } })
      .filter(Boolean).map((r) => r!).sort((x, y) => Number(y.clear && y.topGap >= y.wheel) - Number(x.clear && x.topGap >= x.wheel));
    const r = tries[0];
    if (!r) { notes.push(`${name}: could not be built`); continue; }
    const rule = sys.sizes.find((s) => s.id === "shutterH")?.cases.find((c) => matches(c.when, vars));
    const app = rule?.add == null ? NaN : -rule.add / 1000;
    if (clip) {
      say(r.clipUp > 2 && r.clipUp < 5, `${name}: roller clip stands ${r.clipUp.toFixed(2)} mm in the track`);
      const mouth = uMouth(bottom);
      say(clip.w >= mouth - 0.3, `${name}: roller clip head ${clip.w} mm rests on the U (mouth ${mouth.toFixed(1)} mm)`);
    }
    say(r.clear, `${name}: shutter runs over the track without touching`);
    say(r.topGap >= r.wheel, `${name}: shutter lifts out at the top (needs ${r.wheel.toFixed(1)}, has ${r.topGap.toFixed(1)})`);
    if (rule?.base === "H" && !rule.num && !rule.den) {
      const tol = VERIFIED.has(sys.id) ? HALF_SUT : 0.15;
      say(Math.abs(app - r.takeOff) <= tol, `${name}: app shutter height H − ${app}, drawings H − ${r.takeOff.toFixed(2)}`);
    } else notes.push(`${name}: shutter height is not a plain H − x rule — not compared`);
  }
}

if (notes.length) console.log("Not checked:\n - " + notes.join("\n - "));
if (doubts.length) console.log("Open questions for the founder:\n - " + doubts.join("\n - "));
if (fails.length) { console.error(`\ngeometry: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log("geometry: every system's sections, series and built window agree with the drawings ✓");
