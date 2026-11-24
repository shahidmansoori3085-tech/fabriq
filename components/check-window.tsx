"use client";
/**
 * Check your window (founder 2026-11-24): after the window's questions, the shop sees how it
 * will be built — the frame first, then every shutter on its own page — with the section's
 * name on all four sides. "Correct, next" goes on; "Change" swaps any side's section. Where
 * shops differ (a mesh shutter with or without its interlock clip; Normal: both sides handle on
 * a mesh shutter, a handle on top instead of the bearing, the bottom section on top of a
 * 3-track frame) both ways are drawn side by side and the shop taps its own.
 * What it picks is saved in its own copy of the series, so every list follows it; at the end it
 * chooses to keep these for good or to be asked every time.
 */
import { useId, useMemo, useState } from "react";
import type { PartDef, StudioSystem } from "@/lib/studio/model";
import { computeSizes, jobVars, matches } from "@/lib/studio/evaluate";
import { windowGeometry } from "@/lib/studio/geometry";
import { findProfile, loadLibrary, newId, saveLibrary, type StudioLibrary } from "@/lib/studio/store";
import { BUILT_IN_PROFILES, TEMPLATES, withJoint } from "@/lib/studio/templates";
import { shopProfile } from "@/lib/studio/runtime";
import { shopName } from "@/lib/studio/format";
import { inches } from "@/lib/engine/units";
import { pipeLabels } from "@/components/studio/window-parts";
import { SectionPicker } from "@/components/studio/pickers";
import SectionSketch from "@/components/section-sketch";
import { Sheet } from "@/components/studio-ui";

const KEY = "fabriq.checkSeries";
type Mode = "saved" | "ask";
/** The shop's choice for a series: keep its checked pipes ("saved") or be asked every time. */
export function checkMode(base: string): Mode | undefined {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Mode>)[base]; } catch { return undefined; }
}
function setCheckMode(base: string, mode: Mode) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), [base]: mode })); } catch { /* fine */ }
}

/** The case of a piece's section list that this window uses. */
const caseOf = (p: PartDef, vars: Record<string, string>) => Math.max(0, p.profile.findIndex((c) => matches(c.when, vars)));
const placeOf = (sys: StudioSystem, place: string) => sys.parts.find((p) => p.place === place && p.enabled !== false);
const WHERE: Record<string, string> = {
  "frame-top": "Top", "frame-bottom": "Bottom", "frame-left": "Left side", "frame-right": "Right side",
  "sash-top": "Top", "sash-bottom": "Bottom", "sash-lock": "Handle side", "sash-meet": "Meeting side", meeting: "Where shutters meet",
};

interface Variant { key: string; title: string; apply: (s: StudioSystem) => StudioSystem; on: (s: StudioSystem) => boolean }

export function CheckWindow({ sys: start, base, tracks, mix, switches, onDone }: {
  /** the series as the shop has it now (its own copy, or the built-in) */
  sys: StudioSystem;
  /** the built-in it comes from: "normal-18", "domal-27"… */
  base: string;
  tracks: number; mix: string; switches: Record<string, string>;
  /** finished: the system to use now ("studio:<id>" when the shop changed something) */
  onDone: (sysId: string | null) => void;
}) {
  const [lib, setLib] = useState<StudioLibrary>(() => loadLibrary());
  const [draft, setDraft] = useState<StudioSystem>(() => withJoint(structuredClone(start)));
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<Mode>(() => checkMode(base) ?? "saved");
  const [changing, setChanging] = useState<string[] | null>(null);
  const [picking, setPicking] = useState<PartDef | null>(null);
  /** the last page: keep these choices, or be asked every time */
  const [saving, setSaving] = useState(false);
  const tpl = useMemo(() => { const t = TEMPLATES.find((x) => x.id === base); return t ? withJoint(t) : undefined; }, [base]);

  // a sample window of this layout, to draw it (the sizes come on the next step)
  const job = useMemo(() => ({ id: "C", W: inches(60), H: inches(48), qty: 1, tracks, mix, switches }), [tracks, mix, switches]);
  const look = (s: StudioSystem) => {
    const find = (id: string) => findProfile(lib, id) ?? shopProfile(id) ?? BUILT_IN_PROFILES.find((p) => p.id === id);
    const geo = windowGeometry(s, job, find);
    const vars = jobVars(s, job);
    const values = computeSizes(s, job).values;
    // a mesh shutter's pipes are named by its own mesh section, not the glass one
    const meshPage = at.kind === "shutter" && mix[at.index] === "J";
    const named = meshPage ? { ...s, parts: s.parts.map((p) => (p.scope === "shutter" && p.meshProfile ? { ...p, profile: [{ id: p.meshProfile }] } : p)) } : s;
    return { geo, vars, labels: pipeLabels(named, lib, vars, values, "in", geo) };
  };
  const vars = jobVars(draft, job);
  const isMesh = (i: number) => mix[i] === "J";
  const firstGlass = [...mix].findIndex((k) => k !== "J");
  const pages: ({ kind: "frame" } | { kind: "shutter"; index: number })[] = [{ kind: "frame" }, ...[...mix].map((_, i) => ({ kind: "shutter" as const, index: i }))];
  const at = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;

  /** the two ways shops differ on this page, if any */
  const variants = ((): Variant[] => {
    const top = placeOf(draft, "frame-top"), bottom = placeOf(draft, "frame-bottom");
    const tplTop = tpl && placeOf(tpl, "frame-top");
    const lock = placeOf(draft, "sash-lock"), meet = placeOf(draft, "sash-meet"), bTop = placeOf(draft, "sash-top");
    const tplBTop = tpl && placeOf(tpl, "sash-top");
    const kind = (p?: PartDef) => (p ? findProfile(lib, p.profile[caseOf(p, vars)]?.id ?? "")?.kind : undefined);
    const lockId = lock?.profile[caseOf(lock, vars)]?.id;
    const set = (s: StudioSystem, id: string, patch: Partial<PartDef>) => ({ ...s, parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    const bombay = kind(lock) === "handle" && kind(meet) === "interlock";
    if (at.kind === "frame") {
      // Normal: some shops put the bottom section on top as well (the sides stay the top section)
      if (draft.family === "sliding" && top && bottom && tplTop && kind(top) === "track" && JSON.stringify(tplTop.profile) !== JSON.stringify(bottom.profile)) return [
        { key: "top", title: "Top section on top and sides", apply: (s) => set(s, top.id, { profile: tplTop.profile }), on: (s) => JSON.stringify(placeOf(s, "frame-top")?.profile) !== JSON.stringify(placeOf(s, "frame-bottom")?.profile) },
        { key: "bottom", title: "Bottom section on top and bottom", apply: (s) => set(s, top.id, { profile: bottom.profile }), on: (s) => JSON.stringify(placeOf(s, "frame-top")?.profile) === JSON.stringify(placeOf(s, "frame-bottom")?.profile) },
      ];
      return [];
    }
    const i = at.index;
    if (isMesh(i)) {
      // Normal: the mesh shutter's meeting side — the interlock, or a second handle
      if (bombay && meet && lockId) return [
        { key: "interlock", title: "Handle and interlock", apply: (s) => set(s, meet.id, { meshProfile: undefined }), on: (s) => placeOf(s, "sash-meet")?.meshProfile !== lockId },
        { key: "handle", title: "Handle on both sides", apply: (s) => set(s, meet.id, { meshProfile: lockId }), on: (s) => placeOf(s, "sash-meet")?.meshProfile === lockId },
      ];
      // a clip series: some shops clip the mesh shutter too
      const clip = draft.parts.find((p) => p.scope === "meeting" && p.enabled !== false && matches(p.when, vars));
      if (clip) return [
        { key: "noclip", title: "Without interlock clip", apply: (s) => set(s, clip.id, { onMesh: undefined }), on: (s) => !s.parts.find((p) => p.id === clip.id)?.onMesh },
        { key: "clip", title: "With interlock clip", apply: (s) => set(s, clip.id, { onMesh: true }), on: (s) => !!s.parts.find((p) => p.id === clip.id)?.onMesh },
      ];
      return [];
    }
    // Normal: some shops put a handle on top instead of the bearing, on every shutter
    if (i === firstGlass && bombay && bTop && tplBTop && lockId && kind(bTop) === "bearing" || (i === firstGlass && bombay && bTop && tplBTop && lockId && bTop.profile.every((c) => c.id === lockId))) return [
      { key: "bearing", title: "Bearing on top", apply: (s) => set(s, bTop!.id, { profile: tplBTop!.profile }), on: (s) => placeOf(s, "sash-top")?.profile.some((c) => c.id !== lockId) ?? true },
      { key: "handle", title: "Handle on top", apply: (s) => set(s, bTop!.id, { profile: [{ id: lockId! }] }), on: (s) => !!placeOf(s, "sash-top")?.profile.every((c) => c.id === lockId) },
    ];
    return [];
  })();

  /** the pieces drawn on this page */
  const pieces = (s: StudioSystem): PartDef[] => at.kind === "frame"
    ? s.parts.filter((p) => p.enabled !== false && p.place?.startsWith("frame"))
    : s.parts.filter((p) => p.enabled !== false && (p.place?.startsWith("sash")
      // the interlock clip: on a glass shutter, and on a mesh one only where the shop clips it
      || (p.scope === "meeting" && matches(p.when, vars) && (!isMesh(at.index) || !!p.onMesh))));

  /** Is this piece cut 45° on this window (Normal: by its track / shutter choice, else its own angle)? */
  const mitre = (p: PartDef | undefined, s: StudioSystem) => {
    if (!p) return false;
    const v = jobVars(s, job);
    const key = p.place?.startsWith("frame") ? "joint" : p.place?.startsWith("sash") ? "sash" : "";
    return key && v[key] ? v[key] === "45" : p.angle === 45;
  };

  /** a new section for one piece: the case this window uses (a mesh shutter: its mesh section) */
  const swap = (p: PartDef, id: string) => {
    setDraft((s) => ({ ...s, parts: s.parts.map((q) => {
      if (q.id !== p.id) return q;
      if (at.kind === "shutter" && isMesh(at.index) && q.scope === "shutter") return { ...q, meshProfile: id };
      const k = caseOf(q, jobVars(s, job));
      return { ...q, profile: q.profile.map((c, j) => (j === k ? { ...c, id } : c)) };
    }) }));
    setPicking(null); setChanging(null);
  };

  const finish = () => {
    setCheckMode(base, mode);
    if (JSON.stringify(draft) === JSON.stringify(withJoint(structuredClone(start)))) { onDone(null); return; }
    const fresh = loadLibrary();
    const own = fresh.systems.some((x) => x.id === draft.id);
    const keep: StudioSystem = own ? { ...draft, version: (draft.version ?? 1) + 1 }
      : { ...structuredClone(draft), id: newId("sys"), basedOn: { id: base, version: tpl?.version ?? 1 }, version: 1, jobs: [], status: draft.status === "verified" ? "checked" : draft.status };
    saveLibrary({ ...fresh, systems: own ? fresh.systems.map((x) => (x.id === keep.id ? keep : x)) : [...fresh.systems, keep] });
    onDone(`studio:${keep.id}`);
  };

  const title = at.kind === "frame" ? (draft.family === "casement" ? "Frame" : `Frame · ${tracks}-track`)
    : `Shutter ${at.index + 1} · ${mix[at.index] === "J" ? "Mesh" : mix[at.index] === "S" ? "Sheet" : "Glass"}`;
  /** the section a piece takes on this page (a mesh shutter: its mesh section) */
  const profOf = (p: PartDef, s: StudioSystem) => {
    const id = at.kind === "shutter" && isMesh(at.index) && p.scope === "shutter" && p.meshProfile ? p.meshProfile : p.profile[caseOf(p, jobVars(s, job))]?.id ?? "";
    return { id, prof: findProfile(lib, id) };
  };
  const nameOf = (p: PartDef, s: StudioSystem) => { const { id, prof } = profOf(p, s); return shopName(prof?.name ?? id); };
  // the section's own drawing beside its name (founder 2026-11-24: "kaise pata chalega kahan kya lagega")
  const pic = (p: PartDef, s: StudioSystem) => (
    <span className="h-11 w-14 shrink-0 overflow-hidden">
      <SectionSketch p={profOf(p, s).prof} tracks={tracks} />
    </span>
  );

  /** One side of the board: the section's drawing, its name, where it sits and its cut. */
  const Side = ({ p, s, cut }: { p?: PartDef; s: StudioSystem; cut?: string }) => !p ? <span /> : (
    <span className="flex min-w-0 flex-col items-center text-center">
      <span className="h-12 w-16 overflow-hidden">
        <SectionSketch p={profOf(p, s).prof} tracks={tracks} />
      </span>
      <span className="mt-1 block max-w-[112px] text-[12px] font-bold leading-tight">{nameOf(p, s)}</span>
      <span className="block text-[11px] leading-tight" style={{ color: "var(--ink-3)" }}>
        {WHERE[p.place ?? ""] ?? p.role.replace(/\{[a-z]+\}/g, "").trim()}{cut ? ` · ${cut}` : ""}
      </span>
    </span>
  );

  /** The frame or the shutter drawn as it is built — aluminium pipes, their 45° or 90° joints,
   *  the glass or mesh in it — with each side's section placed beside that side. */
  const Board = ({ s, bare }: { s: StudioSystem; bare?: boolean }) => {
    const v = look(s);
    const ps = pieces(s);
    const by = (pl: string) => ps.find((p) => p.place === pl);
    const cut = (p?: PartDef) => (p ? v.labels[p.id]?.value : undefined);
    const frame = at.kind === "frame";
    const sh = at.kind === "shutter" ? v.geo.shutters[at.index] : undefined;
    const lockLeft = sh?.lockSide !== "right";
    const T = frame ? by("frame-top") : by("sash-top"), B = frame ? by("frame-bottom") : by("sash-bottom");
    const L = frame ? by("frame-left") : by(lockLeft ? "sash-lock" : "sash-meet");
    const R = frame ? by("frame-right") : by(lockLeft ? "sash-meet" : "sash-lock");
    const extra = ps.filter((p) => ![T, B, L, R].includes(p));
    const fill = at.kind === "shutter" ? mix[at.index] ?? "G" : "G";
    const built = (width?: number) => (
      <Built frame={frame} fill={fill} lockLeft={lockLeft} meshClip={extra.length > 0 && !frame} width={width}
        mitreTB={mitre(T, s)} mitreLR={mitre(L, s)} sidesFull={frame ? !mitre(T, s) : true} />
    );
    // the small picture of one way, for the side-by-side choice
    if (bare) return <span className="flex justify-center">{built(frame ? 132 : 92)}</span>;
    return (
      <span className="block px-2 pb-3 pt-2">
        <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-2">
          <span /><Side p={T} s={s} cut={cut(T)} /><span />
          <Side p={L} s={s} cut={cut(L)} />
          {built()}
          <Side p={R} s={s} cut={cut(R)} />
          <span /><Side p={B} s={s} cut={cut(B)} /><span />
        </span>
        {extra.length > 0 && (
          <span className="mt-2 flex justify-center gap-4 border-t pt-2" style={{ borderColor: "var(--line)" }}>
            {extra.map((p) => <Side key={p.id} p={p} s={s} cut={cut(p)} />)}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-bold">{saving ? "Next time" : title}</h2>
        <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{saving ? pages.length + 1 : page + 1} of {pages.length + 1}</span>
      </div>
      <p className="-mt-2 text-sm" style={{ color: "var(--ink-3)" }}>
        {saving ? "For the next windows of this series." : variants.length ? "Shops make this two ways. Tap yours." : "Check the section on every side."}
      </p>

      {!saving && variants.length > 0 && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={title}>
          {variants.map((v) => {
            const on = v.on(draft);
            return (
              <button key={v.key} type="button" role="radio" aria-checked={on} onClick={() => setDraft(v.apply(draft))}
                className="card flex flex-col items-center gap-2 px-2 pb-2.5 pt-3 text-center"
                style={on ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)", background: "var(--accent-soft)" } : undefined}>
                <Board s={v.apply(draft)} bare />
                {/* what this way has that the other does not: that section's picture and name */}
                {(() => {
                  const mine = v.apply(draft), other = variants.find((x) => x !== v)!.apply(draft);
                  const otherIds = new Map(pieces(other).map((p) => [p.id, profOf(p, other).id]));
                  const diff = pieces(mine).filter((p) => otherIds.get(p.id) !== profOf(p, mine).id);
                  if (!diff.length) return null;
                  return diff.slice(0, 1).map((p) => (
                    <span key={p.id} className="flex items-center gap-1 text-left">
                      {pic(p, mine)}
                      <span className="text-[11px] font-semibold leading-tight" style={{ color: "var(--ink-2)" }}>{nameOf(p, mine)}</span>
                    </span>
                  ));
                })()}
                <span className="flex items-start gap-1.5">
                  <span className="mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full" style={{ border: `2px solid ${on ? "var(--accent)" : "var(--line)"}` }}>
                    {on && <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />}
                  </span>
                  <span className="text-[13px] font-bold leading-tight">{v.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {!saving && [0].map(() => {
        const on = true;
        return (
          <div key="board" className="card overflow-hidden">
            <Board s={draft} />
            {on && (
              <div className="border-t px-4 py-2" style={{ borderColor: "var(--line)" }}>
                <button type="button" onClick={() => setChanging(pieces(draft).map((p) => p.id))}
                  className="flex w-full items-center justify-between py-1.5 text-sm font-semibold" style={{ color: "var(--ink-2)" }}>
                  Change a section
                  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              </div>
            )}
          </div>
        );
      })}

      {saving && (
        <div className="card flex flex-col gap-1 p-3" role="radiogroup" aria-label="Next time">
          {([["saved", "Save my choices", "Next windows of this series skip these pages."], ["ask", "Ask me every time", "These pages come for every new window."]] as const).map(([v, t, sub]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className="flex items-start gap-3 rounded-lg px-2 py-2 text-left">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ border: `2px solid ${mode === v ? "var(--accent)" : "var(--line)"}` }}>
                {mode === v && <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} />}
              </span>
              <span><span className="block text-sm font-bold">{t}</span><span className="block text-xs" style={{ color: "var(--ink-3)" }}>{sub}</span></span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {(page > 0 || saving) && <button type="button" className="btn-ghost px-4 py-3.5 text-sm" onClick={() => (saving ? setSaving(false) : setPage((p) => p - 1))}>Back</button>}
        <button type="button" className="btn-primary flex-1 py-3.5 text-base" onClick={() => (saving ? finish() : last ? setSaving(true) : setPage((p) => p + 1))}>
          {saving ? "Done, go to size" : "Correct, next"}
        </button>
      </div>

      {changing && !picking && (
        <Sheet title={`Change a section · ${title}`} sub="Tap the side you want to change." onClose={() => setChanging(null)}>
          <div className="flex flex-col">
            {pieces(draft).filter((p) => changing.includes(p.id)).map((p, i) => (
              <button key={p.id} type="button" onClick={() => setPicking(p)} className="flex items-center justify-between gap-3 py-3 text-left" style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
                {pic(p, draft)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{nameOf(p, draft)}</span>
                  <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{WHERE[p.place ?? ""] ?? p.role.replace(/\{[a-z]+\}/g, "").trim()}</span>
                </span>
                <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-2)" }}>Change</span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {picking && (
        <SectionPicker lib={lib} kind={findProfile(lib, picking.profile[caseOf(picking, vars)]?.id ?? "")?.kind}
          title={`Section for ${nameOf(picking, draft)}`}
          onPick={(id) => swap(picking, id)}
          onAdd={(prof) => { const next = { ...lib, profiles: [...lib.profiles, prof] }; saveLibrary(next); setLib(next); swap(picking, prof.id); }}
          onClose={() => setPicking(null)} />
      )}
    </div>
  );
}

/** The frame or a shutter as built: four aluminium pipes (mitred at 45°, or butted at 90° with the
 *  sides running through), glass with a sheen or mesh, the handle on its side and the interlock
 *  clip where shutters meet. */
function Built({ frame, fill, lockLeft, meshClip, mitreTB, mitreLR, sidesFull, width }: {
  frame: boolean; fill: string; lockLeft: boolean; meshClip: boolean; mitreTB: boolean; mitreLR: boolean; sidesFull: boolean; width?: number;
}) {
  const id = useId().replace(/:/g, "");
  const W = frame ? 150 : 104, H = frame ? 118 : 150, t = frame ? 13 : 11, x = 6, y = 6;
  const miter = mitreTB || mitreLR;
  // a pipe: mitred trapezoid at 45°, else a rectangle (sides through at 90° on a Normal frame)
  const top = miter ? `${x},${y} ${x + W},${y} ${x + W - t},${y + t} ${x + t},${y + t}`
    : sidesFull ? `${x + t},${y} ${x + W - t},${y} ${x + W - t},${y + t} ${x + t},${y + t}` : `${x},${y} ${x + W},${y} ${x + W},${y + t} ${x},${y + t}`;
  const bottom = miter ? `${x + t},${y + H - t} ${x + W - t},${y + H - t} ${x + W},${y + H} ${x},${y + H}`
    : sidesFull ? `${x + t},${y + H - t} ${x + W - t},${y + H - t} ${x + W - t},${y + H} ${x + t},${y + H}` : `${x},${y + H - t} ${x + W},${y + H - t} ${x + W},${y + H} ${x},${y + H}`;
  const left = miter ? `${x},${y} ${x + t},${y + t} ${x + t},${y + H - t} ${x},${y + H}`
    : sidesFull ? `${x},${y} ${x + t},${y} ${x + t},${y + H} ${x},${y + H}` : `${x},${y + t} ${x + t},${y + t} ${x + t},${y + H - t} ${x},${y + H - t}`;
  const right = miter ? `${x + W},${y} ${x + W},${y + H} ${x + W - t},${y + H - t} ${x + W - t},${y + t}`
    : sidesFull ? `${x + W - t},${y} ${x + W},${y} ${x + W},${y + H} ${x + W - t},${y + H}` : `${x + W - t},${y + t} ${x + W},${y + t} ${x + W},${y + H - t} ${x + W - t},${y + H - t}`;
  const ix = x + t, iy = y + t, iw = W - 2 * t, ih = H - 2 * t;
  return (
    <svg viewBox={`0 0 ${W + 12 + (meshClip ? 8 : 0)} ${H + 12}`} className="block" style={{ width: width ?? (frame ? 150 : 108) }} role="img" aria-label={frame ? "Frame" : "Shutter"}>
      <defs>
        <linearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f8fafc" /><stop offset=".45" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" /></linearGradient>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f8fafc" /><stop offset=".45" stopColor="#cbd5e1" /><stop offset="1" stopColor="#94a3b8" /></linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0f2fe" /><stop offset="1" stopColor="#bae6fd" /></linearGradient>
        <pattern id={`m${id}`} width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="#f1f5f9" /><path d="M0 0L5 5M5 0L0 5" stroke="#94a3b8" strokeWidth=".45" /></pattern>
      </defs>
      {/* the opening: glass with a sheen, mesh or sheet */}
      {frame ? <rect x={ix} y={iy} width={iw} height={ih} fill="#f1f5f9" />
        : <rect x={ix} y={iy} width={iw} height={ih} fill={fill === "J" ? `url(#m${id})` : fill === "S" ? "#e7e5e4" : `url(#g${id})`} />}
      {!frame && fill === "G" && <g stroke="#ffffff" strokeWidth="3" opacity=".7" strokeLinecap="round">
        <line x1={ix + iw * 0.2} y1={iy + ih * 0.35} x2={ix + iw * 0.45} y2={iy + ih * 0.12} />
        <line x1={ix + iw * 0.25} y1={iy + ih * 0.5} x2={ix + iw * 0.6} y2={iy + ih * 0.18} strokeWidth="1.5" />
      </g>}
      {/* the four pipes */}
      <g stroke="#64748b" strokeWidth=".7" strokeLinejoin="round">
        <polygon points={top} fill={`url(#h${id})`} />
        <polygon points={bottom} fill={`url(#h${id})`} />
        <polygon points={left} fill={`url(#v${id})`} />
        <polygon points={right} fill={`url(#v${id})`} />
      </g>
      {/* the handle on the shutter's lock side */}
      {!frame && <rect x={lockLeft ? x + 2.5 : x + W - t + 2.5} y={y + H / 2 - 12} width={t - 5} height={24} rx={2.5} fill="#334155" />}
      {/* the interlock clip where it meets the next shutter */}
      {!frame && meshClip && <rect x={lockLeft ? x + W + 2 : x - 6} y={y + 8} width={5} height={H - 16} rx={1.5} fill="#475569" />}
    </svg>
  );
}
