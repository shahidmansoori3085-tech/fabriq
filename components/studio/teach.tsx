"use client";
/**
 * Teach FabriQ from a window the shop already made — the window drawn above
 * (same size and layout) — then check on another.
 */
import { useState } from "react";
import type { Um } from "../../lib/engine/units";
import type { StudioSystem, TaughtJob } from "../../lib/studio/model";
import type { StudioJob } from "../../lib/studio/evaluate";
import { teach, check, type TeachResult, type CheckRow } from "../../lib/studio/teach";
import { findProfile, type StudioLibrary } from "../../lib/studio/store";
import { partLabel } from "../../lib/studio/edit";
import { fmtLen, fmtDelta, readLen, mixText, type StudioUnit } from "../../lib/studio/format";
import { Badge, Seg, SectionTitle } from "../studio-ui";

export function TeachPanel({ sys, lib, unit, job, onChange }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; job: StudioJob; onChange: (s: StudioSystem) => void;
}) {
  const [mode, setMode] = useState<"teach" | "check">(sys.jobs.length ? "check" : "teach");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [gw, setGw] = useState("");
  const [gh, setGh] = useState("");
  const [taught, setTaught] = useState<TeachResult | null>(null);
  const [checked, setChecked] = useState<{ rows: CheckRow[]; allOk: boolean } | null>(null);

  const kinds = [...job.mix];
  const glassN = kinds.filter((k) => k !== "J").length;
  const rows = sys.sizes.map((s) => ({
    size: s,
    parts: sys.parts.filter((p) => p.enabled !== false && p.length === s.id &&
      (p.scope !== "shutter" || kinds.length > 0) && (p.scope !== "meeting" || glassN > 1)),
  })).filter((r) => r.parts.length > 0);
  const ready = rows.some((r) => readLen(vals[r.size.id] ?? "", unit) !== null) || readLen(gw, unit) !== null || readLen(gh, unit) !== null;

  const submit = () => {
    const measured: Record<string, Um> = {};
    for (const r of rows) { const v = readLen(vals[r.size.id] ?? "", unit); if (v !== null) measured[r.parts[0].id] = v; }
    const gW = readLen(gw, unit), gH = readLen(gh, unit);
    const t: TaughtJob = {
      id: `J${sys.jobs.length + 1}`, W: job.W, H: job.H, tracks: job.tracks, mix: job.mix, switches: job.switches ?? {}, measured,
      glass: gW !== null || gH !== null ? { w: gW ?? undefined, h: gH ?? undefined } : undefined, at: new Date().toISOString(),
    };
    if (mode === "teach") { const r = teach(sys, t); setTaught(r); setChecked(null); onChange(r.system); }
    else { const r = check(sys, t); setChecked(r); setTaught(null); if (r.allOk) onChange(r.system); }
  };
  const reset = () => { setVals({}); setGw(""); setGh(""); setTaught(null); setChecked(null); };

  return (
    <div>
      <div className="mt-4 flex justify-center">
        <Seg value={mode} onChange={(m) => { setMode(m); reset(); }} options={[{ value: "teach", label: "Teach" }, { value: "check", label: "Check" }]} />
      </div>
      <div className="mt-3 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
        {mode === "teach"
          ? <>Take a window you already made. Set its size and tracks in the drawing above — <b>{fmtLen(job.W, unit)} × {fmtLen(job.H, unit)}, {job.tracks}-track, {mixText(job.mix)}</b> — then type the cuts you made.</>
          : <>Set another window you made in the drawing above — <b>{fmtLen(job.W, unit)} × {fmtLen(job.H, unit)}, {job.tracks}-track</b> — and type its cuts. FabriQ compares.</>}
      </div>

      {taught && (
        <div className="card mt-4 p-4">
          <div className="text-lg font-bold">FabriQ learned your way</div>
          <div className="mt-3 flex flex-col gap-2">
            {taught.learned.map((l) => (
              <div key={l.size} className="flex items-center justify-between gap-2 text-sm">
                <span>{l.label}</span>
                <span className="flex items-center gap-2">
                  <span className="mono font-semibold">{fmtDelta(l.constant, unit)}</span>
                  <Badge tone={l.changed ? "warn" : "good"}>{l.changed ? "New" : "Same as before"}</Badge>
                </span>
              </div>
            ))}
            {taught.skipped.map((s) => <div key={s.label} className="text-sm" style={{ color: "var(--warn)" }}>{s.label}: {s.why}</div>)}
            {taught.conflicts.map((c) => <div key={c} className="text-sm" style={{ color: "var(--bad)" }}>{c}. Measure again.</div>)}
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>Each number is what you add or take off (window size, or shutter size for glass). One more window will confirm it.</p>
          <button className="btn-primary mt-4 w-full py-3" onClick={() => { reset(); setMode("check"); }}>Check with another window</button>
        </div>
      )}

      {checked && (
        <div className="card mt-4 p-4">
          <div className="text-lg font-bold" style={{ color: checked.allOk ? "var(--good)" : "var(--bad)" }}>
            {checked.allOk ? "Matches your cuts" : "Some cuts do not match"}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {checked.rows.map((x) => (
              <div key={x.label} className="rounded-lg px-3 py-2 text-sm" style={{ background: x.ok ? "var(--good-soft)" : "var(--bad-soft)" }}>
                <div className="flex justify-between font-semibold"><span>{x.label}</span><span>{x.ok ? "✓" : "✗"}</span></div>
                <div className="mt-0.5 flex justify-between text-xs" style={{ color: "var(--ink-2)" }}>
                  <span>FabriQ: {x.predicted === null ? "not known" : fmtLen(x.predicted, unit)}</span>
                  <span>You: {fmtLen(x.measured, unit)}{x.diff ? ` (${fmtDelta(x.diff, unit)})` : ""}</span>
                </div>
              </div>
            ))}
          </div>
          {!checked.allOk && <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>Measure the red ones again. If they really are different, teach from this window instead.</p>}
          <button className="btn-ghost mt-4 w-full py-3" onClick={reset}>{checked.allOk ? "Check another window" : "Try again"}</button>
        </div>
      )}

      {!taught && !checked && (
        <>
          <SectionTitle>Your cuts on this window</SectionTitle>
          <p className="-mt-1 mb-2 text-xs" style={{ color: "var(--ink-3)" }}>
            Fill the ones you know, in {unit === "mm" ? "mm" : "inch.sut (58.3 = 58″ 3 sut)"}. Leave the rest empty.
          </p>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {rows.map((r) => (
              <label key={r.size.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.size.label}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                    {r.parts.map((p) => partLabel(p)).filter((x, i, a) => a.indexOf(x) === i).join(", ")}
                    {(() => { const pr = findProfile(lib, r.parts[0].profile[r.parts[0].profile.length - 1]?.id ?? ""); return pr ? ` · ${pr.name}` : ""; })()}
                  </span>
                </span>
                <input className="field w-28 px-3 py-2 text-right font-semibold" inputMode="decimal" value={vals[r.size.id] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [r.size.id]: e.target.value }))} placeholder="—" />
              </label>
            ))}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex-1 text-sm font-semibold">Glass width × height</span>
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gw} onChange={(e) => setGw(e.target.value)} placeholder="—" aria-label="Glass width" />
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gh} onChange={(e) => setGh(e.target.value)} placeholder="—" aria-label="Glass height" />
            </div>
          </div>
          <button className="btn-primary mt-4 w-full py-3.5" disabled={!ready} onClick={submit}>
            {mode === "teach" ? "Learn from this window" : "Compare"}
          </button>
        </>
      )}

      {sys.jobs.length > 0 && (
        <>
          <SectionTitle>Windows FabriQ learned from</SectionTitle>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {sys.jobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <span className="font-semibold">{fmtLen(j.W, unit)} × {fmtLen(j.H, unit)}</span>
                <span style={{ color: "var(--ink-3)" }}>{j.tracks}-track · {mixText(j.mix)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
