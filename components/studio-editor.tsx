"use client";
/**
 * One system, edited by the shop: its parts and sections, its cut rules,
 * teaching from a real window, and a try-out cut list.
 */
import { useMemo, useState } from "react";
import type { Um } from "../lib/engine/units";
import { packAllSections, summarize } from "../lib/engine/cutting";
import { getSection } from "../lib/engine/sections";
import type {
  PartDef, PartScope, ProfileDef, ProfileKind, SizeCase, StudioSystem, TaughtJob,
} from "../lib/studio/model";
import { PROFILE_KINDS } from "../lib/studio/model";
import { evaluate, StudioUnknownError, type StudioJob, type StudioResult } from "../lib/studio/evaluate";
import { teach, check, type TeachResult, type CheckRow } from "../lib/studio/teach";
import { PART_KIND } from "../lib/studio/templates";
import { allProfiles, findProfile, newId, type StudioLibrary } from "../lib/studio/store";
import {
  fmtLen, fmtDelta, readLen, lenToInput, STATUS_TEXT, MIXES, mixText, ruleText, whenText, type StudioUnit,
} from "../lib/studio/format";
import { Badge, Seg, Sheet, Field, SectionTitle, Toggle, SlidingThumb } from "./studio-ui";

type Tab = "parts" | "cuts" | "teach" | "try";

const SCOPE_TITLE: Record<PartScope, string> = {
  window: "Frame",
  shutter: "Each shutter",
  meeting: "Where two glass shutters meet",
};

/** The name a shop sees for a part (without the {s}/{tag}/{k} placeholders). */
export const partName = (p: PartDef) => p.role.replace(/\{s\}\s*/g, "").replace(/\{tag\}/g, "").replace(/\s*\{k\}/g, "").trim();

function roleFrom(name: string, scope: PartScope): string {
  const n = name.trim() || "Piece";
  return scope === "shutter" ? `{s} ${n}{tag}` : scope === "meeting" ? `${n} {k}` : n;
}

const SIZE_BASE_LABEL = (sys: StudioSystem, id: string) =>
  id === "W" ? "W" : id === "H" ? "H" : sys.sizes.find((s) => s.id === id)?.label ?? id;

/** What the shop should do next, in one line. */
export function nextStep(sys: StudioSystem): { text: string; tab: Tab; tone: "good" | "warn" | "bad" } {
  const lay = sys.layouts[0];
  const mix = lay?.mixes[0] ?? "GG";
  const r = evaluate(sys, { id: "W1", W: 1219200, H: 1219200, qty: 1, tracks: lay?.tracks ?? 2, mix }, { allowUnknown: true });
  const sections = r.missing.filter((m) => m.startsWith("Section for"));
  if (sections.length) return { text: `Choose ${sections.length === 1 ? "a section" : `${sections.length} sections`} for your parts`, tab: "parts", tone: "bad" };
  if (r.missing.length) return { text: `${r.missing.length} cut${r.missing.length > 1 ? "s" : ""} not known yet. Teach from one window you made.`, tab: "teach", tone: "warn" };
  if (sys.jobs.length === 0) return { text: "Ready. Check it once against a window you made.", tab: "teach", tone: "good" };
  if (sys.status === "teaching") return { text: "Learned from your window. Check it with a second window.", tab: "teach", tone: "warn" };
  return { text: "Ready to use.", tab: "try", tone: "good" };
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
  const [tab, setTab] = useState<Tab>("parts");
  const [menu, setMenu] = useState(false);
  const step = useMemo(() => nextStep(sys), [sys]);
  const tone = step.tone === "good" ? "var(--good)" : step.tone === "warn" ? "var(--warn)" : "var(--bad)";
  const toneBg = step.tone === "good" ? "var(--good-soft)" : step.tone === "warn" ? "var(--warn-soft)" : "var(--bad-soft)";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← My systems</button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="btn-ghost px-3 py-1.5 text-sm" aria-haspopup="menu">More</button>
          {menu && (
            <div role="menu" className="card absolute right-0 z-20 mt-1 w-44 overflow-hidden p-1" style={{ boxShadow: "var(--shadow-lg)" }}>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => { setMenu(false); onDuplicate(); }}>Duplicate</button>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--bad)" }}
                onClick={() => { setMenu(false); if (window.confirm(`Delete "${sys.name}"? This cannot be undone.`)) onDelete(); }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <input value={sys.name} onChange={(e) => onChange({ ...sys, name: e.target.value })} aria-label="System name"
        className="mt-3 w-full bg-transparent text-2xl font-bold tracking-tight outline-none" />
      <p className="text-sm" style={{ color: "var(--ink-3)" }}>{sys.blurb}</p>

      <button onClick={() => setTab(step.tab)} className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold"
        style={{ background: toneBg, color: tone }}>
        <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] text-white" style={{ background: tone }}>
          {step.tone === "good" ? "✓" : "!"}
        </span>
        {step.text}
      </button>

      <div className="sticky top-0 z-10 -mx-4 mt-4 px-4 py-2" style={{ background: "var(--bg)" }}>
        <div className="grid grid-cols-4 gap-1 rounded-xl p-1" style={{ background: "var(--surface-3)" }} role="tablist">
          {([["parts", "Parts"], ["cuts", "Cut rules"], ["teach", "Teach"], ["try", "Try"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className="rounded-lg py-2 text-sm font-semibold"
              style={{ background: tab === id ? "var(--surface)" : "transparent", color: tab === id ? "var(--ink)" : "var(--ink-3)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "parts" && <PartsTab sys={sys} lib={lib} unit={unit} onChange={onChange} onAddProfile={onAddProfile} />}
      {tab === "cuts" && <CutsTab sys={sys} unit={unit} onChange={onChange} />}
      {tab === "teach" && <TeachTab sys={sys} lib={lib} unit={unit} onChange={onChange} />}
      {tab === "try" && <TryTab sys={sys} lib={lib} unit={unit} />}
    </div>
  );
}

/* ———————————————————— Parts ———————————————————— */

function PartsTab({ sys, lib, unit, onChange, onAddProfile }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit;
  onChange: (s: StudioSystem) => void; onAddProfile: (p: ProfileDef) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ partId: string; slot: "main" | "mesh" | "alt"; idx?: number } | null>(null);

  const setPart = (id: string, patch: Partial<PartDef>) =>
    onChange({ ...sys, parts: sys.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const tracksOn = new Set(sys.layouts.map((l) => l.tracks));
  const toggleTracks = (t: number) => {
    const layouts = tracksOn.has(t)
      ? sys.layouts.filter((l) => l.tracks !== t)
      : [...sys.layouts, { tracks: t, mixes: MIXES[t] }].sort((a, b) => a.tracks - b.tracks);
    if (layouts.length) onChange({ ...sys, layouts });
  };

  const addPart = (scope: PartScope) => {
    const id = newId("p");
    const length = sys.sizes[0]?.id ?? "W";
    onChange({ ...sys, parts: [...sys.parts, { id, role: roleFrom("New piece", scope), profile: [{ id: "" }], scope, count: 1, length, angle: 90 }] });
    setOpen(id);
  };

  const choose = (profileId: string) => {
    if (!picker) return;
    const p = sys.parts.find((x) => x.id === picker.partId)!;
    if (picker.slot === "mesh") setPart(p.id, { meshProfile: profileId });
    else if (picker.slot === "main") {
      const alts = altChoices(sys, p);
      if (alts) setAlternatives(p, [profileId, ...alts.filter((a) => a !== profileId).slice(1)]);
      else if (picker.idx !== undefined && p.profile.length > 1) setPart(p.id, { profile: p.profile.map((c, i) => (i === picker.idx ? { ...c, id: profileId } : c)) });
      else setPart(p.id, { profile: [{ id: profileId }] });
    } else {
      const current = altChoices(sys, p) ?? [p.profile[p.profile.length - 1]?.id ?? ""];
      if (!current.includes(profileId)) setAlternatives(p, [...current.filter(Boolean), profileId]);
    }
    setPicker(null);
  };

  /** Two or more sections for one part (e.g. slim interlock small / big): a choice the shop makes per window. */
  const setAlternatives = (p: PartDef, ids: string[]) => {
    const swId = `pick_${p.id}`;
    const others = sys.switches.filter((s) => s.id !== swId);
    if (ids.length <= 1) {
      onChange({ ...sys, switches: others, parts: sys.parts.map((x) => (x.id === p.id ? { ...x, profile: [{ id: ids[0] ?? "" }] } : x)) });
      return;
    }
    const sw = {
      id: swId, label: partName(p), default: ids[0],
      options: ids.map((id) => ({ value: id, label: findProfile(lib, id)?.name ?? id })),
    };
    onChange({
      ...sys, switches: [...others, sw],
      parts: sys.parts.map((x) => (x.id === p.id ? { ...x, profile: [...ids.map((id) => ({ when: { [swId]: id }, id })), { id: ids[0] }] } : x)),
    });
  };

  const scopes: PartScope[] = sys.family === "domal-type" ? ["window", "shutter", "meeting"] : ["window", "shutter", "meeting"];
  const pickerPart = picker ? sys.parts.find((p) => p.id === picker.partId) : undefined;

  return (
    <div>
      <SectionTitle>Tracks this system makes</SectionTitle>
      <div className="card p-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <button key={t} onClick={() => toggleTracks(t)} aria-pressed={tracksOn.has(t)}
              className={`chip px-3.5 py-2 text-sm ${tracksOn.has(t) ? "selected" : ""}`}>{t}-track</button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
          Each track count gets its own cut rules. FabriQ only cuts the ones you teach or that are already known.
        </p>
      </div>

      {scopes.map((scope) => {
        const list = sys.parts.filter((p) => p.scope === scope);
        return (
          <div key={scope}>
            <SectionTitle aside={<button onClick={() => addPart(scope)} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>+ Add piece</button>}>
              {SCOPE_TITLE[scope]}
            </SectionTitle>
            {list.length === 0 && <div className="card px-4 py-3 text-sm" style={{ color: "var(--ink-3)" }}>No pieces here.</div>}
            <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
              {list.map((p) => (
                <PartRow key={p.id} p={p} sys={sys} lib={lib} unit={unit} open={open === p.id}
                  onToggleOpen={() => setOpen(open === p.id ? null : p.id)}
                  onChange={(patch) => setPart(p.id, patch)}
                  onPick={(slot, idx) => setPicker({ partId: p.id, slot, idx })}
                  onRemoveAlt={(id) => { const a = altChoices(sys, p) ?? []; setAlternatives(p, a.filter((x) => x !== id)); }}
                  onDelete={() => { setOpen(null); onChange({ ...sys, parts: sys.parts.filter((x) => x.id !== p.id), switches: sys.switches.filter((s) => s.id !== `pick_${p.id}`) }); }} />
              ))}
            </div>
          </div>
        );
      })}

      {picker && pickerPart && (
        <SectionPicker lib={lib} kind={kindFor(sys, lib, pickerPart, picker.slot)} title={picker.slot === "alt" ? `Another section for ${partName(pickerPart)}` : `Section for ${partName(pickerPart)}${picker.slot === "mesh" ? " (mesh shutter)" : ""}`}
          onPick={choose} onAdd={(prof) => { onAddProfile(prof); choose(prof.id); }} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

function altChoices(sys: StudioSystem, p: PartDef): string[] | null {
  const sw = sys.switches.find((s) => s.id === `pick_${p.id}`);
  return sw ? sw.options.map((o) => o.value) : null;
}

function kindFor(sys: StudioSystem, lib: StudioLibrary, p: PartDef, slot: "main" | "mesh" | "alt"): ProfileKind | undefined {
  if (slot === "mesh") return "mesh-shutter";
  const current = findProfile(lib, p.profile[p.profile.length - 1]?.id ?? "");
  return current?.kind ?? PART_KIND[p.id];
}

function PartRow({ p, sys, lib, unit, open, onToggleOpen, onChange, onPick, onRemoveAlt, onDelete }: {
  p: PartDef; sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; open: boolean;
  onToggleOpen: () => void; onChange: (patch: Partial<PartDef>) => void;
  onPick: (slot: "main" | "mesh" | "alt", idx?: number) => void; onRemoveAlt: (id: string) => void; onDelete: () => void;
}) {
  const on = p.enabled !== false;
  const alts = altChoices(sys, p);
  const mainId = alts ? alts[0] : p.profile[p.profile.length - 1]?.id ?? "";
  const prof = findProfile(lib, mainId);
  /** Different sections by track count (e.g. Domal frame 2051 for 2-track, 2062 for 3-track). */
  const byTrack = !alts && p.profile.length > 1;
  const codes = p.profile.map((c) => { const x = findProfile(lib, c.id); return x?.codes ? Object.values(x.codes)[0] : x?.name; }).filter((x, i, a) => x && a.indexOf(x) === i);
  const sizeLabel = SIZE_BASE_LABEL(sys, p.length);
  const code = prof?.codes ? Object.values(prof.codes)[0] : undefined;

  return (
    <div className="px-3 py-3" style={{ opacity: on ? 1 : 0.55 }}>
      <div className="flex items-center gap-3">
        <Toggle on={on} onChange={(v) => onChange({ enabled: v })} label={`Use ${partName(p)}`} />
        <button onClick={onToggleOpen} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{partName(p)}</span>
            {p.count > 1 && <span className="text-xs font-bold" style={{ color: "var(--ink-3)" }}>×{p.count}</span>}
          </div>
          <div className="mt-0.5 truncate text-xs" style={{ color: "var(--ink-3)" }}>
            {byTrack ? `${prof?.name.replace(/\s*\d-Track\s*/i, " ") ?? ""} · ${codes.join(" / ")}` : prof ? `${prof.name}${code ? ` · ${code}` : ""}` : <span style={{ color: "var(--bad)", fontWeight: 600 }}>Choose a section</span>}
            {alts && alts.length > 1 ? ` · +${alts.length - 1} more` : ""} · {sizeLabel} · {p.angle}°
          </div>
        </button>
        <span aria-hidden className="text-lg" style={{ color: "var(--ink-3)" }}>{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <Field label="Name">
            <input className="field px-3 py-2" value={partName(p)} onChange={(e) => onChange({ role: roleFrom(e.target.value, p.scope) })} />
          </Field>

          <Field label={alts ? "Sections (the shop picks one per window)" : byTrack ? "Section by track count" : "Section"}>
            <div className="flex flex-col gap-1.5">
              {byTrack && p.profile.map((c, i) => {
                const pr = findProfile(lib, c.id);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{c.when ? whenText(sys, c.when) : "Others"}</span>
                    <button onClick={() => onPick("main", i)} className="dim-input flex-1 px-3 py-2 text-left text-sm">
                      {pr ? <><b>{pr.name}</b>{pr.codes ? ` · ${Object.values(pr.codes).join(" / ")}` : ""}</> : <span style={{ color: "var(--bad)" }}>Choose a section</span>}
                    </button>
                  </div>
                );
              })}
              {!byTrack && (alts ?? [mainId]).map((id, i) => {
                const pr = findProfile(lib, id);
                return (
                  <div key={id || i} className="flex items-center gap-2">
                    <button onClick={() => onPick("main")} disabled={i > 0}
                      className="dim-input flex-1 px-3 py-2 text-left text-sm">
                      {pr ? <><b>{pr.name}</b>{pr.size ? ` · ${pr.size}` : ""}{pr.codes ? ` · ${Object.values(pr.codes).join(" / ")}` : ""}</> : <span style={{ color: "var(--bad)" }}>Choose a section</span>}
                    </button>
                    {alts && <button onClick={() => onRemoveAlt(id)} aria-label="Remove this choice" className="px-2 text-lg" style={{ color: "var(--ink-3)" }}>×</button>}
                  </div>
                );
              })}
              {!byTrack && (
                <>
                  <button onClick={() => onPick("alt")} className="self-start text-sm font-semibold" style={{ color: "var(--accent)" }}>
                    + Another section choice
                  </button>
                  <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                    E.g. slim interlock small and big. You pick which one on each window.
                  </span>
                </>
              )}
              {!alts && sys.layouts.length > 1 && sys.layouts.filter((l) => !p.profile.some((c) => c.when?.tracks === String(l.tracks) || (Array.isArray(c.when?.tracks) && c.when.tracks.includes(String(l.tracks))))).slice(0, 1).map((l) => (
                <button key={l.tracks} className="self-start text-sm font-semibold" style={{ color: "var(--accent)" }}
                  onClick={() => onChange({ profile: [{ when: { tracks: String(l.tracks) }, id: mainId }, ...p.profile] })}>
                  + Different section for {l.tracks}-track
                </button>
              ))}
            </div>
          </Field>

          {p.scope === "shutter" && (
            <Field label="On mesh shutters">
              <button onClick={() => onPick("mesh")} className="dim-input px-3 py-2 text-left text-sm">
                {p.meshProfile ? findProfile(lib, p.meshProfile)?.name ?? p.meshProfile : "Same section as glass"}
              </button>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pieces">
              <div className="flex items-center gap-2">
                <button className="btn-ghost h-9 w-9" onClick={() => onChange({ count: Math.max(1, p.count - 1) })} aria-label="Fewer">−</button>
                <span className="w-6 text-center font-bold tabnum">{p.count}</span>
                <button className="btn-ghost h-9 w-9" onClick={() => onChange({ count: Math.min(8, p.count + 1) })} aria-label="More">+</button>
              </div>
            </Field>
            <Field label="Cut angle">
              <Seg value={p.angle} onChange={(v) => onChange({ angle: v })} options={[{ value: 90, label: "90°" }, { value: 45, label: "45°" }]} />
            </Field>
          </div>

          <Field label="Cut to" hint={`How long: ${sizeLabel}. Change the rule under Cut rules.`}>
            <select className="field px-3 py-2" value={p.length} onChange={(e) => onChange({ length: e.target.value })}>
              {sys.sizes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>

          <button onClick={onDelete} className="self-start text-sm font-semibold" style={{ color: "var(--bad)" }}>Remove this piece</button>
          <span className="sr-only">{unit}</span>
        </div>
      )}
    </div>
  );
}

/* ———————————————————— Section picker / new section ———————————————————— */

function SectionPicker({ lib, kind, title, onPick, onAdd, onClose }: {
  lib: StudioLibrary; kind?: ProfileKind; title: string;
  onPick: (id: string) => void; onAdd: (p: ProfileDef) => void; onClose: () => void;
}) {
  const [all, setAll] = useState(!kind);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const list = allProfiles(lib)
    .filter((p) => all || !kind || p.kind === kind)
    .filter((p) => !q || `${p.name} ${Object.values(p.codes ?? {}).join(" ")} ${p.size}`.toLowerCase().includes(q.toLowerCase()));

  if (adding) return <Sheet title="New section" sub="From your catalogue or dealer bill. Only the name is needed." onClose={onClose}>
    <ProfileForm initial={{ kind }} onSave={(p) => onAdd(p)} onCancel={() => setAdding(false)} />
  </Sheet>;

  return (
    <Sheet title={title} onClose={onClose}>
      <input className="field w-full px-3 py-2.5" placeholder="Search name, code or size" value={q} onChange={(e) => setQ(e.target.value)} />
      {kind && (
        <div className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--ink-3)" }}>
          <span>{all ? "Showing all sections" : `Showing: ${PROFILE_KINDS.find((k) => k.id === kind)?.label}`}</span>
          <button className="font-semibold" style={{ color: "var(--accent)" }} onClick={() => setAll(!all)}>{all ? "Only matching" : "Show all"}</button>
        </div>
      )}
      <div className="mt-3 flex flex-col gap-1.5">
        {list.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} className="card flex items-center justify-between gap-3 px-3 py-2.5 text-left">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                {[p.codes ? Object.entries(p.codes).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "", p.size, `${p.stockFt.join("/")} ft`].filter(Boolean).join(" · ")}
              </span>
            </span>
            {p.mine && <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Yours</span>}
          </button>
        ))}
        {list.length === 0 && <p className="py-4 text-center text-sm" style={{ color: "var(--ink-3)" }}>No section found.</p>}
      </div>
      <button onClick={() => setAdding(true)} className="btn-primary mt-4 w-full py-3">+ Add a new section</button>
    </Sheet>
  );
}

export function ProfileForm({ initial, onSave, onCancel }: {
  initial: Partial<ProfileDef>; onSave: (p: ProfileDef) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [maker, setMaker] = useState(initial.codes ? Object.keys(initial.codes)[0] ?? "" : "");
  const [code, setCode] = useState(initial.codes ? Object.values(initial.codes)[0] ?? "" : "");
  const [kind, setKind] = useState<ProfileKind>(initial.kind ?? "other");
  const [size, setSize] = useState(initial.size ?? "");
  const [kg, setKg] = useState(initial.kg ? String(initial.kg.value) : "");
  const [kgPer, setKgPer] = useState(initial.kg ? String(initial.kg.perFt) : "16");
  const [stock, setStock] = useState<number[]>(initial.stockFt?.length ? initial.stockFt : [16]);
  const [other, setOther] = useState("");

  const toggleStock = (ft: number) => setStock((s) => (s.includes(ft) ? (s.length > 1 ? s.filter((x) => x !== ft) : s) : [...s, ft]));
  const save = () => {
    const extra = parseFloat(other);
    const stockFt = [...new Set([...stock, ...(extra > 0 && extra <= 30 ? [extra] : [])])];
    onSave({
      id: initial.mine && initial.id ? initial.id : `my-${Date.now().toString(36)}`,
      name: name.trim(), kind, mine: true,
      codes: code.trim() ? { [maker.trim().toLowerCase() || "code"]: code.trim() } : undefined,
      size: size.trim() || undefined,
      kg: parseFloat(kg) > 0 ? { value: parseFloat(kg), perFt: parseFloat(kgPer) || 16 } : undefined,
      stockFt,
      source: { status: "suggested", source: "Entered by you" },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Name"><input className="field px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slim interlock big" autoFocus /></Field>
      <Field label="What is it">
        <select className="field px-3 py-2.5" value={kind} onChange={(e) => setKind(e.target.value as ProfileKind)}>
          {PROFILE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company"><input className="field px-3 py-2.5" value={maker} onChange={(e) => setMaker(e.target.value)} placeholder="Jindal" /></Field>
        <Field label="Code"><input className="field px-3 py-2.5" value={code} onChange={(e) => setCode(e.target.value)} placeholder="2051" /></Field>
      </div>
      <Field label="Size (mm)" hint="Width × height, as the catalogue prints it"><input className="field px-3 py-2.5" value={size} onChange={(e) => setSize(e.target.value)} placeholder="45×45" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight (kg)"><input className="field px-3 py-2.5" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="3.2" /></Field>
        <Field label="per (feet)" hint="The length the catalogue weight is for"><input className="field px-3 py-2.5" inputMode="decimal" value={kgPer} onChange={(e) => setKgPer(e.target.value)} /></Field>
      </div>
      <Field label="Bar lengths you buy" hint="Tick every length your dealer sells for this section">
        <div className="flex flex-wrap items-center gap-2">
          {[12, 15, 16, 20].map((ft) => (
            <button key={ft} type="button" onClick={() => toggleStock(ft)} aria-pressed={stock.includes(ft)}
              className={`chip px-3 py-1.5 text-sm ${stock.includes(ft) ? "selected" : ""}`}>{ft} ft</button>
          ))}
          <input className="field w-20 px-2 py-1.5 text-sm" inputMode="decimal" placeholder="Other" value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
      </Field>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn-ghost py-3" onClick={onCancel}>Cancel</button>
        <button className="btn-primary py-3" disabled={!name.trim()} onClick={save}>Save section</button>
      </div>
    </div>
  );
}

/* ———————————————————— Cut rules ———————————————————— */

function CutsTab({ sys, unit, onChange }: { sys: StudioSystem; unit: StudioUnit; onChange: (s: StudioSystem) => void }) {
  const [edit, setEdit] = useState<{ size: string; idx: number } | null>(null);
  const used = new Set(sys.parts.filter((p) => p.enabled !== false).map((p) => p.length).concat([sys.infill.w, sys.infill.h]));

  const setCase = (sizeId: string, idx: number, c: SizeCase | null) =>
    onChange({
      ...sys,
      version: sys.version + 1,
      sizes: sys.sizes.map((s) => (s.id !== sizeId ? s : { ...s, cases: c ? s.cases.map((x, i) => (i === idx ? c : x)) : s.cases.filter((_, i) => i !== idx) })),
    });

  const addTrackRule = (sizeId: string, tracks: number) => {
    const s = sys.sizes.find((x) => x.id === sizeId)!;
    const base = s.cases[s.cases.length - 1];
    const c: SizeCase = { ...base, when: { tracks: String(tracks) }, add: null, evidence: { status: "unknown", source: "" } };
    onChange({ ...sys, sizes: sys.sizes.map((x) => (x.id === sizeId ? { ...x, cases: [c, ...x.cases] } : x)) });
    setEdit({ size: sizeId, idx: 0 });
  };

  return (
    <div>
      <p className="mt-4 text-sm" style={{ color: "var(--ink-2)" }}>
        Every cut is worked out from the window size. You do not need to type these — <b>Teach</b> fills them from a window you made.
      </p>
      {sys.sizes.map((s) => (
        <div key={s.id} className="card mt-3 p-3" style={{ opacity: used.has(s.id) ? 1 : 0.6 }}>
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">{s.label}</div>
            {!used.has(s.id) && <span className="text-xs" style={{ color: "var(--ink-3)" }}>not used</span>}
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {s.cases.map((c, i) => {
              const st = c.add === null ? STATUS_TEXT.unknown : STATUS_TEXT[c.evidence.status];
              return (
                <button key={i} onClick={() => setEdit({ size: s.id, idx: i })} className="rounded-lg px-3 py-2 text-left" style={{ background: "var(--surface-2)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{whenText(sys, c.when)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="mono mt-1 text-[15px] font-semibold">{ruleText(c, SIZE_BASE_LABEL(sys, c.base), unit)}</div>
                  {c.evidence.source && <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>{c.evidence.source}</div>}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sys.layouts.filter((l) => !s.cases.some((c) => c.when?.tracks === String(l.tracks))).map((l) => (
              <button key={l.tracks} onClick={() => addTrackRule(s.id, l.tracks)} className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                + Different for {l.tracks}-track
              </button>
            ))}
          </div>
        </div>
      ))}
      {edit && (
        <RuleEditor sys={sys} unit={unit} sizeId={edit.size} c={sys.sizes.find((s) => s.id === edit.size)!.cases[edit.idx]}
          canRemove={sys.sizes.find((s) => s.id === edit.size)!.cases.length > 1}
          onSave={(c) => { setCase(edit.size, edit.idx, c); setEdit(null); }}
          onRemove={() => { setCase(edit.size, edit.idx, null); setEdit(null); }}
          onClose={() => setEdit(null)} />
      )}
    </div>
  );
}

function RuleEditor({ sys, unit, sizeId, c, canRemove, onSave, onRemove, onClose }: {
  sys: StudioSystem; unit: StudioUnit; sizeId: string; c: SizeCase; canRemove: boolean;
  onSave: (c: SizeCase) => void; onRemove: () => void; onClose: () => void;
}) {
  const idx = sys.sizes.findIndex((s) => s.id === sizeId);
  const bases = ["W", "H", ...sys.sizes.slice(0, idx).map((s) => s.id)];
  const [base, setBase] = useState(c.base);
  const [den, setDen] = useState(c.den ?? 1);
  const [preSign, setPreSign] = useState<1 | -1>((c.pre ?? 0) < 0 ? -1 : 1);
  const [pre, setPre] = useState(c.pre ? lenToInput(Math.abs(c.pre), unit) : "");
  const [addSign, setAddSign] = useState<1 | -1>((c.add ?? -1) < 0 ? -1 : 1);
  const [add, setAdd] = useState(c.add !== null && c.add !== 0 ? lenToInput(Math.abs(c.add), unit) : c.add === 0 ? "0" : "");
  const preV = pre.trim() ? readLen(pre, unit) : 0;
  const addV = add.trim() === "0" ? 0 : add.trim() ? readLen(add, unit) : null;
  const label = sys.sizes[idx]?.label ?? sizeId;
  const draft: SizeCase = {
    ...c, base, den: den === 1 ? undefined : den, pre: preV ? preSign * preV : undefined,
    add: addV === null ? null : addSign * addV, evidence: { status: "suggested", source: "Typed in by you" },
  };

  return (
    <Sheet title={label} sub={`${whenText(sys, c.when)} · lengths in ${unit === "in" ? "inch.sut (58.3 = 58″ 3 sut)" : "mm"}`} onClose={onClose}>
      <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--surface-2)" }}>
        <div className="mono text-lg font-bold">{ruleText(draft, SIZE_BASE_LABEL(sys, base), unit)}</div>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <Field label="Starts from">
          <select className="field px-3 py-2.5" value={base} onChange={(e) => setBase(e.target.value)}>
            {bases.map((b) => <option key={b} value={b}>{b === "W" ? "Window width (W)" : b === "H" ? "Window height (H)" : SIZE_BASE_LABEL(sys, b)}</option>)}
          </select>
        </Field>
        <Field label="Divide by" hint="2 = half the width (one of two shutters)">
          <Seg value={den} onChange={setDen} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 1 ? "No" : `÷${n}` }))} />
        </Field>
        {den !== 1 && (
          <Field label="Before dividing" hint="The K in (W − K) ÷ N. Leave empty if none.">
            <div className="flex gap-2">
              <Seg value={preSign} onChange={setPreSign} options={[{ value: -1, label: "−" }, { value: 1, label: "+" }]} />
              <input className="field flex-1 px-3 py-2" inputMode="decimal" value={pre} onChange={(e) => setPre(e.target.value)} placeholder="0" />
            </div>
          </Field>
        )}
        <Field label={den !== 1 ? "Then add / take off" : "Add / take off"} hint="Leave empty if you do not know it yet.">
          <div className="flex gap-2">
            <Seg value={addSign} onChange={setAddSign} options={[{ value: -1, label: "−" }, { value: 1, label: "+" }]} />
            <input className="field flex-1 px-3 py-2" inputMode="decimal" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="not known" />
          </div>
        </Field>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {canRemove ? <button className="btn-ghost py-3" style={{ color: "var(--bad)" }} onClick={onRemove}>Remove rule</button> : <button className="btn-ghost py-3" onClick={onClose}>Cancel</button>}
        <button className="btn-primary py-3" disabled={(pre.trim() !== "" && preV === null) || (add.trim() !== "" && addV === null)} onClick={() => onSave(draft)}>Save</button>
      </div>
    </Sheet>
  );
}

/* ———————————————————— Teach / check ———————————————————— */

function LayoutPicker({ sys, tracks, mix, switches, onChange }: {
  sys: StudioSystem; tracks: number; mix: string; switches: Record<string, string>;
  onChange: (v: { tracks: number; mix: string; switches: Record<string, string> }) => void;
}) {
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {sys.layouts.map((l) => (
          <button key={l.tracks} onClick={() => onChange({ tracks: l.tracks, mix: l.mixes[0], switches })} aria-pressed={l.tracks === tracks}
            className={`chip px-3 py-1.5 text-sm ${l.tracks === tracks ? "selected" : ""}`}>{l.tracks}-track</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(lay?.mixes ?? []).map((m) => (
          <button key={m} onClick={() => onChange({ tracks, mix: m, switches })} aria-pressed={m === mix}
            className={`chip flex flex-col items-center gap-1 px-2 py-2 ${m === mix ? "selected" : ""}`}>
            <span className="h-10 w-16"><SlidingThumb mix={m} domal={sys.family === "domal-type"} /></span>
            <span className="text-[11px] leading-tight">{mixText(m)}</span>
          </button>
        ))}
      </div>
      {sys.switches.map((sw) => (
        <Field key={sw.id} label={sw.label}>
          <select className="field px-3 py-2" value={switches[sw.id] ?? sw.default}
            onChange={(e) => onChange({ tracks, mix, switches: { ...switches, [sw.id]: e.target.value } })}>
            {sw.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      ))}
    </div>
  );
}

function TeachTab({ sys, lib, unit, onChange }: { sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; onChange: (s: StudioSystem) => void }) {
  const [mode, setMode] = useState<"teach" | "check">(sys.jobs.length ? "check" : "teach");
  const [layout, setLayout] = useState({ tracks: sys.layouts[0]?.tracks ?? 2, mix: sys.layouts[0]?.mixes[0] ?? "GG", switches: {} as Record<string, string> });
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [gw, setGw] = useState("");
  const [gh, setGh] = useState("");
  const [taught, setTaught] = useState<TeachResult | null>(null);
  const [checked, setChecked] = useState<{ rows: CheckRow[]; allOk: boolean } | null>(null);

  // One box per cut size (handle and interlock share one), in cutting order.
  const kinds = [...layout.mix];
  const rows = sys.sizes.map((s) => ({
    size: s,
    parts: sys.parts.filter((p) => p.enabled !== false && p.length === s.id &&
      (p.scope !== "shutter" || kinds.length > 0) && (p.scope !== "meeting" || kinds.filter((k) => k !== "J").length > 1)),
  })).filter((r) => r.parts.length > 0);

  const W = readLen(w, unit === "mm" ? "mm" : "in"), H = readLen(h, unit === "mm" ? "mm" : "in");
  const ready = W !== null && H !== null && (rows.some((r) => readLen(vals[r.size.id] ?? "", unit) !== null) || readLen(gw, unit) !== null);

  const submit = () => {
    if (W === null || H === null) return;
    const measured: Record<string, Um> = {};
    for (const r of rows) { const v = readLen(vals[r.size.id] ?? "", unit); if (v !== null) measured[r.parts[0].id] = v; }
    const gW = readLen(gw, unit), gH = readLen(gh, unit);
    const job: TaughtJob = {
      id: `J${sys.jobs.length + 1}`, W, H, tracks: layout.tracks, mix: layout.mix, switches: layout.switches, measured,
      glass: gW !== null || gH !== null ? { w: gW ?? undefined, h: gH ?? undefined } : undefined, at: new Date().toISOString(),
    };
    if (mode === "teach") {
      const r = teach(sys, job);
      setTaught(r); setChecked(null);
      onChange(r.system);
    } else {
      const r = check(sys, job);
      setChecked(r); setTaught(null);
      if (r.allOk) onChange(r.system);
    }
  };
  const reset = () => { setVals({}); setW(""); setH(""); setGw(""); setGh(""); setTaught(null); setChecked(null); };

  return (
    <div>
      <div className="mt-4 flex justify-center">
        <Seg value={mode} onChange={(m) => { setMode(m); setTaught(null); setChecked(null); }}
          options={[{ value: "teach", label: "Teach" }, { value: "check", label: "Check" }]} />
      </div>
      <p className="mt-3 text-center text-sm" style={{ color: "var(--ink-2)" }}>
        {mode === "teach"
          ? "Take a window you already made. Type its size and the cuts you made. FabriQ learns your way."
          : "Take another window you made. FabriQ shows what it would cut and compares it with your cuts."}
      </p>

      {taught && <TeachSummary r={taught} unit={unit} onNext={() => { reset(); setMode("check"); }} />}
      {checked && <CheckSummary r={checked} unit={unit} onAgain={reset} />}

      {!taught && !checked && (
        <>
          <SectionTitle>Window</SectionTitle>
          <div className="card p-3">
            <LayoutPicker sys={sys} {...layout} onChange={setLayout} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={`Width (${unit === "mm" ? "mm" : "inch.sut"})`}><input className="field px-3 py-2.5 text-lg font-semibold" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder={unit === "mm" ? "1829" : "72"} /></Field>
              <Field label={`Height (${unit === "mm" ? "mm" : "inch.sut"})`}><input className="field px-3 py-2.5 text-lg font-semibold" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} placeholder={unit === "mm" ? "1524" : "60"} /></Field>
            </div>
          </div>

          <SectionTitle>Your cuts on this window</SectionTitle>
          <p className="-mt-1 mb-2 text-xs" style={{ color: "var(--ink-3)" }}>Fill the ones you know. Leave the rest empty.</p>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {rows.map((r) => (
              <label key={r.size.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.size.label}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                    {r.parts.map((p) => findProfile(lib, p.profile[p.profile.length - 1]?.id ?? "")?.name ?? partName(p)).filter((x, i, a) => a.indexOf(x) === i).join(", ")}
                  </span>
                </span>
                <input className="field w-28 px-3 py-2 text-right font-semibold" inputMode="decimal" value={vals[r.size.id] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [r.size.id]: e.target.value }))} placeholder="—" />
              </label>
            ))}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 text-sm font-semibold">Glass width × height</span>
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gw} onChange={(e) => setGw(e.target.value)} placeholder="—" aria-label="Glass width" />
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gh} onChange={(e) => setGh(e.target.value)} placeholder="—" aria-label="Glass height" />
            </div>
          </div>
          <button className="btn-primary mt-4 w-full py-3.5" disabled={!ready} onClick={submit}>
            {mode === "teach" ? "Learn from this window" : "Compare"}
          </button>
        </>
      )}

      {sys.jobs.length > 0 && (
        <>
          <SectionTitle>Windows FabriQ learned from</SectionTitle>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {sys.jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-semibold">{fmtLen(j.W, unit)} × {fmtLen(j.H, unit)}</span>
                <span style={{ color: "var(--ink-3)" }}>{j.tracks}-track · {mixText(j.mix)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeachSummary({ r, unit, onNext }: { r: TeachResult; unit: StudioUnit; onNext: () => void }) {
  return (
    <div className="card mt-4 p-4">
      <div className="text-lg font-bold">FabriQ learned your way</div>
      <div className="mt-3 flex flex-col gap-2">
        {r.learned.map((l) => (
          <div key={l.size} className="flex items-center justify-between gap-2 text-sm">
            <span>{l.label}</span>
            <span className="flex items-center gap-2">
              <span className="mono font-semibold">{fmtDelta(l.constant, unit)}</span>
              <Badge tone={l.changed ? "warn" : "good"}>{l.changed ? "New" : "Same as before"}</Badge>
            </span>
          </div>
        ))}
        {r.skipped.map((s) => <div key={s.label} className="text-sm" style={{ color: "var(--warn)" }}>{s.label}: {s.why}</div>)}
        {r.conflicts.map((c) => <div key={c} className="text-sm" style={{ color: "var(--bad)" }}>{c}. Measure again.</div>)}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
        Each number is what you add or take off (window size, or shutter size for glass). One more window will confirm it.
      </p>
      <button className="btn-primary mt-4 w-full py-3" onClick={onNext}>Check with another window</button>
    </div>
  );
}

function CheckSummary({ r, unit, onAgain }: { r: { rows: CheckRow[]; allOk: boolean }; unit: StudioUnit; onAgain: () => void }) {
  return (
    <div className="card mt-4 p-4">
      <div className="text-lg font-bold" style={{ color: r.allOk ? "var(--good)" : "var(--bad)" }}>
        {r.allOk ? "Matches your cuts" : "Some cuts do not match"}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {r.rows.map((x) => (
          <div key={x.label} className="rounded-lg px-3 py-2 text-sm" style={{ background: x.ok ? "var(--good-soft)" : "var(--bad-soft)" }}>
            <div className="flex justify-between font-semibold"><span>{x.label}</span><span>{x.ok ? "✓" : "✗"}</span></div>
            <div className="mt-0.5 flex justify-between text-xs" style={{ color: "var(--ink-2)" }}>
              <span>FabriQ: {x.predicted === null ? "not known" : fmtLen(x.predicted, unit)}</span>
              <span>You: {fmtLen(x.measured, unit)}{x.diff ? ` (${fmtDelta(x.diff, unit)})` : ""}</span>
            </div>
          </div>
        ))}
      </div>
      {!r.allOk && <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>Measure the red ones again. If they really are different, teach from this window instead.</p>}
      <button className="btn-ghost mt-4 w-full py-3" onClick={onAgain}>{r.allOk ? "Check another window" : "Try again"}</button>
    </div>
  );
}

/* ———————————————————— Try ———————————————————— */

function TryTab({ sys, lib, unit }: { sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit }) {
  const [layout, setLayout] = useState({ tracks: sys.layouts[0]?.tracks ?? 2, mix: sys.layouts[0]?.mixes[0] ?? "GG", switches: {} as Record<string, string> });
  const [w, setW] = useState(unit === "mm" ? "1829" : "72");
  const [h, setH] = useState(unit === "mm" ? "1524" : "60");
  const [why, setWhy] = useState(false);
  const W = readLen(w, unit === "mm" ? "mm" : "in"), H = readLen(h, unit === "mm" ? "mm" : "in");

  const out = useMemo((): { r?: StudioResult; missing?: string[]; err?: string } => {
    if (W === null || H === null) return {};
    const job: StudioJob = { id: "W1", W, H, qty: 1, ...layout };
    try { return { r: evaluate(sys, job) }; }
    catch (e) {
      if (e instanceof StudioUnknownError) return { missing: e.missing, r: evaluate(sys, job, { allowUnknown: true }) };
      return { err: (e as Error).message };
    }
  }, [sys, W, H, layout]);

  const bars = useMemo(() => {
    if (!out.r || out.missing) return [];
    try { return summarize(packAllSections(out.r.pieces)); } catch { return []; }
  }, [out]);

  const groups = useMemo(() => {
    const m = new Map<string, { section: string; name: string; length: Um; angle?: number; count: number }>();
    for (const p of out.r?.pieces ?? []) {
      const name = p.role.replace(/^S\d+\s+/, "").replace(/\s+\d+$/, "");
      const k = `${p.sectionId}|${name}|${p.length}`;
      const g = m.get(k);
      if (g) g.count++; else m.set(k, { section: p.sectionId, name, length: p.length, angle: p.angle, count: 1 });
    }
    return [...m.values()];
  }, [out]);

  return (
    <div>
      <SectionTitle>Window</SectionTitle>
      <div className="card p-3">
        <LayoutPicker sys={sys} {...layout} onChange={setLayout} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label={`Width (${unit === "mm" ? "mm" : "inch.sut"})`}><input className="field px-3 py-2.5 text-lg font-semibold" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} /></Field>
          <Field label={`Height (${unit === "mm" ? "mm" : "inch.sut"})`}><input className="field px-3 py-2.5 text-lg font-semibold" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} /></Field>
        </div>
      </div>

      {out.missing && (
        <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
          <div className="font-bold">FabriQ will not guess these yet</div>
          <ul className="mt-1 list-inside list-disc">{out.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          <div className="mt-1" style={{ color: "var(--ink-2)" }}>Choose the sections under Parts, and teach the cuts from one window you made.</div>
        </div>
      )}
      {out.err && <div className="mt-4 text-sm" style={{ color: "var(--bad)" }}>{out.err}</div>}

      {out.r && !out.missing && (
        <>
          <SectionTitle>Cutting list</SectionTitle>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)", background: "var(--surface-2)" }}>
              <span>Piece</span><span className="text-right">Length</span><span className="text-center">Cut</span><span className="text-right">Qty</span>
            </div>
            {[...new Set(groups.map((g) => g.section))].map((sec) => {
              const pr = findProfile(lib, sec);
              const name = pr?.name ?? safeName(sec);
              return (
                <div key={sec} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <div className="px-3 pt-2 text-xs font-bold" style={{ color: "var(--accent)" }}>{name}{pr?.codes ? ` · ${Object.values(pr.codes)[0]}` : ""}</div>
                  {groups.filter((g) => g.section === sec).map((g, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-3 py-1.5 text-sm">
                      <span className="truncate">{g.name}</span>
                      <span className="mono text-right font-semibold">{fmtLen(g.length, unit)}</span>
                      <span className="text-center text-xs font-bold" style={{ color: g.angle === 45 ? "var(--glass)" : "var(--ink-3)" }}>{g.angle ?? 90}°</span>
                      <span className="text-right tabnum font-bold">{g.count}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {out.r.panels.length > 0 && (
            <>
              <SectionTitle>Glass and mesh</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {out.r.panels.map((p) => (
                  <div key={p.kind} className="flex justify-between px-3 py-2 text-sm">
                    <span className="font-semibold">{p.kind === "jali" ? "Mesh" : p.kind === "sheet" ? "Sheet" : "Glass"}</span>
                    <span className="mono">{fmtLen(p.w, unit)} × {fmtLen(p.h, unit)} <b>× {p.count}</b></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {bars.length > 0 && (
            <>
              <SectionTitle>Bars to buy</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {bars.map((b) => {
                  const ft = getSectionSafe(b.sectionId);
                  return (
                    <div key={b.sectionId} className="flex justify-between px-3 py-2 text-sm">
                      <span>{findProfile(lib, b.sectionId)?.name ?? safeName(b.sectionId)}</span>
                      <span className="font-semibold">{b.bars16 ? `${b.bars16} × ${ft} ft` : ""}{b.bars16 && b.bars8 ? " + " : ""}{b.bars8 ? `${b.bars8} × ${ft / 2} ft` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {out.r.hardware.length > 0 && (
            <>
              <SectionTitle>Hardware</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {out.r.hardware.map((x) => (
                  <div key={x.id} className="flex justify-between px-3 py-2 text-sm">
                    <span>{x.name}</span>
                    <span className="font-semibold">{x.unit === "rft" ? `${Math.ceil(x.qty * (1 + sys.wastagePct / 100))} ft` : x.qty}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {out.r && (
        <>
          <button onClick={() => setWhy(!why)} className="mt-5 text-sm font-semibold" style={{ color: "var(--accent)" }} aria-expanded={why}>
            {why ? "Hide" : "Where does each number come from?"}
          </button>
          {why && (
            <div className="card mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
              {out.r.sizes.map((s) => (
                <div key={s.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{s.label}</span>
                    <span className="mono font-semibold">{s.value === null ? "?" : fmtLen(s.value, unit)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--ink-3)" }}>
                    <span className="mono">{s.formula.replace(/(\d+(?:\.\d+)?) mm/g, (_, n) => fmtLen(Math.round(parseFloat(n) * 1000), unit))}</span>
                    <Badge tone={STATUS_TEXT[s.status].tone}>{STATUS_TEXT[s.status].label}</Badge>
                  </div>
                  {s.source && <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>{s.source}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getSectionSafe(id: string): number {
  try { return getSection(id).barLengthFt ?? 16; } catch { return 16; }
}
function safeName(id: string): string {
  try { return getSection(id).name; } catch { return id; }
}
