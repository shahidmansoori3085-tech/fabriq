/**
 * Build sliding windows from their section drawings and measure them.
 *   npx tsx scripts/assemble-window.ts [--svg docs/studio/assembled.html]
 *
 * Window coordinates: X across the frame depth, Y up from the window's outer
 * edge, mm. Every contact is found by bisection (lib/studio/assemble.ts):
 * pieces are slid toward each other and the gap is halved until 0.005 mm.
 *
 * Rule checked on Domal (founder): shutter = space between the top running
 * tip and the bottom running surface + roller height (every roller is 24 mm).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { solidOf, place, runners, buildSliding, type Stack } from "../lib/studio/assemble";

const book: Record<string, { w: number; h: number; paths: string[] }> = {};
for (const f of ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27", "alucoat"]) Object.assign(book, JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")));
const shape = (code: string) => { const s = book[code]; if (!s) throw new Error(`no traced shape ${code}`); return { ...s, solid: solidOf(s.paths) }; };
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

const get = (code: string) => shape(code);
const build = (st: Stack) => buildSliding(st, get);
const asBottom = (code: string) => { const s = shape(code); return { ...s, solid: place(s.solid, 1, 0, 0, 0, -1, s.h) }; };

const STACKS: Stack[] = [
  { name: "Domal 27 OMEO, 3-track", bottom: "2062", top: "2062", shutter: "2046", mouth: "end", engine: 66.7 },
  { name: "Domal 27 OMEO, 2-track", bottom: "2051", top: "2051", shutter: "2046", mouth: "end", engine: 66.7 },
  // the same 27×65 domal from other makers
  { name: "Domal 27 Ample, 3-track", bottom: "214313", top: "214313", shutter: "214315", mouth: "end", engine: 66.7 },
  { name: "Domal 27 Ample, 2-track", bottom: "214314", top: "214314", shutter: "214315", mouth: "end", engine: 66.7 },
  { name: "Domal 27 Eleanor, 3-track", bottom: "2702", top: "2702", shutter: "2722", mouth: "start", engine: 66.7 },
  { name: "Domal 27 Eleanor, 2-track", bottom: "2701", top: "2701", shutter: "2722", mouth: "start", engine: 66.7 },
  { name: "Domal 27 Banu Hashim, 2-track with leg", bottom: "BH-6032", top: "BH-6032", shutter: "BH-6050", mouth: "start", engine: 66.7 },
  { name: "Domal 27 Banu Hashim, 4-track with leg", bottom: "BH-6045", top: "BH-6045", shutter: "BH-6050", mouth: "start", engine: 66.7 },
  // Ample 25: Euro build — the roller runs on clip 914401 in the track (founder; clip on catalogue p.3)
  { name: "25 mm Ample, 2-track (clip 914401)", bottom: "955388", top: "955388", clip: "914401", shutter: "41323", mouth: "end" },
  { name: "25 mm Ample, 3-track (clip 914401)", bottom: "955389", top: "955389", clip: "914401", shutter: "41323", mouth: "end" },
  // Ample 22 mini domal: runs on the pointed hook track; the tall C wall outside is only design; no clip (founder)
  { name: "Mini domal 22 Ample, 2-track", bottom: "41083", top: "41083", shutter: "41082", mouth: "start" },
  { name: "Euro 26 BH, 3-track", bottom: "BH-6001", top: "BH-6001", clip: "BH-2559", shutter: "BH-6003", mouth: "start" },
  { name: "Euro 26 BH, 2-track", bottom: "BH-6000", top: "BH-6000", clip: "BH-2559", shutter: "BH-6003", mouth: "start" },
  // Gulf = Euro, but the left and right sides take a one-groove track (founder 2026-11-12)
  { name: "Gulf 25 BH, 2-track", bottom: "BH-2551", top: "BH-2551", clip: "BH-2559", shutter: "BH-2554", mouth: "start" },
  { name: "Gulf 25 BH, 3-track", bottom: "BH-2553", top: "BH-2553", clip: "BH-2559", shutter: "BH-2554", mouth: "start" },
  { name: "Gulf 35 BH, 2-track", bottom: "BH-6501", top: "BH-6501", clip: "BH-6513", shutter: "BH-6504", mouth: "start" },
  { name: "Gulf 35 BH, 3-track", bottom: "BH-6503", top: "BH-6503", clip: "BH-6513", shutter: "BH-6504", mouth: "start" },
];

const results = STACKS.map(build);
for (const r of results) {
  const mm = r.takeOff, inch = mm / 25.4, sut = Math.round(inch * 8);
  console.log(`\n${r.stack.name}`);
  console.log(`  track ${r.stack.bottom}: ${r.runs}; running tip ${r2(r.tipB)} mm in from the outer edge (top ${r2(r.tipT)})`);
  if (r.stack.clip) console.log(`  clip ${r.stack.clip} dropped in: head stands ${r2(r.clipUp)} mm above the tip`);
  console.log(`  shutter ${r.stack.shutter}: mouth ${r2(r.opening)} mm; 24 mm roller sits with its wheel ${r2(r.wheel)} mm inside`);
  console.log(`  goes over the track ${r.clear ? "clear" : "— HITS, check"}; to lift out needs ${r2(r.wheel)} mm, top leaves ${r2(r.topGap)} mm ${r.topGap >= r.wheel ? "✓" : "✗"}`);
  console.log(`  SHUTTER = H − ${r2(mm)} mm  (≈ H − ${Math.floor(sut / 8)}″ ${sut % 8} sut)${r.stack.engine ? `   engine H − ${r.stack.engine} → ${r2(Math.abs(mm - r.stack.engine))} mm apart` : ""}`);
}
// side jambs of Gulf: how many runners?
for (const code of ["BH-2550", "BH-2552", "BH-2551", "BH-6500", "BH-6502", "BH-6501", "AT-30001", "AT-30002", "AT-30016", "AT-30018"]) {
  if (!book[code]) { console.log(code + ": not traced"); continue; }
  const s = asBottom(code); const r = runners(s.solid, s.w, s.h);
  console.log(`${code}: ${r.at.length} ${r.kind === "U" ? "U channel(s)" : "leg(s)"}`);
}

const svgArg = process.argv.indexOf("--svg");
if (svgArg > 0) {
  const cards = results.map((r) => {
    const bb = { x0: r.x - 32, x1: r.x + 32, y0: -3, y1: r.run + 42 };
    return `<figure><svg viewBox="${bb.x0} ${-bb.y1} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}"><g transform="scale(1,-1)">${r.pic}</g></svg>
<figcaption><b>${r.stack.name}</b><br>Shutter = H − ${r2(r.takeOff)} mm${r.stack.clip ? ` · clip stands ${r2(r.clipUp)} mm` : ""}</figcaption></figure>`;
  }).join("\n");
  writeFileSync(process.argv[svgArg + 1], `<!doctype html><meta charset="utf-8"><title>Windows built from the drawings</title>
<style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}figure{display:inline-block;width:340px;margin:8px;vertical-align:top}svg{width:100%;background:#f6f7f9;border-radius:8px}
.trk{fill:#8f9aa6;fill-rule:evenodd}.sh{fill:#c9d2db;fill-rule:evenodd;stroke:#456;stroke-width:.15}.clip{fill:#e08a1e;fill-rule:evenodd}.rol{fill:none;stroke:#d33;stroke-width:.4;stroke-dasharray:1 1}</style>
<h1>Bottom of the window, built from the section drawings</h1><p>Grey: track. Orange: clip. Light: shutter. Red dashes: the 24 mm roller.</p>${cards}`);
}
