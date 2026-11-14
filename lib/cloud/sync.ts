/**
 * Cloud save — the merge rules, with no network and no browser in them, so
 * they can be tested on plain data (evals/cloud/sync.ts).
 *
 * The phone keeps working from its own storage (local first). A sync:
 *  1. pulls the rows the cloud changed since the last pull,
 *  2. takes each one unless this phone changed the same record later,
 *  3. pushes what this phone changed (or deleted) since the last sync.
 * Per record (one job, one system…), the newer change wins. A delete is a
 * tombstone, so it reaches every phone. On first login nothing is stamped yet,
 * so everything on the phone is uploaded — nothing is lost.
 */

export type Kind = "project" | "system" | "profile" | "pref";
export type Key = `${Kind}:${string}`;

/** A record as the cloud holds it. */
export interface Row {
  kind: Kind;
  id: string;
  data: unknown | null;
  updated_at: string;
  deleted_at: string | null;
  /** server time of the cloud write — the pull cursor */
  synced_at?: string;
}

/** What this phone knew about a record at its last sync. */
export interface Stamp { h: string; t: string; gone?: boolean }

export interface SyncState {
  /** the server time (synced_at) of the newest row pulled so far */
  lastPull: string | null;
  stamps: Record<string, Stamp>;
  /** when this phone last edited a record (ms), set by the stores on save */
  dirty: Record<string, number>;
}

export const emptyState = (): SyncState => ({ lastPull: null, stamps: {}, dirty: {} });
export const keyOf = (kind: Kind, id: string): Key => `${kind}:${id}`;
const split = (k: string): [Kind, string] => { const i = k.indexOf(":"); return [k.slice(0, i) as Kind, k.slice(i + 1)]; };

/** A short fingerprint of a record, to see whether it changed since the last sync. */
export function hashOf(v: unknown): string {
  const s = JSON.stringify(v ?? null);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36) + ":" + s.length;
}

export interface Reconciled {
  /** cloud rows to write into this phone (data null = delete it here) */
  apply: Row[];
  /** this phone's changes to send */
  push: Row[];
  state: SyncState;
}

/**
 * Merge this phone's records with the rows pulled from the cloud.
 * `local` maps every record the phone has now to its data.
 */
export function reconcile(local: Record<string, unknown>, state: SyncState, pulled: Row[], now: number): Reconciled {
  const stamps = { ...state.stamps };
  const iso = (ms: number) => new Date(ms).toISOString();

  // what this phone changed since the last sync: edited, new, or deleted
  const changed = new Set<string>();
  for (const [k, v] of Object.entries(local)) {
    const st = stamps[k];
    if (!st || st.gone || st.h !== hashOf(v)) changed.add(k);
  }
  for (const [k, st] of Object.entries(stamps)) if (!st.gone && !(k in local)) changed.add(k);
  const localTime = (k: string) => state.dirty[k] ?? now;

  const apply: Row[] = [];
  let lastPull = state.lastPull;
  for (const r of pulled) {
    const k = keyOf(r.kind, r.id);
    const at = r.synced_at ?? r.updated_at;
    if (!lastPull || at > lastPull) lastPull = at;
    if (changed.has(k) && localTime(k) > Date.parse(r.updated_at)) continue; // this phone's change is newer
    changed.delete(k);
    const gone = !!r.deleted_at || r.data === null;
    // nothing to do when the phone already has exactly this
    const same = gone ? !(k in local) : k in local && hashOf(local[k]) === hashOf(r.data);
    if (!same) apply.push(r);
    stamps[k] = { h: gone ? "" : hashOf(r.data), t: r.updated_at, gone };
  }

  const push: Row[] = [];
  for (const k of changed) {
    const [kind, id] = split(k);
    const t = iso(localTime(k));
    const gone = !(k in local);
    push.push({ kind, id, data: gone ? null : local[k], updated_at: t, deleted_at: gone ? t : null });
    stamps[k] = { h: gone ? "" : hashOf(local[k]), t, gone };
  }

  return { apply, push, state: { lastPull, stamps, dirty: {} } };
}
