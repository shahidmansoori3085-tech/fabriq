/**
 * Real section shapes traced from catalogue drawings (scripts/trace-sections.ts),
 * in mm, y down. A shape is found by the section's catalogue code.
 */
import type { ProfileDef } from "./model";
import ample from "./shapes/ample.json";
import omeo from "./shapes/omeo.json";
import banuhashim from "./shapes/banuhashim.json";
import alucoat from "./shapes/alucoat.json";

export interface Shape { code: string; maker: string; w: number; h: number; paths: string[]; source: string; scaleCheck: number }

const BY_MAKER: Record<string, Record<string, Shape>> = {
  ample: ample as Record<string, Shape>,
  omeo: omeo as Record<string, Shape>,
  bh: banuhashim as Record<string, Shape>,
  alucoat: alucoat as Record<string, Shape>,
};

/** The traced shape of a section, if one exists ("2046/2047" tries each code). */
export function shapeOf(p: ProfileDef | undefined): Shape | undefined {
  if (p?.shape) return { code: p.id, maker: "yours", source: "Traced from your photo", ...p.shape };
  if (!p?.codes) return undefined;
  for (const [maker, code] of Object.entries(p.codes)) {
    const book = BY_MAKER[maker];
    if (!book) continue;
    for (const c of [p.shapeKey, ...code.split("/")].filter(Boolean) as string[]) {
      const s = book[c.trim()];
      if (s) return s;
    }
  }
  return undefined;
}
