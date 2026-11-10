/**
 * The shop's own Studio library — its sections and systems. Saved on this
 * device only (no account yet): what one fabricator builds stays in his
 * phone and is never mixed with another shop's. Export / import moves it
 * to another phone; cloud sync comes with login.
 */
import { registerCustomSections, type Section } from "../engine/sections";
import type { ProfileDef, StudioSystem } from "./model";
import { BUILT_IN_PROFILES, TEMPLATES } from "./templates";
import { registerStudioSystems } from "./runtime";

const KEY = "fabriq_studio_v1";

export interface StudioLibrary {
  systems: StudioSystem[];
  /** sections this shop added or copied and edited */
  profiles: ProfileDef[];
}

const EMPTY: StudioLibrary = { systems: [], profiles: [] };

function valid(x: unknown): x is StudioLibrary {
  const l = x as StudioLibrary;
  return !!l && Array.isArray(l.systems) && Array.isArray(l.profiles);
}

export function loadLibrary(): StudioLibrary {
  try {
    const raw = localStorage.getItem(KEY);
    const lib = raw ? JSON.parse(raw) : EMPTY;
    const out = valid(lib) ? { ...lib, systems: lib.systems.map(migrate) } : EMPTY;
    registerProfiles(out.profiles);
    registerStudioSystems(out.systems);
    return out;
  } catch {
    return EMPTY;
  }
}

/** Systems saved before pieces had a place in the drawing get one from their template. */
function migrate(sys: StudioSystem): StudioSystem {
  if (sys.parts.every((p) => p.place)) return sys;
  const tpl = TEMPLATES.find((t) => t.id === sys.basedOn?.id);
  return {
    ...sys,
    parts: sys.parts.map((p) => (p.place ? p : { ...p, place: tpl?.parts.find((x) => x.id === p.id)?.place ?? "other" })),
  };
}

export function saveLibrary(lib: StudioLibrary): void {
  registerProfiles(lib.profiles);
  registerStudioSystems(lib.systems);
  try { localStorage.setItem(KEY, JSON.stringify(lib)); } catch { /* storage full — kept for this session */ }
}

/** All sections the picker offers: the shop's own first, then built-ins. */
export function allProfiles(lib: StudioLibrary): ProfileDef[] {
  const mine = new Set(lib.profiles.map((p) => p.id));
  return [...lib.profiles, ...BUILT_IN_PROFILES.filter((p) => !mine.has(p.id))];
}

export function findProfile(lib: StudioLibrary, id: string): ProfileDef | undefined {
  return allProfiles(lib).find((p) => p.id === id);
}

/** Make the shop's sections known to bar packing (stock length = first one listed). */
export function registerProfiles(list: ProfileDef[]): void {
  registerCustomSections([...list, ...BUILT_IN_PROFILES].map((p): Section => ({
    id: p.id, name: p.name, label: p.name, size: p.size ?? "",
    tier: "NEEDS_VERIFICATION", barLengthFt: p.stockFt[0] ?? 16,
  })));
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A shop copy of a template — the template itself never changes. */
export function copyTemplate(templateId: string, name?: string): StudioSystem {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) throw new Error(`No template ${templateId}`);
  const c: StudioSystem = structuredClone(t);
  c.id = newId("sys");
  c.name = name ?? t.name;
  c.basedOn = { id: t.id, version: t.version };
  c.version = 1;
  c.jobs = [];
  if (c.status === "verified") c.status = "checked"; // the shop has not checked it on its own jobs yet
  return c;
}

export function exportLibrary(lib: StudioLibrary): string {
  return JSON.stringify({ fabriqStudio: 1, ...lib }, null, 1);
}

/** Merge an exported file into this library; same ids are replaced. */
export function importLibrary(lib: StudioLibrary, text: string): StudioLibrary {
  const data = JSON.parse(text);
  if (!valid(data)) throw new Error("This is not a FabriQ systems file");
  const byId = <T extends { id: string }>(a: T[], b: T[]) => [...a.filter((x) => !b.some((y) => y.id === x.id)), ...b];
  return { systems: byId(lib.systems, data.systems), profiles: byId(lib.profiles, data.profiles) };
}
