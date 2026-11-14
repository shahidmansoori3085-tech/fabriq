/**
 * The phone's side of cloud save: read everything the app keeps as records,
 * and write cloud records back into the app's own storage. The app's screens
 * keep reading localStorage as today — cloud save sits beside them.
 */
import { keyOf, emptyState, type Row, type SyncState, type Kind } from "./sync";

/** where each kind lives on the phone */
const PROJECTS = "fabriq_projects";
const STUDIO = "fabriq_studio_v1";
/** single values kept as one record each (kind "pref", id = the key) */
const PREFS = ["fabriq_shop", "fabriq_offcuts", "fabriq_finish", "fabriq_brand"];
const STATE = "fabriq_cloud";

const read = (k: string): unknown => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full */ } };
const rawRead = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };

type Item = { id: string };
interface Studio { systems?: Item[]; profiles?: Item[]; [k: string]: unknown }

/** Everything this phone has now, as records. */
export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const projects = read(PROJECTS);
  if (Array.isArray(projects)) for (const p of projects as Item[]) if (p?.id) out[keyOf("project", p.id)] = p;
  const studio = read(STUDIO) as Studio | undefined;
  for (const s of studio?.systems ?? []) if (s?.id) out[keyOf("system", s.id)] = s;
  for (const p of studio?.profiles ?? []) if (p?.id) out[keyOf("profile", p.id)] = p;
  // prefs are kept as their raw text (some are plain strings, not JSON)
  for (const k of PREFS) { const v = rawRead(k); if (v !== null) out[keyOf("pref", k)] = v; }
  return out;
}

/** Write cloud records into the phone. Returns how many changed. */
export function applyRows(rows: Row[]): number {
  if (!rows.length) return 0;
  const by = (kind: Kind) => rows.filter((r) => r.kind === kind);
  const gone = (r: Row) => !!r.deleted_at || r.data === null;

  const pr = by("project");
  if (pr.length) {
    const list = ((read(PROJECTS) as Item[] | undefined) ?? []).filter((p) => p?.id);
    const map = new Map(list.map((p) => [p.id, p]));
    for (const r of pr) { if (gone(r)) map.delete(r.id); else map.set(r.id, r.data as Item); }
    // newest first, as the app keeps them
    write(PROJECTS, [...map.values()].sort((a, b) => ((b as { updated?: number }).updated ?? 0) - ((a as { updated?: number }).updated ?? 0)));
  }

  const sy = by("system"), pf = by("profile");
  if (sy.length || pf.length) {
    const studio: Studio = (read(STUDIO) as Studio | undefined) ?? { version: 1, systems: [], profiles: [] };
    const merge = (list: Item[] = [], rs: Row[]) => {
      const map = new Map(list.map((x) => [x.id, x]));
      for (const r of rs) { if (gone(r)) map.delete(r.id); else map.set(r.id, r.data as Item); }
      return [...map.values()];
    };
    studio.systems = merge(studio.systems, sy);
    studio.profiles = merge(studio.profiles, pf);
    write(STUDIO, studio);
  }

  for (const r of by("pref")) {
    if (!PREFS.includes(r.id)) continue;
    try { if (gone(r)) localStorage.removeItem(r.id); else localStorage.setItem(r.id, String(r.data)); } catch { /* storage full */ }
  }
  return rows.length;
}

/** This phone's cloud link: which shop, and what it knew at the last sync. */
export interface CloudLocal { shopId: string | null; state: SyncState; lastSync: number | null }
export function loadCloudLocal(): CloudLocal {
  const v = read(STATE) as CloudLocal | undefined;
  return v && v.state ? v : { shopId: null, state: emptyState(), lastSync: null };
}
export function saveCloudLocal(c: CloudLocal): void { write(STATE, c); }
export function clearCloudLocal(): void { try { localStorage.removeItem(STATE); } catch { /* ignore */ } }
