/**
 * FabriQ Review Brain — deterministic checks.
 * Runs on every estimate, no AI needed. The AI layer (when an API key is
 * present) adds richer senior-fabricator commentary on top of these.
 */
import { mm, formatFtInSut } from "./units";
import type { JobItem, MaterialList, ReviewFinding, ReviewResult } from "./types";
import { DEFAULTS, DOMAL_DEFAULTS, shutterSize } from "./estimator";

export function reviewEstimate(items: JobItem[], list: MaterialList): ReviewResult {
  const findings: ReviewFinding[] = [];
  let confidence = 98;

  for (const item of items) {
    if (item.system === "door_single") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: the exact OMEO code for the center rail is not yet verified. The size is confirmed — ask your dealer for the section number.`,
      });
      confidence -= 2;
      continue;
    }

    if (item.system === "partition") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: the panel clearance for sheet and glass has not yet been verified against a real job — confirm the glazing groove with your dealer.`,
      });
      confidence -= 2;
      continue;
    }

    const d = item.system === "domal" ? DOMAL_DEFAULTS : DEFAULTS;
    const { shutterW, shutterH } = shutterSize(item, d);

    // Sanity: shutter too wide
    if (shutterW > mm(1400)) {
      findings.push({
        severity: "warning",
        category: "shutter-size",
        message: `${item.id}: the shutter is ${formatFtInSut(shutterW)} wide. Anything over 1400mm runs heavy — consider more tracks, or splitting it.`,
      });
      confidence -= 6;
    }

    // Sanity: glass panel too big for 4mm
    if (shutterW > mm(650) && shutterH > mm(1700)) {
      findings.push({
        severity: "suggestion",
        category: "glass-thickness",
        message: `${item.id}: this is a large glass panel (${formatFtInSut(shutterW - d.glassDeductionW)}×${formatFtInSut(shutterH - d.glassDeductionH)}). 5mm glass is safer here than 4mm.`,
      });
      confidence -= 2;
    }

    // 3-track with 3 glass and no jali — confirm intent
    if (item.system === "normal_3t" && item.shutters.every((s) => s.kind === "glass")) {
      findings.push({
        severity: "suggestion",
        category: "shutter-mix",
        message: `${item.id}: all three shutters on this 3-track are glass — there is no mesh. If an insect screen was wanted, change the shutter mix.`,
      });
    }

    // Very small window on 3-track
    if (item.system === "normal_3t" && item.width < mm(1200)) {
      findings.push({
        severity: "suggestion",
        category: "system-choice",
        message: `${item.id}: at ${formatFtInSut(item.width)} a 3-track is not necessary — a 2-track works out cheaper, with a smaller bottom section.`,
      });
      confidence -= 3;
    }
  }

  // Scrap analysis
  if (list.totals.wastePct > 20) {
    findings.push({
      severity: "warning",
      category: "scrap",
      message: `Total scrap is ${list.totals.wastePct}% (${list.totals.wasteFt} ft). Save the leftover pieces to the Offcut Bank — they will be used on the next job.`,
    });
    confidence -= 4;
  } else if (list.totals.wastePct > 12) {
    findings.push({
      severity: "suggestion",
      category: "scrap",
      message: `Scrap is ${list.totals.wastePct}% — acceptable, but keep the leftover pieces safe.`,
    });
  } else if (list.totals.wastePct > 0) {
    findings.push({
      severity: "ok",
      category: "scrap",
      message: `Scrap is only ${list.totals.wastePct}% — excellent nesting.`,
    });
  }


  const summary =
    confidence >= 95
      ? "This estimate is solid — download it and start work."
      : confidence >= 88
        ? "This estimate is fine. Have a look at the suggestions."
        : "A few things need checking first — read the warnings below.";

  return { confidence: Math.max(confidence, 60), findings, summary };
}
