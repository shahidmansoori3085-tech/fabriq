"use client";
/**
 * A section's pipe length on the material list (founder 2026-11-22): − / + move it one foot
 * and the list follows at once; a tap on the length types any length, in feet or inches.
 * The cut piece has no button of its own (founder): it is always what the cuts need.
 */
import { useState } from "react";
import { UM_PER_FOOT, formatSizeIn } from "@/lib/engine/units";
import { pipeText, readPipeFt, stepPipeFt } from "@/lib/engine/pipe";
import { Seg, Sheet } from "./studio-ui";

/** Sets the length; the reason comes back when a piece does not fit in it. */
type SetLength = (ft: number) => string | null;

export function PipeLength({ name, ft, usual, onSet }: { name: string; ft: number; usual: number; onSet: SetLength }) {
  const [open, setOpen] = useState(false);
  // the reason stands only for the length it was given for
  const [why, setWhy] = useState<{ at: number; text: string } | null>(null);
  const button = (d: 1 | -1) => (
    <button type="button" disabled={stepPipeFt(ft, d) === ft}
      onClick={() => { const no = onSet(stepPipeFt(ft, d)); setWhy(no ? { at: ft, text: no } : null); }}
      aria-label={`${name}: pipe 1 ft ${d < 0 ? "shorter" : "longer"}`}
      className="no-print grid h-10 w-10 shrink-0 place-items-center text-xl disabled:opacity-30" style={{ color: "var(--ink-2)" }}>
      {d < 0 ? "−" : "+"}
    </button>
  );
  return (
    <div className="mt-1.5">
      <div className="flex w-44 max-w-full items-center rounded-[10px]" style={{ border: "1px solid var(--line)" }}>
        {button(-1)}
        {/* "pipe" is inside the box, so the length is not taken for the cut piece's */}
        <button type="button" onClick={() => { setWhy(null); setOpen(true); }} aria-label={`${name}: type the pipe length`}
          className="flex h-10 min-w-0 flex-1 flex-col items-center justify-center whitespace-nowrap leading-none tabnum"
          style={{ borderLeft: "1px solid var(--line)", borderRight: "1px solid var(--line)" }}>
          <span className="text-sm font-semibold">{pipeText(ft)}</span>
          <span className="mt-0.5 text-[10px]" style={{ color: "var(--ink-3)" }}>pipe</span>
        </button>
        {button(1)}
      </div>
      {why?.at === ft && <p role="status" className="no-print mt-1 text-xs leading-snug" style={{ color: "var(--bad)" }}>{why.text}</p>}
      {open && <TypeLength name={name} ft={ft} usual={usual} onSet={onSet} onClose={() => setOpen(false)} />}
    </div>
  );
}

function TypeLength({ name, ft, usual, onSet, onClose }: {
  name: string; ft: number; usual: number; onSet: SetLength; onClose: () => void;
}) {
  const [unit, setUnit] = useState<"ft" | "in">("ft");
  const [raw, setRaw] = useState("");
  const [why, setWhy] = useState<string | null>(null);
  const read = readPipeFt(raw, unit);
  const bad = raw.trim() !== "" && read === null;
  const save = (to: number) => {
    const no = onSet(to);
    if (no) setWhy(no); else onClose();
  };
  return (
    <Sheet title="Pipe length" sub={`${name} · this job only`} onClose={onClose}>
      <Seg value={unit} options={[{ value: "ft", label: "Feet" }, { value: "in", label: "Inch" }]}
        onChange={(u) => {
          // what is typed stays the same length in the other unit
          if (read !== null) setRaw(formatSizeIn(Math.round(read * UM_PER_FOOT), u));
          setUnit(u); setWhy(null);
        }} />
      <form onSubmit={(e) => { e.preventDefault(); if (read !== null) save(read); }}>
        <input autoFocus className="field mt-3 w-full px-3 py-3 text-lg font-semibold" inputMode="decimal"
          value={raw} onChange={(e) => { setRaw(e.target.value); setWhy(null); }} aria-label="Pipe length"
          placeholder={unit === "ft" ? "15.6 = 15 ft 6 inch" : "186.4 = 186 inch 4 sut"} />
        <p role="status" className="mt-1.5 min-h-4 text-xs" style={{ color: bad || why ? "var(--bad)" : "var(--ink-3)" }}>
          {why ?? (bad ? "Type a length from 1 to 30 ft." : read !== null ? `= ${pipeText(read)}` : `Now ${pipeText(ft)}`)}
        </p>
        <button type="submit" className="btn-primary mt-4 w-full py-3.5 text-base" disabled={read === null}>Save</button>
      </form>
      {ft !== usual && (
        <button type="button" className="btn-ghost mt-2 w-full py-3 text-sm" onClick={() => save(usual)}>Back to {pipeText(usual)}</button>
      )}
    </Sheet>
  );
}
