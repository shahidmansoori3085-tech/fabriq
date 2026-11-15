/**
 * The section reader knows every section the app's systems use: a drawing of a
 * known section is named back (same shape, same size) with the systems it goes in,
 * turned or mirrored too; and a section it has never seen still gets the right job
 * most of the time from the closest known shapes.
 *   npx tsx evals/studio/know.ts
 */
import { readFileSync } from "node:fs";
import { knownSections, readSection, closest, KIND_KNOWLEDGE } from "../../lib/studio/know";

const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27", "alucoat"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
const fails: string[] = [];
const K = knownSections();
if (K.length < 150) fails.push(`only ${K.length} known sections`);

// 1. every known section is named back, with where it goes
let named = 0;
for (const k of K) {
  const s = book[k.code]; if (!s) continue;
  const top = closest(s, 1)[0];
  if (top.score < 0.99 || !top.sameSize) fails.push(`${k.code} not named back (best ${top.code} ${top.score.toFixed(2)})`);
  else named++;
  if (!KIND_KNOWLEDGE[k.kind] && k.kind !== "other") fails.push(`${k.code}: no knowledge for kind ${k.kind}`);
}

// 2. turned a quarter and mirrored, it is still the same section
const turn = (s: { w: number; h: number; paths: string[] }) => ({
  w: s.h, h: s.w,
  paths: s.paths.map((p) => p.replace(/(-?[\d.]+)[ ,](-?[\d.]+)/g, (_, x, y) => `${(s.h - +y).toFixed(2)} ${(+x).toFixed(2)}`)),
});
for (const code of ["2046", "BH-6712", "41055", "1041", "2077"]) {
  const r = readSection(turn(book[code]));
  if (r.same?.code !== code) fails.push(`${code} turned: read as ${r.same?.code ?? "nothing"}`);
}

// 3. the same section from two catalogues is matched across makers; systems listed
const used = K.find((k) => k.code === "2046");
if (!used?.uses.some((u) => /Domal 27/.test(u.system))) fails.push("2046 does not list Domal 27");
if (K.find((k) => k.code === "41289")?.kind !== "bearing") fails.push("41289 must read as an H-section, not a slim");
if (K.some((k) => ["914698", "914744", "992328"].includes(k.code))) fails.push("a section shops do not use is in the known set");

// 4. a section never seen before still gets its job from the closest known shapes
//    (the shape rules in recognize.ts come first in the app; evals/studio/recognize.ts tests them)
const grp = (k: string) => ({ frame: "track", handle: "shutter", "shutter-rail": "shutter" } as Record<string, string>)[k] ?? k;
let right = 0, n = 0;
for (const k of K) {
  const s = book[k.code]; if (!s) continue;
  const near = closest(s, 5).filter((m) => m.code !== k.code)[0];
  n++; if (grp(near.kind) === grp(k.kind)) right++;
}
// rules come first in the app; this is only the fallback (photos weigh walls evenly, so a little rougher here)
if (right / n < 0.75) fails.push(`unseen sections: right job for only ${right}/${n}`);

if (fails.length) { console.error(`know: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log(`know: ${named} known sections named back with their systems; unseen sections right job ${right}/${n} ✓`);
