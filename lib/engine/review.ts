/**
 * FabriQ Review Brain — deterministic checks.
 * Runs on every estimate, no AI needed. The AI layer (when an API key is
 * present) adds richer senior-fabricator commentary on top of these.
 */
import { mm, formatFtInSut } from "./units";
import type { JobItem, MaterialList, ReviewFinding, ReviewResult } from "./types";
import { DEFAULTS, DOMAL_DEFAULTS, shutterSize, zGeometry } from "./estimator";

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
        message: `${item.id}: center rail ka exact OMEO code abhi verify nahi hua hai. Size confirm hai — section number apne dealer se pooch lo.`,
      });
      confidence -= 2;
      continue;
    }

    if (item.system === "partition") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: sheet aur glass ka panel clearance kisi real job pe abhi verify nahi hua — glazing groove apne dealer se confirm kar lo.`,
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
          message: `${item.id}: is layout me openable leaf sirf ${formatFtInSut(narrowest)} chaudi bach rahi hai — itni jagah me hinge-handle nahi lagega. Cutting se pehle fixed panel ki sizes aur overall width dobara check karo.`,
        });
        confidence -= 20;
      } else if (narrowest !== null && narrowest < Z_SASH_AWKWARD) {
        findings.push({
          severity: "warning",
          category: "panel-size",
          message: `${item.id}: sabse narrow openable leaf ${formatFtInSut(narrowest)} ki aa rahi hai. Ban to jayegi, par tight hai — fixed panel ki sizes ek baar confirm kar lo.`,
        });
        confidence -= 6;
      }
      continue;
    }

    const d = item.system === "domal" ? DOMAL_DEFAULTS : DEFAULTS;
    const { shutterW, shutterH } = shutterSize(item, d);

    // Sanity: shutter too wide
    if (shutterW > mm(1400)) {
      findings.push({
        severity: "warning",
        category: "shutter-size",
        message: `${item.id}: shutter ${formatFtInSut(shutterW)} chaudi hai. 1400mm se zyada wala shutter bhaari ho jata hai — ek track aur badha do, ya isse split kar do.`,
      });
      confidence -= 6;
    }

    // Sanity: glass panel too big for 4mm
    if (shutterW > mm(650) && shutterH > mm(1700)) {
      findings.push({
        severity: "suggestion",
        category: "glass-thickness",
        message: `${item.id}: ye glass panel bada hai (${formatFtInSut(shutterW - d.glassDeductionW)}×${formatFtInSut(shutterH - d.glassDeductionH)}). Yahan 4mm ki jagah 5mm glass zyada safe rahega.`,
      });
      confidence -= 2;
    }

    // 3-track with 3 glass and no jali — confirm intent
    if (item.system === "normal_3t" && item.shutters.every((s) => s.kind === "glass")) {
      findings.push({
        severity: "suggestion",
        category: "shutter-mix",
        message: `${item.id}: is 3-track ke teeno shutter glass hain — jali kahi nahi hai. Agar mesh chahiye thi to shutter mix badal do.`,
      });
    }

    // Very small window on 3-track
    if (item.system === "normal_3t" && item.width < mm(1200)) {
      findings.push({
        severity: "suggestion",
        category: "system-choice",
        message: `${item.id}: ${formatFtInSut(item.width)} chaudi khidki ke liye 3-track ki zaroorat nahi — 2-track sasta padega aur bottom section bhi chota rahega.`,
      });
      confidence -= 3;
    }
  }

  if (zLeaves > 0) {
    findings.push({
      severity: "suggestion",
      category: "hardware",
      message: `Hinges, friction stays aur handles is list me nahi hain — Z-section ka hardware alag se order hota hai. Is job me ${zLeaves} openable Z-section ${zLeaves > 1 ? "leaves" : "leaf"} ke liye khareedna hoga.`,
    });
  }

  // Scrap analysis
  if (list.totals.wastePct > 20) {
    findings.push({
      severity: "warning",
      category: "scrap",
      message: `Total scrap ${list.totals.wastePct}% (${list.totals.wasteFt} ft) hai. Bache hue pieces Offcut Bank me daal do — agli job me kaam aa jayenge.`,
    });
    confidence -= 4;
  } else if (list.totals.wastePct > 12) {
    findings.push({
      severity: "suggestion",
      category: "scrap",
      message: `Scrap ${list.totals.wastePct}% hai — theek hai, par bache hue pieces sambhal ke rakhna.`,
    });
  } else if (list.totals.wastePct > 0) {
    findings.push({
      severity: "ok",
      category: "scrap",
      message: `Scrap sirf ${list.totals.wastePct}% hai — nesting badhiya hui hai.`,
    });
  }


  const summary =
    confidence >= 95
      ? "Estimate solid hai — download karke kaam shuru karo."
      : confidence >= 88
        ? "Estimate theek hai. Neeche ke suggestions ek baar dekh lo."
        : "Kuch cheezein pehle check karni hongi — neeche ki warnings padh lo.";

  return { confidence: Math.max(confidence, 60), findings, summary };
}
