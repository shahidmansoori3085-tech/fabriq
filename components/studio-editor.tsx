"use client";
/**
 * One system, edited around its drawing. The window is drawn to scale from
 * the system itself; tap a piece to see its section, its cut and change
 * anything; tap a shutter to set glass / mesh and per-shutter sections.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { inches, type Um } from "../lib/engine/units";
import type { PartDef, PartScope, ProfileDef, ProfileKind, StudioSystem, Place } from "../lib/studio/model";
import { evaluate, computeSizes, jobVars, matches, type StudioJob } from "../lib/studio/evaluate";
import { windowGeometry } from "../lib/studio/geometry";
import { withAlternatives, alternativesOf, partLabel } from "../lib/studio/edit";
import { PART_KIND } from "../lib/studio/templates";
import { findProfile, newId, type StudioLibrary } from "../lib/studio/store";
import { HardwareTab } from "./studio/hardware";
import { layoutLabel, fmtLen, readLen, lenToInput, noMaker, sectionTitle, MIXES, mixText, ruleText, whenText, type StudioUnit } from "../lib/studio/format";
import dynamic from "next/dynamic";
import WindowDrawing, { type Pick } from "./studio-drawing";

// three.js is heavy: load the 3D view only when it is opened
const Window3D = dynamic(() => import("./studio-3d"), { ssr: false, loading: () => <div className="grid h-[380px] place-items-center text-sm" style={{ color: "var(--ink-3)" }}>Building 3D…</div> });
import SectionSketch from "./section-sketch";
import { SectionPicker } from "./studio/pickers";
import { PipeCard, PaneCard } from "./studio/pipe-card";
import { WindowParts, pipeLabels } from "./studio/window-parts";
import { CutsTab } from "./studio/rules";
import { TeachPanel } from "./studio/teach";
import { CutList } from "./studio/cutlist";
import { Seg, Field, SectionTitle } from "./studio-ui";

export { ProfileForm } from "./studio/pickers";

type Tab = "pieces" | "cut" | "hardware" | "rules" | "teach";

const SCOPE_TITLE: Record<PartScope, string> = {
  window: "Frame",
  shutter: "Each shutter",
  meeting: "Where two glass shutters meet",
  between: "Between sashes (mullion)",
};


function roleFrom(name: string, scope: PartScope): string {
  const n = name.trim() || "Piece";
  return scope === "shutter" ? `{s} ${n}{tag}` : scope === "meeting" ? `${n} {k}` : n;
}

const sizeLabel = (sys: StudioSystem, id: string) =>
  id === "W" ? "Window width" : id === "H" ? "Window height" : sys.sizes.find((s) => s.id === id)?.label ?? id;

/** What the shop should do next, in one line. */
export function nextStep(sys: StudioSystem): { text: string; tab: Tab; tone: "good" | "warn" | "bad" } {
  const lay = sys.layouts[0];
  const r = evaluate(sys, { id: "W1", W: 1524000, H: 1219200, qty: 1, tracks: lay?.tracks ?? 2, mix: lay?.mixes[0] ?? "GG" }, { allowUnknown: true });
  const sections = r.missing.filter((m) => m.startsWith("Section for"));
  if (sections.length) return { text: `Choose ${sections.length === 1 ? "a section" : `${sections.length} sections`} — tap the red pieces`, tab: "pieces", tone: "bad" };
  if (r.missing.length) return { text: `${r.missing.length} cut formula${r.missing.length > 1 ? "s" : ""} missing. Measure one finished window to complete them.`, tab: "teach", tone: "warn" };
  if (sys.jobs.length === 0) return { text: "Cut formulas ready. Verify once with a window you have made.", tab: "teach", tone: "good" };
  if (sys.status === "teaching") return { text: "Formulas set from your window. Confirm with a second window.", tab: "teach", tone: "warn" };
  return { text: "Ready to use.", tab: "cut", tone: "good" };
}

/** time of a change (called from event handlers only) */
const stamp = () => Date.now();

export default function StudioEditor({ sys, lib, unit, onUnit, onChange: save, onAddProfile, onBack, onDuplicate, onDelete, startTab }: {
  sys: StudioSystem;
  lib: StudioLibrary;
  unit: StudioUnit;
  /** inch.sut or mm: chosen where the sizes are typed */
  onUnit: (u: StudioUnit) => void;
  onChange: (s: StudioSystem) => void;
  onAddProfile: (p: ProfileDef) => void;
  onBack: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** open on this tab (e.g. "teach" after a section size changed) */
  startTab?: Tab;
}) {
  const lay0 = sys.layouts[0] ?? { tracks: 2, mixes: ["GG"] };
  const [W, setW] = useState<Um>(inches(60));
  const [H, setH] = useState<Um>(inches(48));
  const [tracks, setTracks] = useState(lay0.tracks);
  const [mix, setMix] = useState(lay0.mixes[0] ?? "GG");
  const [switches, setSwitches] = useState<Record<string, string>>({});
  const [perShutter, setPerShutter] = useState<Record<string, string>[]>([]);
  const [pick, setPick] = useState<Pick>(null);
  // the system page is a short menu; each topic opens on its own screen (founder 2026-11-16:
  // one clean thing at a time, so a fabricator new to it understands it at once)
  const [page, setPage] = useState<Page>(startTab === "teach" ? "check" : "home");
  // A piece given another section moves the cuts: go straight to the 2-window check —
  // a fabricator will not look for it later (founder).
  const onChange = (next: StudioSystem, cutMoved?: string) => {
    if (cutMoved) { save({ ...next, changed: { what: cutMoved, at: stamp() } }); return; }
    const sec = (s: StudioSystem) => new Map(s.parts.map((p) => [p.id, [...p.profile.map((c) => c.id), p.meshProfile ?? ""].join(",")]));
    const before = sec(sys), after = sec(next);
    const swapped = next.parts.filter((p) => before.has(p.id) && before.get(p.id) !== after.get(p.id) && p.profile.some((c) => c.id));
    if (swapped.length && page !== "check") {
      save({ ...next, changed: { what: `Section changed: ${swapped.map((p) => partLabel(p)).join(", ")}`, at: stamp() } });
      open("check");
      return;
    }
    save(next);
  };
  const [menu, setMenu] = useState(false);
  const [view3d, setView3d] = useState(false);
  const [picker, setPicker] = useState<{ partId: string; partIds?: string[]; slot: "main" | "mesh" | "alt"; idx?: number } | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // a pipe or pane tapped on the drawing: bring its card into view (the drawing stays above it)
  const pickKey = pick ? `${pick.type}:${pick.type === "part" ? pick.id : pick.index}` : "";
  useEffect(() => {
    if (pickKey) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [pickKey]);

  // each screen is a history entry: the phone's Back returns to the system page
  useEffect(() => {
    const onPop = () => { setPage((window.history.state?.sysPage as Page | undefined) ?? "home"); setPick(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = (p: Page) => {
    if (p === page) return;
    window.history.pushState({ ...(window.history.state ?? {}), sysPage: p, sheet: undefined }, "");
    setPage(p); setPick(null);
    window.scrollTo({ top: 0 });
  };
  const back = () => { if (window.history.state?.sysPage) window.history.back(); else setPage("home"); };

  // a track count the system no longer offers falls back to its first layout
  useEffect(() => {
    const first = sys.layouts[0];
    if (first && !sys.layouts.some((l) => l.tracks === tracks)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTracks(first.tracks); setMix(first.mixes[0] ?? "GG");
    }
  }, [sys.layouts, tracks]);

  const job: StudioJob = useMemo(() => ({ id: "W1", W, H, qty: 1, tracks, mix, switches, perShutter }), [W, H, tracks, mix, switches, perShutter]);
  const find = (id: string) => findProfile(lib, id);
  const geo = useMemo(() => windowGeometry(sys, job, (id) => findProfile(lib, id)), [sys, job, lib]);
  const values = useMemo(() => computeSizes(sys, job).values, [sys, job]);
  const vars = useMemo(() => jobVars(sys, job), [sys, job]);
  const step = useMemo(() => nextStep(sys), [sys]);
  // a change that moves the cuts and is not checked with 2 windows yet
  const pendingCheck = (sys.changed?.at ?? 0) > (sys.taughtAt ?? 0) || sys.parts.some((p) => [...p.profile.map((c) => c.id), p.meshProfile ?? ""]
    .some((id) => { const pr = id ? findProfile(lib, id) : undefined; return !!pr?.sizeChanged && pr.sizeChanged.at > (sys.taughtAt ?? 0); }));

  const selectPart = (id: string) => { setPick({ type: "part", id }); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  /** one piece takes another section (the same choice is made on every piece of its group) */
  const applyChoice = (s0: StudioSystem, partId: string, slot: "main" | "mesh" | "alt", idx: number | undefined, profileId: string): StudioSystem => {
    const p = s0.parts.find((x) => x.id === partId);
    if (!p) return s0;
    const label = (id: string) => find(id)?.name ?? id;
    const alts = alternativesOf(s0, p);
    const patch = (q: Partial<PartDef>) => ({ ...s0, parts: s0.parts.map((x) => (x.id === partId ? { ...x, ...q } : x)) });
    if (slot === "mesh") return patch({ meshProfile: profileId });
    if (slot === "alt") return withAlternatives(s0, p.id, [...(alts ?? [p.profile[p.profile.length - 1]?.id ?? ""]), profileId], label);
    if (alts) return withAlternatives(s0, p.id, alts.map((a, i) => (i === (idx ?? 0) ? profileId : a)), label);
    if (idx !== undefined && p.profile.length > 1) return patch({ profile: p.profile.map((c, i) => (i === idx ? { ...c, id: profileId } : c)) });
    return patch({ profile: [{ id: profileId }] });
  };
  const choose = (profileId: string) => {
    if (!picker) return;
    let next = sys;
    for (const id of picker.partIds ?? [picker.partId]) next = applyChoice(next, id, picker.slot, picker.idx, profileId);
    onChange(next);
    setPicker(null);
  };

  const pickedPart = pick?.type === "part" ? sys.parts.find((p) => p.id === pick.id) : undefined;
  const pickerPart = picker ? sys.parts.find((p) => p.id === picker.partId) : undefined;
  const partGroup = pickedPart ? groupOf(sys, pickedPart) : [];

  const hasMesh = sys.layouts.some((l) => l.mixes.some((m) => m.includes("J")));
  const pipeCard = pickedPart && (
    <PipeCard key={pickedPart.id} sys={sys} lib={lib} unit={unit} part={pickedPart} group={partGroup.length ? partGroup : [pickedPart]}
      values={values} vars={vars} tracks={tracks} hasMesh={hasMesh} onSys={onChange}
      onPickSection={(slot, idx) => setPicker({ partId: pickedPart.id, partIds: partGroup.map((g) => g.id), slot, idx })}
      onCheck={() => open("check")} onClose={() => setPick(null)} />
  );
  const paneCard = pick?.type === "shutter" && (
    <PaneCard key={pick.index} sys={sys} lib={lib} unit={unit} index={pick.index} mix={mix} values={values} vars={vars} perShutter={perShutter}
      meetClip={(switches.meet ?? sys.switches.find((x) => x.id === "meet")?.default) === "clip"}
      onKind={(k) => setMix((m) => m.slice(0, pick.index) + k + m.slice(pick.index + 1))}
      onChoice={(swId, v) => setPerShutter((ps) => { const next = [...ps]; next[pick.index] = { ...(next[pick.index] ?? {}), [swId]: v }; return next; })}
      onSys={onChange} onCheck={() => open("check")} onClose={() => setPick(null)} />
  );
  // every pipe carries its cut on the drawing; the glass its size
  const labels = useMemo(() => pipeLabels(sys, lib, vars, values, unit, geo), [sys, lib, vars, values, unit, geo]);
  const iw = values[sys.infill.w], ih = values[sys.infill.h];
  const infillText = iw != null && ih != null ? `${fmtLen(iw, unit)} × ${fmtLen(ih, unit)}` : undefined;
  const sectionPicker = picker && pickerPart && (
    <SectionPicker lib={lib} kind={kindFor(lib, pickerPart, picker.slot)}
      title={picker.slot === "alt" ? `Another section for ${partLabel(pickerPart)}` : `Section for ${(picker.partIds && picker.partIds.length > 1 ? groupName(sys, sys.parts.filter((x) => picker.partIds!.includes(x.id))) : partLabel(pickerPart))}${picker.slot === "mesh" ? " (mesh shutter)" : ""}`}
      onPick={choose} onAdd={(prof) => { onAddProfile(prof); choose(prof.id); }} onClose={() => setPicker(null)} />
  );

  /* ——— one topic on its own screen ——— */
  if (page !== "home") {
    const meta = PAGES.find((x) => x.id === page)!;
    return (
      <div ref={top} style={{ scrollMarginTop: 8 }}>
        <button onClick={back} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← {sys.name}</button>
        <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>{meta.help}</p>

        {page === "sections" && <>
          {pipeCard}
          <SectionsPage sys={sys} lib={lib} tracks={tracks} vars={vars} onChange={onChange} onSelect={selectPart} />
        </>}
        {page === "cuts" && <CutSizesPage sys={sys} unit={unit} onChange={onChange} onCheck={() => open("check")} />}
        {page === "options" && <OptionsPage sys={sys} onChange={onChange} />}
        {page === "hardware" && <div className="mt-2"><HardwareTab sys={sys} onChange={onChange} /></div>}
        {page === "check" && <div className="mt-2"><TeachPanel sys={sys} lib={lib} unit={unit} onUnit={onUnit} job={job} onChange={onChange} /></div>}
        {page === "try" && <div className="mt-4"><CutList sys={sys} lib={lib} unit={unit} job={job} onFix={(w) => open(w === "teach" ? "check" : w === "pieces" ? "sections" : "cuts")} /></div>}
        {sectionPicker}
      </div>
    );
  }

  /* ——— the system page: name, state, picture, and one line per topic ——— */
  const missingSections = sys.parts.filter((p) => p.enabled !== false && p.profile.every((c) => !c.id)).length;
  // only lengths that cannot be worked out for this system as usually made (not a spare fallback line)
  const unknownCuts = sys.sizes.filter((s) => values[s.id] === null || values[s.id] === undefined).length;
  const state = missingSections ? { label: "Sections missing", tone: "bad" as const }
    : pendingCheck ? { label: "Check needed", tone: "warn" as const }
    : step.tone === "warn" ? { label: "Check needed", tone: "warn" as const }
    : { label: "Ready", tone: "good" as const };
  const toneFg = (t: "good" | "warn" | "bad") => (t === "good" ? "var(--good)" : t === "warn" ? "var(--warn)" : "var(--bad)");
  const toneBg = (t: "good" | "warn" | "bad") => (t === "good" ? "var(--good-soft)" : t === "warn" ? "var(--warn-soft)" : "var(--bad-soft)");
  const sub: Record<Page, { text: string; tone?: "good" | "warn" | "bad" }> = {
    home: { text: "" },
    sections: missingSections ? { text: `${missingSections} piece${missingSections > 1 ? "s" : ""} without a section`, tone: "bad" } : { text: `${groupRows(sys).length} pipes · ${[...new Set(sys.parts.map((p) => ({ window: "frame", shutter: "shutter", meeting: "interlock", between: "mullion" } as const)[p.scope]))].join(", ")}` },
    cuts: unknownCuts ? { text: `${unknownCuts} not known yet`, tone: "warn" } : { text: `${sys.sizes.length} lengths, worked out from the window size` },
    options: { text: [sys.layouts.map((l) => layoutLabel(sys, l.tracks)).join(" / "), ...sys.switches.filter((x) => !x.id.startsWith("pick_") && x.id !== "joint" && x.id !== "sash" && x.options.length > 1).map((x) => SWITCH_NAME[x.id] ?? x.label)].join(" · ") },
    hardware: { text: sys.extras.length ? sys.extras.slice(0, 3).map((x) => x.name.split(" /")[0]).join(", ") + (sys.extras.length > 3 ? ` +${sys.extras.length - 3}` : "") : "None yet" },
    try: { text: `For ${fmtLen(W, unit)} × ${fmtLen(H, unit)}` },
    check: pendingCheck ? { text: "Needed: a section or size changed", tone: "warn" }
      : sys.jobs.length ? { text: `Checked with ${sys.jobs.length} window${sys.jobs.length > 1 ? "s" : ""}`, tone: "good" }
      : { text: "Not done yet · enter 2 windows you made" },
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>← Systems</button>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} className="btn-ghost px-3 py-1.5 text-sm" aria-haspopup="menu">More</button>
          {menu && (
            <div role="menu" className="card absolute right-0 z-30 mt-1 w-44 overflow-hidden p-1" style={{ boxShadow: "var(--shadow-lg)" }}>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => { setMenu(false); onDuplicate(); }}>Duplicate</button>
              <button role="menuitem" className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" style={{ color: "var(--bad)" }}
                onClick={() => { setMenu(false); if (window.confirm(`Delete "${sys.name}"? This cannot be undone.`)) onDelete(); }}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <input value={sys.name} onChange={(e) => onChange({ ...sys, name: e.target.value })} aria-label="System name"
          className="min-w-0 flex-1 bg-transparent text-[26px] font-bold leading-tight tracking-tight outline-none" />
        <span className="mt-1.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: toneBg(state.tone), color: toneFg(state.tone) }}>{state.label}</span>
      </div>
      <p className="mt-0.5 text-sm" style={{ color: "var(--ink-3)" }}>
        {sys.layouts.length > 2 ? `${layoutLabel(sys, sys.layouts[0].tracks).replace(/ sash(es)?$/, "")} to ${layoutLabel(sys, sys.layouts[sys.layouts.length - 1].tracks)}` : sys.layouts.map((l) => layoutLabel(sys, l.tracks)).join(" and ")}{sys.switches.some((x) => x.id === "joint") ? " · 90° or 45° cutting" : sys.parts.some((p) => p.place?.startsWith("frame") && p.angle === 45) ? " · 45° frame" : " · 90° frame"}
      </p>

      {(() => {
        // sections whose size the shop changed after these cuts were last checked
        const ids = new Set(sys.parts.flatMap((p) => [...p.profile.map((c) => c.id), p.meshProfile ?? ""]).filter(Boolean));
        const changed = [...ids].map((id) => findProfile(lib, id)).filter((p): p is ProfileDef => !!p?.sizeChanged && p.sizeChanged.at > (sys.taughtAt ?? 0));
        const notes = [
          ...changed.map((p) => `Size of ${sectionTitle(p.name)} changed (${p.sizeChanged!.from} → ${p.size})`),
          ...(sys.changed && sys.changed.at > (sys.taughtAt ?? 0) ? [sys.changed.what] : []),
        ];
        if (!notes.length) return null;
        return (
          <button onClick={() => open("check")} className="mt-3 w-full rounded-xl px-3 py-2.5 text-left text-sm"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
            <b>Cuts need checking.</b> {notes.join(". ")}.
            <span className="mt-1 block font-semibold">Enter 2 windows you have made ›</span>
          </button>
        );
      })()}

      {/* the window, drawn to scale with every cut on it: tap a pipe or a pane to change it
          (founder 2026-11-17: the drawing is the page — like the big window software) */}
      <div ref={top} className="card mt-4 overflow-hidden" style={{ scrollMarginTop: 8 }}>
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <span className="text-[13px] font-semibold" style={{ color: pick ? "var(--accent)" : "var(--ink-3)" }}>
            {view3d ? "Drag to turn it" : pick ? "Tap empty space to close" : "Tap any pipe or the glass"}
          </span>
          <Seg small value={view3d ? "3d" : "2d"} onChange={(v) => { setView3d(v === "3d"); setPick(null); }} options={[{ value: "2d", label: "Drawing" }, { value: "3d", label: "3D" }]} />
        </div>
        <div className="px-1 pb-1">
          {view3d ? <Window3D g={geo} pick={pick} onPick={setPick} tracks={tracks} />
            : <WindowDrawing g={geo} unit={unit} pick={pick} onPick={setPick} labels={labels} infill={infillText} />}
        </div>
      </div>
      {/* 90° or 45°: big and plain, right under the drawing (founder 2026-11-18: the small switch was not seen) */}
      {sys.switches.some((x) => x.id === "joint" || x.id === "sash") && (
        <div className="card mt-3 flex flex-col px-4 py-1">
          {sys.switches.filter((x) => x.id === "joint" || x.id === "sash").map((sw, i) => {
            const val = switches[sw.id] ?? sw.default;
            return (
              <div key={sw.id} className="flex items-center justify-between gap-3 py-2.5" style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{sw.id === "joint" ? "Track cutting" : "Shutter cutting"}</span>
                  <span className="block text-xs" style={{ color: "var(--ink-3)" }}>
                    {sw.id === "joint" ? (val === "45" ? "45°: all four sides full length" : "90°: top and bottom fit between the sides")
                      : (val === "45" ? "45°: handle pipe on all four sides" : "90°: bearings fit between handle and interlock")}
                  </span>
                </span>
                <div className="flex shrink-0 gap-1 rounded-[var(--radius)] p-1" style={{ background: "var(--surface-3)" }} role="radiogroup" aria-label={sw.label}>
                  {(["90", "45"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={val === v} onClick={() => setSwitches((x) => ({ ...x, [sw.id]: v }))}
                      className="rounded-[8px] px-4 py-1.5 text-sm font-bold"
                      style={val === v ? { background: "var(--surface)", color: "var(--ink)", boxShadow: "0 1px 2px rgba(17, 24, 39, 0.08)" } : { color: "var(--ink-3)" }}>{v}°</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* the tapped pipe or pane opens right under the drawing */}
      <div ref={cardRef} style={{ scrollMarginBottom: 16 }}>{pipeCard}{paneCard}</div>
      <div className="card mt-3 overflow-hidden">
        <WindowBar key={unit} sys={sys} unit={unit} onUnit={onUnit} W={W} H={H} tracks={tracks} mix={mix} switches={switches}
          onSize={(w, h) => { setW(w); setH(h); }}
          onLayout={(t, m) => { setTracks(t); setMix(m); setPerShutter([]); setPick(null); }}
          onSwitch={(id, v) => setSwitches((x) => ({ ...x, [id]: v }))} />
      </div>
      {/* the same window, part by part: the track, then each shutter */}
      {!view3d && <WindowParts sys={sys} lib={lib} unit={unit} geo={geo} values={values} vars={vars} mix={mix} pick={pick} onPick={setPick}
        onSys={(next, note) => onChange(next, note)} onKind={(i, k) => setMix((m) => m.slice(0, i) + k + m.slice(i + 1))} />}

      <div className="card mt-4 overflow-hidden">
        <div className="divide-y" style={{ borderColor: "var(--line)" }}>
        {PAGES.map((x) => (
          <button key={x.id} onClick={() => open(x.id)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left">
            <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              style={{ background: x.id === "check" && sub.check.tone ? (sub.check.tone === "good" ? "var(--good-soft)" : "var(--warn-soft)") : "var(--surface-2)",
                color: x.id === "check" && sub.check.tone ? toneFg(sub.check.tone) : "var(--ink-2)" }}>
              <PageIcon id={x.id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{x.title}</span>
              <span className="mt-0.5 block truncate text-xs" style={{ color: sub[x.id].tone ? toneFg(sub[x.id].tone!) : "var(--ink-3)" }}>{sub[x.id].text}</span>
            </span>
            <span aria-hidden className="text-lg" style={{ color: "var(--ink-3)" }}>›</span>
          </button>
        ))}
        </div>
      </div>
      {sectionPicker}
    </div>
  );
}

/** A plain line icon for each topic of the system page (drawn here, so it never waits for a font). */
function PageIcon({ id }: { id: Exclude<Page, "home"> }) {
  const d: Record<Exclude<Page, "home">, React.ReactNode> = {
    // a bundle of square aluminium pipes standing up, their hollow ends on top
    sections: <><path d="M1.5 10.5h5V21.5h-5z" /><path d="M1.5 10.5l2-3h5l-2 3" /><path d="M3 9.8l1-1.5h2.5l-1 1.5z" /><path d="M8.5 9h5V21.5h-5z" /><path d="M8.5 9l2-3h5l-2 3" /><path d="M10 8.3l1-1.5h2.5l-1 1.5z" /><path d="M15.5 10.5h5V21.5h-5z" /><path d="M15.5 10.5l2-3h5l-2 3" /><path d="M17 9.8l1-1.5h2.5l-1 1.5z" /><path d="M22.5 7.5V18.5l-2 3" /></>,
    // a measuring tape / ruler
    cuts: <><path d="M17 3l4 4L7 21l-4-4z" /><path d="M16 7l-1.5-1.5M13 10l-1.5-1.5M10 13l-1.5-1.5M7 16l-1.5-1.5" /></>,
    // choices: sliders
    options: <><circle cx="14" cy="6" r="2" /><path d="M4 6h8M16 6h4" /><circle cx="8" cy="12" r="2" /><path d="M4 12h2M10 12h10" /><circle cx="17" cy="18" r="2" /><path d="M4 18h11M19 18h1" /></>,
    // a spanner
    hardware: <path d="M7 10h3V7L6.5 3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1-3 3l-6-6a6 6 0 0 1-8-8L7 10" />,
    // a calculator
    try: <><rect x="4" y="3" width="16" height="18" rx="2" /><rect x="8" y="7" width="8" height="3" rx="1" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01" /></>,
    // checked
    check: <><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d[id]}</svg>;
}

type Page = "home" | "sections" | "cuts" | "options" | "hardware" | "try" | "check";
const PAGES: { id: Exclude<Page, "home">; title: string; help: string }[] = [
  { id: "sections", title: "Sections", help: "Which pipe goes where. Tap a pipe to change it." },
  { id: "cuts", title: "Cut sizes", help: "How each length is worked out from the window size." },
  { id: "options", title: "Options", help: "What this system can be made as, and its usual choice." },
  { id: "hardware", title: "Hardware", help: "Rollers, lock, cleats and the rest — counted for every window." },
  { id: "try", title: "Cut list", help: "Every cut and the pipes to buy for the size on the drawing." },
  { id: "check", title: "Match your cuts", help: "Type the cuts of 2 windows you already made. The app learns your cuts and uses them from then on." },
];
/** the shop's words for a choice */
const SWITCH_NAME: Record<string, string> = { meet: "Interlock", mode: "Shutter width", track: "Track", rollerClip: "Track clip" };

/** "2-track", "3-track": the track counts (this system makes) a section is used for */
function trackNote(sys: StudioSystem, p: PartDef, c: PartDef["profile"][number] | undefined): string {
  const made = sys.layouts.map((l) => String(l.tracks));
  const onlyTracks = (w?: PartDef["profile"][number]["when"]) => !!w && Object.keys(w).every((k) => k === "tracks");
  const list = (w: NonNullable<PartDef["profile"][number]["when"]>) => ([] as string[]).concat(w.tracks as string | string[]).map(String);
  if (!c) return "";
  if (c.when && !onlyTracks(c.when)) return whenText(sys, c.when);
  // by track count: the counts this system makes that land on this section
  const taken = new Set(p.profile.filter((x) => x !== c && onlyTracks(x.when)).flatMap((x) => list(x.when!)));
  const mine = c.when ? list(c.when).filter((t) => made.includes(t)) : made.filter((t) => !taken.has(t));
  return mine.length ? mine.map((t) => layoutLabel(sys, Number(t))).join(", ") : "";
}

/** pieces that are the same pipe, cut the same way (e.g. the frame's 4 sides) */
function groupKey(p: PartDef): string {
  return [p.scope, JSON.stringify(p.profile), p.meshProfile ?? "", p.enabled === false ? "off" : "on", JSON.stringify(p.when ?? null), p.angle].join("|");
}
function groupOf(sys: StudioSystem, p: PartDef): PartDef[] {
  const k = groupKey(p);
  return sys.parts.filter((x) => x.id !== "trackClip" && p.id !== "trackClip" ? groupKey(x) === k : x.id === p.id);
}
function groupRows(sys: StudioSystem): PartDef[][] {
  const seen = new Set<string>(), rows: PartDef[][] = [];
  for (const p of sys.parts) { if (seen.has(p.id)) continue; const g = groupOf(sys, p); g.forEach((x) => seen.add(x.id)); rows.push(g); }
  return rows;
}
/** "Frame · all 4 sides", "Shutter · all 4 sides", or the pieces' own names */
function groupName(sys: StudioSystem, g: PartDef[]): string {
  const places = new Set(g.map((p) => p.place));
  if (g.length === 4 && ["frame-top", "frame-bottom", "frame-left", "frame-right"].every((x) => places.has(x as Place))) return "Frame · all 4 sides";
  if (g.length === 4 && ["sash-top", "sash-bottom", "sash-lock", "sash-meet"].every((x) => places.has(x as Place))) return "Shutter · all 4 sides";
  const names = g.map(partLabel);
  const first = names[0]?.split(" ")[0];
  if (names.length > 1 && names.every((n) => n.split(" ")[0] === first && n.includes(" ")))
    return `${first} ${names.map((n) => n.slice(first.length + 1).toLowerCase()).join(", ")}`;
  return names.join(", ");
}

/* ———————————————— Sections: the pipes, grouped ———————————————— */

function SectionsPage({ sys, lib, tracks, vars, onChange, onSelect }: {
  sys: StudioSystem; lib: StudioLibrary; tracks: number; vars: Record<string, string>;
  onChange: (s: StudioSystem) => void; onSelect: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const addPart = (scope: PartScope) => {
    const id = newId("p");
    onChange({ ...sys, parts: [...sys.parts, { id, role: roleFrom("New piece", scope), profile: [{ id: "" }], scope, count: 1, length: sys.sizes[0]?.id ?? "W", angle: 90, place: "other" }] });
    onSelect(id);
  };
  const rows = groupRows(sys);
  const scopes = (sys.family === "casement" ? ["window", "between", "shutter"] : ["window", "shutter", "meeting"]) as PartScope[];
  return (
    <div>
      {scopes.map((scope) => {
        // the track clip is cut once per shutter lane but belongs with the track (founder)
        const list = rows.filter((g) => (g[0].id === "trackClip" ? "window" : g[0].scope) === scope);
        if (!list.length) return null;
        return (
          <div key={scope}>
            <SectionTitle>{SCOPE_TITLE[scope]}</SectionTitle>
            <div className="card divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
              {list.map((g) => {
                const p = g[0];
                const alts = alternativesOf(sys, p);
                // every section this pipe can be: its choices, or one per track count
                const lines = (alts ?? [...new Set(p.profile.map((c) => c.id))]).map((id) => {
                  const c = p.profile.find((x) => x.id === id);
                  const pr = id ? findProfile(lib, id) : undefined;
                  const when = !alts && p.profile.length > 1 ? trackNote(sys, p, c) : alts && alts.length > 1 ? "choice" : "";
                  return { id, pr, when };
                });
                // with a choice of slims, the meeting side can also be the shutter itself (with the interlock clip)
                if (alts) for (const c of p.profile) if (c.id && c.when && !alts.includes(c.id) && !Object.keys(c.when).some((k) => k.startsWith("pick_")))
                  lines.push({ id: c.id, pr: findProfile(lib, c.id), when: whenText(sys, c.when) });
                const cur = p.profile.find((x) => matches(x.when, vars)) ?? p.profile[p.profile.length - 1];
                const shown = findProfile(lib, alts ? alts[0] : cur?.id ?? "");
                const off = p.enabled === false;
                const missing = lines.every((l) => !l.pr);
                return (
                  <button key={p.id} onClick={() => onSelect(p.id)} className="flex w-full items-center gap-3 px-3 py-3 text-left" style={{ opacity: off ? 0.5 : 1 }}>
                    <span className="h-12 w-14 shrink-0 overflow-hidden rounded-md border bg-white" style={{ borderColor: missing ? "var(--bad)" : "var(--line)" }}>
                      <SectionSketch p={shown} tracks={tracks} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-tight">{groupName(sys, g)}{p.count > 1 ? ` ×${p.count}` : ""}</span>
                      {missing
                        ? <span className="mt-0.5 block text-xs font-semibold" style={{ color: "var(--bad)" }}>Choose a section</span>
                        : lines.filter((l) => l.pr).map((l) => (
                          <span key={l.id} className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>
                            {[l.pr!.codes && Object.values(l.pr!.codes)[0] ? noMaker(Object.values(l.pr!.codes)[0]) : "", sectionTitle(l.pr!.name), l.when].filter(Boolean).join(" · ")}
                          </span>
                        ))}
                      {p.meshProfile && <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ink-3)" }}>Mesh shutter: {sectionTitle(findProfile(lib, p.meshProfile)?.name ?? p.meshProfile)}</span>}
                      {off && <span className="mt-0.5 block text-xs" style={{ color: "var(--ink-3)" }}>Not used</span>}
                    </span>
                    <span aria-hidden className="text-lg" style={{ color: "var(--ink-3)" }}>›</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <button onClick={() => setAdding(!adding)} className="mt-5 w-full text-sm font-semibold" style={{ color: "var(--accent)" }}>
        {adding ? "Close" : "+ Add a piece"}
      </button>
      {adding && (
        <div className="card mt-2 p-3">
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>Where does the new piece go?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {scopes.map((s) => <button key={s} onClick={() => { setAdding(false); addPart(s); }} className="chip px-3 py-2 text-sm">{SCOPE_TITLE[s]}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ———————————————— Cut sizes: each length in one line ———————————————— */

function CutSizesPage({ sys, unit, onChange, onCheck }: { sys: StudioSystem; unit: StudioUnit; onChange: (s: StudioSystem) => void; onCheck: () => void }) {
  const [edit, setEdit] = useState(false);
  if (edit) return (
    <div className="mt-3">
      <button onClick={() => setEdit(false)} className="mb-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>← Back to the list</button>
      <CutsTab sys={sys} unit={unit} onChange={onChange} />
    </div>
  );
  return (
    <div>
      <div className="card mt-4 divide-y overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {sys.sizes.map((s) => (
          <div key={s.id} className="px-4 py-3">
            <div className="font-semibold">{s.label}</div>
            {s.cases.map((c, i) => (
              <div key={i} className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-xs" style={{ color: "var(--ink-3)" }}>{s.cases.length > 1 ? (c.when ? whenText(sys, c.when) : "Usual") : ""}</span>
                <span className="mono shrink-0 font-semibold" style={{ color: c.add === null ? (s.cases.length > 1 ? "var(--ink-3)" : "var(--warn)") : "var(--ink)" }}>
                  {c.add === null ? "Not known yet" : ruleText(c, sizeLabel(sys, c.base).replace("Window width", "Width").replace("Window height", "Height"), unit).replace(/~/g, "")}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>Width and height are the window size. To change a cut, tap its pipe on the drawing.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onCheck} className="btn-primary py-3 text-sm">Check with your window</button>
        <button onClick={() => setEdit(true)} className="btn-ghost py-3 text-sm">Change a formula</button>
      </div>
    </div>
  );
}

/* ———————————————— Options: what the system can be made as ———————————————— */

function OptionsPage({ sys, onChange }: { sys: StudioSystem; onChange: (s: StudioSystem) => void }) {
  const tracksOn = new Set(sys.layouts.map((l) => l.tracks));
  const toggleTracks = (t: number) => {
    const layouts = tracksOn.has(t)
      ? sys.layouts.filter((l) => l.tracks !== t)
      : [...sys.layouts, { tracks: t, mixes: MIXES[t] }].sort((a, b) => a.tracks - b.tracks);
    if (layouts.length) onChange({ ...sys, layouts });
  };
  const choices = sys.switches.filter((x) => !x.id.startsWith("pick_") && x.id !== "mode" && x.id !== "joint" && x.id !== "sash" && x.options.length > 1);
  const setDefault = (id: string, v: string) => onChange({ ...sys, switches: sys.switches.map((x) => (x.id === id ? { ...x, default: v } : x)) });
  const mode = sys.switches.find((x) => x.id === "mode");
  const canShare = !!mode && !!sys.sizes.find((x) => x.id === "shutterW")?.cases.some((k) => k.when?.mode === "equal");
  const split = canShare ? mode!.default : "half";
  return (
    <div>
      <SectionTitle>{sys.family === "casement" ? "Sashes" : "Tracks"}</SectionTitle>
      <div className="card p-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((t) => (
            <button key={t} onClick={() => toggleTracks(t)} aria-pressed={tracksOn.has(t)}
              className={`chip px-3.5 py-2 text-sm ${tracksOn.has(t) ? "selected" : ""}`}>{layoutLabel(sys, t)}</button>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>The ones you make. Each keeps its own cuts.</p>
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {sys.layouts.map((l) => (
            <div key={l.tracks} className="flex justify-between gap-3"><span style={{ color: "var(--ink-3)" }}>{layoutLabel(sys, l.tracks)}</span><span className="text-right">{l.mixes.map(mixText).join(" · ")}</span></div>
          ))}
        </div>
      </div>

      {choices.map((x) => (
        <div key={x.id}>
          <SectionTitle>{SWITCH_NAME[x.id] ?? x.label}</SectionTitle>
          <div className="card p-3">
            <div className="flex flex-col gap-2">
              {x.options.map((o) => (
                <button key={o.value} onClick={() => setDefault(x.id, o.value)} aria-pressed={x.default === o.value}
                  className={`chip flex items-center justify-between px-3 py-2.5 text-left text-sm font-semibold ${x.default === o.value ? "selected" : ""}`}>
                  <span>{o.label}</span>{x.default === o.value && <span className="text-xs" style={{ color: "var(--accent)" }}>Usual</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>The usual one comes chosen when a window is made. It can still be changed there.</p>
          </div>
        </div>
      ))}

      {sys.family !== "casement" && <>
        <SectionTitle>Shutter width</SectionTitle>
        <div className="card p-3">
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>For windows with 3 or 4 glass shutters. With 2 shutters, each is half the window.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([["half", "Half each", "Every shutter is half the window. The window opens half."],
              ["equal", "Share the width", "The shutters share the window width. The window opens more."]] as const).map(([v, title, subText]) => {
              const on = split === v, off = v === "equal" && !canShare;
              return (
                <button key={v} type="button" onClick={() => { if (!off && mode) onChange({ ...sys, splitSet: true, switches: sys.switches.map((x) => (x.id === "mode" ? { ...x, default: v } : x)) }); }}
                  aria-pressed={on} disabled={off} className="card px-3 py-2.5 text-left"
                  style={{ borderColor: on ? "var(--accent)" : "var(--line)", borderWidth: on ? 2 : 1, background: on ? "var(--accent-soft, var(--surface-2))" : "var(--surface)", opacity: off ? 0.55 : 1 }}>
                  <div className="text-sm font-bold">{title}</div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>{off ? "The size for this series is not known yet." : subText}</div>
                </button>
              );
            })}
          </div>
        </div>
      </>}
    </div>
  );
}


function kindFor(lib: StudioLibrary, p: PartDef, slot: "main" | "mesh" | "alt"): ProfileKind | undefined {
  if (slot === "mesh") return "mesh-shutter";
  if (slot === "alt" && p.place === "sash-meet") return undefined; // interlock or slim interlock: show both
  return findProfile(lib, p.profile[p.profile.length - 1]?.id ?? "")?.kind ?? PART_KIND[p.id];
}

/* ———————————————— window size and layout ———————————————— */

function WindowBar({ sys, unit, onUnit, W, H, tracks, mix, switches, onSize, onLayout, onSwitch }: {
  sys: StudioSystem; unit: StudioUnit; onUnit: (u: StudioUnit) => void; W: Um; H: Um; tracks: number; mix: string; switches: Record<string, string>;
  onSize: (w: Um, h: Um) => void; onLayout: (t: number, m: string) => void; onSwitch: (id: string, v: string) => void;
}) {
  const [w, setW] = useState(lenToInput(W, unit));
  const [h, setH] = useState(lenToInput(H, unit));
  const commit = (ws: string, hs: string) => {
    const a = readLen(ws, unit), b = readLen(hs, unit);
    if (a && b && a > 254000 && b > 254000 && a < 9144000 && b < 9144000) onSize(a, b);
  };
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];
  return (
    <div className="border-t px-3 py-3" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold">Window size</span>
        <Seg small value={unit === "mm" ? "mm" : "in"} onChange={onUnit} options={[{ value: "in", label: "inch.sut" }, { value: "mm", label: "mm" }]} />
      </div>
      <div className="flex items-end gap-2">
        <Field label="Width">
          <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={w}
            onChange={(e) => { setW(e.target.value); commit(e.target.value, h); }} />
        </Field>
        <span className="pb-2.5 text-lg" style={{ color: "var(--ink-3)" }}>×</span>
        <Field label="Height">
          <input className="field w-full px-3 py-2 text-base font-semibold" inputMode="decimal" value={h}
            onChange={(e) => { setH(e.target.value); commit(w, e.target.value); }} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sys.layouts.map((l) => (
          <button key={l.tracks} onClick={() => onLayout(l.tracks, l.mixes[0])} aria-pressed={l.tracks === tracks}
            className={`chip px-3 py-1.5 text-sm ${l.tracks === tracks ? "selected" : ""}`}>{layoutLabel(sys, l.tracks)}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(lay?.mixes ?? []).map((m) => (
          <button key={m} onClick={() => onLayout(tracks, m)} aria-pressed={m === mix}
            className={`chip px-2.5 py-1 text-xs ${m === mix ? "selected" : ""}`}>{mixText(m)}</button>
        ))}
      </div>
      {sys.switches.filter((s) => !s.id.startsWith("pick_") && s.id !== "mode" && s.id !== "joint" && s.id !== "sash").map((sw) => (
        <div key={sw.id} className="mt-3">
          <div className="mb-1 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>{sw.label}</div>
          <Seg small value={switches[sw.id] ?? sw.default} onChange={(v) => onSwitch(sw.id, v)} options={sw.options.map((o) => ({ value: o.value, label: o.label }))} />
        </div>
      ))}
    </div>
  );
}
