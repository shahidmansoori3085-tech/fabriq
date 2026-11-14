"use client";
/**
 * System Studio — the shop's own window systems and sections.
 * Everything here is saved on this phone only.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProfileDef, StudioSystem, SeriesType } from "../../lib/studio/model";
import { PROFILE_KINDS } from "../../lib/studio/model";
import { TEMPLATES, LIBRARY_PROFILES, WINDOW_SYSTEMS, OFFERED } from "../../lib/studio/templates";
import {
  loadLibrary, saveLibrary, copyTemplate, newId, exportLibrary, importLibrary, type StudioLibrary,
} from "../../lib/studio/store";
import { SYSTEM_STATUS, noMaker, sectionTitle, type StudioUnit } from "../../lib/studio/format";
import StudioEditor, { nextStep, ProfileForm } from "../../components/studio-editor";
import { Badge, Seg, Sheet, SectionTitle } from "../../components/studio-ui";
import { findProfile } from "../../lib/studio/store";
import StudioThumb from "../../components/studio-thumb";
import SectionSketch from "../../components/section-sketch";

type View = { kind: "home" } | { kind: "new" } | { kind: "system"; id: string } | { kind: "sections" };
const UNIT_KEY = "fabriq_studio_unit";


/** A small, real drawing of a system (first layout, 5′ × 4′). */
function Thumb({ sys, lib }: { sys: StudioSystem; lib: StudioLibrary }) {
  return <StudioThumb sys={sys} find={(id) => findProfile(lib, id)} withTrack />;
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
    try { const u = localStorage.getItem(UNIT_KEY); if (u === "mm" || u === "ft") setUnit(u); } catch { /* inch stays */ }
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
            <Seg small value={unit} onChange={changeUnit} options={[{ value: "ft", label: "feet" }, { value: "in", label: "inch" }, { value: "mm", label: "mm" }]} />
          </header>
          <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">Window systems</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
            Every window in the app. Tap one to change its sections, cuts, glass and pipe length. Saved on this phone.
          </p>

          {KIND_ORDER.map(([kind, label]) => {
            const rows = WINDOW_SYSTEMS.filter((w) => w.kind === kind);
            return (
              <div key={kind}>
                <SectionTitle>{label}</SectionTitle>
                <div className="card divide-y overflow-hidden">
                  {rows.map((w) => {
                    // the shop's own changed copy, if it made one (Window uses the newest)
                    const mine = lib.systems.filter((x) => x.basedOn?.id === w.id).at(-1);
                    const t = TEMPLATES.find((x) => x.id === w.id)!;
                    return (
                      <button key={w.id} onClick={() => { if (mine) { setView({ kind: "system", id: mine.id }); window.scrollTo({ top: 0 }); } else create(w.id); }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                        <span className="w-[72px] shrink-0"><Thumb sys={mine ?? t} lib={lib} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{t.name}</span>
                          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                            {mine ? "Your settings" : "Built-in · tap to change"}
                            {mine?.jobs.length ? ` · learned from ${mine.jobs.length} window${mine.jobs.length > 1 ? "s" : ""}` : ""}
                          </span>
                        </span>
                        {mine && <Badge tone={SYSTEM_STATUS[mine.status].tone}>{SYSTEM_STATUS[mine.status].label}</Badge>}
                        <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* the shop's own systems that are not one of the above */}
          {(() => {
            const offered = new Set(WINDOW_SYSTEMS.map((w) => w.id));
            const own = lib.systems.filter((x) => !x.basedOn || !offered.has(x.basedOn.id));
            return (
              <>
                <SectionTitle>Your own systems</SectionTitle>
                {own.length > 0 && (
                  <div className="card mb-2 divide-y overflow-hidden">
                    {own.map((x) => (
                      <button key={x.id} onClick={() => { setView({ kind: "system", id: x.id }); window.scrollTo({ top: 0 }); }}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                        <span className="w-[72px] shrink-0"><Thumb sys={x} lib={lib} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{x.name}</span>
                          <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>{nextStep(x).text}</span>
                        </span>
                        <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setView({ kind: "new" })} className="btn-ghost w-full py-3 text-sm">+ Make a new system</button>
              </>
            );
          })()}

          <SectionTitle>Library</SectionTitle>
          <button onClick={() => setView({ kind: "sections" })} className="card flex w-full items-center justify-between p-3 text-left">
            <span>
              <span className="block font-bold">My sections</span>
              <span className="block text-xs" style={{ color: "var(--ink-3)" }}>
                {lib.profiles.length} of yours · {LIBRARY_PROFILES.length} built-in · sizes, codes, bar lengths
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

const TYPE_LABEL: Record<SeriesType, string> = {
  domal: "Domal", euro: "Euro", gulf: "Gulf", bombay: "Normal", sleek: "Sleek", casement: "Casement", other: "Blank",
};
const TYPE_HINT: Record<SeriesType, string> = {
  domal: "the shutter runs on the track legs",
  euro: "one track all round, the roller runs on a clip",
  gulf: "a one-groove track on the left and right",
  bombay: "handle, interlock and bearing shutter",
  sleek: "slim sightlines",
  casement: "openable sash on friction stays",
  other: "choose every section yourself",
};
const TYPE_ORDER: SeriesType[] = ["domal", "euro", "gulf", "bombay", "casement"];

function SystemCard({ t, lib, onPick }: { t: StudioSystem; lib: StudioLibrary; onPick: (id: string) => void }) {
  return (
    <button onClick={() => onPick(t.id)} className="card flex flex-col gap-2 p-2.5 text-left">
      <span className="block rounded-lg p-1.5" style={{ background: "var(--surface-2)" }}><Thumb sys={t} lib={lib} /></span>
      <span className="flex flex-wrap items-center gap-1">
        {t.series && t.series.type !== "other" && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--accent-soft, var(--surface-3))", color: "var(--accent)" }}>
            {TYPE_LABEL[t.series.type]}{t.series.mm ? ` ${t.series.mm} mm` : ""}
          </span>
        )}
        {t.status === "verified" && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--good-soft)", color: "var(--good)" }}>Checked on real jobs</span>}
      </span>
      {/* the badge already says the kind and size: the title is the maker */}
      <span className="block text-sm font-bold leading-tight">{t.series && t.series.type !== "other" ? (t.name.split(" — ")[1] ?? "Any maker").replace(/^./, (c) => c.toUpperCase()) : t.name}</span>
      <span className="line-clamp-2 text-[11px] leading-snug" style={{ color: "var(--ink-3)" }}>{noMaker(t.blurb)}</span>
    </button>
  );
}

const KIND_ORDER: [SeriesType, string][] = [["bombay", "Normal"], ["domal", "Domal"], ["euro", "Euro"], ["gulf", "Gulf"], ["casement", "Casement (Z)"]];

function NewSystem({ lib, onPick, onBack }: { lib: StudioLibrary; onPick: (id: string) => void; onBack: () => void }) {
  const [type, setType] = useState<SeriesType | "all">("all");
  const [size, setSize] = useState<number | "all">("all");
  const real = TEMPLATES.filter((t) => t.series && t.series.type !== "other" && OFFERED.has(t.id));
  const ofType = real.filter((t) => type === "all" || t.series!.type === type);
  const sizes = [...new Set(ofType.map((t) => t.series!.mm).filter((m) => m > 0))].sort((a, b) => a - b);
  const shown = ofType.filter((t) => size === "all" || t.series!.mm === size)
    .sort((a, b) => (a.series!.mm || 99) - (b.series!.mm || 99) || TYPE_ORDER.indexOf(a.series!.type) - TYPE_ORDER.indexOf(b.series!.type));
  const popular = real.filter((t) => t.popular);
  const filtering = type !== "all" || size !== "all";
  const blanks = TEMPLATES.filter((t) => t.series?.type === "other");

  return (
    <>
      <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← Window systems</button>
      <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">New system</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>Pick your window. Sections, pieces, angles and cuts can all be changed after.</p>

      <div className="sticky top-0 z-10 -mx-4 mt-4 px-4 pb-2 pt-2" style={{ background: "var(--bg)" }}>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {(["all", ...TYPE_ORDER] as const).map((k) => (
            <button key={k} aria-pressed={type === k} onClick={() => { setType(k); setSize("all"); }}
              className={`chip shrink-0 px-3 py-1.5 text-sm ${type === k ? "selected" : ""}`}>{k === "all" ? "All" : TYPE_LABEL[k]}</button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          <button aria-pressed={size === "all"} onClick={() => setSize("all")} className={`chip shrink-0 px-2.5 py-1 text-xs ${size === "all" ? "selected" : ""}`}>Any size</button>
          {sizes.map((m) => (
            <button key={m} aria-pressed={size === m} onClick={() => setSize(m)} className={`chip shrink-0 px-2.5 py-1 text-xs ${size === m ? "selected" : ""}`}>{m} mm</button>
          ))}
        </div>
        {type !== "all" && <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>{TYPE_LABEL[type]}: {TYPE_HINT[type]}.</p>}
      </div>

      {!filtering && (
        <>
          <SectionTitle>Most used</SectionTitle>
          <div className="grid grid-cols-2 gap-2">{popular.map((t) => <SystemCard key={t.id} t={t} lib={lib} onPick={onPick} />)}</div>
          <SectionTitle>All systems</SectionTitle>
        </>
      )}
      {filtering && <SectionTitle>{shown.length} {shown.length === 1 ? "system" : "systems"}</SectionTitle>}
      <div className="grid grid-cols-2 gap-2">{shown.map((t) => <SystemCard key={t.id} t={t} lib={lib} onPick={onPick} />)}</div>
      {shown.length === 0 && <div className="card p-4 text-sm" style={{ color: "var(--ink-3)" }}>No ready system for this yet. Start blank below and choose your sections.</div>}

      <SectionTitle>Start from nothing</SectionTitle>
      <div className="grid grid-cols-2 gap-2">{blanks.map((t) => <SystemCard key={t.id} t={t} lib={lib} onPick={onPick} />)}</div>
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
      <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md" style={{ background: "#fff", border: "1px solid var(--line)" }}><SectionSketch p={p} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{sectionTitle(p.name)}</span>
        <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
          {[PROFILE_KINDS.find((k) => k.id === p.kind)?.label, p.codes ? [...new Set(Object.values(p.codes).map((v) => noMaker(v)).filter(Boolean))].join(" / ") : "", p.size, `${p.stockFt.join("/")} ft`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{mine ? "Edit" : "Copy"}</span>
    </button>
  );
  return (
    <>
      <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← Window systems</button>
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
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>{LIBRARY_PROFILES.filter(match).map((p) => row(p, false))}</div>
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
