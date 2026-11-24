/**
 * Pipe lengths on the material list (founder 2026-11-22): any length by the foot or typed;
 * the cut piece has no setting of its own, it is always what the cuts need.
 */
import { estimate } from "../../lib/engine/estimator";
import { buildJobItem } from "../../lib/engine/quick-item";
import { readPipeFt, stepPipeFt, pipeText, pipeMark } from "../../lib/engine/pipe";
import { setJobBarLengths, jobBarLengths, pipeMeta } from "../../lib/engine/sections";
import { feet } from "../../lib/engine/units";
import { packSection, stockGroups } from "../../lib/engine/cutting";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };

// typed lengths
const read: [string, "ft" | "in", number | null][] = [
  ["16", "ft", 16], ["15.6", "ft", 15.5], ["15.10", "ft", 15 + 10 / 12], ["186", "in", 15.5], ["186.4", "in", 186.5 / 12],
  ["16 ft", "in", 16], ["186 in", "ft", 15.5], ["31", "ft", null], ["186", "ft", null], ["15.12", "ft", null], ["0", "ft", null], ["abc", "ft", null],
];
for (const [raw, unit, want] of read) {
  const got = readPipeFt(raw, unit);
  check(want === null ? got === null : got !== null && Math.abs(got - want) < 1e-6, `read "${raw}" ${unit}: ${got}`);
}
check(stepPipeFt(16, 1) === 17 && stepPipeFt(16, -1) === 15 && stepPipeFt(30, 1) === 30 && stepPipeFt(1, -1) === 1, "steps 1 ft");
check(pipeText(15.5) === "15 ft 6 in" && pipeMark(15.5) === `15'6"`, "15 ft 6 in");

// 4 windows 5×4, 3 track: the list follows the pipe
const job = [buildJobItem(1, "window", feet(5), feet(4), 4, { system: "normal", tracks: "3" })];
const buy = (sid: string, ft?: number) => {
  const items = ft ? job.map((it) => ({ ...it, meta: { ...it.meta, [`pipe_${sid}`]: String(ft) } })) : job;
  setJobBarLengths(jobBarLengths(items));
  const g = estimate(items).sections.find((s) => s.sectionId === sid)!.stock[0];
  return `${g.full}+${g.pieces.join()}`;
};
for (const [sid, ft, want] of [
  ["3t_top", undefined, "3+5"], ["3t_top", 17, "3+4"], ["3t_top", 15, "3+13"],
  ["3t_bottom", undefined, "1+5"], ["3t_bottom", 19, "1+5"], ["3t_bottom", 20, "1+"],
] as const) check(buy(sid, ft) === want, `${sid} ${ft ?? 16} ft: ${buy(sid, ft)}, want ${want}`);
check(pipeMeta([{ meta: { pipe_bearing: "15.5" } }]).pipe_bearing === "15.5", "an edited window keeps the job's pipes");
setJobBarLengths({});

// a founder's 6-window Domal job (2026-11-24): the cutter fills a pipe with one 56⅜″, three 29½″
// and two 23″ — 16 pipes + a 9 ft piece of glass shutter, where the app had bought 17 + 4 ft
{
  const mk = (l: number, n: number) => Array.from({ length: n }, (_, i) => ({ sectionId: "domal_glass_shutter", length: Math.round(l * 25400), itemId: "W", role: `p${l}-${i}`, angle: 45 as const, label: "" }));
  const g = stockGroups("domal_glass_shutter", packSection("domal_glass_shutter", [...mk(56.375, 36), ...mk(29.5, 18), ...mk(24, 6), ...mk(23, 12)]));
  const ft = g.reduce((a, x) => a + x.full * x.ft + x.pieces.reduce((s, p) => s + p, 0), 0);
  check(ft <= 16 * 16 + 9, `6-window Domal glass shutter: ${JSON.stringify(g)}, want 16 pipes + 9 ft at most`);
}

if (fails) process.exit(1);
console.log("pipe lengths: typed, stepped by the foot, the piece is what the cuts need ✓");
