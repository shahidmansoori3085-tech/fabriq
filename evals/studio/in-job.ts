/**
 * A Studio system used in a real job: built through buildJobItem + estimate()
 * exactly like the job screen does. A shop copy of Domal 27 must give the same
 * cut list, bars and glass as the engine's own Domal; and the item keeps a
 * frozen copy, so editing the system later does not change the job.
 *   npx tsx evals/studio/in-job.ts
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { estimate } from "../../lib/engine/estimator";
import { registerStudioSystems } from "../../lib/studio/runtime";
import { DOMAL_27, NORMAL_18 } from "../../lib/studio/templates";
import type { StudioSystem } from "../../lib/studio/model";

const IN = 25400;
const fails: string[] = [];
const fp = (r: ReturnType<typeof estimate>) => [
  ...r.pieces.map((p) => `${p.sectionId} ${p.length} ${p.role}`).sort(),
  ...r.sections.map((s) => `bars ${s.sectionId} ${s.bars16}/${s.bars8}`).sort(),
  ...r.glass.map((g) => `glass ${g.width}x${g.height} x${g.count}`).sort(),
  ...r.mesh.panels.map((g) => `mesh ${g.width}x${g.height} x${g.count}`).sort(),
  ...r.hardware.map((h) => `hw ${h.name} ${h.qty}`).sort(),
];

const mine: StudioSystem = { ...structuredClone(DOMAL_27), id: "shop-domal" };
const myNormal: StudioSystem = { ...structuredClone(NORMAL_18), id: "shop-normal" };
registerStudioSystems([mine, myNormal]);

for (const [w, h, tracks, mix] of [[72, 60, "3", "GGJ"], [48, 48, "2", "GG"], [96, 60, "3", "GGG"]] as const) {
  for (const [studioId, engineSys] of [["shop-domal", "domal"], ["shop-normal", "normal"]] as const) {
    const a = estimate([buildJobItem(1, "window", w * IN, h * IN, 2, { system: engineSys, tracks, mix, domalFix: "no" })]);
    const b = estimate([buildJobItem(1, "window", w * IN, h * IN, 2, { system: `studio:${studioId}`, tracks, mix })]);
    const A = fp(a), B = fp(b);
    if (A.join("\n") !== B.join("\n")) {
      const i = A.findIndex((x, k) => x !== B[k]);
      fails.push(`${studioId} ${w}x${h} ${tracks}T ${mix}: engine "${A[i]}" vs studio "${B[i]}"`);
    }
  }
}

// frozen copy: changing the shop's system afterwards leaves a built item alone
const item = buildJobItem(1, "window", 60 * IN, 48 * IN, 1, { system: "studio:shop-domal", tracks: "2", mix: "GG" });
const before = fp(estimate([item])).join("\n");
mine.sizes = mine.sizes.map((s) => (s.id === "shutterH" ? { ...s, cases: [{ ...s.cases[0], add: -50000 }] } : s));
registerStudioSystems([mine, myNormal]);
if (fp(estimate([item])).join("\n") !== before) fails.push("editing the system changed a job already made");
const fresh = buildJobItem(2, "window", 60 * IN, 48 * IN, 1, { system: "studio:shop-domal", tracks: "2", mix: "GG" });
if (fp(estimate([fresh])).join("\n") === before) fails.push("a new window did not pick up the edited system");

if (fails.length) { console.error("Studio in job FAILED:"); fails.forEach((f) => console.error(" ✗ " + f)); process.exit(1); }
console.log("Studio in job: shop systems cut like the engine through the real job path; saved jobs stay frozen.");
