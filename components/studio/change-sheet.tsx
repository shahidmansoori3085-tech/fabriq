"use client";
/**
 * Change one pipe in three plain steps (founder 2026-11-18): type your size in any unit,
 * pick 90° or 45°, Save. Nothing else to learn.
 */
import { useState } from "react";
import { readAnyLen, fmtLen, type StudioUnit } from "../../lib/studio/format";
import { Sheet } from "../studio-ui";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--accent)", color: "#fff" }}>{n}</span>
        <span className="text-[15px] font-bold">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function ChangeSheet({ title, section, now, angle, unit, onSave, onMore, onClose }: {
  /** the pipe: "Handle", "Top track" */
  title: string;
  /** its section: "Handle 3/4″×1.5″ · 1041 · 40×18 mm" */
  section: string;
  /** its cut on this window now, µm */
  now: number | null;
  angle: 90 | 45;
  unit: StudioUnit;
  onSave: (um: number | null, angle: 90 | 45) => void;
  /** the full card (section, mesh pipe…) */
  onMore: () => void;
  onClose: () => void;
}) {
  const [raw, setRaw] = useState("");
  const [deg, setDeg] = useState<90 | 45>(angle);
  const um = readAnyLen(raw);
  const bad = raw.trim() !== "" && um === null;
  const changed = um !== null || deg !== angle;
  return (
    <Sheet title={`Change ${title}`} sub={section} onClose={onClose}>
      <div className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
        <span className="text-sm" style={{ color: "var(--ink-3)" }}>Now</span>
        <span className="mono text-lg font-bold">{now != null ? fmtLen(now, unit).replace(/~/g, "") : "Not set"} <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>· {angle}°</span></span>
      </div>

      <Step n={1} title="Your size">
        <input autoFocus className="field w-full px-3 py-3 text-lg font-semibold" inputMode="text" value={raw} onChange={(e) => setRaw(e.target.value)}
          placeholder="46.5  or  1180 mm  or  3'10.5" aria-label="Your size" />
        <p className="mt-1.5 text-xs" style={{ color: bad ? "var(--bad)" : "var(--ink-3)" }}>
          {bad ? "Type it like 46.5 (inch.sut), 1180 mm or 3'10.5 (feet)."
            : um !== null ? <>= <b className="mono" style={{ color: "var(--ink)" }}>{fmtLen(um, "in").replace(/~/g, "")}</b> · {Math.round(um / 1000)} mm</>
            : "Any unit: inch.sut, mm, cm or feet. Leave empty to keep the size."}
        </p>
      </Step>

      <Step n={2} title="Cut">
        <div className="grid grid-cols-2 gap-2">
          {([90, 45] as const).map((d) => (
            <button key={d} type="button" aria-pressed={deg === d} onClick={() => setDeg(d)}
              className={`chip py-3 text-base font-bold ${deg === d ? "selected" : ""}`}>{d}°</button>
          ))}
        </div>
      </Step>

      <button type="button" className="btn-primary mt-6 w-full py-3.5 text-base" disabled={!changed || bad} onClick={() => onSave(um, deg)}>Save</button>
      <button type="button" className="mt-3 w-full py-2 text-sm font-semibold" style={{ color: "var(--accent)" }} onClick={onMore}>More options: section, mesh pipe…</button>
    </Sheet>
  );
}
