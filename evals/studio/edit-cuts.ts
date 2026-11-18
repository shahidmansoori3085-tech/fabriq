/**
 * Changes made on the drawing (founder 2026-11-17): − / + moves a cut one sut,
 * "Change only this pipe" splits a shared length, and the mesh shutter can take
 * the handle pipe on its meeting side.
 */
import { evaluate, jobVars, computeSizes } from "../../lib/studio/evaluate";
import { NORMAL_18, DOMAL_27, withJoint } from "../../lib/studio/templates";
import { bumpCut, bumpSize, ownCut, setCut } from "../../lib/studio/edit";
import { UM_PER_SUT, inches } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
const sys = withJoint(NORMAL_18);
const job = { id: "W1", W: inches(60), H: inches(48), qty: 1, tracks: 2, mix: "GJ" };
const vars = jobVars(sys, job);
const cut = (s: typeof sys, re: RegExp) => evaluate(s, job).pieces.find((p) => re.test(p.role))!.length;
const part = (id: string) => sys.parts.find((p) => p.id === id)!;

// + 2 sut on the handle moves the shutter height: handle and interlock both
const a = bumpCut(sys, part("handle"), 2 * UM_PER_SUT, vars);
check(cut(a, /S1 Handle/) === cut(sys, /S1 Handle/) + 2 * UM_PER_SUT, "handle +2 sut");
check(cut(a, /S1 Interlock/) === cut(sys, /S1 Interlock/) + 2 * UM_PER_SUT, "interlock moves with it (same length)");

// only this pipe: the interlock keeps its cut
const b = bumpCut(ownCut(sys, ["handle"]), { ...part("handle"), length: "shutterH_handle" }, -1 * UM_PER_SUT, vars);
check(cut(b, /S1 Handle/) === cut(sys, /S1 Handle/) - UM_PER_SUT, "own handle −1 sut");
check(cut(b, /S1 Interlock/) === cut(sys, /S1 Interlock/), "interlock unchanged");

// a piece cut to the full side gets its own size, then moves
const raw = { ...sys, parts: sys.parts.map((p) => (p.id === "left" || p.id === "right" ? { ...p, length: "H" } : p)) };
const c = bumpCut(raw, { ...part("left"), length: "H" }, -UM_PER_SUT, vars);
check(cut(c, /^Left Side$/) === job.H - UM_PER_SUT && cut(c, /^Right Side$/) === job.H, "left side −1 sut, right unchanged");

// glass width + 1 sut
const d = bumpSize(sys, "glassW", UM_PER_SUT, vars);
const gw = (s: typeof sys) => evaluate(s, job).panels.find((p) => p.kind === "glass")!.w;
check(gw(d) === gw(sys) + UM_PER_SUT, "glass width +1 sut");

// mesh shutter with the handle pipe on its meeting side
const e = { ...sys, parts: sys.parts.map((p) => (p.id === "interlock" ? { ...p, meshProfile: "handle_std" } : p)) };
const s2 = evaluate(e, job).pieces.filter((p) => /^S2/.test(p.role));
check(s2.filter((p) => p.sectionId === "handle_std").length === 2 && !s2.some((p) => p.sectionId === "interlock"), "mesh shutter: handle on both sides");
check(evaluate(e, job).pieces.some((p) => /^S1 Interlock/.test(p.role) && p.sectionId === "interlock"), "glass shutter keeps its interlock");

// a typed cut: the rule gives exactly that cut on this window, and moves with the size after
const vals = computeSizes(sys, job).values;
const t = setCut(sys, part("handle"), inches(46) + 5 * UM_PER_SUT, vars, vals);
check(cut(t, /S1 Handle/) === inches(46) + 5 * UM_PER_SUT, "typed handle 46.5");
check(evaluate(t, { ...job, H: inches(60) }).pieces.find((x) => /S1 Handle/.test(x.role))!.length === inches(58) + 5 * UM_PER_SUT, "typed cut follows a taller window");

// interlock clip on a mesh shutter: off by default (glass meetings only), on when the shop clips it too
const dj = { id: "D1", W: inches(72), H: inches(60), qty: 1, tracks: 3, mix: "GGJ" };
const clips = (s: typeof DOMAL_27) => evaluate(s, dj).pieces.filter((x) => s.parts.find((q) => q.scope === "meeting" && x.role.startsWith(q.role.replace(/s*{k}/, ""))) ).length;
const meetId = DOMAL_27.parts.find((q) => q.scope === "meeting")!.id;
const on = { ...DOMAL_27, parts: DOMAL_27.parts.map((q) => (q.id === meetId ? { ...q, onMesh: true } : q)) };
check(clips(on) === clips(DOMAL_27) * 2, `clip on mesh: ${clips(DOMAL_27)} → ${clips(on)}`);

if (fails) process.exit(1);
console.log("drawing edits: − / + by the sut, own length, mesh handle ✓");
