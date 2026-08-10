/**
 * Saved projects — the reason a fabricator comes back tomorrow.
 *
 * A project stores the full JobItem[] (not just a summary) so a job can be
 * REOPENED, not merely listed. Everything here is JSON-safe and lives in
 * localStorage; there is no server and no account.
 *
 * Summary fields (sqft / scrapPct / amount) are denormalised so the home
 * screen can render cards and lifetime stats without re-running the estimator.
 * They are only ever written from real computed output — never guessed.
 */
import type { JobItem } from "@/lib/engine/types";
import { sqft as sqftOf } from "@/lib/engine/units";

const KEY = "fabriq_projects";
/** Keep storage bounded; a shop that does 50+ jobs still loads instantly. */
const MAX = 50;

export interface ProjectRec {
  id: string;
  title: string;
  created: number;
  updated: number;
  items: JobItem[];
  /** total opening area, ft² */
  sqft: number;
  /** cutting waste of the last estimate, % — 0 until the result screen reports it */
  scrapPct: number;
  /** quoted total in ₹ — 0 means "not quoted yet", which the UI shows as a pending stage */
  amount: number;
  customer?: string;
}

function isProject(v: unknown): v is ProjectRec {
  const p = v as ProjectRec;
  return !!p && typeof p.id === "string" && Array.isArray(p.items);
}

export function loadProjects(): ProjectRec[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    // Drops anything written by an older shape that cannot be reopened.
    return raw.filter(isProject).sort((a, b) => b.updated - a.updated);
  } catch {
    return [];
  }
}

function write(list: ProjectRec[]): ProjectRec[] {
  const next = list.sort((a, b) => b.updated - a.updated).slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota — keep the in-memory copy */ }
  return next;
}

export function newProjectId(): string {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Insert or replace a project, keeping `created` from the original. */
export function saveProject(p: ProjectRec): ProjectRec[] {
  const list = loadProjects();
  const prev = list.find((x) => x.id === p.id);
  const merged: ProjectRec = { ...p, created: prev?.created ?? p.created, updated: Date.now() };
  return write([merged, ...list.filter((x) => x.id !== p.id)]);
}

/**
 * Patch the summary of an existing project. Used by the result screen to report
 * real scrap / quote figures as the fabricator works, without owning the record.
 * No-op if the project was never saved — so a stray callback cannot create junk.
 */
export function patchProject(id: string, patch: Partial<Omit<ProjectRec, "id" | "items" | "created">>): void {
  const list = loadProjects();
  const cur = list.find((x) => x.id === id);
  if (!cur) return;
  write([{ ...cur, ...patch, updated: Date.now() }, ...list.filter((x) => x.id !== id)]);
}

export function removeProject(id: string): ProjectRec[] {
  return write(loadProjects().filter((p) => p.id !== id));
}

/** "3 Window · 1 Door" — a title the fabricator recognises without opening it. */
export function autoTitle(items: JobItem[]): string {
  const LABEL: Record<string, string> = { window: "Window", door: "Door", partition: "Partition" };
  const count = new Map<string, number>();
  for (const it of items) count.set(it.type, (count.get(it.type) ?? 0) + it.qty);
  const parts = [...count.entries()].map(([t, n]) => `${n} ${LABEL[t] ?? t}`);
  return parts.join(" · ") || "Untitled job";
}

/** Total opening area across every unit, ft². */
export function totalSqft(items: JobItem[]): number {
  return items.reduce((a, it) => a + sqftOf(it.width, it.height) * it.qty, 0);
}
