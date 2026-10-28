"use client";

/**
 * FabriQ — launch build.
 *
 * One job, done well: the fabricator types his sizes, and gets
 *   1. the Material List — how many pipes of each section to buy, plus glass/mesh sizes
 *   2. the Cutting Sheet — what to cut from which pipe, with drawings
 * and can send each one on WhatsApp. Nothing else on screen.
 *
 * Photo reading, quotation, 3D, the AI copilot and the offcut bank were
 * taken out for launch: each was one more thing to understand before the
 * first material list.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatFtInSut, toFeet, sqft, parseOpening, describeDim, openingWarning, type Um,
} from "@/lib/engine/units";
import { PieceTooLongError } from "@/lib/engine/cutting";
import { estimate, ImpossibleLayoutError } from "@/lib/engine/estimator";
import { buildJobItem } from "@/lib/engine/quick-item";
import {
  getSection, BRANDS, sectionCode, loadBrand, saveBrand, type BrandId,
} from "@/lib/engine/sections";
import { reviewEstimate } from "@/lib/engine/review";
import type {
  JobItem, MaterialList, OpeningType, PackedBar, CutPiece, ReviewFinding,
} from "@/lib/engine/types";
import { CuttingGuide } from "@/components/diagrams";
import { SectionProfile, SectionDrawing, hasImage } from "@/components/section-profiles";
import { EngineeringSheet } from "@/components/eng-sheet";
import { SupplierOrderDoc } from "@/components/supplier-doc";
import { sharePdfToWhatsApp, elementToPdfBlob, whatsAppLink, type ShareResult } from "@/lib/pdf";
import {
  loadProjects, saveProject, patchProject, removeProject, newProjectId, autoTitle, totalSqft,
  type ProjectRec,
} from "@/lib/projects";
import { loadShop, saveShop, type ShopProfile } from "@/lib/shop";

/* ————————————————— item options ————————————————— */

type WinSys = "normal" | "domal" | "z_section";

/** Everything the add-item form can ask. Kept between adds on purpose: a job
 *  is usually ten windows of the same kind, so only the size changes. */
interface Opts {
  sys: WinSys;
  tracks: string;
  mix: string;
  domalFix: string;
  domalFixFt: string;
  zType: string;
  zComboDir: string;
  zFixedFt: string;
  zSash: string;
  zSize: string;
  palla: string;
  chokhat: string;
  doorMix: string;
  partDoor: string;
  partDoorW: string;
  partBayFt: string;
  partRowFt: string;
  partSheetFt: string;
}

const DEFAULT_OPTS: Opts = {
  sys: "normal", tracks: "2", mix: "GG", domalFix: "no", domalFixFt: "2",
  zType: "openable", zComboDir: "top", zFixedFt: "2", zSash: "2", zSize: "light",
  palla: "60", chokhat: "needed", doorMix: "GSS",
  partDoor: "no", partDoorW: "3", partBayFt: "2.5", partRowFt: "3.5", partSheetFt: "0",
};

type Opt = [value: string, label: string];

const TYPES: Opt[] = [["window", "Window"], ["door", "Door"], ["partition", "Partition"]];
const SYSTEMS: Opt[] = [["normal", "Sliding"], ["domal", "Domal"], ["z_section", "Z-Section"]];
// No 4 Track: the catalogue has no 4-track frame, and building one on a
// 2-track frame orders a frame its four shutters cannot fit in.
const TRACKS: Opt[] = [["2", "2 Track"], ["3", "3 Track"]];
/** Only the shutter mixes shops actually make; the first one is the default.
 *  "4" stays so a 4-track job saved by an older version still reads. */
const MIXES: Record<string, Opt[]> = {
  "2": [["GG", "2 Glass"], ["GJ", "1 Glass + 1 Mesh"]],
  "3": [["GGJ", "2 Glass + 1 Mesh"], ["GGG", "3 Glass"]],
  "4": [["GGGJ", "3 Glass + 1 Mesh"], ["GGJJ", "2 Glass + 2 Mesh"], ["GGGG", "4 Glass"]],
};
const YES_NO: Opt[] = [["no", "No"], ["yes", "Yes"]];
const FIX_FT: Opt[] = [["1.5", "1.5 ft"], ["2", "2 ft"], ["2.5", "2.5 ft"], ["3", "3 ft"]];
const Z_TYPES: Opt[] = [["openable", "Openable"], ["combo", "Fixed + Openable"], ["fixed", "Fully Fixed"], ["door", "Door"]];
const Z_DIRS: Opt[] = [["top", "Top"], ["side", "One side"], ["both", "Both sides"]];
const Z_SASH: Opt[] = [["1", "1"], ["2", "2"], ["3", "3"]];
const Z_SIZE: Opt[] = [["light", "Small 40×40"], ["heavy", "Big 40×55"]];
const PALLA: Opt[] = [["60", "63 × 25"], ["75", "75 × 25"], ["50", "50 × 25"]];
const CHOKHAT: Opt[] = [["needed", "Frame + Shutter"], ["existing", "Shutter only"]];
/** Door panels, top to bottom (3 panels, 2 center rails). Glass top is the
 *  usual door (founder, 2026-10-28), so it comes first and is the default. */
const DOOR_MIX: Opt[] = [["GSS", "Glass top"], ["SSS", "All sheet"], ["JSS", "Mesh top"], ["SSJ", "Mesh bottom"]];
const PART_DOOR_W: Opt[] = [["2.5", "2.5 ft"], ["3", "3 ft"], ["3.5", "3.5 ft"]];
const BAY_FT: Opt[] = [["2", "2 ft"], ["2.5", "2.5 ft"], ["3", "3 ft"]];
const ROW_FT: Opt[] = [["3", "3 ft"], ["3.5", "3.5 ft"], ["4", "4 ft"]];
const PART_SHEET: Opt[] = [["0", "None"], ["1.5", "1.5 ft"], ["2", "2 ft"], ["3", "3 ft"]];

const labelOf = (opts: Opt[], v: string | undefined) => opts.find(([k]) => k === v)?.[1] ?? v ?? "";

/** The form's choices → the meta map the engine reads. */
function metaFor(type: OpeningType, o: Opts): Record<string, string> {
  if (type === "door") return { palla: o.palla, chokhat: o.chokhat, rails: "2", zonemix: o.doorMix };
  if (type === "partition") {
    const m: Record<string, string> = {
      partDoor: o.partDoor, partBayFt: o.partBayFt, partRowFt: o.partRowFt, partSheetFt: o.partSheetFt,
    };
    if (o.partDoor === "yes") m.partDoorW = o.partDoorW;
    return m;
  }
  if (o.sys === "z_section") {
    const m: Record<string, string> = { system: "z_section", zType: o.zType, zSize: o.zSize };
    if (o.zType === "openable" || o.zType === "combo") m.zSashCount = o.zSash;
    if (o.zType === "combo") { m.zComboDir = o.zComboDir; m.zFixedFt = o.zFixedFt; }
    return m;
  }
  const m: Record<string, string> = { system: o.sys, tracks: o.tracks, mix: o.mix };
  if (o.sys === "domal") {
    m.domalFix = o.domalFix;
    if (o.domalFix === "yes") m.domalFixFt = o.domalFixFt;
  }
  return m;
}

/** A built item back into the form's choices — used to edit it. */
function optsFromItem(it: JobItem): Opts {
  const m = it.meta;
  const o: Opts = { ...DEFAULT_OPTS };
  const pick = (k: keyof Opts, v: string | undefined) => { if (v) o[k] = v as never; };
  if (it.type === "door") {
    pick("palla", m.palla); pick("chokhat", m.chokhat); pick("doorMix", m.zonemix);
  } else if (it.type === "partition") {
    pick("partDoor", m.partDoor); pick("partDoorW", m.partDoorW); pick("partBayFt", m.partBayFt);
    pick("partRowFt", m.partRowFt); pick("partSheetFt", m.partSheetFt);
  } else if (it.system === "z_section") {
    o.sys = "z_section";
    pick("zType", m.zType); pick("zComboDir", m.zComboDir); pick("zFixedFt", m.zFixedFt); pick("zSash", m.zSashCount);
    pick("zSize", m.zSize);
  } else {
    o.sys = it.system === "domal" ? "domal" : "normal";
    pick("tracks", m.tracks); pick("mix", m.mix); pick("domalFix", m.domalFix); pick("domalFixFt", m.domalFixFt);
  }
  return o;
}

/** One line a fabricator reads at a glance: "Domal 3 Track · 2 Glass + 1 Mesh". */
function itemLabel(it: JobItem): string {
  const m = it.meta;
  if (it.type === "door") {
    const scope = m.chokhat === "existing" ? " · shutter only" : " + frame";
    return `Door · ${labelOf(PALLA, m.palla)} shutter${scope} · ${labelOf(DOOR_MIX, m.zonemix).toLowerCase()}`;
  }
  if (it.type === "partition") {
    const door = m.partDoor === "yes" ? ` with ${m.partDoorW ?? "3"} ft door` : "";
    const sheet = parseFloat(m.partSheetFt ?? "0") > 0 ? ` · ${m.partSheetFt} ft bottom sheet` : "";
    return `Partition${door}${sheet} · dividers ${m.partBayFt ?? "2.5"} × ${m.partRowFt ?? "3.5"} ft`;
  }
  if (it.system === "z_section") {
    const sashes = m.zType === "openable" || m.zType === "combo" ? ` · ${m.zSashCount ?? it.shutters.length} sash` : "";
    const base = `Z-Section ${m.zSize === "heavy" ? "40×55" : "40×40"} · ${labelOf(Z_TYPES, m.zType)}`;
    return m.zType === "combo"
      ? `${base} (${m.zFixedFt} ft fixed, ${labelOf(Z_DIRS, m.zComboDir).toLowerCase()})${sashes}`
      : `${base}${sashes}`;
  }
  const name = it.system === "domal" ? "Domal" : "Sliding";
  const mix = labelOf(MIXES[m.tracks ?? "2"] ?? [], m.mix);
  const fix = it.system === "domal" && m.domalFix === "yes" ? ` · ${m.domalFixFt} ft fixed top` : "";
  return `${name} ${m.tracks} Track · ${mix}${fix}`;
}

/** Panel / glass size the way the workshop writes it — inches + sut. */
function sizeText(it: { width: Um; height: Um }): string {
  return `${formatFtInSut(it.width)} × ${formatFtInSut(it.height)}`;
}

/** Opening size the way the fabricator measured it — feet first: 5' × 4'6". */
function ftIn(um: Um): string {
  const totalSut = Math.round(um / 3175);
  const ft = Math.floor(totalSut / 96);
  const inch = Math.floor((totalSut % 96) / 8);
  const sut = totalSut % 8;
  return `${ft}'${inch || sut ? `${inch}"` : ""}${sut ? `${sut}s` : ""}`;
}

function openingText(it: { width: Um; height: Um }): string {
  return `${ftIn(it.width)} × ${ftIn(it.height)}`;
}

/* ————————————————— page ————————————————— */

export default function FabriQ() {
  const [view, setView] = useState<"job" | "result">("job");
  const [items, setItems] = useState<JobItem[]>([]);
  const [jobName, setJobName] = useState("");
  const [shop, setShop] = useState<ShopProfile>({ name: "" });
  const [recent, setRecent] = useState<ProjectRec[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  /** The saved job this screen is editing. A ref: it must be readable the
   *  moment an item is added, before any re-render. */
  const projectId = useRef<string | null>(null);
  /** What was last written for this job — reopening a job must not count as
   *  changing it (that marked every opened job "Just now"). */
  const lastSaved = useRef("");

  // The page is server-rendered, where there is no storage — read it once mounted.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShop(loadShop());
    setRecent(loadProjects());
    // Works offline once it has loaded one time — a workshop's signal is poor.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* still works online */ });
    }
  }, []);

  // The phone's back button returns from the results to the sizes instead of
  // leaving the app: showing results pushes a history entry, back pops it.
  // Settings gets its own entry too, so back closes it instead of the app.
  useEffect(() => {
    const onPop = () => {
      setShowSettings(false);
      setView(window.history.state?.fabriq === "result" ? "result" : "job");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openSettings = () => {
    window.history.pushState({ fabriq: "settings" }, "");
    setShowSettings(true);
  };
  const closeSettings = () => {
    if (window.history.state?.fabriq === "settings") window.history.back();
    else setShowSettings(false);
  };
  const showResult = () => {
    window.history.pushState({ fabriq: "result" }, "");
    setView("result");
    window.scrollTo({ top: 0 });
  };
  const backToJob = () => {
    if (window.history.state?.fabriq === "result") window.history.back();
    else setView("job");
    window.scrollTo({ top: 0 });
  };

  /* Autosave — a job survives a refresh or a dead battery. localStorage only. */
  useEffect(() => {
    if (items.length === 0) return;
    const key = JSON.stringify([items, jobName]);
    if (key === lastSaved.current) return;
    lastSaved.current = key;
    const id = (projectId.current ??= newProjectId());
    const prev = loadProjects().find((p) => p.id === id);
    saveProject({
      id,
      title: autoTitle(items),
      created: prev?.created ?? Date.now(),
      updated: Date.now(),
      items,
      sqft: totalSqft(items),
      scrapPct: prev?.scrapPct ?? 0,
      amount: 0,
      customer: jobName.trim() || undefined,
    });
  }, [items, jobName]);

  const addItem = (type: OpeningType, w: Um, h: Um, qty: number, meta: Record<string, string>) => {
    setItems((prev) => {
      // Next free number, not length+1 — deleting W2 must not make two W3s.
      const n = prev.reduce((a, it) => Math.max(a, parseInt(it.id.slice(1), 10) || 0), 0) + 1;
      return [...prev, buildJobItem(n, type, w, h, qty, meta)];
    });
  };

  /** Edited in place: same id, same position in the list. */
  const replaceItem = (id: string, type: OpeningType, w: Um, h: Um, qty: number, meta: Record<string, string>) => {
    const n = parseInt(id.slice(1), 10) || 1;
    setItems((prev) => prev.map((it) => (it.id === id ? buildJobItem(n, type, w, h, qty, meta) : it)));
  };

  const forgetJob = () => {
    projectId.current = null;
    lastSaved.current = "";
    setRecent(loadProjects());
  };

  const removeItem = (id: string) => {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    // An emptied job is not kept as a saved job holding the last item removed.
    if (next.length === 0 && projectId.current) {
      removeProject(projectId.current);
      setJobName("");
      forgetJob();
    }
  };

  const newJob = () => {
    setItems([]);
    setJobName("");
    forgetJob();
    backToJob();
  };

  const openProject = (p: ProjectRec) => {
    projectId.current = p.id;
    lastSaved.current = JSON.stringify([p.items, p.customer ?? ""]);
    setItems(p.items);
    setJobName(p.customer ?? "");
    showResult();
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-32 pt-3">
      {view === "job" ? (
        <JobScreen
          items={items}
          shopName={shop.name}
          jobName={jobName}
          onJobName={setJobName}
          onAdd={addItem}
          onReplace={replaceItem}
          onRemove={removeItem}
          onDone={showResult}
          onSettings={openSettings}
          recent={recent}
          onOpenRecent={openProject}
          onRemoveRecent={(p) => {
            if (window.confirm(`Delete "${p.customer || p.title}"? This cannot be undone.`)) setRecent(removeProject(p.id));
          }}
        />
      ) : (
        <Result
          items={items}
          shop={shop}
          jobName={jobName.trim()}
          onBack={backToJob}
          onNew={newJob}
          onScrap={(pct) => { if (projectId.current) patchProject(projectId.current, { scrapPct: pct }); }}
        />
      )}
      {showSettings && (
        <SettingsModal
          shop={shop}
          onSave={(s) => { setShop(s); saveShop(s); closeSettings(); }}
          onClose={closeSettings}
        />
      )}
    </main>
  );
}

/* ————————————————— job screen: add items ————————————————— */

/** The form's last choices, kept for the session: opening the Material List
 *  unmounts this screen, and coming back to add one more of the same window
 *  must not mean re-picking Domal / 3 Track / fixed top all over again. */
const lastForm: { type: OpeningType; opts: Opts } = { type: "window", opts: DEFAULT_OPTS };

/** One plain sentence for a layout that doesn't fit, naming the part. */
function layoutError(e: unknown): string {
  if (e instanceof ImpossibleLayoutError) {
    return `This layout does not fit this size — the ${e.part.toLowerCase()} would be ${formatFtInSut(e.size)}. ` +
      `Check the size, or choose a smaller fixed part, door or sheet panel.`;
  }
  if (e instanceof PieceTooLongError) {
    return `One piece would be ${toFeet(e.piece.length).toFixed(1)} ft, but the pipe is only ${toFeet(e.barLength).toFixed(0)} ft — enter this opening as two parts.`;
  }
  return "This size cannot be built with this system — please check the size.";
}

function JobScreen({
  items, shopName, jobName, onJobName, onAdd, onReplace, onRemove, onDone, onSettings,
  recent, onOpenRecent, onRemoveRecent,
}: {
  items: JobItem[];
  shopName: string;
  jobName: string;
  onJobName: (v: string) => void;
  onAdd: (type: OpeningType, w: Um, h: Um, qty: number, meta: Record<string, string>) => void;
  onReplace: (id: string, type: OpeningType, w: Um, h: Um, qty: number, meta: Record<string, string>) => void;
  onRemove: (id: string) => void;
  onDone: () => void;
  onSettings: () => void;
  recent: ProjectRec[];
  onOpenRecent: (p: ProjectRec) => void;
  onRemoveRecent: (p: ProjectRec) => void;
}) {
  const [type, setType] = useState<OpeningType>(() => lastForm.type);
  const [o, setO] = useState<Opts>(() => lastForm.opts);
  useEffect(() => { lastForm.type = type; lastForm.opts = o; }, [type, o]);
  const [showAll, setShowAll] = useState(false);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [qty, setQty] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);
  /** Set when "Get Material List" was tapped with a size that can't be added. */
  const [blocked, setBlocked] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Opts>(k: K, v: Opts[K]) => setO((p) => ({ ...p, [k]: v }));
  // Changing the track count changes which shutter mixes exist.
  const setTracks = (t: string) => setO((p) => ({ ...p, tracks: t, mix: MIXES[t][0][0] }));

  // A partition's bare "20" is 20 ft (they run up to 25 ft); a window's is 20".
  const feetBelow = type === "partition" ? 26 : undefined;
  const pw = parseOpening(w, "auto", feetBelow);
  const ph = parseOpening(h, "auto", feetBelow);
  const sizeWarn = pw && ph ? openingWarning(pw.um, ph.um) : null;
  // Build this one opening right now, so a layout that cannot exist (a 2 ft
  // fix on a 2 ft window, a rail longer than any pipe) is stopped here with
  // a reason — not discovered later, blocking the whole job's list.
  const buildWarn = useMemo(() => {
    if (!pw || !ph || sizeWarn) return null;
    try {
      estimate([buildJobItem(1, type, pw.um, ph.um, 1, metaFor(type, o))]);
      return null;
    } catch (e) {
      return layoutError(e);
    }
  }, [pw?.um, ph?.um, sizeWarn, type, o]); // eslint-disable-line react-hooks/exhaustive-deps
  const warn = sizeWarn ?? buildWarn;
  const ready = !!pw && !!ph && !warn;
  const touched = w.trim() !== "" || h.trim() !== "";
  // A bare number that could also be read another way (19 → feet, 4.6 → 4.6 ft)
  const unsure = ready && (pw!.ambiguous || ph!.ambiguous);

  const clearForm = () => { setW(""); setH(""); setQty(1); setEditing(null); setBlocked(false); };

  /** The exact size of the item being edited, with the text it was shown as —
   *  the text is rounded to the sut, so an untouched size keeps its real value
   *  instead of drifting up to 1.6 mm on every save. */
  const editDims = useRef<{ w: string; h: string; wu: Um; hu: Um } | null>(null);

  /** Commit what's in the form. Returns false if there is nothing valid to commit. */
  const commit = (): boolean => {
    if (!pw || !ph || warn) return false;
    const e = editing ? editDims.current : null;
    const wu = e && w === e.w ? e.wu : pw.um;
    const hu = e && h === e.h ? e.hu : ph.um;
    if (editing) onReplace(editing, type, wu, hu, qty, metaFor(type, o));
    else onAdd(type, wu, hu, qty, metaFor(type, o));
    clearForm();
    return true;
  };

  const add = () => { if (commit()) widthRef.current?.focus(); };

  /** The big button never drops a size the fabricator has typed: a valid one
   *  is added first; an unfinished or invalid one stops and says so. */
  const finish = () => {
    if (touched || editing) {
      if (!commit()) {
        setBlocked(true);
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    onDone();
  };

  const startEdit = (it: JobItem) => {
    setType(it.type);
    setO(optsFromItem(it));
    setW(ftIn(it.width));
    setH(ftIn(it.height));
    editDims.current = { w: ftIn(it.width), h: ftIn(it.height), wu: it.width, hu: it.height };
    setQty(it.qty);
    setEditing(it.id);
    setBlocked(false);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openings = items.reduce((a, it) => a + it.qty, 0);
  const pendingCount = ready && !editing ? qty : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* top bar */}
      <div className="flex items-center justify-between py-1">
        <div>
          <div className="text-xl font-extrabold tracking-tight">
            Fabri<span style={{ color: "var(--accent)" }}>Q</span>
          </div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>
            {shopName || "Material list & cutting sheet"}
          </div>
        </div>
        <button onClick={onSettings} className="btn-ghost px-3 py-2 text-sm">Settings</button>
      </div>

      {/* add (or edit) one item */}
      <div ref={formRef} className="card flex scroll-mt-3 flex-col gap-4 p-4"
        style={editing ? { borderColor: "var(--accent)" } : undefined}>
        {editing && (
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold"
            style={{ background: "var(--accent-soft)" }}>
            <span>Editing {editing}</span>
            <button onClick={clearForm} className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Cancel</button>
          </div>
        )}

        <Field label="Item">
          <Seg options={TYPES} value={type} onChange={(v) => setType(v as OpeningType)} />
        </Field>

        {type === "window" && (
          <>
            <Field label="System">
              <Seg options={SYSTEMS} value={o.sys} onChange={(v) => set("sys", v as WinSys)} />
            </Field>
            {o.sys !== "z_section" && (
              <>
                <Field label="Track">
                  <Seg options={TRACKS} value={o.tracks} onChange={setTracks} />
                </Field>
                <Field label="Shutters">
                  <Seg options={MIXES[o.tracks] ?? MIXES["2"]} value={o.mix} onChange={(v) => set("mix", v)} />
                </Field>
              </>
            )}
            {o.sys === "domal" && (
              <>
                <Field label="Fixed glass on top">
                  <Seg options={YES_NO} value={o.domalFix} onChange={(v) => set("domalFix", v)} />
                </Field>
                {o.domalFix === "yes" && (
                  <Field label="Fixed glass height">
                    <Seg options={FIX_FT} value={o.domalFixFt} onChange={(v) => set("domalFixFt", v)} />
                  </Field>
                )}
              </>
            )}
            {o.sys === "z_section" && (
              <>
                <Field label="Type">
                  {/* A Z door is built from the heavy series — pick it for him;
                      he can still switch back. */}
                  <Seg options={Z_TYPES} value={o.zType}
                    onChange={(v) => setO((p) => ({ ...p, zType: v, zSize: v === "door" ? "heavy" : p.zSize }))} />
                </Field>
                <Field label="Profile">
                  <Seg options={Z_SIZE} value={o.zSize} onChange={(v) => set("zSize", v)} />
                </Field>
                {o.zType === "combo" && (
                  <>
                    <Field label="Fixed part position">
                      <Seg options={Z_DIRS} value={o.zComboDir} onChange={(v) => set("zComboDir", v)} />
                    </Field>
                    <Field label="Fixed part size">
                      <Seg options={FIX_FT} value={o.zFixedFt} onChange={(v) => set("zFixedFt", v)} />
                    </Field>
                  </>
                )}
                {(o.zType === "openable" || o.zType === "combo") && (
                  <Field label="Openable sashes">
                    <Seg options={Z_SASH} value={o.zSash} onChange={(v) => set("zSash", v)} />
                  </Field>
                )}
              </>
            )}
          </>
        )}

        {type === "door" && (
          <>
            <Field label="Shutter section (mm)">
              <Seg options={PALLA} value={o.palla} onChange={(v) => set("palla", v)} />
            </Field>
            <Field label="Scope">
              <Seg options={CHOKHAT} value={o.chokhat} onChange={(v) => set("chokhat", v)} />
            </Field>
            <Field label="Panels (3, top to bottom)">
              <Seg options={DOOR_MIX} value={o.doorMix} onChange={(v) => set("doorMix", v)} />
            </Field>
          </>
        )}

        {type === "partition" && (
          <>
            <Field label="Door in partition">
              <Seg options={YES_NO} value={o.partDoor} onChange={(v) => set("partDoor", v)} />
            </Field>
            {o.partDoor === "yes" && (
              <Field label="Door width">
                <Seg options={PART_DOOR_W} value={o.partDoorW} onChange={(v) => set("partDoorW", v)} />
              </Field>
            )}
            <Field label="Bottom sheet panel">
              <Seg options={PART_SHEET} value={o.partSheetFt} onChange={(v) => set("partSheetFt", v)} />
            </Field>
            <Field label="Vertical divider spacing">
              <Seg options={BAY_FT} value={o.partBayFt} onChange={(v) => set("partBayFt", v)} />
            </Field>
            <Field label="Horizontal divider spacing">
              <Seg options={ROW_FT} value={o.partRowFt} onChange={(v) => set("partRowFt", v)} />
            </Field>
          </>
        )}

        {/* size */}
        <div>
          <div className="mb-1.5 flex text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
            <span className="flex-1">Width</span>
            <span className="w-5" />
            <span className="flex-1">Height</span>
            <span className="w-[112px] text-center">Qty</span>
          </div>
          <div className="flex items-center gap-2">
            <input ref={widthRef} value={w} onChange={(e) => { setW(e.target.value); setBlocked(false); }}
              aria-label="Width" placeholder="4'6" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false}
              className="dim-input min-w-0 flex-1 px-3 py-3 text-lg font-semibold"
              onKeyDown={(e) => { if (e.key === "Enter") heightRef.current?.focus(); }} />
            <span className="w-3 text-center" style={{ color: "var(--ink-3)" }}>×</span>
            <input ref={heightRef} value={h} onChange={(e) => { setH(e.target.value); setBlocked(false); }}
              aria-label="Height" placeholder="4" inputMode="text" autoComplete="off" autoCorrect="off" spellCheck={false}
              className="dim-input min-w-0 flex-1 px-3 py-3 text-lg font-semibold"
              onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <Stepper value={qty} onChange={setQty} />
          </div>
          <div className="mt-1.5 min-h-[18px] text-xs font-medium"
            style={{ color: !touched && !blocked ? "var(--ink-3)" : ready ? (unsure ? "var(--warn)" : "var(--good)") : "var(--bad)" }}>
            {!touched
              ? blocked ? "Enter the size first, or tap Cancel." : "In feet: 4, 4'6, 4-6 — or in inches: 54\""
              : !pw || !ph
                ? blocked ? "Finish this size (width and height) or clear it before continuing." : "Enter both width and height"
                : warn
                  ? warn
                  : `= ${describeDim(pw.um)} × ${describeDim(ph.um)}${
                      unsure ? " · read as feet — for inches add \", for 4 ft 6 in type 4'6" : ""}`}
          </div>
        </div>

        <button onClick={add} disabled={!ready} className="btn-primary w-full py-3.5 text-base">
          {editing ? "Save changes" : "+ Add to list"}
        </button>
      </div>

      {/* this job */}
      {items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 pb-3 pt-3" style={{ background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">This job</span>
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                {plural(items.length, "size")} · {plural(openings, "pc")}
              </span>
            </div>
            <input value={jobName} onChange={(e) => onJobName(e.target.value)} maxLength={60}
              aria-label="Job or customer name" placeholder="Job / customer name (optional)"
              className="dim-input mt-2 w-full px-3 py-2 text-sm" />
          </div>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 pl-2 pr-2"
              style={{ borderTop: "1px solid var(--line)", background: editing === it.id ? "var(--accent-soft)" : undefined }}>
              <button onClick={() => startEdit(it)} aria-label={`Edit ${it.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left">
                <span className="mono shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold"
                  style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>{it.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold tabnum">
                    {openingText(it)}{it.qty > 1 && <span style={{ color: "var(--accent)" }}> × {it.qty}</span>}
                  </span>
                  <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>{itemLabel(it)}</span>
                </span>
              </button>
              <button onClick={() => { if (editing === it.id) clearForm(); onRemove(it.id); }} aria-label={`Remove ${it.id}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
                style={{ color: "var(--ink-3)" }}>×</button>
            </div>
          ))}
          <div className="px-4 py-2 text-[11px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}>
            Tap an item to edit it.
          </div>
        </div>
      )}

      {/* earlier jobs — only when nothing is being entered, so it never competes */}
      {items.length === 0 && recent.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="px-1 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Recent jobs</div>
          <div className="card overflow-hidden">
            {(showAll ? recent : recent.slice(0, 8)).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 pr-2"
                style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
                <button onClick={() => onOpenRecent(p)} className="min-w-0 flex-1 px-4 py-3 text-left">
                  <div className="truncate text-sm font-semibold">{p.customer || p.title}</div>
                  <div className="truncate text-xs" style={{ color: "var(--ink-3)" }}>
                    {p.customer ? `${p.title} · ` : ""}{timeAgo(p.updated)} · {plural(p.items.length, "size")} · {p.sqft.toFixed(0)} sq ft
                  </div>
                </button>
                <button onClick={() => onRemoveRecent(p)} aria-label={`Delete ${p.customer || p.title}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
                  style={{ color: "var(--ink-3)" }}>×</button>
              </div>
            ))}
            {recent.length > 8 && (
              <button onClick={() => setShowAll((s) => !s)} className="w-full px-4 py-2.5 text-sm font-semibold"
                style={{ borderTop: "1px solid var(--line)", color: "var(--accent)" }}>
                {showAll ? "Show fewer" : `Show all ${recent.length} jobs`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* the one action that matters, always in reach */}
      {(items.length > 0 || pendingCount > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3"
          style={{ background: "var(--surface)", borderColor: "var(--line)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-xl">
            <button onClick={finish} className="btn-dark w-full py-4 text-base">
              Get Material List ({plural(openings + pendingCount, "pc")}) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(ts: number): string {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ————————————————— result ————————————————— */

type Tab = "material" | "cutting";

function Result({ items, shop, jobName, onBack, onNew, onScrap }: {
  items: JobItem[];
  shop: ShopProfile;
  jobName: string;
  onBack: () => void;
  onNew: () => void;
  onScrap: (pct: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("material");

  const { list, error } = useMemo(() => {
    try {
      return { list: estimate(items), error: null as string | null };
    } catch (e) {
      if (e instanceof ImpossibleLayoutError) {
        return { list: null, error: `${e.itemId}: ${layoutError(e)}` };
      }
      if (e instanceof PieceTooLongError) {
        // A multi-unit opening carries a per-unit id ("W1.3") — strip it back.
        const baseId = e.piece.itemId.replace(/\.\d+$/, "");
        return {
          list: null,
          error:
            `${baseId}: the ${e.piece.role} needs a ${toFeet(e.piece.length).toFixed(1)} ft (${formatFtInSut(e.piece.length)}) piece, ` +
            `but this section comes in ${toFeet(e.barLength).toFixed(0)} ft pipes.\n\n` +
            `If the opening really is this large, it has to be joined — enter it as two separate sizes.\n\n` +
            `If the size was in inches, add " after the number (for example 66").`,
        };
      }
      return { list: null, error: e instanceof Error ? e.message : "Something went wrong" };
    }
  }, [items]);

  const scrap = list?.totals.wastePct;
  useEffect(() => {
    if (scrap !== undefined) onScrap(scrap);
    // onScrap is a fresh closure each render; only a new figure matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrap]);

  if (error || !list) {
    return (
      <div className="card mt-6 p-5">
        <div className="text-base font-bold" style={{ color: "var(--bad)" }}>This size cannot be built</div>
        <p className="mt-2 whitespace-pre-line text-sm">{error}</p>
        <button onClick={onBack} className="btn-primary mt-4 w-full py-3">← Edit sizes</button>
      </div>
    );
  }

  const openings = items.reduce((a, it) => a + it.qty, 0);

  return (
    <div className="result-view flex flex-col gap-3">
      <div className="no-print flex items-center justify-between gap-2 py-1">
        <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">← Sizes</button>
        <div className="min-w-0 text-center">
          <div className="truncate text-base font-bold">{jobName || (tab === "material" ? "Material List" : "Cutting Sheet")}</div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>{plural(items.length, "size")} · {plural(openings, "pc")}</div>
        </div>
        <button onClick={onNew} className="btn-ghost px-3 py-2 text-sm">New job</button>
      </div>

      <div className="no-print">
        <Seg options={[["material", "Material List"], ["cutting", "Cutting Sheet"]]} value={tab}
          onChange={(v) => { setTab(v as Tab); window.scrollTo({ top: 0 }); }} />
      </div>

      {tab === "material"
        ? <MaterialPanel list={list} shop={shop} items={items} jobName={jobName} />
        : <CuttingPanel list={list} shop={shop} items={items} jobName={jobName} />}
    </div>
  );
}

/* —— pipe counting ——
 * Sections come in different stock lengths (16' bars, 12' glazing clip), so
 * pipes are always counted and named per length — adding a 12' clip bar and a
 * 16' bar into one "pipes" figure gave the dealer a number he could not fill.
 */

interface BarGroup { ft: number; full: number; half: number }

function barGroups(sections: MaterialList["sections"]): BarGroup[] {
  const m = new Map<number, BarGroup>();
  for (const s of sections) {
    const ft = getSection(s.sectionId).barLengthFt ?? 16;
    const g = m.get(ft) ?? { ft, full: 0, half: 0 };
    g.full += s.bars16;
    g.half += s.bars8;
    m.set(ft, g);
  }
  return [...m.values()].sort((a, b) => b.ft - a.ft);
}

/** "2 × 16' + 1 × 8'" — what the dealer actually hands over. */
function barsText(ft: number, full: number, half: number): string {
  return [full ? `${full} × ${ft}'` : "", half ? `${half} × ${Math.round(ft / 2)}'` : ""].filter(Boolean).join(" + ") || "—";
}

function groupsText(groups: BarGroup[]): string {
  return groups.map((g) => barsText(g.ft, g.full, g.half)).join(" + ");
}

const barCount = (groups: BarGroup[]) => groups.reduce((a, g) => a + g.full + g.half, 0);

/* —— material list —— */

function MaterialPanel({ list, shop, items, jobName }: {
  list: MaterialList; shop: ShopProfile; items: JobItem[]; jobName: string;
}) {
  // Only ever rendered after a tap, never on the server — safe to read storage now.
  const [brand] = useState<BrandId | undefined>(() => loadBrand());
  const aluDocRef = useRef<HTMLDivElement>(null);
  const glassDocRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), []);

  const groups = barGroups(list.sections);
  const total = barCount(groups);
  const hasGlass = list.glass.length > 0 || list.mesh.panels.length > 0 || list.sheet.panels.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Off-screen real layout (not display:none) so the WhatsApp PDF has a
          document to capture, without a second copy on this screen. */}
      <div aria-hidden style={{ position: "fixed", left: -9999, top: 0, width: 620 }}>
        <div ref={aluDocRef}>
          <SupplierOrderDoc shop={shop} title="Aluminium Order" date={today} job={jobName || undefined}
            lines={list.sections.map((s) => {
              const sec = getSection(s.sectionId);
              const code = sectionCode(s.sectionId, brand);
              return {
                image: hasImage(s.sectionId) ? `/sections/${s.sectionId}.png` : undefined,
                label: sec.label,
                sub: code ? `#${code}` : (sec.size ? `${sec.size}mm` : undefined),
                qty: barsText(sec.barLengthFt ?? 16, s.bars16, s.bars8),
              };
            })}
            totalLabel="Total pipes" totalValue={groupsText(groups)} />
        </div>
        {hasGlass && (
          <div ref={glassDocRef} style={{ marginTop: 16 }}>
            <SupplierOrderDoc shop={shop} title="Glass / Mesh Order" date={today} job={jobName || undefined}
              lines={[
                ...mergeBySize(list.glass).map((p) => ({ label: `Glass — ${sizeText(p)}`, sub: `${sqft(p.width, p.height).toFixed(2)} sq ft each`, qty: plural(p.count, "pc") })),
                ...mergeBySize(list.mesh.panels).map((p) => ({ label: `Mesh — ${sizeText(p)}`, sub: `${sqft(p.width, p.height).toFixed(2)} sq ft each`, qty: plural(p.count, "pc") })),
                ...mergeBySize(list.sheet.panels).map((p) => ({ label: `Sheet — ${sizeText(p)}`, sub: `${sqft(p.width, p.height).toFixed(2)} sq ft each`, qty: plural(p.count, "pc") })),
              ]}
              totalLabel="Total area"
              totalValue={`${(list.glassSqft + list.mesh.sqft + list.sheet.sqft).toFixed(1)} sq ft`}
              note="All sizes are finished panel sizes." />
          </div>
        )}
      </div>

      {/* the answer first: how many pipes to buy, by stock length */}
      <div className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Pipes to buy</div>
          {groups.map((g) => (
            <div key={g.ft} className="mt-0.5 text-sm font-semibold tabnum" style={{ color: "var(--ink-2)" }}>
              {barsText(g.ft, g.full, g.half)}
            </div>
          ))}
          <div className="text-xs tabnum" style={{ color: list.totals.wastePct > 20 ? "var(--warn)" : "var(--ink-3)" }}>
            Scrap {list.totals.wastePct}%
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-4xl font-extrabold tabnum">{total}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{total === 1 ? "pipe" : "pipes"}</div>
        </div>
      </div>

      {/* one row per section — drawing first, because that is what he recognises */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-3 py-2 text-[11px] font-semibold"
          style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
          <span className="shrink-0" style={{ width: 84 }}>Section</span>
          <span className="min-w-0 flex-1" />
          <span className="w-14 shrink-0 text-right">Pipes</span>
        </div>
        {list.sections.map((s) => {
          const sec = getSection(s.sectionId);
          const code = sectionCode(s.sectionId, brand);
          return (
            <div key={s.sectionId} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="shrink-0" style={{ width: 84 }}>
                <SectionProfile sectionId={s.sectionId} w={84} h={56} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-tight">
                  {sec.label}
                  {code && <span className="mono ml-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>#{code}</span>}
                </div>
                <div className="mt-0.5 text-xs tabnum" style={{ color: "var(--ink-3)" }}>
                  {barsText(sec.barLengthFt ?? 16, s.bars16, s.bars8)}{sec.size ? ` · ${sec.size}mm` : ""}
                </div>
              </div>
              <div className="w-14 shrink-0 text-right text-2xl font-extrabold tabnum">{s.bars16 + s.bars8}</div>
            </div>
          );
        })}
      </div>

      <GlassBlock list={list} />

      {/* aluminium dealer and glass shop are different people — two sends */}
      <SendOrder
        label="Send to aluminium supplier"
        sub={`${plural(list.sections.length, "section")} · ${plural(total, "pipe")}`}
        filename={pdfName(jobName, "aluminium-order")}
        text={aluminiumWaText(list, shop.name, jobName)}
        build={() => elementToPdfBlob(aluDocRef.current!)}
      />
      {hasGlass && (
        <SendOrder
          label="Send to glass supplier"
          sub={`${(list.glassSqft + list.mesh.sqft + list.sheet.sqft).toFixed(1)} sq ft`}
          filename={pdfName(jobName, "glass-order")}
          text={glassWaText(list, shop.name, jobName)}
          build={() => elementToPdfBlob(glassDocRef.current!)}
        />
      )}

      <BeforeYouCut items={items} list={list} />
    </div>
  );
}

/**
 * Builds the PDF and hands that same file to WhatsApp. Every outcome is told
 * truthfully: sent, cancelled (nothing said), "tap again" when the phone
 * wants a fresh tap, saved-with-a-chat-link on desktop, or failed.
 */
function SendOrder({ label, sub, filename, text, build }: {
  label: string; sub: string; filename: string; text: string; build: () => Blob | Promise<Blob>;
}) {
  const [state, setState] = useState<ShareResult | "idle" | "working" | "error">("idle");
  /** Kept after a "needs-tap" so the second tap shares at once, inside the tap. */
  const built = useRef<Blob | null>(null);

  const go = async () => {
    if (state === "needs-tap" && built.current) {
      const r = await sharePdfToWhatsApp(built.current, filename, text);
      setState(r === "cancelled" ? "idle" : r);
      return;
    }
    setState("working");
    try {
      built.current = await build();
      const r = await sharePdfToWhatsApp(built.current, filename, text);
      setState(r === "cancelled" ? "idle" : r);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="no-print">
      <button onClick={go} disabled={state === "working"}
        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-4 py-3.5 text-left text-white disabled:opacity-60"
        style={{ background: "var(--wa)" }}>
        <span>
          <span className="block text-sm font-bold">
            {state === "working" ? "Preparing PDF…" : state === "needs-tap" ? "PDF ready — tap to send" : label}
          </span>
          <span className="block text-xs opacity-90">{sub} · PDF via WhatsApp</span>
        </span>
        <span aria-hidden className="text-lg">↗</span>
      </button>
      {state === "downloaded" && (
        <p className="mt-1.5 text-center text-xs" style={{ color: "var(--ink-3)" }}>
          PDF saved.{" "}
          <a href={whatsAppLink(text)} target="_blank" rel="noopener noreferrer" className="font-semibold underline"
            style={{ color: "var(--wa)" }}>Open WhatsApp</a>{" "}
          and attach the file.
        </p>
      )}
      {state === "shared" && (
        <p className="mt-1.5 text-center text-xs" style={{ color: "var(--good)" }}>✓ PDF shared</p>
      )}
      {state === "error" && (
        <p className="mt-1.5 text-center text-xs" style={{ color: "var(--bad)" }}>Could not create the PDF. Please try again.</p>
      )}
    </div>
  );
}

function GlassBlock({ list }: { list: MaterialList }) {
  const rows: { title: string; sub: string; panels: { width: Um; height: Um; count: number }[] }[] = [];
  if (list.glass.length) rows.push({ title: "Glass", sub: `${list.glassSqft.toFixed(1)} sq ft`, panels: mergeBySize(list.glass) });
  if (list.mesh.panels.length) rows.push({ title: "Mesh", sub: `${list.mesh.sqft.toFixed(1)} sq ft · spline ${list.mesh.splineFt} rft`, panels: mergeBySize(list.mesh.panels) });
  if (list.sheet.panels.length) rows.push({ title: "Sheet", sub: `${list.sheet.sqft.toFixed(1)} sq ft`, panels: mergeBySize(list.sheet.panels) });
  if (!rows.length) return null;
  return (
    <>
      {rows.map((r) => (
        <div key={r.title} className="card overflow-hidden">
          <div className="flex items-baseline justify-between px-4 py-2.5" style={{ background: "var(--surface-2)" }}>
            <span className="text-sm font-bold">{r.title}</span>
            <span className="text-xs tabnum" style={{ color: "var(--ink-3)" }}>{r.sub}</span>
          </div>
          {r.panels.map((g, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
              <span className="mono font-semibold">{sizeText(g)}</span>
              <span className="font-bold tabnum">{plural(g.count, "pc")}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Deterministic checks worth reading before anyone cuts. */
const SEVERITY_ICON: Record<ReviewFinding["severity"], { icon: string; tint: string }> = {
  blocker: { icon: "⛔", tint: "var(--bad)" },
  warning: { icon: "⚠️", tint: "var(--warn)" },
  suggestion: { icon: "💡", tint: "var(--ink-2)" },
  ok: { icon: "✓", tint: "var(--good)" },
};

function BeforeYouCut({ items, list }: { items: JobItem[]; list: MaterialList }) {
  const review = useMemo(() => reviewEstimate(items, list), [items, list]);
  const order: ReviewFinding["severity"][] = ["blocker", "warning", "suggestion", "ok"];
  const worth = review.findings
    .filter((f) => f.severity !== "ok")
    .sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  if (worth.length === 0) return null;
  return (
    <div className="card p-4">
      <div className="mb-2 text-sm font-bold">Check before cutting</div>
      <div className="flex flex-col gap-2">
        {worth.map((f, i) => (
          <div key={i} className="flex gap-2 text-[13px] leading-relaxed">
            <span aria-hidden>{SEVERITY_ICON[f.severity].icon}</span>
            <span style={{ color: SEVERITY_ICON[f.severity].tint }}>{f.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* —— cutting sheet —— */

/** "S1 Bearing Top" / "S3 Handle (Mesh)" → "Bearing Top" / "Handle". */
function baseRole(role: string): string {
  return role.replace(/^S\d+\s+/, "").replace(/\s*\((Jali|Mesh|Glass|Sheet)\)\s*$/i, "").trim();
}

/** Same length → one row ("57\" × 5", not five rows), longest first. */
function cutRows(bars: PackedBar[]) {
  const map = new Map<number, { count: number; roles: Set<string>; items: Set<string> }>();
  for (const p of bars.flatMap((b) => b.pieces)) {
    const e = map.get(p.length) ?? { count: 0, roles: new Set<string>(), items: new Set<string>() };
    // "W1.3" (third unit of W1) → "W1", so a 5-off window reads as one opening.
    e.count += 1; e.roles.add(baseRole(p.role)); e.items.add(p.itemId.replace(/\.\d+$/, ""));
    map.set(p.length, e);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, e]) => {
      const roles = [...e.roles];
      return {
        len,
        count: e.count,
        forWhat: `${roles.slice(0, 3).join(" · ")}${roles.length > 3 ? ` +${roles.length - 3}` : ""} — ${[...e.items].join(", ")}`,
      };
    });
}

/** One pipe's packing on one line: 57" ×3 + 42" */
function packLine(pieces: CutPiece[]) {
  const map = new Map<number, number>();
  for (const p of pieces) map.set(p.length, (map.get(p.length) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, n]) => `${formatFtInSut(len)}${n > 1 ? ` ×${n}` : ""}`)
    .join("  +  ");
}

/** Sliding-window sections — the only ones the parts guide describes. */
const SLIDING_PARTS = new Set(["handle_std", "interlock", "bearing"]);

function CuttingPanel({ list, shop, items, jobName }: {
  list: MaterialList; shop: ShopProfile; items: JobItem[]; jobName: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const sectionGroups = useMemo(() => {
    const map = new Map<string, PackedBar[]>();
    for (const b of list.bars) map.set(b.sectionId, [...(map.get(b.sectionId) ?? []), b]);
    return [...map.entries()];
  }, [list.bars]);

  // Identical openings share ONE drawing — 5 same windows, not 5 same drawings.
  const drawingGroups = useMemo(() => {
    const map = new Map<string, JobItem[]>();
    for (const it of items) {
      const meta = Object.keys(it.meta).sort().map((k) => `${k}=${it.meta[k]}`).join(",");
      const key = `${it.type}|${it.system}|${it.width}|${it.height}|${JSON.stringify(it.shutters)}|${meta}`;
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return [...map.values()];
  }, [items]);

  // The parts guide explains sliding windows only — showing it on a
  // partition or Z-section sheet described parts that job does not have.
  const hasNormal = list.sections.some((s) => SLIDING_PARTS.has(s.sectionId));
  const hasDomal = list.sections.some((s) => s.sectionId.startsWith("domal_"));
  const totalPieces = list.bars.reduce((a, b) => a + b.pieces.length, 0);
  const groups = barGroups(list.sections);
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div ref={sheetRef} className="print-sheet flex flex-col gap-3">
      <div className="card p-4">
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{shop.name || "Cutting Sheet"}</div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>
            {jobName ? `${jobName} · ` : ""}Cutting Sheet · {date}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Pipes" value={String(barCount(groups))} />
          <MiniStat label="Pieces" value={String(totalPieces)} />
          <MiniStat label="Scrap" value={`${list.totals.wastePct}%`} />
        </div>
      </div>

      <SendOrder
        label="Send to workshop"
        sub={`${plural(totalPieces, "piece")} · ${plural(sectionGroups.length, "section")}`}
        filename={pdfName(jobName, "cutting-sheet")}
        text={`Cutting sheet${jobName ? ` — ${jobName}` : ""}: ${plural(totalPieces, "piece")} across ${plural(sectionGroups.length, "section")}. PDF attached.`}
        build={() => elementToPdfBlob(sheetRef.current!)}
      />

      {sectionGroups.map(([sectionId, bars]) => {
        const sec = getSection(sectionId);
        const fullFt = sec.barLengthFt ?? 16;
        const full = bars.filter((b) => toFeet(b.barLength) >= fullFt - 0.5).length;
        const half = bars.length - full;
        return (
          <div key={sectionId} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-2)" }}>
              <div className="font-bold">{sec.label}</div>
              <div className="text-right">
                <div className="text-sm font-bold tabnum">{plural(bars.length, "pipe")}</div>
                <div className="text-[11px] tabnum" style={{ color: "var(--ink-3)" }}>{barsText(fullFt, full, half)}</div>
              </div>
            </div>
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--line)" }}>
              <SectionDrawing sectionId={sectionId} />
            </div>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Length</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Used for</th>
                </tr>
              </thead>
              <tbody>
                {cutRows(bars).map((r) => (
                  <tr key={r.len} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="mono px-3 py-2.5 text-base font-bold">{formatFtInSut(r.len)}</td>
                    <td className="px-3 py-2.5 text-center text-lg font-extrabold tabnum">{r.count}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--ink-2)" }}>{r.forWhat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--line)" }}>
              <div className="mb-1.5 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Cutting plan per pipe</div>
              <div className="flex flex-col gap-1">
                {bars.map((bar, bi) => (
                  <div key={bi} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-bold" style={{ color: "var(--ink-2)" }}>
                      Pipe {bi + 1} ({Math.round(toFeet(bar.barLength))}&apos;)
                    </span>
                    <span className="mono">{packLine(bar.pieces)}</span>
                    {bar.waste > 0 && (
                      <span className="mono" style={{ color: "var(--ink-3)" }}>· {formatFtInSut(bar.waste)} left over</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {(hasNormal || hasDomal) && (
        <div className="flex flex-col gap-3">
          {hasNormal && <CuttingGuide system="normal" />}
          {hasDomal && <CuttingGuide system="domal" />}
        </div>
      )}

      <div className="px-1 pt-2 text-sm font-bold">Drawings</div>
      {drawingGroups.map((g) => (
        <EngineeringSheet key={g[0].id} item={g[0]} others={g.slice(1)} list={list} shop={shop} />
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg py-2" style={{ background: "var(--surface-2)" }}>
      <div className="text-lg font-extrabold tabnum">{value}</div>
      <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{label}</div>
    </div>
  );
}

/* ————————————————— settings ————————————————— */

function SettingsModal({ shop, onSave, onClose }: {
  shop: ShopProfile;
  onSave: (s: ShopProfile) => void;
  onClose: () => void;
}) {
  const [s, setS] = useState<ShopProfile>({ ...shop });
  const [brand, setBrand] = useState<BrandId | undefined>(() => loadBrand());

  const field = (k: keyof ShopProfile, label: string, ph: string, mode?: "tel") => (
    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--ink-2)" }}>
      {label}
      <input value={s[k] ?? ""} onChange={(e) => setS((p) => ({ ...p, [k]: e.target.value }))}
        placeholder={ph} inputMode={mode} className="dim-input w-full px-3 py-2.5 text-base font-normal" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: "var(--surface)", maxHeight: "90vh", overflowY: "auto", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl leading-none" style={{ color: "var(--ink-3)" }}>×</button>
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          Your business name and number are printed on order PDFs. All fields are optional.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {field("name", "Business name", "e.g. Al-Noor Aluminium")}
          {field("phone", "Mobile", "98765 43210", "tel")}
          {field("address", "Address", "Optional")}
        </div>

        <div className="mt-5">
          <div className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>Section brand</div>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ink-3)" }}>
            Select the brand you buy from to show its section numbers on orders.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <button key={b.id} onClick={() => setBrand(brand === b.id ? undefined : b.id)}
                className={`chip px-3 py-2 text-sm ${brand === b.id ? "selected" : ""}`}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => { saveBrand(brand); onSave({ ...s, name: s.name.trim() }); }} className="btn-primary mt-6 w-full py-3.5">
          Save
        </button>
      </div>
    </div>
  );
}

/* ————————————————— small parts ————————————————— */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold" style={{ color: "var(--ink-2)" }}>{label}</div>
      {children}
    </div>
  );
}

/** Single-choice row of equal buttons — one tap, no dropdowns. */
function Seg({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 4)}, minmax(0, 1fr))` }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`chip min-h-[44px] px-2 py-2 text-sm leading-tight ${value === v ? "selected" : ""}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Quantity: tap − / + or type it — 25 windows should not take 24 taps. */
function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) { setPrev(value); setText(String(value)); }
  const clamp = (n: number) => Math.min(999, Math.max(1, n));
  return (
    <div className="flex w-[112px] shrink-0 items-center overflow-hidden rounded-[var(--radius)]"
      style={{ border: "1.5px solid var(--line)" }}>
      <button onClick={() => onChange(clamp(value - 1))} aria-label="Decrease quantity"
        className="h-12 w-9 shrink-0 text-lg font-bold" style={{ background: "var(--surface-2)" }}>−</button>
      <input value={text} inputMode="numeric" aria-label="Quantity"
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 3);
          setText(t);
          if (t) onChange(clamp(parseInt(t, 10)));
        }}
        onBlur={() => setText(String(value))}
        className="min-w-0 flex-1 bg-transparent text-center text-base font-bold tabnum outline-none" />
      <button onClick={() => onChange(clamp(value + 1))} aria-label="Increase quantity"
        className="h-12 w-9 shrink-0 text-lg font-bold" style={{ background: "var(--surface-2)" }}>+</button>
    </div>
  );
}

/** "sharma-ji-2nd-floor-aluminium-order-28oct.pdf" — every job's PDF gets its
 *  own name, so a second order no longer lands on top of the first. */
function pdfName(jobName: string, kind: string): string {
  const slug = jobName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).replace(/\s+/g, "").toLowerCase();
  return `${slug ? `${slug}-` : ""}${kind}-${date}.pdf`;
}

/** "1 size" / "3 sizes" / "2 pcs". */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/* ————————————————— WhatsApp text ————————————————— */

function aluminiumWaText(list: MaterialList, shopName?: string, jobName?: string): string {
  const L: string[] = [`*Aluminium order${shopName ? ` — ${shopName}` : ""}*`];
  if (jobName) L.push(`Job: ${jobName}`);
  L.push("");
  for (const s of list.sections) {
    const sec = getSection(s.sectionId);
    L.push(`• ${sec.label} — ${barsText(sec.barLengthFt ?? 16, s.bars16, s.bars8)}`);
  }
  L.push("", `*Total: ${groupsText(barGroups(list.sections))}*`);
  return L.join("\n");
}

/** The glass shop cuts by size, not by window — same pane, one line. */
function mergeBySize<T extends { width: Um; height: Um; count: number }>(panels: T[]): T[] {
  const m = new Map<string, T>();
  for (const p of panels) {
    const k = `${p.width}x${p.height}`;
    const e = m.get(k);
    m.set(k, e ? { ...e, count: e.count + p.count } : { ...p });
  }
  return [...m.values()];
}

function glassWaText(list: MaterialList, shopName?: string, jobName?: string): string {
  const L: string[] = [`*Glass / Mesh order${shopName ? ` — ${shopName}` : ""}*`];
  if (jobName) L.push(`Job: ${jobName}`);
  const block = (title: string, sub: string, panels: { width: Um; height: Um; count: number }[]) => {
    if (!panels.length) return;
    L.push("", `*${title}* — ${sub}`);
    for (const p of panels) L.push(`• ${sizeText(p)} — ${plural(p.count, "pc")}`);
  };
  block("Glass", `${list.glassSqft.toFixed(1)} sq ft`, mergeBySize(list.glass));
  block("Mesh", `${list.mesh.sqft.toFixed(1)} sq ft + spline ${list.mesh.splineFt} rft`, mergeBySize(list.mesh.panels));
  block("Sheet", `${list.sheet.sqft.toFixed(1)} sq ft`, mergeBySize(list.sheet.panels));
  return L.join("\n");
}
