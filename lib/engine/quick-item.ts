/**
 * Building one JobItem straight from a handful of values — no wizard, no
 * question-by-question round trip. Used by the manual entry screen AND by
 * the Copilot chat, so both go through exactly one place that decides
 * defaults. Un-asked details fall back to the same defaults the questions
 * engine would have offered; the engine itself is never touched by a guess.
 */
import { Um, mm, parseOpening, openingWarning, toFeet } from "./units";
import { mixToShutters, doorMixToZones } from "./questions";
import { estimate } from "./estimator";
import { SECTIONS } from "./sections";
import type { JobItem, MaterialList, OpeningType, SystemId } from "./types";

/** How many openable Z-pipe shutters a custom panel row (e.g. "F2,O,F2") needs —
 *  mirrors estimator.ts's own panel parsing, just counting sashes rather than
 *  building cut pieces. */
export function countZPanelSashes(spec: string | undefined): number {
  if (!spec) return 1;
  const n = spec.split(",").reduce((total, raw) => {
    const tok = raw.trim();
    if (tok.startsWith("F")) return total;
    return total + (tok.length > 1 ? Math.max(1, parseInt(tok.slice(1), 10) || 1) : 1);
  }, 0);
  return Math.max(1, n);
}

export function buildJobItem(
  idNum: number, type: OpeningType, width: Um, height: Um, qty: number,
  metaIn: Record<string, string>,
): JobItem {
  const next: Record<string, string> = { ...metaIn };
  let sys: SystemId;
  let shutters: JobItem["shutters"];

  if (type === "door") {
    sys = "door_single";
    next.chokhat = next.chokhat ?? "needed";
    next.rails = next.rails ?? "2";
    next.zonemix = next.zonemix ?? (next.rails === "3" ? "SSSJ" : "SSJ");
    shutters = doorMixToZones(next.zonemix);
  } else if (type === "partition") {
    sys = "partition";
    next.partDoor = next.partDoor ?? "no";
    if (next.partDoor === "yes") next.partDoorW = next.partDoorW ?? "3";
    next.partSheetFt = next.partSheetFt ?? "0";
    next.partBayFt = next.partBayFt ?? "2.5";
    next.partRowFt = next.partRowFt ?? "3.5";
    shutters = [];
  } else if (next.system === "z_section") {
    sys = "z_section";
    const zType = next.zType ?? "openable";
    next.zSize = next.zSize ?? "light";
    next.zDoor = zType === "door" ? "yes" : "no";
    next.zLayout = zType === "fixed" ? "fixed" : zType === "combo" ? "combo" : zType === "row" ? "row" : "openable";
    if (zType === "combo") {
      next.zComboDir = next.zComboDir ?? "top";
      next.zFixedFt = next.zFixedFt ?? "2";
    }
    if (zType === "openable" || zType === "combo") next.zSashCount = next.zSashCount ?? "2";
    const n = zType === "fixed" || zType === "door"
      ? 1
      : zType === "row"
      ? countZPanelSashes(next.zPanels)
      : Math.max(1, parseInt(next.zSashCount ?? "2", 10));
    shutters = Array.from({ length: n }, () => ({ kind: "glass" as const }));
  } else {
    // Normal Sliding or Domal — track/mix default (track is width-aware).
    const wide = width >= mm(1500);
    const tracks = next.tracks ?? (wide ? "3" : "2");
    next.tracks = tracks;
    sys = next.system === "domal" ? "domal" : tracks === "3" ? "normal_3t" : "normal_2t";
    if (next.system === "domal") {
      next.domalFix = next.domalFix ?? "no";
      if (next.domalFix === "yes") next.domalFixFt = next.domalFixFt ?? "2";
    }
    next.handle = next.handle ?? "std";
    const mix = next.mix ?? (tracks === "4" ? "GGGJ" : tracks === "3" ? "GGJ" : "GG");
    next.mix = mix;
    shutters = mixToShutters(mix);
  }

  return { id: `W${idNum}`, type, width, height, qty, system: sys, shutters, meta: next };
}

export interface QuickItemInput {
  type: OpeningType;
  /** raw dimension strings exactly as the fabricator said them — "4", "4'6\"", "48\"" */
  widthRaw: string;
  heightRaw: string;
  qty?: number;
  /** passthrough to buildJobItem's meta — only the choices that aren't the default */
  meta?: Record<string, string>;
}

export type QuickEstimateResult =
  | { ok: true; item: JobItem; list: MaterialList }
  | { ok: false; error: string };

/** One opening, described in words, straight through to a real MaterialList. */
export function quickEstimate(input: QuickItemInput): QuickEstimateResult {
  const w = parseOpening(input.widthRaw);
  const h = parseOpening(input.heightRaw);
  if (!w || !h) {
    return { ok: false, error: "I couldn't read one of those sizes. Try like \"4 feet\" or \"4'6\"\"." };
  }
  const warning = openingWarning(w.um, h.um);
  if (warning) return { ok: false, error: warning };

  const qty = input.qty && input.qty > 0 ? Math.round(input.qty) : 1;
  const item = buildJobItem(1, input.type, w.um, h.um, qty, input.meta ?? {});
  const list = estimate([item]);
  return { ok: true, item, list };
}

/** A short, chat-sized readout of a MaterialList — sections, glass/mesh, hardware. */
export function summarizeMaterial(list: MaterialList): string {
  const lines: string[] = [];
  for (const s of list.sections) {
    const label = SECTIONS[s.sectionId]?.name ?? s.sectionId;
    lines.push(`- ${label}: ${toFeet(s.totalLength).toFixed(1)} ft (${s.totalPieces} pcs)`);
  }
  if (list.glassSqft > 0) lines.push(`- Glass: ${list.glassSqft.toFixed(1)} sqft`);
  if (list.mesh.sqft > 0) lines.push(`- Mesh: ${list.mesh.sqft.toFixed(1)} sqft`);
  if (list.sheet.sqft > 0) lines.push(`- Sheet: ${list.sheet.sqft.toFixed(1)} sqft`);
  for (const h of list.hardware) lines.push(`- ${h.name}: ${h.qty} ${h.unit}`);
  lines.push(`- Bars: ${list.totals.bars16} × 16ft, ${list.totals.bars8} × 8ft`);
  return lines.join("\n");
}
