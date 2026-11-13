/**
 * Picture sheets of sections grouped by job, drawn from the traced shapes.
 *   npx tsx scripts/section-gallery.ts <out dir>
 */
import { readFileSync, writeFileSync } from "node:fs";
const book: Record<string, { w: number; h: number; paths: string[] }> = {};
const maker: Record<string, string> = {};
for (const [f, m] of [["omeo", "OMEO"], ["ample", "Ample"], ["eleanor", "Eleanor"], ["banuhashim", "Banu Hashim"], ["banuhashim-euro", "Banu Hashim"], ["banuhashim-27", "Banu Hashim"], ["alucoat", "Alucoat"]] as const) {
  const b = JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8"));
  for (const k of Object.keys(b)) { book[k] = b[k]; maker[k] = m; }
}
type Item = [code: string, note: string];
const SHEETS: [string, string, Item[]][] = [
  ["1-glass-shutter", "Glass shutter (sab ek jaise, size alag)", [["2046", "OMEO Domal 27"], ["214315", "Ample Domal 27"], ["2722", "Eleanor Domal 27"], ["BH-6050", "BH Domal 26"], ["41082", "Ample mini domal 22"], ["41323", "Ample 25"], ["41055", "Ample 29"], ["41068", "Ample 37"], ["BH-6003", "BH Euro 26"], ["BH-2555", "BH Gulf 25"], ["BH-6406", "BH 31"], ["BH-6510", "BH Gulf 35"], ["AT-30005", "Alucoat 30"]]],
  ["2-domal-track", "Domal track", [["2051", "OMEO 2-track"], ["2062", "OMEO 3-track"], ["214314", "Ample 2-track"], ["214313", "Ample 3-track"], ["2701", "Eleanor 2-track"], ["2702", "Eleanor 3-track"], ["BH-6032", "BH 27 2-track with leg"], ["BH-6045", "BH 27 4-track with leg"], ["41083", "Ample mini domal 2-track"], ["41084", "Ample mini domal 3-track"]]],
  ["3-euro-track", "Euro track (clip ke saath)", [["BH-6000", "BH Euro 2-track"], ["BH-6001", "BH Euro 3-track"], ["955388", "Ample 25 2-track"], ["955389", "Ample 25 3-track"], ["914400", "Ample 29 2-track"], ["41052", "Ample 29 3-track"], ["41015", "Ample 37 2-track"], ["41014", "Ample 37 3-track"]]],
  ["4-gulf-track", "Gulf track 2-track: upar-niche (2 naali) aur side (1 naali)", [["BH-2551", "Gulf 25 upar-niche 2T"], ["BH-2550", "Gulf 25 side 2T"], ["BH-6401", "BH 31 upar-niche 2T"], ["BH-6400", "BH 31 side 2T"], ["BH-6501", "Gulf 35 upar-niche 2T"], ["BH-6500", "Gulf 35 side 2T"], ["AT-30002", "Alucoat bottom gulf 2T"], ["AT-30001", "Alucoat vertical gulf 2T"]]],
  ["4b-gulf-track-3t", "Gulf track 3-track: upar-niche (3 naali) aur side (1 naali)", [["BH-2553", "Gulf 25 upar-niche 3T"], ["BH-2552", "Gulf 25 side 3T"], ["BH-6403", "BH 31 upar-niche 3T"], ["BH-6402", "BH 31 side 3T"], ["BH-6503", "Gulf 35 upar-niche 3T"], ["BH-6502", "Gulf 35 side 3T"], ["AT-30004", "Alucoat bottom gulf 3T"], ["AT-30003", "Alucoat vertical gulf 3T"]]],
  ["5-slim-interlock", "Slim interlock: chhota (single glass / double glass)", [["BH-6052", "Euro 26 single"], ["BH-2556", "Gulf 25 single"], ["BH-6408", "BH 31 single"], ["BH-6410", "BH 31 double glass"], ["BH-6506", "Gulf 35 single"], ["BH-6507", "Gulf 35 double glass"]]],
  ["6-big-slim", "Slim interlock bada (reinforcement): single / double glass", [["BH-6053", "Euro 26 single"], ["BH-2557", "Gulf 25 single"], ["BH-6409", "BH 31 single"], ["BH-6411", "BH 31 double glass"], ["BH-6508", "Gulf 35 single"], ["BH-6509", "Gulf 35 double glass"]]],
  ["7-track-clip", "Track clip (roller is par chalta hai)", [["BH-2559", "BH Euro / Gulf 25 clip"], ["BH-6513", "BH Gulf 35 rail"], ["914401", "Ample 25 / 29 clip"], ["41310-cap", "Ample 37 gol clip"]]],
  ["8-jali-shutter", "Jali shutter (glass ki jhiri nahi) + 3 shak wale", [["2081", "OMEO Domal jali"], ["41050", "Ample 29 jali"], ["914698", "Ample 29 jali 54"], ["41074", "Ample 37 jali"], ["41085", "Ample mini domal jali"], ["914744", "Ample 25 jali"], ["41076", "SHAK: Ample 37 41076"], ["41310-37", "SHAK: Ample 37 41310"], ["992328", "SHAK: Ample 29 992328"]]],
];
const out = process.argv[2] ?? ".";
for (const [file, title, items] of SHEETS) {
  const cards = items.map(([code, note]) => {
    const s = book[code];
    if (!s) return `<div class="c"><div class="n">${code}</div><div class="m">no drawing</div></div>`;
    const pad = Math.max(s.w, s.h) * 0.06;
    const outline = maker[code] === "OMEO" || maker[code] === "Ample" || maker[code] === "Eleanor";
    return `<div class="c"><svg viewBox="${-pad} ${-pad} ${s.w + 2 * pad} ${s.h + 2 * pad}"><path d="${s.paths.join("")}" fill="${outline ? "#5b6b7c" : "#5b6b7c"}" fill-rule="evenodd" stroke="#2b3540" stroke-width="${Math.max(s.w, s.h) / 300}"/></svg>
<div class="n">${code.replace("-cap", "").replace("-37", "")}</div><div class="m">${maker[code]} · ${s.w} × ${s.h} mm</div><div class="t">${note}</div></div>`;
  }).join("");
  writeFileSync(`${out}/${file}.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:18px;font:15px system-ui,sans-serif;background:#fff;color:#111;width:1160px}h1{font-size:24px;margin:0 0 14px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.c{border:1px solid #d8dde3;border-radius:10px;padding:8px;text-align:center}svg{width:100%;height:150px;background:#f5f7f9;border-radius:6px}
.n{font-weight:700;font-size:17px;margin-top:6px}.m{color:#555;font-size:13px}.t{font-size:14px;margin-top:2px}</style><h1>${title}</h1><div class="g">${cards}</div>`);
}
console.log("ok");
