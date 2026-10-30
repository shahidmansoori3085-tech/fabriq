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
  formatFtInSut, formatFtIn, toFeet, feet, sqft, openingWarning, parseTradeSize, formatTradeSize, type Um,
} from "@/lib/engine/units";
import { PieceTooLongError } from "@/lib/engine/cutting";
import { estimate, ImpossibleLayoutError, partitionLayout } from "@/lib/engine/estimator";
import { buildJobItem } from "@/lib/engine/quick-item";
import {
  getSection, BRANDS, sectionCode, loadBrand, saveBrand, type BrandId,
} from "@/lib/engine/sections";
import { reviewEstimate } from "@/lib/engine/review";
import type {
  JobItem, MaterialList, OpeningType, PackedBar, CutPiece, ReviewFinding,
} from "@/lib/engine/types";
import { CuttingGuide, MiniElevation, PartitionGapPicture, DoorScopePicture } from "@/components/diagrams";
import { SectionProfile, SectionDrawing, hasImage } from "@/components/section-profiles";
import { EngineeringSheet } from "@/components/eng-sheet";
import { SupplierOrderDoc } from "@/components/supplier-doc";
import { sharePdfToWhatsApp, elementToPdfBlob, whatsAppLink, type ShareResult } from "@/lib/pdf";
import {
  loadProjects, saveProject, patchProject, removeProject, newProjectId, autoTitle, totalSqft,
  type ProjectRec,
} from "@/lib/projects";
import { loadShop, saveShop, type ShopProfile } from "@/lib/shop";
import { InstallButton } from "@/components/install";

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
  /** Center rails across the door shutter — panels = centers + 1. */
  doorCenters: string;
  /** Door: the normal palla door, or a Z-section (hinged glass) door. */
  doorSys: string;
  /** Partition: SP/DP pipe, or a Z-section fixed-glass grid. */
  partSys: string;
  partDoor: string;
  partDoorW: string;
  partBayFt: string;
  partRowFt: string;
  partSheetFt: string;
}

const DEFAULT_OPTS: Opts = {
  sys: "normal", tracks: "2", mix: "GG", domalFix: "no", domalFixFt: "2",
  zType: "openable", zComboDir: "top", zFixedFt: "2", zSash: "2", zSize: "light",
  palla: "60", chokhat: "needed", doorMix: "GSS", doorCenters: "2",
  doorSys: "normal", partSys: "spdp",
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
// A Z-section door is asked under Door, not here — a fabricator looks for a door under Door.
const Z_TYPES: Opt[] = [["openable", "Openable"], ["combo", "Fixed + Openable"], ["fixed", "Fully Fixed"]];
const Z_DIRS: Opt[] = [["top", "Top"], ["side", "One side"], ["both", "Both sides"]];
const Z_SASH: Opt[] = [["1", "1"], ["2", "2"], ["3", "3"]];
const Z_SIZE: Opt[] = [["light", "Small 40×40"], ["heavy", "Big 40×55"]];
const PALLA: Opt[] = [["60", "63 × 25"], ["75", "75 × 25"], ["50", "50 × 25"]];
const CHOKHAT: Opt[] = [["needed", "Frame + Shutter"], ["existing", "Shutter only"]];
/** Door panels, top to bottom (3 panels, 2 center rails). Glass top is the
 *  usual door (founder, 2026-10-28), so it comes first and is the default. */
const DOOR_CENTERS: Opt[] = [["1", "1"], ["2", "2"], ["3", "3"]];

/** The door's panels, top to bottom. What fills them does not change the
 *  aluminium, so it is not asked: glass on top, sheet below — the usual door
 *  (founder, 2026-10-28). A job saved with its own mix keeps it. */
function doorMixOf(o: Opts): string {
  const n = Math.max(1, parseInt(o.doorCenters, 10) || 2);
  return o.doorMix.length === n + 1 ? o.doorMix : "G" + "S".repeat(n);
}
const PART_DOOR_W: Opt[] = [["2.5", "2.5 ft"], ["3", "3 ft"], ["3.5", "3.5 ft"]];
/** Gap between the partition's dividers. Any other gap can be typed in. */
const BAY_FT: Opt[] = [["2", "2 ft"], ["2.5", "2.5 ft"], ["3", "3 ft"], ["3.5", "3.5 ft"], ["4", "4 ft"]];
const ROW_FT: Opt[] = [["2.5", "2.5 ft"], ["3", "3 ft"], ["3.5", "3.5 ft"], ["4", "4 ft"]];

const labelOf = (opts: Opt[], v: string | undefined) => opts.find(([k]) => k === v)?.[1] ?? v ?? "";

/** The form's choices → the meta map the engine reads. */
function metaFor(type: OpeningType, o: Opts): Record<string, string> {
  if (type === "door") {
    if (o.doorSys === "z") return { system: "z_section" };
    const mix = doorMixOf(o);
    return { palla: o.palla, chokhat: o.chokhat, rails: String(mix.length - 1), zonemix: mix };
  }
  if (type === "partition" && o.partSys === "z") {
    return { system: "z_section", zSize: o.zSize, partBayFt: o.partBayFt, partRowFt: o.partRowFt };
  }
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
    if (it.system === "z_section") o.doorSys = "z";
    pick("palla", m.palla); pick("chokhat", m.chokhat); pick("doorMix", m.zonemix);
    if (m.zonemix) o.doorCenters = String(Math.max(1, m.zonemix.length - 1));
  } else if (it.type === "partition") {
    if (it.system === "z_section") { o.partSys = "z"; pick("zSize", m.zSize); }
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
  if (it.type === "door" && it.system === "z_section") return "Z-Section door · 40×55 · glass";
  if (it.type === "partition" && it.system === "z_section") {
    const L = partitionLayout(it);
    return `Z-Section partition ${m.zSize === "heavy" ? "40×55" : "40×40"} · ${L.bays} × ${L.glassRows} glass panels`;
  }
  if (it.type === "door") {
    const scope = m.chokhat === "existing" ? " · shutter only" : " + frame";
    const centers = Math.max(0, (m.zonemix?.length ?? 3) - 1);
    return `Door · ${labelOf(PALLA, m.palla)} shutter${scope} · ${centers} center${centers === 1 ? "" : "s"}`;
  }
  if (it.type === "partition") {
    // What gets built — panels across × panels high — not the gap rule behind it.
    const L = partitionLayout(it);
    const door = m.partDoor === "yes" ? ` + ${m.partDoorW ?? "3"} ft door` : "";
    const sheet = parseFloat(m.partSheetFt ?? "0") > 0 ? ` · ${m.partSheetFt} ft bottom sheet` : "";
    return `Partition${door}${sheet} · ${L.bays} × ${L.glassRows} glass panels`;
  }
  if (it.system === "z_section") {
    const sashes = m.zType === "openable" || m.zType === "combo" ? ` · ${m.zSashCount ?? it.shutters.length} sash` : "";
    const base = `Z-Section ${m.zSize === "heavy" ? "40×55" : "40×40"} · ${labelOf(Z_TYPES, m.zType)}`;
    return m.zType === "combo"
      ? `${base} (${formatFtIn(feet(parseFloat(m.zFixedFt ?? "2") || 2))} fixed, ${labelOf(Z_DIRS, m.zComboDir).toLowerCase()})${sashes}`
      : `${base}${sashes}`;
  }
  const name = it.system === "domal" ? "Domal" : "Sliding";
  const mix = labelOf(MIXES[m.tracks ?? "2"] ?? [], m.mix);
  const fix = it.system === "domal" && m.domalFix === "yes" ? ` · ${formatFtIn(feet(parseFloat(m.domalFixFt ?? "2") || 2))} fixed top` : "";
  return `${name} ${m.tracks} Track · ${mix}${fix}`;
}

/** Panel / glass size the way the workshop writes it — inches + sut. */
function sizeText(it: { width: Um; height: Um }): string {
  return `${formatFtInSut(it.width)} × ${formatFtInSut(it.height)}`;
}

function openingText(it: { width: Um; height: Um }): string {
  return `${formatFtIn(it.width)} × ${formatFtIn(it.height)}`;
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
      `Check the size, or choose a smaller fixed part or door.`;
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
 *
 * A partition asks its sizes BEFORE its dividers: the divider screens draw
 * the partition actually being made, so the gap each choice leaves is real.
 */
type StepId =
  | "type" | "system" | "tracks" | "mix" | "domalFix"
  | "zType" | "zDir" | "zSash" | "zProfile"
  | "doorSys" | "doorCenters" | "doorFrame" | "doorSection"
  | "partSys" | "partDoor" | "partDoorW" | "size" | "partBays" | "partRows";

/** One question per screen — only the ones this choice actually needs. */
function stepsFor(type: OpeningType, o: Opts): StepId[] {
  if (type === "door") {
    return ["type", "doorSys", ...(o.doorSys === "z" ? [] : ["doorCenters", "doorFrame", "doorSection"] as const), "size"];
  }
  if (type === "partition") {
    const kind: StepId[] = o.partSys === "z"
      ? ["zProfile"]
      : ["partDoor", ...(o.partDoor === "yes" ? ["partDoorW" as const] : [])];
    return ["type", "partSys", ...kind, "size", "partBays", "partRows"];
  }
  if (o.sys === "z_section") {
    return [
      "type", "system", "zType",
      ...(o.zType === "combo" ? ["zDir" as const] : []),
      ...(o.zType === "openable" || o.zType === "combo" ? ["zSash" as const] : []),
      // a Z door is always the big section — nothing to ask
      ...(o.zType !== "door" ? ["zProfile" as const] : []),
      "size",
    ];
  }
  return ["type", "system", "tracks", "mix", ...(o.sys === "domal" ? ["domalFix" as const] : []), "size"];
}

const STEP_TITLE: Record<StepId, string> = {
  type: "What are you making?",
  system: "Which window system?",
  tracks: "How many tracks?",
  mix: "Which shutters?",
  domalFix: "Fixed glass on top?",
  zType: "Which type?",
  zDir: "Where is the fixed glass?",
  zSash: "How many shutters open?",
  zProfile: "Which section?",
  doorSys: "Which door?",
  doorCenters: "How many center rails?",
  doorFrame: "Frame (chaukhat) too?",
  doorSection: "Shutter section?",
  partSys: "Which partition?",
  partDoor: "Door in the partition?",
  partDoorW: "Door width?",
  size: "Enter your sizes",
  partBays: "Vertical lines (khadi)",
  partRows: "Horizontal lines (leti)",
};

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

/** One line of the size list: width, height and how many of that size —
 *  and, for a partition, its own divider gaps (each partition is drawn and
 *  asked about on its own; two partitions rarely want the same grid). */
interface SizeRow { w: string; h: string; fix: string; qty: number; bay?: string; row?: string }
const emptyRow = (): SizeRow => ({ w: "", h: "", fix: "", qty: 1 });
const isEmptyRow = (r: SizeRow) => !(r.w + r.h + r.fix).trim();
type BoxKey = "w" | "h" | "fix";

/** The fixed glass of a Domal "fixed top" or a Z-section "fixed + openable"
 *  differs window to window, so it is typed with each size, not picked once. */
function fixedPart(type: OpeningType, o: Opts): string | null {
  if (type !== "window") return null;
  if (o.sys === "domal" && o.domalFix === "yes") return "Fixed top";
  if (o.sys === "z_section" && o.zType === "combo") return o.zComboDir === "top" ? "Fixed top" : o.zComboDir === "both" ? "Each fixed side" : "Fixed side";
  return null;
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
  /** The add/edit flow, when open: which screen, and which item is being edited. */
  const [flow, setFlow] = useState<{ step: StepId; editing: string | null } | null>(null);
  /** The sizes being typed. Every line stays on screen, editable, until the
   *  flow is finished — nothing joins the job a moment after it is typed. */
  const [rows, setRows] = useState<SizeRow[]>([emptyRow()]);
  const [justAdded, setJustAdded] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  /** The exact size of the item being edited, with the boxes it was shown as —
   *  the boxes are rounded to the sut, so an untouched size keeps its real value. */
  const [editDims, setEditDims] = useState<{ w: string; h: string; wu: Um; hu: Um } | null>(null);

  /* —— the phone's back button ——
   * Inside the flow it steps back one screen, like the ← in the header —
   * leaving outright would throw away sizes typed but not yet added. */
  const flowOpen = useRef(false);
  const closing = useRef(false);
  const stepBack = useRef<() => void>(() => {});
  useEffect(() => { flowOpen.current = !!flow; }, [flow]);
  useEffect(() => {
    const onPop = () => {
      if (window.history.state?.fabriq === "add") return;
      if (closing.current) { closing.current = false; return; }
      if (!flowOpen.current) return;
      window.history.pushState({ fabriq: "add" }, "");
      stepBack.current();
    };
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
    if (window.history.state?.fabriq === "add") { closing.current = true; window.history.back(); }
    window.scrollTo({ top: 0 });
  };

  // Just-added items are scrolled into view and glow briefly, so the
  // fabricator SEES them land in the list.
  useEffect(() => {
    if (!justAdded.length || flow) return;
    document.getElementById(`item-${justAdded[justAdded.length - 1]}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setJustAdded([]), 2500);
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

  /* —— sizes —— */
  // A partition's bare "20" is 20 ft (they run up to 25 ft); a window's is 20".
  const feetBelow = type === "partition" ? 26 : undefined;
  const fixLabel = fixedPart(type, o);
  /** Line i's meta: the shared choices, with its own fixed glass and divider gaps on top. */
  const metaOf = (row: SizeRow | undefined) => {
    const m = metaFor(type, o);
    if (!row) return m;
    const fx = fixLabel ? parseTradeSize(row.fix) : null;
    if (fx) m[o.sys === "domal" ? "domalFixFt" : "zFixedFt"] = String(Math.round(toFeet(fx) * 10000) / 10000);
    if (type === "partition") {
      if (row.bay) m.partBayFt = row.bay;
      if (row.row) m.partRowFt = row.row;
    }
    return m;
  };
  /** Why this size cannot be built as chosen — said on its own line, at once. */
  const problemOf = (wu: Um, hu: Um, row: SizeRow): string | null => {
    const warn = openingWarning(wu, hu);
    if (warn) return warn;
    try {
      estimate([buildJobItem(1, type, wu, hu, 1, metaOf(row))]);
      return null;
    } catch (e) {
      return layoutError(e);
    }
  };
  const parsed = useMemo(() => rows.map((row) => {
    const wu = parseTradeSize(row.w, feetBelow), hu = parseTradeSize(row.h, feetBelow);
    const fu = fixLabel ? parseTradeSize(row.fix) : null;
    const empty = isEmptyRow(row);
    const unreadable = (row.w.trim() && wu === null) || (row.h.trim() && hu === null) || (fixLabel && row.fix.trim() && fu === null);
    const needFix = !!fixLabel && fu === null;
    const warn = unreadable ? "Not a size — 4.6 means 4 ft 6 in"
      : wu !== null && hu !== null && !needFix ? problemOf(wu, hu, row) : null;
    return { wu, hu, fu, empty, warn, ready: wu !== null && hu !== null && !needFix && !warn };
  }), [rows, type, o]); // eslint-disable-line react-hooks/exhaustive-deps
  const filled = parsed.filter((p) => !p.empty);
  const readyCount = parsed.filter((p) => p.ready).length;
  const allReady = filled.length > 0 && filled.every((p) => p.ready);
  /** The real size of line i — an edited item's untouched size keeps its exact value. */
  const sizeOf = (i: number) => {
    const e = editDims, p = parsed[i];
    return {
      wu: e && i === 0 && rows[0].w === e.w ? e.wu : p.wu!,
      hu: e && i === 0 && rows[0].h === e.h ? e.hu : p.hu!,
    };
  };
  /** The lines that will be added, in order — the divider screens walk them one by one. */
  const readyIdx = parsed.flatMap((p, i) => (p.ready ? [i] : []));
  /** Which partition the divider screens are on (index into readyIdx). */
  const [part, setPart] = useState(0);
  /** The furthest partition shown so far — one not reached yet inherits the gaps before it. */
  const [seenPart, setSeenPart] = useState(0);
  const pr = readyIdx[Math.min(part, readyIdx.length - 1)] ?? 0;

  /** Everything typed joins the job together, only when the flow is finished. */
  const finish = (rs: SizeRow[] = rows) => {
    if (!flow || !allReady) return;
    if (flow.editing) {
      const { wu, hu } = sizeOf(0);
      onReplace(flow.editing, type, wu, hu, rs[0].qty, metaOf(rs[0]));
      setJustAdded([flow.editing]);
    } else {
      // Same numbering the list uses: the next free W-numbers, in order.
      let n = items.reduce((a, it) => Math.max(a, parseInt(it.id.slice(1), 10) || 0), 0);
      const ids: string[] = [];
      parsed.forEach((p, i) => {
        if (!p.ready) return;
        const { wu, hu } = sizeOf(i);
        onAdd(type, wu, hu, rs[i].qty, metaOf(rs[i]));
        ids.push(`W${++n}`);
      });
      setJustAdded(ids);
    }
    closeFlow();
  };
  const afterSize = steps.slice(steps.indexOf("size") + 1);
  const sizesDone = () => {
    if (!allReady) return;
    if (!afterSize.length) { finish(); return; }
    // Every partition starts from the last gaps used; each is then shown on its own.
    setRows((rs) => rs.map((r) => ({ ...r, bay: r.bay ?? o.partBayFt, row: r.row ?? o.partRowFt })));
    setPart(0); setSeenPart(0);
    go(afterSize[0]);
  };
  /** Set this partition's gap — and remember it as the default for the next one. */
  const setGap = (key: "bay" | "row", v: string) => {
    setRows((rs) => rs.map((r, k) => (k === pr ? { ...r, [key]: v } : r)));
    setO((x) => ({ ...x, [key === "bay" ? "partBayFt" : "partRowFt"]: v }));
  };
  /** After a partition's horizontal lines: the next partition, starting from these gaps. */
  const nextPartition = () => {
    const nx = readyIdx[part + 1];
    if (nx === undefined) { finish(); return; }
    if (part + 1 > seenPart) {
      const cur = rows[pr];
      setRows((rs) => rs.map((r, k) => (k === nx ? { ...r, bay: cur.bay, row: cur.row } : r)));
      setSeenPart(part + 1);
    }
    setPart(part + 1);
    go("partBays");
  };
  /** The rest take this partition's lines, and everything is added at once. */
  const sameForRest = () => {
    const cur = rows[pr];
    const later = new Set(readyIdx.slice(part + 1));
    const rs = rows.map((r, k) => (later.has(k) ? { ...r, bay: cur.bay, row: cur.row } : r));
    setRows(rs);
    finish(rs);
  };

  const typedAnything = !flow?.editing && rows.some((r) => !isEmptyRow(r));
  /** Leaving the flow drops sizes not yet added — never without asking. */
  const leave = () => {
    if (typedAnything && !window.confirm(`Discard the ${plural(filled.length, "size")} you typed?`)) return;
    closeFlow();
  };
  const back = () => {
    if (!flow) return;
    // Back from a later partition's first screen is the one before's last.
    if (flow.step === "partBays" && part > 0) { setPart(part - 1); go("partRows"); return; }
    const i = steps.indexOf(flow.step);
    if (i > 0) go(steps[i - 1]); else leave();
  };
  useEffect(() => { stepBack.current = back; });

  const startAdd = (step: StepId) => {
    setRows([emptyRow()]); setEditDims(null);
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
    const w = formatTradeSize(it.width), h = formatTradeSize(it.height);
    const fx = it.meta.domalFix === "yes" ? it.meta.domalFixFt : it.meta.zType === "combo" ? it.meta.zFixedFt : undefined;
    setRows([{ w, h, fix: fx ? formatTradeSize(feet(parseFloat(fx) || 0)) : "", qty: it.qty }]);
    setEditDims({ w, h, wu: it.width, hu: it.height });
    openFlow("size", it.id);
  };

  /* —— typing sizes ——
   * One box for the width and one for the height, on the phone's own number
   * keyboard — the point separates feet from inches (4.6 = 4'6"), so there is
   * no ' or " to find. Its Next key walks width → height (→ fixed glass) → the
   * next size. An empty size card always waits below the last one, and every
   * size stays on screen, editable, until the flow is finished. */
  const boxes = useRef<Record<string, HTMLInputElement | null>>({});
  const order: BoxKey[] = fixLabel ? ["w", "h", "fix"] : ["w", "h"];
  const setBox = (r: number, k: BoxKey, v: string) => {
    const clean = v.replace(/[^\d.'"\- ]/g, "").slice(0, 10);
    setRows((rs) => {
      const next = rs.map((x, i) => (i === r ? { ...x, [k]: clean } : x));
      if (!flow?.editing && !isEmptyRow(next[next.length - 1])) next.push(emptyRow());
      return next;
    });
  };
  const focusNext = (r: number, k: BoxKey) => {
    const at = order.indexOf(k);
    const el = boxes.current[at < order.length - 1 ? `${r}-${order[at + 1]}` : `${r + 1}-w`];
    if (el) el.focus(); else (document.activeElement as HTMLElement | null)?.blur();
  };
  const removeLine = (i: number) => setRows((rs) => {
    const next = rs.filter((_, k) => k !== i);
    if (!next.length || !isEmptyRow(next[next.length - 1])) next.push(emptyRow());
    return next;
  });
  // Arriving at the sizes, the first empty width box is ready to type into.
  useEffect(() => {
    if (flow?.step !== "size" || flow.editing) return;
    const r = rows.findIndex(isEmptyRow);
    if (r >= 0) boxes.current[`${r}-w`]?.focus();
  }, [flow?.step]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ————— the add / edit flow ————— */
  if (flow) {
    const i = steps.indexOf(flow.step);
    const pick = (t: OpeningType) => { setType(t); choose({}, true, t); };
    // What is being added, named in the header. A partition's panels are not
    // chosen yet, so it is named by its door only.
    const liveLabel = type === "partition"
      ? o.partSys === "z"
        ? `Z-Section partition · ${o.zSize === "heavy" ? "40×55" : "40×40"}`
        : `Partition · ${o.partDoor === "yes" ? `${o.partDoorW} ft door` : "no door"}`
      : itemLabel(sample(type, o)).replace(/ \([^)]*fixed[^)]*\)| · [\d.]+ ft fixed top/, "");
    /** The partition the divider screens draw: the one being asked about. */
    const shape = readyIdx.length
      ? buildJobItem(1, type, sizeOf(pr).wu, sizeOf(pr).hu, 1, metaOf(rows[pr]))
      : sample(type, o);
    const manyParts = readyIdx.length > 1;
    const lastPart = part >= readyIdx.length - 1;
    const doneLabel = flow.editing ? "Save" : `Add ${plural(readyCount, "size")}`;
    // the divider screens: which lines, how many panels, and the gap they leave
    const vertical = flow.step === "partBays";
    const grid = type === "partition" ? partitionLayout(shape) : null;
    const n = grid ? (vertical ? grid.bays : grid.glassRows) : 0;
    const gap = grid ? (vertical ? grid.cellW : grid.glassRowH) : 0;
    /** The length the panels share equally — what a panel count divides. */
    const span = grid ? toFeet(vertical ? grid.fieldW : grid.innerH - (grid.sheetH > 0 ? grid.sheetH + grid.face : 0)) : 0;
    /* A gap that does not divide the partition equally (3 ft on 10 ft) is
     * answered with the two equal splits either side of it, so the fabricator
     * picks the real one instead of being surprised by it. A gap set from a
     * panel count is already a split and needs no question. */
    const wantFt = parseFloat((vertical ? rows[pr]?.bay : rows[pr]?.row) ?? (vertical ? o.partBayFt : o.partRowFt)) || 0;
    const cellOf = (k: number) => (feet(span) - (k - 1) * (grid?.face ?? 0)) / k;
    const fromCount = Math.abs(span / Math.max(1, Math.round(span / (wantFt || 1))) - wantFt) < 0.001;
    let below = 1;
    while (grid && cellOf(below + 1) >= feet(wantFt) && below < 40) below++;
    const splits = grid && !fromCount && Math.abs(gap - feet(wantFt)) > 12700 && cellOf(below) >= feet(1)
      ? [below, below + 1].filter((k) => cellOf(k) >= feet(1))
      : [];

    return (
      <div className="flex flex-col gap-4">
        {/* header: back · title · progress */}
        <div className="flex items-center gap-3 py-1">
          <button onClick={back} aria-label="Back" className="btn-ghost grid h-10 w-10 shrink-0 place-items-center text-lg">←</button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold" style={{ color: "var(--ink-3)" }}>
              {/* what is being made is named once its questions are answered — before that it would name defaults */}
              {i >= steps.indexOf("size") ? liveLabel : flow.editing ? `Editing ${flow.editing}` : `New ${type}`} · {i + 1}/{steps.length}
            </div>
            <h1 className="truncate text-lg font-bold">{STEP_TITLE[flow.step]}</h1>
          </div>
          <button onClick={leave} className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>Cancel</button>
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
          <div className="grid grid-cols-2 gap-2">
            <Choice selected={o.domalFix === "no"} onClick={() => choose({ domalFix: "no" })} title="No"
              picture={<MiniElevation item={sample("window", { ...o, domalFix: "no" })} size={100} />} />
            <Choice selected={o.domalFix === "yes"} onClick={() => choose({ domalFix: "yes" })} title="Yes"
              picture={<MiniElevation item={sample("window", { ...o, domalFix: "yes" })} size={100} />} />
          </div>
        )}

        {flow.step === "zType" && (
          <div className="grid grid-cols-2 gap-2">
            {Z_TYPES.map(([v, label]) => (
              <Choice key={v} selected={o.zType === v} title={label} onClick={() => choose({ zType: v })}
                picture={<MiniElevation item={sample("window", { ...o, zType: v })} size={100} />} />
            ))}
          </div>
        )}

        {flow.step === "zDir" && (
          <div className="grid grid-cols-3 gap-2">
            {Z_DIRS.map(([v, label]) => (
              <Choice key={v} selected={o.zComboDir === v} onClick={() => choose({ zComboDir: v })} title={label}
                picture={<MiniElevation item={sample("window", { ...o, zComboDir: v })} size={80} />} />
            ))}
          </div>
        )}

        {flow.step === "zSash" && (
          <div className="grid grid-cols-3 gap-2">
            {Z_SASH.map(([v, label]) => (
              <Choice key={v} selected={o.zSash === v} onClick={() => choose({ zSash: v })} title={label}
                picture={<MiniElevation item={sample("window", { ...o, zSash: v })} size={80} />} />
            ))}
          </div>
        )}

        {flow.step === "zProfile" && (
          <div className="grid grid-cols-2 gap-2">
            {Z_SIZE.map(([v, label]) => (
              <Choice key={v} selected={o.zSize === v} onClick={() => choose({ zSize: v })} title={label}
                sub={v === "heavy" ? "For big windows" : "For normal windows"}
                picture={<SectionProfile sectionId={v === "heavy" ? "z_outer_55" : "z_outer_40"} w={72} h={56} />} />
            ))}
          </div>
        )}

        {flow.step === "doorSys" && (
          <div className="grid grid-cols-2 gap-2">
            <Choice selected={o.doorSys === "normal"} onClick={() => choose({ doorSys: "normal" })} title="Normal door"
              sub="Shutter + panels"
              picture={<MiniElevation item={sample("door", { ...o, doorSys: "normal" })} size={44} />} />
            <Choice selected={o.doorSys === "z"} onClick={() => choose({ doorSys: "z" })} title="Z-Section door"
              sub="Hinged, 40×55"
              picture={<MiniElevation item={sample("door", { ...o, doorSys: "z" })} size={44} />} />
          </div>
        )}

        {flow.step === "partSys" && (
          <div className="grid grid-cols-2 gap-2">
            <Choice selected={o.partSys === "spdp"} onClick={() => choose({ partSys: "spdp" })} title="SP / DP partition"
              sub="Partition pipe"
              picture={<SectionProfile sectionId="partition_frame" w={72} h={56} />} />
            <Choice selected={o.partSys === "z"} onClick={() => choose({ partSys: "z" })} title="Z-Section partition"
              sub="Z outer + center"
              picture={<SectionProfile sectionId="z_outer_40" w={72} h={56} />} />
          </div>
        )}

        {flow.step === "doorCenters" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-2">
              {DOOR_CENTERS.map(([v, label]) => (
                <Choice key={v} selected={o.doorCenters === v} onClick={() => choose({ doorCenters: v })} title={label}
                  picture={<MiniElevation item={sample("door", { ...o, doorCenters: v })} size={40} />} />
              ))}
              <Choice selected={parseInt(o.doorCenters, 10) > 3} title="Other"
                onClick={() => { if (!(parseInt(o.doorCenters, 10) > 3)) choose({ doorCenters: "4" }, false); }}
                picture={<MiniElevation item={sample("door", { ...o, doorCenters: parseInt(o.doorCenters, 10) > 3 ? o.doorCenters : "4" })} size={40} />} />
            </div>
            {parseInt(o.doorCenters, 10) > 3 && (
              <>
                <div className="card flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm font-semibold">Center rails</span>
                  <MiniQty value={parseInt(o.doorCenters, 10)} label="center rails"
                    onChange={(k) => choose({ doorCenters: String(Math.min(6, Math.max(1, k))) }, false)} />
                </div>
                <button onClick={() => go(steps[i + 1])} className="btn-primary w-full py-3.5">Next</button>
              </>
            )}
          </div>
        )}

        {flow.step === "doorFrame" && (
          <div className="grid grid-cols-2 gap-2">
            {CHOKHAT.map(([v, label]) => (
              <Choice key={v} selected={o.chokhat === v} onClick={() => choose({ chokhat: v })} title={label}
                sub={v === "needed" ? "New frame (chaukhat) and shutter" : "Frame is already fixed"}
                picture={<DoorScopePicture item={sample("door", o)} withFrame={v === "needed"} size={44} />} />
            ))}
          </div>
        )}

        {flow.step === "doorSection" && (
          <div className="grid grid-cols-3 gap-2">
            {PALLA.map(([v, label]) => (
              <Choice key={v} selected={o.palla === v} onClick={() => choose({ palla: v })} title={label} sub="mm"
                picture={<SectionProfile sectionId={`door_palla_${v}`} w={60} h={48} />} />
            ))}
          </div>
        )}

        {flow.step === "partDoor" && (
          <div className="grid grid-cols-2 gap-2">
            <Choice selected={o.partDoor === "no"} onClick={() => choose({ partDoor: "no" })} title="No door"
              picture={<MiniElevation item={sample("partition", { ...o, partDoor: "no" })} size={120} />} />
            <Choice selected={o.partDoor === "yes"} onClick={() => choose({ partDoor: "yes" })} title="With a door"
              picture={<MiniElevation item={sample("partition", { ...o, partDoor: "yes" })} size={120} />} />
          </div>
        )}

        {flow.step === "partDoorW" && (
          <div className="grid grid-cols-3 gap-2">
            {PART_DOOR_W.map(([v, label]) => (
              <Choice key={v} selected={o.partDoorW === v} onClick={() => choose({ partDoorW: v })} title={label}
                picture={<MiniElevation item={sample("partition", { ...o, partDoor: "yes", partDoorW: v })} size={90} />} />
            ))}
          </div>
        )}

        {(flow.step === "partBays" || flow.step === "partRows") && (
          <div className="flex flex-col gap-3">
            {/* the drawing stays at the top while the gap is typed or stepped */}
            <div className="sticky top-0 z-10 -mx-4 px-4 pb-1 pt-1" style={{ background: "var(--bg)" }}>
              <div className="card flex flex-col items-center gap-1.5 p-3">
                {manyParts && (
                  <div className="self-stretch text-sm font-bold tabnum">
                    Partition {part + 1} of {readyIdx.length}
                    <span className="font-semibold" style={{ color: "var(--ink-3)" }}>
                      {" "}· {formatFtIn(shape.width)} × {formatFtIn(shape.height)}{rows[pr].qty > 1 ? ` × ${rows[pr].qty}` : ""}
                    </span>
                  </div>
                )}
                <PartitionGapPicture item={shape} axis={vertical ? "v" : "h"} maxH={180} />
                <div className="text-center text-sm font-bold tabnum">
                  {n} equal panels {vertical ? "across" : "high"} · {formatFtIn(gap)} each
                </div>
              </div>
            </div>
            {splits.length > 0 && (
              <div className="card flex flex-col gap-2 p-3" style={{ background: "var(--warn-soft)" }}>
                <div className="text-xs font-semibold" style={{ color: "var(--warn)" }}>
                  {formatFtIn(feet(wantFt))} does not divide {formatFtIn(vertical ? shape.width : shape.height)} equally — choose:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {splits.map((k) => (
                    <button key={k} onClick={() => setGap(vertical ? "bay" : "row", String(Math.round((span / k) * 10000) / 10000))}
                      aria-pressed={n === k} className={`chip px-2 py-2 text-sm tabnum ${n === k ? "selected" : ""}`}>
                      {k} panels · {formatFtIn(cellOf(k))}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <GapPicker key={`${flow.step}-${part}`}
              options={vertical ? BAY_FT : ROW_FT}
              value={(vertical ? rows[pr]?.bay : rows[pr]?.row) ?? (vertical ? o.partBayFt : o.partRowFt)}
              max={toFeet(vertical ? shape.width : shape.height)}
              count={n} span={span}
              onChange={(v) => setGap(vertical ? "bay" : "row", v)}
            />
            {vertical ? (
              <button onClick={() => go("partRows")} className="btn-primary w-full py-3.5">Next — horizontal lines</button>
            ) : lastPart ? (
              <button onClick={() => finish()} className="btn-primary w-full py-3.5">{doneLabel}</button>
            ) : (
              <>
                <button onClick={nextPartition} className="btn-primary w-full py-3.5">
                  Next — partition {part + 2} of {readyIdx.length}
                </button>
                <button onClick={sameForRest} className="btn-ghost w-full py-3 text-sm">
                  Same lines for the rest — add all
                </button>
              </>
            )}
          </div>
        )}

        {flow.step === "size" && (
          <div className="flex flex-col gap-2.5">
            {rows.map((row, r) => {
              const p = parsed[r];
              const waiting = !flow.editing && p.empty && r === rows.length - 1 && r > 0;
              const keys: [BoxKey, string, string][] = [["w", "Width", "4.6"], ["h", "Height", "4"], ...(fixLabel ? [["fix", fixLabel, "1.6"] as [BoxKey, string, string]] : [])];
              return (
                <div key={r} className="card px-3 pb-2 pt-2.5" style={{ scrollMarginBottom: 110, scrollMarginTop: 80 }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-bold">
                      {flow.editing ?? `Size ${r + 1}`}
                      {p.ready && <span className="ml-1.5" style={{ color: "var(--good)" }}>✓</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold" style={{ color: "var(--ink-3)" }}>Qty</span>
                      <MiniQty value={row.qty} label={`size ${r + 1}`}
                        onChange={(q) => setRows((rs) => rs.map((x, k) => (k === r ? { ...x, qty: q } : x)))} />
                      {!flow.editing && !waiting && rows.length > 1 && (
                        <button onClick={() => removeLine(r)} aria-label={`Remove size ${r + 1}`}
                          className="grid h-8 w-7 place-items-center text-lg" style={{ color: "var(--ink-3)" }}>×</button>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {keys.map(([k, label, ph]) => (
                      <SizeInput key={k} label={label} value={row[k]} placeholder={r === 0 ? ph : ""}
                        bad={!!p.warn} last={!!flow.editing && k === keys[keys.length - 1][0]}
                        inputRef={(el) => { boxes.current[`${r}-${k}`] = el; }}
                        onChange={(v) => setBox(r, k, v)} onNext={() => focusNext(r, k)} />
                    ))}
                  </div>
                  <div className="mt-1 min-h-[18px] text-xs font-semibold tabnum"
                    style={{ color: p.warn ? "var(--bad)" : p.ready ? "var(--good)" : "var(--ink-3)" }}>
                    {p.warn ?? (p.ready
                      ? `${formatFtIn(p.wu!)} × ${formatFtIn(p.hu!)}${p.fu ? ` · ${fixLabel!.toLowerCase()} ${formatFtIn(p.fu)}` : ""}`
                      : r === 0 && p.empty ? "4.6 = 4 ft 6 in" : "")}
                  </div>
                </div>
              );
            })}
            {flow.editing && (
              <button onClick={() => { onRemove(flow.editing!); closeFlow(); }}
                className="py-2 text-sm font-semibold" style={{ color: "var(--bad)" }}>
                Remove {flow.editing}
              </button>
            )}
            {/* room for the button, which sits over the bottom of the screen */}
            <div aria-hidden style={{ height: 76 }} />

            <div className="fixed inset-x-0 bottom-0 z-20 border-t px-4 pt-2.5"
              style={{ background: "var(--surface)", borderColor: "var(--line)", paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>
              <div className="mx-auto max-w-xl">
                <button onClick={sizesDone} disabled={!allReady} className="btn-dark w-full py-3.5 text-base disabled:opacity-40">
                  {afterSize.length ? `Next — ${plural(readyCount, "partition")} →` : `${doneLabel} →`}
                </button>
              </div>
            </div>
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
      <div className="flex items-center justify-between gap-2 py-1">
        <div className="min-w-0">
          <div className="text-xl font-extrabold tracking-tight">
            Fabri<span style={{ color: "var(--accent)" }}>Q</span>
          </div>
          <div className="truncate text-xs" style={{ color: "var(--ink-3)" }}>
            {shopName || "Material list & cutting sheet"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <InstallButton />
          <button onClick={onSettings} className="btn-ghost px-3 py-2 text-sm">Settings</button>
        </div>
      </div>

      {items.length === 0 ? (
        /* first screen: what are you making — tap one to start */
        <div className="card flex flex-col gap-4 p-4">
          <h1 className="text-xl font-bold">What are you making?</h1>
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
            {items.map((it) => {
              const fresh = justAdded.includes(it.id);
              return (
                <div key={it.id} id={`item-${it.id}`} className="flex items-center gap-2 pl-2 pr-2 transition-colors"
                  style={{ borderTop: "1px solid var(--line)", background: fresh ? "var(--good-soft)" : undefined }}>
                  <button onClick={() => startEdit(it)} aria-label={`Edit ${it.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left">
                    <span className="grid w-12 shrink-0 place-items-center">
                      <MiniElevation item={it} size={it.type === "door" ? 22 : 44} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold tabnum">
                        <span className="mono mr-1.5 text-xs" style={{ color: "var(--ink-3)" }}>{it.id}</span>
                        {openingText(it)}{it.qty > 1 && <span style={{ color: "var(--accent)" }}> × {it.qty}</span>}
                        {fresh && <span className="ml-2 text-xs font-bold" style={{ color: "var(--good)" }}>✓ Added</span>}
                      </span>
                      <span className="block truncate text-xs" style={{ color: "var(--ink-3)" }}>{itemLabel(it)}</span>
                    </span>
                  </button>
                  <button onClick={() => onRemove(it.id)} aria-label={`Remove ${it.id}`}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
                    style={{ color: "var(--ink-3)" }}>×</button>
                </div>
              );
            })}
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

/**
 * The gap between partition dividers: the usual ones as one tap, or any
 * other gap — typed (2.9 = 2'9") or stepped an inch at a time — or simply
 * the number of panels. The drawing above stays in view throughout.
 */
function GapPicker({ options, value, max, count, span, onChange }: {
  options: Opt[]; value: string; max: number; count: number; span: number; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const ftNow = parseFloat(value) || 3;
  const valid = (f: number) => f >= 1 && f <= max;
  const put = (f: number) => onChange(String(Math.round(f * 10000) / 10000));
  const stepGap = (d: number) => {
    const f = (Math.round(ftNow * 12) + d) / 12;
    if (!valid(f)) return;
    setTxt(formatTradeSize(feet(f)));
    put(f);
  };
  const typed = parseTradeSize(txt, 26);
  const err = !txt.trim() ? null : typed === null ? "4.6 means 4 ft 6 in" : !valid(toFeet(typed)) ? `Between 1 ft and ${formatFtIn(feet(max))}` : null;
  /** Many shops think in panels ("4 khane"), not gaps: the gap that gives exactly k. */
  const setCount = (k: number) => {
    const f = span / k;
    if (k < 1 || f < 1) return;
    setOpen(false);
    put(f);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(([v, label]) => (
          <button key={v} onClick={() => { setOpen(false); onChange(v); }} aria-pressed={!open && value === v}
            className={`chip min-h-[48px] px-2 py-2 text-base ${!open && value === v ? "selected" : ""}`}>
            {label}
          </button>
        ))}
        <button onClick={() => { setOpen(true); setTxt(formatTradeSize(feet(Math.round(ftNow * 12) / 12))); }} aria-pressed={open}
          className={`chip min-h-[48px] px-2 py-2 text-base ${open ? "selected" : ""}`}>
          Other gap
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1">
          <div className="flex items-stretch gap-2">
            <button onClick={() => stepGap(-1)} aria-label="One inch less" className="btn-ghost w-14 shrink-0 text-base">−1&quot;</button>
            <label className="dim-input flex min-w-0 flex-1 flex-col px-3 pb-1 pt-1.5 focus-within:border-[color:var(--accent)]"
              style={err ? { borderColor: "var(--bad)" } : undefined}>
              <span className="text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>Gap</span>
              <input value={txt} inputMode="decimal" enterKeyHint="done" aria-label="Gap" autoComplete="off"
                onChange={(e) => {
                  const t = e.target.value.replace(/[^\d.'"\- ]/g, "").slice(0, 8);
                  setTxt(t);
                  const um = parseTradeSize(t, 26);
                  if (um !== null && valid(toFeet(um))) put(toFeet(um));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-full min-w-0 bg-transparent text-2xl font-semibold tabnum outline-none" />
            </label>
            <button onClick={() => stepGap(1)} aria-label="One inch more" className="btn-ghost w-14 shrink-0 text-base">+1&quot;</button>
          </div>
          <div className="min-h-[16px] text-xs font-semibold" style={{ color: err ? "var(--bad)" : "var(--ink-3)" }}>
            {err ?? (typed !== null ? `= ${formatFtIn(typed)}` : "4.6 = 4 ft 6 in")}
          </div>
        </div>
      )}
      <div className="card flex items-center justify-between gap-3 px-3 py-2">
        <span className="text-sm font-semibold">Panels</span>
        <MiniQty value={count} label="panels" onChange={setCount} />
      </div>
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

/** One size box on the phone's own number keyboard, its name inside the box. */
function SizeInput({ label, value, placeholder, bad, last, inputRef, onChange, onNext }: {
  label: string; value: string; placeholder?: string; bad?: boolean; last?: boolean;
  inputRef: (el: HTMLInputElement | null) => void; onChange: (v: string) => void; onNext: () => void;
}) {
  return (
    <label className="dim-input flex min-w-0 flex-1 flex-col px-3 pb-1 pt-1.5 focus-within:border-[color:var(--accent)]"
      style={bad ? { borderColor: "var(--bad)" } : undefined}>
      <span className="text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>{label}</span>
      <input ref={inputRef} value={value} placeholder={placeholder} aria-label={label}
        type="text" inputMode="decimal" enterKeyHint={last ? "done" : "next"} autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onNext(); } }}
        className="w-full min-w-0 bg-transparent text-2xl font-semibold tabnum outline-none placeholder:font-normal placeholder:text-[#c2c7cf]" />
    </label>
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

/** Pipes as the dealer counts them: a half pipe is ½, not one more pipe —
 *  1 × 16' + 1 × 8' is "1½", where adding bars up said "2". */
function pipeCount(full: number, half: number): string {
  const whole = full + Math.floor(half / 2);
  if (half % 2 === 0) return String(whole);
  return whole ? `${whole}½` : "½";
}
const pipeWord = (full: number, half: number) => (full * 2 + half > 2 ? "pipes" : "pipe");
const groupsCount = (groups: BarGroup[]) =>
  pipeCount(groups.reduce((a, g) => a + g.full, 0), groups.reduce((a, g) => a + g.half, 0));
const groupsWord = (groups: BarGroup[]) =>
  pipeWord(groups.reduce((a, g) => a + g.full, 0), groups.reduce((a, g) => a + g.half, 0));

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
  const total = groupsCount(groups);
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
            totalLabel="Total pipes" totalValue={`${groupsText(groups)} (${total} ${groupsWord(groups)})`} />
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
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{groupsWord(groups)}</div>
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
              <div className="w-14 shrink-0 text-right text-2xl font-extrabold tabnum">{pipeCount(s.bars16, s.bars8)}</div>
            </div>
          );
        })}
      </div>

      <GlassBlock list={list} />

      {/* aluminium dealer and glass shop are different people — two sends */}
      <SendOrder
        label="Send to aluminium supplier"
        sub={`${plural(list.sections.length, "section")} · ${total} ${groupsWord(groups)}`}
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
          <MiniStat label="Pipes" value={groupsCount(groups)} />
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
                <div className="text-sm font-bold tabnum">{pipeCount(full, half)} {pipeWord(full, half)}</div>
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
  const groups = barGroups(list.sections);
  L.push("", `*Total: ${groupsText(groups)}* (${groupsCount(groups)} ${groupsWord(groups)})`);
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
