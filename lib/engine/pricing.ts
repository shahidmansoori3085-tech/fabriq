/**
 * FabriQ Pricing Brain — deterministic aluminium costing (NO LLM).
 * Turns the packed material list into rupees so scrap is money-visible:
 * how many feet of bar were bought, how many became waste, and what that
 * waste costs at the shop's own aluminium rate.
 *
 * Model (fabricator-honest): aluminium is bought as whole bars, so the cost
 * is the FULL length purchased (bars16 × full + bars8 × half), not just the
 * feet that ended up in a window. Scrap = bought − used. The shop sets a
 * single blended rate in ₹ per running foot (what they actually pay).
 */
import { toFeet } from "./units";
import { getSection } from "./sections";
import type { MaterialList } from "./types";

export interface SectionCost {
  sectionId: string;
  boughtFt: number;
  usedFt: number;
  scrapFt: number;
  cost: number;
  scrapCost: number;
}

export interface JobCost {
  ratePerFt: number;
  boughtFt: number;
  usedFt: number;
  scrapFt: number;
  scrapPct: number;
  totalCost: number;
  scrapCost: number;
  sections: SectionCost[];
}

/** Cost the whole job at a single blended ₹/ft aluminium rate. */
export function costJob(list: MaterialList, ratePerFt: number): JobCost {
  const rate = Math.max(0, ratePerFt || 0);
  const sections: SectionCost[] = list.sections.map((s) => {
    const full = getSection(s.sectionId).barLengthFt ?? 16;
    const boughtFt = s.bars16 * full + s.bars8 * (full / 2);
    const usedFt = toFeet(s.totalLength);
    const scrapFt = Math.max(0, boughtFt - usedFt);
    return {
      sectionId: s.sectionId,
      boughtFt,
      usedFt,
      scrapFt,
      cost: boughtFt * rate,
      scrapCost: scrapFt * rate,
    };
  });
  const boughtFt = sections.reduce((a, s) => a + s.boughtFt, 0);
  const usedFt = sections.reduce((a, s) => a + s.usedFt, 0);
  const scrapFt = sections.reduce((a, s) => a + s.scrapFt, 0);
  return {
    ratePerFt: rate,
    boughtFt,
    usedFt,
    scrapFt,
    scrapPct: boughtFt > 0 ? Math.round((scrapFt / boughtFt) * 1000) / 10 : 0,
    totalCost: boughtFt * rate,
    scrapCost: scrapFt * rate,
    sections,
  };
}

/** ₹ formatter — Indian grouping, no paise. */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
