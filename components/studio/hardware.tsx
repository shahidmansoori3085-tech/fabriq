"use client";
/**
 * Hardware & accessories of a system: what one window takes. The material list
 * multiplies it by the windows ordered (and by shutters, or by running feet).
 */
import { useState } from "react";
import type { ExtraDef, StudioSystem } from "../../lib/studio/model";
import { newId } from "../../lib/studio/store";
import { Field, Seg, SectionTitle } from "../studio-ui";

type Basis = "window" | "shutter" | "rft-shutter" | "rft-window";

const BASIS: { value: Basis; label: string }[] = [
  { value: "window", label: "Per window" },
  { value: "shutter", label: "Per shutter" },
  { value: "rft-shutter", label: "Feet round each shutter" },
  { value: "rft-window", label: "Feet round the window" },
];

/** Common items, so most shops only tap. */
const PRESETS: { name: string; basis: Basis; qty: number }[] = [
  { name: "Roller", basis: "shutter", qty: 2 },
  { name: "Lock", basis: "window", qty: 1 },
  { name: "Handle", basis: "shutter", qty: 1 },
  { name: "Cleat (corner joint)", basis: "window", qty: 4 },
  { name: "Wool pile", basis: "rft-shutter", qty: 1 },
  { name: "Rubber gasket", basis: "rft-shutter", qty: 1 },
  { name: "Stopper", basis: "window", qty: 2 },
  { name: "Screws", basis: "window", qty: 20 },
  { name: "Silicone (tube)", basis: "window", qty: 1 },
  { name: "Mesh (rft)", basis: "rft-shutter", qty: 1 },
];

const basisOf = (e: ExtraDef): Basis => (e.kind === "count" ? e.per : e.per === "window" ? "rft-window" : "rft-shutter");

/** Plain words for how an item is counted. */
export function hardwareRule(e: ExtraDef): string {
  if (e.kind === "count") return `${e.qty} ${e.per === "shutter" ? "per shutter" : "per window"}`;
  return e.per === "window" ? "Running feet round the window" : "Running feet round each shutter";
}

function make(sys: StudioSystem, name: string, basis: Basis, qty: number, id = newId("hw")): ExtraDef {
  if (basis === "window" || basis === "shutter") {
    return { id, name, kind: "count", per: basis, qty, formula: `${qty} per ${basis}`, unit: "nos" };
  }
  const sash = sys.sizes.some((s) => s.id === "sashW");
  const of: [string, string] = basis === "rft-window" ? ["W", "H"] : sash ? ["sashW", "sashH"] : ["shutterW", "shutterH"];
  return { id, name, kind: "perimeter", per: basis === "rft-window" ? "window" : "shutter", of,
    formula: basis === "rft-window" ? "2 × (W + H)" : "2 × (shutter width + height) × shutters", unit: "rft" };
}

export function HardwareTab({ sys, onChange }: { sys: StudioSystem; onChange: (s: StudioSystem) => void }) {
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<Basis>("window");
  const [qty, setQty] = useState("1");
  const put = (extras: ExtraDef[]) => onChange({ ...sys, extras });
  const add = (n: string, b: Basis, q: number) => {
    if (!n.trim()) return;
    put([...sys.extras, make(sys, n.trim(), b, q)]);
  };
  const counted = basis === "window" || basis === "shutter";

  return (
    <div className="mt-3">
      <p className="text-sm" style={{ color: "var(--ink-3)" }}>
        What one window of this system takes. The material list multiplies it by the windows ordered, by the shutters, or by the running feet.
      </p>

      <SectionTitle>In this system</SectionTitle>
      {sys.extras.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-3)" }}>No hardware yet. Add the items you fit.</p>
      ) : (
        <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
          {sys.extras.map((e, i) => (
            <div key={e.id} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" value={e.name} aria-label="Item name"
                  onChange={(ev) => put(sys.extras.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))} />
                <button className="px-1 text-lg leading-none" style={{ color: "var(--bad)" }} aria-label={`Remove ${e.name}`}
                  onClick={() => put(sys.extras.filter((_, j) => j !== i))}>×</button>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
              {e.kind === "count" && (
                <input type="number" inputMode="numeric" min={0} className="field w-16 px-2 py-1.5 text-right text-sm" aria-label={`${e.name} quantity`}
                  value={e.qty}
                  onChange={(ev) => { const q = Math.max(0, Math.round(Number(ev.target.value) || 0)); put(sys.extras.map((x, j) => (j === i ? make(sys, x.name, basisOf(x), q, x.id) : x))); }} />
              )}
              <select className="field px-1.5 py-1.5 text-xs" aria-label={`${e.name} counted`} value={basisOf(e)}
                onChange={(ev) => put(sys.extras.map((x, j) => (j === i ? make(sys, x.name, ev.target.value as Basis, x.kind === "count" ? x.qty : 1, x.id) : x)))}>
                {BASIS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Add an item</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => !sys.extras.some((e) => e.name.toLowerCase() === p.name.toLowerCase())).map((p) => (
          <button key={p.name} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            onClick={() => add(p.name, p.basis, p.qty)}>+ {p.name}</button>
        ))}
      </div>
      <div className="card mt-3 grid gap-3 p-3">
        <Field label="Item name"><input className="field px-3 py-2.5" placeholder="e.g. Friction stay, Hinge, Tower bolt" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Counted"><Seg small value={basis} onChange={setBasis} options={BASIS} /></Field>
        {counted && <Field label="Quantity"><input type="number" inputMode="numeric" min={1} className="field px-3 py-2.5" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
        <button className="btn-primary py-3" disabled={!name.trim()}
          onClick={() => { add(name, basis, Math.max(1, Math.round(Number(qty) || 1))); setName(""); setQty("1"); }}>Add item</button>
      </div>
    </div>
  );
}
