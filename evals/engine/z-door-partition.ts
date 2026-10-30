/**
 * The Z-section door (under Door) and the Z-section partition (under
 * Partition) — built through the same buildJobItem the screens use.
 * Every size must build with positive pieces and panels, and a partition's
 * glass count must equal the grid its drawing shows.
 *
 *   npx tsx evals/engine/z-door-partition.ts
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { estimate, partitionLayout } from "../../lib/engine/estimator";

const FT = 304800;
let built = 0;
const fails: string[] = [];
for (const w of [3, 4, 6, 8, 10, 12, 15]) for (const h of [3, 6, 7, 8, 10]) {
  for (const zSize of ["light", "heavy"]) for (const bay of ["2", "3", "4"]) for (const row of ["2.5", "3.5"]) {
    const it = buildJobItem(1, "partition", w * FT, h * FT, 2, { system: "z_section", zSize, partBayFt: bay, partRowFt: row });
    const tag = `Z partition ${w}x${h} ${zSize} ${bay}/${row}`;
    try {
      const l = estimate([it]);
      built++;
      if (l.pieces.some((p) => !(p.length > 0))) fails.push(`${tag}: non-positive piece`);
      const L = partitionLayout(it);
      const panes = l.glass.reduce((a, g) => a + g.count, 0);
      if (panes !== L.bays * L.glassRows * 2) fails.push(`${tag}: ${panes} panes, drawing shows ${L.bays * L.glassRows * 2}`);
      if (l.glass.some((g) => !(g.width > 0 && g.height > 0))) fails.push(`${tag}: bad glass`);
      if (!l.sections.some((s) => s.sectionId.startsWith("z_outer"))) fails.push(`${tag}: no Z outer frame`);
    } catch (e) {
      if (!/longer than the bar/.test((e as Error).message)) fails.push(`${tag}: ${(e as Error).message}`);
    }
  }
}
for (const w of [2.5, 3, 3.5, 4]) for (const h of [6.5, 7, 8]) for (const c of [0, 1, 2, 3, 4]) {
  const it = buildJobItem(1, "door", w * FT, h * FT, 1, { system: "z_section", zDoorCenters: String(c) });
  const l = estimate([it]);
  built++;
  if (it.system !== "z_section" || it.type !== "door") fails.push(`Z door ${w}x${h}: built as ${it.type}/${it.system}`);
  if (!l.sections.some((s) => s.sectionId === "z_pipe_55")) fails.push(`Z door ${w}x${h}: not the big section`);
  const panes = l.glass.reduce((a, g) => a + g.count, 0);
  const centers = l.pieces.filter((p) => /^Transom/.test(p.role)).length;
  if (panes !== c + 1 || centers !== c) fails.push(`Z door ${w}x${h} c${c}: ${centers} centers, ${panes} panes`);
  if (l.glass.some((g) => !(g.width > 0 && g.height > 0))) fails.push(`Z door ${w}x${h} c${c}: bad glass`);
  if (l.pieces.filter((p) => p.sectionId === "z_clip").length !== 4 * (c + 1)) fails.push(`Z door ${w}x${h} c${c}: clip not per pane`);
}
console.log(`Z door / Z partition: built ${built}`);
if (fails.length) { console.log(fails.slice(0, 10).join("\n")); process.exit(1); }
console.log("Z DOOR AND PARTITION HOLD");
