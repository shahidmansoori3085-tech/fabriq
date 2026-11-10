/**
 * System Studio — a window system as DATA instead of code.
 *
 * A system is: profiles (what the shop buys), named sizes (computed in order,
 * each = slope × base + constant), parts (which profile is cut to which size,
 * how many, at what angle) and extras (rollers, locks, wool pile…).
 *
 * Every constant carries its evidence. "unknown" constants block cutting:
 * FabriQ never guesses a number the fabricator will cut metal to.
 * All lengths are integer µm (1 sut = 3175 µm), like the rest of the engine.
 */
import type { Um } from "../engine/units";

/** How sure we are of a number, strongest first. */
export type EvidenceStatus = "verified" | "observed" | "suggested" | "unknown";

export interface Evidence {
  status: EvidenceStatus;
  /** Where it came from, in plain words: "founder job 72×60 3T", "Ramhans video" */
  source: string;
}

/**
 * A condition on the job. Every key must match; a list means "any of".
 * Keys: tracks, shutters (count), glass (glass-shutter count), mix ("GGJ"),
 * and any switch id of the system (mode, roller, rubber…).
 */
export type Cond = Record<string, string | string[]>;

/** One way to compute a size, used when its `when` matches (first match wins). */
export interface SizeCase {
  when?: Cond;
  /** "W", "H" or the name of an earlier size */
  base: string;
  /** slope = num / den. Default 1 / 1 (e.g. den 2 = half the width). */
  num?: number;
  den?: number;
  /** added before dividing (the K in (W − K)/N), µm */
  pre?: Um;
  /** added after dividing, µm. null = not known yet — cutting is blocked. */
  add: Um | null;
  evidence: Evidence;
}

export interface SizeDef {
  id: string;
  /** Shop words: "Shutter height", "Glass width" */
  label: string;
  cases: SizeCase[];
}

/** Which job unit a part repeats over. */
export type PartScope =
  | "window"        // once per window
  | "shutter"       // once per shutter (glass and mesh)
  | "meeting";      // once per place two GLASS shutters meet

export interface PartDef {
  id: string;
  /** Cut-list label. {s} → S1, {tag} → " (Mesh)" on mesh shutters, {k} → running number */
  role: string;
  /** profile id; first matching case wins, the last should have no `when` */
  profile: { when?: Cond; id: string }[];
  /** profile on mesh shutters, when the shop uses a different one */
  meshProfile?: string;
  scope: PartScope;
  /** pieces per scope unit */
  count: number;
  /** size id (or "W"/"H") this piece is cut to */
  length: string;
  angle: 90 | 45;
  /** only cut when this matches */
  when?: Cond;
  /** false = the shop does not use this part (kept, so it can be ticked back) */
  enabled?: boolean;
  /** where the piece sits in the window — drives the drawing */
  place?: Place;
  /** true = the shop picks this part's section per SHUTTER (e.g. slim interlock small on one, big on another) */
  perShutter?: boolean;
  /** draw / build the section turned the other way round (its face mirrored) */
  flipSection?: boolean;
}

/**
 * Where a piece sits, seen from the front. Sash places are per shutter:
 * "sash-lock" is the outer (handle) stile, "sash-meet" the stile at the meeting.
 */
export type Place =
  | "frame-top" | "frame-bottom" | "frame-left" | "frame-right"
  | "sash-top" | "sash-bottom" | "sash-lock" | "sash-meet"
  | "meeting" | "other";

/** What a section is used as — filters the section picker for each part. */
export type ProfileKind =
  | "track" | "frame" | "handle" | "interlock" | "slim-interlock" | "bearing"
  | "shutter" | "mesh-shutter" | "interlock-patti" | "rail" | "bead" | "mullion" | "other";

export const PROFILE_KINDS: { id: ProfileKind; label: string }[] = [
  { id: "track", label: "Track (top / bottom / side)" },
  { id: "frame", label: "Frame" },
  { id: "handle", label: "Handle" },
  { id: "interlock", label: "Interlock" },
  { id: "slim-interlock", label: "Slim interlock" },
  { id: "bearing", label: "Bearing / H-section" },
  { id: "shutter", label: "Shutter (4 sides)" },
  { id: "mesh-shutter", label: "Mesh shutter" },
  { id: "interlock-patti", label: "Interlock patti / clip" },
  { id: "rail", label: "Rail / track clip" },
  { id: "bead", label: "Glazing clip / bead" },
  { id: "mullion", label: "Mullion / center" },
  { id: "other", label: "Other" },
];

export interface ProfileDef {
  id: string;
  name: string;
  kind?: ProfileKind;
  /** true = added by this shop (editable); built-ins are copied before editing */
  mine?: boolean;
  /** catalogue code(s), e.g. { omeo: "2051" } — shop's own code under "shop" */
  codes?: Record<string, string>;
  size?: string;          // "45×45"
  /** width seen from the front of the window, mm (for the drawing); derived from size when unset */
  faceMm?: number;
  /** catalogue page it came from, shown with the section */
  ref?: string;
  /** traced shape key when it differs from the code (one code printed on two profiles) */
  shapeKey?: string;
  /** catalogue weight, exactly as printed */
  kg?: { value: number; perFt: number };
  /** bar lengths the shop buys, feet; first = default */
  stockFt: number[];
  source: Evidence;
}

export type ExtraDef =
  | { id: string; name: string; kind: "count"; per: "window" | "shutter"; qty: number; formula: string; unit: "nos" }
  | { id: string; name: string; kind: "perimeter"; per: "shutter"; of: [string, string]; formula: string; unit: "rft" };

export interface SwitchDef {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
}

export type SystemFamily = "sliding" | "domal-type";
export type SystemStatus = "draft" | "teaching" | "checked" | "verified";

export interface StudioSystem {
  id: string;
  name: string;
  family: SystemFamily;
  /** one line the shop recognises: "27×65 domal, one profile all 4 sides" */
  blurb: string;
  /** where the New-system screen lists it */
  group?: "ready" | "bombay" | "domal" | "sleek" | "gulf" | "special" | "blank";
  /** maker of the sections in this draft, when it is one catalogue's set */
  maker?: string;
  version: number;
  status: SystemStatus;
  /** template id + version this was copied from */
  basedOn?: { id: string; version: number };
  /** shutter layouts the system offers, as glass/mesh mixes per track count */
  layouts: { tracks: number; mixes: string[] }[];
  switches: SwitchDef[];
  profiles: ProfileDef[];
  /** computed in this order — a size may only use W, H or an earlier size */
  sizes: SizeDef[];
  parts: PartDef[];
  /** infill (glass / mesh / sheet) is cut to these two sizes */
  infill: { w: string; h: string };
  extras: ExtraDef[];
  /** loss allowance on running items (wool pile, rubber), % */
  wastagePct: number;
  /** real jobs the shop gave — kept as this system's own tests */
  jobs: TaughtJob[];
  notes?: string[];
}

/** A real window the shop already made, with what they actually cut. */
export interface TaughtJob {
  id: string;
  W: Um;
  H: Um;
  tracks: number;
  mix: string;
  switches: Record<string, string>;
  /** measured length per part id (any subset), µm */
  measured: Record<string, Um>;
  /** glass actually cut, µm (optional) */
  glass?: { w?: Um; h?: Um };
  at: string;
}
