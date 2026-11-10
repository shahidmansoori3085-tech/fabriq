/**
 * What a section looks like from the front of the window.
 *
 * A window member is its section pushed along its length, so in the front
 * view every step and corner of the section's front surface shows up as a
 * line running the length of the member, and every surface set back from the
 * front looks darker. This samples the real traced section across its face,
 * finds the front-most metal at each point, and turns that into colour stops
 * across the member: the drawing is then the real section, seen from the front.
 */
import type { Shape } from "./shapes";

export type Role = "frame" | "sash";
export interface Stop { o: number; c: string }

type Poly = [number, number][];

function polys(paths: string[]): Poly[] {
  const out: Poly[] = [];
  for (const d of paths) {
    for (const part of d.split("M").filter(Boolean)) {
      const pts = part.replace(/Z/g, "").split("L").map((p) => p.trim().split(/\s+/).map(Number) as [number, number]);
      if (pts.length > 2) out.push(pts);
    }
  }
  return out;
}

/** Crossing positions (along v) of the line u = const with every polygon edge. */
function crossings(ps: Poly[], u: number, uAxis: 0 | 1): number[] {
  const vAxis = uAxis === 0 ? 1 : 0;
  const xs: number[] = [];
  for (const p of ps) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const ua = a[uAxis], ub = b[uAxis];
      if ((ua <= u && ub > u) || (ub <= u && ua > u)) {
        const t = (u - ua) / (ub - ua);
        xs.push(a[vAxis] + t * (b[vAxis] - a[vAxis]));
      }
    }
  }
  return xs.sort((x, y) => x - y);
}

const grey = (l: number) => { const v = Math.round(Math.max(60, Math.min(244, l))); return `rgb(${v},${v + 3},${Math.min(255, v + 8)})`; };
const cache = new Map<string, Stop[]>();

/**
 * Colour stops from the member's outer edge (o = 0) to its inner edge (o = 1).
 * Frame / track sections are drawn base-down in catalogues (base = wall side),
 * so their face runs along the drawing's height; shutter sections run along its width.
 */
export function faceStops(s: Shape, role: Role, flip = false): Stop[] {
  const key = `${s.code}|${s.source}|${role}|${flip}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ps = polys(s.paths);
  const uAxis: 0 | 1 = role === "frame" ? 1 : 0;
  const uLen = role === "frame" ? s.h : s.w;
  const vLen = role === "frame" ? s.w : s.h;
  const N = 220;
  const front: (number | null)[] = [];
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    // frames: outer edge = section base (bottom of the drawing); shutters: outer = left
    let u = role === "frame" ? uLen * (1 - t) : uLen * t;
    if (flip) u = uLen - u;
    const xs = crossings(ps, u, uAxis);
    front.push(xs.length ? xs[0] : null);
  }
  const step = uLen / N;
  const raw: { c: string; line: boolean }[] = front.map((f, i) => {
    if (f === null) return { c: grey(118), line: false };
    const prev = front[i - 1], next = front[i + 1];
    const depth = f / Math.max(1, vLen);
    const slope = prev != null && next != null ? (next - prev) / (2 * step) : 0;
    const light = Math.round((232 - 150 * depth - 30 * Math.max(-1, Math.min(1, slope))) / 7) * 7;
    const jump = prev != null && Math.abs(f - prev) > 0.6;
    const edge = prev === null || next === null;
    return { c: grey(light), line: jump || (edge && i > 0 && prev !== undefined) };
  });
  // Lines are drawn at least ~2 % of the face wide, so they still show when a
  // 45 mm face is only a few pixels on a phone.
  const LINE = Math.max(0.6 / N, 0.018);
  const stops: Stop[] = [];
  let last = 0;
  const push = (o: number, c: string) => { last = Math.max(last, Math.min(1, o)); stops.push({ o: last, c }); };
  let runStart = 0;
  for (let i = 1; i <= N; i++) {
    const change = i === N || raw[i].c !== raw[runStart].c || raw[i].line;
    if (!change) continue;
    push(runStart / N, raw[runStart].c);
    push(i / N, raw[runStart].c);
    if (i < N && raw[i].line) { push(i / N - LINE / 2, "#59616c"); push(i / N + LINE / 2, "#59616c"); }
    runStart = i;
  }
  // a rounded outer edge and a shadow line where the piece meets the next one
  stops.unshift({ o: 0, c: "#8d96a1" }, { o: LINE, c: "#8d96a1" });
  stops.push({ o: 1 - LINE, c: "#7b848f" }, { o: 1, c: "#7b848f" });
  for (let i = 1; i < stops.length; i++) if (stops[i].o < stops[i - 1].o) stops[i].o = stops[i - 1].o;
  // keep the number of stops sane for the browser
  const out = stops.length > 160 ? stops.filter((_, i) => i % Math.ceil(stops.length / 160) === 0) : stops;
  cache.set(key, out);
  return out;
}
