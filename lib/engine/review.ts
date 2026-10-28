/**
 * FabriQ Review Brain — deterministic checks.
 * Runs on every estimate, no AI needed. The AI layer (when an API key is
 * present) adds richer senior-fabricator commentary on top of these.
 */
import { mm, formatFtInSut } from "./units";
import type { JobItem, MaterialList, ReviewFinding, ReviewResult } from "./types";
import { DEFAULTS, DOMAL_DEFAULTS, shutterSize, zGeometry, domalFix } from "./estimator";

/** Below this a hinged Z-section leaf is not something a shop actually builds —
 *  the hinge, the handle and the lock have nowhere to go. */
const Z_SASH_UNBUILDABLE = mm(330);
/** Buildable, but narrow enough to be worth a second look before cutting. */
const Z_SASH_AWKWARD = mm(450);

export function reviewEstimate(items: JobItem[], list: MaterialList): ReviewResult {
  const findings: ReviewFinding[] = [];
  let confidence = 98;
  /** Openable Z-section leaves across the whole job — hardware for these is
   *  ordered outside this list, and this count is what the shop buys against. */
  let zLeaves = 0;

  for (const item of items) {
    if (item.system === "door_single") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: the catalogue code for the center rail is not verified yet. The size is correct — confirm the section number with your dealer.`,
      });
      confidence -= 2;
      continue;
    }

    if (item.system === "partition") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: panel clearance for sheet and glass is not yet verified on a real job — confirm the glazing groove with your dealer.`,
      });
      confidence -= 2;
      continue;
    }

    // A Z-section panel row takes its openable width from whatever the fixed
    // panels leave over, so a fixed panel written a little too big quietly
    // produces a leaf too narrow to hang. The arithmetic stays correct and the
    // cut list still prints, which is exactly why it needs saying out loud —
    // the sizes come from zGeometry itself, not a second copy of the formula.
    // Hinges, stays and handles are deliberately outside the Z-section list
    // (founder scope). Left unsaid it reads as a complete list with the
    // hardware forgotten, and the shop orders pipe and glass for windows that
    // cannot be hung. Counted here, said ONCE below — four openings repeating
    // the same sentence is noise a fabricator learns to scroll past.
    if (item.system === "z_section") zLeaves += zGeometry(item).sashes.length * item.qty;

    if (item.system === "z_section" && item.meta.zDoor !== "yes") {
      const g = zGeometry(item);
      const narrowest = g.sashes.reduce<number | null>(
        (min, s) => (min === null || s.shW < min ? s.shW : min), null);
      if (narrowest !== null && narrowest < Z_SASH_UNBUILDABLE) {
        findings.push({
          severity: "blocker",
          category: "panel-size",
          message: `${item.id}: the openable leaf in this layout is only ${formatFtInSut(narrowest)} wide — too narrow for hinges and a handle. Check the fixed panel sizes and the overall width before cutting.`,
        });
        confidence -= 20;
      } else if (narrowest !== null && narrowest < Z_SASH_AWKWARD) {
        findings.push({
          severity: "warning",
          category: "panel-size",
          message: `${item.id}: the narrowest openable leaf is ${formatFtInSut(narrowest)}. It can be built, but it is tight — confirm the fixed panel sizes.`,
        });
        confidence -= 6;
      }
      continue;
    }

    // The sheet drew a fixed band on top, the fabricator chose plain sliding.
    // Deliberate, but the band still has to be made — say so where he orders.
    if (item.meta.sheetFixFt && item.system !== "domal") {
      findings.push({
        severity: "warning",
        category: "fixed-band",
        message: `${item.id}: a ${item.meta.sheetFixFt} ft fixed panel on top was noted — this list covers the sliding part only. The fixed panel's pipe and glass must be made and ordered separately.`,
      });
      confidence -= 6;
    }

    // A 4-track job saved by an older version was built on a 2-track frame —
    // more shutters than the frame has tracks. Say so instead of cutting it.
    const tracksInFrame = item.system === "normal_2t" ? 2 : item.system === "normal_3t" ? 3 : Infinity;
    if (item.shutters.length > tracksInFrame) {
      findings.push({
        severity: "blocker",
        category: "system-choice",
        message: `${item.id}: ${item.shutters.length} shutters cannot fit a ${tracksInFrame}-track frame. Edit this item and choose 2 or 3 Track.`,
      });
      confidence -= 20;
    }

    const d = item.system === "domal" ? DOMAL_DEFAULTS : DEFAULTS;
    const { shutterW } = shutterSize(item, d);
    // A Domal with a fixed top only slides in the zone below it — the same
    // height the cut list uses, or this check talks about a shutter 2 ft taller
    // than the one being made.
    const shutterH = (item.system === "domal" ? domalFix(item).slidingH : item.height) - d.shutterHeightDeduction;

    // Sanity: shutter too wide
    if (shutterW > mm(1400)) {
      findings.push({
        severity: "warning",
        category: "shutter-size",
        message: `${item.id}: each shutter is ${formatFtInSut(shutterW)} wide. Shutters wider than 1400 mm get heavy — add a track or split the opening.`,
      });
      confidence -= 6;
    }

    // Sanity: glass panel too big for 4mm
    if (shutterW > mm(650) && shutterH > mm(1700)) {
      findings.push({
        severity: "suggestion",
        category: "glass-thickness",
        message: `${item.id}: this glass panel is large (${formatFtInSut(shutterW - d.glassDeductionW)}×${formatFtInSut(shutterH - d.glassDeductionH)}). 5 mm glass is safer here than 4 mm.`,
      });
      confidence -= 2;
    }

    // (No "3 glass, no mesh?" check: the shutter mix is now always an explicit
    // choice on the form, so questioning it only second-guesses the fabricator.)

    // Very small window on 3-track
    if (item.system === "normal_3t" && item.width < mm(1200)) {
      findings.push({
        severity: "suggestion",
        category: "system-choice",
        message: `${item.id}: a ${formatFtInSut(item.width)} wide window does not need 3 tracks — 2 tracks costs less and uses a smaller bottom section.`,
      });
      confidence -= 3;
    }
  }

  if (zLeaves > 0) {
    findings.push({
      severity: "suggestion",
      category: "hardware",
      message: `Hinges, friction stays and handles are not in this list — Z-section hardware is ordered separately. This job needs it for ${zLeaves} openable Z-section ${zLeaves > 1 ? "leaves" : "leaf"}.`,
    });
  }

  // Scrap analysis
  if (list.totals.wastePct > 20) {
    findings.push({
      severity: "warning",
      category: "scrap",
      message: `Total scrap is ${list.totals.wastePct}% (${list.totals.wasteFt} ft). Keep the long leftover pieces — they can be used on the next job.`,
    });
    confidence -= 4;
  } else if (list.totals.wastePct > 12) {
    findings.push({
      severity: "suggestion",
      category: "scrap",
      message: `Scrap is ${list.totals.wastePct}% — acceptable. Keep the usable leftover pieces.`,
    });
  } else if (list.totals.wastePct > 0) {
    findings.push({
      severity: "ok",
      category: "scrap",
      message: `Scrap is only ${list.totals.wastePct}% — efficient cutting.`,
    });
  }


  const summary =
    confidence >= 95
      ? "The estimate looks good — you can start work."
      : confidence >= 88
        ? "The estimate is fine. Please review the suggestions below."
        : "Some items need checking first — please read the warnings below.";

  return { confidence: Math.max(confidence, 60), findings, summary };
}
