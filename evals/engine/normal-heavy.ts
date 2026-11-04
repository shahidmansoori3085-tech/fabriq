/**
 * Normal Sliding with the heavy 2.5"×3/4" shutter (founder, 2026-11-04):
 * handle, interlock and both bearings are 2.5" instead of 1.5", so glass is
 * 2" less on width and height and the bearing 2" shorter; same track, same
 * shutter height.
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { expandItem, estimate } from "../../lib/engine/estimator";
import { feet, mm } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
const INCH2 = mm(50.8);

for (const tracks of ["2", "3"]) {
  const std = buildJobItem(1, "window", feet(6), feet(5), 1, { system: "normal", tracks });
  const heavy = buildJobItem(1, "window", feet(6), feet(5), 1, { system: "normal", tracks, handle: "25" });
  const sp = expandItem(std), hp = expandItem(heavy);
  const len = (ps: typeof sp, role: string) => ps.find((p) => p.role.includes(role))!.length;
  check(hp.some((p) => p.sectionId === "handle_25") && !hp.some((p) => p.sectionId === "handle_std"), `${tracks}T: heavy handle`);
  check(hp.some((p) => p.sectionId === "interlock_25") && hp.some((p) => p.sectionId === "bearing_25"), `${tracks}T: heavy interlock + bearing`);
  check(len(hp, "Handle") === len(sp, "Handle"), `${tracks}T: same shutter height`);
  check(len(hp, "Bearing Top") === len(sp, "Bearing Top") - INCH2, `${tracks}T: bearing 2" shorter`);
  check(len(hp, "Left Side") === len(sp, "Left Side"), `${tracks}T: same frame`);
  const gs = estimate([std]).glass[0], gh = estimate([heavy]).glass[0];
  check(gh.width === gs.width - INCH2 && gh.height === gs.height - INCH2, `${tracks}T: glass 2" less both ways`);
}
if (fails) process.exit(1);
console.log("NORMAL HEAVY SHUTTER HOLDS");
