/**
 * The Studio's Z-section templates must cut exactly like the engine's
 * founder-verified Z-section openable windows (1–4 sashes, light and heavy).
 *   npx tsx evals/studio/z-parity.ts
 */
import { deriveItem } from "../../lib/engine/sheet-seed";
import { estimate } from "../../lib/engine/estimator";
import { evaluate } from "../../lib/studio/evaluate";
import { Z_40, Z_55 } from "../../lib/studio/templates";

const FT = 304800, IN = 25400;
const sizes: [number, number][] = [[4 * FT, 4 * FT], [6 * FT + 3 * IN + 3175, 4 * FT + 7 * IN], [3 * FT + 2 * IN, 5 * FT], [9 * FT, 5 * FT]];
const fails: string[] = []; let n = 0;
for (const [zSize, sys] of [["light", Z_40], ["heavy", Z_55]] as const) {
  for (const [w, h] of sizes) for (const sashes of [1, 2, 3, 4]) {
    const item = deriveItem("W1", "window", w, h, 1, { system: "z_section", zSize, zType: "openable", zSashCount: String(sashes) });
    const r = estimate([item]);
    const a = [...r.pieces.map((p) => `${p.sectionId} ${p.length} ${p.role}`).sort(),
      ...(() => { const m = new Map<string, number>(); r.glass.forEach((g) => m.set(`${g.width}x${g.height}`, (m.get(`${g.width}x${g.height}`) ?? 0) + g.count)); return [...m].map(([k, c]) => `glass ${k} x${c}`); })()];
    const s = evaluate(sys, { id: "W1", W: w, H: h, qty: 1, tracks: sashes, mix: "G".repeat(sashes) });
    const b = [...s.pieces.map((p) => `${p.sectionId} ${p.length} ${p.role}`).sort(), ...s.panels.map((p) => `glass ${p.w}x${p.h} x${p.count}`)];
    n++;
    if (a.join("\n") !== b.join("\n")) {
      const i = a.findIndex((x, k) => x !== b[k]);
      fails.push(`${zSize} ${sashes} sash ${w}x${h}\n   engine: ${a[i]}\n   studio: ${b[i]}`);
    }
  }
}
if (fails.length) { console.error(`Z parity FAILED ${fails.length}/${n}`); fails.slice(0, 8).forEach((f) => console.error(" ✗ " + f)); process.exit(1); }
console.log(`Z parity: ${n} openable windows identical to the engine (Z 40 + Z 55).`);
