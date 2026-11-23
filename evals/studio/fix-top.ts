/**
 * Fixed glass on top (founder 2026-11-23): a shop's own copy of Domal 27 or Normal 18 takes the
 * same fixed top as the built-in one, with the same cuts and glass; other systems never do.
 */
import { estimate } from "../../lib/engine/estimator";
import { buildJobItem } from "../../lib/engine/quick-item";
import { registerStudioSystems, takesFixTop } from "../../lib/studio/runtime";
import { TEMPLATES } from "../../lib/studio/templates";
import { feet } from "../../lib/engine/units";
import { registerProfiles } from "../../lib/studio/store";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
const copyOf = (id: string) => ({ ...structuredClone(TEMPLATES.find((t) => t.id === id)!), id: `mine-${id}`, basedOn: { id, version: 1 } });
const mine = [copyOf("domal-27"), copyOf("normal-18"), copyOf("euro-27")];
registerProfiles([]);
registerStudioSystems(mine);

const cutsOf = (system: string, fix: boolean, extra: Record<string, string> = {}) => {
  const it = buildJobItem(1, "window", feet(6), feet(6), 2, { system, tracks: "3", mix: "GGJ", ...extra, ...(fix ? { domalFix: "yes", domalFixFt: "2" } : {}) });
  const l = estimate([it]);
  return {
    cuts: l.pieces.filter((p) => p.itemId === "W1.1").map((p) => `${p.sectionId} ${p.length}`).sort().join(),
    glass: l.glass.map((g) => `${g.width}x${g.height}x${g.count}`).sort().join(),
  };
};

// Domal 27: the shop's copy cuts exactly as the built-in, fixed top and all
const eng = cutsOf("domal", true), own = cutsOf("studio:mine-domal-27", true);
check(own.cuts === eng.cuts, "Domal 27 copy: same cuts as the built-in with a fixed top");
check(own.glass === eng.glass, "Domal 27 copy: same glass, the fixed pane included");
check(cutsOf("studio:mine-domal-27", false).glass !== own.glass, "without the fixed top the shutters are full height");

// Normal 18 copy: the fixed band and its glass are there
const n = cutsOf("studio:mine-normal-18", true);
check(/partition_frame/.test(n.cuts) && /glazing_clip/.test(n.cuts), "Normal 18 copy: SP band and clip");
check(n.glass.split(",").length === cutsOf("studio:mine-normal-18", false).glass.split(",").length + 1, "Normal 18 copy: one more glass, the fixed pane");

// a system not built that way is never given one
check(!takesFixTop(mine[2]), "Euro 27 does not take a fixed top");
check(!/partition_frame/.test(cutsOf("studio:mine-euro-27", true).cuts), "Euro 27: a stray fixed-top choice adds nothing");

if (fails) process.exit(1);
console.log("fixed top: a shop's Domal 27 / Normal 18 copy cuts as the built-in ✓");
