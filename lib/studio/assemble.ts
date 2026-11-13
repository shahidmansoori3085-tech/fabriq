/**
 * Build a window out of its real section drawings and measure it.
 *
 * Each traced section (catalogue scale, mm) becomes a solid outline. Pieces are
 * placed and slid toward each other; where they first touch is found by
 * halving the gap again and again (bisection) until it is known to 0.005 mm —
 * the founder's "aadha karo, phir aadha karo" method. Nothing here is a
 * cutting rule by itself: it measures the drawing (leg tip, clip seat, channel
 * depth) so a rule can be worked out and checked against real jobs.
 */

export type Pt = [number, number];
export type Loop = Pt[];
/** a shape = closed loops, even-odd fill (holes are loops inside loops) */
export type Solid = Loop[];

const NUM = /(-?\d*\.?\d+(?:e-?\d+)?)[ ,](-?\d*\.?\d+(?:e-?\d+)?)/g;

/** Traced SVG paths ("M x y L … Z") → loops. */
export function solidOf(paths: string[]): Solid {
  return paths.map((p) => [...p.matchAll(NUM)].map((m) => [+m[1], +m[2]] as Pt)).filter((l) => l.length >= 3);
}

export const box = (x0: number, y0: number, x1: number, y1: number): Solid => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
export const move = (s: Solid, dx: number, dy: number): Solid => s.map((l) => l.map(([x, y]) => [x + dx, y + dy] as Pt));
/** general placement: new = (a·x + b·y + c, d·x + e·y + f) */
export const place = (s: Solid, a: number, b: number, c: number, d: number, e: number, f: number): Solid =>
  s.map((l) => l.map(([x, y]) => [a * x + b * y + c, d * x + e * y + f] as Pt));

export function bounds(s: Solid) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of s) for (const [x, y] of l) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/** even-odd point test */
export function inside(s: Solid, x: number, y: number): boolean {
  let c = false;
  for (const l of s) for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function segsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** Do two solids share any material? (an edge crosses, or one sits inside the other) */
export function touches(a: Solid, b: Solid): boolean {
  const A = bounds(a), B = bounds(b);
  if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) return false;
  for (const la of a) for (let i = 0, j = la.length - 1; i < la.length; j = i++) {
    const p = la[j], q = la[i];
    const sx0 = Math.min(p[0], q[0]), sx1 = Math.max(p[0], q[0]), sy0 = Math.min(p[1], q[1]), sy1 = Math.max(p[1], q[1]);
    if (sx1 < B.x0 || sx0 > B.x1 || sy1 < B.y0 || sy0 > B.y1) continue;
    for (const lb of b) for (let k = 0, m = lb.length - 1; k < lb.length; m = k++) {
      const r = lb[m], t = lb[k];
      if (Math.max(r[0], t[0]) < sx0 || Math.min(r[0], t[0]) > sx1 || Math.max(r[1], t[1]) < sy0 || Math.min(r[1], t[1]) > sy1) continue;
      if (segsCross(p, q, r, t)) return true;
    }
  }
  for (const l of a) if (inside(b, l[0][0], l[0][1])) return true;
  for (const l of b) if (inside(a, l[0][0], l[0][1])) return true;
  return false;
}

export interface Slide { dist: number; steps: number }

/**
 * Slide `moving` along (dx, dy) toward `fixed` and return how far it goes
 * before it first touches. A coarse walk finds the first touching step (so a
 * thin wall is never jumped over), then the gap is halved until it is
 * smaller than `tol`. Returns dist = max when nothing is hit.
 */
export function slideUntilTouch(moving: Solid, fixed: Solid, dx: number, dy: number, max: number, tol = 0.005): Slide {
  const n = Math.hypot(dx, dy); dx /= n; dy /= n;
  const at = (t: number) => touches(move(moving, dx * t, dy * t), fixed);
  if (at(0)) return { dist: 0, steps: 0 };
  const coarse = 0.25;
  let lo = 0, hi = -1, steps = 0;
  for (let t = coarse; t <= max + 1e-9; t += coarse) { steps++; if (at(t)) { hi = t; break; } lo = t; }
  if (hi < 0) return { dist: max, steps };
  while (hi - lo > tol) { const mid = (lo + hi) / 2; steps++; if (at(mid)) hi = mid; else lo = mid; }
  return { dist: lo, steps };
}

/** Narrowest gap measured from a point outward: distance to material along a ray (bisection on a tiny probe). */
export function rayToMaterial(s: Solid, x: number, y: number, dx: number, dy: number, max: number): number {
  const probe = box(x - 0.01, y - 0.01, x + 0.01, y + 0.01);
  return slideUntilTouch(probe, s, dx, dy, max).dist;
}

/** Solid → SVG path (for pictures of the assembled window). */
export const svgPath = (s: Solid) => s.map((l) => "M" + l.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L") + "Z").join("");

/* ———————————————— a sliding window's bottom, built from its drawings ———————————————— */
// Rule checked on Domal (founder, 2026-11-12): shutter = space between the top
// running tip and the bottom running surface + roller height. Every roller is 24 mm.
export const ROLLER = 24;
const r2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** A track laid as the bottom frame: shape y = 0 at the tips, flipped so tips point up, outer edge at Y = 0. */
type Get = (code: string) => { w: number; h: number; solid: Solid };
const asBottom = (get: Get, code: string) => { const s = get(code); return { ...s, solid: place(s.solid, 1, 0, 0, 0, -1, s.h) }; };
export const tipAt = (track: Solid, x: number, from: number) => from - rayToMaterial(track, x, from, 0, -1, from);

/** Where the shutters run: single legs (Domal) or U channels (two legs ~11 mm apart). */
export function runners(track: Solid, w: number, hFull: number) {
  const xs: number[] = [], tips: number[] = [];
  for (let x = 0.25; x < w; x += 0.25) { xs.push(x); tips.push(tipAt(track, x, hFull + 5)); }
  const group = (h: number) => {
    const g: { x0: number; x1: number }[] = [];
    xs.forEach((x, i) => { if (tips[i] < h - 2) return; const l = g[g.length - 1]; if (l && x - l.x1 <= 0.6) l.x1 = x; else g.push({ x0: x, x1: x }); });
    return g;
  };
  // An outer leg that stands taller than everything else is only design (founder):
  // leave it out and look for the running track below it.
  let h = hFull, legs = group(h);
  for (let pass = 0; pass < 2 && legs.length === 1; pass++) {
    const d = legs[0];
    xs.forEach((x, i) => { if (x >= d.x0 - 0.5 && x <= d.x1 + 0.5) tips[i] = 0; });
    const next = Math.max(...tips);
    if (next < hFull * 0.5) break;
    h = next; legs = group(h);
  }
  const mids = legs.map((g) => (g.x0 + g.x1) / 2);
  const us: number[] = [];
  // a U = two legs ~11 mm apart whose tips hook inward (narrower at the top than lower down);
  // a plain wall next to a leg has no hooks facing it
  const gapAt = (m: number, y: number) => rayToMaterial(track, m, y, -1, 0, 9) + rayToMaterial(track, m, y, 1, 0, 9);
  // every U in one track has the same leg spacing; a wall next to a leg does not repeat.
  // Take the spacing that repeats most, then prefer pairs whose tips hook inward.
  const cand = mids.slice(0, -1).map((a, i) => ({ i, m: (a + mids[i + 1]) / 2, d: mids[i + 1] - a }))
    .filter((c) => c.d > 8 && c.d < 15.5)
    .map((c, _, all) => ({ ...c, n: all.filter((o) => Math.abs(o.d - c.d) < 0.8).length, hook: gapAt(c.m, h - 6) - gapAt(c.m, h - 0.8) }));
  const best = Math.max(0, ...cand.map((c) => c.n));
  const used = new Set<number>();
  for (const c of cand.filter((c) => c.n === best).sort((p, q) => q.hook - p.hook)) {
    if (!used.has(c.i) && !used.has(c.i + 1)) { used.add(c.i); used.add(c.i + 1); us.push(c.m); }
  }
  us.sort((p, q) => p - q);
  if (us.length) return { kind: "U" as const, at: us };
  // single legs: the running legs share one height; an outer flange that stands
  // taller once (Banu Hashim "with leg" tracks) is not a running leg
  const top = legs.map((g) => { let m = 0; for (let x = g.x0; x <= g.x1; x += 0.25) m = Math.max(m, tipAt(track, x, h + 5)); return Math.round(m * 2) / 2; });
  const count = (v: number) => top.filter((t) => t === v).length;
  const common = top.reduce((b, t) => (count(t) > count(b) ? t : b), top[0]);
  const kept = legs.filter((_, i) => count(common) === 1 || top[i] === common);
  // a thin outer wall next to wide hollow running legs is only design (founder): measure each
  // leg's width a few mm below its tip and drop the ones much thinner than the widest
  const span = (g: { x0: number; x1: number }) => { let n = 0; for (let x = g.x0 - 6; x <= g.x1 + 6; x += 0.25) if (tipAt(track, x, h + 5) > h - 6) n++; return n * 0.25; };
  const spans = kept.map(span), widest = Math.max(...spans);
  const running = kept.length >= 3 ? kept.filter((_, i) => spans[i] >= 0.4 * widest) : kept;
  return { kind: "leg" as const, at: running.map((g) => (g.x0 + g.x1) / 2) };
}

/** The channel of a shutter member that faces the track: mouth at shape x = edge, going in along dir. */
function channel(s: Solid, edge: number, dir: 1 | -1, yMid: number) {
  const x = edge + dir * 1.5;
  const up = rayToMaterial(s, x, yMid, 0, -1, 30), down = rayToMaterial(s, x, yMid, 0, 1, 30);
  const centre = yMid + (down - up) / 2;
  const depth = rayToMaterial(s, edge - dir, centre, dir, 0, 80) - 1;
  return { opening: up + down, centre, depth };
}

/** Slide a 24 mm roller block into the channel until it stops. */
function rollerSeat(s: Solid, edge: number, dir: 1 | -1, centre: number, opening: number) {
  const w = Math.min(opening - 0.6, 16);
  const start = dir === -1 ? edge + 2 : edge - 2 - ROLLER;
  const go = slideUntilTouch(box(start, centre - w / 2, start + ROLLER, centre + w / 2), s, dir, 0, ROLLER + 80).dist;
  const inner = dir === -1 ? start - go : start + ROLLER + go;
  const inDepth = Math.abs(inner - edge);
  return { inDepth, wheelRecess: inDepth - ROLLER };
}

export interface Stack {
  name: string; bottom: string; top: string; clip?: string; shutter: string;
  mouth: "start" | "end"; engine?: number;
}
export interface Result { x: number; run: number; stack: Stack; tipB: number; tipT: number; clipUp: number; takeOff: number; opening: number; wheel: number; topGap: number; clear: boolean; pic: string; runs: string }

export function buildSliding(st: Stack, get: Get): Result {
  const b = asBottom(get, st.bottom), t = asBottom(get, st.top);
  const rb = runners(b.solid, b.w, b.h), rt = runners(t.solid, t.w, t.h);
  const x = rb.at[0];
  // highest point of the running legs around x (a U: both legs, up to 8 mm either side)
  const tipNear = (tr: Solid, at: number, kind: "U" | "leg", h: number) => {
    let best = -Infinity; const r = kind === "U" ? 8 : 2;
    for (let d = -r; d <= r; d += 0.25) best = Math.max(best, tipAt(tr, at + d, h + 10));
    return best;
  };
  const tipB = tipNear(b.solid, x, rb.kind, b.h);
  const tipT = tipNear(t.solid, rt.at[0], rt.kind, t.h);

  // Put the clip in the bottom U. Its legs are springs — they squeeze and snap
  // into the U — so the clip sits on its head / wings: the lowest row of the
  // clip's top part that is (almost) as wide as its widest rests on the U tips.
  let clipUp = 0, clipSolid: Solid = [];
  if (st.clip) {
    const c = get(st.clip);
    const width = (y: number) => {
      const l = rayToMaterial(c.solid, -1, y, 1, 0, c.w + 2), r = rayToMaterial(c.solid, c.w + 1, y, -1, 0, c.w + 2);
      return l > c.w + 1.5 ? 0 : c.w + 2 - l - r;
    };
    const rows: { y: number; w: number }[] = [];
    for (let y = 0.1; y <= c.h * 0.45; y += 0.1) rows.push({ y, w: width(y) });
    const widest = Math.max(...rows.map((r) => r.w));
    const wing = rows.filter((r) => r.w >= widest - 0.6).pop()!; // underside of the wings / head
    let rest = 0;
    for (let d = -wing.w / 2; d <= wing.w / 2; d += 0.25) rest = Math.max(rest, tipAt(b.solid, x + d, b.h + 10));
    const headTop = rest + wing.y;
    clipSolid = place(c.solid, 1, 0, x - c.w / 2, 0, -1, headTop);
    clipUp = headTop - tipB;
  }
  const run = tipB + clipUp;

  const sh = get(st.shutter);
  const edge = st.mouth === "end" ? sh.w : 0, dir: 1 | -1 = st.mouth === "end" ? -1 : 1;
  const ch = channel(sh.solid, edge, dir, sh.h / 2);
  const seat = rollerSeat(sh.solid, edge, dir, ch.centre, ch.opening);
  // shutter bottom member: its mouth sits wheelRecess below the running surface
  const mouthY = run - seat.wheelRecess;
  const placed = st.mouth === "end"
    ? place(sh.solid, 0, 1, x - ch.centre, -1, 0, mouthY + sh.w)
    : place(sh.solid, 0, 1, x - ch.centre, 1, 0, mouthY);
  const clear = !touches(placed, b.solid) && !(clipSolid.length && touches(placed, clipSolid));
  const takeOff = tipB + clipUp + tipT - ROLLER;
  const topIn = ROLLER - seat.wheelRecess;           // how far the top tip goes into the shutter
  const roller = box(x - 7, run, x + 7, run + ROLLER);
  const pic = `<path d="${svgPath(b.solid)}" class="trk"/>${clipSolid.length ? `<path d="${svgPath(clipSolid)}" class="clip"/>` : ""}<path d="${svgPath(placed)}" class="sh"/><path d="${svgPath(roller)}" class="rol"/>`;
  return {
    x, run, stack: st, tipB, tipT, clipUp, takeOff, opening: ch.opening, wheel: seat.wheelRecess, topGap: ch.depth - topIn, clear, pic,
    runs: `${rb.kind === "U" ? "U channels" : "legs"} at ${rb.at.map(r2).join(", ")}`,
  };
}


/* ———————————————— Bombay / Normal: roller in the bearing pocket, on a round rail ———————————————— */
// Founder (2026-11-13): the Normal bearing roller is 13 mm high and fits inside
// the bearing shutter's pocket. The shutter rides on the rail of the bottom track
// and reaches up into the top track's channel.
export const BOMBAY_ROLLER = 13;

export interface BombayResult { rail: number; topFloor: number; rollerIn: number; wheel: number; shutterBottom: number; takeOff: number; walls: number; clear: boolean }

/**
 * bottom / top: track codes (tips up / down); bearing: the shutter's bearing
 * section, pocket opening at shape x = 0. takeOff = H − shutter height when the
 * shutter top reaches the top channel floor.
 */
export function buildBombay(bottom: string, top: string, bearing: string, get: Get, roller = BOMBAY_ROLLER): BombayResult {
  const B = asBottom(get, bottom), T = asBottom(get, top);
  // the rail: highest point inside the first channel, between its walls
  const walls = Math.max(tipAt(B.solid, 1, B.h + 5), tipAt(B.solid, 2, B.h + 5));
  let rail = 0, railX = 0;
  for (let x = 5; x < Math.min(B.w, 30); x += 0.1) { const y = tipAt(B.solid, x, B.h + 5); if (y < walls - 3 && y > rail) { rail = y; railX = x; } }
  // floor of the top track's channel, measured from its outer edge (most common height)
  const fl: number[] = [];
  for (let x = 6; x < Math.min(T.w, 26); x += 0.5) { const y = tipAt(T.solid, x, T.h + 5); if (y > 1 && y < T.h - 3) fl.push(Math.round(y * 10) / 10); }
  fl.sort((p, q) => p - q);
  const topFloor = fl[Math.floor(fl.length / 2)];
  // slide the roller into the bearing pocket until it stops
  const be = get(bearing);
  const mid = be.h / 2;
  const up = rayToMaterial(be.solid, 1.5, mid, 0, -1, 20), dn = rayToMaterial(be.solid, 1.5, mid, 0, 1, 20);
  const centre = mid + (dn - up) / 2, w = Math.min(up + dn - 0.6, 10);
  const start = -2 - roller;
  const go = slideUntilTouch(box(start, centre - w / 2, start + roller, centre + w / 2), be.solid, 1, 0, 40).dist;
  const rollerIn = start + roller + go;
  const wheel = roller - rollerIn;
  const shutterBottom = rail + wheel;
  const placed = place(be.solid, 0, 1, railX - centre, 1, 0, shutterBottom);
  return { rail, topFloor, rollerIn, wheel, shutterBottom, takeOff: topFloor + shutterBottom, walls, clear: !touches(placed, B.solid) };
}
