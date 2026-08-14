/**
 * Offcut planner — an OVERLAY that sits on top of the founder-verified engine.
 *
 * `lib/engine/*` is never modified. This module only:
 *   1. reads the cut pieces the engine has already produced,
 *   2. fits saved bank offcuts against those pieces,
 *   3. re-runs the engine's OWN packSection() on whatever is left,
 *   4. reports the difference as pipes (and feet) saved.
 *
 * Because step 3 calls the engine's packer instead of reimplementing it, the
 * "itni pipe khareedo" number can never disagree with the engine's cutting plan.
 *
 * Deliberately conservative: a piece is only assigned to an offcut when it
 * physically fits with blade allowance, so the plan can never ask the workshop
 * to cut something that isn't there.
 */
import { packSection } from "./engine/cutting";
import { getSection, getSectionWeight } from "./engine/sections";
import { feet, toFeet, type Um } from "./engine/units";
import type { CutPiece, PackedBar } from "./engine/types";
import { MIN_OFFCUT, type Offcut } from "./engine/offcuts";
import { finishCompatible, type FinishId } from "./engine/finishes";

/** Blade allowance between two cuts taken from the same offcut — mirrors the
 *  engine's kerf (5 mm). Only ever makes a fit MORE conservative, never less. */
const KERF: Um = 5000;

/** One bank piece and the cuts it can serve. */
export interface OffcutUse {
  offcut: Offcut;
  pieces: CutPiece[];
  /** what is still left on that offcut after these cuts */
  leftover: Um;
}

export interface SectionPlan {
  sectionId: string;
  /** full-bar equivalents (a half bar counts 0.5), as shown in the UI */
  pipesBefore: number;
  pipesAfter: number;
  uses: OffcutUse[];
  /** how the fresh bars get packed ONCE the stock pieces are taken out —
   *  this is the cutting plan the workshop should follow when stock is used */
  barsAfter: PackedBar[];
}

export interface OffcutPlan {
  sections: SectionPlan[];
  uses: OffcutUse[];
  /** full-bar equivalents no longer needed */
  pipesSaved: number;
  /** running feet of cutting served by the bank */
  feetFromBank: number;
  /** feet of NEW pipe no longer bought — this is what money is saved on.
   *  Always ≤ feetFromBank, because a bank piece only pays off once it
   *  removes a whole (or half) bar from the order. */
  feetSaved: number;
  /** the same saving in KILOGRAMS, which is what money is actually priced on.
   *  Covers only sections with a catalogue weight, so it can be less than
   *  feetSaved implies — never more. */
  kgSaved: number;
  /** bank ids that get physically cut by this plan */
  consumedIds: string[];
  /** remainders worth putting back into the bank afterwards */
  leftovers: { sectionId: string; length: Um }[];
}

export const EMPTY_PLAN: OffcutPlan = {
  sections: [], uses: [], pipesSaved: 0, feetFromBank: 0, feetSaved: 0, kgSaved: 0,
  consumedIds: [], leftovers: [],
};

/** Count bars the way the UI does: full = 1 pipe, half = 0.5 pipe. */
function pipeUnits(bars: PackedBar[], sectionId: string): number {
  const full = feet(getSection(sectionId).barLengthFt ?? 16);
  let n = 0;
  for (const b of bars) n += b.barLength === full ? 1 : 0.5;
  return n;
}

/**
 * Work out which required cuts the bank can serve, and what that removes from
 * the shopping list. Pure — reads the bank, never writes it.
 */
export function planOffcutUse(
  pieces: CutPiece[], bank: Offcut[], jobFinish?: FinishId,
): OffcutPlan {
  if (!pieces.length || !bank.length) return EMPTY_PLAN;

  const bySection = new Map<string, CutPiece[]>();
  for (const p of pieces) {
    const arr = bySection.get(p.sectionId) ?? [];
    arr.push(p);
    bySection.set(p.sectionId, arr);
  }

  const sections: SectionPlan[] = [];
  const allUses: OffcutUse[] = [];

  for (const [sectionId, secPieces] of bySection) {
    // Longest offcut first — a big leftover should absorb the big cuts. Colour
    // is filtered here rather than at fit time: a grey piece is not stock for an
    // ivory job at any length, so it must never reach the packer.
    const stock = bank
      .filter((o) => o.sectionId === sectionId && finishCompatible(jobFinish, o.finish))
      .sort((a, b) => b.length - a.length);
    if (!stock.length) continue;

    const before = packSection(sectionId, secPieces);

    // FFD, same spirit as the engine: longest pieces placed first
    const remaining = [...secPieces].sort((a, b) => b.length - a.length);
    const uses: OffcutUse[] = [];

    for (const o of stock) {
      let free = o.length;
      const taken: CutPiece[] = [];
      for (let i = 0; i < remaining.length; ) {
        const p = remaining[i];
        const need = p.length + (taken.length ? KERF : 0);
        if (need <= free) {
          taken.push(p);
          free -= need;
          remaining.splice(i, 1);
        } else {
          i++;
        }
      }
      if (taken.length) uses.push({ offcut: o, pieces: taken, leftover: free });
    }

    if (!uses.length) continue;

    const after = remaining.length ? packSection(sectionId, remaining) : [];
    const pipesBefore = pipeUnits(before, sectionId);
    const pipesAfter = pipeUnits(after, sectionId);

    // Only worth suggesting if it actually removes pipe from the order.
    // Otherwise we'd be telling the fabricator to burn good stock for nothing.
    if (pipesAfter >= pipesBefore) continue;

    sections.push({ sectionId, pipesBefore, pipesAfter, uses, barsAfter: after });
    allUses.push(...uses);
  }

  if (!allUses.length) return EMPTY_PLAN;

  const pipesSaved = sections.reduce((a, s) => a + (s.pipesBefore - s.pipesAfter), 0);
  const feetFromBank = allUses.reduce(
    (a, u) => a + u.pieces.reduce((b, p) => b + toFeet(p.length), 0), 0,
  );
  // Money is saved on pipe NOT bought, not on metal pulled from the bank.
  const barFt = (id: string) => getSection(id).barLengthFt ?? 16;
  const feetSaved = sections.reduce(
    (a, s) => a + (s.pipesBefore - s.pipesAfter) * barFt(s.sectionId), 0,
  );
  // Aluminium is priced per kilo, so the rupee figure has to be built from
  // weight. Sections with no catalogue weight contribute nothing rather than
  // being valued at a guessed density.
  const kgSaved = sections.reduce((a, s) => {
    const w = getSectionWeight(s.sectionId);
    if (!w) return a;
    return a + (s.pipesBefore - s.pipesAfter) * barFt(s.sectionId) * w.kgPerFt;
  }, 0);

  return {
    sections,
    uses: allUses,
    pipesSaved: Math.round(pipesSaved * 10) / 10,
    feetFromBank: Math.round(feetFromBank * 10) / 10,
    feetSaved: Math.round(feetSaved * 10) / 10,
    kgSaved: Math.round(kgSaved * 100) / 100,
    consumedIds: allUses.map((u) => u.offcut.id),
    leftovers: allUses
      .filter((u) => u.leftover >= MIN_OFFCUT)
      .map((u) => ({ sectionId: u.offcut.sectionId, length: u.leftover })),
  };
}
