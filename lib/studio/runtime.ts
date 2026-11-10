/**
 * The shop's Studio systems, known to the job flow and the estimator.
 * A job item keeps a frozen copy of its system (meta.studio), so editing a
 * system later never silently changes a job already made.
 */
import type { ProfileDef, StudioSystem } from "./model";
import type { JobItem } from "../engine/types";
import { evaluate, type StudioJob } from "./evaluate";

let systems: StudioSystem[] = [];
let shopProfiles: ProfileDef[] = [];

/** The shop's own sections (with their traced drawings), for pictures outside the Studio. */
export function registerShopProfiles(list: ProfileDef[]): void { shopProfiles = list; }
export function shopProfile(id: string): ProfileDef | undefined { return shopProfiles.find((p) => p.id === id); }

export function registerStudioSystems(list: StudioSystem[]): void { systems = list; }
export function studioSystems(): StudioSystem[] { return systems; }
export function studioSystem(id: string): StudioSystem | undefined { return systems.find((s) => s.id === id); }

/** The system an item was built with: its frozen copy, else the live one. */
export function systemOfItem(item: JobItem): StudioSystem | undefined {
  try { if (item.meta.studio) return JSON.parse(item.meta.studio) as StudioSystem; } catch { /* fall back */ }
  return item.meta.studioId ? studioSystem(item.meta.studioId) : undefined;
}

/** Every section chosen and every cut known for the system's first layout. */
export function studioReady(s: StudioSystem): boolean {
  const l = s.layouts[0];
  return evaluate(s, { id: "R", W: 1524000, H: 1219200, qty: 1, tracks: l?.tracks ?? 2, mix: l?.mixes[0] ?? "GG" }, { allowUnknown: true }).missing.length === 0;
}

export function studioJobOf(item: JobItem): StudioJob {
  return {
    id: item.id, W: item.width, H: item.height, qty: item.qty,
    tracks: parseInt(item.meta.tracks ?? "", 10) || item.shutters.length || 2,
    mix: item.shutters.map((s) => (s.kind === "jali" ? "J" : s.kind === "sheet" ? "S" : "G")).join(""),
    switches: { mode: item.meta.shutterSplit === "equal" ? "equal" : "half" },
  };
}
