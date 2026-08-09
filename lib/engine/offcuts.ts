/**
 * FabriQ Offcut Bank — leftover bar pieces worth keeping for the next job.
 * Deterministic (no LLM): every bar the cutter packs has a leftover remainder
 * (barLength − used) sitting at the end of the bar. If that remainder is long
 * enough to matter, it's an offcut — the fabricator can save it to a running
 * bank stored in localStorage and check it before buying fresh pipe next time.
 */
import { feet, toFeet, type Um } from "./units";
import type { PackedBar } from "./types";

/** Below this, a leftover is cut-off scrap, not a usable offcut. */
export const MIN_OFFCUT: Um = feet(1);

export interface Offcut {
  id: string;
  sectionId: string;
  length: Um;
  savedAt: number;
  jobLabel?: string;
}

/** Candidate offcuts sitting in this job's cutting plan (not yet saved). */
export interface OffcutCandidate {
  key: string; // stable per bar, for selection state
  sectionId: string;
  length: Um;
  barNo: number;
}

/** Every bar whose leftover remainder is worth keeping. */
export function findOffcuts(bars: PackedBar[], min: Um = MIN_OFFCUT): OffcutCandidate[] {
  return bars
    .filter((b) => b.waste >= min)
    .map((b) => ({ key: `${b.sectionId}-${b.barNo}`, sectionId: b.sectionId, length: b.waste, barNo: b.barNo }));
}

const KEY = "fabriq_offcuts";

export function loadOffcuts(): Offcut[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function persist(list: Offcut[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function addOffcuts(candidates: OffcutCandidate[], jobLabel?: string): Offcut[] {
  const existing = loadOffcuts();
  const fresh: Offcut[] = candidates.map((c) => ({
    id: `${Date.now()}-${c.key}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId: c.sectionId,
    length: c.length,
    savedAt: Date.now(),
    jobLabel,
  }));
  const next = [...existing, ...fresh];
  persist(next);
  return next;
}

export function removeOffcut(id: string): Offcut[] {
  const next = loadOffcuts().filter((o) => o.id !== id);
  persist(next);
  return next;
}

export function totalOffcutFt(offcuts: Offcut[]): number {
  return offcuts.reduce((a, o) => a + toFeet(o.length), 0);
}
