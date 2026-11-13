"use client";
/** The cutting list, glass, bars to buy and hardware for the window on screen. */
import { useMemo, useState } from "react";
import type { Um } from "../../lib/engine/units";
import { packAllSections, summarize } from "../../lib/engine/cutting";
import type { StockGroup } from "../../lib/engine/types";
import { getSection } from "../../lib/engine/sections";
import type { StudioSystem } from "../../lib/studio/model";
import { evaluate, StudioUnknownError, type StudioJob, type StudioResult } from "../../lib/studio/evaluate";
import { findProfile, type StudioLibrary } from "../../lib/studio/store";
import { fmtLen, evidenceBadge, type StudioUnit } from "../../lib/studio/format";
import { Badge, SectionTitle } from "../studio-ui";

/** "4 × 16 ft + 6 ft piece" */
const stockText = (st: StockGroup[]) => st.flatMap((g) => [g.full ? `${g.full} × ${g.ft} ft` : "", ...g.pieces.map((p) => `${p} ft piece`)]).filter(Boolean).join(" + ") || "—";
const sectionName = (id: string) => { try { return getSection(id).name; } catch { return id; } };

export function CutList({ sys, lib, unit, job, onFix }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; job: StudioJob; onFix: (what: "pieces" | "teach") => void;
}) {
  const [why, setWhy] = useState(false);
  const out = useMemo((): { r: StudioResult; missing?: string[] } => {
    try { return { r: evaluate(sys, job) }; }
    catch (e) {
      if (e instanceof StudioUnknownError) return { missing: e.missing, r: evaluate(sys, job, { allowUnknown: true }) };
      throw e;
    }
  }, [sys, job]);

  const bars = useMemo(() => {
    if (out.missing) return [];
    try { return summarize(packAllSections(out.r.pieces)); } catch { return []; }
  }, [out]);

  const groups = useMemo(() => {
    const m = new Map<string, { section: string; name: string; length: Um; angle?: number; count: number }>();
    for (const p of out.r.pieces) {
      const name = p.role.replace(/^S\d+\s+/, "").replace(/\s+\d+$/, "");
      const k = `${p.sectionId}|${name}|${p.length}`;
      const g = m.get(k);
      if (g) g.count++; else m.set(k, { section: p.sectionId, name, length: p.length, angle: p.angle, count: 1 });
    }
    return [...m.values()];
  }, [out]);

  const sectionsMissing = out.missing?.filter((m) => m.startsWith("Section for")) ?? [];
  const cutsMissing = out.missing?.filter((m) => !m.startsWith("Section for")) ?? [];

  return (
    <div>
      {out.missing && (
        <div className="mt-4 rounded-xl p-4" style={{ background: "var(--warn-soft)" }}>
          <div className="font-bold" style={{ color: "var(--warn)" }}>Not ready to cut yet</div>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>FabriQ does not guess a length you will cut metal to.</p>
          {sectionsMissing.length > 0 && (
            <button onClick={() => onFix("pieces")} className="mt-3 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2.5 text-left text-sm">
              <span><b>Choose sections</b> · {sectionsMissing.map((m) => m.replace("Section for ", "")).join(", ")}</span><span aria-hidden>›</span>
            </button>
          )}
          {cutsMissing.length > 0 && (
            <button onClick={() => onFix("teach")} className="mt-2 flex w-full items-center justify-between rounded-lg bg-white px-3 py-2.5 text-left text-sm">
              <span><b>Teach from one window</b> · {cutsMissing.join(", ")}</span><span aria-hidden>›</span>
            </button>
          )}
        </div>
      )}

      {!out.missing && (
        <>
          <SectionTitle>Cutting list</SectionTitle>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)", background: "var(--surface-2)" }}>
              <span>Piece</span><span className="text-right">Length</span><span className="text-center">Cut</span><span className="text-right">Qty</span>
            </div>
            {[...new Set(groups.map((g) => g.section))].map((sec) => {
              const pr = findProfile(lib, sec);
              return (
                <div key={sec} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <div className="px-3 pt-2 text-xs font-bold" style={{ color: "var(--accent)" }}>
                    {pr?.name ?? sectionName(sec)}{pr?.codes && Object.values(pr.codes)[0] ? ` · ${Object.values(pr.codes)[0]}` : ""}
                  </div>
                  {groups.filter((g) => g.section === sec).map((g, i) => (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-3 py-1.5 text-sm">
                      <span className="truncate">{g.name}</span>
                      <span className="mono text-right font-semibold">{fmtLen(g.length, unit)}</span>
                      <span className="rounded px-1.5 text-center text-[11px] font-bold" style={{ background: g.angle === 45 ? "var(--glass-soft)" : "var(--surface-3)", color: g.angle === 45 ? "var(--glass)" : "var(--ink-3)" }}>{g.angle ?? 90}°</span>
                      <span className="text-right tabnum font-bold">{g.count}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {out.r.panels.length > 0 && (
            <>
              <SectionTitle>Glass and mesh</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {out.r.panels.map((p) => (
                  <div key={p.kind} className="flex justify-between px-3 py-2.5 text-sm">
                    <span className="font-semibold">{p.kind === "jali" ? "Mesh" : p.kind === "sheet" ? "Sheet" : "Glass"}</span>
                    <span className="mono">{fmtLen(p.w, unit)} × {fmtLen(p.h, unit)} <b>× {p.count}</b></span>
                  </div>
                ))}
              </div>
            </>
          )}

          {bars.length > 0 && (
            <>
              <SectionTitle>Bars to buy</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {bars.map((b) => (
                  <div key={b.sectionId} className="flex justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="truncate">{findProfile(lib, b.sectionId)?.name ?? sectionName(b.sectionId)}</span>
                    <span className="shrink-0 font-semibold">{stockText(b.stock)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {out.r.hardware.length > 0 && (
            <>
              <SectionTitle>Hardware</SectionTitle>
              <div className="card divide-y" style={{ borderColor: "var(--line)" }}>
                {out.r.hardware.map((x) => (
                  <div key={x.id} className="flex justify-between px-3 py-2.5 text-sm">
                    <span>{x.name}</span>
                    <span className="font-semibold">{x.unit === "rft" ? `${Math.ceil(x.qty * (1 + sys.wastagePct / 100))} ft` : x.qty}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button onClick={() => setWhy(!why)} className="mt-5 text-sm font-semibold" style={{ color: "var(--accent)" }} aria-expanded={why}>
        {why ? "Hide" : "Where does each number come from?"}
      </button>
      {why && (
        <div className="card mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
          {out.r.sizes.map((s) => (
            <div key={s.id} className="px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{s.label}</span>
                <span className="mono font-semibold">{s.value === null ? "?" : fmtLen(s.value, unit)}</span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--ink-3)" }}>
                <span className="mono">{s.formula.replace(/(\d+(?:\.\d+)?) mm/g, (_, n) => fmtLen(Math.round(parseFloat(n) * 1000), unit))}</span>
                {(() => { const b = evidenceBadge(s.status, s.source ?? "", s.value !== null); return <Badge tone={b.tone}>{b.label}</Badge>; })()}
              </div>
              {s.source && <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>{s.source}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
