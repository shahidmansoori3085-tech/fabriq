/**
 * FabriQ Section Master — wave 1.
 * Source: doc 08 (OMEO ALTECH catalogue extraction, founder-verified) + Alpro cross-reference.
 * ALL sections sell as 16-foot bars; dealers also cut 8-foot half bars.
 */

export type SectionRole =
  | "frame_top"
  | "frame_side"
  | "frame_bottom"
  | "shutter_handle"
  | "shutter_interlock"
  | "shutter_bearing"
  | "jali_handle";

export interface Section {
  /** Canonical FabriQ id */
  id: string;
  /** Display name the fabricator knows */
  name: string;
  /** Short label, for tight columns */
  label: string;
  /** OMEO code (verified) */
  omeo?: string;
  /** Alpro code (verified) */
  alpro?: string;
  /** NAPL (Narayan Aluminium) code (verified) */
  napl?: string;
  /** Profile size, mm (W × H) */
  size: string;
  /** Verification tier from doc 08 */
  tier: "VERIFIED" | "PROBABLE" | "NEEDS_VERIFICATION";
  /** Stock bar length in feet — defaults to 16 (dealer standard) when unset */
  barLengthFt?: number;
  /** Whether the dealer also sells this cut in half-length bars (default true) */
  hasHalfBar?: boolean;
}

export const SECTIONS: Record<string, Section> = {
  // ---- Normal / Bombay Sliding 18mm ----
  "2t_top": {
    id: "2t_top", name: "2-Track Top/Side", label: "2T Top",
    omeo: "1000", alpro: "1801", size: "62×32", tier: "VERIFIED",
  },
  "2t_bottom": {
    id: "2t_bottom", name: "2-Track Bottom", label: "2T Bottom",
    omeo: "1011", alpro: "1821", size: "62×32", tier: "VERIFIED",
  },
  "3t_top": {
    id: "3t_top", name: "3-Track Top/Side", label: "3T Top",
    omeo: "1021", size: "92×32", tier: "VERIFIED",
  },
  "3t_bottom": {
    id: "3t_bottom", name: "3-Track Bottom", label: "3T Bottom",
    omeo: "1031", alpro: "1831", size: "92×32", tier: "VERIFIED",
  },
  handle_std: {
    id: "handle_std", name: 'Handle 3/4"×1.5" (standard)', label: "Handle",
    omeo: "1041", alpro: "1841", size: "40×18", tier: "VERIFIED",
  },
  handle_2x1: {
    id: "handle_2x1", name: 'Handle 2"×1" (large)', label: "2×1 Handle",
    omeo: "2000", size: "63×25", tier: "VERIFIED",
  },
  interlock: {
    id: "interlock", name: "Interlock", label: "Interlock",
    omeo: "1081", alpro: "1861", size: "40×18", tier: "VERIFIED",
  },
  bearing: {
    id: "bearing", name: "Bearing / H-Section", label: "Bearing",
    omeo: "1051", alpro: "1851", size: "40×18", tier: "VERIFIED",
    // 1051 is catalogued as "3/4in Handle Right" — fabricator confirmed
    // it's reused horizontally as the bearing (2026-07-26).
  },

  // ---- Domal 27-29mm (founder-verified, corrected 2026-07-26) ----
  // Domal has NO handle/interlock/bearing split like Normal Sliding — the
  // whole shutter is built from one 4-side profile. Frame (track, wall-
  // fixed) is 2062 — a WIDER channel than the shutter profile itself, same
  // pattern as Normal Sliding's 92mm 3T-Top vs 62mm 2T-Top. The shutter
  // (2046, "Domal Glass Handle") slides on this track. 2046/2047 are
  // interchangeable dies for the glass shutter (fabricator's choice, same
  // role) — same pattern as 2081/2082 for the jali shutter.
  domal_frame: {
    id: "domal_frame", name: "Domal Track/Frame", label: "Domal Track",
    omeo: "2062", size: "80.5×45.4", tier: "VERIFIED",
  },
  domal_glass_shutter: {
    id: "domal_glass_shutter", name: "Domal Glass Handle (2046/2047)", label: "Glass Shutter",
    omeo: "2046", size: "65×27", tier: "VERIFIED",
  },
  domal_jali_shutter: {
    id: "domal_jali_shutter", name: "Domal Mesh Shutter (2081/2082)", label: "Mesh Shutter",
    omeo: "2081", size: "65×27", tier: "VERIFIED",
  },
  domal_interlock: {
    id: "domal_interlock", name: "Domal Interlock", label: "Interlock",
    omeo: "2091", size: "39×28", tier: "VERIFIED",
  },

  // ---- Door — single (hinged), founder-verified 2026-07-26 ----
  // Shutter (palla / leaf): one profile, all 4 sides — fabricator picks size.
  // These are OMEO's general-purpose Handle family, reused as the palla.
  door_palla_75: {
    id: "door_palla_75", name: "Door Shutter 75×25 (3×1 Moulding Handle)", label: "Shutter 75×25",
    omeo: "3050", size: "75×25", tier: "VERIFIED",
  },
  door_palla_60: {
    id: "door_palla_60", name: "Door Shutter 63×25 (Moulding Handle)", label: "Shutter 60×25",
    omeo: "5000", size: "63×25", tier: "VERIFIED",
  },
  door_palla_50: {
    id: "door_palla_50", name: "Door Shutter 50×25 (2×1 Handle)", label: "Shutter 50×25",
    omeo: "2000", size: "50×25", tier: "VERIFIED",
  },
  // Door frame (chokhat) — Pattam profile, dedicated OMEO family.
  door_frame_pattam: {
    id: "door_frame_pattam", name: "Door Frame (Pattam)", label: "Door Frame (Pattam)",
    omeo: "7342", size: "63×39", tier: "VERIFIED",
  },
  // Center rail — same nominal size as palla but a DIFFERENT die (grooved
  // both sides to hold panels above and below, vs handle's one-side groove).
  // Size confirmed by fabricator; exact OMEO sec no. within the family TBD.
  door_center_75: {
    id: "door_center_75", name: "Door Center Rail 75×25 (3×1 Moulding Center)", label: "Center Rail 75×25",
    omeo: "3081", size: "75×25", tier: "VERIFIED",
  },
  door_center_60: {
    id: "door_center_60", name: "Door Center Rail 63×25", label: "Center Rail 60×25",
    size: "63×25", tier: "NEEDS_VERIFICATION",
  },
  door_center_50: {
    id: "door_center_50", name: "Door Center Rail 50×25", label: "Center Rail 50×25",
    size: "50×25", tier: "NEEDS_VERIFICATION",
  },

  // ---- Partition (fixed office-style, SP/DP), founder-verified 2026-07-28 ----
  // SP (Single Partition) = outer perimeter frame (4 sides, one profile).
  // DP (Double Partition) = internal horizontal divider(s), grooved BOTH
  // sides to hold panels above and below — same size class as SP, different
  // die. Panels (sheet/glass) are held in place by a Glazing Clip running
  // the panel's perimeter (like wool pile, not a bar section).
  partition_frame: {
    id: "partition_frame", name: "Single Partition (SP)", label: "SP Frame",
    napl: "17003", size: "63.5×38.1", tier: "VERIFIED",
  },
  partition_divider: {
    id: "partition_divider", name: "Double Partition (DP)", label: "DP Divider",
    napl: "17502", size: "63.5×38.1", tier: "VERIFIED",
  },
  // Glazing Clip — retains sheet/glass in the SP/DP groove. Runs alongside
  // EVERY SP/DP member that borders a panel (one clip piece per SP/DP piece,
  // same length). Sold in 12ft bars (NOT 16ft like SP/DP) with no half-bar
  // option (fabricator-confirmed 2026-07-28).
  glazing_clip: {
    id: "glazing_clip", name: "Glazing Clip", label: "Glazing Clip",
    napl: "16000", size: "19.05×17.32", tier: "VERIFIED",
    barLengthFt: 12, hasHalfBar: false,
  },

  // ---- Z-section (40mm Doomal series), founder-verified 2026-08-01/08-03 ----
  // Hinge-openable (friction-stay) system — a DIFFERENT construction logic
  // from Normal Sliding/Domal/Partition: the shutter is cut LARGER than the
  // opening (it climbs/overlaps onto the outer's face), not smaller. Outer
  // and Z-pipe/shutter each come in two depth variants (40 or 55mm); the
  // dimension that eats the opening (the sight-line width in the wall plane)
  // is always 40mm across every variant — founder-confirmed rule. Bars are
  // ordered in the dealer-standard 16' length (founder-confirmed 2026-08-03),
  // with 8' half bars, same as every other FabriQ section.
  z_outer_40: {
    id: "z_outer_40", name: "Z-Section Outer Frame 40×40", label: "Outer 40×40",
    omeo: "2076", size: "40×40", tier: "VERIFIED",
  },
  z_outer_55: {
    id: "z_outer_55", name: "Z-Section Outer Frame 40×55", label: "Outer 40×55",
    omeo: "2088", size: "40×55.6", tier: "VERIFIED",
  },
  z_pipe_40: {
    id: "z_pipe_40", name: "Z-Section Shutter/Z-pipe 40×40", label: "Z-Pipe 40×40",
    omeo: "2077", size: "40×40", tier: "VERIFIED",
  },
  z_pipe_55: {
    id: "z_pipe_55", name: "Z-Section Shutter/Z-pipe 40×55", label: "Z-Pipe 40×55",
    napl: "20610", size: "40.2×55.6", tier: "VERIFIED",
  },
  // Center/mullion — splits one Z-section opening into multiple sashes (a
  // vertical mullion between side-by-side sashes) OR separates a fixed panel
  // from an openable one (a horizontal transom). Cut to the inner opening,
  // with a T-notch at both ends (fabricator-confirmed).
  z_center_55: {
    id: "z_center_55", name: "Z-Section Center/Mullion 40×55", label: "Center 40×55",
    omeo: "2086", size: "40.3×54.3", tier: "VERIFIED",
  },
  z_center_70: {
    id: "z_center_70", name: "Z-Section Center/Mullion 40×70", label: "Center 40×70",
    omeo: "2079", size: "40.4×70.6", tier: "VERIFIED",
  },
  // Glazing clip — retains the glass in its pocket, snapping in on the room
  // side after glass is placed. Runs the FULL 4-side perimeter of every
  // GLASS panel (founder-confirmed 2026-08-03); jali/sheet panels get no
  // clip. One clip SKU for every glass thickness and both size families
  // ("clip sabme same lagti hai"). Ordered in the same dealer-standard 16'
  // bar as the rest of the Z family (founder-confirmed 16' standard); adjust
  // if a real order shows the clip ships in its own length.
  z_clip: {
    id: "z_clip", name: "Z-Section Glazing Clip", label: "Z Clip",
    omeo: "2078", size: "22.2×17.9", tier: "VERIFIED",
  },
};

export function getSection(id: string): Section {
  const s = SECTIONS[id];
  if (!s) throw new Error(`Unknown section: ${id}`);
  return s;
}

/* ————————————————— catalogue brand ————————————————— */

/**
 * Which manufacturer's catalogue the shop buys against.
 *
 * The same profile has a different number in every brand's book, and the dealer
 * quotes from ONE of them. Printing an OMEO code at a counter that stocks NAPL
 * makes the order sheet useless, so the fabricator picks his brand once and
 * every list speaks that language. Unset is fine — we then show no code rather
 * than guessing one.
 */
export type BrandId = "omeo" | "alpro" | "napl";

export const BRANDS: { id: BrandId; label: string }[] = [
  { id: "omeo", label: "OMEO / Altech" },
  { id: "alpro", label: "Alpro" },
  { id: "napl", label: "NAPL (Narayan)" },
];

/** The section's code in the chosen brand's book, if that brand lists it. */
export function sectionCode(id: string, brand: BrandId | undefined): string | undefined {
  if (!brand) return undefined;
  const s = SECTIONS[id];
  return s?.[brand];
}

const BRAND_KEY = "fabriq_brand";

export function loadBrand(): BrandId | undefined {
  try {
    const v = localStorage.getItem(BRAND_KEY);
    return BRANDS.some((b) => b.id === v) ? (v as BrandId) : undefined;
  } catch {
    return undefined;
  }
}

export function saveBrand(id: BrandId | undefined) {
  try {
    if (id) localStorage.setItem(BRAND_KEY, id);
    else localStorage.removeItem(BRAND_KEY);
  } catch { /* quota — the choice still applies to this session */ }
}

/* ————————————————— section weight (for kg pricing) ————————————————— */

/**
 * Kilograms per running FOOT, per section.
 *
 * Aluminium is bought by weight, not by length — a dealer quotes ₹/kg and bills
 * on the kilos delivered. To turn our foot-based cutting plan into money we need
 * the weight of a foot of each profile.
 *
 * CRITICAL (doc 08, line 10): the catalogue prints weight as `Kg/12'`, `Kg/15'`
 * or `Kg/16'`, and that trailing figure is a **weight reference length, not the
 * bar length sold** — every section still ships as a 16 ft bar. So kg/ft is the
 * catalogue weight divided by ITS OWN reference length, never by 16.
 *
 * Only VERIFIED catalogue rows appear here. Z-section, door and partition
 * profiles carry no published weight in docs 08–10, so they are deliberately
 * absent rather than filled with a plausible-looking average — ground rule 5
 * (never silently guess a number the fabricator will spend against).
 */
export interface SectionWeight {
  kgPerFt: number;
  /** "exact" = single catalogue figure; "range" = midpoint of a printed band */
  basis: "exact" | "range";
  /** what the catalogue actually prints, for auditability */
  source: string;
}

export const SECTION_WEIGHTS: Record<string, SectionWeight> = {
  // ---- Normal / Bombay Sliding (doc 08 §Normal Sliding) ----
  "2t_top": { kgPerFt: 2.5 / 16, basis: "exact", source: "OMEO 1000 · 2.500 Kg/16'" },
  "2t_bottom": { kgPerFt: 2.5 / 16, basis: "exact", source: "OMEO 1011 · 2.500 Kg/16'" },
  "3t_top": { kgPerFt: 2.7 / 16, basis: "range", source: "OMEO 1021 · 2.600–2.800 Kg/16'" },
  "3t_bottom": { kgPerFt: 2.7 / 16, basis: "range", source: "OMEO 1031 · 2.600–2.800 Kg/16'" },
  handle_std: { kgPerFt: 1.3 / 16, basis: "exact", source: "OMEO 1041 · 1.300 Kg/16'" },
  bearing: { kgPerFt: 1.3 / 16, basis: "exact", source: "OMEO 1051 · 1.300 Kg/16'" },
  interlock: { kgPerFt: 1.2 / 16, basis: "range", source: "OMEO 1081 · 1.100–1.300 Kg/16'" },

  // ---- Domal (doc 08 §Domal) — note the 15'/12' reference lengths ----
  domal_frame: { kgPerFt: 4.968 / 16, basis: "exact", source: "OMEO 2062 · 4.968 Kg/16'" },
  domal_glass_shutter: { kgPerFt: 3.2 / 15, basis: "exact", source: "OMEO 2046 · 3.200 Kg/15'" },
  domal_jali_shutter: { kgPerFt: 3.226 / 12, basis: "exact", source: "OMEO 2081 · 3.226 Kg/12'" },
  domal_interlock: { kgPerFt: 0.88 / 12, basis: "exact", source: "OMEO 2091 · 0.880 Kg/12'" },
};

export function getSectionWeight(id: string): SectionWeight | undefined {
  return SECTION_WEIGHTS[id];
}
