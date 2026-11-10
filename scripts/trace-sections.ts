/**
 * Section tracer — turns catalogue section drawings into real, to-scale
 * vector shapes (mm), so FabriQ draws a section exactly as the catalogue does.
 *
 *   npx tsx scripts/trace-sections.ts scripts/sections/ample-29.json
 *
 * How: each catalogue page is rendered with pdftoppm (grey, 400 dpi). Ample
 * pages are a 2 × 3 grid of cells under a header bar. In a cell the section's
 * metal is a mid-grey fill with a dark-grey outline; dimension lines and text
 * are black and the watermark is pale, so a grey-band mask isolates the metal.
 * The largest connected grey region is the section. Its outline (with holes)
 * is traced by marching squares, simplified, and scaled with the width and
 * height printed on the drawing. The two scales must agree (±4 %) or the
 * section is reported for a manual check instead of being saved wrong.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

interface Cell { code: string; w: number; h: number; note?: string; /** stored under this key when one code is printed on two profiles */ key?: string }
interface Manifest {
  /** "grid" = Ample-style 2×3 cells with grey metal (default); "cad-red" = CAD drawings with red outlines (OMEO) */
  style?: "grid" | "cad-red" | "dark-fill";
  /** part of the page height taken by the title band (skipped); default 0.16 */
  skipTop?: number;
  catalogue: string;          // PDF path
  out: string;                // JSON written here
  maker: string;
  pages: { page: number; cells: (Cell | null)[] }[];
}
export interface TracedShape { code: string; maker: string; w: number; h: number; paths: string[]; source: string; scaleCheck: number }

const PDFTOPPM = process.env.PDFTOPPM ?? "pdftoppm";
const DPI = 400;

function readPgm(file: string) {
  const buf = readFileSync(file);
  let i = 0;
  const tok = () => { while (buf[i] === 0x20 || buf[i] === 0x0a || buf[i] === 0x0d || buf[i] === 0x09) i++; let s = ""; while (buf[i] > 0x20) s += String.fromCharCode(buf[i++]); return s; };
  if (tok() !== "P5") throw new Error("not a P5 PGM");
  const w = +tok(), h = +tok(); tok(); i++;
  return { w, h, px: buf.subarray(i, i + w * h) };
}

function render(pdf: string, page: number): ReturnType<typeof readPgm> {
  const dir = join(tmpdir(), "fabriq-trace"); if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const base = join(dir, `p${page}`);
  execFileSync(PDFTOPPM, ["-r", String(DPI), "-gray", "-f", String(page), "-l", String(page), pdf, base]);
  const pad = (n: number, len: number) => String(n).padStart(len, "0");
  for (const len of [1, 2, 3]) { const f = `${base}-${pad(page, len)}.pgm`; if (existsSync(f)) return readPgm(f); }
  throw new Error(`render failed for page ${page}`);
}

/** Header bars: wide dark bands. Returns [y0,y1] bands and, per band, the x-runs (one per cell). */
function renderColor(pdf: string, page: number, dpi: number) {
  const dir = join(tmpdir(), "fabriq-trace"); if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const base = join(dir, `c${page}`);
  execFileSync(PDFTOPPM, ["-r", String(dpi), "-f", String(page), "-l", String(page), pdf, base]);
  for (const len of [1, 2, 3]) {
    const fl = `${base}-${String(page).padStart(len, "0")}.ppm`;
    if (!existsSync(fl)) continue;
    const buf = readFileSync(fl);
    let i = 0;
    const tok = () => { while (buf[i] <= 0x20) i++; let t = ""; while (buf[i] > 0x20) t += String.fromCharCode(buf[i++]); return t; };
    if (tok() !== "P6") throw new Error("not P6");
    const w = +tok(), h = +tok(); tok(); i++;
    return { w, h, rgb: buf.subarray(i, i + w * h * 3) };
  }
  throw new Error(`render failed for page ${page}`);
}

/**
 * CAD-style pages (OMEO): the section is drawn as red outlines, sometimes with a
 * green fill; dimensions are magenta, text black. Metal = red/green lines plus
 * every narrow region enclosed by them (a wall drawn as two lines). Wide
 * enclosed regions are hollow chambers and stay empty.
 */
function cadSections(img: ReturnType<typeof renderColor>, want: number, style: "cad-red" | "dark-fill" = "cad-red", skipTop = 0.16) {
  const { w, h, rgb } = img;
  const ink = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const r = rgb[p * 3], g = rgb[p * 3 + 1], b = rgb[p * 3 + 2];
    if (style === "dark-fill") {
      // Banu Hashim: sections filled slate grey; table bars are navy (much bluer), text black
      const lum = (r + g + b) / 3;
      ink[p] = lum > 62 && lum < 150 && b - r > 8 && b - r < 62 && r > 44 ? 1 : 0;
      continue;
    }
    const red = r > 140 && g < 125 && b < 125 && r - g > 60;
    const green = g > 130 && r < 150 && b < 150 && g - r > 40 && g - b > 40;
    ink[p] = red || green ? 1 : 0;
  }
  // components of ink
  const lab = new Int32Array(w * h).fill(-1);
  const comps: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  const st: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!ink[p] || lab[p] >= 0) continue;
    const id = comps.length; const c = { n: 0, x0: w, y0: h, x1: 0, y1: 0 }; lab[p] = id; st.push(p);
    while (st.length) {
      const q = st.pop()!; c.n++; const x = q % w, y = (q - x) / w;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const r2 = ny * w + nx; if (ink[r2] && lab[r2] < 0) { lab[r2] = id; st.push(r2); }
      }
    }
    comps.push(c);
  }
  // sections: pieces of one drawing (outline, fill, small islands) are joined when their boxes touch
  const M = Math.round(Math.min(w, h) * 0.012);
  const live = comps.map((c, id) => ({ ...c, ids: [id] })).filter((c) => c.y0 > h * skipTop && c.y1 < h * 0.9 && c.n > 40);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < live.length && !merged; i++) for (let j = i + 1; j < live.length && !merged; j++) {
      const A = live[i], B = live[j];
      if (A.x0 - M <= B.x1 && B.x0 - M <= A.x1 && A.y0 - M <= B.y1 && B.y0 - M <= A.y1) {
        A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0); A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
        A.n += B.n; A.ids.push(...B.ids); live.splice(j, 1); merged = true;
      }
    }
  }
  const big = live
    .filter((c) => { const r = (c.x1 - c.x0) / Math.max(1, c.y1 - c.y0); return r < 12 && r > 1 / 12 && (c.x1 - c.x0) * (c.y1 - c.y0) > w * h * 0.0015; })
    .sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0)).slice(0, want)
    .sort((a, b) => (Math.abs(a.y0 - b.y0) > h * 0.05 ? a.y0 - b.y0 : a.x0 - b.x0));
  if (process.env.DEBUG) console.log(big.map((c) => `${c.x0},${c.y0} ${c.x1 - c.x0}×${c.y1 - c.y0} n=${c.n}`).join(" | "));
  return big.map((c) => {
    const m = 4, x0 = Math.max(0, c.x0 - m), y0 = Math.max(0, c.y0 - m), x1 = Math.min(w, c.x1 + m + 1), y1 = Math.min(h, c.y1 + m + 1);
    const bw = x1 - x0, bh = y1 - y0;
    const metal = new Uint8Array(bw * bh);
    const ids = new Set(c.ids);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (ids.has(lab[(y + y0) * w + x + x0])) metal[y * bw + x] = 1;
    // distance from ink, then fill narrow enclosed regions
    const dist = new Int32Array(bw * bh).fill(1 << 29); const qu: number[] = [];
    for (let i = 0; i < bw * bh; i++) if (metal[i]) { dist[i] = 0; qu.push(i); }
    for (let k = 0; k < qu.length; k++) {
      const q = qu[k], x = q % bw, y = (q - x) / bw;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const r2 = ny * bw + nx; if (dist[r2] > dist[q] + 1) { dist[r2] = dist[q] + 1; qu.push(r2); }
      }
    }
    const T = Math.max(6, Math.round(Math.min(c.x1 - c.x0, c.y1 - c.y0) * 0.035));
    const reg = new Int32Array(bw * bh).fill(-1);
    for (let i = 0; i < bw * bh; i++) {
      if (metal[i] || reg[i] >= 0) continue;
      const members: number[] = []; let maxD = 0, edge = false; reg[i] = i; st.push(i);
      while (st.length) {
        const q = st.pop()!; members.push(q); const x = q % bw, y = (q - x) / bw;
        if (dist[q] > maxD) maxD = dist[q]; if (x === 0 || y === 0 || x === bw - 1 || y === bh - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
          const r2 = ny * bw + nx; if (!metal[r2] && reg[r2] < 0) { reg[r2] = i; st.push(r2); }
        }
      }
      if (style === "cad-red" && !edge && maxD <= T) for (const q of members) metal[q] = 2;
    }
    for (let i = 0; i < metal.length; i++) metal[i] = metal[i] ? 1 : 0;
    let minX = bw, minY = bh, maxX = 0, maxY = 0;
    for (let i = 0; i < metal.length; i++) if (metal[i]) { const x = i % bw, y = (i - x) / bw; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    return { mask: metal, bw, bh, box: { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }, n: c.n };
  });
}

function headers(img: ReturnType<typeof readPgm>) {
  const { w, h, px } = img;
  const bands: [number, number][] = [];
  let cur: [number, number] | null = null;
  for (let y = 0; y < h; y++) {
    let c = 0; for (let x = 0; x < w; x++) if (px[y * w + x] < 160) c++;
    if (c > w * 0.35) { if (cur) cur[1] = y; else cur = [y, y]; } else if (cur) { bands.push(cur); cur = null; }
  }
  const tall = bands.filter(([a, b]) => b - a > 60 && b - a < 200);
  return tall.map(([y0, y1]) => {
    const y = y0 + 4; // above the white header text
    const runs: [number, number][] = []; let s = -1;
    for (let x = 0; x <= w; x++) {
      const dark = x < w && px[y * w + x] < 200;
      if (dark && s < 0) s = x; else if (!dark && s >= 0) { if (x - s > w * 0.25) runs.push([s, x]); s = -1; }
    }
    return { y0, y1, runs };
  });
}

/** Largest connected region of "metal grey" inside a box. */
function metal(img: ReturnType<typeof readPgm>, x0: number, y0: number, x1: number, y1: number) {
  const { w, px } = img;
  const bw = x1 - x0, bh = y1 - y0;
  const mask = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const v = px[(y + y0) * w + (x + x0)];
    mask[y * bw + x] = v >= 70 && v <= 212 ? 1 : 0;
  }
  const lab = new Int32Array(bw * bh).fill(-1);
  let best = -1, bestN = 0; const sizes: number[] = [];
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || lab[i] >= 0) continue;
    const id = sizes.length; let n = 0; stack.push(i); lab[i] = id;
    while (stack.length) {
      const p = stack.pop()!; n++;
      const x = p % bw, y = (p - x) / bw;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue;
        const q = ny * bw + nx; if (mask[q] && lab[q] < 0) { lab[q] = id; stack.push(q); }
      }
    }
    sizes.push(n); if (n > bestN) { bestN = n; best = id; }
  }
  const out = new Uint8Array(bw * bh);
  let minX = bw, minY = bh, maxX = 0, maxY = 0;
  for (let i = 0; i < out.length; i++) if (lab[i] === best) {
    out[i] = 1; const x = i % bw, y = (i - x) / bw;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { mask: out, bw, bh, box: { minX, minY, maxX: maxX + 1, maxY: maxY + 1 }, n: bestN };
}

/** Boundary loops of a pixel mask (pixel-corner coordinates), metal kept on the left. */
function contours(mask: Uint8Array, bw: number, bh: number): [number, number][][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < bw && y < bh ? mask[y * bw + x] : 0);
  const W1 = bw + 2;
  const id = (x: number, y: number) => (y + 1) * W1 + (x + 1);
  const outs = new Map<number, number[]>();
  const add = (a: number, b: number) => { const l = outs.get(a); if (l) l.push(b); else outs.set(a, [b]); };
  for (let y = -1; y < bh; y++) for (let x = -1; x < bw; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1);
    if (a !== b) { if (a) add(id(x + 1, y + 1), id(x + 1, y)); else add(id(x + 1, y), id(x + 1, y + 1)); }
    if (a !== c) { if (a) add(id(x, y + 1), id(x + 1, y + 1)); else add(id(x + 1, y + 1), id(x, y + 1)); }
  }
  const xy = (k: number): [number, number] => [(k % W1) - 1, Math.floor(k / W1) - 1];
  const loops: [number, number][][] = [];
  for (const [startPt, list] of outs) {
    while (list.length) {
      const loop: [number, number][] = [xy(startPt)];
      let prev = startPt, cur = list.pop()!;
      let guard = 0;
      while (cur !== startPt && guard++ < 5_000_000) {
        loop.push(xy(cur));
        const opts = outs.get(cur);
        if (!opts || !opts.length) break;
        let pick = 0;
        if (opts.length > 1) {
          // at a corner shared by two diagonal pixels, always take the right turn
          const [px, py] = xy(prev), [cx, cy] = xy(cur);
          const dx = cx - px, dy = cy - py;
          pick = opts.findIndex((o) => { const [ox, oy] = xy(o); return (ox - cx) === -dy && (oy - cy) === dx; });
          if (pick < 0) pick = 0;
        }
        const nxt = opts.splice(pick, 1)[0];
        prev = cur; cur = nxt;
      }
      if (loop.length > 8) loops.push(loop);
    }
  }
  return loops;
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!; let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A closed loop: split at the point farthest from the start, simplify each half. */
function simplifyLoop(l: [number, number][], tol: number): [number, number][] {
  let far = 0, fd = 0;
  for (let i = 1; i < l.length; i++) { const d = Math.hypot(l[i][0] - l[0][0], l[i][1] - l[0][1]); if (d > fd) { fd = d; far = i; } }
  const a = simplify(l.slice(0, far + 1), tol), b = simplify([...l.slice(far), l[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

function trace(m: Manifest) {
  const out: Record<string, TracedShape> = existsSync(m.out) ? JSON.parse(readFileSync(m.out, "utf8")) : {};
  const problems: string[] = [];
  for (const pg of m.pages) {
    if (m.style === "cad-red" || m.style === "dark-fill") {
      const found = cadSections(renderColor(m.catalogue, pg.page, 300), pg.cells.filter(Boolean).length, m.style, m.skipTop ?? 0.16);
      let k = 0;
      pg.cells.forEach((c) => {
        if (!c) return;
        const r = found[k++];
        if (!r) { problems.push(`${c.code}: not found on page ${pg.page}`); return; }
        save(c, r, pg.page);
      });
      continue;
    }
    const img = render(m.catalogue, pg.page);
    const hd = headers(img);
    if (process.env.DEBUG) console.log(JSON.stringify(hd));
    const cellH = hd.length > 1 ? hd[1].y0 - hd[0].y0 : img.h * 0.26;
    const cells: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const band of hd) for (const [x0, x1] of band.runs) cells.push({ x0: x0 + 14, x1: x1 - 14, y0: band.y1 + 14, y1: Math.min(img.h - 1, Math.round(band.y0 + cellH - 24)) });
    pg.cells.forEach((c, i) => {
      if (!c) return;
      const box = cells[i];
      if (!box) { problems.push(`${c.code}: no cell ${i + 1} found on page ${pg.page}`); return; }
      save(c, metal(img, box.x0, box.y0, box.x1, box.y1), pg.page);
    });
  }
  function save(c: Cell, r: { mask: Uint8Array; bw: number; bh: number; box: { minX: number; minY: number; maxX: number; maxY: number } }, page: number) {
      const pw = r.box.maxX - r.box.minX, ph = r.box.maxY - r.box.minY;
      const sx = c.w / pw, sy = c.h / ph;
      const check = Math.abs(sx - sy) / Math.max(sx, sy);
      if (check > 0.04) problems.push(`${c.code}: printed ${c.w}×${c.h} does not match the drawing (${(check * 100).toFixed(1)}% off) — check by hand`);
      const s = (sx + sy) / 2;
      const loops = contours(r.mask, r.bw, r.bh)
        .map((l) => simplifyLoop(l, 1.2))
        .filter((l) => l.length > 3);
      const paths = loops.map((l) => "M" + l.map(([x, y]) => `${((x - r.box.minX) * s).toFixed(2)} ${((y - r.box.minY) * s).toFixed(2)}`).join("L") + "Z");
      out[c.key ?? c.code] = { code: c.code, maker: m.maker, w: c.w, h: c.h, paths, source: `${m.catalogue.split(/[\\/]/).pop()} p.${page}`, scaleCheck: +(check * 100).toFixed(1) };
      console.log(`${c.code}: ${pw}×${ph}px → ${c.w}×${c.h} mm, ${paths.length} loops, scale agreement ${(100 - check * 100).toFixed(1)}%`);
  }
  mkdirSync(dirname(m.out), { recursive: true });
  writeFileSync(m.out, JSON.stringify(out));
  if (problems.length) { console.log("\nCheck by hand:"); for (const p of problems) console.log(" • " + p); }
}

const file = process.argv[2];
if (!file) { console.error("usage: tsx scripts/trace-sections.ts <manifest.json>"); process.exit(1); }
trace(JSON.parse(readFileSync(file, "utf8")) as Manifest);
