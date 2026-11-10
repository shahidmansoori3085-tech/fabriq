"use client";
/**
 * System Studio — the shop's own window systems and sections.
 * Everything here is saved on this phone only.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProfileDef, StudioSystem } from "../../lib/studio/model";
import { PROFILE_KINDS } from "../../lib/studio/model";
import { TEMPLATES, BUILT_IN_PROFILES } from "../../lib/studio/templates";
import {
  loadLibrary, saveLibrary, copyTemplate, newId, exportLibrary, importLibrary, type StudioLibrary,
} from "../../lib/studio/store";
import { SYSTEM_STATUS, type StudioUnit } from "../../lib/studio/format";
import StudioEditor, { nextStep, ProfileForm } from "../../components/studio-editor";
import { Badge, Seg, Sheet, SectionTitle } from "../../components/studio-ui";
import WindowDrawing from "../../components/studio-drawing";
import { windowGeometry } from "../../lib/studio/geometry";
import { findProfile } from "../../lib/studio/store";
import { inches } from "../../lib/engine/units";

type View = { kind: "home" } | { kind: "new" } | { kind: "system"; id: string } | { kind: "sections" };
const UNIT_KEY = "fabriq_studio_unit";

const GROUPS: { id: NonNullable<StudioSystem["group"]>; title: string; sub: string }[] = [
  { id: "ready", title: "Ready to use", sub: "Checked on real jobs. Change anything your shop does differently." },
  { id: "domal", title: "Domal type", sub: "One shutter profile goes round. Sections from the catalogues; cuts you teach." },
  { id: "sleek", title: "Sleek and slim interlock", sub: "Interlock or slim interlock picked shutter by shutter." },
  { id: "bombay", title: "Bombay type", sub: "Handle, interlock and bearing shutters." },
  { id: "gulf", title: "Gulf", sub: "Separate bottom track, 90° screwed frame." },
  { id: "special", title: "Special", sub: "" },
  { id: "blank", title: "Start from nothing", sub: "Any other series — choose every section yourself." },
];

/** A small, real drawing of a system (first layout, 5′ × 4′). */
function Thumb({ sys, lib }: { sys: StudioSystem; lib: StudioLibrary }) {
  const lay = sys.layouts[0];
  const g = windowGeometry(sys, { id: "T", W: inches(60), H: inches(48), qty: 1, tracks: lay?.tracks ?? 2, mix: lay?.mixes[0] ?? "GG" }, (id) => findProfile(lib, id));
  return <WindowDrawing g={g} unit="in" pick={null} compact />;
}

export default function StudioPage() {
  const [lib, setLib] = useState<StudioLibrary | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });
  const [unit, setUnit] = useState<StudioUnit>("in");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // localStorage exists only in the browser: read it once after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLib(loadLibrary());
    try { if (localStorage.getItem(UNIT_KEY) === "mm") setUnit("mm"); } catch { /* inch stays */ }
  }, []);

  if (!lib) return <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6" />;

  const commit = (next: StudioLibrary) => { setLib(next); saveLibrary(next); };
  const putSystem = (s: StudioSystem) => commit({ ...lib, systems: lib.systems.map((x) => (x.id === s.id ? s : x)) });
  const addProfile = (p: ProfileDef) => commit({ ...lib, profiles: [...lib.profiles.filter((x) => x.id !== p.id), p] });
  const changeUnit = (u: StudioUnit) => { setUnit(u); try { localStorage.setItem(UNIT_KEY, u); } catch { /* session only */ } };

  const create = (templateId: string) => {
    const s = copyTemplate(templateId);
    commit({ ...lib, systems: [...lib.systems, s] });
    setView({ kind: "system", id: s.id });
    window.scrollTo({ top: 0 });
  };

  const download = () => {
    const blob = new Blob([exportLibrary(lib)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fabriq-systems.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (f: File) => {
    try { commit(importLibrary(lib, await f.text())); window.alert("Systems added."); }
    catch (e) { window.alert((e as Error).message); }
  };

  const current = view.kind === "system" ? lib.systems.find((s) => s.id === view.id) : undefined;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-3">
      {current ? (
        <StudioEditor sys={current} lib={lib} unit={unit} onChange={putSystem} onAddProfile={addProfile}
          onBack={() => setView({ kind: "home" })}
          onDuplicate={() => {
            const c: StudioSystem = { ...structuredClone(current), id: newId("sys"), name: `${current.name} (copy)` };
            commit({ ...lib, systems: [...lib.systems, c] });
            setView({ kind: "system", id: c.id });
          }}
          onDelete={() => { commit({ ...lib, systems: lib.systems.filter((s) => s.id !== current.id) }); setView({ kind: "home" }); }} />
      ) : view.kind === "new" ? (
        <NewSystem lib={lib} onPick={create} onBack={() => setView({ kind: "home" })} />
      ) : view.kind === "sections" ? (
        <Sections lib={lib} onSave={addProfile}
          onRemove={(id) => commit({ ...lib, profiles: lib.profiles.filter((p) => p.id !== id) })}
          onBack={() => setView({ kind: "home" })} />
      ) : (
        <>
          <header className="flex items-center justify-between gap-2">
            <Link href="/" className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← FabriQ</Link>
            <Seg small value={unit} onChange={changeUnit} options={[{ value: "in", label: "inch" }, { value: "mm", label: "mm" }]} />
          </header>
          <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">My systems</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
            Your sections, your pieces, your cuts. Saved on this phone, only for your shop.
          </p>

          <button onClick={() => setView({ kind: "new" })} className="btn-primary mt-5 w-full py-3.5 text-base">+ New system</button>

          <SectionTitle>{lib.systems.length ? "Your systems" : "No systems yet"}</SectionTitle>
          {lib.systems.length === 0 && (
            <div className="card p-4 text-sm" style={{ color: "var(--ink-2)" }}>
              Start from a ready system like Domal 27, then change the sections and cuts to how your shop works.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {lib.systems.map((s) => {
              const st = SYSTEM_STATUS[s.status];
              const n = nextStep(s);
              return (
                <button key={s.id} onClick={() => { setView({ kind: "system", id: s.id }); window.scrollTo({ top: 0 }); }}
                  className="card flex items-center gap-3 p-3 text-left">
                  <span className="w-[76px] shrink-0"><Thumb sys={s} lib={lib} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold">{s.name}</span>
                      <Badge tone={n.tone === "good" ? st.tone : n.tone === "warn" ? "warn" : "bad"}>{n.tone === "good" ? st.label : n.tone === "warn" ? "Learning" : "Set up"}</Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>{n.text}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--ink-3)" }}>
                      {s.layouts.map((l) => `${l.tracks}T`).join(" · ")} · {s.parts.filter((p) => p.enabled !== false).length} pieces
                      {s.jobs.length ? ` · learned from ${s.jobs.length} window${s.jobs.length > 1 ? "s" : ""}` : ""}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
                </button>
              );
            })}
          </div>

          <SectionTitle>Library</SectionTitle>
          <button onClick={() => setView({ kind: "sections" })} className="card flex w-full items-center justify-between p-3 text-left">
            <span>
              <span className="block font-bold">My sections</span>
              <span className="block text-xs" style={{ color: "var(--ink-3)" }}>
                {lib.profiles.length} of yours · {BUILT_IN_PROFILES.length} built-in · sizes, codes, bar lengths
              </span>
            </span>
            <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
          </button>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button className="btn-ghost py-2.5 text-sm" onClick={download} disabled={!lib.systems.length && !lib.profiles.length}>Save to file</button>
            <button className="btn-ghost py-2.5 text-sm" onClick={() => fileRef.current?.click()}>Open a file</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </div>
          <p className="mt-2 text-center text-xs" style={{ color: "var(--ink-3)" }}>
            Move your systems to another phone with a file. Nothing is sent anywhere.
          </p>
        </>
      )}
    </main>
  );
}

function NewSystem({ lib, onPick, onBack }: { lib: StudioLibrary; onPick: (id: string) => void; onBack: () => void }) {
  return (
    <>
      <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← My systems</button>
      <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">New system</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>Pick the closest one. Every piece, section, angle and cut can be changed after.</p>
      {GROUPS.map((g) => {
        const list = TEMPLATES.filter((t) => t.group === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id}>
            <SectionTitle>{g.title}</SectionTitle>
            {g.sub && <p className="-mt-1 mb-2 text-xs" style={{ color: "var(--ink-3)" }}>{g.sub}</p>}
            <div className="grid grid-cols-2 gap-2">
              {list.map((t) => (
                <button key={t.id} onClick={() => onPick(t.id)} className="card flex flex-col gap-2 p-2.5 text-left">
                  <span className="block rounded-lg p-1.5" style={{ background: "var(--surface-2)" }}><Thumb sys={t} lib={lib} /></span>
                  <span className="block text-sm font-bold leading-tight">{t.name}</span>
                  <span className="block text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>{t.blurb}</span>
                  {t.maker && <span className="mt-auto self-start rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}>{t.maker} sections</span>}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Sections({ lib, onSave, onRemove, onBack }: {
  lib: StudioLibrary; onSave: (p: ProfileDef) => void; onRemove: (id: string) => void; onBack: () => void;
}) {
  const [edit, setEdit] = useState<Partial<ProfileDef> | null>(null);
  const [q, setQ] = useState("");
  const match = (p: ProfileDef) => !q || `${p.name} ${Object.values(p.codes ?? {}).join(" ")} ${p.size}`.toLowerCase().includes(q.toLowerCase());
  const row = (p: ProfileDef, mine: boolean) => (
    <button key={p.id} onClick={() => setEdit(mine ? p : { ...p, id: undefined, mine: false, name: `${p.name}` })}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
      <span className="min-w-0">
        <span className="block truncate font-semibold">{p.name}</span>
        <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
          {[PROFILE_KINDS.find((k) => k.id === p.kind)?.label, p.codes ? Object.entries(p.codes).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "", p.size, `${p.stockFt.join("/")} ft`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{mine ? "Edit" : "Copy"}</span>
    </button>
  );
  return (
    <>
      <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← My systems</button>
      <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">My sections</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>Every section you buy: its code, size and the bar lengths your dealer sells.</p>
      <button className="btn-primary mt-5 w-full py-3.5" onClick={() => setEdit({})}>+ Add a section</button>
      <input className="field mt-4 w-full px-3 py-2.5" placeholder="Search name, code or size" value={q} onChange={(e) => setQ(e.target.value)} />
      <SectionTitle>Yours</SectionTitle>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
        {lib.profiles.filter(match).map((p) => row(p, true))}
        {lib.profiles.length === 0 && <div className="px-3 py-3 text-sm" style={{ color: "var(--ink-3)" }}>None yet. Add one, or copy a built-in one to change it.</div>}
      </div>
      <SectionTitle>Built-in</SectionTitle>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>{BUILT_IN_PROFILES.filter(match).map((p) => row(p, false))}</div>
      {edit && (
        <Sheet title={edit.mine ? "Edit section" : edit.name ? "Your copy of this section" : "New section"}
          sub={edit.mine || !edit.name ? "Only the name is needed." : "Built-in sections stay as they are. Your copy can have your own bar lengths and code."}
          onClose={() => setEdit(null)}>
          <ProfileForm initial={edit} onSave={(p) => { onSave(p); setEdit(null); }} onCancel={() => setEdit(null)} />
          {edit.mine && edit.id && (
            <button className="mt-3 w-full text-sm font-semibold" style={{ color: "var(--bad)" }}
              onClick={() => { if (window.confirm("Delete this section?")) { onRemove(edit.id!); setEdit(null); } }}>Delete section</button>
          )}
        </Sheet>
      )}
    </>
  );
}
