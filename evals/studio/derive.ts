/**
 * Cuts worked out from the section drawings must agree with the engine's
 * founder-checked Domal rules (within ½ sut).
 *   npx tsx evals/studio/derive.ts
 *
 * Domal: shutter height = H − 2 × frame height + roller height (24 mm, founder).
 */
import { shutterHeightFromDrawing, applyShutterHeight, sameCut, DEFAULT_ROLLER_MM } from "../../lib/studio/derive";
import { DOMAL_27, AMPLE_27, ELEANOR_27, BUILT_IN_PROFILES } from "../../lib/studio/templates";
import { evaluate } from "../../lib/studio/evaluate";
import { estimate } from "../../lib/engine/estimator";
import type { JobItem } from "../../lib/engine/types";
import type { StudioSystem } from "../../lib/studio/model";

const IN = 25400;
const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };
const find = (sys: StudioSystem) => (id: string) => sys.profiles.find((p) => p.id === id) ?? BUILT_IN_PROFILES.find((p) => p.id === id);
const mmTxt = (u: number) => (u / 1000).toFixed(1);

// 1. OMEO domal: the drawing gives the same shutter height as the founder's job.
const rules = shutterHeightFromDrawing(DOMAL_27, DEFAULT_ROLLER_MM, find(DOMAL_27));
expect(rules.length === 2, `domal-27 should give a rule for 2 and 3 tracks, got ${rules.length}`);
for (const r of rules) {
  console.log(`  ${r.tracks}-track ${r.frame.codes?.omeo}: drawing H − ${mmTxt(r.takeOff)} mm, engine H − ${mmTxt(r.current ?? 0)} mm, apart ${mmTxt(Math.abs(r.diff ?? 0))} mm`);
  expect(sameCut(r.diff), `${r.tracks}-track: drawing and engine differ by ${mmTxt(r.diff ?? 0)} mm`);
}
const three = rules.find((r) => r.tracks === 3);
expect(three?.takeOff === 66800, `3-track 2062: 2 × 45.4 − 24 should be 66.8 mm, got ${three && mmTxt(three.takeOff)}`);

// 2. The engine's real Domal cut list agrees with the drawing on many window sizes.
for (const [w, h] of [[48, 48], [60, 54], [66, 58], [72, 60], [96, 72], [120, 84]]) {
  for (const tracks of [2, 3]) {
    const item: JobItem = {
      id: "D1", label: "", system: "domal", width: w * IN, height: h * IN, qty: 1,
      shutters: Array.from({ length: tracks }, (_, i) => ({ kind: i === 2 ? "jali" : "glass" })),
      meta: { tracks: String(tracks) },
    } as unknown as JobItem;
    const side = estimate([item]).pieces.find((p) => /Shutter Left/.test(p.role));
    const r = rules.find((x) => x.tracks === tracks)!;
    const drawn = h * IN - r.takeOff;
    expect(!!side && Math.abs(side.length - drawn) <= 1588, `${w}×${h} ${tracks}T: engine ${side && mmTxt(side.length)} vs drawing ${mmTxt(drawn)}`);
  }
}

// 3. Same 27×65 shape from other makers: their frames give the same rule within ½ sut.
for (const sys of [AMPLE_27, ELEANOR_27]) {
  for (const r of shutterHeightFromDrawing(sys, DEFAULT_ROLLER_MM, find(sys))) {
    console.log(`  ${sys.id} ${r.tracks}-track: drawing H − ${mmTxt(r.takeOff)} mm`);
    expect(Math.abs(r.takeOff - 66700) <= 1588, `${sys.id} ${r.tracks}T: ${mmTxt(r.takeOff)} far from OMEO's 66.7`);
  }
}

// 4. Using the drawing never replaces a rule checked on a real job; it fills unknown ones.
{
  const same = applyShutterHeight(DOMAL_27, rules, DEFAULT_ROLLER_MM);
  expect(JSON.stringify(same.sizes) === JSON.stringify(DOMAL_27.sizes), "verified domal-27 shutter height must not be replaced");

  const blank: StudioSystem = structuredClone(DOMAL_27);
  blank.sizes.find((s) => s.id === "shutterH")!.cases = [{ base: "H", add: null, evidence: { status: "unknown", source: "" } }];
  const filled = applyShutterHeight(blank, shutterHeightFromDrawing(blank, DEFAULT_ROLLER_MM, find(blank)), DEFAULT_ROLLER_MM);
  const r3 = evaluate(filled, { id: "W", W: 66 * IN, H: 58 * IN, qty: 1, tracks: 3, mix: "GGJ" });
  const side3 = r3.pieces.find((p) => /Shutter Left/.test(p.role));
  expect(side3?.length === 58 * IN - 66800, `filled 3T shutter side should be H − 66.8, got ${side3 && mmTxt(58 * IN - side3.length)}`);
  const r2 = evaluate(filled, { id: "W", W: 66 * IN, H: 58 * IN, qty: 1, tracks: 2, mix: "GG" });
  const side2 = r2.pieces.find((p) => /Shutter Left/.test(p.role));
  expect(side2?.length === 58 * IN - 66000, `filled 2T shutter side should be H − 66.0, got ${side2 && mmTxt(58 * IN - side2.length)}`);
}

if (fails.length) { console.error(`\nderive: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log("derive: drawing rules agree with the engine ✓");
