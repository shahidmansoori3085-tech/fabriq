/**
 * Real section shapes traced from catalogue drawings (scripts/trace-sections.ts),
 * in mm, y down. A shape is found by the section's catalogue code.
 */
import type { ProfileDef } from "./model";
import ample from "./shapes/ample.json";

export interface Shape { code: string; maker: string; w: number; h: number; paths: string[]; source: string; scaleCheck: number }

const BY_MAKER: Record<string, Record<string, Shape>> = { ample: ample as Record<string, Shape> };

/** The traced shape of a section, if one exists. */
export function shapeOf(p: ProfileDef | undefined): Shape | undefined {
  if (!p?.codes) return undefined;
  for (const [maker, code] of Object.entries(p.codes)) {
    const s = BY_MAKER[maker]?.[p.shapeKey ?? code];
    if (s) return s;
  }
  return undefined;
}
