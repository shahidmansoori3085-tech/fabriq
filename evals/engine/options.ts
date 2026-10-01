/**
 * Every path a fabricator can tap through the question flow must end in a
 * buildable opening. Walks the whole question tree (answering each option in
 * turn) for every system at a spread of sizes, builds each leaf and runs the
 * estimate. An option the app OFFERS that cannot be built is a trap.
 *
 *   npx tsx evals/engine/options.ts
 */
import { generateQuestions } from "../../lib/engine/questions";
import { deriveItem } from "../../lib/engine/sheet-seed";
import { estimate, ImpossibleLayoutError } from "../../lib/engine/estimator";
import { PieceTooLongError } from "../../lib/engine/cutting";
import { formatFtInSut } from "../../lib/engine/units";
import type { OpeningType } from "../../lib/engine/types";

const FT = 304800;
type Start = { type: OpeningType; known: Record<string, string>; label: string };
const starts: Start[] = [
  { type: "window", known: { system: "normal" }, label: "Normal" },
  { type: "window", known: { system: "domal" }, label: "Domal" },
  { type: "window", known: { system: "z_section", zSize: "light" }, label: "Z" },
  { type: "window", known: { system: "z_section", zSize: "light", zType: "row", zAxis: "cols", zOrder: "F,O,F" }, label: "Z row F,O,F" },
  { type: "window", known: { system: "z_section", zSize: "light", zType: "row", zAxis: "cols", zOrder: "O,F,O" }, label: "Z row O,F,O" },
  { type: "door", known: { chokhat: "needed", palla: "60" }, label: "Door" },
  { type: "partition", known: {}, label: "Partition" },
];
const sizes = [[2, 3], [3, 3], [3, 4], [4, 4], [4, 5], [6, 5], [3, 7], [10, 8]];

let leaves = 0, traps = 0, tooLong = 0, sheetForced = 0;
const trapList = new Map<string, number>();
const examples: string[] = [];

function walk(s: Start, w: number, h: number, known: Record<string, string>, depth: number, path: string[]) {
  const qs = generateQuestions({ type: s.type, width: w, height: h, qty: 1, known });
  if (!qs.length || depth > 12) {
    leaves++;
    try { estimate([deriveItem("W1", s.type, w, h, 1, known)]); }
    catch (e) {
      if (e instanceof PieceTooLongError) { tooLong++; return; }
      if (e instanceof ImpossibleLayoutError) {
        // the SHEET drew a layout that cannot fit, and every size question was
        // already at its only/smallest answer — refusing is the right outcome
        if (s.known.zOrder && path.every((p) => p.endsWith("(only)"))) { sheetForced++; return; }
        traps++;
        const key = `${s.label}: ${path.join(" → ")}`.replace(/=\d+(\.\d+)?/g, "=N");
        trapList.set(key, (trapList.get(key) ?? 0) + 1);
        if (examples.length < 12) examples.push(`${formatFtInSut(w)}x${formatFtInSut(h)} ${s.label}: ${path.join(", ")} → ${e.part}`);
        return;
      }
      throw e;
    }
    return;
  }
  const q = qs[0];
  // an only-option list is the fallback "nothing fits" — still walk it, but tag it
  for (const o of q.options) walk(s, w, h, { ...known, [q.id]: o.value }, depth + 1, [...path, `${q.id}=${o.value}${q.options.length === 1 ? "(only)" : ""}`]);
}

for (const s of starts) for (const [wf, hf] of sizes) walk(s, wf * FT, hf * FT, { ...s.known }, 0, []);

console.log(`question paths walked: ${leaves}, too long (needs a joint): ${tooLong}, sheet-drawn layout that cannot fit (refused, correct): ${sheetForced}, offered-but-unbuildable: ${traps}`);
if (traps) {
  console.log("\nExamples:"); for (const e of examples) console.log("  " + e);
  process.exit(1);
}
console.log("EVERY OFFERED PATH BUILDS");
