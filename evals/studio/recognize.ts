/**
 * The section recogniser must know the sections whose job the founder or the
 * catalogue name settles.
 *   npx tsx evals/studio/recognize.ts
 */
import { readFileSync } from "node:fs";
import { recognize, type SectionRole } from "../../lib/studio/recognize";

const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "banuhashim", "banuhashim-euro"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));

const KNOWN: [string, SectionRole, string][] = [
  ["2046", "glass-shutter", "OMEO domal glass shutter"],
  ["2081", "mesh-shutter", "OMEO domal jali shutter (founder)"],
  ["41050", "mesh-shutter", "Ample 29 jali shutter (founder)"],
  ["41055", "glass-shutter", "Ample 29 shutter"],
  ["41074", "mesh-shutter", "Ample 37 jali shutter (founder)"],
  ["41085", "mesh-shutter", "Ample mini domal jali shutter (founder)"],
  ["41310-37", "mesh-shutter", "Ample 37 jali shutter 41310 (founder)"],
  ["214315", "glass-shutter", "Ample domal shutter"],
  ["41076", "double-glass-shutter", "Ample 37 double glass shutter (founder)"],
  ["BH-6407", "double-glass-shutter", "BH 31 double glass shutter"],
  ["2062", "track", "OMEO domal 3-track"],
  ["BH-6001", "track", "Euro 3-track (founder)"],
  ["BH-2551", "track", "Gulf 25 top / bottom"],
  ["BH-6500", "side-track", "Gulf 35 side, one groove (founder)"],
  ["BH-2559", "clip", "Euro roller clip (founder)"],
  ["BH-6408", "slim-interlock", "31 mm slim interlock"],
  ["BH-2556", "slim-interlock", "Gulf 25 slim interlock"],
];

const fails: string[] = [];
for (const [code, want, what] of KNOWN) {
  const r = recognize(book[code]);
  console.log(`  ${code.padEnd(8)} ${r.role.padEnd(15)} ${what}`);
  if (r.role !== want) fails.push(`${code} (${what}) read as ${r.role}: ${r.why}`);
}
if (fails.length) { console.error(`\nrecognize: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log(`recognize: ${KNOWN.length} known sections recognised by shape ✓`);
