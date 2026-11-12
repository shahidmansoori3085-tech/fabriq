/**
 * Windows built from the section drawings (lib/studio/assemble.ts).
 *   npx tsx evals/studio/assemble.ts
 *
 * 1. Bisection finds a contact to 0.01 mm.
 * 2. Domal OMEO built from its drawings gives the engine's founder-checked
 *    shutter height (H − 66.7) within ½ sut.
 * 3. Euro / Gulf: the clip seats on the track, the shutter clears the track,
 *    and the template's shutter rule is the one the drawings give.
 * 4. Gulf side tracks have one groove; top / bottom tracks one per shutter.
 */
import { readFileSync } from "node:fs";
import { solidOf, box, slideUntilTouch, place, runners, buildSliding, type Stack } from "../../lib/studio/assemble";
import { EURO_26, GULF_25, BH_35 } from "../../lib/studio/templates";
import type { StudioSystem } from "../../lib/studio/model";

const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };
const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "banuhashim", "banuhashim-euro"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
const get = (code: string) => ({ ...book[code], solid: solidOf(book[code].paths) });
const HALF_SUT = 1.5875;

// 1. bisection
{
  const d = slideUntilTouch(box(0, 0, 5, 5), box(15, -2, 20, 7), 1, 0, 40).dist;
  expect(Math.abs(d - 10) < 0.01, `box should travel 10 mm before touching, went ${d}`);
}

// 2. Domal from the drawings = engine
for (const code of ["2062", "2051"]) {
  const r = buildSliding({ name: code, bottom: code, top: code, shutter: "2046", mouth: "end" }, get);
  console.log(`  Domal ${code}: H − ${r.takeOff.toFixed(2)} mm (engine H − 66.7)`);
  expect(r.clear, `Domal ${code}: shutter should clear the track`);
  expect(Math.abs(r.takeOff - 66.7) <= HALF_SUT, `Domal ${code}: drawing gives H − ${r.takeOff.toFixed(2)}, engine H − 66.7`);
}

// 3. Euro and Gulf: what the templates say is what the drawings give
const ruleFor = (sys: StudioSystem, tracks: string) => {
  const c = sys.sizes.find((s) => s.id === "shutterH")!.cases.find((x) => !x.when || x.when.tracks === tracks)!;
  return -(c.add ?? NaN) / 1000;
};
const cases: [StudioSystem, string, Stack][] = [
  [EURO_26, "3", { name: "Euro 3T", bottom: "BH-6001", top: "BH-6001", clip: "BH-2559", shutter: "BH-6003", mouth: "start" }],
  [EURO_26, "2", { name: "Euro 2T", bottom: "BH-6000", top: "BH-6000", clip: "BH-2559", shutter: "BH-6003", mouth: "start" }],
  [GULF_25, "2", { name: "Gulf 25 2T", bottom: "BH-2551", top: "BH-2551", clip: "BH-2559", shutter: "BH-2554", mouth: "start" }],
  [BH_35, "2", { name: "Gulf 35 2T", bottom: "BH-6501", top: "BH-6501", clip: "BH-6513", shutter: "BH-6504", mouth: "start" }],
];
for (const [sys, tracks, st] of cases) {
  const r = buildSliding(st, get);
  console.log(`  ${st.name}: clip stands ${r.clipUp.toFixed(2)} mm, H − ${r.takeOff.toFixed(2)} mm`);
  expect(r.clipUp > 3 && r.clipUp < 5, `${st.name}: clip should stand ~4 mm above the track, got ${r.clipUp.toFixed(2)}`);
  expect(r.clear, `${st.name}: shutter should go over the track and clip without hitting`);
  expect(r.topGap >= r.wheel, `${st.name}: shutter must lift out (needs ${r.wheel.toFixed(1)}, has ${r.topGap.toFixed(1)})`);
  expect(Math.abs(ruleFor(sys, tracks) - r.takeOff) < 0.1, `${st.name}: template says H − ${ruleFor(sys, tracks)}, drawings H − ${r.takeOff.toFixed(2)}`);
}

// 4. Gulf: one groove at the sides, one per shutter at top and bottom
const grooves = (code: string) => { const s = book[code]; const r = runners(place(solidOf(s.paths), 1, 0, 0, 0, -1, s.h), s.w, s.h); return r.kind === "U" ? r.at.length : 0; };
for (const code of ["BH-2550", "BH-2552", "BH-6500"]) expect(grooves(code) === 1, `${code} (Gulf side) should have one groove, found ${grooves(code)}`);
for (const [code, n] of [["BH-2551", 2], ["BH-2553", 3], ["BH-6501", 2], ["BH-6503", 3], ["BH-6001", 3], ["BH-6000", 2]] as const)
  expect(grooves(code) === n, `${code} should have ${n} grooves, found ${grooves(code)}`);
for (const sys of [GULF_25, BH_35]) {
  const prof = (place: string) => sys.parts.find((p) => p.place === place)!.profile.map((o) => o.id).join("/");
  expect(prof("frame-top") === prof("frame-bottom"), `${sys.id}: top and bottom should be the same track`);
  expect(prof("frame-left") !== prof("frame-top"), `${sys.id}: sides should be the one-groove track`);
}

if (fails.length) { console.error(`\nassemble: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log("assemble: windows built from the drawings agree ✓");
