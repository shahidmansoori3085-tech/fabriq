/**
 * Normal sliding cut at 45° (founder 2026-11-17), chosen on the cutting sheet:
 *  - frame 45°: top, bottom and sides all full length (W, H), mitred
 *  - shutter 45°: handle pipe top and bottom too, full shutter width, mitred;
 *    handle / interlock / shutter width unchanged; glass height loses what its width loses
 * The built-in engine and the Studio Normal 18 must agree on every piece.
 */
import { buildJobItem } from "../../lib/engine/quick-item";
import { expandItem, estimate, DEFAULTS } from "../../lib/engine/estimator";
import { feet, mm } from "../../lib/engine/units";
import { evaluate } from "../../lib/studio/evaluate";
import { NORMAL_18, withJoint } from "../../lib/studio/templates";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
const SYS = withJoint(NORMAL_18);

for (const tracks of ["2", "3"]) {
  for (const joint of ["90", "45"]) for (const sash of ["90", "45"]) {
    const it = buildJobItem(1, "window", feet(5), feet(4), 1, { system: "normal", tracks });
    if (joint === "45") it.meta.joint = "45";
    if (sash === "45") it.meta.sash = "45";
    const base = buildJobItem(1, "window", feet(5), feet(4), 1, { system: "normal", tracks });
    const p = expandItem(it), b = expandItem(base);
    const one = (ps: typeof p, re: RegExp) => ps.find((x) => re.test(x.role))!;
    const tag = `${tracks}T frame ${joint} shutter ${sash}`;

    // frame
    check(one(p, /^Top$/).length === (joint === "45" ? it.width : one(b, /^Top$/).length), `${tag}: top`);
    check(p.filter((x) => /^(Top|Bottom|Left Side|Right Side)$/.test(x.role)).every((x) => (x.angle ?? 90) === +joint), `${tag}: frame angle`);
    // shutter
    check(one(p, /Handle/).length === one(b, /Handle/).length, `${tag}: same handle`);
    const top = one(p, /S1 (Bearing|Shutter) Top/);
    check(sash === "45" ? top.sectionId === "handle_std" && top.length === one(b, /Bearing Top/).length + DEFAULTS.bearingDeduction
      : top.sectionId === "bearing" && top.length === one(b, /Bearing Top/).length, `${tag}: shutter top/bottom`);
    check(p.filter((x) => /^S\d/.test(x.role)).every((x) => (x.angle ?? 90) === +sash), `${tag}: shutter angle`);
    const g = estimate([it]).glass[0], gb = estimate([base]).glass[0];
    check(g.width === gb.width && g.height === gb.height + (sash === "45" ? DEFAULTS.glassDeductionH - DEFAULTS.glassDeductionW : 0), `${tag}: glass`);
    check(Math.abs(DEFAULTS.glassDeductionH - DEFAULTS.glassDeductionW - mm(2.55)) < 5, "glass height gain 2.55 mm");

    // studio agrees
    const r = evaluate(SYS, { id: it.id, W: it.width, H: it.height, qty: 1, tracks: +tracks, mix: it.shutters.map((s) => (s.kind === "jali" ? "J" : "G")).join(""), switches: { mode: "half", joint, sash } });
    const key = (x: { sectionId: string; length: number; role: string; angle?: number }) => `${x.sectionId} ${x.length} ${x.role} ${x.angle ?? 90}`;
    const a = p.map(key).sort().join("\n"), s = r.pieces.map(key).sort().join("\n");
    check(a === s, `${tag}: studio = engine\n${a}\n---\n${s}`);
    const sg = r.panels.find((x) => x.kind === "glass")!;
    check(sg.w === g.width && sg.h === g.height, `${tag}: studio glass ${sg.w}x${sg.h} vs ${g.width}x${g.height}`);
  }
}
if (fails) process.exit(1);
console.log("NORMAL 45° FRAME + SHUTTER HOLD");
