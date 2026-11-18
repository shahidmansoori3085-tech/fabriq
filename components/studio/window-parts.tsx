"use client";
/**
 * The window told part by part, under the drawing (founder 2026-11-18: "sirf window
 * par tap karne se nahi, alag se bhi"): the track, then every shutter on its own —
 * each pipe with its section and cut. Tapping a line opens the same card as
 * tapping the pipe on the drawing.
 */
import type { Um } from "../../lib/engine/units";
import { useEffect, useRef, useState } from "react";
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

/** How much a 45° pipe loses on its inside edge (µm): the faces of the two pipes it meets at its
 *  corners — a side meets the top and bottom, a top or bottom meets the two sides. */
export function insideLoss(m: Member, geo: WindowGeo): number {
  const pool = m.place.startsWith("frame") ? geo.frame : geo.sash.filter((x) => x.shutter === m.shutter);
  const fam = m.place.startsWith("frame") ? "frame" : "sash";
  const ends = m.vertical ? [`${fam}-top`, `${fam}-bottom`] : fam === "frame" ? ["frame-left", "frame-right"] : ["sash-lock", "sash-meet"];
  // a shutter top / bottom: the interlock takes as much of the width as the handle (its hook only
  // laps over), so both ends lose the handle's face — the same as the 90° bearing (shutter − 80 mm)
  const lock = pool.find((x) => x.place === "sash-lock")?.face;
  const faces = ends.map((pl) => (fam === "sash" && !m.vertical && lock ? lock : pool.find((x) => x.place === pl)?.face ?? m.face ?? 0));
  return Math.round((faces[0] + faces[1]) * 1000);
}

/** Each pipe's name and cut on this window, for the drawing (part id → { name, value }). */
/** A pipe is cut 45° at both ends: on a Normal window by its track / shutter choice, else by its own angle. */
export function cut45(m: Member, vars: Record<string, string>): boolean {
  const key = m.place.startsWith("frame") ? "joint" : m.place.startsWith("sash") ? "sash" : "";
  return key && vars[key] ? vars[key] === "45" : m.angle === 45;
}

/** Each pipe's name and cut on this window, for the drawing (part id → { name, value, inside }).
 *  A 45° pipe also gives its inside length: outside − its face at each end. */
export function pipeLabels(sys: StudioSystem, lib: StudioLibrary, vars: Record<string, string>, values: Record<string, Um | null>, unit: StudioUnit, geo?: WindowGeo) {
  const out: Record<string, { name: string; value: string; inside?: string }> = {};
  const member = (id: string) => geo && [...geo.frame, ...geo.sash].find((m) => m.partId === id);
  for (const q of sys.parts) {
    const v = values[q.length];
    if (q.enabled === false || v == null) continue;
    const pr = findProfile(lib, (q.profile.find((c) => matches(c.when, vars)) ?? q.profile[q.profile.length - 1])?.id ?? "");
    const kind = pr?.kind && KIND_NAMES[pr.kind];
    const frame = q.place ? FRAME_NAME[q.place] : undefined;
    const name = frame ? (sys.family === "casement" ? frame.replace("track", "frame") : frame)
      : kind ? `${kind}${q.place === "sash-top" ? " · top" : q.place === "sash-bottom" ? " · bottom" : ""}` : q.role.replace(/\{[a-z]+\}/g, "").trim();
    const m = member(q.id);
    const inside = m && geo && cut45(m, vars) ? fmtLen(v - insideLoss(m, geo), unit).replace(/~/g, "") : undefined;
    out[q.id] = { name, value: fmtLen(v, unit).replace(/~/g, ""), inside };
  }
  return out;
}

type Lab = Record<string, { name: string; value: string; inside?: string }>;

/** One tappable pipe in a small drawing, with its name and cut beside it. */
function Bar({ x, y, w, h, on, onTap }: { x: number; y: number; w: number; h: number; on: boolean; onTap: () => void }) {
  return <rect x={x} y={y} width={w} height={h} rx={2} fill={on ? "var(--accent)" : "#cfd5dc"} stroke={on ? "var(--accent)" : "#8b95a1"} strokeWidth={1}
    style={{ cursor: "pointer" }} onClick={onTap} />;
}
function Tag({ x, y, l, anchor = "middle", on }: { x: number; y: number; l?: { name: string; value: string; inside?: string }; anchor?: "start" | "middle" | "end"; on?: boolean }) {
  if (!l) return null;
  return (
    <g pointerEvents="none">
      <text x={x} y={y} textAnchor={anchor} fontSize={10} fontWeight={600} fill={on ? "var(--accent)" : "#64748b"} fontFamily="ui-sans-serif, system-ui">{l.name}</text>
      <text x={x} y={y + 14} textAnchor={anchor} fontSize={13} fontWeight={800} fill={on ? "var(--accent)" : "#0f172a"} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{l.value}</text>
      {l.inside && <text x={x} y={y + 26} textAnchor={anchor} fontSize={9.5} fill="#64748b" fontFamily="ui-sans-serif, system-ui">inside {l.inside}</text>}
    </g>
  );
}

/** The track alone: four pipes round the opening, each with its cut. */
function TrackSketch({ geo, labels, pick, onPick }: { geo: WindowGeo; labels: Lab; pick: Pick; onPick: (p: Pick) => void }) {
  const at = (pl: string) => geo.frame.find((m) => m.place === pl);
  const t = 14, X = 70, Y = 34, W = 200, H = 128;
  const one = (pl: string, x: number, y: number, w: number, h: number) => {
    const m = at(pl);
    return m && <Bar key={pl} x={x} y={y} w={w} h={h} on={pick?.type === "part" && pick.id === m.partId} onTap={() => onPick({ type: "part", id: m.partId })} />;
  };
  const lab = (pl: string) => { const m = at(pl); return m ? labels[m.partId] : undefined; };
  const on = (pl: string) => { const m = at(pl); return !!m && pick?.type === "part" && pick.id === m.partId; };
  return (
    <svg viewBox="0 0 340 210" className="block h-auto w-full select-none" role="img" aria-label="Track">
      <rect x={X} y={Y} width={W} height={H} fill="#f1f5f9" />
      {one("frame-top", X, Y, W, t)}{one("frame-bottom", X, Y + H - t, W, t)}
      {one("frame-left", X, Y, t, H)}{one("frame-right", X + W - t, Y, t, H)}
      <Tag x={X + W / 2} y={Y - 20} l={lab("frame-top")} on={on("frame-top")} />
      <Tag x={X + W / 2} y={Y + H + 14} l={lab("frame-bottom")} on={on("frame-bottom")} />
      <Tag x={X - 8} y={Y + H / 2 - 10} l={lab("frame-left")} anchor="end" on={on("frame-left")} />
      <Tag x={X + W + 8} y={Y + H / 2 - 10} l={lab("frame-right")} anchor="start" on={on("frame-right")} />
    </svg>
  );
}

/** One shutter alone: its four pipes round the glass or mesh, each with its cut. */
function ShutterSketch({ geo, index, kind, labels, pane, pick, onPick }: {
  geo: WindowGeo; index: number; kind: string; labels: Lab; pane: string; pick: Pick; onPick: (p: Pick) => void;
}) {
  const s = geo.shutters[index];
  const mine = geo.sash.filter((m) => m.shutter === index);
  const at = (pl: string) => mine.find((m) => m.place === pl);
  const lockLeft = s?.lockSide !== "right";
  const t = 14, X = 92, Y = 30, W = 156, H = 176;
  const sideX = (pl: "sash-lock" | "sash-meet") => ((pl === "sash-lock") === lockLeft ? X : X + W - t);
  const one = (pl: string, x: number, y: number, w: number, h: number) => {
    const m = at(pl);
    return m && <Bar key={pl} x={x} y={y} w={w} h={h} on={pick?.type === "part" && pick.id === m.partId} onTap={() => onPick({ type: "part", id: m.partId })} />;
  };
  const lab = (pl: string) => { const m = at(pl); return m ? labels[m.partId] : undefined; };
  const on = (pl: string) => { const m = at(pl); return !!m && pick?.type === "part" && pick.id === m.partId; };
  const patti = geo.patti.find((m) => m.shutter === index);
  const meetLeft = !lockLeft;
  return (
    <svg viewBox="0 0 340 250" className="block h-auto w-full select-none" role="img" aria-label={`Shutter ${index + 1}`}>
      <defs>
        <pattern id={`mesh${index}`} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0L6 6M6 0L0 6" stroke="#a3acb7" strokeWidth="0.6" /></pattern>
      </defs>
      <rect x={X + t} y={Y + t} width={W - 2 * t} height={H - 2 * t} fill={kind === "J" ? `url(#mesh${index})` : kind === "S" ? "#e7e5e4" : "#dbeafe"}
        style={{ cursor: "pointer" }} onClick={() => onPick({ type: "shutter", index })} />
      {one("sash-top", X, Y, W, t)}{one("sash-bottom", X, Y + H - t, W, t)}
      {one("sash-lock", sideX("sash-lock"), Y, t, H)}{one("sash-meet", sideX("sash-meet"), Y, t, H)}
      {patti && <rect x={meetLeft ? X - 7 : X + W + 1} y={Y + 8} width={6} height={H - 16} rx={1.5} fill={pick?.type === "part" && pick.id === patti.partId ? "var(--accent)" : "#9aa3ad"}
        style={{ cursor: "pointer" }} onClick={() => onPick({ type: "part", id: patti.partId })} />}
      <text x={X + W / 2} y={Y + H / 2 - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#5b7a9a" pointerEvents="none">{kind === "J" ? "Mesh" : kind === "S" ? "Sheet" : "Glass"}</text>
      <text x={X + W / 2} y={Y + H / 2 + 11} textAnchor="middle" fontSize={11.5} fontWeight={800} fill="#1e3a5f" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" pointerEvents="none">{pane}</text>
      <Tag x={X + W / 2} y={Y - 16} l={lab("sash-top")} on={on("sash-top")} />
      <Tag x={X + W / 2} y={Y + H + 12} l={lab("sash-bottom")} on={on("sash-bottom")} />
      <Tag x={lockLeft ? X - 10 : X + W + 10} y={Y + H / 2 - 30} l={lab("sash-lock")} anchor={lockLeft ? "end" : "start"} on={on("sash-lock")} />
      <Tag x={lockLeft ? X + W + 10 : X - 10} y={Y + H / 2 + 6} l={patti ? labels[patti.partId] ? { ...labels[patti.partId] } : lab("sash-meet") : lab("sash-meet")} anchor={lockLeft ? "start" : "end"} on={on("sash-meet")} />
    </svg>
  );
}

/** A finger swiping sideways: shown on the shutters until the shop swipes once. */
function SwipeHand() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <style>{`@keyframes fq-swipe { 0% { transform: translateX(40px); opacity: 0 } 15% { opacity: 1 } 70% { transform: translateX(-40px); opacity: 1 } 100% { transform: translateX(-40px); opacity: 0 } }`}</style>
      <div className="flex flex-col items-center gap-1 rounded-2xl px-4 py-3" style={{ background: "rgba(15,23,42,0.72)", color: "#fff" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: "fq-swipe 1.6s ease-in-out infinite" }}>
          <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2" /><path d="M15 11a1.5 1.5 0 0 1 3 0v3a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4 14.5a1.5 1.5 0 0 1 2.5-1.6L9 15" />
        </svg>
        <span className="text-xs font-bold">Swipe for the next shutter</span>
      </div>
    </div>
  );
}

/** the pencil that says "you can change this" */
function Pen() {
  return (
    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--surface-2)", color: "var(--accent)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
    </span>
  );
}

export function WindowParts({ sys, lib, unit, geo, values, vars, mix, pick, onPick, onSys, onKind }: {
  sys: StudioSystem; lib: StudioLibrary; unit: StudioUnit; geo: WindowGeo;
  values: Record<string, Um | null>; vars: Record<string, string>; mix: string;
  pick: Pick; onPick: (p: Pick) => void;
  /** a choice on the shutters changed the system (the note says what) */
  onSys: (s: StudioSystem, note?: string) => void;
  /** a shutter became glass, mesh or sheet */
  onKind: (index: number, k: "G" | "J" | "S") => void;
}) {
  const labels = pipeLabels(sys, lib, vars, values, unit, geo);
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [hint, setHint] = useState(false);
  const HINT_KEY = "fabriq.swipeHint";
  useEffect(() => {
    // first time on this phone: a hand shows the swipe once
    try { if (!localStorage.getItem(HINT_KEY) && geo.shutters.length > 1) { const t = setTimeout(() => setHint(true), 600); return () => clearTimeout(t); } } catch { /* fine */ }
  }, [geo.shutters.length]);
  const onScroll = () => {
    const el = strip.current;
    if (!el) return;
    // the card nearest the middle of the strip is the one being looked at
    const mid = el.scrollLeft + el.clientWidth / 2;
    const kids = [...el.children] as HTMLElement[];
    const i = kids.reduce((best, c, j) => (Math.abs(c.offsetLeft - el.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(kids[best].offsetLeft - el.offsetLeft + kids[best].offsetWidth / 2 - mid) ? j : best), 0);
    if (i !== at) setAt(i);
    if (hint && el.scrollLeft > 8) { setHint(false); try { localStorage.setItem(HINT_KEY, "1"); } catch { /* fine */ } }
  };
  const goTo = (i: number) => {
    const el = strip.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 8, behavior: "smooth" });
  };
  // the mesh-shutter choices the shop makes (founder 2026-11-18: shops differ)
  const meet = sys.parts.find((x) => x.place === "sash-meet" && x.enabled !== false);
  const lockP = sys.parts.find((x) => x.place === "sash-lock" && x.enabled !== false);
  const lockId = lockP?.profile[lockP.profile.length - 1]?.id;
  const clip = sys.parts.find((x) => x.scope === "meeting" && x.enabled !== false);
  const meetIsHandle = !!meet && !!lockId && meet.meshProfile === lockId;
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
  const line = (key: string, title: string, sub: string, value: string, on: boolean, onClick: () => void, badge?: string, hint?: string, inside?: string) => (
    <button key={key} type="button" onClick={onClick} aria-label={`Change ${title}`}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left" style={{ background: on ? "var(--surface-2)" : undefined }}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-tight">{title}{badge && <span className="ml-1.5 text-[11px] font-bold" style={{ color: "var(--accent)" }}>{badge}</span>}</span>
        {hint && <span className="block text-xs leading-snug" style={{ color: "var(--ink-2)" }}>{hint}</span>}
        <span className="block truncate text-[11px]" style={{ color: "var(--ink-3)" }}>{sub}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="mono block text-[15px] font-bold">{value}</span>
        {inside && <span className="block text-[11px]" style={{ color: "var(--ink-3)" }}>inside {inside}</span>}
      </span>
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
        const ins = p && cut45(m, vars) && values[p.length] != null ? len(values[p.length]! - insideLoss(m, geo)) : undefined;
        // a Normal window cut 45° on its track or shutter shows it on every piece
        const badge = cut45(m, vars) ? "45°" : undefined;
        if (frame) return line(m.partId, PLACE[m.place] ?? "Piece", [pr ? sectionTitle(pr.name) : "No section", code(pr)].filter(Boolean).join(" · "), value, on, () => onPick({ type: "part", id: m.partId }), badge, undefined, ins);
        // "Bearing · top" / "Handle": the same names as on the drawings
        const base = (pr?.kind && KIND_NAMES[pr.kind]) || (p ? p.role.replace(/{[a-z]+}/g, "").replace(/\b(Top|Bottom)\b/g, "").trim() : "Piece");
        const name = base + (m.place === "sash-top" ? " · top" : m.place === "sash-bottom" ? " · bottom" : "");
        return line(m.partId, name, [pr ? sectionTitle(pr.name) : "", code(pr)].filter(Boolean).join(" · "), value, on, () => onPick({ type: "part", id: m.partId }), badge, undefined, ins);
      });
  };
  const fill = (k: string) => (k === "J" ? "Mesh" : k === "S" ? "Sheet" : "Glass");
  const pane = `${len(values[sys.infill.w])} × ${len(values[sys.infill.h])}`;
  const CARD: React.CSSProperties = { borderRadius: 22, background: "var(--surface)", border: "1px solid var(--line)",
    boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -8px rgba(15,23,42,.14)" };
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
      <div className="overflow-hidden" style={CARD}>
        {head(sys.family === "casement" ? "Frame" : `Track · ${vars.tracks ?? geo.shutters.length}-track`, <span className="text-xs" style={{ color: "var(--ink-3)" }}>{vars.joint === "45" || (vars.joint !== "90" && geo.frame.some((m) => m.angle === 45)) ? "45° cut" : "90° cut"}</span>)}
        <div className="border-t px-2 py-1" style={{ borderColor: "var(--line)", background: "linear-gradient(180deg, var(--surface-2), var(--surface) 70%)" }}><TrackSketch geo={geo} labels={labels} pick={pick} onPick={onPick} /></div>
        <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>{rows(geo.frame, false, true)}</div>
      </div>

      {/* the shutters, one card each, side by side: swipe to the next (founder 2026-11-18) */}
      <div className="flex items-center justify-between px-1">
        <span>
          <span className="block text-[17px] font-bold leading-tight">Shutters</span>
          <span className="block text-xs" style={{ color: "var(--ink-3)" }}>Each shutter on its own card</span>
        </span>
        {geo.shutters.length > 1 && (
          <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7l-5 5 5 5" /><path d="M16 7l5 5-5 5" /><path d="M3 12h18" /></svg>
            Swipe · {at + 1} of {geo.shutters.length}
          </span>
        )}
      </div>
      <div className="relative">
        {hint && <SwipeHand />}
        <div ref={strip} onScroll={onScroll} onTouchStart={() => hint && setHint(false)}
          className="-mx-4 flex items-start snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 pt-1" style={{ scrollbarWidth: "none", scrollPaddingInline: 16 }}>
          {geo.shutters.map((s) => {
            const k = mix[s.index] ?? s.kind;
            const mesh = k === "J";
            const on = pick?.type === "shutter" && pick.index === s.index;
            return (
              <div key={s.index} className="w-[86%] shrink-0 snap-center overflow-hidden motion-safe:transition-[transform,opacity] motion-safe:duration-300"
                style={{ ...CARD, transform: at === s.index ? "scale(1)" : "scale(0.94)", opacity: at === s.index ? 1 : 0.55, transformOrigin: "center top" }}>
                <div className="flex items-center gap-3 px-4 pb-2 pt-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold" style={{ background: "var(--accent)", color: "#fff" }}>{s.index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold leading-tight">Shutter {s.index + 1}</span>
                    <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{s.index + 1} of {geo.shutters.length} · {fill(k)}</span>
                  </span>
                  {geo.shutters.length > 1 && (
                    <span className="flex shrink-0 gap-1">
                      {[[-1, "M15 6l-6 6 6 6", "Previous shutter"], [1, "M9 6l6 6-6 6", "Next shutter"]].map(([d, path, label]) => {
                        const to = s.index + (d as number);
                        const off = to < 0 || to >= geo.shutters.length;
                        return (
                          <button key={label as string} type="button" aria-label={label as string} disabled={off} onClick={() => goTo(to)}
                            className="grid h-8 w-8 place-items-center rounded-full" style={{ background: "var(--surface-2)", color: off ? "var(--line)" : "var(--ink-2)" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={path as string} /></svg>
                          </button>
                        );
                      })}
                    </span>
                  )}
                </div>
                <div className="mx-4 mb-3 grid grid-cols-3 gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-3)" }} role="radiogroup" aria-label="Glass or mesh">
                  {(["G", "J", "S"] as const).map((x) => (
                    <button key={x} type="button" role="radio" aria-checked={k === x} onClick={() => onKind(s.index, x)}
                      className="rounded-md py-1.5 text-sm font-bold" style={k === x ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(17,24,39,.08)" } : { color: "var(--ink-3)" }}>{fill(x)}</button>
                  ))}
                </div>
                <div className="mx-3 rounded-2xl px-1" style={{ background: "linear-gradient(180deg, var(--surface-2), var(--surface))", border: "1px solid var(--line)" }}>
                  <ShutterSketch geo={geo} index={s.index} kind={k} labels={labels} pane={pane} pick={pick} onPick={onPick} />
                </div>
                {/* a mesh shutter: the shop's own way, plain to see and one tap to change */}
                {mesh && (meet || clip) && (
                  <div className="flex flex-col gap-2 border-t px-4 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
                    <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>How you make the mesh shutter</div>
                    {meet && lockId && meet.id !== lockP?.id && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Meeting side pipe</span>
                        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-3)" }}>
                          {([["interlock", "Interlock", false], ["handle", "Handle", true]] as const).map(([v, label, isH]) => (
                            <button key={v} type="button" aria-pressed={meetIsHandle === isH}
                              onClick={() => onSys({ ...sys, parts: sys.parts.map((x) => (x.id === meet.id ? { ...x, meshProfile: isH ? lockId : undefined } : x)) }, `Mesh shutter meeting side: ${label}`)}
                              className="rounded-md px-3 py-1.5 text-xs font-bold" style={meetIsHandle === isH ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>{label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {clip && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Interlock clip on mesh</span>
                        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--surface-3)" }}>
                          {([["yes", "Yes", true], ["no", "No", false]] as const).map(([v, label, yes]) => (
                            <button key={v} type="button" aria-pressed={!!clip.onMesh === yes}
                              onClick={() => onSys({ ...sys, parts: sys.parts.map((x) => (x.id === clip.id ? { ...x, onMesh: yes || undefined } : x)) }, `Interlock clip on mesh shutter: ${label}`)}
                              className="rounded-md px-3 py-1.5 text-xs font-bold" style={!!clip.onMesh === yes ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>{label}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>Applies to every mesh shutter of this system.</p>
                  </div>
                )}
                <div className="divide-y border-t" style={{ borderColor: "var(--line)" }}>
                  {rows([...geo.sash.filter((m) => m.shutter === s.index), ...geo.patti.filter((m) => m.shutter === s.index)], mesh, false)}
                  {line(`pane${s.index}`, fill(k), "Width × height", pane, on, () => onPick({ type: "shutter", index: s.index }))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {geo.shutters.length > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Shutters">
          {geo.shutters.map((s) => (
            <button key={s.index} type="button" role="tab" aria-selected={at === s.index} aria-label={`Shutter ${s.index + 1}`} onClick={() => goTo(s.index)}
              className="h-2 rounded-full" style={{ width: at === s.index ? 18 : 8, background: at === s.index ? "var(--accent)" : "var(--line)" }} />
          ))}
        </div>
      )}
    </div>
  );
}
