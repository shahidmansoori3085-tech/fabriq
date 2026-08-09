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
  /** Hinglish label */
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
    id: "handle_2x1", name: 'Handle 2"×1" (badi)', label: "2×1 Handle",
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
    id: "domal_jali_shutter", name: "Domal Jali Shutter (2081/2082)", label: "Jali Shutter",
    omeo: "2081", size: "65×27", tier: "VERIFIED",
  },
  domal_interlock: {
    id: "domal_interlock", name: "Domal Interlock", label: "Interlock",
    omeo: "2091", size: "39×28", tier: "VERIFIED",
  },

  // ---- Door — single (hinged), founder-verified 2026-07-26 ----
  // Palla (shutter/leaf): one profile, all 4 sides — fabricator picks size.
  // These are OMEO's general-purpose Handle family, reused as the palla.
  door_palla_75: {
    id: "door_palla_75", name: "Door Palla 75×25 (3×1 Moulding Handle)", label: "Palla 75×25",
    omeo: "3050", size: "75×25", tier: "VERIFIED",
  },
  door_palla_60: {
    id: "door_palla_60", name: "Door Palla 63×25 (Moulding Handle)", label: "Palla 60×25",
    omeo: "5000", size: "63×25", tier: "VERIFIED",
  },
  door_palla_50: {
    id: "door_palla_50", name: "Door Palla 50×25 (2×1 Handle)", label: "Palla 50×25",
    omeo: "2000", size: "50×25", tier: "VERIFIED",
  },
  // Chokhat (frame) — Pattam profile, dedicated OMEO family.
  door_frame_pattam: {
    id: "door_frame_pattam", name: "Door Frame (Pattam)", label: "Chokhat (Pattam)",
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
