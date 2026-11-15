/**
 * The corner cutaway of a sliding window, laid out by the same engine that checks
 * every system against its drawings (assemble.ts): the bottom track, the track clip
 * in each running lane and each shutter's own bottom section sitting on it, plus the
 * sections of the side track and the shutter uprights. The 3D view only extrudes
 * these — so it shows the window the shop chose (its series, slim or clip, its track).
 *
 * Cross-section coordinates (mm): X across the frame from its outer face, Y up from
 * the bottom of the track.
 */
import { solidOf, bounds, buildSliding, type Solid } from "./assemble";
import type { Shape } from "./shapes";
import type { WindowGeo } from "./geometry";

export interface CutLane {
  /** shutter index and its running lane */
  shutter: number; lane: number;
  kind: "G" | "J" | "S";
  /** placed sections in the cross-section */
  rail: Solid; clip: Solid;
  /** the bottom section's face runs up from its mouth (start) or is mirrored (end) */
  mouth: "start" | "end";
  /** the bottom section's thickness axis maps to X = shapeY + depth0 */
  depth0: number;
  /** bottom of the shutter (Y), its face height and thickness */
  y0: number; face: number; thick: number;
  /** the running surface (top of clip / leg) and the lane's X (roller centre) */
  run: number; x: number;
  lock?: Shape; meet?: Shape; bottom: Shape;
}

export interface Cutaway {
  track: Solid; trackW: number; trackH: number;
  clipShape?: Shape;
  side?: Shape; frameAngle: 90 | 45; sashAngle: 90 | 45;
  lanes: CutLane[];
}

/** Lay out every shutter on its lane; null when the window cannot be built from its drawings. */
export function buildCutaway(sec: WindowGeo["section"]): Cutaway | null {
  if (!sec.track || sec.bombay) return null;
  const book: Record<string, Shape> = { T: sec.track };
  if (sec.clip) book.C = sec.clip;
  const get = (k: string) => ({ ...book[k], solid: solidOf(book[k].paths) });
  const lanes: CutLane[] = [];
  let track: Solid | undefined;
  sec.shutters.forEach((s, i) => {
    if (!s.bottom) return;
    book[`S${i}`] = s.bottom;
    const tries = (["start", "end"] as const).flatMap((mouth) => {
      try {
        const r = buildSliding({ name: "cut", bottom: "T", top: "T", clip: sec.clip ? "C" : undefined, shutter: `S${i}`, mouth, lane: s.track }, get);
        return [{ mouth, r }];
      } catch { return []; }
    });
    const ok = tries.find((t) => t.r.clear && t.r.topGap >= t.r.wheel) ?? tries.find((t) => t.r.clear);
    if (!ok) return;
    track = ok.r.solids.track;
    const sb = bounds(ok.r.solids.shutter), own = bounds(solidOf(s.bottom.paths));
    lanes.push({
      shutter: i, lane: s.track, kind: s.kind, rail: ok.r.solids.shutter, clip: ok.r.solids.clip, mouth: ok.mouth,
      depth0: sb.x0 - own.y0, y0: sb.y0, face: s.bottom.w, thick: s.bottom.h, run: ok.r.run, x: ok.r.x,
      lock: s.lock, meet: s.meet, bottom: s.bottom,
    });
  });
  if (!track || !lanes.length) return null;
  const tb = bounds(track);
  return { track, trackW: tb.x1, trackH: tb.y1, clipShape: sec.clip, side: sec.side, frameAngle: sec.frameAngle, sashAngle: sec.sashAngle, lanes };
}
