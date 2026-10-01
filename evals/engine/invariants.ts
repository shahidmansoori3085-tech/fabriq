/**
 * Engine invariants over thousands of generated openings — no AI involved.
 * Things that must hold for ANY input the app can build, or the material list
 * is wrong in a way no single hand-picked example would show.
 *
 *   npx tsx evals/engine/invariants.ts
 */
import { deriveItem } from "../../lib/engine/sheet-seed";
import { estimate, ImpossibleLayoutError } from "../../lib/engine/estimator";
import { PieceTooLongError } from "../../lib/engine/cutting";
import { reviewEstimate } from "../../lib/engine/review";
import { formatFtInSut } from "../../lib/engine/units";
import type { JobItem, OpeningType } from "../../lib/engine/types";

const FT = 304800;
const fails = new Map<string, string[]>();
const fail = (rule: string, detail: string) => {
  const l = fails.get(rule) ?? []; if (l.length < 6) l.push(detail); fails.set(rule, l);
  counts.set(rule, (counts.get(rule) ?? 0) + 1);
};
const counts = new Map<string, number>();
let built = 0, tooLong = 0, refused = 0;

const sizes = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15].map((f) => Math.round(f * FT));
type Combo = { type: OpeningType; known: Record<string, string>; label: string };
const combos: Combo[] = [];
for (const mix of ["GG", "GJ", "JJ", "GS", "SS"]) combos.push({ type: "window", known: { system: "normal", tracks: "2", mix }, label: `2T ${mix}` });
for (const mix of ["GGJ", "GGG", "GJJ", "SGJ"]) combos.push({ type: "window", known: { system: "normal", tracks: "3", mix }, label: `3T ${mix}` });
for (const fix of ["no", "yes"]) for (const mix of ["GG", "GJ", "GGJ"]) {
  combos.push({ type: "window", known: { system: "domal", tracks: String(mix.length), mix, domalFix: fix, ...(fix === "yes" ? { domalFixFt: "2" } : {}) }, label: `Domal ${mix} fix:${fix}` });
}
for (const zt of <Record<string, string>[]>[{ zType: "fixed" }, { zType: "openable", zSashCount: "1" }, { zType: "openable", zSashCount: "2" }, { zType: "openable", zSashCount: "3" }, { zType: "door" },
  { zType: "row", zAxis: "cols", zPanels: "F2,O,F2" }, { zType: "row", zAxis: "cols", zPanels: "O,F1.5,O" }, { zType: "row", zAxis: "rows", zPanels: "F1.5,O" }]) {
  for (const zSize of ["light", "heavy"]) combos.push({ type: "window", known: { system: "z_section", zSize, ...zt }, label: `Z ${JSON.stringify(zt)} ${zSize}` });
}
for (const rails of ["2", "3"]) for (const chokhat of ["needed", "existing"]) for (const palla of ["50", "60", "75"]) {
  combos.push({ type: "door", known: { rails, chokhat, palla, zonemix: rails === "3" ? "SSSJ" : "SSJ" }, label: `Door r${rails} ${chokhat} ${palla}` });
}
for (const partDoor of ["no", "yes"]) for (const sheet of ["0", "2"]) for (const bay of ["2", "3"]) {
  combos.push({ type: "partition", known: { partDoor, ...(partDoor === "yes" ? { partDoorW: "3" } : {}), partSheetFt: sheet, partBayFt: bay, partRowFt: "3" }, label: `Partition door:${partDoor} sheet:${sheet} bay:${bay}` });
}

for (const c of combos) for (const w of sizes) for (const h of sizes) {
  const sz = `${formatFtInSut(w)}x${formatFtInSut(h)} ${c.label}`;
  const one = deriveItem("W1", c.type, w, h, 1, c.known);
  let list1;
  try { list1 = estimate([one]); } catch (e) {
    if (e instanceof PieceTooLongError) {
      tooLong++;
      // legitimate only when the opening itself is longer than that section's bar
      // (glazing clip, for one, is sold in 12ft) — a piece longer than the
      // opening it belongs to would be a formula bug
      if (e.piece.length > Math.max(w, h) + 2 * FT) fail("cut piece longer than its opening", `${sz}: ${e.piece.role} ${formatFtInSut(e.piece.length)}`);
      continue;
    }
    if (e instanceof ImpossibleLayoutError) {
      refused++;
      // refusing is right only when something FIXED (fix panels, fix band,
      // sheet band) can outgrow the opening — a plain layout must always build
      const hasFixedPart = /F/.test(c.known.zPanels ?? "") || c.known.domalFix === "yes" || parseFloat(c.known.partSheetFt ?? "0") > 0 || c.known.zType === "openable" || c.type === "door" || c.known.partDoor === "yes";
      // buildable for sure: every fixed part leaves a clear 1.5ft+ for the rest
      const fixSum = (c.known.zPanels ?? "").split(",").filter((p) => p.startsWith("F")).reduce((t, p) => t + parseFloat(p.slice(1)), 0) * FT;
      const along = c.known.zAxis === "rows" ? h : w;
      const band = (parseFloat(c.known.domalFixFt ?? "0") + parseFloat(c.known.partSheetFt ?? "0")) * FT;
      const doorW = c.known.partDoor === "yes" ? parseFloat(c.known.partDoorW ?? "3") * FT : 0;
      const sashes = parseInt(c.known.zSashCount ?? "1", 10);
      const plausible = along - fixSum >= 1.5 * FT * Math.max(1, (c.known.zPanels ?? "").split(",").filter((p) => p === "O").length)
        && h - band >= 2 * FT && w - doorW >= 1.5 * FT * sashes && Math.min(w, h) >= 2 * FT && (c.type !== "door" || (h >= 6 * FT && w >= 2 * FT));
      if (!hasFixedPart || plausible) fail("refused a layout that should build", `${sz}: ${e.part} ${formatFtInSut(e.size)}`);
      continue;
    }
    fail("estimate threw", `${sz}: ${(e as Error).message}`); continue;
  }
  built++;
  // An impossible input (2ft fixed band on a 1ft window) is a validation gap;
  // a negative length on a real-world size is an engine bug — keep them apart.
  const realistic = c.type === "door" ? h >= 6 * FT && w >= 2 * FT : Math.min(w, h) >= 2 * FT && (!c.known.domalFixFt || h >= 4 * FT);
  const tag = realistic ? "REAL-SIZE" : "impossible-input";
  for (const p of list1.pieces) if (!(p.length > 0)) fail(`[${tag}] cut piece with zero/negative length (${c.label.split(" ")[0]})`, `${sz}: ${p.role} ${formatFtInSut(p.length)}`);
  for (const b of list1.bars) {
    const used = b.pieces.reduce((a, p) => a + p.length, 0);
    // cutting.ts allows 15mm over nominal (fabricator-confirmed: bars run long)
    if (used > b.barLength + 15000) fail("bar holds more than its length", `${sz}: bar ${b.sectionId} ${used} > ${b.barLength}`);
  }
  const panels = [...list1.glass.map((p) => ["glass", p] as const), ...list1.mesh.panels.map((p) => ["mesh", p] as const), ...list1.sheet.panels.map((p) => ["sheet", p] as const)];
  for (const [k, p] of panels) if (!(p.width > 0 && p.height > 0)) fail(`[${tag}] ${k} panel with zero/negative size (${c.label.split(" ")[0]})`, `${sz}: ${formatFtInSut(p.width)}x${formatFtInSut(p.height)}`);
  if (c.type === "window" && c.known.mix && c.known.system !== "z_section") {
    const sheets = list1.sheet.panels.reduce((a, p) => a + p.count, 0);
    const wantSheets = [...c.known.mix].filter((x) => x === "S").length;
    if (sheets !== wantSheets) fail("sheet shutters ordered != sheet in mix", `${sz}: ordered ${sheets}, mix has ${wantSheets}`);
  }
  try { reviewEstimate([one], list1); } catch (e) { fail("review threw", `${sz}: ${(e as Error).message}`); }

  if (w === 4 * FT && h === 5 * FT) {
    const five = deriveItem("W1", c.type, w, h, 5, c.known);
    try {
      const list5 = estimate([five]);
      if (list5.pieces.length !== list1.pieces.length * 5) fail("qty 5 != 5x pieces of qty 1", `${sz}: ${list5.pieces.length} vs ${list1.pieces.length}*5`);
      const g1 = list1.glass.reduce((a, p) => a + p.count, 0), g5 = list5.glass.reduce((a, p) => a + p.count, 0);
      if (g5 !== g1 * 5) fail("qty 5 != 5x glass of qty 1", `${sz}: ${g5} vs ${g1}*5`);
    } catch (e) { fail("estimate threw at qty 5", `${sz}: ${(e as Error).message}`); }
  }
}

console.log(`combos ${combos.length} x ${sizes.length * sizes.length} sizes: built ${built}, refused as too long ${tooLong}, refused as impossible ${refused}`);
if (!fails.size) { console.log("ALL INVARIANTS HOLD"); process.exit(0); }
for (const [rule, ex] of fails) {
  console.log(`\nFAIL x${counts.get(rule)}  ${rule}`);
  for (const d of ex) console.log(`   ${d}`);
}
process.exit(1);
