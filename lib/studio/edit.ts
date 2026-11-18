/** Small, pure edits on a system, shared by the templates and the Studio screens. */
import type { Cond, PartDef, SizeCase, StudioSystem } from "./model";

export const pickSwitchId = (partId: string) => `pick_${partId}`;

/**
 * Give one piece two or more sections to choose from (e.g. interlock or slim
 * interlock). On shutter pieces the choice is made shutter by shutter — a real
 * window can carry a small slim interlock on one shutter and a big one on the next.
 */
export function withAlternatives(sys: StudioSystem, partId: string, ids: string[], label?: (id: string) => string): StudioSystem {
  const part = sys.parts.find((p) => p.id === partId);
  if (!part) return sys;
  const swId = pickSwitchId(partId);
  const others = sys.switches.filter((s) => s.id !== swId);
  const clean = ids.filter((x, i) => x && ids.indexOf(x) === i);
  if (clean.length <= 1) {
    return { ...sys, switches: others, parts: sys.parts.map((p) => (p.id === partId ? { ...p, profile: [{ id: clean[0] ?? "" }], perShutter: undefined } : p)) };
  }
  const name = (id: string) => label?.(id) ?? sys.profiles.find((p) => p.id === id)?.name ?? id;
  return {
    ...sys,
    switches: [...others, { id: swId, label: partLabel(part), default: clean[0], options: clean.map((id) => ({ value: id, label: name(id) })) }],
    parts: sys.parts.map((p) => (p.id === partId
      ? { ...p, perShutter: p.scope === "shutter", profile: [...clean.map((id) => ({ when: { [swId]: id }, id })), { id: clean[0] }] }
      : p)),
  };
}

/** The choices a piece offers, or null when it has one section. */
export function alternativesOf(sys: StudioSystem, part: PartDef): string[] | null {
  const sw = sys.switches.find((s) => s.id === pickSwitchId(part.id));
  return sw ? sw.options.map((o) => o.value) : null;
}

/** A piece's name as the shop reads it (no {s} / {tag} / {k} placeholders). */
export const partLabel = (p: PartDef) =>
  p.role.replace(/\{s\}\s*/g, "").replace(/\{lr\}/g, "Left / Right").replace(/\{tag\}/g, "").replace(/\s*\{k\}/g, "").trim();

/* ——— cut changes made on the drawing (founder 2026-11-17: the fabricator fixes a size by
   tapping the pipe and pressing − / +, one sut at a time) ——— */

const matchesCond = (cond: Cond | undefined, vars: Record<string, string>) =>
  !cond || Object.entries(cond).every(([k, v]) => (Array.isArray(v) ? v.includes(vars[k]) : vars[k] === v));

/** the rule that gives this size on this window (first match wins) */
export function caseIndex(sys: StudioSystem, sizeId: string, vars: Record<string, string>): number {
  const s = sys.sizes.find((x) => x.id === sizeId);
  if (!s) return -1;
  const i = s.cases.findIndex((c) => matchesCond(c.when, vars));
  return i >= 0 ? i : s.cases.length - 1;
}

const SHOP = { status: "verified" as const, source: "Your shop: set on the drawing" };

/**
 * Make a size longer or shorter (µm) where it applies to this window. A piece cut
 * straight to the window width / height first gets its own size, so it can move.
 * Returns the new system and the size id the piece now uses.
 */
export function bumpCut(sys: StudioSystem, part: PartDef, delta: number, vars: Record<string, string>): StudioSystem {
  if (part.length === "W" || part.length === "H") {
    const id = `cut_${part.id}`;
    const c: SizeCase = { base: part.length, add: delta, evidence: SHOP };
    return {
      ...sys,
      sizes: [...sys.sizes, { id, label: partLabel(part), cases: [c] }],
      parts: sys.parts.map((p) => (p.id === part.id ? { ...p, length: id } : p)),
    };
  }
  return bumpSize(sys, part.length, delta, vars);
}

/** Move one size (glass width, shutter height…) where it applies to this window. */
export function bumpSize(sys: StudioSystem, sizeId: string, delta: number, vars: Record<string, string>): StudioSystem {
  const i = caseIndex(sys, sizeId, vars);
  return {
    ...sys,
    sizes: sys.sizes.map((s) => (s.id !== sizeId ? s : {
      ...s, cases: s.cases.map((c, k) => (k !== i || c.add === null ? c : { ...c, add: c.add + delta, evidence: SHOP })),
    })),
  };
}

/** Give these pieces a length of their own (a copy of the shared one), so a change moves only them. */
export function ownCut(sys: StudioSystem, partIds: string[]): StudioSystem {
  const first = sys.parts.find((p) => p.id === partIds[0]);
  if (!first || first.length === "W" || first.length === "H") return sys;
  const from = sys.sizes.find((s) => s.id === first.length);
  if (!from) return sys;
  const id = `${from.id}_${first.id}`;
  const at = sys.sizes.indexOf(from);
  const copy = { ...from, id, label: partLabel(first), cases: from.cases.map((c) => ({ ...c })) };
  return {
    ...sys,
    sizes: [...sys.sizes.slice(0, at + 1), copy, ...sys.sizes.slice(at + 1)],
    parts: sys.parts.map((p) => (partIds.includes(p.id) ? { ...p, length: id } : p)),
  };
}

/**
 * Set a piece to an exact cut on this window (the shop types its own length; founder 2026-11-18:
 * no 2-window process, change it right here). Works when the rule had no number yet too.
 */
export function setCut(sys: StudioSystem, part: PartDef, target: number, vars: Record<string, string>, values: Record<string, number | null>): StudioSystem {
  const cur = values[part.length];
  if (cur != null) return bumpCut(sys, part, target - cur, vars);
  const size = sys.sizes.find((x) => x.id === part.length);
  const i = caseIndex(sys, part.length, vars);
  const c = size?.cases[i];
  const base = c ? values[c.base] : null;
  if (!size || !c || base == null) return sys;
  const raw = Math.round((base * (c.num ?? 1) + (c.pre ?? 0)) / (c.den ?? 1));
  return {
    ...sys,
    sizes: sys.sizes.map((s) => (s.id !== size.id ? s : { ...s, cases: s.cases.map((k, j) => (j === i ? { ...k, add: target - raw, evidence: SHOP } : k)) })),
  };
}
