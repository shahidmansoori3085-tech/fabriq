/**
 * Choices a window keeps (founder 2026-11-23, "find every measurement mistake"):
 *  - the job's 90° / 45° cutting stays on a window that is edited or added
 *  - a system the shop set to 45° (or 66% opening) cuts that way unless the job says otherwise
 *  - built-in Domal and Z frames and shutters are marked 45°, as their Studio copies are
 */
import { estimate } from "../../lib/engine/estimator";
import { buildJobItem } from "../../lib/engine/quick-item";
import { registerStudioSystems, studioJobOf } from "../../lib/studio/runtime";
import { registerProfiles } from "../../lib/studio/store";
import { TEMPLATES, withJoint } from "../../lib/studio/templates";
import { jobMeta } from "../../lib/engine/sections";
import { evaluate as evaluateStudio } from "../../lib/studio/evaluate";
import { feet } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
registerProfiles([]);

// the job's cutting and pipes travel to an added or edited window
const m = jobMeta([{ meta: { joint: "45", sash: "45", pipe_handle_std: "15" } }, { meta: { joint: "45", sash: "45" } }]);
check(m.joint === "45" && m.sash === "45" && m.pipe_handle_std === "15", "job's 45° and pipe length carried");
check(!("joint" in jobMeta([{ meta: { joint: "45" } }, { meta: { joint: "90" } }])), "mixed windows: nothing forced on a new one");

// a shop's Normal 18 set to 45° track cutting: new windows cut at 45°, a window set to 90° stays 90°
const own = withJoint({ ...structuredClone(TEMPLATES.find((t) => t.id === "normal-18")!), id: "mine-n18", basedOn: { id: "normal-18", version: 1 } });
own.switches = own.switches.map((s) => (s.id === "joint" ? { ...s, default: "45" } : s));
registerStudioSystems([own]);
const win = (meta: Record<string, string>) => buildJobItem(1, "window", feet(5), feet(4), 1, { system: "studio:mine-n18", tracks: "2", mix: "GG", ...meta });
const topOf = (meta: Record<string, string>) => estimate([win(meta)]).pieces.find((p) => /^Top/.test(p.role))!;
check(studioJobOf(win({})).switches?.joint === undefined, "no job choice: the system decides");
check(topOf({}).angle === 45 && topOf({}).length === feet(5), "system set to 45°: top is the full width at 45°");
check(topOf({ joint: "90" }).angle !== 45 && topOf({ joint: "90" }).length < feet(5), "the job's 90° still wins");

// built-in Domal / Z: frames and shutters say 45°; the fixed-top SP and the interlock do not
const dom = estimate([buildJobItem(1, "window", feet(6), feet(6), 1, { system: "domal", tracks: "3", mix: "GGG", domalFix: "yes", domalFixFt: "2" })]).pieces;
check(dom.filter((p) => /^domal_(frame|frame_2t|glass_shutter|jali_shutter)$/.test(p.sectionId)).every((p) => p.angle === 45), "Domal frame and shutters at 45°");
check(dom.filter((p) => p.sectionId === "domal_interlock" || p.sectionId === "partition_frame").every((p) => p.angle !== 45), "Domal interlock and fixed-top SP stay 90°");
const z = estimate([buildJobItem(1, "window", feet(5), feet(4), 1, { system: "z_section", zType: "openable", zSize: "light", zSashCount: "2" })]).pieces;
check(z.filter((p) => /^z_(outer|pipe)_/.test(p.sectionId)).every((p) => p.angle === 45), "Z frame and sashes at 45°");

// a mesh shutter's mesh follows its own meeting side (2026-11-26): slim on the glass leaves the
// mesh as the clip layout; slim put on the mesh too sizes it as the slim
{
  const d27 = TEMPLATES.find((t) => t.id === "domal-27")!;
  const mesh = (s: typeof d27, sw: Record<string, string>) => {
    const r = evaluateStudio(s, { id: "W", W: 72 * 25400, H: 48 * 25400, qty: 1, tracks: 3, mix: "GGJ", switches: sw });
    return [r.panels.find((p) => p.kind === "glass")!.w, r.panels.find((p) => p.kind === "jali")!.w];
  };
  const [gClip, mClip] = mesh(d27, { meet: "clip" });
  const [gSlim, mSlim] = mesh(d27, { meet: "slim", pick_shutterMeet: "el27_slim" });
  const onMesh = { ...d27, parts: d27.parts.map((p) => (p.place === "sash-meet" ? { ...p, meshProfile: "el27_slim" } : p)) };
  const [, mBoth] = mesh(onMesh, { meet: "slim", pick_shutterMeet: "el27_slim" });
  check(gClip === mClip, `clip: mesh = glass (${mClip} vs ${gClip})`);
  check(mSlim === mClip && gSlim > mSlim, `slim on glass only: mesh stays the clip size (${mSlim}, glass ${gSlim})`);
  check(mBoth === gSlim, `slim on the mesh too: mesh = slim glass size (${mBoth} vs ${gSlim})`);
}

if (fails) process.exit(1);
console.log("job choices: 45° and pipes kept on edit, system defaults honoured, Domal / Z mitres shown ✓");
