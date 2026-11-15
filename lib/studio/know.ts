/**
 * The section reader's window knowledge (founder 2026-11-15: "section pehchanne
 * wale tool ko sikhao window kaise banti hai, kaunsa system kaise kaam karta hai").
 *
 * Two things a fabricator does when he sees a new section:
 *  1. compares it with every section he already knows — "this is the same shape as
 *     2046, the domal glass shutter" — even when the size or the maker differs;
 *  2. knows what that piece does in a window and how it is cut, and in which
 *     systems it goes.
 *
 * Every traced section the app's systems use is the "known" set. A new drawing is
 * compared shape-to-shape (any turn or mirror), and the closest known sections
 * give its job, the systems it fits and how it is cut. See docs/WINDOW-KNOWLEDGE.md.
 */
import type { ProfileKind } from "./model";
import { BUILT_IN_PROFILES, TEMPLATES, OFFERED } from "./templates";
import { shapeOf } from "./shapes";
import { partLabel } from "./edit";
import { noMaker } from "./format";
import { recognize, type Recognized, type SectionRole } from "./recognize";

type Shape = { w: number; h: number; paths: string[] };

/** What each kind of piece does in a window and how it is cut — shop words. */
export const KIND_KNOWLEDGE: Record<ProfileKind, string> = {
  track: "Fixed outer track the shutters run in. Top, bottom and sides; Bombay and Gulf screw it at 90°, Euro and Domal mitre it at 45°.",
  frame: "Outer frame that goes round all 4 sides at 45°, full width and full height; the shutters run in its grooves.",
  handle: "Upright of the shutter at the lock side, full shutter height. In Gulf series it is the shutter's side piece (the top and bottom are a different section).",
  interlock: "Upright where two shutters meet and hook into each other, full shutter height.",
  "slim-interlock": "Narrow upright that replaces the shutter section on the meeting side; the glass goes into a slot on its face, so the glass is wider than with a clip.",
  bearing: "Top and bottom piece of a Bombay shutter, fitted between the handle and the interlock (shutter width − both uprights); the roller sits in the bottom one. An H-section joins two panels the same way.",
  shutter: "One section that goes round all 4 sides of the shutter at 45°; glass = shutter size − the glass pocket on both sides.",
  "shutter-rail": "Shutter top and bottom only (Gulf); the sides are a different section. Glass height comes from this pocket.",
  "mesh-shutter": "Jali (mosquito net) shutter: same track channel as the glass shutter but no glass pocket; cut like the glass shutter.",
  "interlock-patti": "Strip screwed on each meeting upright so the shutters hook — two per meeting point, cut to the shutter height at 90°.",
  rail: "Small clip or rail in the bottom track that the roller runs on; cut to the clear width between the side tracks at 90°.",
  bead: "Glazing clip that holds the glass in the sash; cut to the glass pocket at 90°.",
  mullion: "Centre upright between two openable sashes, between the outer top and bottom (H − 2 × frame).",
  other: "",
};

export interface KnownUse { system: string; piece: string; angle: 90 | 45 }
export interface KnownSection { code: string; kind: ProfileKind; name: string; w: number; h: number; uses: KnownUse[]; grid: Float32Array }
export interface Match { code: string; kind: ProfileKind; name: string; score: number; sameSize: boolean; uses: KnownUse[] }

/** Not used in shops (founder) — never suggested. 41289 is an H-section, not a slim. */
const NOT_USED = new Set(["914698", "914744", "992328"]);
const KIND_FIX: Record<string, ProfileKind> = { "41289": "bearing" };

export const G = 10;            // grid cells per side
const PX = 300;                 // raster pixels on the long side

/**
 * How much of each grid cell is metal (0–1), over the section's own box.
 * A photo of a catalogue page drags in dimension lines, arrows and numbers;
 * a fabricator's eye skips them, and so does this: lines much thinner than the
 * section's walls are opened away and only the big body (and pieces near its
 * size) is kept before the box is taken.
 */
export function fingerprint(shape: Shape): Float32Array {
  const loops = shape.paths.map((p) => [...p.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [+m[1], +m[2]])).filter((l) => l.length >= 3);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of loops) for (const [x, y] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const out = new Float32Array(G * G);
  if (!isFinite(x0) || x1 - x0 <= 0 || y1 - y0 <= 0) return out;
  // 1. raster (scanline, even-odd)
  const s = Math.max(x1 - x0, y1 - y0) / PX;
  const W = Math.max(8, Math.ceil((x1 - x0) / s)), H = Math.max(8, Math.ceil((y1 - y0) / s));
  let img = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const y = y0 + (r + 0.5) * s, xs: number[] = [];
    for (const l of loops) for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
      const [xi, yi] = l[i], [xj, yj] = l[j];
      if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - x0) / s - 0.5)), c1 = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / s - 0.5));
      for (let c = c0; c <= c1; c++) img[r * W + c] = 1;
    }
  }
  // 2. open away hair lines (dimension and arrow lines), keep walls
  const step = (src: Uint8Array, keep: boolean) => {
    const d = new Uint8Array(W * H);
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const i = r * W + c;
      const n = [src[i], c > 0 ? src[i - 1] : 0, c < W - 1 ? src[i + 1] : 0, r > 0 ? src[i - W] : 0, r < H - 1 ? src[i + W] : 0];
      d[i] = keep ? (n.every(Boolean) ? 1 : 0) : (n.some(Boolean) ? 1 : 0);
    }
    return d;
  };
  // only hair lines on the side go; a drawing whose walls are themselves drawn as thin
  // outlines (a CAD trace) would mostly vanish — keep it as it is
  let before = 0; for (const v of img) before += v;
  for (const k of [2, 1]) {
    let o = img;
    for (let i = 0; i < k; i++) o = step(o, true);
    for (let i = 0; i < k; i++) o = step(o, false);
    let after = 0; for (const v of o) after += v;
    if (after >= before * 0.6) { img = o; break; }
  }
  // every wall the same weight, so a drawn outline and a filled photo of one section look alike
  for (let k = 0; k < 5; k++) img = step(img, false);
  // 3. keep the main body and pieces at least a fifth of its size (numbers, arrows go)
  const lab = new Int32Array(W * H).fill(-1), sizes: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!img[i] || lab[i] >= 0) continue;
    const id = sizes.length, st = [i]; lab[i] = id; let n = 0;
    while (st.length) {
      const p = st.pop()!; n++;
      const r = (p / W) | 0, c = p % W;
      for (const q of [c > 0 ? p - 1 : -1, c < W - 1 ? p + 1 : -1, r > 0 ? p - W : -1, r < H - 1 ? p + W : -1])
        if (q >= 0 && img[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
    }
    sizes.push(n);
  }
  const big = Math.max(0, ...sizes);
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let i = 0; i < W * H; i++) {
    if (lab[i] < 0 || sizes[lab[i]] < big * 0.2) { img[i] = 0; continue; }
    const r = (i / W) | 0, c = i % W;
    bx0 = Math.min(bx0, c); bx1 = Math.max(bx1, c); by0 = Math.min(by0, r); by1 = Math.max(by1, r);
  }
  if (bx1 < bx0) return out;
  // 4. share of metal in each grid cell over the body's box
  const cw = (bx1 - bx0 + 1) / G, ch = (by1 - by0 + 1) / G, cell = cw * ch;
  for (let r = by0; r <= by1; r++) for (let c = bx0; c <= bx1; c++)
    if (img[r * W + c]) out[Math.min(G - 1, Math.floor((r - by0) / ch)) * G + Math.min(G - 1, Math.floor((c - bx0) / cw))] += 1 / cell;
  return out;
}

/** the 8 turns / mirrors of a grid; odd ones swap width and height */
function variants(g: Float32Array): { g: Float32Array; swap: boolean }[] {
  const out: { g: Float32Array; swap: boolean }[] = [];
  for (let t = 0; t < 8; t++) {
    const v = new Float32Array(G * G), swap = t >= 4;
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
      let rr = r, cc = c;
      if (swap) [rr, cc] = [c, r];
      if (t & 1) cc = G - 1 - cc;
      if (t & 2) rr = G - 1 - rr;
      v[rr * G + cc] = g[r * G + c];
    }
    out.push({ g: v, swap });
  }
  return out;
}

/** weighted overlap 0–1 (1 = the same metal in the same places) */
function overlap(a: Float32Array, b: Float32Array): number {
  let lo = 0, hi = 0;
  for (let i = 0; i < a.length; i++) { lo += Math.min(a[i], b[i]); hi += Math.max(a[i], b[i]); }
  return hi ? lo / hi : 0;
}

let cache: KnownSection[] | null = null;
/** Every traced section the app's systems use, with where it goes. */
export function knownSections(): KnownSection[] {
  if (cache) return cache;
  const by = new Map<string, KnownSection>();
  const add = (pid: string, use?: KnownUse) => {
    const p = BUILT_IN_PROFILES.find((x) => x.id === pid);
    const s = shapeOf(p);
    if (!p || !s || NOT_USED.has(s.code)) return;
    let k = by.get(s.code);
    if (!k) {
      k = { code: s.code, kind: KIND_FIX[s.code] ?? p.kind ?? "other", name: noMaker(p.name), w: s.w, h: s.h, uses: [], grid: fingerprint(s) };
      by.set(s.code, k);
    }
    if (use && !k.uses.some((u) => u.system === use.system && u.piece === use.piece)) k.uses.push(use);
  };
  // the systems the app offers first: their kinds are the founder-checked ones
  for (const t of TEMPLATES) {
    if (!OFFERED.has(t.id) || t.id.startsWith("blank")) continue;
    for (const part of t.parts) {
      const use = { system: t.name, piece: partLabel(part), angle: part.angle };
      for (const c of part.profile) if (c.id) add(c.id, use);
      if (part.meshProfile) add(part.meshProfile, { ...use, piece: `${use.piece} (mesh)` });
    }
  }
  for (const p of BUILT_IN_PROFILES) add(p.id);
  cache = [...by.values()];
  return cache;
}

/** The known sections closest in shape to this drawing, best first. */
export function closest(shape: Shape, n = 3): Match[] {
  const vs = variants(fingerprint(shape));
  const rows = knownSections().map((k) => {
    let best = 0, swapped = false;
    for (const v of vs) { const o = overlap(v.g, k.grid); if (o > best) { best = o; swapped = v.swap; } }
    const [w, h] = swapped ? [shape.h, shape.w] : [shape.w, shape.h];
    const sameSize = Math.abs(w - k.w) <= Math.max(1.5, k.w * 0.04) && Math.abs(h - k.h) <= Math.max(1.5, k.h * 0.04);
    return { code: k.code, kind: k.kind, name: k.name, score: best, sameSize, uses: k.uses };
  });
  return rows.sort((a, b) => b.score - a.score).slice(0, n);
}

/** Clear enough to say "this is that section" / "this does that job". */
export const SAME_SHAPE = 0.8;
export const LIKE_SHAPE = 0.62;
const SAME_PHOTO = 0.68;

/** The shape's job in the form's own words. */
export const ROLE_KIND: Record<SectionRole, ProfileKind | null> = {
  "glass-shutter": "shutter", "double-glass-shutter": "shutter", "mesh-shutter": "mesh-shutter",
  track: "track", "side-track": "track", "slim-interlock": "slim-interlock", clip: "rail", "interlock-clip": "interlock-patti", interlock: "interlock", bead: "bead", other: null,
};

export interface Reading {
  /** what the shape rules say (recognize.ts) */
  seen: Recognized;
  /** the job: from the shape rules, or — when they cannot tell — from the closest known section */
  kind: ProfileKind | null;
  /** a known section with the same shape and size: "this is 2046" */
  same?: Match;
  /** known sections close in shape (for where it goes and how it is cut) */
  like: Match[];
}

/** Read a section like a fabricator: its shape, the section it matches, and where that goes. */
export function readSection(shape: Shape): Reading {
  const seen = recognize(shape);
  const near = closest(shape, 4);
  // the same size and (almost) the best shape: that section. A photo trace is rougher than a
  // catalogue trace, so a near-best same-size match counts too.
  const same = near.find((m) => m.sameSize && (m.score >= SAME_SHAPE || (m.score >= SAME_PHOTO && m.score >= near[0].score - 0.06)));
  const like = near.filter((m) => m.score >= LIKE_SHAPE && m !== same).slice(0, 2);
  const kind = same?.kind ?? ROLE_KIND[seen.role] ?? like[0]?.kind ?? null;
  return { seen, kind, same, like };
}

/**
 * Of the tracer's readings of one picture (usual one first), the one a fabricator
 * would take: the one that matches a known section of the typed size clearly
 * better. Unknown sections keep the tracer's usual reading.
 */
export function bestTrace<T extends Shape>(options: T[]): T | undefined {
  if (options.length <= 1) return options[0];
  const fit = (o: T) => Math.max(0, ...closest(o, 6).filter((m) => m.sameSize).map((m) => m.score));
  const base = fit(options[0]);
  let best = options[0], top = base;
  for (const o of options.slice(1)) { const f = fit(o); if (f > top) { top = f; best = o; } }
  return top >= base + 0.04 && top >= SAME_PHOTO ? best : options[0];
}
