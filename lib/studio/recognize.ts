/**
 * Know a section by its shape (founder: "sab section ki shakal yaad kar lo").
 *
 * Read off the traced drawing, the way a fabricator looks at a section:
 *  • a shutter has a deep channel on the track side (the roller / track goes in);
 *    a GLASS shutter has a glass pocket on the other side, a MESH (jali) shutter
 *    does not (OMEO 2081, Ample 41050 — founder);
 *  • a SLIM INTERLOCK takes the glass in a slot on its face;
 *  • a TRACK stands its running legs / U grooves up; one groove on a wide section
 *    is a Gulf SIDE track;
 *  • small sections are clips, rails and caps.
 * Casement (Z) and Bombay (bearing) sections are not covered yet.
 * Checked against sections whose role the founder or the catalogue gives
 * (evals/studio/recognize.ts).
 */
import { solidOf, box, slideUntilTouch, rayToMaterial, place, runners, type Solid } from "./assemble";

export type SectionRole = "glass-shutter" | "double-glass-shutter" | "mesh-shutter" | "track" | "side-track" | "slim-interlock" | "clip" | "other";

export interface Recognized { role: SectionRole; grooves?: number; why: string }

const GLASS = 5;
type Pocket = { travel: number; open: number };
type Ends = { deep: Pocket; glass: Pocket; hits: number };

/**
 * From one end along x (dir +1 from x = 0, −1 from x = w): the deepest channel a
 * roller / track could use (mouth ≤ 26, stops inside the section) and the deepest
 * glass pocket (8–24 mm deep; mouth up to ~16 single glass, wider = double glass).
 */
function endPocket(so: Solid, w: number, h: number, dir: 1 | -1): Ends {
  const edge = dir === 1 ? 0 : w;
  const best: Ends = { deep: { travel: 0, open: 0 }, glass: { travel: 0, open: 0 }, hits: 0 };
  for (let y = 2; y <= h - 2; y += 0.5) {
    const x = edge + dir * 1.2;
    const up = rayToMaterial(so, x, y, 0, -1, 30), dn = rayToMaterial(so, x, y, 0, 1, 30), open = up + dn;
    if (open < GLASS + 0.5 || open > 34) continue;
    const c = y + (dn - up) / 2, start = dir === 1 ? -12 : w + 2;
    const t = slideUntilTouch(box(start, c - GLASS / 2, start + 10, c + GLASS / 2), so, dir, 0, w + 14).dist - 2;
    if (t >= w - 2) continue; // went right through: no channel here
    if (open <= 26 && t > best.deep.travel) best.deep = { travel: t, open };
    // a glass pocket stops the glass 8–24 mm in; a real pocket shows over a few
    // positions (a wide mouth = double glass, founder). A jali shutter's far side is open.
    if (t >= 8 && t < 24) { best.hits++; if (t > best.glass.travel) best.glass = { travel: t, open }; }
  }
  return best;
}

/** a glass slot on the face: a 5 mm glass going in from the top or bottom edge */
function faceSlot(so: Solid, w: number, h: number): Pocket {
  let best: Pocket = { travel: 0, open: 0 };
  for (const dir of [1, -1] as const) {
    const edge = dir === 1 ? 0 : h;
    for (let x = 2; x <= w - 2; x += 0.5) {
      for (const d of [0.6, 1.2, 2, 3]) {
        const y = edge + dir * d;
        const l = rayToMaterial(so, x, y, -1, 0, 30), r = rayToMaterial(so, x, y, 1, 0, 30), open = l + r;
        if (open < GLASS + 0.5 || open > 16.5) continue;
        const c = x + (r - l) / 2, start = dir === 1 ? -12 : h + 2;
        const t = slideUntilTouch(box(c - GLASS / 2, start, c + GLASS / 2, start + 10), so, 0, dir, h + 14).dist - 2;
        if (t > best.travel) best = { travel: t, open };
      }
    }
  }
  return best;
}

export function recognize(shape: { w: number; h: number; paths: string[] }): Recognized {
  const { w, h } = shape;
  const so = solidOf(shape.paths);
  if (Math.max(w, h) <= 20) return { role: "clip", why: `small (${w} × ${h})` };

  // shutter: a deep channel at one end, and a glass pocket (or none) at the other
  const a = endPocket(so, w, h, 1), b = endPocket(so, w, h, -1);
  const deep = (e: Ends) => e.deep.travel >= 24;
  const glass = (e: Ends) => e.hits >= 3;
  if ((deep(a) && glass(b)) || (deep(b) && glass(a))) {
    const p = (deep(a) && glass(b) ? b : a).glass;
    if (p.open > 16.5) return { role: "double-glass-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; wide glass side (${p.open.toFixed(0)} mm) — double glass` };
    return { role: "glass-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; glass goes ${(deep(a) ? b : a).glass.travel.toFixed(0)} mm into the other side` };
  }
  if ((deep(a) && !glass(b)) || (deep(b) && !glass(a))) {
    if (h >= 18 && w >= 40 && !(deep(a) && deep(b)))
      return { role: "mesh-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; the other side is open, no glass pocket` };
  }

  // track: two or more U grooves / running legs standing up
  const r = w >= 35 && h >= 20 ? runners(place(so, 1, 0, 0, 0, -1, h), w, h) : undefined;
  if (r && r.kind === "U" && r.at.length >= 2) return { role: "track", grooves: r.at.length, why: `${r.at.length} U grooves` };

  // slim interlock: the glass goes into a slot on its face
  const s = faceSlot(so, w, h);
  if (s.travel >= 8 && s.travel <= 20 && h <= 30) return { role: "slim-interlock", why: `glass slot on the face, ${s.travel.toFixed(0)} mm deep` };

  if (r) {
    if (r.kind === "U" && r.at.length === 1 && w >= 60) return { role: "side-track", grooves: 1, why: "one groove on a wide section — Gulf side track" };
    if (r.at.length >= 2 || (r.kind === "leg" && r.at.length === 1 && w < 60))
      return { role: "track", grooves: r.at.length, why: `${r.at.length} running legs` };
  }
  return { role: "other", why: "no shutter channel, glass slot or track grooves" };
}
