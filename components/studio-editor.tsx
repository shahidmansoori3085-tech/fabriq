"use client";
/**
 * One system, edited around its drawing. The window is drawn to scale from
 * the system itself; tap a piece to see its section, its cut and change
 * anything; tap a shutter to set glass / mesh and per-shutter sections.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { inches, type Um } from "../lib/engine/units";
import type { PartDef, PartScope, ProfileDef, ProfileKind, StudioSystem, Place } from "../lib/studio/model";
import { evaluate, computeSizes, jobVars, matches, type StudioJob } from "../lib/studio/evaluate";
import { windowGeometry } from "../lib/studio/geometry";
import { withAlternatives, alternativesOf, partLabel, pickSwitchId } from "../lib/studio/edit";
import { PART_KIND } from "../lib/studio/templates";
import { findProfile, newId, type StudioLibrary } from "../lib/studio/store";
import { layoutLabel, fmtLen, readLen, lenToInput, STATUS_TEXT, MIXES, mixText, ruleText, whenText, UNIT_SHORT, type StudioUnit } from "../lib/studio/format";
import dynamic from "next/dynamic";
import WindowDrawing, { type Pick } from "./studio-drawing";

// three.js is heavy: load the 3D view only when it is opened
const Window3D = dynamic(() => import("./studio-3d"), { ssr: false, loading: () => <div className="grid h-[380px] place-items-center text-sm" style={{ color: "var(--ink-3)" }}>Building 3D…</div> });
import SectionSketch from "./section-sketch";
import { SectionPicker } from "./studio/pickers";
import { CutsTab } from "./studio/rules";
import { TeachPanel } from "./studio/teach";
import { CutList } from "./studio/cutlist";
import { Badge, Seg, Field, SectionTitle, Toggle } from "./studio-ui";

export { ProfileForm } from "./studio/pickers";

type Tab = "pieces" | "cut" | "teach" | "rules";

const SCOPE_TITLE: Record<PartScope, string> = {
  window: "Frame",
  shutter: "Each shutter",
  meeting: "Where two glass shutters meet",
  between: "Between sashes (mullion)",
};

const PLACE_TEXT: Record<Place, string> = {
  "frame-top": "Frame · top", "frame-bottom": "Frame · bottom", "frame-left": "Frame · left side", "frame-right": "Frame · right side",
  "sash-top": "Shutter · top", "sash-bottom": "Shutter · bottom", "sash-lock": "Shutter · handle side", "sash-meet": "Shutter · meeting side",
  meeting: "Between glass shutters", mullion: "Mullion between sashes", other: "Not in the drawing",
};

function roleFrom(name: string, scope: PartScope): string {
  const n = name.trim() || "Piece";
  return scope === "shutter" ? `{s} ${n}{tag}` : scope === "meeting" ? `${n} {k}` : n;
}

const sizeLabel = (sys: StudioSystem, id: string) =>
  id === "W" ? "Window width" : id === "H" ? "Window height" : sys.sizes.find((s) => s.id === id)?.label ?? id;

/** What the shop should do next, in one line. */
export function nextStep(sys: StudioSystem): { text: string; tab: Tab; tone: "good" | "warn" | "bad" } {
  const lay = sys.layouts[0];
  const r = evaluate(sys, { id: "W1", W: 1524000, H: 1219200, qty: 1, tracks: lay?.tracks ?? 2, mix: lay?.mixes[0] ?? "GG" }, { allowUnknown: true });
  const sections = r.missing.filter((m) => m.startsWith("Section for"));
  if (sections.length) return { text: `Choose ${sections.length === 1 ? "a section" : `${sections.length} sections`} — tap the red pieces`, tab: "pieces", tone: "bad" };
  if (r.missing.length) return { text: `${r.missing.length} cut${r.missing.length > 1 ? "s" : ""} not known yet. Teach from one window you made.`, tab: "teach", tone: "warn" };
  if (sys.jobs.length === 0) return { text: "Ready. Check it once against a window you made.", tab: "teach", tone: "good" };
  if (sys.status === "teaching") return { text: "Learned from your window. Check it with a second window.", tab: "teach", tone: "warn" };
  return { text: "Ready to use.", tab: "cut", tone: "good" };
}

export default function StudioEditor({ sys, lib, unit, onChange, onAddProfile, onBack, onDuplicate, onDelete }: {
  sys: StudioSystem;
  lib: StudioLibrary;
  unit: StudioUnit;
  onChange: (s: StudioSystem) => void;
  onAddProfile: (p: ProfileDef) => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const lay0 = sys.layouts[0] ?? { tracks: 2, mixes: ["GG"] };
  const [W, setW] = useState<Um>(inches(60));
  const [H, setH] = useState<Um>(inches(48));
  const [tracks, setTracks] = useState(lay0.tracks);
  const [mix, setMix] = useState(lay0.mixes[0] ?? "GG");
  const [switches, setSwitches] = useState<Record<string, string>>({});
  const [perShutter, setPerShutter] = useState<Record<string, string>[]>([]);
  const [pick, setPick] = useState<Pick>(null);
  const [tab, setTab] = useState<Tab>("pieces");
  const [menu, setMenu] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [picker, setPicker] = useState<{ partId: string; slot: "main" | "mesh" | "alt"; idx?: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);

  // a track count the system no longer offers falls back to its first layout
  useEffect(() => {
    const first = sys.layouts[0];
    if (first && !sys.layouts.some((l) => l.tracks === tracks)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTracks(first.tracks); setMix(first.mixes[0] ?? "GG");
    }
  }, [sys.layouts, tracks]);

  const job: StudioJob = useMemo(() => ({ id: "W1", W, H, qty: 1, tracks, mix, switches, perShutter }), [W, H, tracks, mix, switches, perShutter]);
  const find = (id: string) => findProfile(lib, id);
  const geo = useMemo(() => windowGeometry(sys, job, (id) => findProfile(lib, id)), [sys, job, lib]);
  const values = useMemo(() => computeSizes(sys, job).values, [sys, job]);
  const vars = useMemo(() => jobVars(sys, job), [sys, job]);
  const step = useMemo(() => nextStep(sys), [sys]);

  const setPart = (id: string, patch: Partial<PartDef>) =>
    onChange({ ...sys, parts: sys.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const selectPart = (id: string) => { setPick({ type: "part", id }); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const choose = (profileId: string) => {
    if (!picker) return;
    const p = sys.parts.find((x) => x.id === picker.partId)!;
    const label = (id: string) => find(id)?.name ?? id;
    const alts = alternativesOf(sys, p);
    if (picker.slot === "mesh") setPart(p.id, { meshProfile: profileId });
    else if (picker.slot === "alt") onChange(withAlternatives(sys, p.id, [...(alts ?? [p.profile[p.profile.length - 1]?.id ?? ""]), profileId], label));
    else if (alts) onChange(withAlternatives(sys, p.id, alts.map((a, i) => (i === (picker.idx ?? 0) ? profileId : a)), label));
    else if (picker.idx !== undefined && p.profile.length > 1) setPart(p.id, { profile: p.profile.map((c, i) => (i === picker.idx ? { ...c, id: profileId } : c)) });
    else setPart(p.id, { profile: [{ id: profileId }] });
    setPicker(null);
  };

  const tone = step.tone === "good" ? "var(--good)" : step.tone === "warn" ? "var(--warn)" : "var(--bad)";
  const toneBg = step.tone === "good" ? "var(--good-soft)" : step.tone === "warn" ? "var(--warn-soft)" : "var(--bad-soft)";
  const pickedPart = pick?.type === "part" ? sys.parts.find((p) => p.id === pick.id) : undefined;
  const pickerPart = picker ? sys.parts.find((p) => p.id === picker.partId) : undefined;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← My systems</button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="btn-ghost px-3 py-1.5 text-sm" aria-haspopup="menu">More</button>
          {menu && (
            <div role="menu" className="card absolute right-0 z-30 mt-1 w-44 overflow-hidden p-1" style={{ boxShadow: "var(--shadow-lg)" }}>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => { setMenu(false); onDuplicate(); }}>Duplicate</button>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--bad)" }}
                onClick={() => { setMenu(false); if (window.confirm(`Delete "${sys.name}"? This cannot be undone.`)) onDelete(); }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <input value={sys.name} onChange={(e) => onChange({ ...sys, name: e.target.value })} aria-label="System name"
        className="mt-3 w-full bg-transparent text-[26px] font-bold leading-tight tracking-tight outline-none" />
      <p className="text-sm" style={{ color: "var(--ink-3)" }}>{sys.blurb}</p>

      <button onClick={() => setTab(step.tab)} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold"
        style={{ background: toneBg, color: tone }}>
        <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white" style={{ background: tone }}>{step.tone === "good" ? "✓" : "!"}</span>
        {step.text}
      </button>

      {/* ——— the window ——— */}
      <div ref={top} className="card mt-4 overflow-hidden" style={{ scrollMarginTop: 8 }}>
        <div className="flex items-center justify-between gap-2 px-3 pt-3">
          <Seg small value={view3d ? "3d" : "2d"} onChange={(v) => setView3d(v === "3d")} options={[{ value: "2d", label: "Drawing" }, { value: "3d", label: "3D" }]} />
          <span className="text-right text-[11px] leading-tight" style={{ color: "var(--ink-3)" }}>
            {view3d ? "Drag to turn · tap a piece" : pick ? "Tap empty space to close" : "Tap any piece or shutter"}
            <br />To scale{geo.sizesKnown ? "" : " · shutter size estimated"}
          </span>
        </div>
        <div className="px-2 pb-1 pt-1">
          {view3d ? <Window3D g={geo} pick={pick} onPick={setPick} tracks={tracks} /> : <WindowDrawing g={geo} unit={unit} pick={pick} onPick={setPick} />}
        </div>
        <WindowBar sys={sys} unit={unit} W={W} H={H} tracks={tracks} mix={mix} switches={switches}
          onSize={(w, h) => { setW(w); setH(h); }}
          onLayout={(t, m) => { setTracks(t); setMix(m); setPerShutter([]); }}
          onSwitch={(id, v) => setSwitches((s) => ({ ...s, [id]: v }))} />
      </div>

      {pickedPart && (
        <PartPanel key={pickedPart.id} sys={sys} lib={lib} unit={unit} part={pickedPart} values={values} tracks={tracks} vars={vars}
          onPatch={(patch) => setPart(pickedPart.id, patch)} onSys={onChange}
          onPickSection={(slot, idx) => setPicker({ partId: pickedPart.id, slot, idx })}
          onClose={() => setPick(null)}
          onDelete={() => { setPick(null); onChange({ ...sys, parts: sys.parts.filter((x) => x.id !== pickedPart.id), switches: sys.switches.filter((s) => s.id !== pickSwitchId(pickedPart.id)) }); }} />
      )}
      {pick?.type === "shutter" && (
        <ShutterPanel sys={sys} lib={lib} unit={unit} index={pick.index} mix={mix} values={values} perShutter={perShutter}
          meetClip={(switches.meet ?? sys.switches.find((x) => x.id === "meet")?.default) === "clip"}
          onKind={(k) => setMix((m) => m.slice(0, pick.index) + k + m.slice(pick.index + 1))}
          onChoice={(swId, v) => setPerShutter((ps) => { const next = [...ps]; next[pick.index] = { ...(next[pick.index] ?? {}), [swId]: v }; return next; })}
          onSelectPart={selectPart} onClose={() => setPick(null)} />
      )}

      <div className="sticky top-0 z-20 -mx-4 mt-4 px-4 py-2" style={{ background: "var(--bg)" }}>
        <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: "var(--surface-3)" }} role="tablist">
          {([["pieces", "Pieces"], ["cut", "Cutting list"], ["teach", "Teach"], ["rules", "Rules"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className="rounded-lg py-2 text-[13px] font-semibold"
              style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pieces" && <PiecesList sys={sys} lib={lib} unit={unit} values={values} tracks={tracks} vars={vars} onChange={onChange} onSelect={selectPart} />}
      {tab === "cut" && <CutList sys={sys} lib={lib} unit={unit} job={job} onFix={(w) => setTab(w)} />}
      {tab === "teach" && <TeachPanel sys={sys} lib={lib} unit={unit} job={job} onChange={onChange} />}
      {tab === "rules" && <CutsTab sys={sys} unit={unit} onChange={onChange} />}

      {picker && pickerPart && (
        <SectionPicker lib={lib} kind={kindFor(lib, pickerPart, picker.slot)}
          title={picker.slot === "alt" ? `Another section for ${partLabel(pickerPart)}` : `Section for ${partLabel(pickerPart)}${picker.slot === "mesh" ? " (mesh shutter)" : ""}`}
          onPick={choose} onAdd={(prof) => { onAddProfile(prof); choose(prof.id); }} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

function kindFor(lib: StudioLibrary, p: PartDef, slot: "main" | "mesh" | "alt"): ProfileKind | undefined {
  if (slot === "mesh") return "mesh-shutter";
  if (slot === "alt" && p.place === "sash-meet") return undefined; // interlock or slim interlock: show both
  return findProfile(lib, p.profile[p.profile.length - 1]?.id ?? "")?.kind ?? PART_KIND[p.id];
}

/* ———————————————— window size and layout ———————————————— */

function WindowBar({ sys, unit, W, H, tracks, mix, switches, onSize, onLayout, onSwitch }: {
  sys: StudioSystem; unit: StudioUnit; W: Um; H: Um; tracks: number; mix: string; switches: Record<string, string>;
  onSize: (w: Um, h: Um) => void; onLayout: (t: number, m: string) => void; onSwitch: (id: string, v: string) => void;
}) {
  const [w, setW] = useState(lenToInput(W, unit));
  const [h, setH] = useState(lenToInput(H, unit));
  const commit = (ws: string, hs: string) => {
    const a = readLen(ws, unit), b = readLen(hs, unit);
    if (a && b && a > 254000 && b > 254000 && a < 9144000 && b < 9144000) onSize(a, b);
  };
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];
  return (
    <div className="border-t px-3 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <div className="flex items-end gap-2">
        <Field label={`Width (${UNIT_SHORT[unit]})`}>
          <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={w}
            onChange={(e) => { setW(e.target.value); commit(e.target.value, h); }} />
        </Field>
        <span className="pb-2.5 text-lg" style={{ color: "var(--ink-3)" }}>×</span>
        <Field label={`Height (${UNIT_SHORT[unit]})`}>
          <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={h}
            onChange={(e) => { setH(e.target.value); commit(w, e.target.value); }} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sys.layouts.map((l) => (
          <button key={l.tracks} onClick={() => onLayout(l.tracks, l.mixes[0])} aria-pressed={l.tracks === tracks}
            className={`chip px-3 py-1.5 text-sm ${l.tracks === tracks ? "selected" : ""}`}>{layoutLabel(sys, l.tracks)}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(lay?.mixes ?? []).map((m) => (
          <button key={m} onClick={() => onLayout(tracks, m)} aria-pressed={m === mix}
            className={`chip px-2.5 py-1 text-xs ${m === mix ? "selected" : ""}`}>{mixText(m)}</button>
        ))}
      </div>
      {sys.switches.filter((s) => !s.id.startsWith("pick_")).map((sw) => (
        <div key={sw.id} className="mt-3">
          <div className="mb-1 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{sw.label}</div>
          <Seg small value={switches[sw.id] ?? sw.default} onChange={(v) => onSwitch(sw.id, v)} options={sw.options.map((o) => ({ value: o.value, label: o.label }))} />
        </div>
      ))}
    </div>
  );
}

/* ———————————————— a tapped piece ———————————————— */

function PartPanel({ sys, lib, unit, part: p, values, tracks, vars, onPatch, onSys, onPickSection, onClose, onDelete }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; part: PartDef; values: Record<string, Um | null>; tracks: number; vars: Record<string, string>;
  onPatch: (patch: Partial<PartDef>) => void; onSys: (s: StudioSystem) => void;
  onPickSection: (slot: "main" | "mesh" | "alt", idx?: number) => void; onClose: () => void; onDelete: () => void;
}) {
  const on = p.enabled !== false;
  const alts = alternativesOf(sys, p);
  const byTrack = !alts && p.profile.length > 1;
  const current = p.profile.find((c) => matches(c.when, vars)) ?? p.profile[p.profile.length - 1];
  const prof = findProfile(lib, alts && !(current && !alts.includes(current.id)) ? alts[0] : current?.id ?? "");
  const size = sys.sizes.find((s) => s.id === p.length);
  const rule = size?.cases.find((c) => matches(c.when, vars)) ?? size?.cases[size.cases.length - 1];
  const len = values[p.length];
  const st = rule ? (rule.add === null ? STATUS_TEXT.unknown : STATUS_TEXT[rule.evidence.status]) : STATUS_TEXT.unknown;
  const per = p.scope === "window" ? "per window" : p.scope === "shutter" ? "per shutter" : "per meeting";

  return (
    <div className="card mt-3 p-4" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>{PLACE_TEXT[p.place ?? "other"]}</div>
          <input value={partLabel(p)} onChange={(e) => onPatch({ role: roleFrom(e.target.value, p.scope) })} aria-label="Piece name"
            className="mt-0.5 w-full bg-transparent text-xl font-bold outline-none" />
        </div>
        <Toggle on={on} onChange={(v) => onPatch({ enabled: v })} label="Use this piece" />
        <button onClick={onClose} aria-label="Close" className="-mt-1 text-2xl leading-none" style={{ color: "var(--ink-3)" }}>×</button>
      </div>
      {!on && <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Switched off — not cut, not bought.</p>}

      {/* section */}
      <div className="mt-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
        {!byTrack && !alts && (
          <button onClick={() => onPickSection("main")} className="flex w-full items-center gap-3 text-left">
            <span className="h-[84px] w-[110px] shrink-0 overflow-hidden rounded-lg border bg-white" style={{ borderColor: "var(--line)" }}>
              <SectionSketch p={prof} tracks={tracks} />
            </span>
            <span className="min-w-0 flex-1">
              {prof ? (
                <>
                  <span className="block font-bold leading-tight">{prof.name}</span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--ink-2)" }}>
                    {[prof.codes ? Object.entries(prof.codes).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "", prof.size ? `${prof.size} mm` : ""].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--ink-3)" }}>
                    {prof.kg ? `${prof.kg.value} kg / ${prof.kg.perFt === 3.2808 ? "m" : `${prof.kg.perFt} ft`} · ` : ""}{prof.stockFt[0] ?? 16} ft pipe
                  </span>
                  {prof.source.status === "observed" && <span className="mt-1 block text-[11px]" style={{ color: "var(--warn)" }}>{prof.source.source}</span>}
                </>
              ) : <span className="font-bold" style={{ color: "var(--bad)" }}>Choose a section</span>}
              <span className="mt-1 block text-sm font-semibold" style={{ color: "var(--accent)" }}>Change section ›</span>
            </span>
          </button>
        )}

        {byTrack && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Section by track count</div>
            {p.profile.map((c, i) => {
              const pr = findProfile(lib, c.id);
              return (
                <button key={i} onClick={() => onPickSection("main", i)} className="flex items-center gap-3 rounded-lg bg-white p-2 text-left">
                  <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md"><SectionSketch p={pr} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{c.when ? whenText(sys, c.when) : "Other track counts"}</span>
                    <span className="block truncate text-sm font-bold">{pr ? `${pr.name}${pr.codes ? ` · ${Object.values(pr.codes)[0]}` : ""}` : "Choose a section"}</span>
                  </span>
                  <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
                </button>
              );
            })}
          </div>
        )}

        {alts && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
              {p.scope === "shutter" ? "Choices — picked shutter by shutter (tap a shutter in the drawing)" : "Choices — picked on each window"}
            </div>
            {alts.map((id, i) => {
              const pr = findProfile(lib, id);
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg bg-white p-2">
                  <button onClick={() => onPickSection("main", i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md"><SectionSketch p={pr} /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{pr?.name ?? "Choose a section"}</span>
                      <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>{pr?.codes ? Object.values(pr.codes)[0] : ""}{pr?.size ? ` · ${pr.size} mm` : ""}{i === 0 ? " · default" : ""}</span>
                    </span>
                  </button>
                  <button aria-label="Remove this choice" className="px-2 text-lg" style={{ color: "var(--ink-3)" }}
                    onClick={() => onSys(withAlternatives(sys, p.id, alts.filter((x) => x !== id), (x) => findProfile(lib, x)?.name ?? x))}>×</button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {!byTrack && (
            <button onClick={() => onPickSection("alt")} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              + {p.place === "sash-meet" ? "Add slim / big interlock choice" : "Add another section choice"}
            </button>
          )}
          {!alts && p.scope === "window" && sys.layouts.length > 1 && !byTrack && (
            <button onClick={() => onPatch({ profile: [...sys.layouts.slice(1).map((l) => ({ when: { tracks: String(l.tracks) }, id: current?.id ?? "" })), { id: current?.id ?? "" }] })}
              className="text-sm font-semibold" style={{ color: "var(--accent)" }}>+ Different section per track count</button>
          )}
        </div>
      </div>

      {p.scope === "shutter" && (
        <button onClick={() => onPickSection("mesh")} className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm" style={{ background: "var(--surface-2)" }}>
          <span><span style={{ color: "var(--ink-3)" }}>On mesh shutters: </span><b>{p.meshProfile ? findProfile(lib, p.meshProfile)?.name ?? p.meshProfile : "same section"}</b></span>
          <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
        </button>
      )}

      {/* the cut */}
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
        <div>
          <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Cut length on this window</div>
          <div className="mono text-2xl font-bold">{len != null ? fmtLen(len, unit) : "—"}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--ink-3)" }}>
            {rule && <span className="mono">{sizeLabel(sys, p.length)} = {ruleText(rule, rule.base === "W" ? "W" : rule.base === "H" ? "H" : sizeLabel(sys, rule.base), unit)}</span>}
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
        </div>
        <Seg value={p.angle} onChange={(v) => onPatch({ angle: v })} options={[{ value: 90, label: "90°" }, { value: 45, label: "45°" }]} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label={`Pieces ${per}`}>
          <div className="flex items-center gap-2">
            <button className="btn-ghost h-9 w-9" onClick={() => onPatch({ count: Math.max(1, p.count - 1) })} aria-label="Fewer">−</button>
            <span className="w-6 text-center font-bold tabnum">{p.count}</span>
            <button className="btn-ghost h-9 w-9" onClick={() => onPatch({ count: Math.min(8, p.count + 1) })} aria-label="More">+</button>
          </div>
        </Field>
        <Field label="Cut to">
          <select className="field px-2 py-2 text-sm" value={p.length} onChange={(e) => onPatch({ length: e.target.value })}>
            {sys.sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button onClick={() => onPatch({ flipSection: !p.flipSection })} className="btn-ghost px-3 py-2 text-sm">
          ⇄ Turn section{p.flipSection ? " (turned)" : ""}
        </button>
        <button onClick={onDelete} className="text-sm font-semibold" style={{ color: "var(--bad)" }}>Remove this piece</button>
      </div>
    </div>
  );
}

/* ———————————————— a tapped shutter ———————————————— */

function ShutterPanel({ sys, lib, unit, index, mix, values, perShutter, meetClip, onKind, onChoice, onSelectPart, onClose }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; index: number; mix: string; values: Record<string, Um | null>;
  perShutter: Record<string, string>[]; meetClip: boolean;
  onKind: (k: "G" | "J" | "S") => void; onChoice: (swId: string, v: string) => void; onSelectPart: (id: string) => void; onClose: () => void;
}) {
  const kind = (mix[index] ?? "G") as "G" | "J" | "S";
  // with "shutter + interlock clip" the meeting side is the shutter itself: no slim to choose
  const choiceParts = sys.parts.filter((p) => p.scope === "shutter" && p.enabled !== false && alternativesOf(sys, p) && !(meetClip && p.id === "shutterMeet"));
  const v = (id: string) => values[id];
  return (
    <div className="card mt-3 p-4" style={{ borderColor: "var(--accent)", borderWidth: 1.5 }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>Shutter {index + 1} of {mix.length}</div>
          <div className="mt-0.5 text-xl font-bold">{kind === "J" ? "Mesh shutter" : kind === "S" ? "Sheet shutter" : "Glass shutter"}</div>
        </div>
        <button onClick={onClose} aria-label="Close" className="-mt-1 text-2xl leading-none" style={{ color: "var(--ink-3)" }}>×</button>
      </div>
      <div className="mt-3">
        <Seg value={kind} onChange={onKind} options={[{ value: "G", label: "Glass" }, { value: "J", label: "Mesh" }, { value: "S", label: "Sheet" }]} />
      </div>

      {choiceParts.map((p) => {
        const swId = pickSwitchId(p.id);
        const opts = alternativesOf(sys, p)!;
        const cur = perShutter[index]?.[swId] ?? opts[0];
        return (
          <div key={p.id} className="mt-4">
            <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{partLabel(p)} on this shutter</div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {opts.map((id) => {
                const pr = findProfile(lib, id);
                return (
                  <button key={id} onClick={() => onChoice(swId, id)} aria-pressed={cur === id}
                    className={`chip flex flex-col items-center gap-1 p-2 ${cur === id ? "selected" : ""}`}>
                    <span className="h-12 w-full"><SectionSketch p={pr} /></span>
                    <span className="text-xs leading-tight">{pr?.name ?? id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>Shutter</div>
          <div className="mono font-semibold">{v("shutterW") != null ? fmtLen(v("shutterW")!, unit) : "?"} × {v("shutterH") != null ? fmtLen(v("shutterH")!, unit) : "?"}</div>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-2)" }}>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>{kind === "J" ? "Mesh" : kind === "S" ? "Sheet" : "Glass"}</div>
          <div className="mono font-semibold">{v(sys.infill.w) != null ? fmtLen(v(sys.infill.w)!, unit) : "?"} × {v(sys.infill.h) != null ? fmtLen(v(sys.infill.h)!, unit) : "?"}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {sys.parts.filter((p) => p.scope === "shutter" && p.enabled !== false).map((p) => (
          <button key={p.id} onClick={() => onSelectPart(p.id)} className="chip px-2.5 py-1 text-xs">{partLabel(p)}</button>
        ))}
      </div>
    </div>
  );
}

/* ———————————————— all pieces ———————————————— */

function PiecesList({ sys, lib, unit, values, tracks, vars, onChange, onSelect }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; values: Record<string, Um | null>; tracks: number; vars: Record<string, string>;
  onChange: (s: StudioSystem) => void; onSelect: (id: string) => void;
}) {
  const tracksOn = new Set(sys.layouts.map((l) => l.tracks));
  const toggleTracks = (t: number) => {
    const layouts = tracksOn.has(t)
      ? sys.layouts.filter((l) => l.tracks !== t)
      : [...sys.layouts, { tracks: t, mixes: MIXES[t] }].sort((a, b) => a.tracks - b.tracks);
    if (layouts.length) onChange({ ...sys, layouts });
  };
  const addPart = (scope: PartScope) => {
    const id = newId("p");
    onChange({ ...sys, parts: [...sys.parts, { id, role: roleFrom("New piece", scope), profile: [{ id: "" }], scope, count: 1, length: sys.sizes[0]?.id ?? "W", angle: 90, place: "other" }] });
    onSelect(id);
  };

  return (
    <div>
      {((sys.family === "casement" ? ["window", "between", "shutter"] : ["window", "shutter", "meeting"]) as PartScope[]).map((scope) => {
        const list = sys.parts.filter((p) => p.scope === scope);
        return (
          <div key={scope}>
            <SectionTitle aside={<button onClick={() => addPart(scope)} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>+ Add piece</button>}>
              {SCOPE_TITLE[scope]}
            </SectionTitle>
            {list.length === 0 && <div className="card px-4 py-3 text-sm" style={{ color: "var(--ink-3)" }}>None. Add one if your system has it.</div>}
            <div className="card divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {list.map((p) => {
                const alts = alternativesOf(sys, p);
                const c = p.profile.find((x) => matches(x.when, vars)) ?? p.profile[p.profile.length - 1];
                const pr = findProfile(lib, alts && !(c && !alts.includes(c.id)) ? alts[0] : c?.id ?? "");
                const on = p.enabled !== false;
                const len = values[p.length];
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5" style={{ opacity: on ? 1 : 0.5 }}>
                    <button onClick={() => onSelect(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="h-11 w-14 shrink-0 overflow-hidden rounded-md border" style={{ borderColor: pr ? "var(--line)" : "var(--bad)" }}>
                        <SectionSketch p={pr} tracks={tracks} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-semibold">{partLabel(p)}</span>
                          {p.count > 1 && <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>×{p.count}</span>}
                        </span>
                        <span className="block truncate text-xs" style={{ color: pr ? "var(--ink-3)" : "var(--bad)" }}>
                          {pr ? `${pr.name}${pr.codes ? ` · ${Object.values(pr.codes)[0]}` : ""}${alts && alts.length > 1 ? ` · +${alts.length - 1} choice` : ""}` : "Choose a section"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="mono block text-sm font-semibold">{len != null ? fmtLen(len, unit) : "—"}</span>
                        <span className="block text-[11px] font-bold" style={{ color: p.angle === 45 ? "var(--glass)" : "var(--ink-3)" }}>{p.angle}°</span>
                      </span>
                    </button>
                    <Toggle on={on} onChange={(v) => onChange({ ...sys, parts: sys.parts.map((x) => (x.id === p.id ? { ...x, enabled: v } : x)) })} label={`Use ${partLabel(p)}`} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <SectionTitle>{sys.family === "casement" ? "Sash counts this system makes" : "Track counts this system makes"}</SectionTitle>
      <div className="card p-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <button key={t} onClick={() => toggleTracks(t)} aria-pressed={tracksOn.has(t)}
              className={`chip px-3.5 py-2 text-sm ${tracksOn.has(t) ? "selected" : ""}`}>{layoutLabel(sys, t)}</button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>Each track count keeps its own cut rules.</p>
      </div>
    </div>
  );
}
