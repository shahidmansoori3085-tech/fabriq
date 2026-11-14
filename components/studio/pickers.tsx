"use client";
/** Choosing a section for a piece, and adding / editing a section. */
import { useState } from "react";
import type { ProfileDef, ProfileKind } from "../../lib/studio/model";
import { PROFILE_KINDS } from "../../lib/studio/model";
import { allProfiles, newId, type StudioLibrary } from "../../lib/studio/store";
import { Sheet, Field } from "../studio-ui";
import SectionSketch from "../section-sketch";
import { traceImage } from "../../lib/studio/tracer";
import { readDxf } from "../../lib/studio/dxf";
import { recognize, type Recognized, type SectionRole } from "../../lib/studio/recognize";

/** What the shape says a section is, in the form's own words. */
const ROLE_KIND: Record<SectionRole, ProfileKind | null> = {
  "glass-shutter": "shutter", "double-glass-shutter": "shutter", "mesh-shutter": "mesh-shutter",
  track: "track", "side-track": "track", "slim-interlock": "slim-interlock", clip: "rail", "interlock-clip": "interlock-patti", interlock: "interlock", bead: "bead", other: null,
};
const ROLE_TEXT: Record<SectionRole, string> = {
  "glass-shutter": "a glass shutter", "double-glass-shutter": "a double-glass shutter", "mesh-shutter": "a mesh (jali) shutter",
  track: "a track", "side-track": "a Gulf side track (one groove)", "slim-interlock": "a slim interlock", clip: "a track clip / rail", "interlock-clip": "an interlock clip", interlock: "a heavy interlock", bead: "a glazing clip / patti", other: "",
};

/** Read a picture into a grey array, at most 1400 px on its long side. */
async function grayFromFile(file: File): Promise<{ g: Uint8Array; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const g = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) g[i] = Math.round(d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
    return { g, w, h };
  } finally { URL.revokeObjectURL(url); }
}

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
                {[p.codes ? Object.entries(p.codes).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(" · ") : "", p.size, `${p.stockFt[0] ?? 16} ft pipe`].filter(Boolean).join(" · ")}
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
  const [shape, setShape] = useState(initial.shape);
  const [pic, setPic] = useState<{ g: Uint8Array; w: number; h: number } | null>(null);
  const [invert, setInvert] = useState(false);
  const [traceMsg, setTraceMsg] = useState("");
  const [seen, setSeen] = useState<Recognized | null>(null);
  // read the section's job off its drawing (a few seconds on a phone); set it unless the shop already chose
  const look = (sh: NonNullable<typeof shape>) => {
    setSeen(null);
    const done = (r: Recognized | null) => {
      if (!r) return;
      setSeen(r);
      const k = ROLE_KIND[r.role];
      if (k) setKind((cur) => (cur === "other" ? k : cur));
    };
    // measure off the screen thread when the browser can; otherwise right here
    try {
      const w = new Worker(new URL("../../lib/studio/recognize.worker.ts", import.meta.url));
      w.onmessage = (e: MessageEvent<{ result: Recognized | null }>) => { done(e.data.result); w.terminate(); };
      w.onerror = () => { w.terminate(); done(recognize(sh)); };
      w.postMessage({ id: 1, shape: sh });
    } catch { setTimeout(() => done(recognize(sh)), 30); }
  };
  const dims = size.split(/[×x*]/).map((v) => parseFloat(v)).filter((v) => v > 0);
  const runTrace = (p: { g: Uint8Array; w: number; h: number } | null, inv: boolean) => {
    if (!p) return;
    if (dims.length !== 2) { setTraceMsg("Type the size (mm) first, e.g. 65×29 — the drawing is scaled to it."); return; }
    const t = traceImage(p.g, p.w, p.h, dims[0], dims[1], inv);
    if (!t) { setTraceMsg("No section found in this picture. Try a closer, straight photo."); return; }
    setShape(t);
    look(t);
    setTraceMsg(t.scaleCheck > 4 ? `Traced, but its shape is ${t.scaleCheck}% off the size you typed — check the size, or crop closer.` : "Traced to your size.");
  };

  const pickStock = (ft: number) => { setStock([ft]); setOther(""); };
  const save = () => {
    const extra = parseFloat(other);
    const stockFt = extra > 0 && extra <= 30 ? [extra] : stock.slice(0, 1);
    onSave({
      id: initial.mine && initial.id ? initial.id : newId("my"),
      name: name.trim(), kind, mine: true,
      codes: code.trim() ? { [maker.trim().toLowerCase() || "code"]: code.trim() } : undefined,
      size: size.trim() || undefined,
      faceMm: parseFloat(face) > 0 ? parseFloat(face) : undefined,
      shape,
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
      <Field label="Size (mm)" hint="Width × height, as the catalogue prints it"><input className="field px-3 py-2.5" value={size} onChange={(e) => setSize(e.target.value)} placeholder="45×45" /></Field>
      <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-center gap-3">
          <span className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border bg-white" style={{ borderColor: "var(--line)" }}>
            {shape || size.trim()
              ? <SectionSketch p={{ id: "x", name, kind, size, shape, stockFt: [16], source: { status: "suggested", source: "" } }} />
              : (
                <svg viewBox="0 0 96 80" className="h-full w-full" aria-hidden>
                  <path d="M48 50V26m0 0-9 9m9-9 9 9" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M30 52v6h36v-6" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">Real drawing</div>
            <div className="text-xs" style={{ color: "var(--ink-3)" }}>A DXF from your extruder (exact), or a photo / screenshot of the section from your catalogue. One section per file.</div>
            <label className="mt-2 inline-block cursor-pointer text-sm font-semibold" style={{ color: "var(--accent)" }}>
              {shape ? "Use another photo or DXF" : "+ Add from photo or DXF"}
              <input type="file" accept="image/*,.dxf" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
                if (/\.dxf$/i.test(f.name)) {
                  // a CAD drawing is exact: its own size is the section's size
                  const d = readDxf(await f.text());
                  if (!d) { setTraceMsg("No closed section found in this DXF."); return; }
                  setShape(d); setPic(null); look(d);
                  if (!size.trim()) setSize(`${d.w}×${d.h}`);
                  setTraceMsg(`From the DXF: ${d.w} × ${d.h} mm.`);
                  return;
                }
                setTraceMsg("Tracing…");
                try { const p = await grayFromFile(f); setPic(p); runTrace(p, invert); } catch { setTraceMsg("Could not read this picture."); }
              }} />
            </label>
          </div>
        </div>
        {traceMsg && <p className="mt-2 text-xs" style={{ color: shape && !traceMsg.includes("off") ? "var(--good)" : "var(--warn)" }}>{traceMsg}</p>}
        {pic && (
          <div className="mt-2 flex gap-3 text-xs font-semibold">
            <button type="button" style={{ color: "var(--accent)" }} onClick={() => runTrace(pic, invert)}>Trace again with this size</button>
            <button type="button" style={{ color: "var(--accent)" }} onClick={() => { setInvert(!invert); runTrace(pic, !invert); }}>Light drawing on dark</button>
          </div>
        )}
        {shape && seen && seen.role !== "other" && (
          <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface)" }}>
            <div><b>Looks like {ROLE_TEXT[seen.role]}</b>{seen.grooves ? ` · ${seen.grooves} grooves` : ""}</div>
            <div style={{ color: "var(--ink-3)" }}>{seen.why}</div>
            {ROLE_KIND[seen.role] && ROLE_KIND[seen.role] !== kind && (
              <button type="button" className="mt-1 font-semibold" style={{ color: "var(--accent)" }} onClick={() => setKind(ROLE_KIND[seen.role]!)}>
                Set “What is it” to {PROFILE_KINDS.find((k) => k.id === ROLE_KIND[seen.role])?.label}
              </button>
            )}
          </div>
        )}
        {shape && !seen && <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>Reading the shape…</p>}
        {shape && <button type="button" className="mt-2 text-xs font-semibold" style={{ color: "var(--bad)" }} onClick={() => { setShape(undefined); setPic(null); setTraceMsg(""); setSeen(null); }}>Remove drawing</button>}
      </div>
      <Field label="Width seen from the front (mm)" hint="Optional. Used for the drawing. Empty = taken from the size.">
        <input className="field px-3 py-2.5" inputMode="decimal" value={face} onChange={(e) => setFace(e.target.value)} placeholder="auto" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight (kg)"><input className="field px-3 py-2.5" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="3.2" /></Field>
        <Field label="per (feet)" hint="The length the catalogue weight is for"><input className="field px-3 py-2.5" inputMode="decimal" value={kgPer} onChange={(e) => setKgPer(e.target.value)} /></Field>
      </div>
      <Field label="Pipe length" hint="The length your dealer sells. What is left is bought as one piece cut to the feet needed.">
        <div className="flex flex-wrap items-center gap-2">
          {[12, 15, 16, 20].map((ft) => (
            <button key={ft} type="button" onClick={() => pickStock(ft)} aria-pressed={!other && stock[0] === ft}
              className={`chip px-3 py-1.5 text-sm ${!other && stock[0] === ft ? "selected" : ""}`}>{ft} ft</button>
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

