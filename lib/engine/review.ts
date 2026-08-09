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
        message: `${item.id}: Center rail ka exact OMEO code abhi verify nahi hai (size confirm hai, dealer se sec no. pooch lena).`,
      });
      confidence -= 2;
      continue;
    }

    if (item.system === "partition") {
      findings.push({
        severity: "suggestion",
        category: "section-verify",
        message: `${item.id}: Panel (sheet/glass) ka clearance abhi ek real job se verify nahi hua — dealer se glazing groove confirm kar lena.`,
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
        message: `${item.id}: shutter ${formatFtInSut(shutterW)} wide hai — 1400mm se zyada heavy chalti hai. Zyada track ya divide consider karo.`,
      });
      confidence -= 6;
    }

    // Sanity: glass panel too big for 4mm
    if (shutterW > mm(650) && shutterH > mm(1700)) {
      findings.push({
        severity: "suggestion",
        category: "glass-thickness",
        message: `${item.id}: glass panel bada hai (${formatFtInSut(shutterW - d.glassDeductionW)}×${formatFtInSut(shutterH - d.glassDeductionH)}). 4mm ki jagah 5mm glass safe rahega.`,
      });
      confidence -= 2;
    }

    // 3-track with 3 glass and no jali — confirm intent
    if (item.system === "normal_3t" && item.shutters.every((s) => s.kind === "glass")) {
      findings.push({
        severity: "suggestion",
        category: "shutter-mix",
        message: `${item.id}: 3-track mein teeno glass shutter hain — jali nahi. Agar machar jali chahiye thi toh shutter mix badlo.`,
      });
    }

    // Very small window on 3-track
    if (item.system === "normal_3t" && item.width < mm(1200)) {
      findings.push({
        severity: "suggestion",
        category: "system-choice",
        message: `${item.id}: ${formatFtInSut(item.width)} chhoti width pe 3-track zaroori nahi — 2-track sasta padega (chhota bottom section).`,
      });
      confidence -= 3;
    }
  }

  // Scrap analysis
  if (list.totals.wastePct > 20) {
    findings.push({
      severity: "warning",
      category: "scrap",
      message: `Total scrap ${list.totals.wastePct}% hai (${list.totals.wasteFt} ft). Bache tukde Offcut Bank mein save karo — agle kaam mein lagenge.`,
    });
    confidence -= 4;
  } else if (list.totals.wastePct > 12) {
    findings.push({
      severity: "suggestion",
      category: "scrap",
      message: `Scrap ${list.totals.wastePct}% — theek hai, par bache tukde sambhal ke rakho.`,
    });
  } else if (list.totals.wastePct > 0) {
    findings.push({
      severity: "ok",
      category: "scrap",
      message: `Scrap sirf ${list.totals.wastePct}% — bahut achhi nesting hai!`,
    });
  }


  const summary =
    confidence >= 95
      ? "Estimate solid hai — download karke kaam shuru karo."
      : confidence >= 88
        ? "Estimate theek hai, kuch suggestions dekh lo."
        : "Kuch cheezein check karni chahiye pehle — warnings padho.";

  return { confidence: Math.max(confidence, 60), findings, summary };
}
