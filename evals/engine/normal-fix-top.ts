/**
 * Normal sliding with a fixed glass on top — built like Domal (founder-
 * confirmed): sliding frame on the zone below, a full SP frame (4 sides) above,
 * glazing clip all round, shutters only as tall as the sliding zone.
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { expandItem, estimate } from "../../lib/engine/estimator";
import { feet } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };

for (const tracks of ["2", "3"]) {
  const plain = buildJobItem(1, "window", feet(6), feet(6), 1, { system: "normal", tracks });
  const fixed = buildJobItem(1, "window", feet(6), feet(6), 1, { system: "normal", tracks, domalFix: "yes", domalFixFt: "2" });
  const pp = expandItem(plain), fp = expandItem(fixed);
  const side = (ps: typeof pp) => ps.find((p) => p.role === "Left Side")!.length;
  const handle = (ps: typeof pp) => ps.find((p) => p.role.includes("Handle"))!.length;
  check(side(fp) === side(pp) - feet(2), `${tracks}T: frame side runs the sliding zone`);
  check(handle(fp) === handle(pp) - feet(2), `${tracks}T: shutters lose the fixed height`);
  check(fp.filter((p) => p.sectionId === "partition_frame").length === 4, `${tracks}T: SP on all 4 sides`);
  check(fp.filter((p) => p.sectionId === "glazing_clip").length === 4, `${tracks}T: clip on 4 sides`);
  check(pp.every((p) => p.sectionId !== "partition_frame" && p.sectionId !== "glazing_clip"), `${tracks}T: plain has no fix pieces`);
  const gp = estimate([plain]).glass.length, gf = estimate([fixed]).glass.length;
  check(gf === gp + 1, `${tracks}T: fixed glass ordered`);
}
// Domal: the same full SP frame on top of the Domal frame.
{
  const d = buildJobItem(1, "window", feet(6), feet(6), 1, { system: "domal", tracks: "2", domalFix: "yes", domalFixFt: "2" });
  const ps = expandItem(d);
  check(ps.filter((p) => p.sectionId === "partition_frame").length === 4, "Domal: SP on all 4 sides");
  check(ps.some((p) => p.role === "Fix Bottom (SP)"), "Domal: SP bottom on the frame top");
  check(ps.filter((p) => p.sectionId === "domal_frame").length === 4, "Domal: its own frame stays whole");
}
if (fails) { console.error(`${fails} failures`); process.exit(1); }
console.log("NORMAL FIXED TOP HOLDS");
