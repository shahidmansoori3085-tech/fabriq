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

/** How much work the search below may do for one section (it stays instant on a phone). */
const SEARCH_STEPS = 200_000;
const SEARCH_STATES = 200_000;

/**
 * The least stock there is, searched over lengths instead of single pieces: a job cuts many
 * pieces of a few lengths, and nudged orders miss mixes such as four 48″ on one pipe and three
 * 57″ on the next (found 2026-11-22: 3 pipes + 9 ft where 3 + 5 ft does it).
 * Returns only a packing that buys less than `beat`. On a job too varied to finish it gives
 * back the best it completed, or null.
 */
function searchLeast(sorted: CutPiece[], full: Um, cap: Um, piece: boolean, beat: Um): OpenBar[] | null {
  const kinds: Um[] = [], count: number[] = [];
  for (const p of sorted) {
    if (kinds[kinds.length - 1] === p.length) count[count.length - 1]++;
    else { kinds.push(p.length); count.push(1); }
  }
  const radix: number[] = [];
  let states = 1;
  for (const c of count) {
    radix.push(states);
    states *= c + 1;
    if (states > SEARCH_STATES) return null;
  }
  const keyOf = (left: number[]) => left.reduce((a, c, i) => a + c * radix[i], 0);

  let steps = 0;
  /** Every load one bar takes from `left`. A full pipe takes the longest piece left and is filled
   *  until nothing more fits (that never costs a pipe); the cut piece may hold any load. */
  const eachLoad = (left: number[], pipe: boolean, visit: (take: number[], used: Um) => void) => {
    const first = left.findIndex((c) => c > 0);
    const take = left.map(() => 0);
    const at = (i: number, used: Um, n: number) => {
      if (++steps > SEARCH_STEPS) return;
      if (i === kinds.length) {
        if (!n) return;
        if (pipe) for (let j = kinds.length - 1; j >= 0; j--) {
          if (take[j] < left[j]) { if (used + KERF + kinds[j] <= cap) return; break; }
        }
        visit(take, used);
        return;
      }
      const room = cap - used + (n ? 0 : KERF);
      const most = Math.min(left[i], Math.floor(room / (kinds[i] + KERF)));
      for (let c = most; c >= (pipe && i === first ? 1 : 0); c--) {
        take[i] = c;
        at(i + 1, c ? used + c * (kinds[i] + KERF) - (n ? 0 : KERF) : used, n + c);
      }
      take[i] = 0;
    };
    at(Math.max(0, first), 0, 0);
  };
  /** The fewest pipes these pieces can possibly need. */
  const atLeast = (left: number[]) =>
    Math.ceil(left.reduce((a, c, i) => a + c * (kinds[i] + KERF), 0) / (cap + KERF));

  const memo = new Map<number, number[][] | null>([[0, []]]);
  /** The fewest full pipes for `left`, as their loads; null when the work ran out. */
  const pipesFor = (left: number[]): number[][] | null => {
    const key = keyOf(left);
    const known = memo.get(key);
    if (known !== undefined) return known;
    const floor = atLeast(left);
    let best: number[][] | null = null;
    // the fullest loads first, as a cutter fills a pipe: a good packing comes at once, and it
    // rules out most of the others (2026-11-24: a 6-window Domal job ran out of search before
    // finding 16 pipes + 8 ft)
    const loads: { load: number[]; used: Um }[] = [];
    eachLoad(left, true, (take, used) => { loads.push({ load: [...take], used }); });
    loads.sort((a, b) => b.used - a.used);
    for (const { load } of loads) {
      if (best && best.length <= floor) break;
      if (steps > SEARCH_STEPS) break;
      const after = left.map((c, i) => c - load[i]);
      // a load whose rest can at best tie the packing found already is not worth working out
      if (best && atLeast(after) + 1 >= best.length) continue;
      const rest = pipesFor(after);
      if (rest && (!best || rest.length + 1 < best.length)) best = [load, ...rest];
    }
    if (steps > SEARCH_STEPS) return null;
    memo.set(key, best);
    return best;
  };

  let bought = beat;
  let found: number[][] | null = null;
  if (atLeast(count) * full < bought) {
    const all = pipesFor(count);
    if (all && all.length * full < bought) { bought = all.length * full; found = all; }
  }
  if (piece) eachLoad(count, false, (take, used) => {
    const len = Math.min(full, Math.max(FOOT, Math.ceil(used / FOOT) * FOOT));
    if (len >= full) return;
    const load = [...take];
    const left = count.map((c, i) => c - load[i]);
    if (atLeast(left) * full + len >= bought) return;
    const rest = pipesFor(left);
    if (rest && rest.length * full + len < bought) { bought = rest.length * full + len; found = [...rest, load]; }
  });
  if (!found) return null;

  const next = kinds.map((k) => sorted.findIndex((p) => p.length === k));
  return (found as number[][]).map((load) => {
    const pieces = load.flatMap((c, i) => sorted.slice(next[i], (next[i] += c)));
    return { pieces, used: pieces.reduce((a, p) => a + p.length, 0) + (pieces.length - 1) * KERF };
  });
}

/**
 * The cutter's way: every pipe takes the mix of the lengths left that fills it most (2026-11-24,
 * a 6-window Domal job: one 56⅜″ with three 29½″ and two 23″ fills a 16 ft pipe to ⅛″ — the
 * piece-by-piece orders missed it and bought a pipe more than the mistry). The least-filled
 * pipe is left for last, so it becomes the cut piece.
 */
function fullest(sorted: CutPiece[], cap: Um, work = { n: 0 }): OpenBar[] {
  const kinds: Um[] = [], left: number[] = [];
  for (const p of sorted) {
    if (kinds[kinds.length - 1] === p.length) left[left.length - 1]++;
    else { kinds.push(p.length); left.push(1); }
  }
  const next = kinds.map((k) => sorted.findIndex((p) => p.length === k));
  const bars: OpenBar[] = [];
  while (left.some((c) => c > 0)) {
    let best: number[] | null = null, bestUsed = -1, nodes = 0;
    const take = left.map(() => 0);
    // as the cutter does: the longest piece left goes on this pipe, the short ones fill round it
    const first = left.findIndex((c) => c > 0);
    const at = (i: number, used: Um, n: number) => {
      if (++nodes > 20_000) return;
      if (i === kinds.length) {
        if (n && used > bestUsed) { bestUsed = used; best = [...take]; }
        return;
      }
      const room = cap - used + (n ? 0 : KERF);
      for (let c = Math.min(left[i], Math.floor(room / (kinds[i] + KERF))); c >= (i === first ? 1 : 0); c--) {
        take[i] = c;
        at(i + 1, c ? used + c * (kinds[i] + KERF) - (n ? 0 : KERF) : used, n + c);
      }
      take[i] = 0;
    };
    at(0, 0, 0);
    work.n += nodes;
    const load: number[] = best ?? left.map((c, i) => (i === left.findIndex((x) => x > 0) ? 1 : 0));
    const pieces = load.flatMap((c, i) => sorted.slice(next[i], (next[i] += c)));
    load.forEach((c, i) => { left[i] -= c; });
    bars.push({ pieces, used: pieces.reduce((a, p) => a + p.length, 0) + (pieces.length - 1) * KERF });
  }
  return bars;
}

/**
 * The cutter's way with the cut piece chosen first: for each short load (the shortest first),
 * the rest go on whole pipes the fullest way. Gives every try to `take`. A job of few lengths
 * often fills its whole pipes exactly once the right pieces are kept for the short one.
 */
function fullestWithPiece(sorted: CutPiece[], cap: Um, full: Um, take: (bars: OpenBar[]) => void) {
  const kinds: Um[] = [], count: number[] = [];
  for (const p of sorted) {
    if (kinds[kinds.length - 1] === p.length) count[count.length - 1]++;
    else { kinds.push(p.length); count.push(1); }
  }
  const loads: { load: number[]; used: Um }[] = [];
  const cur = count.map(() => 0);
  let nodes = 0;
  const at = (i: number, used: Um, n: number) => {
    if (++nodes > 20_000) return;
    if (i === kinds.length) { if (n) loads.push({ load: [...cur], used }); return; }
    const room = full - used + (n ? 0 : KERF);
    for (let c = Math.min(count[i], Math.floor(room / (kinds[i] + KERF))); c >= 0; c--) {
      cur[i] = c;
      at(i + 1, c ? used + c * (kinds[i] + KERF) - (n ? 0 : KERF) : used, n + c);
    }
    cur[i] = 0;
  };
  at(0, 0, 0);
  loads.sort((a, b) => a.used - b.used);
  // a job of many lengths stops early: the whole search after this still has its turn
  const work = { n: nodes };
  for (const { load, used } of loads.slice(0, 300)) {
    if (work.n > 2_000_000) break;
    const next = kinds.map((k) => sorted.findIndex((p) => p.length === k));
    const short = new Set(load.flatMap((c, i) => sorted.slice(next[i], next[i] + c)));
    const rest = sorted.filter((p) => !short.has(p));
    take([...(rest.length ? fullest(rest, cap, work) : []), { pieces: [...short], used }]);
  }
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
 * Where those orders still buy more than the plain total, the lengths are searched for the
 * least there is; that packing is taken only when it buys less.
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
  consider(fullest(sorted, cap));

  // Nothing to gain once the stock equals the plain floor of the lengths.
  const total = sorted.reduce((a, p) => a + p.length, 0);
  const unit = piece ? FOOT : barFull;
  const floor = Math.ceil(total / unit) * unit;
  if (piece && bestStock > floor && sorted.length > 1) fullestWithPiece(sorted, cap, barFull, consider);
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
    if (bestStock > floor) best = searchLeast(sorted, barFull, cap, piece, bestStock) ?? best;
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
