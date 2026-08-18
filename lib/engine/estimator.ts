/**
 * FabriQ deterministic estimator — Normal Sliding 2T/3T + Domal 27/29mm + Door.
 * D2: AI never calculates. Every number here is traceable to a formula.
 * Deductions are DEFAULTS — per-fabricator calibration overrides them later.
 */
import { Um, mm, inches, formatFtInSut, toFeet, sqft } from "./units";
import type {
  JobItem, CutPiece, GlassPanel, HardwareLine, MaterialList,
} from "./types";
import { packAllSections, summarize } from "./cutting";
import { getSection } from "./sections";

/** Default deductions (µm) — calibratable per fabricator. Normal Sliding. */
export const DEFAULTS = {
  // shutter height = opening height − this — fabricator-verified 2026-07-27
  // against a real 72"×60" 3-track job (handle/interlock came out 58.375",
  // so deduction = 60 − 58.375 = 1.625").
  shutterHeightDeduction: mm(41.3),
  // Glass deduction — fabricator-verified 2026-07-27: glass = shutter opening
  // − 2×(profile face-width − glazing groove depth). Handle/Interlock/Bearing
  // are all 40mm face-width with a 9mm-deep glazing groove, so net deduction
  // = 2×(40−9) = 62mm, same on width and height (all three pieces match).
  glassDeductionW: mm(62),
  glassDeductionH: mm(62),
  /** bearing (horizontal) length = shutterW − this (handle+interlock webs) */
  bearingDeduction: mm(80),
  /** rubber/pile wastage allowance */
  wastagePct: 5,
};

/**
 * Domal 27/29mm deductions — same starting numbers as Normal Sliding
 * (section identity is founder-confirmed, exact deduction values are NOT
 * yet calibrated against a real Domal job). Adjust here once verified.
 */
export const DOMAL_DEFAULTS = {
  // fabricator-verified 2026-07-27 against a real 66"×58" 3-track Domal job
  // (handle/interlock came out 55.375", deduction = 58 − 55.375 = 2.625").
  // Cross-checked 2026-08-04 against measurement videos (−3" to −3⅛" range).
  shutterHeightDeduction: mm(66.7),
  // Domal shutter (2046/2047) is 65mm face-width with a 14mm-deep glazing
  // groove — net deduction = 2×(65−14) = 102mm, same on width and height
  // (fabricator-verified 2026-07-27; VIDEO-CONFIRMED 2026-08-04: "glass =
  // shutter − 4 inch/4⅛ inch" ≈ 102–105mm).
  glassDeductionW: mm(102),
  glassDeductionH: mm(102),
  wastagePct: 5,
};

/**
 * Domal "sliding + upar fix" (fixed glass band on top of the sliding window).
 * Founder-confirmed (2026-08-04): the FIXED top is framed with SP PARTITION
 * PIPE ("upar fix hai to SP partition pipe lagegi"), with an SP coupler
 * dividing it from the sliding zone below, and the fixed glass held by a
 * glazing clip. The outer left/right split: the lower (sliding) height runs
 * on the Domal track frame, the upper (fixed) height runs on SP pipe.
 */
const DOMAL_SP = "partition_frame";     // SP pipe (17003) — fixed-top frame + coupler
const DOMAL_SP_FACE = mm(38.1);         // 1.5" SP sight-line face
const DOMAL_COUPLER_FACE = mm(45);      // the coupler/track face the fixed glass sits below
const DOMAL_FIX_CLEAR = mm(12.7);       // 4 sut (½") glass clearance in the fixed pocket

interface DomalFix {
  hasFix: boolean;
  fixRaw: Um;        // raw height of the fixed top band
  slidingH: Um;      // height available to the sliding zone
  fixedGlassW: Um;
  fixedGlassH: Um;
}

/** Split an item into its sliding zone + optional fixed-top band. */
function domalFix(item: JobItem): DomalFix {
  const hasFix = item.meta.domalFix === "yes";
  const fixRaw = hasFix ? mm((parseFloat(item.meta.domalFixFt ?? "2") || 2) * 304.8) : 0;
  const slidingH = item.height - fixRaw;
  return {
    hasFix, fixRaw, slidingH,
    // fixed glass = fixed pocket − 4 sut (partition-style clip retention)
    fixedGlassW: item.width - 2 * DOMAL_SP_FACE - DOMAL_FIX_CLEAR,
    fixedGlassH: fixRaw - DOMAL_SP_FACE - DOMAL_COUPLER_FACE - DOMAL_FIX_CLEAR,
  };
}

/**
 * Door (single, hinged) deductions — fabricator-verified 2026-07-27 against
 * a real 30"×84" job (palla perimeter totalled 218" exactly with a 2.5"
 * clearance on the 75mm/3" palla profile). Clearance scales with profile
 * size: (profile width in inches) − 0.5". Same clearance value applies to
 * BOTH the palla-from-opening deduction AND the infill-from-palla deduction
 * (confirmed: infill 25" from a 27.5" palla is the same 2.5").
 */
const PALLA_PROFILE_INCHES: Record<"75" | "60" | "50", number> = {
  "75": 3, "60": 2.5, "50": 2,
};

function doorClearance(key: "75" | "60" | "50"): Um {
  return mm((PALLA_PROFILE_INCHES[key] - 0.5) * 25.4);
}

export const DOOR_DEFAULTS = {
  wastagePct: 5,
};

/**
 * Partition (SP/DP) deductions. SP frame and DP divider are cut to raw
 * width/height (the frame pattern). Panel (glass/sheet) clearance inside the
 * glazing pocket = 4 sut (1/2" = 12.7mm) on BOTH width and height —
 * video-confirmed (2026-08-04, multiple partition tutorials: "height me 4 sut
 * minus, width me bhi 4 sut minus"; drop to 3 sut only if the frame is
 * perfectly square/guniya, else 4 sut is safest).
 */
export const PARTITION_DEFAULTS = {
  panelClearance: mm(12.7), // 4 sut (1/2")
  wastagePct: 5,
};

/**
 * Z-section (hinge-openable, friction-stay) — a DIFFERENT construction
 * logic from every other system here: the openable shutter is cut LARGER
 * than the opening (it climbs/overlaps onto the outer frame's face), not
 * smaller, because the Z-profile physically laps over the frame when closed
 * (founder-verified 2026-08-01/08-03, cross-checked against 13 fabrication
 * videos — see docs/09-zsection-deep-analysis.md). Two size families exist,
 * matched by catalogue role:
 *   light = z_outer_40 + z_pipe_40 + z_center_55  (normal windows)
 *   heavy = z_outer_55 + z_pipe_55 + z_center_70  (large windows, doors)
 *
 * Every measurement is driven by a single founder-confirmed constant: the
 * profile's SIGHT-LINE width in the wall plane is 40mm on every variant, so
 * both the outer frame and the Z-pipe eat 40mm per side. Overlap is a flat
 * uniform +10mm (5mm/side) on the sash — the hinge-side maximum, kept the
 * same on all sides so the math stays consistent (founder-delegated choice).
 * Glass is cut 5mm smaller than its pocket on every side. The glazing clip
 * runs the full 4-side perimeter of every GLASS panel only.
 */
const Z_FACE = mm(40);            // sight-line width, both outer & Z-pipe, per side
const Z_OVERLAP = mm(10);         // sash grows by this on W and H (5mm/side climb)
const Z_GLASS_CLEAR = mm(5);      // glass is this much smaller per side than its pocket
const Z_TRANSOM_HALF = mm(20);    // half the transom face, charged to each combo zone

export const ZSECTION_DEFAULTS = {
  overlapW: Z_OVERLAP,
  overlapH: Z_OVERLAP,
  wastagePct: 5,
};

// Door variant — founder/video-verified (40×65mm heavy Z series door):
// height = inner opening height − 1/2", width = inner opening width + 1".
// No mullion is used for a plain door leaf (single leaf only).
const Z_DOOR_HEIGHT_DEDUCTION = inches(0.5);
const Z_DOOR_WIDTH_ADDITION = inches(1);

function zSizeFamily(item: JobItem): "light" | "heavy" {
  return item.meta.zSize === "heavy" ? "heavy" : "light";
}

function zSectionIds(family: "light" | "heavy") {
  return family === "heavy"
    ? { outer: "z_outer_55", pipe: "z_pipe_55", center: "z_center_70" }
    : { outer: "z_outer_40", pipe: "z_pipe_40", center: "z_center_55" };
}

export type ZLayout = "openable" | "fixed" | "combo" | "row";

/** Which layout this Z item is — door forces a single openable leaf. */
function zLayout(item: JobItem): ZLayout {
  if (item.meta.zDoor === "yes") return "openable";
  const l = item.meta.zLayout;
  return l === "fixed" || l === "combo" || l === "row" ? l : "openable";
}

/**
 * A Z-section window is, in general, an outer frame divided along ONE axis
 * — side-by-side (vertical dividers/mullions) or stacked (horizontal
 * dividers/transoms) — into an ORDERED ROW of panels, each either FIXED
 * (an explicit size in feet) or OPEN (one or more openable sashes sharing
 * whatever width/height is left over, split evenly). "Fixed on top",
 * "fixed on one side" and "fixed on both sides" are not three different
 * formulas — they are the same row-of-panels rule with 2 or 3 panels in a
 * particular order. Any other real-world layout (fixed in the middle,
 * three fixed strips, four stacked bands, …) is just a longer or
 * differently-ordered panel list through this same function.
 */
type ZPanel = { kind: "fixed"; ft: number } | { kind: "open"; sashes: number };

function parseZPanels(spec: string | undefined): ZPanel[] {
  if (!spec) return [];
  return spec.split(",").map((raw) => {
    const tok = raw.trim();
    if (tok.startsWith("F")) return { kind: "fixed" as const, ft: parseFloat(tok.slice(1)) || 2 };
    const sashes = tok.length > 1 ? Math.max(1, parseInt(tok.slice(1), 10) || 1) : 1;
    return { kind: "open" as const, sashes };
  });
}

/** Legacy zComboDir/zFixedFt/zSashCount meta (still what the guided question
 *  flow and Copilot ask) expressed as the same general panel row, so both
 *  the old simple UI and the manual wizard's full panel builder run through
 *  one geometry formula instead of two that could drift apart. */
function legacyComboPanels(item: JobItem): { axis: "cols" | "rows"; panels: ZPanel[] } {
  const ft = parseFloat(item.meta.zFixedFt ?? "2") || 2;
  const sashes = Math.max(1, item.shutters.length || 1);
  if (item.meta.zComboDir === "both") {
    return { axis: "cols", panels: [{ kind: "fixed", ft }, { kind: "open", sashes }, { kind: "fixed", ft }] };
  }
  if (item.meta.zComboDir === "center") {
    // openable | fixed | openable — one sash either side of a centre-fixed
    // pane. Sash COUNT here means "each side", not the window total, since
    // the guided question only ever asks for one number.
    return { axis: "cols", panels: [{ kind: "open", sashes }, { kind: "fixed", ft }, { kind: "open", sashes }] };
  }
  if (item.meta.zComboDir === "side") {
    return { axis: "cols", panels: [{ kind: "fixed", ft }, { kind: "open", sashes }] };
  }
  return { axis: "rows", panels: [{ kind: "fixed", ft }, { kind: "open", sashes }] }; // "top" (default)
}

/**
 * Build fixed/sash/mullion/transom pieces for one ordered panel row. Every
 * boundary — outer frame edge or the shared line between two panels — eats
 * its own face width off the raw share; only the boundary itself decides
 * the deduction (Z_FACE at the two outer ends, Z_TRANSOM_HALF at every
 * internal join), never which kind of panel sits on either side of it.
 */
function applyZRowPanels(
  g: ZGeom, axis: "cols" | "rows", panels: ZPanel[], item: JobItem,
  fill: "glass" | "jali" | "sheet",
): void {
  const openW = item.width - 2 * Z_FACE;
  const openH = item.height - 2 * Z_FACE;
  if (panels.length === 0) { g.fixed.push(zMakeFixed(fill, openW, openH)); return; }

  const n = panels.length;
  const runLenRaw = axis === "cols" ? item.width : item.height;
  const crossLen = axis === "cols" ? openH : openW; // the dimension NOT divided
  const fixedTotalRaw = panels.reduce((s, p) => s + (p.kind === "fixed" ? mm(p.ft * 304.8) : mm(0)), 0);
  const openCount = panels.filter((p) => p.kind === "open").length;
  const openRawEach = openCount > 0 ? Math.max(mm(0), runLenRaw - fixedTotalRaw) / openCount : mm(0);

  panels.forEach((p, i) => {
    const nearFace = i === 0 ? Z_FACE : Z_TRANSOM_HALF;
    const farFace = i === n - 1 ? Z_FACE : Z_TRANSOM_HALF;
    const raw = p.kind === "fixed" ? mm(p.ft * 304.8) : openRawEach;
    const pocketLen = raw - nearFace - farFace;

    if (p.kind === "fixed") {
      g.fixed.push(axis === "cols" ? zMakeFixed(fill, pocketLen, crossLen) : zMakeFixed(fill, crossLen, pocketLen));
    } else {
      const sashCount = Math.max(1, p.sashes);
      const sashLen = sashCount > 1 ? Math.round(pocketLen / sashCount) : pocketLen;
      // Sashes within one panel always sit side by side, so the divider
      // between them is a vertical mullion regardless of the row's axis.
      const mullionLen = axis === "cols" ? crossLen : pocketLen;
      for (let s = 0; s < sashCount - 1; s++) g.mullions.push(mullionLen);
      for (let s = 0; s < sashCount; s++) {
        g.sashes.push(axis === "cols" ? zMakeSash("glass", sashLen, crossLen, false) : zMakeSash("glass", crossLen, sashLen, false));
      }
    }
    // boundary to the NEXT panel — a vertical mullion between side-by-side
    // panels, a horizontal transom between stacked ones.
    if (i < n - 1) (axis === "cols" ? g.mullions : g.transoms).push(crossLen);
  });
}

export interface ZSash {
  kind: "glass" | "jali" | "sheet";
  shW: Um; shH: Um;         // shutter (Z-pipe) outer cut sizes
  pocketW: Um; pocketH: Um; // glass pocket (shutter inside-to-inside)
  glassW: Um; glassH: Um;   // actual glass cut
}
export interface ZFixed {
  kind: "glass" | "jali" | "sheet";
  pocketW: Um; pocketH: Um; // opening the panel fills (frame/transom inside)
  glassW: Um; glassH: Um;
}
export interface ZGeom {
  outer: string; pipe: string; center: string;
  outerW: Um; outerH: Um;
  mullions: Um[];   // vertical dividers (z_center), length = openable zone height
  transoms: Um[];   // horizontal dividers (z_center), length = inner width
  sashes: ZSash[];  // openable leaves
  fixed: ZFixed[];  // fixed glass panels
}

/** Build one openable sash's sizes for a given opening. */
function zMakeSash(
  kind: ZSash["kind"], openW: Um, openH: Um, isDoor: boolean,
): ZSash {
  const shW = isDoor ? openW + Z_DOOR_WIDTH_ADDITION : openW + Z_OVERLAP;
  const shH = isDoor ? openH - Z_DOOR_HEIGHT_DEDUCTION : openH + Z_OVERLAP;
  const pocketW = shW - 2 * Z_FACE;
  const pocketH = shH - 2 * Z_FACE;
  return {
    kind, shW, shH, pocketW, pocketH,
    glassW: pocketW - 2 * Z_GLASS_CLEAR,
    glassH: pocketH - 2 * Z_GLASS_CLEAR,
  };
}

/** A fixed glass panel filling an opening directly (no shutter). */
function zMakeFixed(kind: ZFixed["kind"], openW: Um, openH: Um): ZFixed {
  return {
    kind, pocketW: openW, pocketH: openH,
    glassW: openW - 2 * Z_GLASS_CLEAR,
    glassH: openH - 2 * Z_GLASS_CLEAR,
  };
}

/**
 * Full geometry for one Z-section item — the single source of truth shared
 * by expandZSectionItem (cut pieces) and estimate() (glass/panels), so the
 * two can never drift. Handles all four situations:
 *   • door      → 1 openable leaf, no mullion (½" / +1" formula)
 *   • openable  → N side-by-side sashes + (N−1) vertical mullions
 *   • fixed     → 1 fixed glass panel, no shutter (glass in the outer frame)
 *   • combo     → top fixed panel + horizontal transom + bottom openable
 *                 (N sashes + mullions), the classic "upar fix, neeche khule"
 */
export function zGeometry(item: JobItem): ZGeom {
  const family = zSizeFamily(item);
  const { outer, pipe, center } = zSectionIds(family);
  const isDoor = item.meta.zDoor === "yes";
  const layout = zLayout(item);

  const openW = item.width - 2 * Z_FACE;
  const openH = item.height - 2 * Z_FACE;

  const g: ZGeom = {
    outer, pipe, center,
    outerW: item.width, outerH: item.height,
    mullions: [], transoms: [], sashes: [], fixed: [],
  };

  if (layout === "fixed") {
    const kind = item.shutters[0]?.kind ?? "glass";
    g.fixed.push(zMakeFixed(kind, openW, openH));
    return g;
  }

  if (layout === "combo" || layout === "row") {
    const fixedFill = item.meta.zFixedFill === "jali" ? "jali"
      : item.meta.zFixedFill === "sheet" ? "sheet" : "glass";
    // "row" is the general case: an explicit, arbitrary-length panel
    // sequence (meta.zPanels) along an explicit axis (meta.zAxis) — used by
    // the manual wizard's panel builder. "combo" is the older, simpler
    // top/side/both question asked by the guided flow and Copilot; it is
    // translated into the exact same panel-row shape so one formula (below)
    // computes both instead of two formulas that could quietly drift apart.
    const { axis, panels } = layout === "row"
      ? { axis: (item.meta.zAxis === "rows" ? "rows" : "cols") as "cols" | "rows", panels: parseZPanels(item.meta.zPanels) }
      : legacyComboPanels(item);
    applyZRowPanels(g, axis, panels, item, fixedFill);
    return g;
  }

  // openable (windows) or door
  const sashes = isDoor
    ? [item.shutters[0] ?? { kind: "glass" as const }]
    : (item.shutters.length ? item.shutters : [{ kind: "glass" as const }]);
  const n = sashes.length;
  const sashOpenW = n > 1 ? Math.round(openW / n) : openW;
  if (!isDoor) for (let m = 0; m < n - 1; m++) g.mullions.push(openH);
  sashes.forEach((sh) => g.sashes.push(zMakeSash(sh.kind, sashOpenW, openH, isDoor)));
  return g;
}

function frameSections(item: JobItem): { top: string; bottom: string } {
  return item.system === "normal_3t"
    ? { top: "3t_top", bottom: "3t_bottom" }
    : { top: "2t_top", bottom: "2t_bottom" };
}

/**
 * Shutter width = window width ÷ 2, ALWAYS — regardless of shutter/track
 * count (fabricator-confirmed, 2026-07-27, cross-checked against a real
 * 3-track job). This is why a sliding window only ever opens ~50%: each
 * shutter is sized to cover half the frame so one can slide fully behind
 * the other(s); extra tracks just give room to park more shutters, they
 * don't shrink shutter width.
 */
export function shutterSize(item: JobItem, d: { shutterHeightDeduction: Um }) {
  const shutterW = Math.round(item.width / 2);
  const shutterH = item.height - d.shutterHeightDeduction;
  return { shutterW, shutterH };
}

/** Expand one item (×qty) into cut pieces */
export function expandItem(item: JobItem, index: number): CutPiece[] {
  if (item.system === "domal") return expandDomalItem(item);
  if (item.system === "door_single") return expandDoorItem(item);
  if (item.system === "partition") return expandPartitionItem(item);
  if (item.system === "z_section") return expandZSectionItem(item);
  return expandNormalItem(item);
}

function expandNormalItem(item: JobItem): CutPiece[] {
  const pieces: CutPiece[] = [];
  const { top, bottom } = frameSections(item);
  const { shutterW, shutterH } = shutterSize(item, DEFAULTS);
  const bearingLen = shutterW - DEFAULTS.bearingDeduction;

  for (let q = 0; q < item.qty; q++) {
    const wId = `${item.id}${item.qty > 1 ? `.${q + 1}` : ""}`;
    const sizeLabel = `${formatFtInSut(item.width)}×${formatFtInSut(item.height)}`;
    const push = (sectionId: string, length: Um, role: string) =>
      pieces.push({
        sectionId, length, itemId: wId, role,
        label: `${wId} ${sizeLabel} — ${role}`,
      });

    // Frame: top + 2 sides from top-section, bottom separate
    push(top, item.width, "Top");
    push(top, item.height, "Left Side");
    push(top, item.height, "Right Side");
    push(bottom, item.width, "Bottom");

    // Shutters — Normal Sliding: glass aur jali dono mein same sections
    item.shutters.forEach((sh, i) => {
      const sn = `S${i + 1}`;
      const tag = sh.kind === "jali" ? " (Mesh)" : "";
      push("handle_std", shutterH, `${sn} Handle${tag}`);
      push("interlock", shutterH, `${sn} Interlock${tag}`);
      push("bearing", bearingLen, `${sn} Bearing Top${tag}`);
      push("bearing", bearingLen, `${sn} Bearing Bottom${tag}`);
    });
  }
  return pieces;
}

/**
 * Domal 27/29mm: whole shutter is a 4-side mini-frame from ONE profile
 * (glass shutter = 2046, jali shutter = 2081) — no separate handle/
 * interlock/bearing roles like Normal Sliding. A single interlock strip
 * (2091) is cut to shutter height per GLASS shutter only, where shutters
 * meet in track — jali shutters don't take an interlock (fabricator-
 * confirmed 2026-07-27).
 */
function expandDomalItem(item: JobItem): CutPiece[] {
  const pieces: CutPiece[] = [];
  const fx = domalFix(item);
  // Sliding shutter: width = W/2 always (founder-confirmed, kept); height =
  // (sliding-zone height) − Domal deduction.
  const shutterW = Math.round(item.width / 2);
  const shutterH = fx.slidingH - DOMAL_DEFAULTS.shutterHeightDeduction;
  const n = item.shutters.length;

  for (let q = 0; q < item.qty; q++) {
    const wId = `${item.id}${item.qty > 1 ? `.${q + 1}` : ""}`;
    const sizeLabel = `${formatFtInSut(item.width)}×${formatFtInSut(item.height)}`;
    const push = (sectionId: string, length: Um, role: string) =>
      pieces.push({
        sectionId, length, itemId: wId, role,
        label: `${wId} ${sizeLabel} — ${role}`,
      });

    // Outer frame (Domal track). With a fixed top, the left/right verticals
    // only run the sliding-zone height; the fixed band above uses SP pipe.
    const sideH = fx.hasFix ? fx.slidingH : item.height;
    push("domal_frame", item.width, fx.hasFix ? "Frame Coupler Top" : "Frame Top");
    push("domal_frame", sideH, "Frame Left");
    push("domal_frame", sideH, "Frame Right");
    push("domal_frame", item.width, "Frame Bottom");

    // Fixed top band (optional): SP frame (top + 2 sides) sitting on the Domal
    // coupler-top, fixed glass held by a glazing clip on all 4 sides.
    if (fx.hasFix) {
      push(DOMAL_SP, item.width, "Fix Top (SP)");
      push(DOMAL_SP, fx.fixRaw, "Fix Left (SP)");
      push(DOMAL_SP, fx.fixRaw, "Fix Right (SP)");
      push("glazing_clip", fx.fixedGlassW, "Fix Clip Top");
      push("glazing_clip", fx.fixedGlassW, "Fix Clip Bottom");
      push("glazing_clip", fx.fixedGlassH, "Fix Clip Left");
      push("glazing_clip", fx.fixedGlassH, "Fix Clip Right");
    }

    // Sliding shutters — each a 4-side mini-frame from one profile.
    item.shutters.forEach((sh, i) => {
      const sn = `S${i + 1}`;
      const secId = sh.kind === "jali" ? "domal_jali_shutter" : "domal_glass_shutter";
      const tag = sh.kind === "jali" ? " (Mesh)" : "";
      push(secId, shutterW, `${sn} Shutter Top${tag}`);
      push(secId, shutterW, `${sn} Shutter Bottom${tag}`);
      push(secId, shutterH, `${sn} Shutter Left${tag}`);
      push(secId, shutterH, `${sn} Shutter Right${tag}`);
    });

    // Interlock patti (male+female) at every shutter meeting = 2×(shutters−1),
    // each cut to shutter height. Video-confirmed 2026-08-04: 2T=2, 3T=4, 4T=6.
    const meetings = Math.max(0, n - 1);
    for (let k = 0; k < 2 * meetings; k++) {
      push("domal_interlock", shutterH, `Interlock ${k + 1}`);
    }
  }
  return pieces;
}

/** palla size key from meta, default "60" (Moulding Handle 63×25) */
function pallaKey(item: JobItem): "75" | "60" | "50" {
  const p = item.meta.palla;
  return p === "75" || p === "50" ? p : "60";
}

/**
 * Door (single, hinged): chokhat (frame, optional) + palla (outer leaf,
 * one profile all 4 sides) + N center rails (same size class as palla,
 * different double-grooved die) dividing the leaf into N+1 zones, each
 * filled with sheet or jali (both fitted with rubber gasket).
 */
function expandDoorItem(item: JobItem): CutPiece[] {
  const pieces: CutPiece[] = [];
  const key = pallaKey(item);
  const pallaSection = `door_palla_${key}`;
  const centerSection = `door_center_${key}`;
  const hasChokhat = item.meta.chokhat === "needed";

  const clearance = doorClearance(key);
  const pallaW = item.width - clearance;
  const pallaH = item.height - clearance;
  const railCount = item.shutters.length - 1;

  for (let q = 0; q < item.qty; q++) {
    const wId = `${item.id}${item.qty > 1 ? `.${q + 1}` : ""}`;
    const sizeLabel = `${formatFtInSut(item.width)}×${formatFtInSut(item.height)}`;
    const push = (sectionId: string, length: Um, role: string) =>
      pieces.push({
        sectionId, length, itemId: wId, role,
        label: `${wId} ${sizeLabel} — ${role}`,
      });

    if (hasChokhat) {
      push("door_frame_pattam", item.width, "Frame Top");
      push("door_frame_pattam", item.height, "Frame Left");
      push("door_frame_pattam", item.height, "Frame Right");
      push("door_frame_pattam", item.width, "Frame Bottom");
    }

    // Top/Bottom/Center rails all span the SAME horizontal gap — between
    // the inner faces of the Left/Right verticals — so they take the same
    // clearance reduction again (fabricator-confirmed 2026-07-27: 27.5"
    // palla → 25" center, same 2.5" clearance reused).
    const railW = pallaW - clearance;
    push(pallaSection, railW, "Shutter Top");
    push(pallaSection, railW, "Shutter Bottom");
    push(pallaSection, pallaH, "Shutter Left");
    push(pallaSection, pallaH, "Shutter Right");

    for (let r = 0; r < railCount; r++) {
      push(centerSection, railW, `Center Rail ${r + 1}`);
    }
  }
  return pieces;
}

/**
 * Vertical column split for one zone's width (fabricator-confirmed
 * 2026-07-28: verticals go roughly every 4 feet — structural support +
 * matches standard sheet stock width).
 *
 * Sheet zones: decompose width into 3ft/4ft segments (matching 3×8/4×8/3×12
 * sheet stock) so panels cut with near-zero width waste — a coin-change DP
 * minimizing segment count. Falls back to a greedy 4ft-then-remainder split
 * if no exact 3/4ft combination exists (e.g. 5ft).
 *
 * Glass zones: glass has no fixed stock width, so just equal-split into
 * columns ≤4ft (no stock-matching needed, only the structural limit).
 */
function sheetColumnsFt(totalFt: number): number[] {
  const w = Math.round(totalFt);
  if (w <= 0) return [];
  if (w <= 4) return [w];
  const dp: (number[] | null)[] = new Array(w + 1).fill(null);
  dp[0] = [];
  for (let i = 1; i <= w; i++) {
    for (const coin of [3, 4]) {
      if (i - coin >= 0 && dp[i - coin]) {
        const candidate = [...dp[i - coin]!, coin];
        if (!dp[i] || candidate.length < dp[i]!.length) dp[i] = candidate;
      }
    }
  }
  if (dp[w]) return dp[w]!;
  // no exact combo (e.g. 5ft) — greedy 4ft segments + one custom remainder
  const segments: number[] = [];
  let remaining = w;
  while (remaining > 4) { segments.push(4); remaining -= 4; }
  if (remaining > 0) segments.push(remaining);
  return segments;
}

function glassColumnsFt(totalFt: number): number[] {
  const cols = Math.max(1, Math.ceil(totalFt / 4));
  const each = totalFt / cols;
  return new Array(cols).fill(each);
}

/**
 * Row split for one zone's HEIGHT — same ~4ft structural spacing rule,
 * applied to both sheet and glass (purely structural, not stock-driven:
 * sheet stock length is 8-12ft, well beyond typical zone heights, so only
 * the support-spacing limit matters here, same as the vertical/width case).
 */
function rowsFt(totalFt: number): number[] {
  const cols = Math.max(1, Math.ceil(totalFt / 4));
  const each = totalFt / cols;
  return new Array(cols).fill(each);
}

/**
 * Partition (fixed, office-style): SP (Single Partition, 17003) forms the
 * outer 4-side frame. DP (Double Partition, 17502) forms N horizontal
 * dividers splitting the frame into N+1 zones, each filled with sheet or
 * glass (fabricator-confirmed 2026-07-28), further split by vertical DP
 * dividers within each zone (see column-split functions above), and held
 * by a Glazing Clip running each panel's perimeter (like wool pile, not a
 * bar section).
 */
// ---- Partition geometry (SP/DP grid, optional door, sheet+glass bands) ----
// Founder + video verified (2026-08-04):
//  • SP (Single Partition, 1 groove) = outer frame — wall/door sides, flat
//    against the wall; clip on its ONE panel-facing groove.
//  • DP (Double Partition, 2 grooves) = internal dividers (vertical + horizontal)
//    with a panel each side; clip on BOTH grooves (×2 length).
//  • Panel (glass/sheet) = clear opening − 4 sut (½"). Bottom rail = width − 3".
//  • Door (optional) reserves a column: DP jamb + a leaf (reuses the single-door
//    palla profile) with one middle rail; the door leaf takes no glazing clip.
//  • Dividers are placed from the user's chosen bay width (drawing-driven) and a
//    ≤4ft structural row limit — so no glass pane is oversized/heavy.
const PART_FACE = mm(38.1); // SP/DP 1.5" sight-line face

interface PartPanel { kind: "glass" | "sheet"; w: Um; h: Um; }
interface PartPiece { section: string; length: Um; role: string; clipMul: number }
interface PartGeom { pieces: PartPiece[]; panels: PartPanel[] }

function partitionGeometry(item: JobItem): PartGeom {
  const hasDoor = item.meta.partDoor === "yes";
  const doorW = hasDoor ? mm((parseFloat(item.meta.partDoorW ?? "3") || 3) * 304.8) : 0;
  const sheetFt = Math.max(0, parseFloat(item.meta.partSheetFt ?? "0") || 0);
  const bayFt = Math.max(1, parseFloat(item.meta.partBayFt ?? "2.5") || 2.5);

  const face = PART_FACE;
  const clear = PARTITION_DEFAULTS.panelClearance;
  const innerH = item.height - 2 * face;

  const pieces: PartPiece[] = [];
  const panels: PartPanel[] = [];
  const P = (section: string, length: Um, role: string, clipMul = 1) =>
    pieces.push({ section, length, role, clipMul });

  // Outer SP frame — top & sides full, bottom minus both verticals (−3").
  P("partition_frame", item.width, "SP Top");
  P("partition_frame", item.width - 2 * face, "SP Bottom");
  P("partition_frame", item.height, "SP Left");
  P("partition_frame", item.height, "SP Right");

  // Door column on the right (optional): DP jamb + a leaf with 1 middle rail.
  let fieldW = item.width - 2 * face;
  if (hasDoor) {
    fieldW = fieldW - doorW - face;
    P("partition_divider", innerH, "DP Door-jamb", 2);
    const leafW = doorW - inches(0.75);
    const leafH = innerH - inches(0.75);
    P("door_palla_60", leafW, "Door Top", 0);
    P("door_palla_60", leafW, "Door Bottom", 0);
    P("door_palla_60", leafH, "Door Left", 0);
    P("door_palla_60", leafH, "Door Right", 0);
    P("door_center_60", leafW, "Door Middle", 0);
  }

  // Vertical bays across the field (from the chosen bay width).
  const bays = Math.max(1, Math.round(toFeet(fieldW) / bayFt));
  const bayW = fieldW / bays;
  for (let i = 0; i < bays - 1; i++) P("partition_divider", innerH, `DP Vertical ${i + 1}`, 2);

  // Horizontal bands: bottom sheet (optional) + glass rows above. The glass
  // row height (horizontal-divider gap) is the fabricator's chosen value.
  const rowFt = Math.max(1, parseFloat(item.meta.partRowFt ?? "3.5") || 3.5);
  const sheetH = mm(sheetFt * 304.8);
  const glassBandH = innerH - (sheetFt > 0 ? sheetH + face : 0);
  const glassRows = Math.max(1, Math.round(toFeet(glassBandH) / rowFt));
  if (sheetFt > 0) P("partition_divider", fieldW, "DP Sheet-line", 2);
  for (let r = 0; r < glassRows - 1; r++) P("partition_divider", fieldW, `DP Glass-row ${r + 1}`, 2);

  // Panels per bay — a sheet cell (if any) + the glass rows.
  const glassRowH = (glassBandH - (glassRows - 1) * face) / glassRows;
  const cellW = bayW - face; // clear opening between DP faces
  for (let b = 0; b < bays; b++) {
    if (sheetFt > 0) panels.push({ kind: "sheet", w: cellW - clear, h: sheetH - clear });
    for (let r = 0; r < glassRows; r++) panels.push({ kind: "glass", w: cellW - clear, h: glassRowH - clear });
  }
  return { pieces, panels };
}

function expandPartitionItem(item: JobItem): CutPiece[] {
  const pieces: CutPiece[] = [];
  const g = partitionGeometry(item);

  for (let q = 0; q < item.qty; q++) {
    const wId = `${item.id}${item.qty > 1 ? `.${q + 1}` : ""}`;
    const sizeLabel = `${formatFtInSut(item.width)}×${formatFtInSut(item.height)}`;
    for (const pc of g.pieces) {
      pieces.push({ sectionId: pc.section, length: pc.length, itemId: wId, role: pc.role,
        label: `${wId} ${sizeLabel} — ${pc.role}` });
      // Glazing clip runs each groove that faces a panel: SP = 1 side, DP = 2.
      for (let c = 0; c < pc.clipMul; c++) {
        pieces.push({ sectionId: "glazing_clip", length: pc.length, itemId: wId,
          role: `${pc.role} Clip${pc.clipMul > 1 ? ` ${c + 1}` : ""}`,
          label: `${wId} ${sizeLabel} — ${pc.role} Clip` });
      }
    }
  }
  return pieces;
}

/**
 * Z-section (hinge-openable). Outer frame (4 sides, raw wall-opening size —
 * mounted flush) + horizontal transoms + vertical mullions (z_center) + one
 * Z-pipe shutter frame per openable sash (CUT LARGER — climbs over the frame)
 * + a glazing clip running the full 4-side perimeter of every GLASS panel
 * only. All sizing comes from zGeometry() so pieces and glass never drift.
 * Works for both the small (light 40×40) and big (heavy 40×55/70) families.
 */
function expandZSectionItem(item: JobItem): CutPiece[] {
  const pieces: CutPiece[] = [];
  const g = zGeometry(item);

  for (let q = 0; q < item.qty; q++) {
    const wId = `${item.id}${item.qty > 1 ? `.${q + 1}` : ""}`;
    const sizeLabel = `${formatFtInSut(item.width)}×${formatFtInSut(item.height)}`;
    const push = (sectionId: string, length: Um, role: string) =>
      pieces.push({
        sectionId, length, itemId: wId, role,
        label: `${wId} ${sizeLabel} — ${role}`,
      });
    // Clip = 4 sides of a glass pocket (glass panels only).
    const pushClip = (w: Um, h: Um, tag: string) => {
      push("z_clip", w, `${tag} Clip Top`);
      push("z_clip", w, `${tag} Clip Bottom`);
      push("z_clip", h, `${tag} Clip Left`);
      push("z_clip", h, `${tag} Clip Right`);
    };

    push(g.outer, item.width, "Outer Top");
    push(g.outer, item.width, "Outer Bottom");
    push(g.outer, item.height, "Outer Left");
    push(g.outer, item.height, "Outer Right");

    g.transoms.forEach((len, i) => push(g.center, len, `Transom ${i + 1}`));
    g.mullions.forEach((len, i) => push(g.center, len, `Mullion ${i + 1}`));

    // Fixed panels — no shutter; glass sits in the frame/transom + clip.
    g.fixed.forEach((f, i) => {
      const tag = g.fixed.length > 1 ? `Fix${i + 1}` : "Fix";
      if (f.kind === "glass") pushClip(f.pocketW, f.pocketH, tag);
    });

    // Openable sashes — Z-pipe shutter frame (+ clip if glass).
    g.sashes.forEach((s, i) => {
      const sn = `S${i + 1}`;
      const kindTag = s.kind === "jali" ? " (Mesh)" : s.kind === "sheet" ? " (Sheet)" : "";
      push(g.pipe, s.shW, `${sn} Shutter Top${kindTag}`);
      push(g.pipe, s.shW, `${sn} Shutter Bottom${kindTag}`);
      push(g.pipe, s.shH, `${sn} Shutter Left${kindTag}`);
      push(g.pipe, s.shH, `${sn} Shutter Right${kindTag}`);
      if (s.kind === "glass") pushClip(s.pocketW, s.pocketH, sn);
    });
  }
  return pieces;
}

export function estimate(items: JobItem[]): MaterialList {
  const pieces = items.flatMap((it, i) => expandItem(it, i));
  const bars = packAllSections(pieces);
  const sections = summarize(bars);

  // Glass / mesh / sheet
  const glass: GlassPanel[] = [];
  const mesh: GlassPanel[] = [];
  const sheet: GlassPanel[] = [];
  let meshSplineFt = 0;
  let sheetSplineFt = 0;
  let woolpileFt = 0;
  let glazingClipFt = 0;
  let rollers = 0, locks = 0, cleats = 0, hinges = 0;

  for (const item of items) {
    if (item.system === "door_single") {
      const clearance = doorClearance(pallaKey(item));
      const pallaW = item.width - clearance;
      const pallaH = item.height - clearance;
      const zones = item.shutters.length;
      const zoneH = Math.round(pallaH / zones);
      const iW = pallaW - clearance;
      const iH = zoneH - clearance;

      const sheetZones = item.shutters.filter((s) => s.kind === "sheet").length;
      const jaliZones = zones - sheetZones;

      if (sheetZones > 0) {
        sheet.push({ itemId: item.id, width: iW, height: iH, count: sheetZones * item.qty });
        sheetSplineFt += 2 * (toFeet(iW) + toFeet(iH)) * sheetZones * item.qty;
      }
      if (jaliZones > 0) {
        mesh.push({ itemId: item.id, width: iW, height: iH, count: jaliZones * item.qty });
        meshSplineFt += 2 * (toFeet(iW) + toFeet(iH)) * jaliZones * item.qty;
      }
      hinges += 3 * item.qty;
      locks += 1 * item.qty;
      continue;
    }

    if (item.system === "z_section") {
      // Hardware (friction stays, handles, locks) is intentionally OUT of the
      // Z-section deliverable (founder scope, 2026-08-03). Material list only:
      // aluminium pipes (in `pieces`), glass/jali/sheet panels, and clip.
      const g = zGeometry(item);
      const addPanel = (kind: "glass" | "jali" | "sheet", w: Um, h: Um) => {
        const target = kind === "sheet" ? sheet : kind === "jali" ? mesh : glass;
        target.push({ itemId: item.id, width: w, height: h, count: item.qty });
        if (kind === "jali") meshSplineFt += 2 * (toFeet(w) + toFeet(h)) * item.qty;
        if (kind === "sheet") sheetSplineFt += 2 * (toFeet(w) + toFeet(h)) * item.qty;
      };
      g.fixed.forEach((f) => addPanel(f.kind, f.glassW, f.glassH));
      g.sashes.forEach((s) => addPanel(s.kind, s.glassW, s.glassH));
      continue;
    }

    if (item.system === "partition") {
      // Panels come straight from the shared geometry. Glazing clip is already
      // emitted as cut pieces in expandPartitionItem (bar-packed), so there is
      // no separate clip hardware line here (avoids double-counting).
      const g = partitionGeometry(item);
      // aggregate identical panels (same kind + rounded W×H) into one line
      const groups = new Map<string, { kind: "glass" | "sheet"; w: Um; h: Um; count: number }>();
      for (const p of g.panels) {
        const key = `${p.kind}:${Math.round(p.w / 1000)}x${Math.round(p.h / 1000)}`;
        const ex = groups.get(key);
        if (ex) ex.count += item.qty;
        else groups.set(key, { kind: p.kind, w: p.w, h: p.h, count: item.qty });
      }
      for (const grp of groups.values()) {
        const target = grp.kind === "glass" ? glass : sheet;
        target.push({ itemId: item.id, width: grp.w, height: grp.h, count: grp.count });
        if (grp.kind === "sheet")
          sheetSplineFt += 2 * (toFeet(grp.w) + toFeet(grp.h)) * grp.count;
      }
      continue;
    }

    // Domal — self-contained (honours the optional fixed-top band). Sliding
    // shutters are sized to the sliding-zone height; the fixed glass (if any)
    // is added as its own panel.
    if (item.system === "domal") {
      const fx = domalFix(item);
      const n = item.shutters.length;
      const shutterW = Math.round(item.width / 2);
      const shutterH = fx.slidingH - DOMAL_DEFAULTS.shutterHeightDeduction;
      const gW = shutterW - DOMAL_DEFAULTS.glassDeductionW;
      const gH = shutterH - DOMAL_DEFAULTS.glassDeductionH;
      const glassShutters = item.shutters.filter((s) => s.kind === "glass").length;
      const jaliShutters = n - glassShutters;

      if (glassShutters > 0)
        glass.push({ itemId: item.id, width: gW, height: gH, count: glassShutters * item.qty });
      if (jaliShutters > 0) {
        mesh.push({ itemId: item.id, width: gW, height: gH, count: jaliShutters * item.qty });
        meshSplineFt += 2 * (toFeet(gW) + toFeet(gH)) * jaliShutters * item.qty;
      }
      if (fx.hasFix)
        glass.push({ itemId: item.id, width: fx.fixedGlassW, height: fx.fixedGlassH, count: item.qty });

      rollers += 2 * n * item.qty;
      locks += 1 * item.qty;
      cleats += 4 * item.qty;
      woolpileFt += 2 * (toFeet(shutterH) + toFeet(shutterW)) * n * item.qty;
      continue;
    }

    // Normal Sliding (2T/3T)
    const d = DEFAULTS;
    const n = item.shutters.length;
    const { shutterW, shutterH } = shutterSize(item, d);
    const gW = shutterW - d.glassDeductionW;
    const gH = shutterH - d.glassDeductionH;

    const glassShutters = item.shutters.filter((s) => s.kind === "glass").length;
    const jaliShutters = n - glassShutters;

    if (glassShutters > 0)
      glass.push({ itemId: item.id, width: gW, height: gH, count: glassShutters * item.qty });
    if (jaliShutters > 0) {
      mesh.push({ itemId: item.id, width: gW, height: gH, count: jaliShutters * item.qty });
      meshSplineFt += 2 * (toFeet(gW) + toFeet(gH)) * jaliShutters * item.qty;
    }

    rollers += 2 * n * item.qty;
    locks += 1 * item.qty;
    cleats += 4 * item.qty;
    woolpileFt += 2 * (toFeet(shutterH) + toFeet(shutterW)) * n * item.qty;
  }

  const wastage = 1 + DEFAULTS.wastagePct / 100;
  const glassSqft = glass.reduce((a, g) => a + sqft(g.width, g.height) * g.count, 0);
  const meshSqft = mesh.reduce((a, g) => a + sqft(g.width, g.height) * g.count, 0);
  const sheetSqft = sheet.reduce((a, g) => a + sqft(g.width, g.height) * g.count, 0);

  const hardware: HardwareLine[] = [];
  if (rollers > 0) hardware.push({ name: "Rollers / Bearings", formula: "2 per shutter", qty: rollers, unit: "nos" });
  if (locks > 0) hardware.push({ name: "Lock", formula: "1 per window/door", qty: locks, unit: "nos" });
  if (cleats > 0) hardware.push({ name: "Cleats (cast)", formula: "4 per frame", qty: cleats, unit: "nos" });
  if (woolpileFt > 0)
    hardware.push({
      name: "Wool pile", formula: `2×(shutterH+shutterW)×shutters +${DEFAULTS.wastagePct}%`,
      qty: Math.ceil(woolpileFt * wastage), unit: "rft",
    });
  if (hinges > 0)
    hardware.push({ name: "Hinges", formula: "3 per door (typical)", qty: hinges, unit: "nos" });
  if (meshSplineFt > 0)
    hardware.push({
      name: "Mesh spline / rubber", formula: `mesh perimeter +${DEFAULTS.wastagePct}%`,
      qty: Math.ceil(meshSplineFt * wastage), unit: "rft",
    });
  if (sheetSplineFt > 0)
    hardware.push({
      name: "Sheet rubber gasket", formula: `sheet perimeter +${DEFAULTS.wastagePct}%`,
      qty: Math.ceil(sheetSplineFt * wastage), unit: "rft",
    });
  if (glazingClipFt > 0) {
    const clipRft = Math.ceil(glazingClipFt * wastage);
    hardware.push({
      // Glazing clip stock is 12ft (SP/DP are 16ft — different length)
      name: "Glazing Clip", formula: `SP+DP member length +${PARTITION_DEFAULTS.wastagePct}% ÷ 12'`,
      qty: Math.ceil(clipRft / 12), unit: "× 12' bars",
    });
  }

  const bars16 = sections.reduce((a, s) => a + s.bars16, 0);
  const bars8 = sections.reduce((a, s) => a + s.bars8, 0);
  // Sum the ACTUAL stock length of each section's bars (some sections — e.g.
  // the glazing clips — ship in 12' bars, not 16', so a flat 16/8 undercounts).
  const totalPipeFt = sections.reduce((a, s) => {
    const full = getSection(s.sectionId).barLengthFt ?? 16;
    return a + s.bars16 * full + s.bars8 * (full / 2);
  }, 0);
  const wasteFt = sections.reduce((a, s) => a + toFeet(s.waste), 0);

  return {
    pieces, bars, sections, glass, glassSqft,
    mesh: { panels: mesh, sqft: meshSqft, splineFt: Math.ceil(meshSplineFt * wastage) },
    sheet: { panels: sheet, sqft: sheetSqft },
    hardware,
    totals: {
      bars16, bars8, totalPipeFt,
      wasteFt: Math.round(wasteFt * 10) / 10,
      wastePct: totalPipeFt > 0 ? Math.round((wasteFt / totalPipeFt) * 1000) / 10 : 0,
    },
  };
}
