import type { Um } from "./units";

export type OpeningType = "window" | "door" | "partition";
export type SystemId = "normal_2t" | "normal_3t" | "domal" | "door_single" | "partition" | "z_section";

/** One opening the fabricator entered (a window/door/partition) */
export interface JobItem {
  id: string; // "W1", "W2"...
  type: OpeningType;
  width: Um;
  height: Um;
  qty: number;
  system: SystemId;
  /** shutter configuration, e.g. glass/jali mix */
  shutters: ShutterConfig[];
  /** answers gathered by the question engine */
  meta: Record<string, string>;
}

export type ShutterKind = "glass" | "jali" | "sheet";
export interface ShutterConfig {
  kind: ShutterKind;
}

/** A single cut piece of aluminium */
export interface CutPiece {
  sectionId: string;
  length: Um;
  /** which window and which part — the cutter-facing label */
  itemId: string; // "W1"
  role: string; // "Top", "Left Side", "S1 Handle"...
  label: string; // full label "W1 6'×6' — Top"
}

/** One physical bar with pieces nested onto it */
export interface PackedBar {
  barNo: number;
  sectionId: string;
  barLength: Um; // 16' or 8'
  pieces: CutPiece[];
  waste: Um;
}

export interface SectionSummary {
  sectionId: string;
  totalPieces: number;
  totalLength: Um;
  bars16: number;
  bars8: number;
  waste: Um;
  wastePct: number;
}

export interface GlassPanel {
  itemId: string;
  width: Um;
  height: Um;
  count: number;
}

export interface HardwareLine {
  name: string;
  formula: string;
  qty: number;
  unit: string;
}

export interface MaterialList {
  pieces: CutPiece[];
  bars: PackedBar[];
  sections: SectionSummary[];
  glass: GlassPanel[];
  glassSqft: number;
  mesh: { panels: GlassPanel[]; sqft: number; splineFt: number };
  sheet: { panels: GlassPanel[]; sqft: number };
  hardware: HardwareLine[];
  totals: {
    bars16: number;
    bars8: number;
    totalPipeFt: number;
    wasteFt: number;
    wastePct: number;
  };
}

/** Review AI finding */
export interface ReviewFinding {
  severity: "ok" | "suggestion" | "warning" | "blocker";
  category: string;
  message: string; // Hinglish
  savingEstimate?: string;
}

export interface ReviewResult {
  confidence: number; // 0-100
  findings: ReviewFinding[];
  summary: string;
}
