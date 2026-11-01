/** Z-section fixed in the middle: openable | fixed | openable, the shutter
 *  count asked per side. */
import { buildJobItem } from "../../lib/engine/quick-item";
import { zGeometry, estimate } from "../../lib/engine/estimator";
import { feet } from "../../lib/engine/units";

let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.error("FAIL", msg); } };
for (const each of [1, 2]) {
  const it = buildJobItem(1, "window", feet(8), feet(5), 1,
    { system: "z_section", zType: "combo", zComboDir: "center", zFixedFt: "3", zSashCount: String(each) });
  const g = zGeometry(it);
  check(it.shutters.length === 2 * each, `${each}/side: item carries ${2 * each} shutters`);
  check(g.sashes.length === 2 * each, `${each}/side: ${2 * each} sashes built`);
  check(g.fixed.length === 1, `${each}/side: one fixed pane`);
  check(estimate([it]).bars.length > 0, `${each}/side: estimates`);
}
if (fails) { console.error(`${fails} failures`); process.exit(1); }
console.log("Z MIDDLE FIX HOLDS");
