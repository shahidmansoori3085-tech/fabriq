/**
 * Front-view geometry of a sliding window, in mm, to scale — built from the
 * same system data the cut list uses: the section each piece is made of gives
 * its visible face, the system's sizes give shutter and glass sizes. One
 * source, so the drawing can never show a different window from the cut list.
 */
import type { PartDef, Place, ProfileDef, StudioSystem } from "./model";
import { jobVars, matches, computeSizes, type StudioJob } from "./evaluate";

export type Pt = [number, number];

export interface Member {
  partId: string;
  place: Place;
  /** shutter index for sash pieces */
  shutter?: number;
  poly: Pt[];
  /** the section is known (false = drawn at a typical size) */
  known: boolean;
  vertical: boolean;
}

export interface ShutterGeo {
  index: number;
  kind: "G" | "J" | "S";
  x: number; y: number; w: number; h: number;
  /** glass / mesh opening */
  pane: { x: number; y: number; w: number; h: number };
  lockSide: "left" | "right";
  track: number;
}

export interface WindowGeo {
  W: number; H: number;
  frame: Member[];
  shutters: ShutterGeo[];
  sash: Member[];
  patti: Member[];
  faces: { top: number; bottom: number; left: number; right: number };
  mitre: boolean;
  shutterW: number; shutterH: number;
  /** shutter sizes came from the system's rules (false = estimated for the picture) */
  sizesKnown: boolean;
}

const TYPICAL: Record<string, number> = { frame: 45, sash: 55, patti: 9 };

/** Width of a section seen from the front, mm. */
export function faceOf(p: ProfileDef | undefined, role: "frame" | "sash" | "patti"): { mm: number; known: boolean } {
  if (p?.faceMm) return { mm: p.faceMm, known: true };
  const nums = (p?.size ?? "").split(/[×x*]/).map((s) => parseFloat(s)).filter((n) => n > 0);
  if (nums.length === 2) {
    if (role === "frame") return { mm: Math.min(...nums), known: true };
    if (role === "patti") return { mm: Math.min(...nums), known: true };
    return { mm: Math.max(...nums), known: true };
  }
  return { mm: TYPICAL[role], known: false };
}

const placeRole = (pl: Place | undefined): "frame" | "sash" | "patti" =>
  pl?.startsWith("frame") ? "frame" : pl === "meeting" ? "patti" : "sash";

export function profileOf(sys: StudioSystem, part: PartDef, vars: Record<string, string>, extra?: Record<string, string>): string {
  const v = extra ? { ...vars, ...extra } : vars;
  return (part.profile.find((c) => matches(c.when, v)) ?? part.profile[part.profile.length - 1])?.id ?? "";
}

export function windowGeometry(
  sys: StudioSystem, job: StudioJob, find: (id: string) => ProfileDef | undefined,
): WindowGeo {
  const W = job.W / 1000, H = job.H / 1000; // job sizes are µm; the drawing works in mm
  const vars = jobVars(sys, job);
  const { values } = computeSizes(sys, job);
  const parts = sys.parts.filter((p) => p.enabled !== false && matches(p.when, vars));
  const at = (pl: Place) => parts.find((p) => p.place === pl);
  const face = (pl: Place, shutter?: number) => {
    const p = at(pl);
    if (!p) return { mm: 0, known: true, part: undefined as PartDef | undefined };
    const id = profileOf(sys, p, vars, shutter !== undefined ? job.perShutter?.[shutter] : undefined);
    return { ...faceOf(find(id), placeRole(pl)), part: p };
  };

  const fT = face("frame-top"), fB = face("frame-bottom"), fL = face("frame-left"), fR = face("frame-right");
  const t = fT.mm, b = fB.mm || t, l = fL.mm || t, r = fR.mm || t;
  const mitre = (fT.part?.angle ?? 45) === 45;

  const frame: Member[] = [];
  const add = (p: PartDef | undefined, poly: Pt[], known: boolean, vertical: boolean) =>
    p && frame.push({ partId: p.id, place: p.place!, poly, known, vertical });
  if (mitre) {
    add(fT.part, [[0, 0], [W, 0], [W - r, t], [l, t]], fT.known, false);
    add(fB.part, [[l, H - b], [W - r, H - b], [W, H], [0, H]], fB.known, false);
    add(fL.part, [[0, 0], [l, t], [l, H - b], [0, H]], fL.known, true);
    add(fR.part, [[W, 0], [W, H], [W - r, H - b], [W - r, t]], fR.known, true);
  } else {
    // 90°: sides run full height, top and bottom fit between them
    add(fL.part, [[0, 0], [l, 0], [l, H], [0, H]], fL.known, true);
    add(fR.part, [[W - r, 0], [W, 0], [W, H], [W - r, H]], fR.known, true);
    add(fT.part, [[l, 0], [W - r, 0], [W - r, t], [l, t]], fT.known, false);
    add(fB.part, [[l, H - b], [W - r, H - b], [W - r, H], [l, H]], fB.known, false);
  }

  const mix = [...job.mix] as ("G" | "J" | "S")[];
  const n = Math.max(1, mix.length);
  const innerW = W - l - r, innerH = H - t - b;
  const svW = values.shutterW ?? null, svH = values.shutterH ?? null;
  const sizesKnown = svW != null && svH != null;
  // A shutter runs a little into the frame on every side; when its size is
  // not taught yet the picture uses a typical overlap.
  const shutterW = (svW ?? 0) / 1000 || (innerW + 30 * (n - 1)) / n + 20;
  const shutterH = (svH ?? 0) / 1000 || innerH + 24;
  const hide = Math.max(0, (shutterW * n - innerW) / 2) > 0 ? 10 : 0;
  const x0 = l - hide, x1 = W - r + hide;

  const shutters: ShutterGeo[] = [];
  const sash: Member[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? (W - shutterW) / 2 : x0 + (i * (x1 - x0 - shutterW)) / (n - 1);
    const y = (H - shutterH) / 2;
    const w = shutterW, h = shutterH;
    const lockSide: "left" | "right" = x + w / 2 < W / 2 ? "left" : "right";
    const sT = face("sash-top", i), sB = face("sash-bottom", i), sL0 = face("sash-lock", i), sM0 = face("sash-meet", i);
    const left = lockSide === "left" ? sL0 : sM0, right = lockSide === "left" ? sM0 : sL0;
    const st = sT.mm || 50, sb = sB.mm || st, sl = left.mm || st, sr = right.mm || st;
    const sashMitre = (sT.part?.angle ?? 45) === 45;
    const push = (f: typeof sT, poly: Pt[], vertical: boolean) =>
      f.part && sash.push({ partId: f.part.id, place: f.part.place!, shutter: i, poly, known: f.known, vertical });
    if (sashMitre) {
      push(sT, [[x, y], [x + w, y], [x + w - sr, y + st], [x + sl, y + st]], false);
      push(sB, [[x + sl, y + h - sb], [x + w - sr, y + h - sb], [x + w, y + h], [x, y + h]], false);
      push(left, [[x, y], [x + sl, y + st], [x + sl, y + h - sb], [x, y + h]], true);
      push(right, [[x + w, y], [x + w, y + h], [x + w - sr, y + h - sb], [x + w - sr, y + st]], true);
    } else {
      push(left, [[x, y], [x + sl, y], [x + sl, y + h], [x, y + h]], true);
      push(right, [[x + w - sr, y], [x + w, y], [x + w, y + h], [x + w - sr, y + h]], true);
      push(sT, [[x + sl, y], [x + w - sr, y], [x + w - sr, y + st], [x + sl, y + st]], false);
      push(sB, [[x + sl, y + h - sb], [x + w - sr, y + h - sb], [x + w - sr, y + h], [x + sl, y + h]], false);
    }
    shutters.push({
      index: i, kind: mix[i] ?? "G", x, y, w, h, lockSide, track: i % Math.max(1, job.tracks),
      pane: { x: x + sl, y: y + st, w: Math.max(1, w - sl - sr), h: Math.max(1, h - st - sb) },
    });
  }

  // Interlock patti: one strip on each glass shutter where two glass shutters meet.
  const patti: Member[] = [];
  const pp = at("meeting");
  if (pp) {
    const f = face("meeting");
    const pw = Math.max(6, f.mm);
    for (let i = 0; i < n - 1; i++) {
      const a = shutters[i], c = shutters[i + 1];
      if (a.kind === "J" || c.kind === "J") continue;
      const ax = a.x + a.w, cx = c.x;
      patti.push({ partId: pp.id, place: "meeting", shutter: i, known: f.known, vertical: true, poly: [[ax - pw, a.y + 8], [ax, a.y + 8], [ax, a.y + a.h - 8], [ax - pw, a.y + a.h - 8]] });
      patti.push({ partId: pp.id, place: "meeting", shutter: i + 1, known: f.known, vertical: true, poly: [[cx, c.y + 8], [cx + pw, c.y + 8], [cx + pw, c.y + c.h - 8], [cx, c.y + c.h - 8]] });
    }
  }

  return { W, H, frame, shutters, sash, patti, faces: { top: t, bottom: b, left: l, right: r }, mitre, shutterW, shutterH, sizesKnown };
}
