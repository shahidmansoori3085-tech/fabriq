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
import { solidOf, box, slideUntilTouch, place, runners, buildSliding, buildBombay, type Stack } from "../../lib/studio/assemble";
import { EURO_26, GULF_25, BH_35, BH_27, AMPLE_25, AMPLE_22, AMPLE_29, AMPLE_37, BH_31 } from "../../lib/studio/templates";
import type { StudioSystem } from "../../lib/studio/model";

const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };
const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
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

// 2a. Normal 18 (Bombay): 13 mm bearing roller in the 1051 pocket, on the rail —
//     the shutter up to the top channel floor = engine H − 41.3 within ½ sut.
for (const [bot, top] of [["1011", "1000"], ["1031", "1021"]]) {
  const r = buildBombay(bot, top, "1051", get);
  console.log(`  Normal ${bot}/${top}: rail ${r.rail.toFixed(2)}, wheel ${r.wheel.toFixed(2)} below the bearing → H − ${r.takeOff.toFixed(2)} (engine H − 41.3)`);
  expect(r.clear, `Normal ${bot}: bearing should clear the track`);
  expect(Math.abs(r.takeOff - 41.3) <= HALF_SUT, `Normal ${bot}/${top}: drawing gives H − ${r.takeOff.toFixed(2)}, engine H − 41.3`);
}

// 2b. Same 27×65 domal, other makers: Ample and Eleanor cut the same as OMEO;
//     Banu Hashim's legs stand 48.9 mm, so its shutter is ~7 mm shorter.
for (const [code, sh, mouth, want] of [["214313", "214315", "end", 66.7], ["2702", "2722", "start", 66.7], ["BH-6032", "BH-6050", "start", 73.7]] as const) {
  const r = buildSliding({ name: code, bottom: code, top: code, shutter: sh, mouth }, get);
  console.log(`  domal ${code}: H − ${r.takeOff.toFixed(2)} mm`);
  expect(Math.abs(r.takeOff - want) <= (want === 66.7 ? HALF_SUT : 0.3), `${code}: drawing gives H − ${r.takeOff.toFixed(2)}, expected ~H − ${want}`);
}
{
  const c = BH_27.sizes.find((s) => s.id === "shutterH")!.cases[0];
  expect(c.add === -73700, `bh-27 2-track shutter rule should be H − 73.7, is ${c.add}`);
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
  [AMPLE_25, "2", { name: "Ample 25 2T", bottom: "955388", top: "955388", clip: "914401", shutter: "41323", mouth: "end" }],
  [AMPLE_29, "3", { name: "Ample 29 3T", bottom: "41052", top: "41052", clip: "914401", shutter: "41055", mouth: "end" }],
  [AMPLE_29, "2", { name: "Ample 29 2T", bottom: "914400", top: "914400", clip: "914401", shutter: "41055", mouth: "end" }],
  [AMPLE_37, "2", { name: "Ample 37 2T", bottom: "41015", top: "41015", clip: "41310-cap", shutter: "41068", mouth: "end" }],
  [AMPLE_37, "3", { name: "Ample 37 3T", bottom: "41014", top: "41014", clip: "41310-cap", shutter: "41068", mouth: "end" }],
  [BH_31, "2", { name: "BH 31 2T", bottom: "BH-6401", top: "BH-6401", clip: "BH-2559", shutter: "BH-6404", mouth: "start" }],
];
for (const [sys, tracks, st] of cases) {
  const r = buildSliding(st, get);
  console.log(`  ${st.name}: clip stands ${r.clipUp.toFixed(2)} mm, H − ${r.takeOff.toFixed(2)} mm`);
  expect(r.clipUp > 2 && r.clipUp < 5, `${st.name}: clip should stand ~4 mm above the track, got ${r.clipUp.toFixed(2)}`);
  expect(r.clear, `${st.name}: shutter should go over the track and clip without hitting`);
  expect(r.topGap >= r.wheel, `${st.name}: shutter must lift out (needs ${r.wheel.toFixed(1)}, has ${r.topGap.toFixed(1)})`);
  expect(Math.abs(ruleFor(sys, tracks) - r.takeOff) < 0.1, `${st.name}: template says H − ${ruleFor(sys, tracks)}, drawings H − ${r.takeOff.toFixed(2)}`);
}

// 3b. mini domal: runs on the pointed track, no clip
{
  const r = buildSliding({ name: "mini", bottom: "41083", top: "41083", shutter: "41082", mouth: "start" }, get);
  expect(Math.abs(r.takeOff - 46.0) < 0.1 && r.clear, `mini domal: H − ${r.takeOff.toFixed(2)}, clear ${r.clear}`);
  expect(-(AMPLE_22.sizes.find((s) => s.id === "shutterH")!.cases[0].add ?? 0) === 46000, "ample-22 rule should be H − 46.0");
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
