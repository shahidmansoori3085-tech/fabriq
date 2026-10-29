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
  formatFtInSut, toFeet, feet, sqft, parseOpening, describeDim, openingWarning, type Um,
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
import { CuttingGuide, MiniElevation } from "@/components/diagrams";
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

/* ————————————————— job screen ————————————————— */

/** The form's last choices, kept for the session: opening the Material List
 *  unmounts this screen, and "add same again" must remember Domal / 3 Track /
 *  fixed top without asking again. */
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

/**
 * Adding an item is a short series of screens, ONE question each, every
 * answer a picture of what it builds — a fabricator recognises a drawing of
 * a 3-track window faster than he reads "3 Track · 2 Glass + 1 Mesh". The
 * old single form put 28–36 buttons and 5–7 questions on the first screen
 * and pushed its own "Add" button off-screen as choices opened up.
 */
type StepId =
  | "type" | "system" | "tracks" | "mix" | "domalFix"
  | "zType" | "zDetails" | "doorPanels" | "doorDetails"
  | "partDoor" | "partSheet" | "partSpacing" | "size";

function stepsFor(type: OpeningType, o: Opts): StepId[] {
  if (type === "door") return ["type", "doorPanels", "doorDetails", "size"];
  if (type === "partition") return ["type", "partDoor", "partSheet", "partSpacing", "size"];
  if (o.sys === "z_section") return ["type", "system", "zType", "zDetails", "size"];
  return ["type", "system", "tracks", "mix", ...(o.sys === "domal" ? ["domalFix" as const] : []), "size"];
}

const STEP_TITLE: Record<StepId, string> = {
  type: "What are you making?",
  system: "Which window system?",
  tracks: "How many tracks?",
  mix: "Which shutters?",
  domalFix: "Fixed glass on top?",
  zType: "Which type?",
  zDetails: "A few details",
  doorPanels: "Door panels, top to bottom",
  doorDetails: "Frame and shutter",
  partDoor: "Door in the partition?",
  partSheet: "Sheet panel at the bottom?",
  partSpacing: "Divider spacing",
  size: "Size",
};

/** How long a readable size is left alone before the app moves on by itself.
 *  0.6 s (founder, 2026-10-29): quick, yet slower than a tap — so 54, 4'6 or 12
 *  are finished before the box moves. Much shorter cuts sizes off mid-way. */
const AUTO_NEXT_MS = 600;

const SAMPLE_SIZE: Record<OpeningType, [number, number]> = { window: [6, 5], door: [3, 7], partition: [10, 8] };

/** The item these choices build, at a typical size — drawn on the option cards. */
function sample(type: OpeningType, o: Opts): JobItem {
  const [w, h] = SAMPLE_SIZE[type];
  return buildJobItem(1, type, feet(w), feet(h), 1, metaFor(type, o));
}

const SYSTEM_INFO: Record<WinSys, { img: string; sub: string }> = {
  normal: { img: "/sections/2t_top.png", sub: "18 mm · most common" },
  domal: { img: "/sections/domal_frame.png", sub: "27 mm · premium" },
  z_section: { img: "/sections/z_outer_40.png", sub: "Hinged, opens out" },
};

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
  /** The add/edit flow, when open: which screen, and which item is being edited. */
  const [flow, setFlow] = useState<{ step: StepId; editing: string | null } | null>(null);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [qty, setQty] = useState(1);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  /** Which size box the keypad is typing into. */
  const [field, setField] = useState<"w" | "h">("w");
  /** Moves to the height box once the width has been left alone a moment. */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopAdvance = () => { if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; } };
  useEffect(() => stopAdvance, []);
  /** The exact size of the item being edited, with the text it was shown as —
   *  the text is rounded to the sut, so an untouched size keeps its real value. */
  const editDims = useRef<{ w: string; h: string; wu: Um; hu: Um } | null>(null);

  // The phone's back button steps out of the add flow instead of the app.
  useEffect(() => {
    const onPop = () => { if (window.history.state?.fabriq !== "add") setFlow(null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const openFlow = (step: StepId, editing: string | null = null) => {
    if (window.history.state?.fabriq !== "add") window.history.pushState({ fabriq: "add" }, "");
    setFlow({ step, editing });
    window.scrollTo({ top: 0 });
  };
  const closeFlow = () => {
    setFlow(null);
    if (window.history.state?.fabriq === "add") window.history.back();
    window.scrollTo({ top: 0 });
  };

  // A just-added item is scrolled into view and glows briefly, so the
  // fabricator SEES it land in the list.
  useEffect(() => {
    if (!justAdded || flow) return;
    document.getElementById(`item-${justAdded}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setJustAdded(null), 2500);
    return () => clearTimeout(t);
  }, [justAdded, flow]);

  const steps = stepsFor(type, o);
  const go = (step: StepId) => { setFlow((f) => (f ? { ...f, step } : f)); window.scrollTo({ top: 0 }); };
  /** Apply a choice; move on unless the screen has more to ask. */
  const choose = (patch: Partial<Opts>, advance = true, nextType: OpeningType = type) => {
    const next = { ...o, ...patch };
    setO(next);
    if (!advance || !flow) return;
    const st = stepsFor(nextType, next);
    go(st[Math.min(st.indexOf(flow.step) + 1, st.length - 1)]);
  };
  const back = () => {
    if (!flow) return;
    // Once sizes are in, "back" means "I'm done here" — returning to a
    // shutter question at that point only confused.
    if (flow.step === "size" && session.length) { finishFlow(); return; }
    const i = steps.indexOf(flow.step);
    if (i > 0) go(steps[i - 1]); else closeFlow();
  };

  /* —— size —— */
  // A partition's bare "20" is 20 ft (they run up to 25 ft); a window's is 20".
  const feetBelow = type === "partition" ? 26 : undefined;
  const pw = parseOpening(w, "auto", feetBelow);
  const ph = parseOpening(h, "auto", feetBelow);
  const sizeWarn = pw && ph ? openingWarning(pw.um, ph.um) : null;
  // Build this opening right now, so a layout that cannot exist is stopped
  // here with a reason — not discovered later, blocking the whole job's list.
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
  const unsure = ready && (pw!.ambiguous || ph!.ambiguous);

  /** Items added during this visit to the size screen, newest last. */
  const [session, setSession] = useState<string[]>([]);
  const lastAdded = session.length ? items.find((it) => it.id === session[session.length - 1]) : undefined;

  /** Add one size and stay: the boxes clear and the width box is ready for
   *  the next line on the sheet — a job is typed straight through, not one
   *  trip back to the list per window. Returns false if it can't be built. */
  const addAndContinue = (wStr: string, hStr: string): boolean => {
    const a = parseOpening(wStr, "auto", feetBelow);
    const b = parseOpening(hStr, "auto", feetBelow);
    if (!a || !b || openingWarning(a.um, b.um)) return false;
    try { estimate([buildJobItem(1, type, a.um, b.um, 1, metaFor(type, o))]); } catch { return false; }
    // Same numbering the list uses: the next free W-number.
    const id = `W${[...items.map((it) => it.id), ...session].reduce((m, x) => Math.max(m, parseInt(x.slice(1), 10) || 0), 0) + 1}`;
    onAdd(type, a.um, b.um, qty, metaFor(type, o));
    setSession((s) => [...s, id]);
    setW(""); setH(""); setQty(1); setField("w"); stopAdvance();
    return true;
  };

  const commit = () => {
    if (!pw || !ph || warn || !flow) return;
    if (!flow.editing) { addAndContinue(w, h); return; }
    const e = editDims.current;
    const wu = e && w === e.w ? e.wu : pw.um;
    const hu = e && h === e.h ? e.hu : ph.um;
    onReplace(flow.editing, type, wu, hu, qty, metaFor(type, o));
    setJustAdded(flow.editing);
    closeFlow();
  };

  /** Leave the size screen; the last size added glows in the list. */
  const finishFlow = () => {
    if (session.length) setJustAdded(session[session.length - 1]);
    closeFlow();
  };

  const startAdd = (step: StepId) => {
    setW(""); setH(""); setQty(1); setField("w"); stopAdvance(); setSession([]); editDims.current = null;
    openFlow(step);
  };
  /** Straight from the home screen's Window / Door / Partition — the type is
   *  already answered, so the flow opens on the first real question. */
  const startType = (t: OpeningType) => {
    setType(t);
    startAdd(stepsFor(t, o)[1]);
  };
  const startEdit = (it: JobItem) => {
    setType(it.type);
    setO(optsFromItem(it));
    setW(ftIn(it.width));
    setH(ftIn(it.height));
    editDims.current = { w: ftIn(it.width), h: ftIn(it.height), wu: it.width, hu: it.height };
    setQty(it.qty);
    setField("w"); stopAdvance(); setSession([]);
    openFlow("size", it.id);
  };

  /* —— the size keypad ——
   * The app's own pad, not the phone keyboard: ft ( ' ) and inch ( " ) sit
   * beside the digits, so "4'6" needs no keyboard switch — which is what
   * makes moving on by itself safe. With the phone keyboard, hunting for
   * the ' key took long enough that a pause-based jump would leave mid-size.
   * The width hands over to the height box the moment it is complete by form
   * (it ends in ", or is a full 4-6-2), or once a readable width has been
   * left alone for a moment. */
  /** How many digits the number part being typed may have. */
  const maxDigits = (cur: string) => (/['.\-]/.test(cur) ? 2 : 4);
  /** A size that cannot take another key: it ends in ", is a full 4-6-2, or
   *  its last number part is full (4'11, 1372) — move on at once. */
  const completeByForm = (v: string) =>
    /"$/.test(v) || /^\d+-\d+-\d+$/.test(v) || /'\d{2}$/.test(v) || /^\d{4}$/.test(v);
  const press = (k: string) => {
    stopAdvance();
    if (k === "next") {
      if (field === "w") setField("h"); else commit();
      return;
    }
    const cur = field === "w" ? w : h;
    let v: string;
    if (k === "back") v = cur.slice(0, -1);
    else {
      // Only sizes that can be read: every mark follows a digit, ft and inch
      // once each, one decimal point per number, at most two dashes (4-6-2),
      // and dashes never mixed with ft / inch marks.
      const endsDigit = /\d$/.test(cur);
      // the inch mark closes a size — nothing may follow it
      if (cur.includes('"')) return;
      // and no number part runs on: 2 digits of inches after ' or in a dash
      // part or after a point, 4 for a bare number (up to mm)
      if (/\d/.test(k) && (/\d*$/.exec(cur)?.[0].length ?? 0) >= maxDigits(cur)) return;
      const ok = /\d/.test(k)
        || (k === "'" && endsDigit && !/['"-]/.test(cur))
        || (k === '"' && endsDigit && !cur.includes('"'))
        || (k === "." && endsDigit && !/\.\d*$/.test(cur))
        || (k === "-" && endsDigit && !/['"]/.test(cur) && (cur.match(/-/g)?.length ?? 0) < 2);
      if (!ok) return;
      v = (cur + k).slice(0, 12);
    }
    if (field === "w") setW(v); else setH(v);
    if (k === "back") return;
    if (field === "w") {
      if (completeByForm(v)) setField("h");
      else if (parseOpening(v, "auto", feetBelow)) advanceTimer.current = setTimeout(() => setField("h"), AUTO_NEXT_MS);
    } else if (!flow?.editing) {
      // Height done → the size is added and the boxes are ready for the next.
      const wNow = w;
      if (completeByForm(v)) addAndContinue(wNow, v);
      else if (parseOpening(v, "auto", feetBelow)) advanceTimer.current = setTimeout(() => addAndContinue(wNow, v), AUTO_NEXT_MS);
    }
  };
  // A computer's keyboard types into the same boxes.
  useEffect(() => {
    if (flow?.step !== "size") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.activeElement instanceof HTMLInputElement) return; // the quantity box
      const map: Record<string, string> = { "’": "'", "‘": "'", "”": '"', "“": '"', Backspace: "back", Enter: "next", Tab: "next" };
      const k = map[e.key] ?? e.key;
      if (/^[0-9.\-'"]$/.test(k) || k === "back" || k === "next") { e.preventDefault(); press(k); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ————— the add / edit flow ————— */
  if (flow) {
    const i = steps.indexOf(flow.step);
    const pick = (t: OpeningType) => { setType(t); choose({}, true, t); };
    const live = ready
      ? buildJobItem(1, type, pw!.um, ph!.um, qty, metaFor(type, o))
      : sample(type, o);

    return (
      <div className="flex flex-col gap-4">
        {/* header: back · title · progress */}
        <div className="flex items-center gap-3 py-1">
          <button onClick={back} aria-label="Back" className="btn-ghost grid h-10 w-10 shrink-0 place-items-center text-lg">←</button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
              {flow.editing ? `Editing ${flow.editing}` : `Add ${type}`} · Step {i + 1} of {steps.length}
            </div>
            <h1 className="truncate text-lg font-bold">{STEP_TITLE[flow.step]}</h1>
          </div>
          {session.length === 0 && (
            <button onClick={closeFlow} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Cancel</button>
          )}
        </div>
        <div className="flex gap-1">
          {steps.map((s, k) => (
            <span key={s} className="h-1 flex-1 rounded-full" style={{ background: k <= i ? "var(--accent)" : "var(--line)" }} />
          ))}
        </div>

        {flow.step === "type" && (
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map(([v, label]) => (
              <Choice key={v} selected={type === v} onClick={() => pick(v as OpeningType)} title={label}
                picture={<MiniElevation item={sample(v as OpeningType, o)} size={v === "door" ? 40 : 76} />} />
            ))}
          </div>
        )}

        {flow.step === "system" && (
          <div className="flex flex-col gap-2">
            {SYSTEMS.map(([v, label]) => (
              <Choice key={v} wide selected={o.sys === v} onClick={() => choose({ sys: v as WinSys })}
                title={label} sub={SYSTEM_INFO[v as WinSys].sub}
                // eslint-disable-next-line @next/next/no-img-element
                picture={<img src={SYSTEM_INFO[v as WinSys].img} alt="" style={{ maxHeight: 64, maxWidth: 96, objectFit: "contain" }} />} />
            ))}
          </div>
        )}

        {flow.step === "tracks" && (
          <div className="grid grid-cols-2 gap-2">
            {TRACKS.map(([v, label]) => (
              <Choice key={v} selected={o.tracks === v} onClick={() => choose({ tracks: v, mix: MIXES[v][0][0] })} title={label}
                picture={<MiniElevation item={sample("window", { ...o, tracks: v, mix: MIXES[v][0][0] })} size={110} />} />
            ))}
          </div>
        )}

        {flow.step === "mix" && (
          <div className="grid grid-cols-2 gap-2">
            {(MIXES[o.tracks] ?? MIXES["2"]).map(([v, label]) => (
              <Choice key={v} selected={o.mix === v} onClick={() => choose({ mix: v })} title={label}
                picture={<MiniElevation item={sample("window", { ...o, mix: v })} size={110} />} />
            ))}
          </div>
        )}

        {flow.step === "domalFix" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Choice selected={o.domalFix === "no"} onClick={() => choose({ domalFix: "no" })} title="No"
                picture={<MiniElevation item={sample("window", { ...o, domalFix: "no" })} size={100} />} />
              <Choice selected={o.domalFix === "yes"} onClick={() => choose({ domalFix: "yes" }, false)} title="Yes"
                picture={<MiniElevation item={sample("window", { ...o, domalFix: "yes" })} size={100} />} />
            </div>
            {o.domalFix === "yes" && (
              <>
                <Field label="Fixed glass height">
                  <Seg options={FIX_FT} value={o.domalFixFt} onChange={(v) => choose({ domalFixFt: v }, false)} />
                </Field>
                <button onClick={() => go("size")} className="btn-primary w-full py-3.5">Next</button>
              </>
            )}
          </>
        )}

        {flow.step === "zType" && (
          <div className="grid grid-cols-2 gap-2">
            {Z_TYPES.map(([v, label]) => (
              <Choice key={v} selected={o.zType === v} title={label}
                // A Z door is built from the heavy series — picked for him.
                onClick={() => choose({ zType: v, zSize: v === "door" ? "heavy" : o.zSize })}
                picture={v === "door"
                  ? <MiniElevation item={buildJobItem(1, "window", feet(3), feet(7), 1, metaFor("window", { ...o, zType: v }))} size={42} />
                  : <MiniElevation item={sample("window", { ...o, zType: v })} size={100} />} />
            ))}
          </div>
        )}

        {flow.step === "zDetails" && (
          <div className="card flex flex-col gap-4 p-4">
            <div className="grid place-items-center"><MiniElevation item={sample("window", o)} size={130} /></div>
            {o.zType === "combo" && (
              <>
                <Field label="Fixed part position">
                  <Seg options={Z_DIRS} value={o.zComboDir} onChange={(v) => choose({ zComboDir: v }, false)} />
                </Field>
                <Field label="Fixed part size">
                  <Seg options={FIX_FT} value={o.zFixedFt} onChange={(v) => choose({ zFixedFt: v }, false)} />
                </Field>
              </>
            )}
            {(o.zType === "openable" || o.zType === "combo") && (
              <Field label="Openable sashes">
                <Seg options={Z_SASH} value={o.zSash} onChange={(v) => choose({ zSash: v }, false)} />
              </Field>
            )}
            <Field label="Profile">
              <Seg options={Z_SIZE} value={o.zSize} onChange={(v) => choose({ zSize: v }, false)} />
            </Field>
            <button onClick={() => go("size")} className="btn-primary w-full py-3.5">Next</button>
          </div>
        )}

        {flow.step === "doorPanels" && (
          <div className="grid grid-cols-4 gap-2">
            {DOOR_MIX.map(([v, label]) => (
              <Choice key={v} selected={o.doorMix === v} onClick={() => choose({ doorMix: v })} title={label}
                picture={<MiniElevation item={sample("door", { ...o, doorMix: v })} size={40} />} />
            ))}
          </div>
        )}

        {flow.step === "doorDetails" && (
          <div className="card flex flex-col gap-4 p-4">
            <Field label="What do you need?">
              <Seg options={CHOKHAT} value={o.chokhat} onChange={(v) => choose({ chokhat: v }, false)} />
            </Field>
            <Field label="Shutter section (mm)">
              <Seg options={PALLA} value={o.palla} onChange={(v) => choose({ palla: v }, false)} />
            </Field>
            <button onClick={() => go("size")} className="btn-primary w-full py-3.5">Next</button>
          </div>
        )}

        {flow.step === "partDoor" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Choice selected={o.partDoor === "no"} onClick={() => choose({ partDoor: "no" })} title="No door"
                picture={<MiniElevation item={sample("partition", { ...o, partDoor: "no" })} size={120} />} />
              <Choice selected={o.partDoor === "yes"} onClick={() => choose({ partDoor: "yes" }, false)} title="With a door"
                picture={<MiniElevation item={sample("partition", { ...o, partDoor: "yes" })} size={120} />} />
            </div>
            {o.partDoor === "yes" && (
              <>
                <Field label="Door width">
                  <Seg options={PART_DOOR_W} value={o.partDoorW} onChange={(v) => choose({ partDoorW: v }, false)} />
                </Field>
                <button onClick={() => go("partSheet")} className="btn-primary w-full py-3.5">Next</button>
              </>
            )}
          </>
        )}

        {flow.step === "partSheet" && (
          <div className="grid grid-cols-2 gap-2">
            {PART_SHEET.map(([v, label]) => (
              <Choice key={v} selected={o.partSheetFt === v} onClick={() => choose({ partSheetFt: v })} title={label}
                picture={<MiniElevation item={sample("partition", { ...o, partSheetFt: v })} size={120} />} />
            ))}
          </div>
        )}

        {flow.step === "partSpacing" && (
          <div className="card flex flex-col gap-4 p-4">
            <div className="grid place-items-center"><MiniElevation item={sample("partition", o)} size={200} /></div>
            <Field label="Vertical divider every">
              <Seg options={BAY_FT} value={o.partBayFt} onChange={(v) => choose({ partBayFt: v }, false)} />
            </Field>
            <Field label="Horizontal divider every">
              <Seg options={ROW_FT} value={o.partRowFt} onChange={(v) => choose({ partRowFt: v }, false)} />
            </Field>
            <button onClick={() => go("size")} className="btn-primary w-full py-3.5">Next</button>
          </div>
        )}

        {flow.step === "size" && (
          <div className="flex flex-col gap-3">
            {/* what is being added — one slim line, tap to change it */}
            <button onClick={() => go(steps[1] ?? "type")} className="card flex items-center gap-3 px-3 py-2 text-left">
              <span className="grid w-10 shrink-0 place-items-center"><MiniElevation item={live} size={type === "door" ? 20 : 40} /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{itemLabel(live)}</span>
              <span className="shrink-0 text-xs font-bold" style={{ color: "var(--accent)" }}>Change</span>
            </button>

            {/* the size just added — proof it landed, and its quantity fixable.
                One line only: the keypad and the Finish button must stay on
                screen however many sizes go in. */}
            {lastAdded && (
              <div className="card flex items-center gap-2 px-3 py-1.5" style={{ background: "var(--good-soft)" }}>
                <span className="text-sm font-bold" style={{ color: "var(--good)" }}>✓</span>
                <span className="mono text-xs" style={{ color: "var(--ink-3)" }}>{lastAdded.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold tabnum">{openingText(lastAdded)} added</span>
                <MiniQty value={lastAdded.qty} label={lastAdded.id}
                  onChange={(n) => onReplace(lastAdded.id, lastAdded.type, lastAdded.width, lastAdded.height, n, lastAdded.meta)} />
                <button onClick={() => { onRemove(lastAdded.id); setSession((s) => s.filter((x) => x !== lastAdded.id)); }}
                  aria-label={`Remove ${lastAdded.id}`} className="grid h-8 w-8 place-items-center text-lg" style={{ color: "var(--ink-3)" }}>×</button>
              </div>
            )}

            <div className="card flex flex-col gap-2.5 p-3">
              <div className="flex gap-2">
                <SizeBox label="Width" value={w} placeholder="4'6" active={field === "w"}
                  onClick={() => { stopAdvance(); setField("w"); }} />
                <SizeBox label="Height" value={h} placeholder="4" active={field === "h"}
                  onClick={() => { stopAdvance(); setField("h"); }} />
                {/* quantity sits on the same line as the size it belongs to */}
                <div className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--radius)] px-1"
                  style={{ border: "1.5px solid var(--line)" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>Qty</span>
                  <MiniQty value={qty} onChange={setQty} label="this size" />
                </div>
              </div>
              <div className="min-h-[18px] text-xs font-medium"
                style={{ color: !touched ? "var(--ink-3)" : ready ? (unsure ? "var(--warn)" : "var(--good)") : (pw || ph) && !warn ? "var(--ink-3)" : "var(--bad)" }}>
                {!touched
                  ? session.length ? "Next size — it is added by itself when the height is done." : "Type the width, then the height. ft = ' · inch = \""
                  : !pw || !ph
                    ? (pw ? `Width = ${describeDim(pw.um)} · now the height` : "Keep typing the size")
                    : warn
                      ? warn
                      : `= ${describeDim(pw.um)} × ${describeDim(ph.um)}${
                          unsure ? " · read as feet — for inches add \"" : ""}`}
              </div>
              <Keypad onKey={press} lastLabel={field === "w" ? "Next →" : flow.editing ? "Save ✓" : "Add ✓"}
                lastDisabled={field === "h" && !ready} />
              {flow.editing && (
                <button onClick={() => { onRemove(flow.editing!); closeFlow(); }}
                  className="text-sm font-semibold" style={{ color: "var(--bad)" }}>
                  Remove {flow.editing} from the job
                </button>
              )}
            </div>

            {/* The way out, big and spelled out: what it does and where it
                goes. A small "Done" in the corner was missed or not understood. */}
            {session.length > 0 && (
              <button onClick={finishFlow} className="btn-dark flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
                <span>
                  <span className="block text-base font-bold">✓ Finish — {plural(session.length, "size")} added</span>
                  <span className="block text-xs font-normal opacity-80">See the list and get the material list</span>
                </span>
                <span aria-hidden className="text-xl">→</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ————— the job: what's been added, and the one next step ————— */
  const openings = items.reduce((a, it) => a + it.qty, 0);
  const last = items[items.length - 1];

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

      {items.length === 0 ? (
        /* first screen: what are you making — tap one to start */
        <div className="card flex flex-col gap-4 p-4">
          <div>
            <h1 className="text-xl font-bold">What are you making?</h1>
            <p className="mt-0.5 text-sm" style={{ color: "var(--ink-2)" }}>
              Tap one, then type your sizes one after another.
            </p>
          </div>
          <TypeCards onPick={startType} big />
        </div>
      ) : (
        <>
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
              <div key={it.id} id={`item-${it.id}`} className="flex items-center gap-2 pl-2 pr-2 transition-colors"
                style={{ borderTop: "1px solid var(--line)", background: justAdded === it.id ? "var(--good-soft)" : undefined }}>
                <button onClick={() => startEdit(it)} aria-label={`Edit ${it.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left">
                  <span className="grid w-12 shrink-0 place-items-center">
                    <MiniElevation item={it} size={it.type === "door" ? 22 : 44} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold tabnum">
                      <span className="mono mr-1.5 text-xs" style={{ color: "var(--ink-3)" }}>{it.id}</span>
                      {openingText(it)}{it.qty > 1 && <span style={{ color: "var(--accent)" }}> × {it.qty}</span>}
                      {justAdded === it.id && <span className="ml-2 text-xs font-bold" style={{ color: "var(--good)" }}>✓ Added</span>}
                    </span>
                    <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>{itemLabel(it)}</span>
                  </span>
                </button>
                <button onClick={() => onRemove(it.id)} aria-label={`Remove ${it.id}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
                  style={{ color: "var(--ink-3)" }}>×</button>
              </div>
            ))}
            <div className="px-4 py-2 text-[11px]" style={{ borderTop: "1px solid var(--line)", color: "var(--ink-3)" }}>
              Tap an item to change it.
            </div>
          </div>

          {/* the two ways to add more: the same again (straight to the size)
              — ten identical windows is the common job — or something else */}
          <button onClick={() => { setType(last.type); setO(optsFromItem(last)); startAdd("size"); }}
            className="card flex items-center gap-3 p-3 text-left">
            <span className="grid w-12 shrink-0 place-items-center"><MiniElevation item={last} size={last.type === "door" ? 22 : 44} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold" style={{ color: "var(--accent)" }}>+ More sizes of the same</span>
              <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>{itemLabel(last)}</span>
            </span>
          </button>
          <div>
            <div className="mb-1.5 px-1 text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Or add something else</div>
            <TypeCards onPick={startType} />
          </div>
        </>
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

      {/* the one next step, always in reach — this screen has no keyboard,
          so nothing ever covers it */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-3"
          style={{ background: "var(--surface)", borderColor: "var(--line)", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-xl">
            <button onClick={onDone} className="btn-dark w-full py-4 text-base">
              Get Material List ({plural(openings, "pc")}) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Window / Door / Partition as pictures — the first thing on the home screen. */
function TypeCards({ onPick, big }: { onPick: (t: OpeningType) => void; big?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TYPES.map(([v, label]) => (
        <button key={v} onClick={() => onPick(v as OpeningType)} aria-label={`Add ${label}`}
          className={`chip flex flex-col items-center gap-2 px-2 text-center ${big ? "py-4" : "py-2.5"}`}>
          <span className={`grid w-full place-items-center ${big ? "min-h-[84px]" : "min-h-[48px]"}`}>
            <MiniElevation item={sample(v as OpeningType, DEFAULT_OPTS)}
              size={v === "door" ? (big ? 42 : 24) : big ? 84 : 52} />
          </span>
          <span className={`${big ? "text-base" : "text-sm"} font-bold`} style={{ color: "var(--ink)" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** A size box the keypad types into — tap it to make it the active one. */
function SizeBox({ label, value, placeholder, active, onClick }: {
  label: string; value: string; placeholder: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active}
      className="dim-input min-w-0 flex-1 px-3 py-2 text-left"
      style={active ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" } : undefined}>
      <span className="block text-[11px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}>{label}</span>
      <span className="flex min-h-[34px] items-center text-2xl font-semibold tabnum" data-value={value}>
        {value || <span style={{ color: "#c2c7cf" }}>{placeholder}</span>}
        {active && <span className="caret ml-0.5 inline-block h-7 w-[2px]" style={{ background: "var(--accent)" }} />}
      </span>
    </button>
  );
}

/**
 * The app's own number pad, laid out like a phone dial, with ft ( ' ),
 * inch ( " ), dash and point on the same pad — no keyboard switching, no
 * iPhone "smart" quotes, nothing sliding up over the screen.
 */
function Keypad({ onKey, lastLabel, lastDisabled }: { onKey: (k: string) => void; lastLabel: string; lastDisabled: boolean }) {
  const keys: [string, React.ReactNode, string][] = [
    ["1", "1", "1"], ["2", "2", "2"], ["3", "3", "3"], ["back", "⌫", "Delete"],
    ["4", "4", "4"], ["5", "5", "5"], ["6", "6", "6"], ["'", <><span className="text-xl">&apos;</span><span className="ml-1 text-xs">ft</span></>, "Feet"],
    ["7", "7", "7"], ["8", "8", "8"], ["9", "9", "9"], ['"', <><span className="text-xl">&quot;</span><span className="ml-1 text-xs">inch</span></>, "Inch"],
    [".", ".", "Point"], ["0", "0", "0"], ["-", "–", "Dash"], ["next", lastLabel, lastLabel],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5" style={{ touchAction: "manipulation" }}>
      {keys.map(([k, label, aria]) => (
        <button key={k} onClick={() => onKey(k)} aria-label={aria}
          disabled={k === "next" && lastDisabled}
          className={`h-14 rounded-[var(--radius)] font-semibold disabled:opacity-40 ${k === "next" ? "btn-primary text-base" : "text-xl"}`}
          style={k === "next" ? undefined : { background: /\d/.test(k) ? "var(--surface)" : "var(--surface-2)", border: "1px solid var(--line)" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Compact − n + for a size already added. */
function MiniQty({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center rounded-lg" style={{ border: "1px solid var(--line)" }}>
      <button onClick={() => onChange(Math.max(1, value - 1))} aria-label={`Fewer ${label}`} className="h-8 w-8 font-bold">−</button>
      <span className="w-7 text-center text-sm font-bold tabnum">{value}</span>
      <button onClick={() => onChange(Math.min(999, value + 1))} aria-label={`More ${label}`} className="h-8 w-8 font-bold">+</button>
    </div>
  );
}

/** One answer, as a picture with its name — tap to choose. */
function Choice({ picture, title, sub, selected, onClick, wide }: {
  picture: React.ReactNode; title: string; sub?: string; selected: boolean; onClick: () => void; wide?: boolean;
}) {
  return (
    <button onClick={onClick} aria-pressed={selected}
      className={`chip flex ${wide ? "flex-row items-center gap-4 px-4 py-3 text-left" : "flex-col items-center gap-2 px-2 py-3 text-center"} ${selected ? "selected" : ""}`}>
      <span className={`grid shrink-0 place-items-center ${wide ? "w-24" : "min-h-[72px] w-full"}`}>{picture}</span>
      <span className="min-w-0">
        <span className="block text-sm font-bold leading-tight" style={{ color: "var(--ink)" }}>{title}</span>
        {sub && <span className="mt-0.5 block text-xs" style={{ color: "var(--ink-3)" }}>{sub}</span>}
      </span>
    </button>
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
