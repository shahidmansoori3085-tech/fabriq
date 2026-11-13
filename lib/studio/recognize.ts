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
import { solidOf, box, slideUntilTouch, rayToMaterial, place, runners, tipAt, inside, type Solid } from "./assemble";

export type SectionRole = "glass-shutter" | "double-glass-shutter" | "mesh-shutter" | "track" | "side-track" | "slim-interlock" | "clip" | "interlock-clip" | "bead" | "other";

export interface Recognized { role: SectionRole; grooves?: number; why: string }

const GLASS = 5;
type Pocket = { travel: number; open: number; inner?: number };
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
    if (t >= 8 && t < 24) {
      best.hits++;
      if (t > best.glass.travel) {
        // the glass channel's own width: narrowest gap along the pocket (behind it may open into a chamber)
        let inner = Infinity;
        for (let d = 0.3; d < t - 1; d += 0.3) {
          const xi = edge + dir * d, g = rayToMaterial(so, xi, c, 0, -1, 30) + rayToMaterial(so, xi, c, 0, 1, 30);
          if (g >= GLASS) inner = Math.min(inner, g);
        }
        best.glass = { travel: t, open, inner };
      }
    }
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
        if (open < GLASS + 0.5 || open > 34) continue; // up to double glass
        const c = x + (r - l) / 2, start = dir === 1 ? -12 : h + 2;
        const t = slideUntilTouch(box(c - GLASS / 2, start, c + GLASS / 2, start + 10), so, 0, dir, h + 14).dist - 2;
        if (t >= 8 && t <= 20 && t > best.travel) best = { travel: t, open };
      }
    }
  }
  return best;
}

export function recognize(shape: { w: number; h: number; paths: string[] }): Recognized {
  const { w, h } = shape;
  const so = solidOf(shape.paths);
  if (Math.max(w, h) <= 20) {
    let same = 0, n = 0;
    for (let i = 1; i < 20; i++) for (let j = 1; j < 20; j++) {
      const x = (i / 20) * w, y = (j / 20) * h, p = inside(so, x, y), q = inside(so, w - x, y);
      if (p || q) { n++; if (p === q) same++; }
    }
    return same / Math.max(1, n) >= 0.7
      ? { role: "clip", why: `small (${w} × ${h}), same on both sides — track clip / rail` }
      : { role: "bead", why: `small (${w} × ${h}), one-sided — glazing clip / patti` };
  }

  // shutter: a deep channel at one end, and a glass pocket (or none) at the other
  const a = endPocket(so, w, h, 1), b = endPocket(so, w, h, -1);
  const deep = (e: Ends) => e.deep.travel >= 24;
  const glass = (e: Ends) => e.hits >= 3;
  if ((deep(a) && glass(b)) || (deep(b) && glass(a))) {
    const p = (deep(a) && glass(b) ? b : a).glass;
    // narrowest point from the mouth inward: a domal pocket is a wide chamber behind a ~10 mm mouth
    const width = Math.min(p.open, p.inner ?? p.open);
    if (width > 17) return { role: "double-glass-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; glass pocket ${width.toFixed(0)} mm wide — double glass` };
    return { role: "glass-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; glass goes ${(deep(a) ? b : a).glass.travel.toFixed(0)} mm into the other side` };
  }
  if ((deep(a) && !glass(b)) || (deep(b) && !glass(a))) {
    if (h >= 18 && w >= 40 && !(deep(a) && deep(b)))
      return { role: "mesh-shutter", why: `track channel ${Math.max(a.deep.travel, b.deep.travel).toFixed(0)} mm deep; the other side is open, no glass pocket` };
  }

  // track: two or more U grooves / running legs standing up
  const r = w >= 35 && h >= 20 ? runners(place(so, 1, 0, 0, 0, -1, h), w, h) : undefined;
  if (r && r.kind === "U" && r.at.length >= 2) return { role: "track", grooves: r.at.length, why: `${r.at.length} U grooves` };

  if (r && r.kind === "U" && r.at.length === 1 && w >= 60 && h >= 24) return { role: "side-track", grooves: 1, why: "one groove on a wide section — Gulf side track" };

  // slim interlock: the glass goes into a slot on its face (single or double glass)
  const s = faceSlot(so, w, h);
  if (s.travel >= 8 && s.travel <= 20 && h <= 30) return { role: "slim-interlock", why: `glass slot on the face, ${s.travel.toFixed(0)} mm deep${s.open > 17 ? " (double glass)" : ""}` };

  // domal-type track: two or more running legs with a deep space between them
  if (r && r.kind === "leg" && r.at.length >= 2 && w >= 40) {
    const t = place(so, 1, 0, 0, 0, -1, h);
    // deepest point between the first two legs (a rail can stand in the middle, as in Bombay tracks)
    let low = h;
    for (let x = r.at[0] + 3; x <= r.at[1] - 3; x += 0.5) low = Math.min(low, tipAt(t, x, h + 5));
    const valley = h - low;
    if (valley >= 12) return { role: "track", grooves: r.at.length, why: `${r.at.length} running legs` };
  }

  // interlock clip: thin walls, one side a straight wall the whole way, the opposite side open (it snaps on the shutter).
  // Below 4.5 % metal it is only an outline drawing (e.g. a CAD trace), not a solid section.
  if (Math.max(w, h) <= 46 && Math.min(w, h) >= 24) {
    let fill = 0, n = 0;
    for (let x = 0.25; x < w; x += 0.5) for (let y = 0.25; y < h; y += 0.5) { n++; if (inside(so, x, y)) fill++; }
    const cov = (horiz: boolean, near0: boolean) => {
      const L = horiz ? w : h, D = horiz ? h : w; let hit = 0, m = 0;
      for (let t = 0.5; t < L; t += 0.5) {
        m++;
        for (let k = 0.1; k < 3; k += 0.2) { const o = near0 ? k : D - k; if (horiz ? inside(so, t, o) : inside(so, o, t)) { hit++; break; } }
      }
      return hit / m;
    };
    const t = cov(true, true), b = cov(true, false), l = cov(false, true), rr = cov(false, false);
    const wall = (t >= 0.9 && b <= 0.25) || (b >= 0.9 && t <= 0.25) || (l >= 0.9 && rr <= 0.25) || (rr >= 0.9 && l <= 0.25);
    if (fill / n >= 0.045 && fill / n <= 0.15 && wall) return { role: "interlock-clip", why: "thin, one straight wall with the other side open — snaps on the shutter at the meeting" };
  }
  return { role: "other", why: "no shutter channel, glass slot or track grooves" };
}
