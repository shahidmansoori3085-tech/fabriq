"use client";
/**
 * Make FabriQ cut like this shop: type two windows it already made. The first
 * teaches the shop's own numbers; the second checks them (or teaches again
 * when it differs). Sizes in feet, inch or mm.
 */
import { useState } from "react";
import type { Um } from "../../lib/engine/units";
import type { StudioSystem, TaughtJob } from "../../lib/studio/model";
import { jobVars, matches, computeSizes, type StudioJob } from "../../lib/studio/evaluate";
import { windowGeometry } from "../../lib/studio/geometry";
import WindowDrawing from "../studio-drawing";
import { pipeLabels } from "./window-parts";
import { teach, check, type TeachResult, type CheckRow } from "../../lib/studio/teach";
import { findProfile, type StudioLibrary } from "../../lib/studio/store";
import { partLabel } from "../../lib/studio/edit";
import { fmtLen, fmtDelta, readLen, lenToInput, mixText, layoutLabel, sectionTitle, UNIT_HINT, type StudioUnit } from "../../lib/studio/format";
import { Badge, Field, SectionTitle, Seg } from "../studio-ui";

/** time of a teach (called from event handlers only) */
const stampNow = () => Date.now();

export function TeachPanel({ sys, lib, unit, onUnit, job, onChange }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; onUnit: (u: StudioUnit) => void; job: StudioJob; onChange: (s: StudioSystem) => void;
}) {
  const [mode, setMode] = useState<"teach" | "check">(sys.jobs.length ? "check" : "teach");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [gw, setGw] = useState("");
  const [gh, setGh] = useState("");
  const [taught, setTaught] = useState<TeachResult | null>(null);
  const [checked, setChecked] = useState<{ rows: CheckRow[]; allOk: boolean } | null>(null);
  // the window the shop made — starts from the drawing above, typed here
  const [ws, setWs] = useState(lenToInput(job.W, unit));
  const [hs, setHs] = useState(lenToInput(job.H, unit));
  const [tracks, setTracks] = useState(job.tracks);
  const [mix, setMix] = useState(job.mix);
  const W = readLen(ws, unit), H = readLen(hs, unit);
  const win: StudioJob = { ...job, W: W ?? job.W, H: H ?? job.H, tracks, mix };
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];

  const kinds = [...win.mix];
  const glassN = kinds.filter((k) => k !== "J").length;
  const winVars = jobVars(sys, win);
  const rows = sys.sizes.map((s) => ({
    size: s,
    parts: sys.parts.filter((p) => p.enabled !== false && p.length === s.id && matches(p.when, winVars) &&
      (p.scope !== "shutter" || kinds.length > 0) && (p.scope !== "meeting" || glassN > 1)),
  })).filter((r) => r.parts.length > 0);
  const sizeOk = W !== null && H !== null;
  // what the app cuts for this window: shown beside every box, and on the drawing
  const app = computeSizes(sys, win).values;
  const appText = (id: string) => { const v = app[id]; return v != null ? fmtLen(v, unit).replace(/~/g, "") : "—"; };
  const geo = windowGeometry(sys, win, (id) => findProfile(lib, id));
  const labels = pipeLabels(sys, lib, winVars, app, unit);
  const diffOf = (id: string, typed: string) => { const t = readLen(typed, unit), a = app[id]; return t !== null && a != null ? t - a : null; };
  const ready = sizeOk && rows.some((r) => readLen(vals[r.size.id] ?? "", unit) !== null) || readLen(gw, unit) !== null || readLen(gh, unit) !== null;

  const submit = (as: "teach" | "check" = mode) => {
    const measured: Record<string, Um> = {};
    for (const r of rows) { const v = readLen(vals[r.size.id] ?? "", unit); if (v !== null) measured[r.parts[0].id] = v; }
    const gW = readLen(gw, unit), gH = readLen(gh, unit);
    const t: TaughtJob = {
      id: `J${sys.jobs.length + 1}`, W: win.W, H: win.H, tracks: win.tracks, mix: win.mix, switches: job.switches ?? {}, measured,
      glass: gW !== null || gH !== null ? { w: gW ?? undefined, h: gH ?? undefined } : undefined, at: new Date().toISOString(),
    };
    if (as === "teach") { const r = teach(sys, t); setMode("teach"); setTaught(r); setChecked(null); onChange({ ...r.system, taughtAt: stampNow() }); }
    else { const r = check(sys, t); setChecked(r); setTaught(null); if (r.allOk) onChange({ ...r.system, taughtAt: stampNow() }); }
  };
  const switchUnit = (u: StudioUnit) => {
    const conv = (v: string) => { const x = readLen(v, unit); return x === null ? v : lenToInput(x, u); };
    setWs(conv(ws)); setHs(conv(hs)); setGw(conv(gw)); setGh(conv(gh));
    setVals((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, conv(v)])));
    onUnit(u);
  };
  const reset = () => { setVals({}); setGw(""); setGh(""); setTaught(null); setChecked(null); };
  const step = mode === "teach" ? 1 : 2;

  return (
    <div>
      <div className="card mt-4 flex items-center gap-2 p-2">
        {[1, 2].map((n) => {
          const done = n === 1 ? sys.jobs.length > 0 : sys.jobs.length > 1;
          const on = step === n;
          return (
            <button key={n} type="button" onClick={() => { setMode(n === 1 ? "teach" : "check"); reset(); }} aria-pressed={on}
              className="flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
              style={{ background: on ? "var(--surface-2)" : "transparent" }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold"
                style={{ background: done ? "var(--good)" : on ? "var(--accent)" : "var(--surface-3)", color: done || on ? "#fff" : "var(--ink-3)" }}>{done ? "✓" : n}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">Window {n}</span>
                <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{n === 1 ? "Sets your cuts" : "Confirms them"}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!taught && !checked && (
        <div className="card mt-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-bold">Window {step}: the size you made</div>
            <Seg small value={unit === "mm" ? "mm" : "in"} onChange={switchUnit} options={[{ value: "in", label: "inch.sut" }, { value: "mm", label: "mm" }]} />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <Field label="Width">
              <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={ws} onChange={(e) => setWs(e.target.value)} />
            </Field>
            <span className="pb-2.5 text-lg" style={{ color: "var(--ink-3)" }}>×</span>
            <Field label="Height">
              <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={hs} onChange={(e) => setHs(e.target.value)} />
            </Field>
          </div>
          {!sizeOk && <p className="mt-1 text-xs" style={{ color: "var(--warn)" }}>Type the size as {UNIT_HINT[unit]}.</p>}
          {sizeOk && <div className="mt-3 rounded-xl border bg-white px-1" style={{ borderColor: "var(--line)" }}>
            <WindowDrawing g={geo} unit={unit} pick={null} labels={labels} infill={app[sys.infill.w] != null && app[sys.infill.h] != null ? `${fmtLen(app[sys.infill.w]!, unit)} × ${fmtLen(app[sys.infill.h]!, unit)}` : undefined} />
          </div>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sys.layouts.map((l) => (
              <button key={l.tracks} onClick={() => { setTracks(l.tracks); setMix(l.mixes[0]); }} aria-pressed={l.tracks === tracks}
                className={`chip px-3 py-1.5 text-sm ${l.tracks === tracks ? "selected" : ""}`}>{layoutLabel(sys, l.tracks)}</button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(lay?.mixes ?? []).map((m) => (
              <button key={m} onClick={() => setMix(m)} aria-pressed={m === mix}
                className={`chip px-2.5 py-1 text-xs ${m === mix ? "selected" : ""}`}>{mixText(m)}</button>
            ))}
          </div>
        </div>
      )}

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
          <button className="btn-primary mt-4 w-full py-3" onClick={() => { reset(); setMode("check"); }}>Next: confirm with window 2</button>
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
          {!checked.allOk && <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>Measure the red ones again. If they really are what you cut, learn from this window instead.</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-ghost py-3" onClick={reset}>{checked.allOk ? "Confirm another" : "Try again"}</button>
            {!checked.allOk && <button className="btn-primary py-3" onClick={() => submit("teach")}>Learn from this one</button>}
          </div>
        </div>
      )}

      {!taught && !checked && (
        <>
          <SectionTitle>What you cut on this window</SectionTitle>
          <p className="-mt-1 mb-2 text-xs" style={{ color: "var(--ink-3)" }}>
            The app&apos;s cut is shown on each line. Type yours where you know it ({UNIT_HINT[unit]}).
          </p>
          <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
            {rows.map((r) => (
              <label key={r.size.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.parts.map((p) => partLabel(p)).filter((x, i, a) => a.indexOf(x) === i).join(", ")}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                    App: <b className="mono" style={{ color: "var(--ink-2)" }}>{appText(r.size.id)}</b>
                    {(() => { const vars = jobVars(sys, win); const spec = r.parts[0].profile.find((x) => matches(x.when, vars)); const pr = findProfile(lib, spec?.id ?? ""); return pr ? ` · ${sectionTitle(pr.name)}` : ""; })()}
                  </span>
                </span>
                {(() => { const d = diffOf(r.size.id, vals[r.size.id] ?? ""); return d !== null && d !== 0
                  ? <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{fmtDelta(d, unit)}</span>
                  : d === 0 ? <span className="shrink-0 text-xs font-bold" style={{ color: "var(--good)" }}>Same</span> : null; })()}
                <input className="field w-28 px-3 py-2 text-right font-semibold" inputMode="decimal" value={vals[r.size.id] ?? ""}
                  onChange={(e) => setVals((v) => ({ ...v, [r.size.id]: e.target.value }))} placeholder={appText(r.size.id)} />
              </label>
            ))}
            <div className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Glass</span>
                <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>App: <b className="mono" style={{ color: "var(--ink-2)" }}>{appText(sys.infill.w)} × {appText(sys.infill.h)}</b></span>
              </span>
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gw} onChange={(e) => setGw(e.target.value)} placeholder={appText(sys.infill.w)} aria-label="Glass width" />
              <input className="field w-20 px-2 py-2 text-right font-semibold" inputMode="decimal" value={gh} onChange={(e) => setGh(e.target.value)} placeholder={appText(sys.infill.h)} aria-label="Glass height" />
            </div>
          </div>
          <button className="btn-primary mt-4 w-full py-3.5" disabled={!ready} onClick={() => submit()}>
            {mode === "teach" ? "Use my cuts" : "Confirm with window 2"}
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
