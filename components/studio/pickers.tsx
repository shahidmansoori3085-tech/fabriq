"use client";
/** Choosing a section for a piece, and adding / editing a section. */
import { useState } from "react";
import type { ProfileDef, ProfileKind } from "../../lib/studio/model";
import { PROFILE_KINDS } from "../../lib/studio/model";
import { allProfiles, newId, type StudioLibrary } from "../../lib/studio/store";
import { Sheet, Field } from "../studio-ui";
import SectionSketch from "../section-sketch";

export function SectionPicker({ lib, kind, title, onPick, onAdd, onClose }: {
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
            <span className="h-11 w-14 shrink-0 overflow-hidden rounded-md"><SectionSketch p={p} /></span>
            <span className="min-w-0 flex-1">
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
  const [face, setFace] = useState(initial.faceMm ? String(initial.faceMm) : "");

  const toggleStock = (ft: number) => setStock((s) => (s.includes(ft) ? (s.length > 1 ? s.filter((x) => x !== ft) : s) : [...s, ft]));
  const save = () => {
    const extra = parseFloat(other);
    const stockFt = [...new Set([...stock, ...(extra > 0 && extra <= 30 ? [extra] : [])])];
    onSave({
      id: initial.mine && initial.id ? initial.id : newId("my"),
      name: name.trim(), kind, mine: true,
      codes: code.trim() ? { [maker.trim().toLowerCase() || "code"]: code.trim() } : undefined,
      size: size.trim() || undefined,
      faceMm: parseFloat(face) > 0 ? parseFloat(face) : undefined,
      ref: initial.ref,
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
      <div className="flex gap-3">
        <div className="h-24 w-28 shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
          <SectionSketch p={{ id: "x", name, kind, size, stockFt: [16], source: { status: "suggested", source: "" } }} />
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <Field label="Size (mm)" hint="Width × height, as the catalogue prints it"><input className="field px-3 py-2.5" value={size} onChange={(e) => setSize(e.target.value)} placeholder="45×45" /></Field>
        </div>
      </div>
      <Field label="Width seen from the front (mm)" hint="Optional. Used for the drawing. Empty = taken from the size.">
        <input className="field px-3 py-2.5" inputMode="decimal" value={face} onChange={(e) => setFace(e.target.value)} placeholder="auto" />
      </Field>
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

