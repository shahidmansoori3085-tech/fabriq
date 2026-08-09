/**
 * FabriQ Cutting Brain — global 1D bin-packing across the whole job.
 * FFD (First-Fit Decreasing) over each section's own stock bar length, then
 * half-bar downgrade where it reduces waste (if the section sells halves).
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

export class PieceTooLongError extends Error {
  constructor(public piece: CutPiece) {
    super(`Piece longer than the bar: ${piece.label}`);
  }
}

/** Pack one section's pieces onto bars. FFD + half-bar downgrade. */
export function packSection(sectionId: string, pieces: CutPiece[]): PackedBar[] {
  const sec = getSection(sectionId);
  const barFull = feet(sec.barLengthFt ?? 16);
  const barHalf = feet((sec.barLengthFt ?? 16) / 2);
  const hasHalfBar = sec.hasHalfBar ?? true;

  const sorted = [...pieces].sort((a, b) => b.length - a.length);
  for (const p of sorted) if (p.length > barFull) throw new PieceTooLongError(p);

  interface OpenBar { pieces: CutPiece[]; used: Um }
  const bars: OpenBar[] = [];

  for (const p of sorted) {
    let placed = false;
    for (const b of bars) {
      const need = p.length + (b.pieces.length > 0 ? KERF : 0);
      if (b.used + need <= barFull + BAR_ALLOWANCE) {
        b.pieces.push(p);
        b.used += need;
        placed = true;
        break;
      }
    }
    if (!placed) bars.push({ pieces: [p], used: p.length });
  }

  // Downgrade: any bar whose contents fit a half bar becomes a half bar
  // (only for sections that actually sell a half-length option)
  return bars.map((b, i) => {
    const fitsHalf = hasHalfBar && b.used <= barHalf + BAR_ALLOWANCE;
    const barLength = fitsHalf ? barHalf : barFull;
    return {
      barNo: i + 1,
      sectionId,
      barLength,
      pieces: b.pieces,
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
