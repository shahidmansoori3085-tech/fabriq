/**
 * Aluminium finishes — the colour a section is anodised or powder-coated in.
 *
 * This is a MATCHING concern, not a cosmetic one: a grey offcut cannot be cut
 * into an ivory job, however well it fits. Length compatibility alone is not
 * enough to offer a bank piece.
 *
 * Deliberately optional everywhere. A fabricator who never records colour must
 * keep working exactly as before, so `undefined` means "not stated" and never
 * blocks a match. Only two STATED and DIFFERENT finishes rule a piece out.
 */

export type FinishId =
  | "natural"
  | "ivory"
  | "white"
  | "black"
  | "brown"
  | "champagne"
  | "grey"
  | "wood";

export interface Finish {
  id: FinishId;
  /** what the fabricator calls it at the counter */
  label: string;
  /** swatch colour for chips and drawings */
  swatch: string;
  /** swatch needs a border to be visible on a light surface */
  pale?: boolean;
}

export const FINISHES: Finish[] = [
  { id: "natural", label: "Natural / Silver", swatch: "#c8ccd0" , pale: true },
  { id: "ivory", label: "Ivory", swatch: "#efe7d6", pale: true },
  { id: "white", label: "White", swatch: "#f4f6f7", pale: true },
  { id: "black", label: "Black", swatch: "#1c1c1e" },
  { id: "brown", label: "Brown", swatch: "#5b3a26" },
  { id: "champagne", label: "Champagne", swatch: "#c9a86a" },
  { id: "grey", label: "Grey", swatch: "#6f767d" },
  { id: "wood", label: "Wood", swatch: "#7a5230" },
];

const BY_ID = new Map(FINISHES.map((f) => [f.id, f]));

export function getFinish(id: FinishId | undefined): Finish | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function finishLabel(id: FinishId | undefined): string {
  return getFinish(id)?.label ?? "Colour not set";
}

/**
 * Can stock in `stockFinish` be cut for a job in `jobFinish`?
 *
 * Unknown on either side is permissive on purpose — every offcut saved before
 * colour existed has no finish, and silently hiding a fabricator's whole
 * existing bank would be a worse bug than the one this fixes.
 */
export function finishCompatible(
  jobFinish: FinishId | undefined,
  stockFinish: FinishId | undefined,
): boolean {
  if (!jobFinish || !stockFinish) return true;
  return jobFinish === stockFinish;
}

/**
 * Nearest match in the 3D configurator's four render materials, so choosing a
 * real trade colour pre-selects a sensible preview. Best-effort only — the
 * renderer has fewer materials than the trade has finishes, and the customer
 * can still change it on the quotation.
 */
export function finishTo3D(id: FinishId | undefined): "black" | "white" | "champagne" | "wood" | undefined {
  switch (id) {
    case "black":
    case "grey":
      return "black";
    case "white":
    case "ivory":
    case "natural":
      return "white";
    case "champagne":
      return "champagne";
    case "brown":
    case "wood":
      return "wood";
    default:
      return undefined;
  }
}

const KEY = "fabriq_finish";

/** The shop's usual colour — most fabricators work in one, so remember it. */
export function loadDefaultFinish(): FinishId | undefined {
  try {
    const v = localStorage.getItem(KEY);
    return v && BY_ID.has(v as FinishId) ? (v as FinishId) : undefined;
  } catch {
    return undefined;
  }
}

export function saveDefaultFinish(id: FinishId | undefined) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* quota — the in-memory choice still applies to this job */ }
}
