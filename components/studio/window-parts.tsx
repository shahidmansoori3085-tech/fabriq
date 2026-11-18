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

/** the shop's name for a pipe by what it is (Handle, Interlock, Bearing…), whatever the catalogue calls it */
export const KIND_NAMES: Record<string, string> = {
  handle: "Handle", interlock: "Interlock", "slim-interlock": "Slim interlock", bearing: "Bearing", track: "Track",
  shutter: "Shutter pipe", "shutter-rail": "Shutter top / bottom", "mesh-shutter": "Mesh shutter pipe", "interlock-patti": "Interlock patti",
  rail: "Rail", bead: "Glazing clip", mullion: "Mullion", frame: "Frame",
};
const FRAME_NAME: Record<string, string> = { "frame-top": "Top track", "frame-bottom": "Bottom track", "frame-left": "Left side", "frame-right": "Right side" };

/** Each pipe's name and cut on this window, for the drawing (part id → { name, value }). */
export function pipeLabels(sys: StudioSystem, lib: StudioLibrary, vars: Record<string, string>, values: Record<string, Um | null>, unit: StudioUnit) {
  const out: Record<string, { name: string; value: string }> = {};
  for (const q of sys.parts) {
    const v = values[q.length];
    if (q.enabled === false || v == null) continue;
    const pr = findProfile(lib, (q.profile.find((c) => matches(c.when, vars)) ?? q.profile[q.profile.length - 1])?.id ?? "");
    const kind = pr?.kind && KIND_NAMES[pr.kind];
    const frame = q.place ? FRAME_NAME[q.place] : undefined;
    const name = frame ? (sys.family === "casement" ? frame.replace("track", "frame") : frame)
      : kind ? `${kind}${q.place === "sash-top" ? " · top" : q.place === "sash-bottom" ? " · bottom" : ""}` : q.role.replace(/\{[a-z]+\}/g, "").trim();
    out[q.id] = { name, value: fmtLen(v, unit).replace(/~/g, "") };
  }
  return out;
}

/** where a pipe goes, in plain words (founder 2026-11-18: a hint under each pipe) */
const USE: Record<string, string> = {
  "frame-top": "Top of the window. The shutters hang in it.",
  "frame-bottom": "Bottom of the window. The shutters roll on it.",
  "frame-left": "Left side of the window.",
  "frame-right": "Right side of the window.",
  "sash-lock": "Outer side of the shutter. The lock goes here.",
  "sash-meet": "Where two shutters meet and lock together.",
  "sash-top": "Top of the shutter.",
  "sash-bottom": "Bottom of the shutter. The rollers sit in it.",
  meeting: "Fixed on the glass shutter where two shutters meet.",
  mullion: "Between two sashes.",
};

/** the pencil that says "you can change this" */
function Pen() {
  return (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
    </span>
  );
}

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
  // the shop's name for the pipe (Handle, Interlock, Bearing…), whatever the catalogue calls it
  const code = (pr?: { codes?: Record<string, string>; size?: string }) =>
    [[...new Set(Object.values(pr?.codes ?? {}).filter(Boolean))].join(" / "), pr?.size ? `${pr.size} mm` : ""].filter(Boolean).join(" · ");
  const line = (key: string, title: string, sub: string, value: string, on: boolean, onClick: () => void, badge?: string, hint?: string) => (
    <button key={key} type="button" onClick={onClick} aria-label={`Change ${title}`}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left" style={{ background: on ? "var(--surface-2)" : undefined }}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{title}{badge && <span className="ml-1.5 text-[11px] font-bold" style={{ color: "var(--accent)" }}>{badge}</span>}</span>
        {hint && <span className="block text-xs leading-snug" style={{ color: "var(--ink-2)" }}>{hint}</span>}
        <span className="block truncate text-[11px]" style={{ color: "var(--ink-3)" }}>{sub}</span>
      </span>
      <span className="mono shrink-0 text-[15px] font-bold">{value}</span>
      <Pen />
    </button>
  );
  const rows = (ms: Member[], mesh: boolean, frame: boolean) => {
    const seen = new Set<string>();
    return ms
      .filter((m) => (seen.has(m.partId) ? false : (seen.add(m.partId), true)))
      .sort((a, b) => ORDER.indexOf(a.place) - ORDER.indexOf(b.place))
      .map((m) => {
        const p = sys.parts.find((x) => x.id === m.partId);
        const pr = sectionOf(m.partId, mesh);
        const on = pick?.type === "part" && pick.id === m.partId;
        const value = len(p ? values[p.length] : null);
        // a Normal window cut 45° on its track or shutter shows it on every piece
        const cut45 = frame ? vars.joint === "45" || (vars.joint !== "90" && m.angle === 45) : vars.sash === "45" || (vars.sash !== "90" && m.angle === 45);
        const badge = cut45 ? "45°" : undefined;
        if (frame) return line(m.partId, PLACE[m.place] ?? "Piece", [pr ? sectionTitle(pr.name) : "No section", code(pr)].filter(Boolean).join(" · "), value, on, () => onPick({ type: "part", id: m.partId }), badge, USE[m.place]);
        const name = (pr?.kind && KIND_NAMES[pr.kind]) || (p ? p.role.replace(/{[a-z]+}/g, "").replace(/(Top|Bottom)/g, "").trim() : "Piece");
        return line(m.partId, name, [pr ? sectionTitle(pr.name) : "", code(pr)].filter(Boolean).join(" · "), value, on, () => onPick({ type: "part", id: m.partId }), badge, USE[m.place]);
      });
  };
  const fill = (k: string) => (k === "J" ? "Mesh" : k === "S" ? "Sheet" : "Glass");
  const pane = `${len(values[sys.infill.w])} × ${len(values[sys.infill.h])}`;
  const head = (title: string, right?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-[15px] font-bold">{title}</span>
      {right}
    </div>
  );

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="flex items-center gap-2 px-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
        <Pen /> Tap any line to change its pipe or its cut.
      </p>
      <div className="card overflow-hidden">
        {head(sys.family === "casement" ? "Frame" : `Track · ${vars.tracks ?? geo.shutters.length}-track`, <span className="text-xs" style={{ color: "var(--ink-3)" }}>{vars.joint === "45" || (vars.joint !== "90" && geo.frame.some((m) => m.angle === 45)) ? "45° cut" : "90° cut"}</span>)}
        <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>{rows(geo.frame, false, true)}</div>
      </div>
      {geo.shutters.map((s) => {
        const mesh = s.kind === "J";
        const on = pick?.type === "shutter" && pick.index === s.index;
        return (
          <div key={s.index} className="card overflow-hidden">
            {head(`Shutter ${s.index + 1} · ${fill(mix[s.index] ?? s.kind)}`)}
            <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>
              {rows([...geo.sash.filter((m) => m.shutter === s.index), ...geo.patti.filter((m) => m.shutter === s.index)], mesh, false)}
              {line(`pane${s.index}`, fill(mix[s.index] ?? s.kind), "Width × height", pane, on, () => onPick({ type: "shutter", index: s.index }), undefined, mesh ? "The mesh fits inside the shutter." : "The glass fits inside the shutter.")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
