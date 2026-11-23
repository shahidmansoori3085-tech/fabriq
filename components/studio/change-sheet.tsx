"use client";
/**
 * Change one pipe in three plain steps (founder 2026-11-18): type your size in any unit,
 * pick 90° or 45°, Save. Nothing else to learn.
 */
import { useState } from "react";
import { readAnyLen, fmtLen, type StudioUnit } from "../../lib/studio/format";
import { Sheet, useBackClose } from "../studio-ui";

/** A whole screen for the pipe's other changes; Back (or the phone's back) returns to the sheet. */
function MoreScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  useBackClose(onBack);
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" style={{ background: "var(--bg, var(--surface-2))" }}>
      <div className="mx-auto w-full max-w-xl px-4 pb-10 pt-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1 py-2 text-sm font-semibold" style={{ color: "var(--ink-3)" }}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          Back
        </button>
        <h2 className="mt-2 text-[24px] font-bold leading-tight">{title}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>More changes for this pipe.</p>
        <div className="card mt-4 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

export function ChangeSheet({ title, section, now, angle, unit, onSave, more, onClose }: {
  /** the pipe: "Handle", "Top track" */
  title: string;
  /** its section: "Handle 3/4″×1.5″ · 1041 · 40×18 mm" */
  section: string;
  /** its cut on this window now, µm */
  now: number | null;
  angle: 90 | 45;
  unit: StudioUnit;
  onSave: (um: number | null, angle: 90 | 45) => void;
  /** every other change of this pipe (section, mesh pipe, pieces…), shown under "More options" */
  more: React.ReactNode;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [deg, setDeg] = useState<90 | 45>(angle);
  const [open, setOpen] = useState(false);
  const um = readAnyLen(raw);
  const bad = raw.trim() !== "" && um === null;
  const changed = um !== null || deg !== angle;
  return (
    <Sheet title={`Change ${title}`} sub={section} onClose={onClose}>
      <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
        <span className="text-sm" style={{ color: "var(--ink-3)" }}>Now</span>
        <span className="mono text-lg font-bold">{now != null ? fmtLen(now, unit).replace(/~/g, "") : "Not set"} <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>· {angle}°</span></span>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[15px] font-bold">New size</div>
        <input autoFocus className="field w-full px-3 py-3 text-lg font-semibold" inputMode="text" value={raw} onChange={(e) => setRaw(e.target.value)}
          // Enter saves; the key stops here, so it never reaches the page under the sheet
          onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); e.stopPropagation(); if (changed && !bad) onSave(um, deg); }}
          placeholder="48.7 = 48 inch 7 sut" aria-label="Your size" />
        <p className="mt-1.5 text-xs" style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}>
          {bad ? "Type it like 46.5 (inch.sut), 1180 mm or 3'10.5 (feet)."
            : um !== null ? <>= <b className="mono" style={{ color: "var(--ink)" }}>{fmtLen(um, "in").replace(/~/g, "")}</b> · {Math.round(um / 1000)} mm</>
            : "Or type mm, cm or feet."}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm" style={{ color: "var(--ink-3)" }}>Cut</span>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-3)" }} role="radiogroup" aria-label="Cut">
          {([90, 45] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={deg === d} onClick={() => setDeg(d)}
              className="rounded-md px-4 py-1.5 text-sm font-bold"
              style={deg === d ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(17,24,39,.08)" } : { color: "var(--ink-3)" }}>{d}°</button>
          ))}
        </div>
      </div>

      <button type="button" className="btn-primary mt-6 w-full py-3.5 text-base" disabled={!changed || bad} onClick={() => onSave(um, deg)}>Save</button>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="mt-4 flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
        More options
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          ><path d="M9 6l6 6-6 6" /></svg>
      </button>
      {open && <MoreScreen title={title} onBack={() => setOpen(false)}>{more}</MoreScreen>}
    </Sheet>
  );
}
