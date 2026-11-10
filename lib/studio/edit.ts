/** Small, pure edits on a system, shared by the templates and the Studio screens. */
import type { PartDef, StudioSystem } from "./model";

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
  p.role.replace(/\{s\}\s*/g, "").replace(/\{tag\}/g, "").replace(/\s*\{k\}/g, "").trim();
