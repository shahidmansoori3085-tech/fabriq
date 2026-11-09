/**
 * Proof that the System Studio model can hold the real systems: the data
 * templates normal-18 and domal-27 must give EXACTLY the same cut pieces,
 * panels and hardware as the hand-written engine, on every answer path the
 * question flow offers, at 4 sizes, in both shutter-size modes.
 *
 *   npx tsx evals/studio/parity.ts
 */
import { generateQuestions } from "../../lib/engine/questions";
import { deriveItem } from "../../lib/engine/sheet-seed";
import { estimate } from "../../lib/engine/estimator";
import { toFeet } from "../../lib/engine/units";
import type { JobItem } from "../../lib/engine/types";
import { evaluate, type StudioJob } from "../../lib/studio/evaluate";
import { NORMAL_18, DOMAL_27 } from "../../lib/studio/templates";

const FT = 304800, INCH = 25400;
const sizes: [number, number][] = [
  [4 * FT, 4 * FT], [6 * FT + 3 * INCH + 3175, 4 * FT + 7 * INCH], [3 * FT + 2 * INCH, 7 * FT], [10 * FT, 8 * FT],
];

function toStudio(item: JobItem): StudioJob {
  const tracks = item.system === "domal"
    ? parseInt(item.meta.tracks ?? "", 10) || item.shutters.length
    : parseInt(item.meta.tracks ?? "2", 10) || 2;
  return {
    id: item.id, W: item.width, H: item.height, qty: item.qty, tracks,
    mix: item.shutters.map((s) => (s.kind === "jali" ? "J" : s.kind === "sheet" ? "S" : "G")).join(""),
    switches: { mode: item.meta.shutterSplit === "equal" ? "equal" : "half" },
  };
}

function legacy(item: JobItem): string[] {
  const r = estimate([item]);
  return [
    ...r.pieces.map((p) => `cut ${p.sectionId} ${p.length} ${p.role}`),
    ...r.glass.map((g) => `pane glass ${g.width}x${g.height} x${g.count}`),
    ...r.mesh.panels.map((g) => `pane jali ${g.width}x${g.height} x${g.count}`),
    ...r.sheet.panels.map((g) => `pane sheet ${g.width}x${g.height} x${g.count}`),
    ...r.hardware.map((h) => `hw ${h.name} ${h.qty}`).sort(),
  ];
}

function studio(item: JobItem): string[] {
  const sys = item.system === "domal" ? DOMAL_27 : NORMAL_18;
  const r = evaluate(sys, toStudio(item));
  const w = 1 + sys.wastagePct / 100;
  const hw = r.hardware.map((h) => `hw ${h.name} ${h.unit === "rft" ? Math.ceil(h.qty * w) : h.qty}`);
  const per = (kind: string) => r.panels.filter((p) => p.kind === kind)
    .reduce((a, p) => a + 2 * (toFeet(p.w) + toFeet(p.h)) * p.count, 0);
  if (per("jali")) hw.push(`hw Mesh spline / rubber ${Math.ceil(per("jali") * w)}`);
  if (per("sheet")) hw.push(`hw Sheet rubber gasket ${Math.ceil(per("sheet") * w)}`);
  return [
    ...r.pieces.map((p) => `cut ${p.sectionId} ${p.length} ${p.role}`),
    ...r.panels.map((p) => `pane ${p.kind} ${p.w}x${p.h} x${p.count}`),
    ...hw.sort(),
  ];
}

let checked = 0;
const fails: string[] = [];
function walk(known: Record<string, string>, w: number, h: number, depth: number) {
  const qs = generateQuestions({ type: "window", width: w, height: h, qty: 1, known });
  if (qs.length && depth < 12) {
    for (const o of qs[0].options) walk({ ...known, [qs[0].id]: o.value }, w, h, depth + 1);
    return;
  }
  for (const split of ["half", "equal"]) {
    for (const qty of [1, 2]) {
      const item = deriveItem("W1", "window", w, h, qty, { ...known, shutterSplit: split });
      if (item.system !== "normal_2t" && item.system !== "normal_3t" && item.system !== "domal") return;
      if (item.meta.domalFix === "yes") return; // fixed-top band: not in the Studio model yet (step 5)
      let a: string[], b: string[];
      try { a = legacy(item); } catch { continue; }
      try { b = studio(item); } catch (e) { fails.push(`${JSON.stringify(known)} ${w}x${h}: studio threw ${(e as Error).message}`); continue; }
      checked++;
      if (a.join("\n") !== b.join("\n")) {
        const firstDiff = a.findIndex((x, i) => x !== b[i]);
        fails.push(`${item.system} ${JSON.stringify(known)} ${split} q${qty} ${w}x${h}\n   engine: ${a[firstDiff]}\n   studio: ${b[firstDiff]}`);
      }
    }
  }
}
for (const sys of ["normal", "domal"]) for (const [w, h] of sizes) walk({ system: sys }, w, h, 0);

if (fails.length) {
  console.error(`Studio parity FAILED on ${fails.length} of ${checked + fails.length} cases:`);
  for (const f of fails.slice(0, 15)) console.error(" ✗ " + f);
  process.exit(1);
}
if (checked < 50) { console.error(`Studio parity: only ${checked} cases checked — walk is broken`); process.exit(1); }
console.log(`Studio parity: ${checked} cases identical to the engine (Normal 18 + Domal 27).`);
