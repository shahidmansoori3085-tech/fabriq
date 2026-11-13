import { readFileSync } from "node:fs";
import { solidOf, box, slideUntilTouch, rayToMaterial } from "../lib/studio/assemble";
const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27", "alucoat"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
// For each end of a shutter-like section: how deep a 5 mm glass goes, and how wide the mouth is.
const end = (so: ReturnType<typeof solidOf>, s: { w: number; h: number }, dir: 1 | -1) => {
  const edge = dir === 1 ? 0 : s.w; let best = { travel: 0, open: 0 };
  for (let y = 3; y <= s.h - 3; y += 0.25) {
    const x = edge + dir * 1.2, up = rayToMaterial(so, x, y, 0, -1, 30), dn = rayToMaterial(so, x, y, 0, 1, 30), open = up + dn;
    if (open < 5.5 || open > 30) continue;
    const c = y + (dn - up) / 2, start = dir === 1 ? -12 : s.w + 2;
    const t = slideUntilTouch(box(start, c - 2.5, start + 10, c + 2.5), so, dir, 0, s.w + 14).dist - 2;
    if (t > best.travel) best = { travel: t, open };
  }
  return best;
};
for (const code of process.argv.slice(2)) {
  const s = book[code]; if (!s) { console.log(code, "no shape"); continue; }
  const so = solidOf(s.paths); const a = end(so, s, 1), b = end(so, s, -1);
  const isTrack = (e: { travel: number }) => e.travel >= 24, isGlass = (e: { travel: number; open: number }) => e.travel >= 8 && e.travel < 24 && e.open <= 16.5;
  const kind = (isTrack(a) && isGlass(b)) || (isTrack(b) && isGlass(a)) ? "GLASS shutter" : (isTrack(a) || isTrack(b)) && !isGlass(a) && !isGlass(b) ? "MESH (jali) shutter?" : "other";
  console.log(`${code} ${s.w}×${s.h}: ends ${a.open.toFixed(1)}/${a.travel.toFixed(1)} · ${b.open.toFixed(1)}/${b.travel.toFixed(1)} → ${kind}`);
}
