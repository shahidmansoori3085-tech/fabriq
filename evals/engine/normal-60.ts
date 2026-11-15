/**
 * Normal sliding with the 2½″ × ¾″ shutter (60 × 19, founder 2026-11-14): the
 * same tracks and shutter height; handle, interlock and bearing are the 60
 * pieces; bearing = shutter − 120 (was − 80); glass 40 mm smaller each way.
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { expandItem, estimate } from "../../lib/engine/estimator";
import { feet, mm } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };

for (const tracks of ["2", "3"]) {
  const std = buildJobItem(1, "window", feet(6), feet(5), 1, { system: "normal", tracks });
  const big = buildJobItem(1, "window", feet(6), feet(5), 1, { system: "normal", tracks, shutterSection: "60" });
  const ps = expandItem(std), pb = expandItem(big);
  const len = (p: typeof ps, role: string) => p.find((x) => x.role.includes(role))!.length;
  check(pb.filter((p) => /Handle/.test(p.role)).every((p) => p.sectionId === "handle_60"), `${tracks}T: 2½″ handle`);
  check(pb.filter((p) => /Interlock/.test(p.role)).every((p) => p.sectionId === "interlock_60"), `${tracks}T: 2½″ interlock`);
  check(pb.filter((p) => /Bearing/.test(p.role)).every((p) => p.sectionId === "bearing_60"), `${tracks}T: 2½″ bearing`);
  check(len(pb, "Handle") === len(ps, "Handle"), `${tracks}T: same shutter height`);
  check(len(pb, "Bearing") === len(ps, "Bearing") - mm(40), `${tracks}T: bearing 40 mm shorter (between 60 handle and 60 interlock)`);
  check(len(pb, "Top") === len(ps, "Top") && len(pb, "Left Side") === len(ps, "Left Side"), `${tracks}T: same frame`);
  const gs = estimate([std]).glass[0], gb = estimate([big]).glass[0];
  check(gb.width === gs.width - mm(40) && gb.height === gs.height - mm(40), `${tracks}T: glass 40 mm smaller each way`);
  check(ps.every((p) => !p.sectionId.endsWith("_60")), `${tracks}T: 1½″ window unchanged`);
}
if (fails) process.exit(1);
console.log("NORMAL 2½″ SHUTTER HOLDS");
