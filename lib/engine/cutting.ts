/**
 * FabriQ Cutting Brain — global 1D bin-packing across the whole job.
 * Many packings tried per section (first/best fit, longest first and
 * shuffled); the one buying the least stock wins.
 * Rules (founder-verified):
 *  - Each section sells in the pipe length the shop chose (16 ft by default).
 *  - What is left after the full pipes is bought as ONE piece cut to the
 *    feet it needs: "4 pipes + a 6 ft piece" (founder, 2026-11-13 — no half bars).
 *  - Glazing Clip sells as 12-foot bars only, no piece.
 *  - Pieces longer than the full bar MUST error — never silently split.
 */
import { Um, feet, toFeet } from "./units";
import type { CutPiece, PackedBar, SectionSummary, StockGroup } from "./types";
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

const FOOT = feet(1);

/** What each bar is bought as: full pipes, and the least-used bar as one piece
 *  cut to the whole feet it needs (when the section is sold that way). */
function buying(bars: OpenBar[], full: Um, piece: boolean): Um[] {
  const len = bars.map(() => full);
  if (piece && bars.length) {
    let k = 0;
    for (let i = 1; i < bars.length; i++) if (bars[i].used < bars[k].used) k = i;
    len[k] = Math.min(full, Math.max(FOOT, Math.ceil(bars[k].used / FOOT) * FOOT));
  }
  return len;
}

/** What a packing costs: the stock bought. */
function stockOf(bars: OpenBar[], full: Um, piece: boolean): Um {
  return buying(bars, full, piece).reduce((a, l) => a + l, 0);
}

/** Of two packings with the same stock, the one whose leftover sits in fewer,
 *  longer pieces — a long offcut is used on the next job, crumbs are scrap. */
function offcutScore(bars: OpenBar[], full: Um, piece: boolean): number {
  const len = buying(bars, full, piece);
  return bars.reduce((a, b, i) => a + ((len[i] - b.used) / full) ** 2, 0);
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
 * or end on a shorter piece, when taken in another order. So many orders are
 * tried — longest-first with first fit and best fit, then the same with the
 * sizes nudged at random — and the packing that buys the least stock wins;
 * a tie goes to the one leaving its offcut in longer, reusable pieces. The
 * randomness is seeded by the pieces, so a job always cuts the same way.
 * The least-used bar is bought as a piece of the feet it needs (if the section sells pieces).
 */
export function packSection(sectionId: string, pieces: CutPiece[]): PackedBar[] {
  const sec = getSection(sectionId);
  const barFull = feet(sec.barLengthFt ?? 16);
  const piece = sec.sellsPiece ?? true;
  const cap = barFull + BAR_ALLOWANCE;

  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  for (const p of sorted) if (p.length > barFull) throw new PieceTooLongError(p, barFull);

  let best: OpenBar[] = fill(sorted, cap, false);
  let bestStock = stockOf(best, barFull, piece);
  let bestScore = offcutScore(best, barFull, piece);
  const consider = (bars: OpenBar[]) => {
    const st = stockOf(bars, barFull, piece);
    if (st > bestStock) return;
    const sc = offcutScore(bars, barFull, piece);
    if (st < bestStock || sc > bestScore + 1e-9) { best = bars; bestStock = st; bestScore = sc; }
  };
  consider(fill(sorted, cap, true));

  // Nothing to gain once the stock equals the plain floor of the lengths.
  const total = sorted.reduce((a, p) => a + p.length, 0);
  const unit = piece ? FOOT : barFull;
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

  // Longest pieces first on every bar, as the cutter takes them; the piece last.
  const len = buying(best, barFull, piece);
  return best
    .map((b, i) => ({ b, barLength: len[i] }))
    .sort((x, y) => (x.barLength === barFull ? 0 : 1) - (y.barLength === barFull ? 0 : 1))
    .map(({ b, barLength }, i) => ({
      barNo: i + 1,
      sectionId,
      barLength,
      pieces: [...b.pieces].sort((x, y) => y.length - x.length),
      waste: Math.max(0, barLength - b.used),
    }));
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

/** What to buy for one section: full pipes, and the piece (feet) if any. */
export function stockGroups(sectionId: string, bars: PackedBar[]): StockGroup[] {
  const ft = getSection(sectionId).barLengthFt ?? 16;
  const full = feet(ft);
  const g: StockGroup = { ft, full: 0, pieces: [] };
  for (const b of bars) {
    if (b.barLength >= full) g.full++;
    else g.pieces.push(Math.round(toFeet(b.barLength)));
  }
  return [g];
}

export function summarize(bars: PackedBar[]): SectionSummary[] {
  const map = new Map<string, SectionSummary>();
  for (const b of bars) {
    const s =
      map.get(b.sectionId) ??
      { sectionId: b.sectionId, totalPieces: 0, totalLength: 0, bars16: 0, bars8: 0, stock: [], boughtFt: 0, waste: 0, wastePct: 0 };
    s.totalPieces += b.pieces.length;
    s.totalLength += b.pieces.reduce((a, p) => a + p.length, 0);
    s.waste += b.waste;
    map.set(b.sectionId, s);
  }
  for (const s of map.values()) {
    s.stock = stockGroups(s.sectionId, bars.filter((b) => b.sectionId === s.sectionId));
    // bars16 = full pipes, bars8 = pieces (field names kept for old screens)
    s.bars16 = s.stock.reduce((a, g) => a + g.full, 0);
    s.bars8 = s.stock.reduce((a, g) => a + g.pieces.length, 0);
    s.boughtFt = s.stock.reduce((a, g) => a + g.full * g.ft + g.pieces.reduce((x, p) => x + p, 0), 0);
    s.wastePct = s.boughtFt > 0 ? Math.round((toFeet(s.waste) / s.boughtFt) * 1000) / 10 : 0;
  }
  return [...map.values()];
}
