import { readFileSync } from "node:fs";
import { solidOf, inside } from "../lib/studio/assemble";
const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27", "alucoat"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
// outline drawings (OMEO) trace as thin rings: a cell counts if any sample in it is material
const N = 48, M = 24;
const grid = (code: string) => {
  const s = book[code], so = solidOf(s.paths), g = new Uint8Array(N * M);
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    let hit = 0;
    for (let a = 0; a < 3 && !hit; a++) for (let b = 0; b < 3 && !hit; b++)
      if (inside(so, ((i + (a + 0.5) / 3) / N) * s.w, ((j + (b + 0.5) / 3) / M) * s.h)) hit = 1;
    g[i * M + j] = hit;
  }
  return g;
};
const flip = (g: Uint8Array, fx: boolean, fy: boolean) => { const o = new Uint8Array(N * M); for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) o[i * M + j] = g[(fx ? N - 1 - i : i) * M + (fy ? M - 1 - j : j)]; return o; };
const sim = (a: Uint8Array, b: Uint8Array) => { let best = 0; for (const fx of [false, true]) for (const fy of [false, true]) { const c = flip(b, fx, fy); let inter = 0, uni = 0; for (let k = 0; k < a.length; k++) { inter += a[k] & c[k]; uni += a[k] | c[k]; } best = Math.max(best, inter / uni); } return best; };
const [ref, ...rest] = process.argv.slice(2);
const r = grid(ref);
const rows = rest.filter((c) => book[c]).map((c) => [c, sim(r, grid(c)), book[c].w + "×" + book[c].h] as const).sort((a, b) => b[1] - a[1]);
for (const [c, v, d] of rows) console.log(`${ref} vs ${c} (${d}): ${(v * 100).toFixed(0)}%`);
