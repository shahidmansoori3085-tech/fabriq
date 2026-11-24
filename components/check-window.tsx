"use client";
/**
 * Check your window (founder 2026-11-24): after the window's questions, the shop sees how it
 * will be built — the frame first, then every shutter on its own page — with the section's
 * name on all four sides. "Correct, next" goes on; "Change" swaps any side's section. Where
 * shops differ (a mesh shutter with or without its interlock clip; Normal: both sides handle on
 * a mesh shutter, a handle on top instead of the bearing, the bottom section on top of a
 * 3-track frame) both ways are drawn side by side and the shop taps its own.
 * What it picks is saved in its own copy of the series, so every list follows it; each question
 * says for itself whether to remember the answer or ask again next time.
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
/** A series' questions: the frame's, the glass shutter's and the mesh shutter's. */
type Group = "frame" | "glass" | "mesh";
/** For each question of a series: keep the answer ("saved"), ask every time, or no question
 *  there ("none"). Founder 2026-11-24: each question asks this for itself, not one for all. */
type Memo = Partial<Record<Group, Mode | "none">>;
function readMemo(base: string): Memo | undefined {
  try {
    const raw = (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, Memo | Mode>)[base];
    // the older one answer for the whole series
    if (raw === "saved") return { frame: "saved", glass: "saved", mesh: "saved" };
    return raw && typeof raw === "object" ? raw : undefined;
  } catch { return undefined; }
}
function writeMemo(base: string, memo: Memo) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), [base]: memo })); } catch { /* fine */ }
}
/** The questions a window of this layout meets. */
const groupsOf = (mix: string): Group[] => ["frame", ...(/[^J]/.test(mix) ? ["glass" as const] : []), ...(mix.includes("J") ? ["mesh" as const] : [])];
/** Do the check pages come for this window: a question not answered yet, or one set to ask every time. */
export function checkNeeded(base: string, mix: string): boolean {
  const m = readMemo(base);
  return !m || groupsOf(mix).some((g) => m[g] === undefined || m[g] === "ask");
}

/** The case of a piece's section list that this window uses. */
const caseOf = (p: PartDef, vars: Record<string, string>) => Math.max(0, p.profile.findIndex((c) => matches(c.when, vars)));
const placeOf = (sys: StudioSystem, place: string) => sys.parts.find((p) => p.place === place && p.enabled !== false);
const WHERE: Record<string, string> = {
  "frame-top": "Top", "frame-bottom": "Bottom", "frame-left": "Left side", "frame-right": "Right side",
  "sash-top": "Top", "sash-bottom": "Bottom", "sash-lock": "Handle side", "sash-meet": "Meeting side", meeting: "Meeting side",
};

interface Variant { key: string; title: string; apply: (s: StudioSystem) => StudioSystem; on: (s: StudioSystem) => boolean }

type Page = { kind: "frame" } | { kind: "shutter"; index: number };

export function CheckWindow({ sys: start, base, tracks, mix, switches, all, onDone }: {
  /** every page, also the questions already answered for good ("Check this window's pipes") */
  all?: boolean;
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
  const [memo] = useState<Memo | undefined>(() => readMemo(base));
  /** each question's "next time": keep this answer, or ask again */
  const [asks, setAsks] = useState<Partial<Record<Group, Mode>>>(() => ({
    frame: memo?.frame === "ask" ? "ask" : "saved", glass: memo?.glass === "ask" ? "ask" : "saved", mesh: memo?.mesh === "ask" ? "ask" : "saved",
  }));
  const [changing, setChanging] = useState<string[] | null>(null);
  const [picking, setPicking] = useState<PartDef | null>(null);
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
  /** the question a page carries: the frame's, the first glass shutter's, a mesh shutter's */
  const groupOf = (p: Page): Group | null => p.kind === "frame" ? "frame" : isMesh(p.index) ? "mesh" : p.index === firstGlass ? "glass" : null;
  const every: Page[] = [{ kind: "frame" }, ...[...mix].map((_, i) => ({ kind: "shutter" as const, index: i }))];
  // the first time every page; after that only the questions set to ask every time (or new ones)
  const open = (g: Group | null) => !!g && (memo?.[g] === undefined || memo[g] === "ask");
  const shown = all || !memo ? every : every.filter((p) => open(groupOf(p)));
  const pages = shown.length ? shown : every;
  const at = pages[Math.min(page, pages.length - 1)];
  const last = page >= pages.length - 1;

  /** the two ways shops differ on a page, if any */
  const variantsFor = (at: Page): Variant[] => {
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
      // a slim interlock series: the mesh shutter is its mesh section all round, or some shops put the
      // slim interlock on its meeting side too (founder 2026-11-24: "slim me bhi aise hi, 2 drawing")
      const slimId = meet?.profile[caseOf(meet, vars)]?.id;
      if (meet && slimId && kind(meet) === "slim-interlock") {
        const plainMesh = tpl ? placeOf(tpl, "sash-meet")?.meshProfile : undefined;
        const isSlim = (s: StudioSystem) => { const m = placeOf(s, "sash-meet")?.meshProfile; return !!m && findProfile(lib, m)?.kind === "slim-interlock"; };
        return [
          { key: "noslim", title: "Without slim interlock", apply: (s) => set(s, meet.id, { meshProfile: plainMesh }), on: (s) => !isSlim(s) },
          { key: "slim", title: "With slim interlock", apply: (s) => set(s, meet.id, { meshProfile: slimId }), on: isSlim },
        ];
      }
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
  };
  const variants = variantsFor(at);
  const group = groupOf(at);

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
    // each question seen: keep its answer or ask again; a page with no question: nothing to ask
    const next: Memo = { ...(memo ?? {}) };
    for (const p of pages) {
      const g = groupOf(p);
      if (g) next[g] = variantsFor(p).length ? asks[g] ?? "saved" : "none";
    }
    writeMemo(base, next);
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
    <span className="h-11 w-14 shrink-0 overflow-hidden [&_.bg-white]:!bg-transparent [&_img]:mix-blend-multiply">
      <SectionSketch p={profOf(p, s).prof} tracks={tracks} plain />
    </span>
  );

  /** The frame or the shutter drawn as it is built — aluminium pipes, their 45° or 90° joints,
   *  the glass or mesh in it — with each side's section placed beside that side. */
  const uid = useId().replace(/:/g, "");
  /** compact: the smaller drawing on each of two choice cards; mark: the sections that differ,
   *  shown in the accent colour (founder 2026-11-24: "aasani se pata chal sake kya fark hai") */
  const Board = ({ s, compact, mark }: { s: StudioSystem; compact?: boolean; mark?: Set<string> }) => {
    const v = look(s);
    const ps = pieces(s);
    const by = (pl: string) => ps.find((p) => p.place === pl);
    const frame = at.kind === "frame";
    const sh = at.kind === "shutter" ? v.geo.shutters[at.index] : undefined;
    const lockLeft = sh?.lockSide !== "right";
    const T = frame ? by("frame-top") : by("sash-top"), B = frame ? by("frame-bottom") : by("sash-bottom");
    const L = frame ? by("frame-left") : by(lockLeft ? "sash-lock" : "sash-meet");
    const R = frame ? by("frame-right") : by(lockLeft ? "sash-meet" : "sash-lock");
    const extra = ps.filter((p) => ![T, B, L, R].includes(p));
    const fill = at.kind === "shutter" ? mix[at.index] ?? "G" : "G";
    const C = !!compact;
    const base = frame ? BUILT.frame : BUILT.shutter;
    // a frame card: the window big, the track sections small (founder 2026-11-24)
    const k = C ? (frame ? 0.52 : 0.62) : 1;
    const W = base.W * k, H = base.H * k, t = base.t * k;
    // the section drawing, the words and the spacing — smaller on a choice card
    const sw = C ? (frame ? 30 : 46) : 64, shh = C ? (frame ? 17 : 28) : 42, fName = C ? 10.5 : 11, fWhere = 9.5, lh = 12;
    const VW = C ? 180 : 340, side = C ? (frame ? 22 : 30) : 46, x0 = (VW - W) / 2;
    const y0 = C ? shh + 2 * lh + 16 : shh + 3 * lh + 30, midY = y0 + H / 2, low = y0 + H + (C ? 16 : 26);
    const clipX = lockLeft ? x0 + (base.W + 4.5) * k : x0 - 3.5 * k;
    const VH = C ? low + shh + 2 * lh + 4 : low + shh + 3 * lh + 8;
    /** a section: its drawing, its name and where it sits — and an arrow to its pipe (no sizes:
     *  founder 2026-11-24 "ye naap hata do"). `from` "below": the arrow leaves from under the words. */
    const block = (p: PartDef | undefined, cx: number, py: number, from: [number, number] | "below", to: [number, number]) => {
      if (!p) return null;
      // on a choice card: the name alone, without its size, and no "where" line (the arrow says where)
      // and on every page without the series word ("Domal Glass Shutter" → "Glass Shutter"): the
      // series is already chosen (founder 2026-11-24)
      let plain = nameOf(p, s).replace(/^(mini domal|domal|euro|gulf)\s+/i, "").replace(/^\d+\s*mm\s+/i, "");
      // a slim interlock says so: "Slim Interlock (small)"; on a small card just "Slim Interlock"
      if (profOf(p, s).prof?.kind === "slim-interlock") {
        const size = /—\s*(small|big)\s*$/i.exec(plain)?.[1]?.toLowerCase();
        plain = `Slim ${plain.replace(/\s*—.*$/, "").replace(/^slim\s+/i, "")}${size && !C ? ` (${size})` : ""}`;
      }
      const name = C ? plain.replace(/\s+[\d½¼¾⅛.]+\s*×\s*[\d½¼¾⅛.]+.*$/, "") : plain;
      const lines = wrap(name, C ? 8 : 15);
      const where = C ? "" : WHERE[p.place ?? ""] ?? p.role.replace(/\{[a-z]+\}/g, "").trim();
      const top = py + shh + lh;
      const end = top + (C ? lines.length - 1 : lines.length) * lh;
      const start: [number, number] = from === "below" ? [cx, end + 5] : from;
      const hot = mark?.has(p.id);
      const ink = hot ? "var(--accent)" : C ? "#94a3b8" : "#334155";
      return (
        <g key={p.id}>
          <foreignObject x={cx - sw / 2} y={py} width={sw} height={shh}>
            <div className="[&_img]:mix-blend-multiply" style={{ width: sw, height: shh }}><SectionSketch p={profOf(p, s).prof} tracks={tracks} plain /></div>
          </foreignObject>
          {lines.map((ln, i) => <text key={i} x={cx} y={top + i * lh} textAnchor="middle" fontSize={fName} fontWeight={700} fill={hot ? "var(--accent)" : "#0f172a"}>{ln}</text>)}
          {where && <text x={cx} y={end} textAnchor="middle" fontSize={fWhere} fill="#64748b">{where}</text>}
          <circle cx={start[0]} cy={start[1]} r={1.6} fill={ink} />
          <line x1={start[0]} y1={start[1]} x2={to[0]} y2={to[1]} stroke={ink} strokeWidth={hot ? 1.3 : 0.9} markerEnd={`url(#${hot ? "arrowHot" : "arrow"}${uid})`} />
        </g>
      );
    };
    const sideY = midY - shh / 2 - lh;
    return (
      <span className={C ? "block w-full" : "block px-1 pb-2 pt-1"}>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="mx-auto block w-full" style={{ maxWidth: C ? 220 : 380 }} role="img" aria-label={title}>
          <defs>
            <marker id={`arrow${uid}`} viewBox="0 0 8 8" refX={7.5} refY={4} markerWidth={6} markerHeight={6} orient="auto">
              <path d="M0 0.6L8 4L0 7.4z" fill={C ? "#94a3b8" : "#334155"} />
            </marker>
            <marker id={`arrowHot${uid}`} viewBox="0 0 8 8" refX={7.5} refY={4} markerWidth={5} markerHeight={5} orient="auto">
              <path d="M0 0.6L8 4L0 7.4z" fill="var(--accent)" />
            </marker>
          </defs>
          <g transform={`translate(${x0} ${y0}) scale(${k})`}>
            <Built frame={frame} fill={fill} lockLeft={lockLeft} meshClip={extra.length > 0 && !frame} at={{ x: 0, y: 0 }}
              mitreTB={mitre(T, s)} mitreLR={mitre(L, s)} sidesFull={frame ? !mitre(T, s) : true} />
          </g>
          {block(T, VW / 2, 0, "below", [VW / 2, y0 + t / 2])}
          {block(L, side, sideY, [side + sw / 2, sideY + shh / 2], [x0 + t / 2, sideY + shh / 2])}
          {block(R, VW - side, sideY, [VW - side - sw / 2, sideY + shh / 2], [x0 + W - t / 2, sideY + shh / 2])}
          {(() => {
            // a clip under the drawing on a small card: the bottom section moves aside to give it room
            const bx = C && extra.length > 0 && !frame ? VW / 2 + (lockLeft ? -24 : 24) : VW / 2;
            return block(B, bx, low, [bx, low - 3], [bx, y0 + H - t / 2]);
          })()}
          {extra.slice(0, 1).map((p) => block(p, lockLeft ? VW - side : side, low, [lockLeft ? VW - side : side, low - 2], [clipX, y0 + H - 24 * k]))}
        </svg>
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[19px] font-bold">{title}</h2>
        <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{page + 1} of {pages.length}</span>
      </div>
      <p className="-mt-2 text-sm" style={{ color: "var(--ink-3)" }}>
        {variants.length ? "Shops make this two ways. Tap yours." : "Check the section on every side."}
      </p>
      {variants.length > 0 && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={title}>
          {variants.map((v) => {
            const on = v.on(draft);
            return (
              <button key={v.key} type="button" role="radio" aria-checked={on} onClick={() => setDraft(v.apply(draft))}
                className="card flex flex-col items-center gap-1.5 px-1 pb-2.5 pt-2 text-center"
                style={on ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)", background: "var(--accent-soft)" } : undefined}>
                {/* the whole drawing, the section this way has that the other does not in colour */}
                {(() => {
                  const mine = v.apply(draft), other = variants.find((x) => x !== v)!.apply(draft);
                  const otherIds = new Map(pieces(other).map((p) => [p.id, profOf(p, other).id]));
                  const diff = new Set(pieces(mine).filter((p) => otherIds.get(p.id) !== profOf(p, mine).id).map((p) => p.id));
                  return <Board s={mine} compact mark={diff} />;
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
      {/* this question's own "next time" (founder 2026-11-24: "har sawal me vo sawal poochhna tha") */}
      {variants.length > 0 && group && (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-sm font-semibold" style={{ color: "var(--ink-2)" }}>Next time</span>
          <div className="flex rounded-full p-0.5" style={{ background: "var(--line)" }} role="radiogroup" aria-label="Next time">
            {([["saved", "Remember this"], ["ask", "Ask again"]] as const).map(([v, label]) => {
              const on = (asks[group] ?? "saved") === v;
              return (
                <button key={v} type="button" role="radio" aria-checked={on} onClick={() => setAsks((a) => ({ ...a, [group]: v }))}
                  className="rounded-full px-3 py-1.5 text-[13px] font-semibold"
                  style={on ? { background: "var(--card, #fff)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(15,23,42,.12)" } : { color: "var(--ink-3)" }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {[0].map(() => {
        const on = true;
        return (
          <div key="board" className="card overflow-hidden">
            {/* two ways: the cards above are the drawing, so no second one here */}
            {!variants.length && <Board s={draft} />}
            {on && (
              <div className={variants.length ? "px-4 py-2" : "border-t px-4 py-2"} style={{ borderColor: "var(--line)" }}>
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

      <div className="flex gap-2">
        {page > 0 && <button type="button" className="btn-ghost px-4 py-3.5 text-sm" onClick={() => setPage((p) => p - 1)}>Back</button>}
        <button type="button" className="btn-primary flex-1 py-3.5 text-base" onClick={() => (last ? finish() : setPage((p) => p + 1))}>
          {last ? "Correct, go to size" : "Correct, next"}
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
/** The drawn size of a frame or a shutter (and its pipe), shared by the drawing and its arrows. */
const BUILT = { frame: { W: 150, H: 118, t: 13 }, shutter: { W: 104, H: 150, t: 11 } };

function Built({ frame, fill, lockLeft, meshClip, mitreTB, mitreLR, sidesFull, width, at }: {
  frame: boolean; fill: string; lockLeft: boolean; meshClip: boolean; mitreTB: boolean; mitreLR: boolean; sidesFull: boolean; width?: number;
  /** drawn inside a bigger drawing, its top-left corner here */
  at?: { x: number; y: number };
}) {
  const id = useId().replace(/:/g, "");
  const { W, H, t } = frame ? BUILT.frame : BUILT.shutter;
  const x = at?.x ?? 6, y = at?.y ?? 6;
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
  const body = (
    <>
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
    </>
  );
  if (at) return <g>{body}</g>;
  return (
    <svg viewBox={`0 0 ${W + 12 + (meshClip ? 8 : 0)} ${H + 12}`} className="block" style={{ width: width ?? (frame ? 150 : 108) }} role="img" aria-label={frame ? "Frame" : "Shutter"}>
      {body}
    </svg>
  );
}

/** A name over two short lines at most, for the narrow side columns. */
function wrap(name: string, max = 15): string[] {
  const lines: string[] = [];
  // a size such as "2½ × ¾" stays on one line
  for (const w of name.replace(/ × /g, " × ").split(" ")) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= max) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  return lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
}
