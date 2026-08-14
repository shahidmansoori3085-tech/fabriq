/**
 * FabriQ Pricing Brain — deterministic aluminium costing (NO LLM).
 *
 * Aluminium is bought BY WEIGHT. A dealer quotes ₹/kg and bills on the kilos
 * delivered, so that is the only rate a fabricator can state from memory. We
 * take the packed cutting plan, convert bought feet to kilograms using the
 * catalogue weight of each profile, and price that.
 *
 * Model (fabricator-honest): whole bars are bought, so the cost is the FULL
 * length purchased (bars16 × full + bars8 × half), not just the feet that ended
 * up in a window. Scrap = bought − used, and it is charged at the same rate,
 * because the shop paid for that metal too.
 *
 * Sections whose catalogue weight is unknown are reported separately and left
 * OUT of the total rather than guessed — a fabricator ordering against a wrong
 * weight loses real money (see SECTION_WEIGHTS in sections.ts).
 */
import { toFeet } from "./units";
import { getSection, getSectionWeight } from "./sections";
import type { MaterialList } from "./types";

export interface SectionCost {
  sectionId: string;
  boughtFt: number;
  usedFt: number;
  scrapFt: number;
  /** undefined when this profile has no catalogue weight */
  boughtKg?: number;
  scrapKg?: number;
  cost?: number;
  scrapCost?: number;
}

export interface JobCost {
  /** ₹ per kilogram of aluminium — what the dealer quotes */
  ratePerKg: number;
  boughtFt: number;
  usedFt: number;
  scrapFt: number;
  scrapPct: number;
  /** weights and money cover only the sections we have catalogue weight for */
  boughtKg: number;
  scrapKg: number;
  totalCost: number;
  scrapCost: number;
  sections: SectionCost[];
  /** profiles left out of the money figures because their weight is unpublished */
  unpricedSections: string[];
  /** true when every section in the job could be weighed */
  complete: boolean;
}

/** Cost the whole job at the shop's ₹/kg aluminium rate. */
export function costJob(list: MaterialList, ratePerKg: number): JobCost {
  const rate = Math.max(0, ratePerKg || 0);

  const sections: SectionCost[] = list.sections.map((s) => {
    const full = getSection(s.sectionId).barLengthFt ?? 16;
    const boughtFt = s.bars16 * full + s.bars8 * (full / 2);
    const usedFt = toFeet(s.totalLength);
    const scrapFt = Math.max(0, boughtFt - usedFt);
    const w = getSectionWeight(s.sectionId);
    if (!w) return { sectionId: s.sectionId, boughtFt, usedFt, scrapFt };
    const boughtKg = boughtFt * w.kgPerFt;
    const scrapKg = scrapFt * w.kgPerFt;
    return {
      sectionId: s.sectionId,
      boughtFt, usedFt, scrapFt,
      boughtKg, scrapKg,
      cost: boughtKg * rate,
      scrapCost: scrapKg * rate,
    };
  });

  const sum = (pick: (c: SectionCost) => number | undefined) =>
    sections.reduce((a, c) => a + (pick(c) ?? 0), 0);

  const boughtFt = sum((c) => c.boughtFt);
  const scrapFt = sum((c) => c.scrapFt);
  const unpricedSections = sections.filter((c) => c.boughtKg === undefined).map((c) => c.sectionId);

  return {
    ratePerKg: rate,
    boughtFt,
    usedFt: sum((c) => c.usedFt),
    scrapFt,
    scrapPct: boughtFt > 0 ? Math.round((scrapFt / boughtFt) * 1000) / 10 : 0,
    boughtKg: sum((c) => c.boughtKg),
    scrapKg: sum((c) => c.scrapKg),
    totalCost: sum((c) => c.cost),
    scrapCost: sum((c) => c.scrapCost),
    sections,
    unpricedSections,
    complete: unpricedSections.length === 0,
  };
}

/** ₹ formatter — Indian grouping, no paise. */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Weight formatter — kg to one decimal, which is how a dealer bills. */
export function kg(n: number): string {
  return `${Math.round(n * 10) / 10} kg`;
}
