"use client";
/** The cut rules of a system, in shop words, with an editor for experts. */
import { useState } from "react";
import type { SizeCase, StudioSystem } from "../../lib/studio/model";
import { STATUS_TEXT, ruleText, whenText, lenToInput, readLen, type StudioUnit } from "../../lib/studio/format";
import { Badge, Seg, Sheet, Field } from "../studio-ui";

const SIZE_BASE_LABEL = (sys: StudioSystem, id: string) =>
  id === "W" ? "W" : id === "H" ? "H" : sys.sizes.find((s) => s.id === id)?.label ?? id;

export function CutsTab({ sys, unit, onChange }: { sys: StudioSystem; unit: StudioUnit; onChange: (s: StudioSystem) => void }) {
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

