/**
 * Golden cut lists. Every answer path the question flow offers, at a spread of
 * sizes, is built and its exact output (every cut piece, glass/mesh size, bars
 * to buy) is compared with evals/engine/golden.json. Any change to a deduction,
 * a count or the packing shows up here as a named diff, so a formula can never
 * change by accident. Also pins the founder's three measured jobs.
 *
 *   npx tsx evals/engine/golden.ts            check
 *   npx tsx evals/engine/golden.ts --update   rewrite golden.json (only after
 *                                             the change has been reviewed)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { generateQuestions } from "../../lib/engine/questions";
import { deriveItem } from "../../lib/engine/sheet-seed";
import { estimate } from "../../lib/engine/estimator";
import type { OpeningType } from "../../lib/engine/types";

const FT = 304800;
const INCH = 25400;
const FILE = join(__dirname, "golden.json");
const update = process.argv.includes("--update");

type Start = { type: OpeningType; known: Record<string, string>; label: string };
const starts: Start[] = [
  { type: "window", known: { system: "normal" }, label: "Normal" },
  { type: "window", known: { system: "domal" }, label: "Domal" },
  { type: "window", known: { system: "z_section", zSize: "light" }, label: "Z" },
  { type: "window", known: { system: "z_section", zSize: "heavy" }, label: "Z heavy" },
  { type: "door", known: { chokhat: "needed", palla: "75" }, label: "Door 75" },
  { type: "door", known: { chokhat: "needed", palla: "60" }, label: "Door 60" },
  { type: "door", known: { chokhat: "needed", palla: "50" }, label: "Door 50" },
  { type: "partition", known: {}, label: "Partition" },
];
// Odd sizes on purpose (sut fractions, not round feet) so rounding is pinned too.
const sizes: [number, number][] = [
  [4 * FT, 4 * FT],
  [6 * FT + 3 * INCH + 3175, 4 * FT + 7 * INCH],
  [3 * FT + 2 * INCH, 7 * FT],
  [10 * FT, 8 * FT],
];

/** One line per cut piece / pane, sorted, so a diff names exactly what moved. */
function fingerprint(type: OpeningType, w: number, h: number, known: Record<string, string>): string[] {
  try {
    const r = estimate([deriveItem("W1", type, w, h, 1, known)]);
    const pieces = r.pieces.map((p) => `cut ${p.sectionId} ${p.length} ${p.role}`);
    const pane = (kind: string) => (g: { width: number; height: number; count: number }) => `pane ${kind} ${g.width}x${g.height} x${g.count}`;
    const panes = [...r.glass.map(pane("glass")), ...r.mesh.panels.map(pane("mesh")), ...r.sheet.panels.map(pane("sheet"))];
    const bars = r.sections.map((s) => `buy ${s.sectionId} full:${s.bars16} half:${s.bars8}`);
    const hw = r.hardware.map((x) => `hardware ${x.name} ${x.qty} ${x.unit}`);
    return [...pieces, ...panes, ...bars, ...hw].sort();
  } catch (e) {
    return [`refused ${(e as Error).name}: ${(e as Error).message}`];
  }
}

const now: Record<string, string[]> = {};
function walk(s: Start, w: number, h: number, known: Record<string, string>, depth: number, path: string[]) {
  const qs = generateQuestions({ type: s.type, width: w, height: h, qty: 1, known });
  if (!qs.length || depth > 12) {
    now[`${s.label} ${w}x${h} | ${path.join(", ")}`] = fingerprint(s.type, w, h, known);
    return;
  }
  const q = qs[0];
  for (const o of q.options) walk(s, w, h, { ...known, [q.id]: o.value }, depth + 1, [...path, `${q.id}=${o.value}`]);
}
for (const s of starts) for (const [w, h] of sizes) walk(s, w, h, { ...s.known }, 0, []);

// ---- Founder-measured jobs (exact, independent of golden.json) ----
const fails: string[] = [];
const near = (a: number, b: number) => Math.abs(a - b) <= 1600; // ±1.6 mm ≈ ½ sut
{
  // 72"×60" Normal 3-track job: handle / interlock came out 58.375"
  const r = estimate([deriveItem("W1", "window", 72 * INCH, 60 * INCH, 1, { system: "normal", tracks: "3" })]);
  const hd = r.pieces.find((p) => /Handle/.test(p.role));
  if (!hd || !near(hd.length, 58.375 * INCH)) fails.push(`Normal 72x60 job: handle ${hd?.length} µm, measured 58.375"`);
}
{
  // 66"×58" Domal 3-track job: shutter side came out 55.375"
  const r = estimate([deriveItem("W1", "window", 66 * INCH, 58 * INCH, 1, { system: "domal", tracks: "3" })]);
  const sd = r.pieces.find((p) => /Shutter Left/.test(p.role));
  if (!sd || !near(sd.length, 55.375 * INCH)) fails.push(`Domal 66x58 job: shutter side ${sd?.length} µm, measured 55.375"`);
}

// ---- "Equal share" shutter option (shop setting, opt-in) ----
{
  const at = (meta: Record<string, string>, re: RegExp) =>
    estimate([deriveItem("W1", "window", 72 * INCH, 48 * INCH, 1, meta)]).pieces.find((p) => re.test(p.role))?.length ?? 0;
  const want = (label: string, got: number, inches: number) => {
    if (!near(got, inches * INCH)) fails.push(`${label}: ${(got / INCH).toFixed(3)}", want ${inches}"`);
  };
  // Normal GGG, equal: bearing = (72 − 7½) ÷ 3 = 21½" (Aluminium center point)
  want("Normal 3T GGG equal bearing", at({ system: "normal", tracks: "3", mix: "GGG", shutterSplit: "equal" }, /Bearing Top/), 21.5);
  // A jali still covers one glass: GGJ stays W/2 − 80mm even when equal is on
  want("Normal 3T GGJ equal bearing", at({ system: "normal", tracks: "3", mix: "GGJ", shutterSplit: "equal" }, /Bearing Top/), 36 - 80 / 25.4);
  // Default (no setting) is W/2 for GGG too
  want("Normal 3T GGG default bearing", at({ system: "normal", tracks: "3", mix: "GGG" }, /Bearing Top/), 36 - 80 / 25.4);
  // Domal GGG, equal: shutter = (72 + 1⅝) ÷ 3 (Ramhans, SMART ALUMINIUM)
  want("Domal 3T GGG equal shutter", at({ system: "domal", tracks: "3", mix: "GGG", shutterSplit: "equal" }, /Shutter Top/), (72 + 1.625) / 3);
}

const keys = Object.keys(now).length;
if (update) {
  writeFileSync(FILE, JSON.stringify(now, null, 1) + "\n");
  console.log(`golden.json written: ${keys} paths`);
} else {
  if (!existsSync(FILE)) { console.log("golden.json missing — run with --update"); process.exit(1); }
  const was: Record<string, string[]> = JSON.parse(readFileSync(FILE, "utf8"));
  for (const k of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const a = was[k], b = now[k];
    if (!a) { fails.push(`NEW PATH ${k}`); continue; }
    if (!b) { fails.push(`PATH GONE ${k}`); continue; }
    const gone = a.filter((x) => !b.includes(x)), added = b.filter((x) => !a.includes(x));
    if (gone.length || added.length) fails.push(`${k}\n   - ${gone.join("\n   - ")}\n   + ${added.join("\n   + ")}`);
  }
}
console.log(`Golden cut lists: ${keys} paths`);
if (fails.length) { console.log(`${fails.length} differences:\n` + fails.slice(0, process.argv.includes("--all") ? fails.length : 25).join("\n")); process.exit(1); }
console.log("GOLDEN CUT LISTS HOLD");
