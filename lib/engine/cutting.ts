/**
 * FabriQ Cutting Brain — global 1D bin-packing across the whole job.
 * Many packings tried per section (first/best fit, longest first and
 * shuffled); the one buying the least stock wins (half bars where sold).
 * Rules (founder-verified):
 *  - Most sections sell as 16-foot bars; dealer also cuts 8-foot halves.
 *  - Glazing Clip sells as 12-foot bars only, no half option.
 *  - Pieces longer than the full bar MUST error — never silently split.
 */
import { Um, feet, toFeet } from "./units";
import type { CutPiece, PackedBar, SectionSummary } from "./types";
import { getSection } from "./sections";

/** kerf/cut allowance per cut (µm) — blade width, default 5mm */
const KERF = 5000;

/**
 * Real bars run a little over their nominal length (fabricator-confirmed
 * 2026-07-27) — a combo that sums to exactly the full bar length still cuts
 * from ONE bar, the kerf loss doesn't force a second one. This allowance
 * absorbs that.
 */
const BAR_ALLOWANCE = 15000; // 15mm

/**
 * A cut piece that no single bar can supply.
 *
 * Carries the piece and the bar length rather than only a message, because the
 * screen has to name the opening, the part and both lengths — a fabricator can
 * act on "W10's 18 ft top rail needs a 16 ft bar", not on a sentence with the
 * numbers missing. It is thrown, never swallowed: silently splitting a rail
 * would change the material count without the shop agreeing to a joint.
 */
export class PieceTooLongError extends Error {
  constructor(public piece: CutPiece, public barLength: Um = 0) {
    super(`Piece longer than the bar: ${piece.label}`);
    this.name = "PieceTooLongError";
  }
}

interface OpenBar { pieces: CutPiece[]; used: Um }

/** Pieces onto bars in the given order: first fit, or best fit (the fullest bar that still takes it). */
function fill(order: CutPiece[], cap: Um, best: boolean): OpenBar[] {
  const bars: OpenBar[] = [];
  for (const p of order) {
    let at = -1;
    let room = Infinity;
    for (let i = 0; i < bars.length; i++) {
      const left = cap - bars[i].used - p.length - (bars[i].pieces.length ? KERF : 0);
      if (left < 0) continue;
      if (!best) { at = i; break; }
      if (left < room) { room = left; at = i; }
    }
    if (at < 0) bars.push({ pieces: [p], used: p.length });
    else { bars[at].pieces.push(p); bars[at].used += p.length + KERF; }
  }
  return bars;
}

/** What a packing costs: the stock bought, each bar that fits a half counted as a half. */
function stockOf(bars: OpenBar[], full: Um, half: Um, hasHalf: boolean): Um {
  return bars.reduce((a, b) => a + (hasHalf && b.used <= half ? half : full), 0);
}

/** Of two packings with the same stock, the one whose leftover sits in fewer,
 *  longer pieces — a long offcut is used on the next job, crumbs are scrap. */
function offcutScore(bars: OpenBar[], full: Um, half: Um, hasHalf: boolean): number {
  return bars.reduce((a, b) => {
    const left = (hasHalf && b.used <= half ? half : full) - b.used;
    return a + (left / full) ** 2;
  }, 0);
}

/** A fixed pseudo-random sequence per section, so the same job always cuts the same way. */
function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  let x = h >>> 0 || 1;
  return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296;
}

/**
 * Pack one section's pieces onto bars, buying as little stock as possible.
 *
 * First-fit on the longest pieces first is the classic quick answer, but it
 * leaves a few percent on the table: a job's pieces often fit one bar fewer,
 * or end on a half bar, when taken in another order. So many orders are
 * tried — longest-first with first fit and best fit, then the same with the
 * sizes nudged at random — and the packing that buys the least stock wins;
 * a tie goes to the one leaving its offcut in longer, reusable pieces. The
 * randomness is seeded by the pieces, so a job always cuts the same way.
 * A bar whose pieces fit half a bar is bought as a half (if the section sells halves).
 */
export function packSection(sectionId: string, pieces: CutPiece[]): PackedBar[] {
  const sec = getSection(sectionId);
  const barFull = feet(sec.barLengthFt ?? 16);
  const barHalf = feet((sec.barLengthFt ?? 16) / 2);
  const hasHalfBar = sec.hasHalfBar ?? true;
  const cap = barFull + BAR_ALLOWANCE;

  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  for (const p of sorted) if (p.length > barFull) throw new PieceTooLongError(p, barFull);

  let best: OpenBar[] = fill(sorted, cap, false);
  let bestStock = stockOf(best, barFull, barHalf, hasHalfBar);
  let bestScore = offcutScore(best, barFull, barHalf, hasHalfBar);
  const consider = (bars: OpenBar[]) => {
    const st = stockOf(bars, barFull, barHalf, hasHalfBar);
    if (st > bestStock) return;
    const sc = offcutScore(bars, barFull, barHalf, hasHalfBar);
    if (st < bestStock || sc > bestScore + 1e-9) { best = bars; bestStock = st; bestScore = sc; }
  };
  consider(fill(sorted, cap, true));

  // Nothing to gain once the stock equals the plain floor of the lengths.
  const total = sorted.reduce((a, p) => a + p.length, 0);
  const unit = hasHalfBar ? barHalf : barFull;
  const floor = Math.ceil(total / unit) * unit;
  if (bestStock > floor && sorted.length > 1) {
    const rnd = seeded(`${sectionId}:${sorted.map((p) => p.length).join(",")}`);
    const tries = sorted.length <= 60 ? 400 : sorted.length <= 200 ? 150 : 50;
    for (let t = 0; t < tries && bestStock > floor; t++) {
      const jitter = 0.08 + 0.3 * rnd();
      const order = sorted
        .map((p) => ({ p, k: p.length * (1 + (rnd() - 0.5) * jitter) }))
        .sort((a, b) => b.k - a.k)
        .map((x) => x.p);
      consider(fill(order, cap, t % 2 === 1));
    }
  }

  // Longest pieces first on every bar, as the cutter takes them.
  return best.map((b, i) => {
    const fitsHalf = hasHalfBar && b.used <= barHalf;
    const barLength = fitsHalf ? barHalf : barFull;
    return {
      barNo: i + 1,
      sectionId,
      barLength,
      pieces: [...b.pieces].sort((x, y) => y.length - x.length),
      waste: Math.max(0, barLength - b.used),
    };
  });
}

/** Pack every section in the job; bar numbers run globally for the cutter. */
export function packAllSections(pieces: CutPiece[]): PackedBar[] {
  const bySection = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    const arr = bySection.get(p.sectionId) ?? [];
    arr.push(p);
    bySection.set(p.sectionId, arr);
  }
  const all: PackedBar[] = [];
  let barNo = 1;
  for (const [sectionId, ps] of bySection) {
    for (const bar of packSection(sectionId, ps)) {
      all.push({ ...bar, barNo: barNo++ });
    }
  }
  return all;
}

export function summarize(bars: PackedBar[]): SectionSummary[] {
  const map = new Map<string, SectionSummary>();
  for (const b of bars) {
    const s =
      map.get(b.sectionId) ??
      { sectionId: b.sectionId, totalPieces: 0, totalLength: 0, bars16: 0, bars8: 0, waste: 0, wastePct: 0 };
    s.totalPieces += b.pieces.length;
    s.totalLength += b.pieces.reduce((a, p) => a + p.length, 0);
    // bars16 = full-length bars, bars8 = half-length bars (field names kept
    // for compatibility; actual length is per-section, see getSection().barLengthFt)
    const sec = getSection(b.sectionId);
    const fullBar = feet(sec.barLengthFt ?? 16);
    if (b.barLength === fullBar) s.bars16++;
    else s.bars8++;
    s.waste += b.waste;
    map.set(b.sectionId, s);
  }
  for (const s of map.values()) {
    const sec = getSection(s.sectionId);
    const full = sec.barLengthFt ?? 16;
    const pipe = s.bars16 * full + s.bars8 * (full / 2);
    s.wastePct = pipe > 0 ? Math.round((toFeet(s.waste) / pipe) * 1000) / 10 : 0;
  }
  return [...map.values()];
}
