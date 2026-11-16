/**
 * Where two shutters meet, seen from above (X along the window, Z across the frame):
 * each shutter on its own lane (from the cutaway layout), its meeting upright — the slim
 * interlock or the shutter section with its interlock clip — placed on its own glass line,
 * the hook turned toward the other shutter, the second one point-symmetric to the first
 * (that is how a pair of interlocks is fitted). The glass lines and hook reach are the
 * same measures the drawing checks use (lib/studio/measure.ts).
 */
import { solidOf, bounds, inside, type Solid } from "./assemble";
import { glassPlane, slimSlotAt } from "./measure";
import type { Cutaway, CutLane } from "./cutaway";
import type { Shape } from "./shapes";

export interface MeetSide {
  lane: CutLane;
  /** glass line across the frame */
  zg: number;
  /** the meeting upright(s), horizontal section in (X, Z) */
  uprights: Solid[];
  /** where the shutter's bottom rail and glass run along X */
  railFrom: number; railTo: number; glassFrom: number; glassTo: number;
}

export interface Meeting { kind: "slim" | "clip"; M: number; sides: [MeetSide, MeetSide] }

const map = (sol: Solid, f: (x: number, y: number) => [number, number]): Solid => sol.map((l) => l.map(([x, y]) => f(x, y)));

/** run of the window shown each side of the meeting, mm */
export const MEET_RUN = 240;

export function buildMeeting(cut: Cutaway, meetClip?: Shape): Meeting | null {
  // the meeting shown is two glass shutters side by side when there are; a mesh shutter carries
  // no slim and no interlock clip (founder 2026-11-16)
  const byIdx = [...cut.lanes].sort((p, q) => p.shutter - q.shutter);
  const pairAt = byIdx.findIndex((l, i) => i < byIdx.length - 1 && l.kind !== "J" && byIdx[i + 1].kind !== "J");
  const A = byIdx[pairAt >= 0 ? pairAt : 0], B = byIdx[pairAt >= 0 ? pairAt + 1 : 1];
  if (!A || !B || !A.meet || !B.meet) return null;
  const M = 0;
  const zgOf = (ln: CutLane) => ln.depth0 + (glassPlane(ln.bottom) ?? ln.thick / 2);
  const zA = zgOf(A), zB = zgOf(B);
  const slim = (ln: CutLane) => !!ln.meet && ln.meet.code !== (ln.lock ?? ln.bottom).code && !!slimSlotAt(ln.meet);

  if (slim(A) && slim(B)) {
    const side = (ln: CutLane, zg: number, zn: number, left: boolean): MeetSide => {
      const s = ln.meet!, slot = slimSlotAt(s)!;
      const sides = [slot.c, s.w - slot.c];
      // a big (reinforcement) slim carries its tube on the face side; its hook is the short side
      const reinforced = Math.max(...sides) > ln.thick;
      const hookPlus = reinforced ? s.w - slot.c < slot.c : s.w - slot.c > slot.c;
      const dir = Math.sign(zn - zg) || 1;
      const k = hookPlus ? dir : -dir;
      // the glass enters from the slot side: the left shutter's glass is to the left (smaller X)
      const glassAtY0 = slot.from === "top";
      const X = (y: number) => {
        const fromGlass = glassAtY0 ? y : s.h - y;
        return left ? M - s.h / 2 + fromGlass : M + s.h / 2 - fromGlass;
      };
      const up = map(solidOf(s.paths), (x, y) => [X(y), zg + k * (x - slot.c)]);
      const glassEdge = left ? M - s.h / 2 + 0.55 * s.h : M + s.h / 2 - 0.55 * s.h;
      return left
        ? { lane: ln, zg, uprights: [up], railFrom: M - MEET_RUN, railTo: M - s.h / 2, glassFrom: M - MEET_RUN, glassTo: glassEdge }
        : { lane: ln, zg, uprights: [up], railFrom: M + s.h / 2, railTo: M + MEET_RUN, glassFrom: glassEdge, glassTo: M + MEET_RUN };
    };
    return { kind: "slim", M, sides: [side(A, zA, zB, true), side(B, zB, zA, false)] };
  }

  // shutter section on both sides, each with its interlock clip
  const fit = meetClip ? fitClip(meetClip) : undefined;
  const dirA = Math.sign(zB - zA) || 1;
  const backOf = (ln: CutLane, dir: number) => (dir > 0 ? ln.depth0 + ln.thick : ln.depth0);
  // the clip as fitted on a shutter whose meeting edge is at `edge`
  const placeClip = (left: boolean, edge: number, zBack: number, dir: number): Solid =>
    fit!.uv.map((l) => l.map(([u, v]) => [left ? edge + (u - fit!.uFace) : edge - (u - fit!.uFace), zBack + dir * (v - fit!.vFace)] as [number, number]));
  // how far the shutters overlap: where the two clips sit locked into each other,
  // found by sliding one past the other until they nest without clashing
  const ov = fit ? lockOverlap(fit, backOf(A, dirA), backOf(B, -dirA), dirA, placeClip) : 18;
  const side = (ln: CutLane, zg: number, zn: number, left: boolean): MeetSide => {
    const s = ln.meet!, own = solidOf(s.paths), ob = bounds(own);
    const edge = left ? M + ov / 2 : M - ov / 2;
    // the section's mouth (the channel that faces the track on the bottom rail) is its meeting edge
    const f = (x: number) => (ln.mouth === "start" ? x - ob.x0 : ob.x1 - x);
    const stile = map(own, (x, y) => [left ? edge - f(x) : edge + f(x), y + ln.depth0]);
    const ups: Solid[] = [stile];
    if (fit && ln.kind !== "J") {
      // one end of the clip is pressed into the shutter's mouth, the other lies on the shutter's
      // back (the face toward the other shutter); the other shutter's clip is the same, turned
      // round, and the two lock into each other
      const dir = Math.sign(zn - zg) || 1;
      ups.push(placeClip(left, edge, backOf(ln, dir), dir));
    }
    const glassEdge = left ? edge - ln.face * 0.7 : edge + ln.face * 0.7;
    return left
      ? { lane: ln, zg, uprights: ups, railFrom: M - MEET_RUN, railTo: edge - ln.face, glassFrom: M - MEET_RUN, glassTo: glassEdge }
      : { lane: ln, zg, uprights: ups, railFrom: edge + ln.face, railTo: M + MEET_RUN, glassFrom: glassEdge, glassTo: M + MEET_RUN };
  };
  return { kind: "clip", M, sides: [side(A, zA, zB, true), side(B, zB, zA, false)] };
}

/**
 * An interlock clip read off its drawing: the leg (the wall pressed into the shutter's mouth)
 * and the flange (the wall that lies on the shutter's back) are its two fullest walls on
 * adjacent sides; the leg is the shorter one (it spans the shutter's thickness).
 * In (u, v): u grows out of the shutter across its mouth, v out of its back face.
 */
interface ClipFit { uv: Solid; U: number; V: number; uFace: number; vFace: number }

function fitClip(clip: Shape): ClipFit {
  const sol = solidOf(clip.paths), b = bounds(sol);
  const W = b.x1 - b.x0, H = b.y1 - b.y0, st = 0.1;
  // how much of a side is wall: material within 1.5 mm of that side
  const fill = (side: "x0" | "x1" | "y0" | "y1") => {
    const along = side[0] === "x" ? H : W; let n = 0, k = 0;
    for (let t = 0.5; t < along - 0.5; t += 0.5, k++) {
      for (let d = 0.1; d < 1.5; d += 0.2) {
        const [x, y] = side === "x0" ? [b.x0 + d, b.y0 + t] : side === "x1" ? [b.x1 - d, b.y0 + t] : side === "y0" ? [b.x0 + t, b.y0 + d] : [b.x0 + t, b.y1 - d];
        if (inside(sol, x, y)) { n++; break; }
      }
    }
    return k ? (n / k) * along : 0;
  };
  const f = { x0: fill("x0"), x1: fill("x1"), y0: fill("y0"), y1: fill("y1") };
  let pick = { xs: "x1", ys: "y1", s: -1 };
  for (const xs of ["x0", "x1"] as const) for (const ys of ["y0", "y1"] as const) if (f[xs] + f[ys] > pick.s) pick = { xs, ys, s: f[xs] + f[ys] };
  const [leg, fl] = H <= W ? [pick.xs, pick.ys] : [pick.ys, pick.xs];
  const coord = (side: string, x: number, y: number) =>
    side === "x1" ? x - b.x0 : side === "x0" ? b.x1 - x : side === "y1" ? y - b.y0 : b.y1 - y;
  const uv: Solid = sol.map((l) => l.map(([x, y]) => [coord(leg, x, y), coord(fl, x, y)] as [number, number]));
  const U = leg[0] === "x" ? W : H, V = leg[0] === "x" ? H : W;
  const into = (u: number, v: number) => inside(uv, u, v);
  // leg thickness: along rows clear of the flange, the wall run in from the outer side
  const runs: number[] = [];
  for (let v = V * 0.1; v < V * 0.6; v += 0.5) {
    let u = U - 0.05; if (!into(u, v)) continue;
    while (u > 0 && into(u, v)) u -= st;
    runs.push(U - u);
  }
  runs.sort((p, q) => p - q);
  const uFace = U - (runs.length ? runs[runs.length >> 1] : 1);
  // the flange's inner surface: the lowest material across the flange, clear of the leg
  let vFace = V;
  for (let u = 0.3; u < uFace - 1.5; u += 0.3) for (let v = Math.max(0, V - 8); v < V; v += st) if (into(u, v)) { vFace = Math.min(vFace, v); break; }
  return { uv, U, V, uFace, vFace };
}

/** The shutter overlap at which the two clips nest into each other with the least clash. */
function lockOverlap(fit: ClipFit, zBackA: number, zBackB: number, dirA: number,
  place: (left: boolean, edge: number, zBack: number, dir: number) => Solid): number {
  const A = place(true, 0, zBackA, dirA), ab = bounds(A);
  const pts: [number, number][] = [];
  for (let x = ab.x0; x <= ab.x1; x += 0.3) for (let z = ab.y0; z <= ab.y1; z += 0.3) if (inside(A, x, z)) pts.push([x, z]);
  const B0 = place(false, 0, zBackB, -dirA);
  const L = fit.U, target = 1.3 * L;
  let best = { ov: target, hit: Infinity };
  for (let ov = 0.3 * L; ov <= 1.6 * L; ov += 0.5) {
    // B's edge sits ov behind A's: test A's points in B's own frame
    let hit = 0; for (const [x, z] of pts) if (inside(B0, x + ov, z)) hit++;
    if (hit < best.hit || (hit === best.hit && Math.abs(ov - target) < Math.abs(best.ov - target))) best = { ov, hit };
  }
  return best.ov;
}
