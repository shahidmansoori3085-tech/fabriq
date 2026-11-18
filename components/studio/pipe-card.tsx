"use client";
/**
 * The card under the drawing when a pipe or a pane is tapped (founder 2026-11-17:
 * "dekhte hi samajh aa jaye"). One pipe: its section, its cut with big − / +
 * (one sut a tap), what it is on a mesh shutter, and the rarer changes folded
 * under "More". One pane: glass / mesh / sheet and its size, also − / +.
 */
import { useState } from "react";
import type { Um } from "../../lib/engine/units";
import { UM_PER_SUT } from "../../lib/engine/units";
import type { PartDef, StudioSystem } from "../../lib/studio/model";
import { findProfile, type StudioLibrary } from "../../lib/studio/store";
import { alternativesOf, partLabel, bumpCut, bumpSize, ownCut, caseIndex, pickSwitchId, setCut } from "../../lib/studio/edit";
import { fmtLen, ruleText, noMaker, sectionTitle, readLen, lenToInput, type StudioUnit } from "../../lib/studio/format";
import SectionSketch from "../section-sketch";
import { Seg, Toggle } from "../studio-ui";

const PLACE: Record<string, string> = {
  "frame-top": "Track · top", "frame-bottom": "Track · bottom", "frame-left": "Track · left side", "frame-right": "Track · right side",
  "sash-top": "Shutter · top", "sash-bottom": "Shutter · bottom", "sash-lock": "Shutter · handle side", "sash-meet": "Shutter · meeting side",
  meeting: "Where glass shutters meet", mullion: "Mullion", other: "Other piece",
};

const sizeName = (sys: StudioSystem, id: string) =>
  id === "W" ? "Window width" : id === "H" ? "Window height" : sys.sizes.find((s) => s.id === id)?.label ?? id;

/** "Bearing Top" + "Bearing Bottom" → "Bearing · top and bottom" */
function groupTitle(names: string[]): string {
  const u = [...new Set(names)];
  if (u.length < 2) return u[0] ?? "";
  const words = u.map((n) => n.split(" "));
  const head = words[0].slice(0, -1).join(" ");
  if (head && words.every((w) => w.slice(0, -1).join(" ") === head)) return `${head} · ${u.map((n) => n.split(" ").pop()!.toLowerCase()).join(" and ")}`;
  return u.join(" + ");
}
/** a length as the shop cuts it (to the sut, no "about" mark) */
const cutText = (um: Um, unit: StudioUnit) => fmtLen(um, unit).replace(/~/g, "");

/** "+2 sut" / "−1 sut" */
const sutText = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)} sut`;

function Stepper({ value, sub, onStep, disabled }: { value: string; sub?: string; onStep: (d: number) => void; disabled?: boolean }) {
  const btn = "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl font-semibold leading-none active:scale-95";
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" aria-label="1 sut shorter" disabled={disabled} onClick={() => onStep(-1)} className={btn}
        style={{ background: "var(--surface-2)", color: disabled ? "var(--ink-3)" : "var(--ink)" }}>−</button>
      <div className="min-w-0 text-center">
        <div className="mono text-[30px] font-bold leading-none tracking-tight">{value}</div>
        {sub && <div className="mt-1.5 truncate text-xs" style={{ color: "var(--ink-3)" }}>{sub}</div>}
      </div>
      <button type="button" aria-label="1 sut longer" disabled={disabled} onClick={() => onStep(1)} className={btn}
        style={{ background: "var(--surface-2)", color: disabled ? "var(--ink-3)" : "var(--ink)" }}>+</button>
    </div>
  );
}

function CardHead({ over, title, onClose }: { over: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--accent)" }}>{over}</div>
        <div className="mt-0.5 truncate text-[19px] font-bold leading-tight">{title}</div>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full text-xl"
        style={{ color: "var(--ink-3)", background: "var(--surface-2)" }}>×</button>
    </div>
  );
}

/** After a change: it is saved, and every next window uses it (founder 2026-11-18: no 2-window check). */
function MovedNote({ moved }: { moved: number }) {
  if (!moved) return null;
  return (
    <div className="mt-3 rounded-2xl px-4 py-2.5 text-sm" style={{ background: "var(--good-soft)", color: "var(--good)" }}>
      Saved: <b>{sutText(moved)}</b> from before. Every next window uses this cut.
    </div>
  );
}

/** Type the shop's own cut for this window; the rule is set to give exactly that. */
function TypeCut({ unit, placeholder, onSet, disabled }: { unit: StudioUnit; placeholder: string; onSet: (um: number) => void; disabled?: boolean }) {
  const [v, setV] = useState("");
  const um = readLen(v, unit);
  return (
    <div className="mt-3 flex items-center gap-2">
      <input className="field min-w-0 flex-1 px-3 py-2.5 text-base font-semibold" inputMode="decimal" value={v} disabled={disabled}
        onChange={(e) => setV(e.target.value)} placeholder={`Your cut, e.g. ${placeholder}`} aria-label="Your cut" />
      <button type="button" className="btn-primary shrink-0 px-4 py-2.5 text-sm" disabled={disabled || um === null}
        onClick={() => { if (um !== null) { onSet(um); setV(""); } }}>Set</button>
    </div>
  );
}

export function PipeCard({ sys, lib, unit, part: p, group, values, vars, tracks, hasMesh, onSys, onPickSection, onClose }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; part: PartDef;
  /** the pieces cut from the same pipe as this one (top and bottom track…) */
  group: PartDef[];
  values: Record<string, Um | null>; vars: Record<string, string>; tracks: number;
  /** the system makes mesh shutters */
  hasMesh: boolean;
  onSys: (s: StudioSystem, cutMoved?: string) => void;
  onPickSection: (slot: "main" | "mesh" | "alt", idx?: number) => void;
  onClose: () => void;
}) {
  const [moved, setMoved] = useState(0);
  const [more, setMore] = useState(false);
  const ids = group.map((g) => g.id);
  const alts = alternativesOf(sys, p);
  const current = p.profile.find((c) => !c.when || Object.entries(c.when).every(([k, v]) => (Array.isArray(v) ? v.includes(vars[k]) : vars[k] === v))) ?? p.profile[p.profile.length - 1];
  const prof = findProfile(lib, current?.id ?? "");
  const size = sys.sizes.find((s) => s.id === p.length);
  const rule = size ? size.cases[caseIndex(sys, p.length, vars)] : undefined;
  const len = values[p.length];
  const known = len != null && (p.length === "W" || p.length === "H" || rule?.add != null);
  // other pipes cut to the same length move with this one
  const sharing = sys.parts.filter((x) => x.enabled !== false && x.length === p.length && !ids.includes(x.id) && x.length !== "W" && x.length !== "H");
  const shareNames = [...new Set(sharing.map(partLabel))];
  const lockPart = sys.parts.find((x) => x.place === "sash-lock" && x.enabled !== false);
  const lockId = lockPart?.profile[lockPart.profile.length - 1]?.id;
  const meshMode = !p.meshProfile ? "same" : p.meshProfile === lockId && p.place !== "sash-lock" ? "handle" : "other";
  const on = p.enabled !== false;
  const isNormal = sys.switches.some((s) => s.id === "joint");

  // back to where it was: nothing to check any more (the earlier note, if any, stays)
  const [before] = useState(sys.changed);
  const step = (d: number) => {
    const next = bumpCut(sys, p, d * UM_PER_SUT, vars);
    setMoved((m) => m + d);
    if (moved + d === 0) onSys({ ...next, changed: before });
    else onSys(next);
  };
  const patchGroup = (q: Partial<PartDef>) => onSys({ ...sys, parts: sys.parts.map((x) => (ids.includes(x.id) ? { ...x, ...q } : x)) });

  return (
    <div className="card mt-3 p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <CardHead over={PLACE[p.place ?? "other"] ?? "Piece"} title={group.length > 1 ? groupTitle(group.map(partLabel)) : partLabel(p)} onClose={onClose} />

      {/* the section */}
      <button type="button" onClick={() => onPickSection("main")} className="mt-3 flex w-full items-center gap-3 rounded-2xl p-2.5 text-left" style={{ background: "var(--surface-2)" }}>
        <span className="h-[64px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-white" style={{ border: "1px solid var(--line)" }}><SectionSketch p={prof} tracks={tracks} /></span>
        <span className="min-w-0 flex-1">
          {prof ? <>
            <span className="block truncate font-bold leading-tight">{sectionTitle(prof.name)}</span>
            <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>
              {[prof.codes ? [...new Set(Object.values(prof.codes).map(noMaker).filter(Boolean))].join(" / ") : "", prof.size ? `${prof.size} mm` : ""].filter(Boolean).join(" · ")}
            </span>
          </> : <span className="font-bold" style={{ color: "var(--bad)" }}>Choose a section</span>}
        </span>
        <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--accent)" }}>Change</span>
      </button>
      {alts && alts.length > 1 && (
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          Choices: {alts.map((id) => sectionTitle(findProfile(lib, id)?.name ?? id)).join(" or ")}. Picked on each shutter: tap the glass.
        </p>
      )}

      {/* the cut */}
      <div className="mt-5">
        <div className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Cut length on this window</div>
        <Stepper value={len != null ? cutText(len, unit) : "Not known"} disabled={!known || !on}
          sub={rule ? `${sizeName(sys, p.length)} = ${ruleText(rule, sizeName(sys, rule.base), unit).replace(/~/g, "")}` : p.length === "W" || p.length === "H" ? `Full ${sizeName(sys, p.length).toLowerCase()}` : undefined}
          onStep={step} />
        <TypeCut unit={unit} placeholder={len != null ? lenToInput(len, unit) : "46.3"} disabled={!on}
          onSet={(um) => { const d = len != null ? Math.round((um - len) / UM_PER_SUT) : 0; setMoved((m) => m + d); onSys(setCut(sys, p, um, vars, values)); }} />
        {known && shareNames.length > 0 && (
          <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-3)" }}>
            Also moves: {shareNames.join(", ")}.{" "}
            <button type="button" className="font-semibold underline" style={{ color: "var(--accent)" }} onClick={() => onSys(ownCut(sys, ids))}>Change only this pipe</button>
          </p>
        )}
      </div>
      <MovedNote moved={moved} />

      {/* on a mesh shutter */}
      {hasMesh && p.scope === "shutter" && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>On mesh shutters</div>
          <div className="grid grid-cols-3 gap-1.5">
            {([["same", "Same pipe"], ...(p.place !== "sash-lock" && lockId ? [["handle", "Handle pipe"]] : []), ["other", meshMode === "other" ? sectionTitle(findProfile(lib, p.meshProfile ?? "")?.name ?? "Other") : "Other pipe"]] as [string, string][]).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={meshMode === v}
                onClick={() => (v === "other" ? onPickSection("mesh") : patchGroup({ meshProfile: v === "handle" ? lockId : undefined }))}
                className={`chip truncate px-2 py-2 text-[13px] ${meshMode === v ? "selected" : ""}`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* rarer changes */}
      <button type="button" onClick={() => setMore((m) => !m)} className="mt-5 flex w-full items-center justify-between border-t pt-3 text-sm font-semibold" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
        More <span aria-hidden style={{ transform: more ? "rotate(90deg)" : undefined }}>›</span>
      </button>
      {more && (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Use this pipe</span>
            <Toggle on={on} onChange={(v) => patchGroup({ enabled: v })} label="Use this pipe" />
          </div>
          {!isNormal && (
            <div className="flex items-center justify-between">
              <span>Cut</span>
              <Seg small value={p.angle} onChange={(v) => patchGroup({ angle: v })} options={[{ value: 90, label: "90°" }, { value: 45, label: "45°" }]} />
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Pieces {p.scope === "window" ? "per window" : p.scope === "shutter" ? "per shutter" : "per meeting"}</span>
            <span className="flex items-center gap-2">
              <button type="button" className="btn-ghost h-9 w-9" aria-label="Fewer" onClick={() => onSys({ ...sys, parts: sys.parts.map((x) => (x.id === p.id ? { ...x, count: Math.max(1, x.count - 1) } : x)) })}>−</button>
              <b className="w-5 text-center tabnum">{p.count}</b>
              <button type="button" className="btn-ghost h-9 w-9" aria-label="More" onClick={() => onSys({ ...sys, parts: sys.parts.map((x) => (x.id === p.id ? { ...x, count: Math.min(8, x.count + 1) } : x)) })}>+</button>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <button type="button" className="font-semibold" style={{ color: "var(--accent)" }} onClick={() => onPickSection("alt")}>+ Another section to choose</button>
            <button type="button" className="font-semibold" style={{ color: "var(--accent)" }} onClick={() => patchGroup({ flipSection: !p.flipSection })}>Turn section{p.flipSection ? " back" : ""}</button>
            <button type="button" className="font-semibold" style={{ color: "var(--bad)" }}
              onClick={() => { onClose(); onSys({ ...sys, parts: sys.parts.filter((x) => x.id !== p.id), switches: sys.switches.filter((s) => s.id !== pickSwitchId(p.id)) }); }}>Remove this piece</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A tapped pane: what fills it and its size. */
export function PaneCard({ sys, lib, unit, index, mix, values, vars, perShutter, meetClip, onKind, onChoice, onSys, onClose }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; index: number; mix: string;
  values: Record<string, Um | null>; vars: Record<string, string>; perShutter: Record<string, string>[]; meetClip: boolean;
  onKind: (k: "G" | "J" | "S") => void; onChoice: (swId: string, v: string) => void;
  onSys: (s: StudioSystem, cutMoved?: string) => void; onClose: () => void;
}) {
  const [moved, setMoved] = useState(0);
  const kind = (mix[index] ?? "G") as "G" | "J" | "S";
  const fill = kind === "J" ? "Mesh" : kind === "S" ? "Sheet" : "Glass";
  const choiceParts = sys.parts.filter((p) => p.scope === "shutter" && p.enabled !== false && alternativesOf(sys, p) && !(meetClip && p.id === "shutterMeet"));
  const v = (id: string) => values[id];
  const ruleOf = (id: string) => sys.sizes.find((s) => s.id === id)?.cases[caseIndex(sys, id, vars)];
  const [before] = useState(sys.changed);
  const step = (id: string, d: number) => {
    setMoved((m) => m + d);
    const next = bumpSize(sys, id, d * UM_PER_SUT, vars);
    if (moved + d === 0) onSys({ ...next, changed: before });
    else onSys(next);
  };
  const row = (id: string, label: string) => {
    const r = ruleOf(id);
    return (
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{fill} {label}</div>
        <Stepper value={v(id) != null ? cutText(v(id)!, unit) : "Not known"} disabled={v(id) == null || r?.add == null}
          sub={r ? ruleText(r, sizeName(sys, r.base), unit).replace(/~/g, "") : undefined} onStep={(d) => step(id, d)} />
        <TypeCut unit={unit} placeholder={v(id) != null ? lenToInput(v(id)!, unit) : "27.4"}
          onSet={(um) => onSys(setCut(sys, { id, role: id, profile: [], scope: "window", count: 1, length: id, angle: 90 }, um, vars, values))} />
      </div>
    );
  };
  return (
    <div className="card mt-3 p-4" style={{ boxShadow: "var(--shadow-lg)" }}>
      <CardHead over={`Shutter ${index + 1} of ${mix.length}`} title={`${fill} shutter`} onClose={onClose} />
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(["G", "J", "S"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => onKind(k)}
            className={`chip px-2 py-2 text-[13px] ${kind === k ? "selected" : ""}`}>{k === "G" ? "Glass" : k === "J" ? "Mesh" : "Sheet"}</button>
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
        Shutter {v("shutterW") != null ? cutText(v("shutterW")!, unit) : "?"} × {v("shutterH") != null ? cutText(v("shutterH")!, unit) : "?"}
      </p>
      {row(sys.infill.w, "width")}
      {row(sys.infill.h, "height")}
      <MovedNote moved={moved} />

      {choiceParts.map((p) => {
        const swId = pickSwitchId(p.id);
        const opts = alternativesOf(sys, p)!;
        const cur = perShutter[index]?.[swId] ?? opts[0];
        return (
          <div key={p.id} className="mt-5">
            <div className="mb-2 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{partLabel(p)} on this shutter</div>
            <div className="grid grid-cols-2 gap-2">
              {opts.map((id) => {
                const pr = findProfile(lib, id);
                return (
                  <button key={id} type="button" onClick={() => onChoice(swId, id)} aria-pressed={cur === id}
                    className={`chip flex flex-col items-center gap-1 p-2 ${cur === id ? "selected" : ""}`}>
                    <span className="h-12 w-full"><SectionSketch p={pr} /></span>
                    <span className="text-xs leading-tight">{pr ? sectionTitle(pr.name) : id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
