"use client";
/**
 * The window told part by part, under the drawing (founder 2026-11-18: "sirf window
 * par tap karne se nahi, alag se bhi"): the track, then every shutter on its own —
 * each pipe with its section and cut. Tapping a line opens the same card as
 * tapping the pipe on the drawing.
 */
import type { Um } from "../../lib/engine/units";
import type { StudioSystem } from "../../lib/studio/model";
import type { WindowGeo, Member } from "../../lib/studio/geometry";
import { matches } from "../../lib/studio/evaluate";
import { findProfile, type StudioLibrary } from "../../lib/studio/store";
import { fmtLen, sectionTitle, type StudioUnit } from "../../lib/studio/format";
import type { Pick } from "../studio-drawing";

const PLACE: Record<string, string> = {
  "frame-top": "Top", "frame-bottom": "Bottom", "frame-left": "Left side", "frame-right": "Right side",
  "sash-lock": "Handle side", "sash-meet": "Meeting side", "sash-top": "Top", "sash-bottom": "Bottom",
  meeting: "Interlock patti", mullion: "Mullion",
};
const ORDER = ["frame-top", "frame-bottom", "frame-left", "frame-right", "sash-lock", "sash-meet", "sash-top", "sash-bottom", "meeting"];

export function WindowParts({ sys, lib, unit, geo, values, vars, mix, pick, onPick }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; geo: WindowGeo;
  values: Record<string, Um | null>; vars: Record<string, string>; mix: string;
  pick: Pick; onPick: (p: Pick) => void;
}) {
  const len = (um: Um | null | undefined) => (um != null ? fmtLen(um, unit).replace(/~/g, "") : "—");
  const sectionOf = (partId: string, mesh: boolean) => {
    const p = sys.parts.find((x) => x.id === partId);
    if (!p) return undefined;
    const id = mesh && p.meshProfile ? p.meshProfile : (p.profile.find((c) => matches(c.when, vars)) ?? p.profile[p.profile.length - 1])?.id;
    return findProfile(lib, id ?? "");
  };
  const rows = (ms: Member[], mesh: boolean) => {
    const seen = new Set<string>();
    return ms
      .filter((m) => (seen.has(m.partId) ? false : (seen.add(m.partId), true)))
      .sort((a, b) => ORDER.indexOf(a.place) - ORDER.indexOf(b.place))
      .map((m) => {
        const p = sys.parts.find((x) => x.id === m.partId);
        const pr = sectionOf(m.partId, mesh);
        const on = pick?.type === "part" && pick.id === m.partId;
        return (
          <button key={m.partId} type="button" onClick={() => onPick({ type: "part", id: m.partId })}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left" style={{ background: on ? "var(--surface-2)" : undefined }}>
            <span className="w-[92px] shrink-0 text-sm font-semibold">{PLACE[m.place] ?? "Piece"}</span>
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--ink-3)" }}>{pr ? sectionTitle(pr.name) : "No section"}</span>
            <span className="mono shrink-0 text-[15px] font-bold">{len(p ? values[p.length] : null)}</span>
            {m.angle === 45 && <span className="shrink-0 text-[11px] font-bold" style={{ color: "var(--accent)" }}>45°</span>}
          </button>
        );
      });
  };
  const fill = (k: string) => (k === "J" ? "Mesh" : k === "S" ? "Sheet" : "Glass");
  const pane = `${len(values[sys.infill.w])} × ${len(values[sys.infill.h])}`;
  const head = (title: string, right?: React.ReactNode, onClick?: () => void, on?: boolean) => (
    <button type="button" onClick={onClick} disabled={!onClick} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      style={{ background: on ? "var(--surface-2)" : undefined }}>
      <span className="text-[15px] font-bold">{title}</span>
      {right}
    </button>
  );

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="card overflow-hidden">
        {head(sys.family === "casement" ? "Frame" : `Track · ${vars.tracks ?? geo.shutters.length}-track`, <span className="text-xs" style={{ color: "var(--ink-3)" }}>{geo.frame.some((m) => m.angle === 45) ? "45° cut" : "90° cut"}</span>)}
        <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>{rows(geo.frame, false)}</div>
      </div>
      {geo.shutters.map((s) => {
        const mesh = s.kind === "J";
        const on = pick?.type === "shutter" && pick.index === s.index;
        return (
          <div key={s.index} className="card overflow-hidden">
            {head(`Shutter ${s.index + 1} · ${fill(mix[s.index] ?? s.kind)}`,
              <span className="mono text-sm font-bold" style={{ color: "var(--ink-2)" }}>{pane}</span>,
              () => onPick({ type: "shutter", index: s.index }), on)}
            <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>
              {rows([...geo.sash.filter((m) => m.shutter === s.index), ...geo.patti.filter((m) => m.shutter === s.index)], mesh)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
