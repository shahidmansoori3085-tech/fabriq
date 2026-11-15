/**
 * Measures read off a traced section drawing, shared by the drawing checks
 * (evals/studio/geometry.ts) and the 3D meeting view: where a shutter holds its
 * glass, and where a slim interlock takes the glass on its face.
 */
import { solidOf, rayToMaterial, inside } from "./assemble";

type Sh = { w: number; h: number; paths: string[]; code?: string };

/** Glass line of a shutter section across its thickness (shape y): centre of its glass pocket. */
export function glassPlane(s: Sh): number | undefined {
  const so = solidOf(s.paths); let best: { c: number; depth: number } | undefined;
  for (const ins of [1.2, 2, 3, 4.5]) for (const [x, dir] of [[ins, 1], [s.w - ins, -1]] as const) {
    let y = 0.2;
    while (y < s.h) {
      if (inside(so, x, y)) { y += 0.1; continue; }
      let e = y; while (e < s.h && !inside(so, x, e)) e += 0.1;
      const c = (y + e) / 2, open = e - y, depth = rayToMaterial(so, dir === 1 ? -1 : s.w + 1, c, dir, 0, s.w + 2);
      if (y > 0.3 && e < s.h - 0.3 && open >= 4.5 && open <= 22 && depth >= 6 && depth <= 32 && c > 3 && c < s.h - 3 && (!best || depth > best.depth)) best = { c, depth };
      y = e;
    }
  }
  if (best) return best.c;
  // a wide bead-type glass mouth (6712, 6003): the glass line is its centre
  for (const [x, dir] of [[1.2, 1], [s.w - 1.2, -1]] as const) {
    let y = 0.2;
    while (y < s.h) {
      if (inside(so, x, y)) { y += 0.1; continue; }
      let e = y; while (e < s.h && !inside(so, x, e)) e += 0.1;
      const c = (y + e) / 2, depth = rayToMaterial(so, dir === 1 ? -1 : s.w + 1, c, dir, 0, s.w + 2);
      if (e - y >= s.h * 0.6 && depth >= 6 && depth <= 32) return c;
      y = e;
    }
  }
  return undefined;
}

/**
 * Slots measured by hand on the enlarged catalogue drawing, where the trace closes the slot.
 * BH-6709: Banu Hashim p.68 at 14.2 px/mm (89.86 = 1279 px, 31 = 442 px): slot mouth 13.8 mm,
 * its centre 25.3 mm from the hook edge (6707: 24.95), 20 mm deep, opening at the top.
 */
const MEASURED: Record<string, { c: number; from: "top" | "bottom" }> = { "BH-6709": { c: 25.3, from: "top" } };

/** A slim interlock's glass slot: its centre across the thickness (shape x) and the face it opens on. */
export function slimSlotAt(s: Sh): { c: number; from: "top" | "bottom" } | undefined {
  if (s.code && MEASURED[s.code]) return MEASURED[s.code];
  const so = solidOf(s.paths); let best: { c: number; depth: number; from: "top" | "bottom" } | undefined;
  for (const ins of [0.8, 1.5, 2.5, 3.5]) for (const [y, dir] of [[ins, 1], [s.h - ins, -1]] as const) {
    let x = 0.2;
    while (x < s.w) {
      if (inside(so, x, y)) { x += 0.1; continue; }
      let e = x; while (e < s.w && !inside(so, e, y)) e += 0.1;
      const c = (x + e) / 2, open = e - x, depth = rayToMaterial(so, c, dir === 1 ? -1 : s.h + 1, 0, dir, s.h + 2);
      if (x > 0.3 && e < s.w - 0.3 && open >= 4.5 && open <= 30 && depth >= 6 && (!best || depth > best.depth)) best = { c, depth, from: dir === 1 ? "top" : "bottom" };
      x = e;
    }
  }
  return best && { c: best.c, from: best.from };
}
