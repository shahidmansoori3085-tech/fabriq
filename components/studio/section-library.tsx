"use client";
/**
 * Section Library: every section with its drawing, size, code, weight, bar length
 * and the systems (and pieces) that cut it. Any section can be changed — name, size,
 * code, photo, bar length. A built-in section keeps its id when changed, so every
 * system using it takes the change; a changed size asks for 2 finished windows.
 */
import { useMemo, useState } from "react";
import type { ProfileDef, StudioSystem } from "../../lib/studio/model";
import { PROFILE_KINDS } from "../../lib/studio/model";
import { TEMPLATES, OFFERED, LIBRARY_PROFILES, BUILT_IN_PROFILES } from "../../lib/studio/templates";
import { partLabel } from "../../lib/studio/edit";
import { noMaker, sectionTitle } from "../../lib/studio/format";
import type { StudioLibrary } from "../../lib/studio/store";
import { Sheet, SectionTitle } from "../studio-ui";
import SectionSketch from "../section-sketch";
import { ProfileForm } from "./pickers";

export interface SectionUse { key: string; name: string; open: string; pieces: string[] }

/** The systems the app offers (the shop's own copy where it made one) and its own systems. */
function systemsOf(lib: StudioLibrary): StudioSystem[] {
  const offered = TEMPLATES.filter((t) => OFFERED.has(t.id) && !t.id.startsWith("blank"));
  const out = offered.map((t) => lib.systems.filter((x) => x.basedOn?.id === t.id).at(-1) ?? t);
  const ids = new Set(offered.map((t) => t.id));
  return [...out, ...lib.systems.filter((x) => !x.basedOn || !ids.has(x.basedOn.id))];
}

/** Where a section is cut: system → pieces (with the cut angle). */
export function sectionUses(lib: StudioLibrary, id: string): SectionUse[] {
  const rows: SectionUse[] = [];
  for (const s of systemsOf(lib)) {
    const pieces = s.parts.filter((p) => p.profile.some((c) => c.id === id) || p.meshProfile === id)
      .map((p) => `${partLabel(p)}${p.meshProfile === id && !p.profile.some((c) => c.id === id) ? " (mesh)" : ""} · ${p.angle}°`);
    if (pieces.length) rows.push({ key: s.id, name: noMaker(s.name), open: s.id, pieces: [...new Set(pieces)] });
  }
  return rows;
}

const kindLabel = (p: ProfileDef) => PROFILE_KINDS.find((k) => k.id === p.kind)?.label ?? "Section";
const codeOf = (p: ProfileDef) => (p.codes ? [...new Set(Object.values(p.codes).map((v) => noMaker(v)).filter(Boolean))].join(" / ") : "");
const isBuiltIn = (id: string) => BUILT_IN_PROFILES.some((p) => p.id === id);
const pageOf = (p: ProfileDef) => p.source?.source.match(/p\.\s?\d+/)?.[0];

function origin(p: ProfileDef, lib: StudioLibrary): string {
  const overridden = isBuiltIn(p.id) && lib.profiles.some((x) => x.id === p.id);
  if (overridden) return "Catalogue section, changed by you";
  if (!isBuiltIn(p.id)) return "Added by you";
  const pg = pageOf(p);
  return `Catalogue section${pg ? ` (${pg})` : ""}`;
}

export function SectionLibrary({ lib, onSave, onRemove, onBack, onOpenSystem, initialOpen }: {
  lib: StudioLibrary;
  /** a section to show at once (opened from the material list) */
  initialOpen?: string;
  onSave: (p: ProfileDef) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  /** open a system (its id, or a built-in system's id) on a tab */
  onOpenSystem: (id: string, tab?: "teach") => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);
  const [form, setForm] = useState<Partial<ProfileDef> | null>(null);
  const [notice, setNotice] = useState<{ id: string; from: string; to: string } | null>(null);

  const find = (id: string) => lib.profiles.find((p) => p.id === id) ?? BUILT_IN_PROFILES.find((p) => p.id === id);
  const yours = lib.profiles.filter((p) => !isBuiltIn(p.id));
  const builtIn = LIBRARY_PROFILES.map((p) => lib.profiles.find((x) => x.id === p.id) ?? p);
  const match = (p: ProfileDef) => !q || `${p.name} ${codeOf(p)} ${p.size} ${kindLabel(p)}`.toLowerCase().includes(q.toLowerCase());
  const usesCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of [...yours, ...builtIn]) m.set(p.id, sectionUses(lib, p.id).length);
    return m;
  }, [lib]); // eslint-disable-line react-hooks/exhaustive-deps

  const row = (p: ProfileDef) => (
    <button key={p.id} onClick={() => { setOpen(p.id); setNotice(null); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
      <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md" style={{ background: "#fff", border: "1px solid var(--line)" }}><SectionSketch p={p} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{sectionTitle(p.name)}</span>
        <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
          {[kindLabel(p), codeOf(p), p.size].filter(Boolean).join(" · ")}
        </span>
        <span className="block truncate text-[11px]" style={{ color: "var(--ink-3)" }}>
          {usesCount.get(p.id) ? `Used in ${usesCount.get(p.id)} system${usesCount.get(p.id)! > 1 ? "s" : ""}` : "Not used in a system yet"}
          {lib.profiles.some((x) => x.id === p.id) && isBuiltIn(p.id) ? " · changed by you" : ""}
        </span>
      </span>
      <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
    </button>
  );

  const p = open ? find(open) : undefined;
  const uses = p ? sectionUses(lib, p.id) : [];

  return (
    <>
      <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← Systems</button>
      <h1 className="mt-4 text-[28px] font-bold leading-tight tracking-tight">Section Library</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
        Every aluminium section with its drawing, size, code, weight and bar length — and the systems that use it. Tap a section to see or change it.
      </p>
      <button className="btn-primary mt-5 w-full py-3.5" onClick={() => setForm({})}>+ Add a section</button>
      <input className="field mt-4 w-full px-3 py-2.5" placeholder="Search by name, code, size or type" value={q} onChange={(e) => setQ(e.target.value)} />
      {yours.length > 0 && (
        <>
          <SectionTitle>Added by you</SectionTitle>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>{yours.filter(match).map(row)}</div>
        </>
      )}
      <SectionTitle>Catalogue sections</SectionTitle>
      <div className="card divide-y" style={{ borderColor: "var(--line)" }}>{builtIn.filter(match).map(row)}</div>

      {p && !form && (
        <Sheet title={sectionTitle(p.name)} sub={[kindLabel(p), codeOf(p)].filter(Boolean).join(" · ")} onClose={() => setOpen(null)}>
          <div className="overflow-hidden rounded-xl" style={{ background: "#fff", border: "1px solid var(--line)", height: 200 }}><SectionSketch p={p} /></div>

          {notice && notice.id === p.id && (
            <div className="mt-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
              <b>Size changed from {notice.from} to {notice.to}.</b> The cuts of {uses.length > 1 ? "these systems were" : "this system was"} worked out for the old size.
              Check them with 2 windows you have made.
              <div className="mt-2 flex flex-wrap gap-2">
                {uses.map((u) => (
                  <button key={u.key} className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--accent)" }}
                    onClick={() => onOpenSystem(u.open, "teach")}>{u.name} › Check with your window</button>
                ))}
              </div>
            </div>
          )}

          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt style={{ color: "var(--ink-3)" }}>Type</dt><dd className="font-semibold">{kindLabel(p)}</dd>
            {codeOf(p) && (<><dt style={{ color: "var(--ink-3)" }}>Code</dt><dd className="font-semibold">{codeOf(p)}</dd></>)}
            <dt style={{ color: "var(--ink-3)" }}>Size</dt><dd className="font-semibold">{p.size ? `${p.size} mm` : "—"}{p.sizeChanged ? <span style={{ color: "var(--warn)" }}> (was {p.sizeChanged.from})</span> : null}</dd>
            {p.faceMm && (<><dt style={{ color: "var(--ink-3)" }}>Face width</dt><dd className="font-semibold">{p.faceMm} mm</dd></>)}
            {p.kg && (<><dt style={{ color: "var(--ink-3)" }}>Weight</dt><dd className="font-semibold">{p.kg.value} kg per {p.kg.perFt} ft</dd></>)}
            <dt style={{ color: "var(--ink-3)" }}>Bar length</dt><dd className="font-semibold">{p.stockFt.join(" / ")} ft</dd>
            <dt style={{ color: "var(--ink-3)" }}>Source</dt><dd className="font-semibold">{origin(p, lib)}</dd>
          </dl>

          <SectionTitle>Used in</SectionTitle>
          {uses.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-3)" }}>Not used in any system yet. Choose it for a piece inside a system.</p>
          ) : (
            <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
              {uses.map((u) => (
                <button key={u.key} onClick={() => onOpenSystem(u.open)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{u.pieces.join(", ")}</span>
                  </span>
                  <span aria-hidden style={{ color: "var(--ink-3)" }}>›</span>
                </button>
              ))}
            </div>
          )}

          <button className="btn-primary mt-4 w-full py-3" onClick={() => setForm({ ...p, mine: true })}>Change name, size or photo</button>
          {isBuiltIn(p.id) && lib.profiles.some((x) => x.id === p.id) && (
            <button className="mt-3 w-full text-sm font-semibold" style={{ color: "var(--accent)" }}
              onClick={() => { if (window.confirm("Go back to the catalogue values for this section?")) { onRemove(p.id); setNotice(null); } }}>
              Restore catalogue values
            </button>
          )}
          {!isBuiltIn(p.id) && (
            <button className="mt-3 w-full text-sm font-semibold" style={{ color: "var(--bad)" }}
              onClick={() => { if (window.confirm("Delete this section?")) { onRemove(p.id); setOpen(null); } }}>Delete section</button>
          )}
        </Sheet>
      )}

      {form && (
        <Sheet title={form.id ? "Change section" : "New section"}
          sub={form.id ? (uses.length ? `Changes apply to every system that uses it (${uses.length}).` : "Change any detail.") : "Only the name is needed."}
          onClose={() => setForm(null)}>
          <ProfileForm initial={form} onCancel={() => setForm(null)} onSave={(saved) => {
            const before = form.id ? find(form.id) : undefined;
            onSave(saved);
            setForm(null);
            setOpen(saved.id);
            // a new size moves the cuts: straight to Measure (2 finished windows) of the system using it;
            // the other systems show the same check when opened
            const used = sectionUses(lib, saved.id);
            if (before?.size && saved.size && before.size !== saved.size && used.length) {
              setNotice({ id: saved.id, from: before.size, to: saved.size });
              onOpenSystem(used[0].open, "teach");
            } else setNotice(null);
          }} />
        </Sheet>
      )}
    </>
  );
}
