"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import {
  parseDimension, formatFtInSut, Um, toFeet, sqft, UM_PER_INCH, UM_PER_SUT,
} from "@/lib/engine/units";
import {
  generateQuestions, mixToShutters, doorMixToZones, partitionMixToZones, zMixToSashes, type Question,
} from "@/lib/engine/questions";
import { estimate } from "@/lib/engine/estimator";
import { getSection, SECTIONS } from "@/lib/engine/sections";
import { costJob, inr, type JobCost } from "@/lib/engine/pricing";
import { findOffcuts, loadOffcuts, addOffcuts, removeOffcut, totalOffcutFt, type Offcut, type OffcutCandidate } from "@/lib/engine/offcuts";
import { planOffcutUse, EMPTY_PLAN, type OffcutPlan } from "@/lib/offcut-plan";
import { buildOrderPdf, sharePdfToWhatsApp, type PdfBlock } from "@/lib/pdf";
import {
  loadProjects, saveProject, patchProject, removeProject, newProjectId, autoTitle, totalSqft,
  type ProjectRec,
} from "@/lib/projects";
import type {
  JobItem, MaterialList, OpeningType, SystemId, PackedBar, CutPiece,
} from "@/lib/engine/types";
import { WindowDiagram, TrackDiagram, CuttingGuide, PartitionDiagram, PartitionBayDiagram, PartitionRowDiagram, MiniElevation } from "@/components/diagrams";
import { SectionProfile, SectionDrawing } from "@/components/section-profiles";
import { EngineeringSheet } from "@/components/eng-sheet";
import { VoiceButton } from "@/components/voice";
import { Copilot } from "@/components/copilot";
import { QuoteDoc, type QuoteLine, type ShopProfile } from "@/components/quotation";
import {
  Camera, Pencil, Settings, Sun, Moon, Layers, Cube, Scissors, FileText,
  Rupee, TrendDown, Clock, Folder, ArrowRight, Store, Scan, User, Phone,
  Building, MapPin, Check, Bolt,
} from "@/components/icons";
import * as Ic from "@/components/icons";
import {
  PhotoCapture, ExtractReview, normalizeRaw, downscale, type ExtractedItem,
} from "@/components/photo";
import { mm } from "@/lib/engine/units";

import type { Finish, GlassKind } from "@/components/window3d";

// WebGL configurator — client-only, lazy-loaded so it never blocks first paint.
const Window3D = dynamic(() => import("@/components/window3d"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[360px] place-items-center rounded-2xl text-sm"
      style={{ border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink-3)" }}>
      Loading 3D preview…
    </div>
  ),
});
const Window3DThumb = dynamic(() => import("@/components/window3d").then((m) => ({ default: m.Window3DThumb })), {
  ssr: false,
  loading: () => <div className="grid place-items-center rounded-xl text-[10px]"
    style={{ width: 150, height: 150, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--ink-3)" }}>3D…</div>,
});
const CustomerShowcase = dynamic(() => import("@/components/window3d").then((m) => ({ default: m.CustomerShowcase })), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 grid place-items-center text-sm"
      style={{ background: "#0e1116", color: "rgba(255,255,255,.6)" }}>3D taiyar ho raha hai…</div>
  ),
});

const FINISH_OPTS: [Finish, string, string][] = [
  ["black", "Matte Black", "#1c1c1e"], ["white", "Ivory White", "#eef0f2"],
  ["champagne", "Champagne", "#c9a86a"], ["wood", "Wood Grain", "#7a5230"],
];
const GLASS_OPTS: [GlassKind, string, string][] = [
  ["clear", "Clear", "#cfe6f2"], ["frosted", "Frosted", "#e6edf0"], ["tinted", "Tinted", "#5b7a72"],
];

/* ————————————————— types ————————————————— */

type Step = "home" | "entry" | "questions" | "addmore" | "result" | "extract" | "offcutbank";

interface Draft {
  type: OpeningType;
  widthRaw: string;
  heightRaw: string;
  qty: number;
}

const EMPTY_DRAFT: Draft = { type: "window", widthRaw: "", heightRaw: "", qty: 1 };

/**
 * Turn a photo-extracted row into a `known` map for the question engine, so it
 * only asks what the photo did NOT capture. System is seeded only when the
 * sketch clearly indicated it; otherwise it stays unset and gets asked.
 */
function seedFromRow(row: ExtractedItem): Record<string, string> {
  const k: Record<string, string> = {};
  if (row.type === "window") {
    const sys = (row.system ?? "").toLowerCase();
    if (/domal|doomal/.test(sys)) k.system = "domal";
    else if (/z[\s-]?section|z\b/.test(sys)) k.system = "z_section";
    else if (/normal|18|bombay|sliding/.test(sys)) k.system = "normal";
    if (row.tracks === "2" || row.tracks === "3" || row.tracks === "4") k.tracks = row.tracks;
    if (row.mix && /^[GJS]+$/i.test(row.mix)) k.mix = row.mix.toUpperCase();
  }
  return k;
}

/* ————————————————— theme ————————————————— */

type Theme = "light" | "dark" | "system";
function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

/* ————————————————— page ————————————————— */

export default function FabriQ() {
  const [step, setStep] = useState<Step>("home");
  const [items, setItems] = useState<JobItem[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQs, setLoadingQs] = useState(false);
  const [qSource, setQSource] = useState<string>("rules");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  // Photo flow: extracted rows are processed one-by-one through the SAME
  // question engine (seeded with what the photo already gave, so only the
  // MISSING info is asked). photoQueue holds the rows still to process.
  const [photoQueue, setPhotoQueue] = useState<ExtractedItem[]>([]);
  const [theme, setThemeState] = useState<Theme>("system");
  const [intent, setIntent] = useState<"list" | "quote">("list");
  const [shop, setShop] = useState<ShopProfile>({ name: "" });
  const [loaded, setLoaded] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  /** id of the saved project this session is editing. A ref, not state: it must
   *  be readable synchronously when a job is built, before Result mounts. */
  const projectId = useRef<string | null>(null);
  const ensureProject = () => (projectId.current ??= newProjectId());

  useEffect(() => {
    setApiKey(localStorage.getItem("fabriq_api_key"));
    // Premium: dark is the default look; users can still switch to light.
    const t = (localStorage.getItem("fabriq_theme") as Theme | null) ?? "dark";
    applyTheme(t); setThemeState(t);
    try { const s = JSON.parse(localStorage.getItem("fabriq_shop") || "{}"); if (s && s.name) setShop(s); } catch { /* ignore */ }
    setOnboarded(localStorage.getItem("fabriq_onboarded") === "1");
    setLoaded(true);
  }, []);

  const setTheme = (t: Theme) => {
    applyTheme(t); setThemeState(t);
    try { if (t === "system") localStorage.removeItem("fabriq_theme"); else localStorage.setItem("fabriq_theme", t); } catch { /* ignore */ }
  };
  const toggleTheme = () => {
    const eff = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    setTheme(eff === "dark" ? "light" : "dark");
  };
  const saveShop = (s: ShopProfile) => {
    setShop(s);
    try { localStorage.setItem("fabriq_shop", JSON.stringify(s)); localStorage.setItem("fabriq_onboarded", "1"); } catch { /* ignore */ }
    setOnboarded(true);
  };

  const saveKey = (k: string) => {
    const v = k.trim();
    if (v) {
      localStorage.setItem("fabriq_api_key", v);
      setApiKey(v);
    } else {
      localStorage.removeItem("fabriq_api_key");
      setApiKey(null);
    }
    setShowSettings(false);
  };

  const width = parseDimension(draft.widthRaw);
  const height = parseDimension(draft.heightRaw);

  /* —— shared: generate questions (rules now, AI if a key is set) —— */
  const generateAndSet = useCallback(async (
    type: OpeningType, w: Um, h: Um, qty: number, known: Record<string, string>,
  ) => {
    setLoadingQs(true);
    setStep("questions");
    setQIndex(0);
    const local = generateQuestions({ type, width: w, height: h, qty, known });
    setQuestions(local);
    setQSource("rules");
    try {
      const r = await fetch("/api/ai/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, width: w, height: h, qty, known, apiKey }),
      });
      const data = await r.json();
      if (data.source === "ai" && data.questions?.length) {
        setQuestions(data.questions);
        setQSource("ai");
      }
    } catch { /* rules already shown */ }
    setLoadingQs(false);
  }, [apiKey]);

  /* —— photo: process one extracted row through the question flow —— */
  const startPhotoItem = useCallback((row: ExtractedItem, rest: ExtractedItem[]) => {
    const wRaw = normalizeRaw(row.width_raw, row.unit_guess);
    const hRaw = normalizeRaw(row.height_raw, row.unit_guess);
    const w = parseDimension(wRaw);
    const h = parseDimension(hRaw);
    setPhotoQueue(rest);
    setDraft({ type: row.type, widthRaw: wRaw, heightRaw: hRaw, qty: row.qty });
    const known = seedFromRow(row);
    // seed answers so the finalize step reuses the photo data and only the
    // MISSING questions are asked
    setAnswers({ source: "photo", notes: row.notes ?? "", ...known });
    if (w && h) generateAndSet(row.type, w, h, row.qty, known);
  }, [generateAndSet]);

  /* —— photo extract → run each row through questions (only missing asked) —— */
  const confirmExtracted = useCallback((rows: ExtractedItem[]) => {
    const valid = rows.filter((r) =>
      parseDimension(normalizeRaw(r.width_raw, r.unit_guess)) &&
      parseDimension(normalizeRaw(r.height_raw, r.unit_guess)));
    if (valid.length === 0) { setStep("addmore"); return; }
    const [first, ...rest] = valid;
    startPhotoItem(first, rest);
  }, [startPhotoItem]);

  /* —— answer a question —— */
  const answer = useCallback((qid: string, value: string) => {
    const next = { ...answers, [qid]: value };
    setAnswers(next);

    // Rule-based flow is adaptive — regenerate remaining questions with the
    // growing `known` so a system answer (e.g. Domal) changes what's asked
    // next. AI-sourced batches are left as-is (already situation-aware).
    if (qSource !== "ai" && width && height) {
      const remaining = generateQuestions({
        type: draft.type, width, height, qty: draft.qty, known: next,
      });
      if (remaining.length > 0) {
        setQuestions([...questions.slice(0, qIndex + 1), ...remaining]);
        setQIndex(qIndex + 1);
        return;
      }
    } else if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
      return;
    }

    {
      // build the item
      let sys: SystemId;
      let shutters: JobItem["shutters"];
      if (draft.type === "door") {
        sys = "door_single";
        const rails = next.rails ?? "2";
        const zonemix = next.zonemix ?? (rails === "3" ? "SSSJ" : "SSJ");
        shutters = doorMixToZones(zonemix);
      } else if (draft.type === "partition") {
        // Partition layout is derived in the engine from meta (partDoor,
        // partDoorW, partSheetFt, partBayFt) — no shutter list needed.
        // partSheetFt is no longer asked → default to full glass ("0").
        sys = "partition";
        next.partSheetFt = next.partSheetFt ?? "0";
        shutters = [];
      } else if (next.system === "z_section") {
        // Z-section: glass-only. zType picks the layout; translate it into the
        // zDoor + zLayout meta flags the engine reads, then build the sashes
        // (all glass — no jali/sheet in this system).
        sys = "z_section";
        const zType = next.zType ?? "openable";
        next.zDoor = zType === "door" ? "yes" : "no";
        next.zLayout = zType === "fixed" ? "fixed" : zType === "combo" ? "combo" : "openable";
        const n = zType === "fixed" || zType === "door"
          ? 1
          : Math.max(1, parseInt(next.zSashCount ?? "1", 10));
        shutters = Array.from({ length: n }, () => ({ kind: "glass" as const }));
      } else {
        sys = next.system === "domal" ? "domal"
          : (next.tracks ?? "2") === "3" ? "normal_3t" : "normal_2t";
        next.handle = next.handle ?? "std"; // handle no longer asked → default
        const mix =
          next.mix ??
          ((next.tracks ?? "2") === "4" ? "GGGJ" : (next.tracks ?? "2") === "3" ? "GGJ" : "GG");
        shutters = mixToShutters(mix);
      }
      const item: JobItem = {
        id: `W${items.length + 1}`,
        type: draft.type,
        width: width!,
        height: height!,
        qty: draft.qty,
        system: sys,
        shutters,
        meta: next,
      };
      ensureProject();
      setItems((prev) => [...prev, item]);
      // If we're mid photo-batch, move on to the next extracted row's questions
      // (only its MISSING info); otherwise land on the add-more screen.
      if (photoQueue.length > 0) {
        const [nextRow, ...rest] = photoQueue;
        startPhotoItem(nextRow, rest);
      } else {
        setStep("addmore");
      }
    }
  }, [answers, qIndex, questions, items, draft, width, height, qSource, photoQueue, startPhotoItem]);

  /* —— autosave: every job the fabricator builds survives a refresh ——
     Writes localStorage only (no setState), so it is safe inside an effect and
     catches all three entry paths: wizard, questions and photo batch. */
  useEffect(() => {
    if (items.length === 0) return;
    const id = projectId.current;
    if (!id) return;
    const prev = loadProjects().find((p) => p.id === id);
    saveProject({
      id,
      title: prev?.title || autoTitle(items),
      created: prev?.created ?? Date.now(),
      updated: Date.now(),
      items,
      sqft: totalSqft(items),
      // Preserve figures the result screen reported; never reset them to 0.
      scrapPct: prev?.scrapPct ?? 0,
      amount: prev?.amount ?? 0,
      customer: prev?.customer,
    });
  }, [items]);

  /** Result reports the real scrap / quote numbers as they are computed. */
  const onSnapshot = useCallback((s: { scrapPct?: number; amount?: number; customer?: string }) => {
    const id = projectId.current;
    if (id) patchProject(id, s);
  }, []);

  const openProject = (p: ProjectRec) => {
    projectId.current = p.id;
    setItems(p.items);
    setIntent(p.amount > 0 ? "quote" : "list");
    setStep("result");
  };

  const reset = () => {
    projectId.current = null;
    setItems([]); setDraft(EMPTY_DRAFT); setAnswers({}); setQuestions([]);
    setQIndex(0); setStep("home");
  };

  // First-run onboarding gate (skippable). Avoid a flash for returning users.
  if (!loaded) return <main className="mx-auto w-full max-w-2xl flex-1" />;
  if (!shop.name && !onboarded) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-6 flex-1">
        <Onboarding
          apiKey={apiKey} onNeedKey={() => setShowSettings(true)}
          onDone={saveShop}
          onSkip={() => { try { localStorage.setItem("fabriq_onboarded", "1"); } catch { /* ignore */ } setOnboarded(true); }}
        />
        {showSettings && <SettingsModal current={apiKey} onSave={saveKey} onClose={() => setShowSettings(false)} />}
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6 flex-1">
      {step === "home" && (
        <Home
          shop={shop} theme={theme} onToggleTheme={toggleTheme}
          onStart={() => { setIntent("list"); setStep("entry"); }}
          onStartQuote={() => { setIntent("quote"); setStep("entry"); }}
          onOffcutBank={() => setStep("offcutbank")}
          apiKey={apiKey}
          onOpenSettings={() => setShowSettings(true)}
          onExtracted={(rows) => { setExtracted(rows); setStep("extract"); }}
          onOpenProject={openProject}
        />
      )}
      {step === "offcutbank" && <OffcutBank onBack={() => setStep("home")} />}
      {step === "extract" && (
        <div className="fade-up flex flex-col gap-4">
          <Header title="AI ne yeh padha" sub="Check karo aur confirm karo" onBack={() => setStep("home")} />
          <ExtractReview
            items={extracted}
            onConfirm={confirmExtracted}
            onCancel={() => setStep("entry")}
          />
        </div>
      )}
      {showSettings && (
        <SettingsModal current={apiKey} onSave={saveKey} onClose={() => setShowSettings(false)} />
      )}
      {step === "entry" && (
        <Entry
          startId={items.length}
          onBuild={(built) => { ensureProject(); setItems((prev) => [...prev, ...built]); setStep("result"); }}
          onBack={() => setStep(items.length ? "addmore" : "home")}
        />
      )}
      {step === "questions" && (
        <Questions
          questions={questions} qIndex={qIndex} answers={answers}
          loading={loadingQs} source={qSource}
          draft={draft} width={width} height={height}
          onAnswer={answer}
          onBack={() => (qIndex > 0 ? setQIndex(qIndex - 1) : setStep("entry"))}
        />
      )}
      {step === "addmore" && (
        <AddMore
          items={items}
          onAdd={() => { setDraft(EMPTY_DRAFT); setStep("entry"); }}
          onDone={() => setStep("result")}
          onRemove={(id) => setItems((p) => p.filter((x) => x.id !== id))}
        />
      )}
      {step === "result" && (
        <Result items={items} onNew={reset} apiKey={apiKey}
          initialTab={intent === "quote" ? "quote" : "aluminium"} onSnapshot={onSnapshot} />
      )}
      <Copilot />
    </main>
  );
}

/* ————————————————— ONBOARDING (first run) ————————————————— */

function Onboarding({
  apiKey, onNeedKey, onDone, onSkip,
}: {
  apiKey: string | null;
  onNeedKey: () => void;
  onDone: (shop: ShopProfile) => void;
  onSkip: () => void;
}) {
  const [s, setS] = useState<ShopProfile>({ name: "" });
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const cardRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof ShopProfile, v: string) => setS((p) => ({ ...p, [k]: v }));

  // No client-side gate here either — the server may carry its own key.
  const pickCard = () => cardRef.current?.click();

  const onCard = async (f: File | undefined) => {
    if (!f) return;
    setScanNote(null); setScanning(true);
    try {
      const { data, mediaType } = await downscale(f);
      const r = await fetch("/api/ai/read-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType, apiKey }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setScanNote(d.message || "Card padhne mein dikkat aayi — haath se bhar do.");
        if (d.error === "no_key") onNeedKey();
      } else {
        setS((p) => ({
          name: d.name || p.name,
          phone: d.mobile || p.phone,
          address: d.address || p.address,
          gstin: d.gstin || p.gstin,
          tagline: d.tagline || p.tagline,
        }));
        setScanNote("✓ Card se bhar diya — check karke aage badho.");
      }
    } catch {
      setScanNote("Network problem — dobara try karo.");
    }
    setScanning(false);
  };

  const field = (
    k: keyof ShopProfile, label: string, ph: string,
    icon: React.ReactNode, req = false,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>
        {label}{req && <span style={{ color: "var(--accent)" }}> *</span>}
      </span>
      <span className="field flex items-center gap-2 px-3">
        <span style={{ color: "var(--ink-3)" }}>{icon}</span>
        <input
          value={(s[k] as string) || ""}
          onChange={(e) => set(k, e.target.value)}
          placeholder={ph}
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </span>
    </label>
  );

  return (
    <div className="fade-up flex flex-col gap-5">
      {/* brand */}
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(180deg,var(--accent-2),var(--accent))", boxShadow: "var(--shadow-accent)" }}>
          <Ic.Bolt size={26} />
        </span>
        <div>
          <div className="display text-2xl font-extrabold">Fabricator OS</div>
          <p className="mt-0.5 text-sm" style={{ color: "var(--ink-2)" }}>
            Apni shop set karo — quotation par yahi brand chhpega.
          </p>
        </div>
      </div>

      {/* scan card shortcut */}
      <div className="card flex flex-col gap-3 p-4"
        style={{ background: "linear-gradient(180deg,var(--surface),var(--surface-2))" }}>
        <input ref={cardRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => onCard(e.target.files?.[0])} />
        <button onClick={pickCard} disabled={scanning}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60">
          <Ic.Scan size={18} /> {scanning ? "Card padh raha hoon…" : "Snap Visiting Card"}
        </button>
        <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
          Card ki photo se naam, number, address, GST — sab auto-fill.
        </p>
        {scanNote && (
          <div className="rounded-lg px-3 py-2 text-[12px]"
            style={{ background: "var(--accent-soft)", color: "var(--ink-2)" }}>{scanNote}</div>
        )}
      </div>

      {/* fields */}
      <div className="card flex flex-col gap-3 p-4">
        {field("name", "Shop / Business Name", "e.g. Al-Noor Aluminium", <Ic.Store size={16} />, true)}
        {field("phone", "Mobile", "e.g. 98765 43210", <Ic.Phone size={16} />)}
        {field("address", "Address", "Shop address (quotation par aayega)", <Ic.MapPin size={16} />)}
        {field("gstin", "GSTIN", "Optional — 22AAAAA0000A1Z5", <Ic.Building size={16} />)}
        {field("tagline", "Tagline", "Optional — e.g. Since 2009", <Ic.Sparkle size={16} />)}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => onDone(s)}
          disabled={!s.name.trim()}
          className="btn-dark flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-40">
          <Ic.Check size={18} /> Enter Workshop OS
        </button>
        <button onClick={onSkip} className="btn-ghost w-full py-2.5 text-sm">
          Abhi skip karo
        </button>
      </div>
    </div>
  );
}

/* ————————————————— DASHBOARD (home) ————————————————— */


/** "12 min pehle" / "kal" / "12 Aug" — a fabricator reads recency, not dates. */
function timeAgo(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "abhi";
  if (min < 60) return `${min} min pehle`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ghante pehle`;
  if (hr < 48) return "kal";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function StageChip({ done, label }: { done?: boolean; label: string }) {
  return (
    <span className="badge" style={{
      background: done ? "var(--good-soft)" : "var(--surface-2)",
      color: done ? "var(--good)" : "var(--ink-3)",
    }}>
      {done ? "● " : "○ "}{label}
    </span>
  );
}

/* ————————————————— OFFCUT BANK (standalone) ————————————————— */

function OffcutBank({ onBack }: { onBack: () => void }) {
  const [bank, setBank] = useState<Offcut[]>([]);
  const [secId, setSecId] = useState<string>("2t_top");
  const [lenRaw, setLenRaw] = useState("");
  useEffect(() => { setBank(loadOffcuts()); }, []);

  const len = parseDimension(lenRaw);
  const add = () => {
    if (!len || len <= 0) return;
    setBank(addOffcuts([{ key: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sectionId: secId, length: len, barNo: 0 }], "Manual"));
    setLenRaw("");
  };
  const groups = useMemo(() => {
    const m = new Map<string, Offcut[]>();
    for (const o of bank) { const a = m.get(o.sectionId) ?? []; a.push(o); m.set(o.sectionId, a); }
    return [...m.entries()];
  }, [bank]);
  const totalFt = totalOffcutFt(bank);

  return (
    <div className="fade-up flex flex-col gap-5">
      <Header title="♻️ Offcut Bank" sub="Pade hue tukde — agli material list me apne aap lag jayenge" onBack={onBack} />

      <div className="card flex items-center justify-between p-4" style={{ background: "var(--good-soft)" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--good)" }}>Total bachat stock</div>
          <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{bank.length} pieces jama</div>
        </div>
        <div className="display text-3xl font-extrabold tabnum" style={{ color: "var(--good)" }}>{totalFt.toFixed(1)}&apos;</div>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        <Label>Naya leftover tukda jodo</Label>
        <select value={secId} onChange={(e) => setSecId(e.target.value)} className="dim-input px-3 py-2.5 text-sm">
          {Object.values(SECTIONS).map((s) => <option key={s.id} value={s.id}>{s.label} · {s.size}mm</option>)}
        </select>
        <div className="flex gap-2">
          <input value={lenRaw} onChange={(e) => setLenRaw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={`Length — 3  ·  3'6"`} className="dim-input flex-1 px-3 py-2.5" />
          <button onClick={add} disabled={!len} className="btn-primary px-6 disabled:opacity-40">Jodo</button>
        </div>
        {lenRaw && <Parsed um={len} raw={lenRaw} />}
      </div>

      {groups.length === 0 ? (
        <div className="card p-6 text-center text-sm" style={{ color: "var(--ink-3)" }}>
          Abhi bank khaali hai. Upar se tukde jodo — ya kisi job ke baad ♻️ Offcuts tab se save karo.
        </div>
      ) : groups.map(([sid, olist]) => {
        const sec = getSection(sid);
        return (
          <div key={sid} className="card p-3.5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="rounded-md p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}><SectionProfile sectionId={sid} /></span>
              <div><div className="text-sm font-bold">{sec.label}</div><div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{sec.size}mm · {olist.length} pieces</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {olist.map((o) => (
                <span key={o.id} className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold tabnum" style={{ background: "var(--surface-2)" }}>
                  {formatFtInSut(o.length)}
                  <button onClick={() => setBank(removeOffcut(o.id))} className="opacity-50 hover:opacity-100" title="Hatao">✕</button>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Home({
  shop, theme, onToggleTheme, onStart, onStartQuote, onOffcutBank, apiKey, onOpenSettings, onExtracted,
  onOpenProject,
}: {
  shop: ShopProfile; theme: Theme; onToggleTheme: () => void;
  onStart: () => void; onStartQuote: () => void; onOffcutBank: () => void; apiKey: string | null;
  onOpenSettings: () => void; onExtracted: (rows: ExtractedItem[]) => void;
  onOpenProject: (p: ProjectRec) => void;
}) {
  const [projects, setProjects] = useState<ProjectRec[]>([]);
  useEffect(() => { setProjects(loadProjects()); }, []);
  const nProjects = projects.length;
  const timeSavedHrs = (nProjects * 14) / 60;
  // Only average jobs that actually reported a figure, so one un-opened job
  // cannot drag the average to zero.
  const scrapJobs = projects.filter((p) => p.scrapPct > 0);
  const avgScrap = scrapJobs.length ? scrapJobs.reduce((a, p) => a + p.scrapPct, 0) / scrapJobs.length : 0;
  const valueQuoted = projects.reduce((a, p) => a + (p.amount || 0), 0);

  const dark = theme === "dark" || (theme === "system" &&
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const bank = useMemo(() => loadOffcuts(), []);
  const bankFt = totalOffcutFt(bank);

  // Every tile is a measured number from this shop's own jobs. No assumed
  // baselines, no projections — a dash until we have actually earned the figure.
  const stats: [React.ReactNode, string, string, string][] = [
    [<Ic.TrendDown size={18} key="a" />, "Avg Scrap", avgScrap > 0 ? `${avgScrap.toFixed(0)}%` : "—", "aapke apne jobs par"],
    [<Ic.Clock size={18} key="b" />, "Time Saved", nProjects ? `${timeSavedHrs.toFixed(1)}h` : "—", "≈14 min / job"],
    [<Ic.Rupee size={18} key="c" />, "Value Quoted", valueQuoted > 0 ? `₹${Math.round(valueQuoted / 1000)}k` : "—", "all quotations"],
    [<Ic.Folder size={18} key="d" />, "Projects", `${nProjects}`, "lifetime"],
  ];

  // Every card below must describe something that actually ships today.
  const features: [React.ReactNode, string, string][] = [
    [<Ic.Layers size={20} key="1" />, "Instant Material List", "Sizes → kitni pipe, glass aur jali — seconds me"],
    [<Ic.Scissors size={20} key="2" />, "Workshop Cutting Sheets", "Cut lengths + engineering drawings, ek hi sheet"],
    [<Ic.FileText size={20} key="3" />, "Supplier Catalogue", "Har pipe ka naam + cross-section, WhatsApp-ready"],
    [<Ic.Cube size={20} key="4" />, "Live 3D Configurator", "Customer ko colour aur glass live dikhao"],
  ];

  return (
    <div className="fade-up flex flex-col gap-5 pt-2">
      {/* top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-white"
            style={{ background: "linear-gradient(180deg,var(--accent-2),var(--accent))", boxShadow: "var(--shadow-accent)" }}>
            <Ic.Bolt size={18} />
          </span>
          <div className="leading-tight">
            <div className="display text-[15px] font-extrabold">Fabricator OS</div>
            <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{shop.name || "Aluminium Estimator"}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onToggleTheme} className="btn-ghost grid h-10 w-10 place-items-center rounded-full" title="Theme">
            {dark ? <Ic.Sun size={18} /> : <Ic.Moon size={18} />}
          </button>
          <button onClick={onOpenSettings} className="btn-ghost grid h-10 w-10 place-items-center rounded-full" title="Settings">
            <Ic.Settings size={18} />
          </button>
        </div>
      </div>

      {/* Hero earns its space only once. A fabricator who already has jobs
          reads this pitch every single morning on his way to "continue" — so
          once he has projects it collapses to a single line. */}
      {nProjects === 0 ? (
        <div className="rise flex flex-col gap-3 pt-1">
          <span className="eyebrow">Fabricator OS · Premium</span>
          <h1 className="display text-[28px] font-extrabold leading-[1.1]">
            Create your material list &amp;<br />quotation <span style={{ color: "var(--accent)" }}>in 1 minute.</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Drawing ki photo kheencho ya sizes daalo — cutting-ready list, engineering drawings aur ek
            brand quotation jo customer ka bharosa jeete.
          </p>
        </div>
      ) : (
        <h1 className="rise display pt-1 text-[22px] font-extrabold leading-tight">
          Aaj kya banana hai?
        </h1>
      )}

      {/* primary actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card flex flex-col gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Ic.Camera size={22} /></span>
          <div>
            <div className="display text-[15px] font-bold">Drawing / Photo se</div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>AI khud padhega — sizes, system, sab</div>
          </div>
          <PhotoCapture apiKey={apiKey} onExtracted={onExtracted} onNeedKey={onOpenSettings} />
        </div>
        <div className="card flex flex-col gap-3 p-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Ic.Pencil size={22} /></span>
          <div>
            <div className="display text-[15px] font-bold">Sizes khud daalo</div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>Ek saath kai window/door/partition</div>
          </div>
          <button onClick={onStart} className="btn-dark flex w-full items-center justify-center gap-2 py-3">
            <Ic.Plus size={16} /> Naya kaam
          </button>
        </div>
      </div>

      {/* create premium quotation — luxury CTA */}
      <button onClick={onStartQuote} className="card flex items-center gap-4 p-4 text-left"
        style={{ background: "linear-gradient(120deg,#14181d,#232a34)", border: "1px solid #B08628" }}>
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: "rgba(228,199,126,.15)", color: "#E4C77E" }}><Ic.FileText size={24} /></span>
        <div className="flex-1">
          <div className="display text-[16px] font-extrabold" style={{ color: "#fff" }}>Create Premium Quotation</div>
          <div className="text-[11.5px]" style={{ color: "#c2c8d0" }}>Window/door/partition · size · rate · colour → luxury 3D proposal</div>
        </div>
        <span style={{ color: "#E4C77E" }}><Ic.ArrowRight size={20} /></span>
      </button>

      {/* Continue work sits right under the actions: for a returning fabricator
          this is the most likely thing he came to do. */}
      <RecentProjects projects={projects} onOpen={onOpenProject}
        onRemove={(id) => setProjects(removeProject(id))} />

      {/* copilot — advice, not actions: the engine owns every number */}
      <div className="card p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Ic.Sparkle size={18} /></span>
          <div className="display text-[15px] font-bold">Ask FabriQ — aapka Copilot</div>
        </div>
        <p className="mt-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
          Fabrication ka koi bhi sawaal — konsa section, kitne track, interlock kahan, glass ya jali.
          Neeche <b>“Ask FabriQ”</b> se poochho. <b>Naap aur cutting hamesha engine deta hai</b>, Copilot nahi.
        </p>
      </div>

      {/* offcut bank */}
      <button onClick={onOffcutBank} className="card flex items-center gap-4 p-4 text-left">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: "var(--good-soft)", color: "var(--good)" }}><Ic.Recycle size={24} /></span>
        <div className="flex-1">
          <div className="display text-[15px] font-bold">♻️ Offcut Bank {bank.length > 0 && <span className="text-xs font-semibold" style={{ color: "var(--good)" }}>· {bankFt.toFixed(0)}&apos; stock</span>}</div>
          <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>Bache tukde yahan jama karo — agli material list me apne aap lagenge, utni pipe kam khareedni padegi</div>
        </div>
        <span style={{ color: "var(--ink-3)" }}><Ic.ArrowRight size={20} /></span>
      </button>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([icon, label, value, sub]) => (
          <div key={label} className="card p-3.5">
            {/* decoration, not an action — accent stays reserved for things the
                fabricator can actually tap */}
            <div className="flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>{icon}</div>
            <div className="display mt-2 text-xl font-extrabold tabnum">{value}</div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--ink-2)" }}>{label}</div>
            <div className="text-[10.5px] leading-tight" style={{ color: "var(--ink-3)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* "What you get" is onboarding copy — a fabricator with jobs already
          knows what he gets, and scrolls past it every day. */}
      {nProjects === 0 && (
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <span className="eyebrow">What you get</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {features.map(([icon, title, sub], i) => (
              <div key={title} className="card p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: i === 3 ? "var(--glass-soft)" : "var(--accent-soft)", color: i === 3 ? "var(--glass)" : "var(--accent)" }}>
                  {icon}
                </span>
                <div className="display mt-2.5 text-[14px] font-bold leading-tight">{title}</div>
                <div className="mt-1 text-[11.5px] leading-snug" style={{ color: "var(--ink-3)" }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Saved jobs, newest first — the returning fabricator's real front door. */
function RecentProjects({ projects, onOpen, onRemove }: {
  projects: ProjectRec[];
  onOpen: (p: ProjectRec) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="eyebrow">{projects.length ? "Kaam jaari rakho" : "Recent projects"}</span>
        {projects.length > 0 && <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{projects.length} total</span>}
      </div>
      {projects.length === 0 ? (
        <div className="card flex flex-col items-center gap-1 p-6 text-center">
          <span style={{ color: "var(--ink-3)" }}><Ic.Folder size={26} /></span>
          <div className="text-sm font-semibold">No projects yet</div>
          <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>Start your first — it takes a minute.</div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.slice(0, 6).map((p) => (
            <div key={p.id} className="card flex items-center gap-2 p-3.5">
              <button onClick={() => onOpen(p)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold">{p.title}</div>
                <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {timeAgo(p.updated)} · {p.sqft.toFixed(0)} sqft
                  {p.customer ? ` · ${p.customer}` : ""}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <StageChip done label="Material" />
                  <StageChip done={p.amount > 0} label={p.amount > 0 ? "Quoted" : "Quotation pending"} />
                  {p.scrapPct > 0 && (
                    <span className="badge" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                      {p.scrapPct.toFixed(0)}% scrap
                    </span>
                  )}
                </div>
              </button>
              <div className="shrink-0 text-right">
                {p.amount > 0 && (
                  <div className="text-sm font-bold tabnum" style={{ color: "var(--good)" }}>
                    ₹{Math.round(p.amount).toLocaleString("en-IN")}
                  </div>
                )}
                <button
                  onClick={() => { if (confirm(`"${p.title}" hata dein?`)) onRemove(p.id); }}
                  className="btn-ghost mt-1 grid h-7 w-7 place-items-center rounded-full text-xs"
                  title="Hatao">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ————————————————— ENTRY ————————————————— */

const TYPE_META: Record<OpeningType, { icon: string; label: string; plural: string }> = {
  window: { icon: "🪟", label: "Window", plural: "windows" },
  door: { icon: "🚪", label: "Door", plural: "doors" },
  partition: { icon: "🧱", label: "Partition", plural: "partitions" },
};

/**
 * Build a finished JobItem from a resolved meta map — mirrors the per-item
 * build logic in `answer()` so the wizard can create items directly (no
 * questions step). Un-asked details fall back to the same defaults the old
 * flow used, plus a width-aware track default. The engine is never touched.
 */
function buildJobItem(
  idNum: number, type: OpeningType, width: Um, height: Um, qty: number,
  metaIn: Record<string, string>,
): JobItem {
  const next: Record<string, string> = { ...metaIn };
  let sys: SystemId;
  let shutters: JobItem["shutters"];

  if (type === "door") {
    sys = "door_single";
    next.chokhat = next.chokhat ?? "needed";
    next.rails = next.rails ?? "2";
    next.zonemix = next.zonemix ?? (next.rails === "3" ? "SSSJ" : "SSJ");
    shutters = doorMixToZones(next.zonemix);
  } else if (type === "partition") {
    sys = "partition";
    next.partDoor = next.partDoor ?? "no";
    if (next.partDoor === "yes") next.partDoorW = next.partDoorW ?? "3";
    next.partSheetFt = next.partSheetFt ?? "0";
    next.partBayFt = next.partBayFt ?? "2.5";
    next.partRowFt = next.partRowFt ?? "3.5";
    shutters = [];
  } else if (next.system === "z_section") {
    sys = "z_section";
    const zType = next.zType ?? "openable";
    next.zSize = next.zSize ?? "light";
    next.zDoor = zType === "door" ? "yes" : "no";
    next.zLayout = zType === "fixed" ? "fixed" : zType === "combo" ? "combo" : "openable";
    if (zType === "combo") {
      next.zComboDir = next.zComboDir ?? "top";
      next.zFixedFt = next.zFixedFt ?? "2";
    }
    if (zType === "openable" || zType === "combo") next.zSashCount = next.zSashCount ?? "2";
    const n = zType === "fixed" || zType === "door"
      ? 1
      : Math.max(1, parseInt(next.zSashCount ?? "2", 10));
    shutters = Array.from({ length: n }, () => ({ kind: "glass" as const }));
  } else {
    // Normal Sliding or Domal — track/mix default (track is width-aware).
    const wide = width >= mm(1500);
    const tracks = next.tracks ?? (wide ? "3" : "2");
    next.tracks = tracks;
    sys = next.system === "domal" ? "domal" : tracks === "3" ? "normal_3t" : "normal_2t";
    if (next.system === "domal") {
      next.domalFix = next.domalFix ?? "no";
      if (next.domalFix === "yes") next.domalFixFt = next.domalFixFt ?? "2";
    }
    next.handle = next.handle ?? "std";
    const mix = next.mix ?? (tracks === "4" ? "GGGJ" : tracks === "3" ? "GGJ" : "GG");
    next.mix = mix;
    shutters = mixToShutters(mix);
  }

  return { id: `W${idNum}`, type, width, height, qty, system: sys, shutters, meta: next };
}

/* —— wizard option tables —— */
const WIN_SYS: [SystemId | "normal", string, string][] = [
  ["normal", "Normal Sliding", "18mm — sabse common"],
  ["domal", "Domal", "27–29mm — premium"],
  ["z_section", "Z-Section", "Hinge-openable"],
];
const NORMAL_VAR: [string, string][] = [["2", "2 Track"], ["3", "3 Track"], ["4", "4 Track"]];
const DOMAL_VAR: [string, string][] = [["no", "Bina Fix"], ["yes", "Upar Fix"]];
const Z_TYPE: [string, string][] = [
  ["openable", "Openable"], ["combo", "Fix + Openable"], ["fixed", "Poora Fixed"], ["door", "Door"],
];

/** Parse a size honouring the chosen unit — no feet here, sirf mm aur inch(+sut).
 *  mm mode: bare number = mm.
 *  inch mode: bare number = inches; "54-4" = 54 inch + 4 sut (1 inch = 8 sut).
 *  Explicit suffixed formats (1372mm, 54", 4'6") still work in either mode. */
function parseWithUnit(raw: string, unit: "mm" | "inch"): Um | null {
  const s = raw.trim();
  if (!s) return null;
  if (unit === "mm") {
    if (/^\d+(?:\.\d+)?$/.test(s)) return mm(parseFloat(s));
    return parseDimension(s);
  }
  const is = s.match(/^(\d+)-(\d+)$/); // inch-sut, no feet part
  if (is) return parseInt(is[1], 10) * UM_PER_INCH + parseInt(is[2], 10) * UM_PER_SUT;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * UM_PER_INCH);
  return parseDimension(s);
}
const DOOR_PALLA: [string, string][] = [["60", "60×25mm"], ["75", "75×25mm"], ["50", "50×25mm"]];
const DOOR_CHOKHAT: [string, string][] = [["needed", "Frame + Palla"], ["existing", "Sirf Palla"]];
const PART_VAR: [string, string][] = [["no", "Sirf panels"], ["yes", "Door ke saath"]];

const toggleArr = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

interface SizeRow { id: number; widthRaw: string; heightRaw: string; qty: number; unit: "mm" | "inch" }
interface Bucket { key: string; type: OpeningType; meta: Record<string, string>; label: string; rows: SizeRow[] }

/** Multi-select chip row. */
function ChipGroup({ options, selected, onToggle }: {
  options: [string, string, string?][]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {options.map(([val, label, hint]) => (
        <button key={val} onClick={() => onToggle(val)}
          className={`chip flex flex-col items-start gap-0.5 px-3 py-3 text-left ${selected.includes(val) ? "selected" : ""}`}>
          <span className="text-sm font-semibold">{label}</span>
          {hint && <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{hint}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Guided wizard — the manual entry flow.
 *   1. Types      : pick Window / Door / Partition (multi-select).
 *   2. Config     : per chosen type, pick system + variant (multi-select) —
 *                   each combination becomes a "bucket".
 *   3. Sizes      : per bucket, stack many (size · qty) rows.
 * Buckets carry a fully-resolved meta map, so items are built directly via
 * buildJobItem — the questions step is skipped entirely for manual entry.
 */
function Entry({ startId, onBuild, onBack }: {
  startId: number; onBuild: (items: JobItem[]) => void; onBack: () => void;
}) {
  const [phase, setPhase] = useState<"types" | "config" | "sizes">("types");
  const [types, setTypes] = useState<OpeningType[]>([]);
  const [cfgIdx, setCfgIdx] = useState(0);
  // window config
  const [winSys, setWinSys] = useState<string[]>([]);
  const [normTracks, setNormTracks] = useState<string[]>([]);
  const [domalVar, setDomalVar] = useState<string[]>([]);
  const [zTypes, setZTypes] = useState<string[]>([]);
  // door config
  const [doorPalla, setDoorPalla] = useState<string[]>([]);
  const [doorChokhat, setDoorChokhat] = useState<string[]>(["needed"]);
  // partition config
  const [partVar, setPartVar] = useState<string[]>([]);
  // sizes phase
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [bIdx, setBIdx] = useState(0);
  const [unit, setUnit] = useState<"mm" | "inch">("inch");
  const rid = useRef(1);
  const blank = (): SizeRow => ({ id: rid.current++, widthRaw: "", heightRaw: "", qty: 1, unit });
  const isBlank = (r: SizeRow) => !r.widthRaw.trim() && !r.heightRaw.trim();

  const ordered = (["window", "door", "partition"] as OpeningType[]).filter((t) => types.includes(t));
  const curType = ordered[cfgIdx];

  /* —— build buckets from the config selections (each starts with 1 blank row) —— */
  const computeBuckets = (): Bucket[] => {
    const bs: Bucket[] = [];
    const push = (type: OpeningType, meta: Record<string, string>, label: string) =>
      bs.push({ key: `b${bs.length}`, type, meta, label, rows: [blank()] });

    if (types.includes("window")) {
      const sys = winSys.length ? winSys : ["normal"];
      for (const s of ["normal", "domal", "z_section"]) {
        if (!sys.includes(s)) continue;
        if (s === "normal") {
          if (normTracks.length) {
            for (const [t, tl] of NORMAL_VAR) if (normTracks.includes(t)) push("window", { system: "normal", tracks: t }, `Normal · ${tl}`);
          } else {
            push("window", { system: "normal" }, "Normal Sliding");
          }
        } else if (s === "domal") {
          const vs = domalVar.length ? domalVar : ["no"];
          for (const [v, vl] of DOMAL_VAR) if (vs.includes(v)) push("window", { system: "domal", domalFix: v }, `Domal · ${vl}`);
        } else {
          const zs = zTypes.length ? zTypes : ["openable"];
          for (const [z, zl] of Z_TYPE) if (zs.includes(z)) push("window", { system: "z_section", zType: z }, `Z-Section · ${zl}`);
        }
      }
    }
    if (types.includes("door")) {
      const ps = doorPalla.length ? doorPalla : ["60"];
      const cs = doorChokhat.length ? doorChokhat : ["needed"];
      for (const [p, pl] of DOOR_PALLA) if (ps.includes(p))
        for (const [c, cl] of DOOR_CHOKHAT) if (cs.includes(c))
          push("door", { palla: p, chokhat: c }, `Door · ${pl} · ${cl}`);
    }
    if (types.includes("partition")) {
      const vs = partVar.length ? partVar : ["no"];
      for (const [v, vl] of PART_VAR) if (vs.includes(v)) push("partition", { partDoor: v }, `Partition · ${vl}`);
    }
    return bs;
  };

  const cfgOk = curType === "window" ? winSys.length > 0
    : curType === "door" ? doorPalla.length > 0
    : partVar.length > 0;

  const goConfigNext = () => {
    if (cfgIdx < ordered.length - 1) { setCfgIdx(cfgIdx + 1); return; }
    setBuckets(computeBuckets());
    setBIdx(0);
    setPhase("sizes");
  };

  /* —— inline rows: keep exactly ONE trailing blank so a new empty row
     appears automatically as soon as the last one gets any value —— */
  const normalizeRows = (rows: SizeRow[]): SizeRow[] => {
    let r = rows.filter((row, idx) => !(isBlank(row) && idx !== rows.length - 1));
    if (r.length === 0 || !isBlank(r[r.length - 1])) r = [...r, blank()];
    return r;
  };
  const patchRow = (rowId: number, patch: Partial<SizeRow>) =>
    setBuckets((bs) => bs.map((b, i) => i === bIdx
      ? { ...b, rows: normalizeRows(b.rows.map((r) => r.id === rowId ? { ...r, ...patch } : r)) } : b));
  const removeRow = (rowId: number) =>
    setBuckets((bs) => bs.map((b, i) => i === bIdx
      ? { ...b, rows: normalizeRows(b.rows.filter((r) => r.id !== rowId)) } : b));

  const filledRows = (b: Bucket) =>
    b.rows.filter((r) => parseWithUnit(r.widthRaw, r.unit) && parseWithUnit(r.heightRaw, r.unit));

  const finalize = (bsIn: Bucket[]) => {
    const items: JobItem[] = [];
    let n = startId;
    for (const b of bsIn) for (const r of b.rows) {
      const rw = parseWithUnit(r.widthRaw, r.unit); const rh = parseWithUnit(r.heightRaw, r.unit);
      if (!rw || !rh) continue;
      items.push(buildJobItem(++n, b.type, rw, rh, r.qty, { ...b.meta }));
    }
    if (items.length) onBuild(items);
  };

  const goSizesNext = () => {
    if (bIdx < buckets.length - 1) setBIdx(bIdx + 1);
    else finalize(buckets);
  };

  const back = () => {
    if (phase === "sizes") { if (bIdx > 0) { setBIdx(bIdx - 1); } else { setPhase("config"); setCfgIdx(ordered.length - 1); } return; }
    if (phase === "config") { if (cfgIdx > 0) setCfgIdx(cfgIdx - 1); else setPhase("types"); return; }
    onBack();
  };

  const totalSizes = buckets.reduce((a, b) => a + filledRows(b).length, 0);
  const isLastBucket = bIdx >= buckets.length - 1;
  const anySizes = totalSizes > 0;

  /* ————— PHASE 1 · types ————— */
  if (phase === "types") {
    return (
      <div className="fade-up flex flex-col gap-5">
        <Header title="Kya-kya banana hai?" sub="Ek ya zyada chuno — sab ek saath" onBack={back} />
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_META) as OpeningType[]).map((t) => (
            <button key={t} onClick={() => setTypes((p) => toggleArr(p, t))}
              className={`chip flex flex-col items-center gap-1 py-4 ${types.includes(t) ? "selected" : ""}`}>
              <span className="text-2xl">{TYPE_META[t].icon}</span>
              <span className="text-sm font-semibold">{TYPE_META[t].label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => { setCfgIdx(0); setPhase("config"); }} disabled={types.length === 0}
          className="btn-primary w-full py-4 text-lg display disabled:opacity-40 disabled:shadow-none">
          Aage → System chuno
        </button>
      </div>
    );
  }

  /* ————— PHASE 2 · config (per type) ————— */
  if (phase === "config") {
    return (
      <div className="fade-up flex flex-col gap-5">
        <Header
          title={`${TYPE_META[curType].icon} ${TYPE_META[curType].label} — system`}
          sub={`Step ${cfgIdx + 1} / ${ordered.length} · ek ya zyada chuno`}
          onBack={back}
        />
        <div className="card p-5 flex flex-col gap-5">
          {curType === "window" && (
            <>
              <div>
                <Label>System</Label>
                <ChipGroup options={WIN_SYS.map(([v, l, hnt]) => [v as string, l, hnt])} selected={winSys}
                  onToggle={(v) => setWinSys((p) => toggleArr(p, v))} />
              </div>
              {winSys.includes("normal") && (
                <div>
                  <Label>Normal — track</Label>
                  <ChipGroup options={NORMAL_VAR.map(([v, l]) => [v, l])} selected={normTracks}
                    onToggle={(v) => setNormTracks((p) => toggleArr(p, v))} />
                </div>
              )}
              {winSys.includes("domal") && (
                <div>
                  <Label>Domal — fix patti?</Label>
                  <ChipGroup options={DOMAL_VAR.map(([v, l]) => [v, l])} selected={domalVar}
                    onToggle={(v) => setDomalVar((p) => toggleArr(p, v))} />
                </div>
              )}
              {winSys.includes("z_section") && (
                <div>
                  <Label>Z-Section — type</Label>
                  <ChipGroup options={Z_TYPE.map(([v, l]) => [v, l])} selected={zTypes}
                    onToggle={(v) => setZTypes((p) => toggleArr(p, v))} />
                </div>
              )}
            </>
          )}
          {curType === "door" && (
            <>
              <div>
                <Label>Palla (shutter) size</Label>
                <ChipGroup options={DOOR_PALLA.map(([v, l]) => [v, l])} selected={doorPalla}
                  onToggle={(v) => setDoorPalla((p) => toggleArr(p, v))} />
              </div>
              <div>
                <Label>Chokhat (frame)</Label>
                <ChipGroup options={DOOR_CHOKHAT.map(([v, l]) => [v, l])} selected={doorChokhat}
                  onToggle={(v) => setDoorChokhat((p) => toggleArr(p, v))} />
              </div>
            </>
          )}
          {curType === "partition" && (
            <div>
              <Label>Partition type</Label>
              <ChipGroup options={PART_VAR.map(([v, l]) => [v, l])} selected={partVar}
                onToggle={(v) => setPartVar((p) => toggleArr(p, v))} />
            </div>
          )}
        </div>
        <button onClick={goConfigNext} disabled={!cfgOk}
          className="btn-primary w-full py-4 text-lg display disabled:opacity-40 disabled:shadow-none">
          {cfgIdx < ordered.length - 1 ? "Aage →" : "Aage → Sizes daalo"}
        </button>
      </div>
    );
  }

  /* ————— PHASE 3 · sizes (per bucket, inline auto-expanding rows) ————— */
  const cur = buckets[bIdx];
  const rows = cur?.rows ?? [];
  const placeholder = unit === "inch" ? `54  ·  54-4 (54"4s)` : `1372  ·  1372mm`;
  return (
    <div className="fade-up flex flex-col gap-5">
      <Header
        title={cur ? `${TYPE_META[cur.type].icon} ${cur.label}` : "Sizes"}
        sub={`Bucket ${bIdx + 1} / ${buckets.length} · size daalte hi neeche naya row aa jayega`}
        onBack={back}
      />

      {/* bucket progress dots */}
      {buckets.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {buckets.map((b, i) => {
            const n = filledRows(b).length;
            return (
              <button key={b.key} onClick={() => setBIdx(i)}
                className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{
                  background: i === bIdx ? "var(--accent)" : "var(--surface-2)",
                  color: i === bIdx ? "#fff" : "var(--ink-3)",
                }}>
                {b.label.split(" · ").slice(-1)[0]}{n ? ` ·${n}` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* unit toggle */}
      <div className="flex items-center gap-3">
        <Label>Unit</Label>
        <div className="flex overflow-hidden rounded-lg border-2" style={{ borderColor: "var(--steel)" }}>
          {(["mm", "inch"] as const).map((u) => (
            <button key={u} onClick={() => setUnit(u)}
              className="px-4 py-1.5 text-sm font-bold"
              style={{
                background: unit === u ? "var(--accent)" : "var(--surface-2)",
                color: unit === u ? "#fff" : "var(--ink-2)",
              }}>
              {u === "mm" ? "MM" : "Inch"}
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
          {unit === "inch" ? "· sut ke liye 54-4 (1 inch = 8 sut)" : "· sirf mm daalo"}
        </span>
      </div>

      {/* inline size rows */}
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          const rw = parseWithUnit(r.widthRaw, r.unit);
          const rh = parseWithUnit(r.heightRaw, r.unit);
          const empty = isBlank(r);
          const over = Boolean((rw && toFeet(rw) > 20) || (rh && toFeet(rh) > 20));
          const touched = r.widthRaw.trim() || r.heightRaw.trim();
          return (
            <div key={r.id} className="card flex flex-col gap-1.5 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold"
                  style={{ background: "var(--surface-2)", color: empty ? "var(--ink-3)" : "var(--ink)" }}>{i + 1}</span>
                <input inputMode="text" placeholder={i === 0 ? placeholder.split("·")[0].trim() : "W"} value={r.widthRaw}
                  onChange={(e) => patchRow(r.id, { widthRaw: e.target.value, unit })}
                  className="dim-input min-w-0 flex-1 px-2.5 py-2.5 text-base font-semibold" />
                <span className="shrink-0 text-sm" style={{ color: "var(--ink-3)" }}>×</span>
                <input inputMode="text" placeholder="H" value={r.heightRaw}
                  onChange={(e) => patchRow(r.id, { heightRaw: e.target.value, unit })}
                  className="dim-input min-w-0 flex-1 px-2.5 py-2.5 text-base font-semibold" />
                <div className="flex shrink-0 items-center overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
                  <button className="px-2 py-2 text-base font-bold" style={{ background: "var(--surface-2)" }}
                    onClick={() => patchRow(r.id, { qty: Math.max(1, r.qty - 1) })}>−</button>
                  <span className="w-7 text-center text-sm font-bold tabnum">{r.qty}</span>
                  <button className="px-2 py-2 text-base font-bold" style={{ background: "var(--surface-2)" }}
                    onClick={() => patchRow(r.id, { qty: Math.min(50, r.qty + 1) })}>+</button>
                </div>
                {!empty && (
                  <button onClick={() => removeRow(r.id)}
                    className="btn-ghost grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm" title="Hatao">✕</button>
                )}
              </div>
              {touched && (
                <div className="pl-10 text-[11px] font-semibold"
                  style={{ color: rw && rh && !over ? "var(--good)" : "var(--bad)" }}>
                  {rw && rh
                    ? over
                      ? "⚠️ ye size bahut bada lag raha hai — unit check karo"
                      : `= ${formatFtInSut(rw)} × ${formatFtInSut(rh)}${r.qty > 1 ? ` · ×${r.qty}` : ""} · ${r.unit === "inch" ? "inch" : "mm"}`
                    : "width & height dono daalo"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={goSizesNext} disabled={isLastBucket && !anySizes}
        className="btn-primary w-full py-4 text-lg display disabled:opacity-40 disabled:shadow-none">
        {isLastBucket
          ? (totalSizes > 0 ? `Material List banao → (${totalSizes})` : "Material List banao →")
          : "Aage → agla system"}
      </button>
    </div>
  );
}

function Parsed({ um, raw }: { um: Um | null; raw: string }) {
  if (!raw.trim()) return <div className="h-5" />;
  return (
    <div className="mt-1 h-5 text-xs font-semibold"
      style={{ color: um ? "var(--good)" : "var(--bad)" }}>
      {um ? `= ${formatFtInSut(um)}` : "samajh nahi aaya — 6 ya 4'6\" likho"}
    </div>
  );
}

/* ————————————————— QUESTIONS ————————————————— */

function Questions({
  questions, qIndex, answers, loading, source, draft, width, height, onAnswer, onBack,
}: {
  questions: Question[]; qIndex: number; answers: Record<string, string>;
  loading: boolean; source: string;
  draft: Draft; width: Um | null; height: Um | null;
  onAnswer: (qid: string, value: string) => void; onBack: () => void;
}) {
  const [custom, setCustom] = useState("");
  const q = questions[qIndex];
  useEffect(() => setCustom(""), [qIndex]);

  // live preview shutters from answers so far
  const previewShutters = useMemo(() => {
    const mix = answers.mix ?? ((answers.tracks ?? "3") === "3" ? "GGJ" : "GG");
    return mixToShutters(mix);
  }, [answers]);

  if (!q) {
    return (
      <div className="fade-up flex flex-col items-center gap-4 pt-20">
        {loading ? (
          <>
            <Spinner />
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>AI soch raha hai…</p>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              Is type ke liye abhi sawaal nahi hain — jald aa raha hai!
            </p>
            <button onClick={onBack} className="btn-ghost px-6 py-2">← Wapas jao</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fade-up flex flex-col gap-4">
      <Header
        title={`Sawaal ${qIndex + 1} / ${questions.length}`}
        sub={source === "ai" ? "AI ne aapki situation analyze ki" : "Smart questions — sirf zaroori"}
        onBack={onBack}
      />

      {/* progress */}
      <div className="flex gap-1.5">
        {questions.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full transition-all"
            style={{ background: i <= qIndex ? "var(--accent)" : "var(--steel)" }} />
        ))}
      </div>

      {/* live preview */}
      {width && height && draft.type === "window" && (
        <div className="card flex justify-center p-4">
          <WindowDiagram width={width} height={height} shutters={previewShutters} size={190} />
        </div>
      )}

      <div key={q.id} className="card slide-in p-5">
        <h2 className="display text-xl font-bold">{q.question}</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>💡 {q.why}</p>

        {q.diagram?.kind === "tracks" && (
          <div className="mt-3 flex items-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <TrackDiagram tracks={2} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--ink-2)" }}>2 Track</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrackDiagram tracks={3} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--ink-2)" }}>3 Track</span>
            </div>
          </div>
        )}

        {q.diagram?.kind === "partition-type" ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {q.options.map((op) => (
              <button key={op.value} onClick={() => onAnswer(q.id, op.value)}
                className="chip flex flex-col items-center gap-2 p-3 text-center">
                <PartitionDiagram zonemix={op.value} size={90} />
                <span className="text-xs font-bold leading-tight">{op.label}</span>
                {op.hint && (
                  <span className="text-[10px] leading-tight" style={{ color: "var(--ink-3)" }}>{op.hint}</span>
                )}
              </button>
            ))}
          </div>
        ) : q.diagram?.kind === "partition-bays" && width ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {q.options.map((op) => (
              <button key={op.value} onClick={() => onAnswer(q.id, op.value)}
                className="chip flex flex-col items-center gap-2 p-3 text-center">
                <PartitionBayDiagram widthUm={width} bayFt={parseFloat(op.value)} size={104} />
                <span className="text-xs font-bold leading-tight">{op.label}</span>
                {op.hint && (
                  <span className="text-[10px] leading-tight" style={{ color: "var(--ink-3)" }}>{op.hint}</span>
                )}
              </button>
            ))}
          </div>
        ) : q.diagram?.kind === "partition-rows" && height ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {q.options.map((op) => (
              <button key={op.value} onClick={() => onAnswer(q.id, op.value)}
                className="chip flex flex-col items-center gap-2 p-3 text-center">
                <PartitionRowDiagram heightUm={height} sheetFt={parseFloat(answers.partSheetFt ?? "0") || 0}
                  rowFt={parseFloat(op.value)} size={104} />
                <span className="text-xs font-bold leading-tight">{op.label}</span>
                {op.hint && (
                  <span className="text-[10px] leading-tight" style={{ color: "var(--ink-3)" }}>{op.hint}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2">
            {q.options.map((op) => (
              <button key={op.value} onClick={() => onAnswer(q.id, op.value)}
                className="chip flex items-center justify-between px-4 py-3.5 text-left">
                <span className="font-semibold">{op.label}</span>
                {op.hint && (
                  <span className="ml-2 text-xs" style={{ color: "var(--ink-3)" }}>{op.hint}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            placeholder="Apna khud likho ya 🎤 bolo…"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && custom.trim() && onAnswer(q.id, custom.trim())}
            className="dim-input flex-1 px-3 py-2.5 text-sm"
          />
          <VoiceButton onTranscript={(t) => setCustom((c) => (c ? `${c} ${t}` : t))} />
          <button
            onClick={() => custom.trim() && onAnswer(q.id, custom.trim())}
            className="btn-ghost px-4 text-sm"
          >
            OK
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-xs" style={{ color: "var(--ink-3)" }}>
          <Spinner tiny /> AI aur behtar sawaal bana raha hai…
        </p>
      )}
    </div>
  );
}

/* ————————————————— ADD MORE ————————————————— */

function AddMore({
  items, onAdd, onDone, onRemove,
}: {
  items: JobItem[]; onAdd: () => void; onDone: () => void; onRemove: (id: string) => void;
}) {
  return (
    <div className="fade-up flex flex-col gap-4">
      <Header title="Job mein items" sub={`${items.length} item${items.length > 1 ? "s" : ""} add ho gaye`} />
      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <div key={it.id} className="card flex items-center gap-4 p-4">
            <div className="shrink-0">
              {it.type === "window" ? (
                <WindowDiagram width={it.width} height={it.height} shutters={it.shutters} size={72} />
              ) : (
                <div className="flex h-[72px] w-[52px] items-center justify-center rounded-lg text-3xl"
                  style={{ background: "var(--surface-2)" }}>
                  {it.type === "door" ? "🚪" : "🧱"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="display font-bold">
                {it.id} — {formatFtInSut(it.width)} × {formatFtInSut(it.height)}
              </div>
              <div className="text-xs" style={{ color: "var(--ink-2)" }}>
                {it.type === "door" ? (
                  <>
                    {it.qty} nos · Palla {it.meta.palla ?? "60"}mm ·{" "}
                    {it.shutters.filter((s) => s.kind === "sheet").length}S+
                    {it.shutters.filter((s) => s.kind === "jali").length}J
                  </>
                ) : it.type === "partition" ? (
                  <>
                    {it.qty} nos · SP/DP ·{" "}
                    {it.meta.partDoor === "yes" ? `Door ${it.meta.partDoorW ?? "3"}ft · ` : ""}
                    {(it.meta.partSheetFt ?? "0") !== "0" ? `${it.meta.partSheetFt}ft sheet · ` : "Full glass · "}
                    {it.meta.partBayFt ?? "2.5"}ft bays
                  </>
                ) : it.system === "z_section" ? (
                  <>
                    {it.qty} nos · Z-Section {it.meta.zSize === "heavy" ? "Big" : "Small"} ·{" "}
                    {it.meta.zType === "fixed" ? "Fixed"
                      : it.meta.zType === "combo" ? "Fix+Openable"
                      : it.meta.zType === "door" ? "Door" : "Openable"}
                  </>
                ) : (
                  <>
                    {it.qty} nos · {it.system === "normal_3t" ? "3-Track" : it.system === "normal_2t" ? "2-Track" : "Domal"} ·{" "}
                    {it.shutters.filter((s) => s.kind === "glass").length}G+
                    {it.shutters.filter((s) => s.kind === "jali").length}J
                  </>
                )}
              </div>
            </div>
            <button onClick={() => onRemove(it.id)} className="text-sm" style={{ color: "var(--bad)" }}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="btn-ghost w-full py-3.5">
        ✚ Aur item jodo
      </button>
      <button onClick={onDone} className="btn-primary w-full py-4 text-lg display" disabled={!items.length}>
        📋 List Banao
      </button>
    </div>
  );
}

/* ————————————————— RESULT ————————————————— */

/** Five outputs only — one tab per job the fabricator actually does.
 *  Glass/jali now live at the bottom of Material; engineering drawings live
 *  inside Workshop next to the cutting list; the vendor order is a share
 *  action on Material rather than its own tab. */
type Tab = "aluminium" | "cutting" | "offcuts" | "threed" | "quote";

/** Renders into <body>, so `position: fixed` is measured against the viewport
 *  even when an ancestor has a transform (our fade-up animation does). */
function BodyPortal({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready ? createPortal(children, document.body) : null;
}

/** [id, icon, desktop label, mobile label] — one source for both switchers. */
const TAB_DEFS: [Tab, string, string, string][] = [
  ["aluminium", "📦", "Material", "Material"],
  ["cutting", "🔧", "🔧 Workshop", "Workshop"],
  ["offcuts", "♻️", "♻️ Offcuts", "Offcuts"],
  ["threed", "✨", "✨ 3D", "3D"],
  ["quote", "💰", "💰 Quotation", "Quote"],
];

/** Customer-facing name + spec line for a job item (no engineering jargon). */
function itemName(it: JobItem): string {
  if (it.type === "door") return "Aluminium Door";
  if (it.type === "partition") return "Aluminium Glass Partition";
  if (it.system === "z_section") return it.meta.zType === "door" ? "Z-Section Door" : "Z-Section Window";
  if (it.system === "domal") return "Domal Sliding Window";
  return "Aluminium Sliding Window";
}
function itemSpec(it: JobItem): string {
  const g = it.shutters.filter((s) => s.kind === "glass").length;
  const j = it.shutters.filter((s) => s.kind === "jali").length;
  if (it.type === "partition") {
    const bits = ["Aluminium partition"];
    if (it.meta.partDoor === "yes") bits.push(`with ${it.meta.partDoorW ?? "3"}ft door`);
    bits.push((it.meta.partSheetFt ?? "0") !== "0" ? `${it.meta.partSheetFt}ft sheet + glass` : "full glass");
    return bits.join(" · ");
  }
  if (it.type === "door") return "Hinged door with panel";
  if (it.system === "z_section") return it.meta.zType === "combo" ? "Fixed + openable" : (it.meta.zType ?? "openable");
  const mix = [g ? `${g} Glass` : "", j ? `${j} Jali` : ""].filter(Boolean).join(" + ");
  const tr = it.meta.tracks ? `${it.meta.tracks} Track` : "";
  return [tr, mix].filter(Boolean).join(" · ") || "Glass";
}
/** customer-friendly size like 6' × 5'6" */
function sizeFtIn(um: Um): string {
  const inch = um / 25400;
  const ft = Math.floor(inch / 12);
  const i = Math.round(inch - ft * 12);
  return `${ft}'${i ? i + '"' : ""}`;
}

function Result({ items, onNew, initialTab, onSnapshot }: {
  items: JobItem[]; onNew: () => void; apiKey: string | null; initialTab?: Tab;
  /** reports real computed figures back so the saved project card is truthful */
  onSnapshot?: (s: { scrapPct?: number; amount?: number; customer?: string }) => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "aluminium");
  const [threedIdx, setThreedIdx] = useState(0);
  const [showcase, setShowcase] = useState(false);
  const [snapshots, setSnapshots] = useState<Record<string, string>>({});
  const [quoteFinish, setQuoteFinish] = useState<Finish>("black");
  const [quoteGlass, setQuoteGlass] = useState<GlassKind>("clear");
  const [payQr, setPayQr] = useState<string>("");

  // —— quotation state ——
  const [shop, setShop] = useState<ShopProfile>({ name: "" });
  const [customer, setCustomer] = useState("");
  const [itemRate, setItemRate] = useState<Record<string, number>>({});
  const [savedRate, setSavedRate] = useState<Record<string, number>>({});
  const [aluRate, setAluRate] = useState(0); // ₹ per running foot of aluminium (shop memory)
  const [gstPct, setGstPct] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [showShop, setShowShop] = useState(false);
  const quoteNo = useMemo(() => "Q" + new Date().toISOString().slice(2, 10).replace(/-/g, ""), []);
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), []);
  const validTill = useMemo(() => new Date(Date.now() + 15 * 864e5).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), []);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("fabriq_shop") || "{}"); if (s && s.name) setShop(s); } catch { /* ignore */ }
    try { setSavedRate(JSON.parse(localStorage.getItem("fabriq_rates") || "{}")); } catch { /* ignore */ }
    try { const r = parseFloat(localStorage.getItem("fabriq_alu_rate") || ""); if (r > 0) setAluRate(r); } catch { /* ignore */ }
  }, []);

  const saveAluRate = (v: number) => {
    setAluRate(v);
    try { if (v > 0) localStorage.setItem("fabriq_alu_rate", String(v)); else localStorage.removeItem("fabriq_alu_rate"); } catch { /* ignore */ }
  };

  const rateFor = (it: JobItem): number =>
    itemRate[it.id] ?? savedRate[itemName(it)] ?? 0;
  const setRate = (it: JobItem, v: number) => {
    setItemRate((p) => ({ ...p, [it.id]: v }));
    setSavedRate((p) => {
      const next = { ...p, [itemName(it)]: v };
      try { localStorage.setItem("fabriq_rates", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const printQuote = () => {
    document.body.classList.add("printing-quote");
    const after = () => { document.body.classList.remove("printing-quote"); window.removeEventListener("afterprint", after); };
    window.addEventListener("afterprint", after);
    window.print();
  };

  // UPI "scan to pay" QR — encodes the payable grand total; offline data-URL.
  useEffect(() => {
    const payable = Math.round(
      items.reduce((a, it) => a + sqft(it.width, it.height) * it.qty * (itemRate[it.id] ?? savedRate[itemName(it)] ?? 0), 0)
      * (1 - discountPct / 100) * (1 + gstPct / 100)
    );
    if (!shop.upi || payable <= 0) { setPayQr(""); return; }
    const url = `upi://pay?pa=${encodeURIComponent(shop.upi)}&pn=${encodeURIComponent(shop.name || "Shop")}&am=${payable}&cu=INR&tn=${encodeURIComponent("Quotation " + quoteNo)}`;
    QRCode.toDataURL(url, { margin: 1, width: 240 }).then(setPayQr).catch(() => setPayQr(""));
  }, [shop.upi, shop.name, items, itemRate, savedRate, discountPct, gstPct, quoteNo]);

  const { list, error } = useMemo(() => {
    try {
      const list = estimate(items);
      return { list, error: null as string | null };
    } catch (e) {
      return { list: null, error: e instanceof Error ? e.message : "error" };
    }
  }, [items]);

  const cost = useMemo(() => (list ? costJob(list, aluRate) : null), [list, aluRate]);
  const offcutCandidates = useMemo(() => (list ? findOffcuts(list.bars) : []), [list]);

  // What the saved bank can serve for THIS job. Recomputed when the bank
  // changes (bankVer) so confirming a use immediately refreshes the plan.
  const [bankVer, setBankVer] = useState(0);
  const rawPlan = useMemo(
    () => (list ? planOffcutUse(list.pieces, loadOffcuts()) : EMPTY_PLAN),
    [list, bankVer],
  );
  /** Using shop stock is the fabricator's decision, not ours — until he turns
   *  it on, every list shows plain "buy it all" numbers. Once on, BOTH the
   *  material list and the workshop sheet switch to the stock-aware plan. */
  const [useStock, setUseStock] = useState(false);
  const offcutPlan = useStock ? rawPlan : EMPTY_PLAN;
  /** Fabricator confirms he actually cut from the bank: consume those pieces
   *  and put any still-usable remainder back. Never silent — always his call. */
  const applyOffcutPlan = () => {
    for (const id of offcutPlan.consumedIds) removeOffcut(id);
    if (offcutPlan.leftovers.length) {
      addOffcuts(
        offcutPlan.leftovers.map((l, i) => ({
          key: `cut-${Date.now()}-${i}`, sectionId: l.sectionId, length: l.length, barNo: 0,
        })),
        "Bank se kaata",
      );
    }
    setBankVer((v) => v + 1);
  };

  if (error || !list) {
    const friendly = error?.startsWith("Piece longer than 16 feet")
      ? `${error} — ye size shayad galat unit mein daali gayi hai. Feet ki jagah agar inch chahiye tha, wapas jaake number ke aage " lagao (jaise 66").`
      : error;
    return (
      <div className="card mt-10 p-6 text-center">
        <div className="text-3xl">⚠️</div>
        <p className="mt-2 font-semibold">{friendly}</p>
        <button onClick={onNew} className="btn-ghost mt-4 px-6 py-2">Wapas jao</button>
      </div>
    );
  }


  const quoteLines: QuoteLine[] = items.map((it) => {
    const area = sqft(it.width, it.height) * it.qty;
    const rate = rateFor(it);
    return {
      name: itemName(it),
      size: `${sizeFtIn(it.width)} × ${sizeFtIn(it.height)}`,
      detail: itemSpec(it),
      qty: it.qty, sqft: area, rate, amount: area * rate,
      drawing: <MiniElevation item={it} size={54} />,
      render: snapshots[it.id],
    };
  });
  const quoteTotal = quoteLines.reduce((a, l) => a + l.amount, 0);
  const grandPayable = Math.round(quoteTotal * (1 - discountPct / 100) * (1 + gstPct / 100));

  // Report real figures up so the saved project card shows earned numbers only.
  const scrapPct = list.totals.wastePct;
  useEffect(() => {
    onSnapshot?.({ scrapPct, amount: grandPayable, customer: customer.trim() || undefined });
  }, [scrapPct, grandPayable, customer, onSnapshot]);

  return (
    <div className="result-view fade-up flex flex-col gap-4 pb-24 sm:pb-0">
      {tab === "quote" ? (
        <div className="no-print flex items-center justify-between">
          <div>
            <h1 className="display text-2xl font-extrabold">Quotation</h1>
            <p className="text-xs" style={{ color: "var(--ink-2)" }}>
              Party ke liye — rate daalo, PDF banao
            </p>
          </div>
          <button onClick={() => setTab("aluminium")} className="btn-ghost px-4 py-2 text-sm">← Material List</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="display text-2xl font-extrabold">Material List</h1>
              <p className="text-xs" style={{ color: "var(--ink-2)" }}>
                {items.length} item · {items.reduce((a, i) => a + i.qty, 0)} openings
              </p>
            </div>
            <button onClick={onNew} className="btn-ghost px-4 py-2 text-sm no-print">✚ Naya</button>
          </div>

          {/* big numbers — the hero is what to actually BUY, with the full
              requirement shown underneath so nothing is hidden */}
          {(() => {
            const need = list.totals.bars16 + list.totals.bars8 * 0.5;
            const buy = Math.max(0, need - offcutPlan.pipesSaved);
            return (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="16' Pipes" value={list.totals.bars16} />
                <Stat label="8' Pipes" value={list.totals.bars8} />
                {offcutPlan.pipesSaved > 0 ? (
                  <Stat label="Khareedo" value={fmtPipes(buy)} tone="good"
                    sub={`${fmtPipes(need)} chahiye · ${fmtPipes(offcutPlan.pipesSaved)} bank se`} />
                ) : (
                  <Stat label="Total Pipes" value={fmtPipes(need)} tone="accent" />
                )}
                <Stat label="Scrap" value={`${list.totals.wastePct}%`}
                  tone={list.totals.wastePct > 20 ? "warn" : "good"} />
              </div>
            );
          })()}
        </>
      )}

      {/* Output switcher. On a phone the top strip cut the last two tabs off
          screen — Quotation, the tab that wins the customer, was undiscoverable.
          So on mobile it moves to a fixed bottom bar (all five visible, within
          thumb reach) and the top strip is desktop-only. */}
      <div className="no-print hidden gap-1 overflow-x-auto rounded-xl p-1 sm:flex" style={{ background: "var(--surface-2)" }}>
        {TAB_DEFS.map(([t, , label]) => (
          <button key={t} onClick={() => setTab(t)}
            className="whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all"
            style={tab === t
              ? { background: "var(--surface)", boxShadow: "var(--shadow)", color: "var(--ink)" }
              : { color: "var(--ink-2)" }}>
            {label}{t === "offcuts" && offcutCandidates.length ? ` (${offcutCandidates.length})` : ""}
          </button>
        ))}
      </div>

      {/* Portalled to <body>: .result-view runs a fade-up transform, which would
          make it the containing block and pin this bar to the bottom of the
          CONTENT instead of the screen. */}
      <BodyPortal>
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 sm:hidden"
          style={{
            background: "var(--surface)", borderTop: "1px solid var(--line)",
            paddingBottom: "env(safe-area-inset-bottom)", boxShadow: "0 -4px 20px rgba(0,0,0,.10)",
          }}>
          {TAB_DEFS.map(([t, icon, , short]) => (
            <button key={t} onClick={() => { setTab(t); window.scrollTo({ top: 0 }); }}
              className="relative flex flex-col items-center gap-0.5 py-2.5"
              style={{ color: tab === t ? "var(--accent)" : "var(--ink-3)" }}>
              <span className="text-[17px] leading-none">{icon}</span>
              <span className="text-[10px] font-bold leading-none">{short}</span>
              {t === "offcuts" && offcutCandidates.length > 0 && (
                <span className="absolute right-3 top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: "var(--good)" }}>{offcutCandidates.length}</span>
              )}
            </button>
          ))}
        </nav>
      </BodyPortal>

      {tab === "aluminium" && (
        <AluminiumPanel list={list} cost={cost} aluRate={aluRate} onRate={saveAluRate} shop={shop}
          plan={offcutPlan} rawPlan={rawPlan} useStock={useStock} onToggleStock={setUseStock}
          onUseBank={applyOffcutPlan} />
      )}
      {tab === "cutting" && <CuttingPanel list={list} shop={shop} items={items} plan={offcutPlan} />}
      {tab === "offcuts" && <OffcutsPanel candidates={offcutCandidates} aluRate={aluRate} jobLabel={items[0] ? itemName(items[0]) : undefined} />}
      {tab === "threed" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="display font-bold">Live 3D Configurator</div>
              <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                Customer ko dikhao — colour aur glass live badlo
              </div>
            </div>
            {items.length > 1 && (
              <select value={threedIdx} onChange={(e) => setThreedIdx(Number(e.target.value))}
                className="dim-input px-3 py-2 text-sm">
                {items.map((it, i) => <option key={it.id} value={i}>{it.id} — {itemName(it)}</option>)}
              </select>
            )}
          </div>
          <Window3D
            item={items[Math.min(threedIdx, items.length - 1)]}
            onCapture={(url) => setSnapshots((s) => ({ ...s, [items[Math.min(threedIdx, items.length - 1)].id]: url }))}
          />
          <button onClick={() => setShowcase(true)}
            className="btn-dark w-full py-4 text-base display">
            👤 Customer ko dikhao — full screen
          </button>
          <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
            📸 &quot;Save to Quotation&quot; dabao — ye 3D view quotation ke us item pe lag jayega
          </p>
        </div>
      )}
      {tab === "quote" && (
        <QuotePanel
          items={items} shop={shop} customer={customer} setCustomer={setCustomer}
          rateFor={rateFor} setRate={setRate} gstPct={gstPct} setGstPct={setGstPct}
          discountPct={discountPct} setDiscountPct={setDiscountPct}
          total={quoteTotal} onPrint={printQuote} onEditShop={() => setShowShop(true)}
        />
      )}

      {/* No global "WhatsApp pe bhejo" any more: a fabricator sends different
          documents to different people (aluminium supplier, glass supplier,
          his own karigar, the customer). Each tab carries its own send action. */}

      {/* 3D colour/glass picker — auto-renders each opening into the quotation */}
      {tab === "quote" && quoteTotal > 0 && (
        <div className="no-print card flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="eyebrow">3D preview · quotation me lagega</div>
            <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>Colour chuno — har window us colour me quote me aa jayegi</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FINISH_OPTS.map(([f, label, sw]) => (
              <button key={f} onClick={() => setQuoteFinish(f)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold"
                style={{ border: `1.5px solid ${quoteFinish === f ? "var(--accent)" : "var(--line)"}`, background: quoteFinish === f ? "var(--accent-soft)" : "var(--surface)" }}>
                <span className="h-4 w-4 rounded-full" style={{ background: sw, border: "1px solid rgba(0,0,0,.15)" }} />{label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {GLASS_OPTS.map(([g, label, sw]) => (
              <button key={g} onClick={() => setQuoteGlass(g)}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold"
                style={{ border: `1.5px solid ${quoteGlass === g ? "var(--accent)" : "var(--line)"}`, background: quoteGlass === g ? "var(--accent-soft)" : "var(--surface)" }}>
                <span className="h-4 w-4 rounded-full" style={{ background: sw, border: "1px solid rgba(0,0,0,.15)" }} />{label}
              </button>
            ))}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {items.map((it) => (
              <div key={it.id} className="shrink-0 text-center">
                <Window3DThumb key={`${it.id}-${quoteFinish}-${quoteGlass}`}
                  item={it} finish={quoteFinish} glass={quoteGlass} size={140}
                  onReady={(url) => setSnapshots((s) => ({ ...s, [it.id]: url }))} />
                <div className="mt-1 text-[10px]" style={{ color: "var(--ink-3)" }}>{it.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* the quotation document — the ONLY thing printed in quote mode */}
      {tab === "quote" && (
        <QuoteDoc
          className="quote-doc" shop={shop} customer={customer} quoteNo={quoteNo}
          date={today} validTill={validTill} lines={quoteLines} discountPct={discountPct} gstPct={gstPct}
          payQr={payQr}
        />
      )}

      {showShop && <ShopModal shop={shop} onSave={(s) => { setShop(s); try { localStorage.setItem("fabriq_shop", JSON.stringify(s)); } catch { /* ignore */ } setShowShop(false); }} onClose={() => setShowShop(false)} />}

      {/* Customer-facing full screen — shop ke private numbers yahan kabhi nahi */}
      {showcase && items.length > 0 && (() => {
        const it = items[Math.min(threedIdx, items.length - 1)];
        const rate = rateFor(it);
        return (
          <CustomerShowcase
            item={it}
            shopName={shop.name}
            tagline={shop.tagline}
            title={itemName(it)}
            price={rate > 0 ? sqft(it.width, it.height) * it.qty * rate : 0}
            finish={quoteFinish} glass={quoteGlass}
            onFinish={setQuoteFinish} onGlass={setQuoteGlass}
            onExit={() => setShowcase(false)}
          />
        );
      })()}
    </div>
  );
}

/* —— quotation controls + shop —— */

function QuotePanel({
  items, shop, customer, setCustomer, rateFor, setRate,
  gstPct, setGstPct, discountPct, setDiscountPct, total, onPrint, onEditShop,
}: {
  items: JobItem[]; shop: ShopProfile; customer: string; setCustomer: (v: string) => void;
  rateFor: (it: JobItem) => number; setRate: (it: JobItem, v: number) => void;
  gstPct: number; setGstPct: (v: number) => void; discountPct: number; setDiscountPct: (v: number) => void;
  total: number; onPrint: () => void; onEditShop: () => void;
}) {
  return (
    <div className="no-print flex flex-col gap-3">
      {!shop.name ? (
        <button onClick={onEditShop} className="card p-4 text-left" style={{ borderStyle: "dashed", borderColor: "var(--accent)" }}>
          <div className="font-bold">🏪 Apni shop ki details daalo</div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>Quotation pe aapka naam + phone aayega — ek baar daalo, hamesha ke liye yaad rahega.</div>
        </button>
      ) : (
        <div className="card flex items-center justify-between p-3">
          <div className="min-w-0">
            <div className="truncate font-bold">{shop.name}</div>
            <div className="truncate text-xs" style={{ color: "var(--ink-3)" }}>{shop.phone || "phone add karo"}</div>
          </div>
          <button onClick={onEditShop} className="btn-ghost px-3 py-1.5 text-xs">Edit</button>
        </div>
      )}

      <label className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>Customer / Party ka naam
        <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="jaise — Sharma ji, Green Valley Apartments"
          className="dim-input mt-1 w-full px-3 py-2.5" />
      </label>

      <div className="card p-1">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 p-2.5" style={{ borderBottom: "1px solid var(--surface-2)" }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{itemName(it)}</div>
              <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                {sizeFtIn(it.width)} × {sizeFtIn(it.height)} · {it.qty} nos · {(sqft(it.width, it.height) * it.qty).toFixed(1)} sqft
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: "var(--ink-3)" }}>₹</span>
              <input type="number" inputMode="numeric" value={rateFor(it) || ""}
                onChange={(e) => setRate(it, Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="rate" className="dim-input w-20 px-2 py-1.5 text-right" />
              <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>/sqft</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <div className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>GST</div>
          <div className="mt-1 flex gap-1">
            {[0, 18].map((g) => (
              <button key={g} onClick={() => setGstPct(g)}
                className={`chip flex-1 py-2 text-sm ${gstPct === g ? "selected" : ""}`}>{g ? `${g}%` : "No GST"}</button>
            ))}
          </div>
        </div>
        <label className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>Discount %
          <input type="number" value={discountPct || ""}
            onChange={(e) => setDiscountPct(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
            placeholder="0" className="dim-input mt-1 w-24 px-3 py-2.5 text-right" />
        </label>
      </div>

      {/* Gold, matching the printed quotation — the same number should not have
          two identities on screen and on paper. */}
      <div className="card flex items-center justify-between p-4"
        style={{ background: "rgba(176,134,40,.10)", border: "1px solid rgba(176,134,40,.35)" }}>
        <span className="text-sm font-semibold">Total (approx)</span>
        <span className="display text-xl font-extrabold" style={{ color: "#B08628" }}>₹ {Math.round(total).toLocaleString("en-IN")}</span>
      </div>

      <button onClick={onPrint} className="btn-primary w-full py-4 text-lg display" disabled={total <= 0}>
        📄 Customer ke liye quotation PDF save karo
      </button>
      <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
        Neeche live preview hai — PDF save karke party ko WhatsApp pe bhej do
      </p>
    </div>
  );
}

function ShopModal({ shop, onSave, onClose }: { shop: ShopProfile; onSave: (s: ShopProfile) => void; onClose: () => void }) {
  const [s, setS] = useState<ShopProfile>({ ...shop });
  const field = (k: keyof ShopProfile, label: string, ph: string, req = false) => (
    <label className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>{label}{req && " *"}
      <input value={s[k] ?? ""} onChange={(e) => setS((p) => ({ ...p, [k]: e.target.value }))}
        placeholder={ph} className="dim-input mt-1 w-full px-3 py-2.5" />
    </label>
  );
  return (
    <div className="no-print" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,14,20,.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }} onClick={onClose}>
      <div className="card w-full" style={{ maxWidth: 480, borderRadius: "18px 18px 0 0", padding: 20, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="display text-lg font-bold">🏪 Shop details</div>
        <p className="mb-3 text-xs" style={{ color: "var(--ink-3)" }}>Ye quotation ke header me aayega. Ek baar daalo.</p>
        <div className="flex flex-col gap-3">
          {field("name", "Shop ka naam", "M/s Shahid Aluminium & Glass", true)}
          {field("tagline", "Tagline (optional)", "Windows · Doors · Partitions")}
          {field("phone", "Phone", "+91 98xxxxxxx")}
          {field("address", "Address", "Shop no, market, city")}
          {field("gstin", "GSTIN (optional)", "22ABCDE1234F1Z5")}
          {field("upi", "UPI ID (optional)", "shopname@okhdfcbank — quotation pe Scan-to-Pay QR aayega")}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
          <button onClick={() => onSave({ ...s, name: (s.name ?? "").trim() })}
            className="btn-primary flex-[2] py-3" disabled={!(s.name ?? "").trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}

/* —— result sub-panels —— */

function AluminiumPanel({
  list, cost, aluRate, onRate, shop, plan, rawPlan, useStock, onToggleStock, onUseBank,
}: {
  list: MaterialList;
  cost: JobCost | null;
  aluRate: number;
  onRate: (v: number) => void;
  shop: ShopProfile;
  plan: OffcutPlan;
  rawPlan: OffcutPlan;
  useStock: boolean;
  onToggleStock: (v: boolean) => void;
  onUseBank: () => void;
}) {
  const shopName = shop.name || undefined;
  const tagline = shop.tagline || undefined;
  const hasGlass = list.glass.length > 0 || list.mesh.panels.length > 0 || list.sheet.panels.length > 0;
  const planBySection = useMemo(() => {
    const m = new Map<string, (typeof plan.sections)[number]>();
    for (const s of plan.sections) m.set(s.sectionId, s);
    return m;
  }, [plan]);
  const costBySection = useMemo(() => {
    const m = new Map<string, number>();
    cost?.sections.forEach((c) => m.set(c.sectionId, c.scrapCost));
    return m;
  }, [cost]);
  const priced = aluRate > 0 && !!cost;

  const totalPipes = list.totals.bars16 + list.totals.bars8 * 0.5;


  return (
    <div className="flex flex-col gap-3">
      {/* money-visible scrap strip */}
      <MoneyScrap cost={cost} aluRate={aluRate} onRate={onRate} totalWastePct={list.totals.wastePct} />

      {/* stock offer / applied plan */}
      <OffcutSavings plan={plan} rawPlan={rawPlan} useStock={useStock}
        onToggleStock={onToggleStock} aluRate={aluRate} onUseBank={onUseBank} />

      {/* premium per-section cards — pipe ka NAAM, size nahi */}
      {list.sections.map((s) => {
        const sec = getSection(s.sectionId);
        const barFt = sec.barLengthFt ?? 16;
        const halfFt = Math.round(barFt / 2);
        const pipes = s.bars16 + s.bars8 * 0.5;
        const scrapRs = costBySection.get(s.sectionId) ?? 0;
        return (
          <div key={s.sectionId} className="card p-3.5">
            <div className="flex items-center gap-3.5">
              <SectionProfile sectionId={s.sectionId} w={78} h={54} />
              <div className="min-w-0 flex-1">
                <div className="font-bold leading-tight">{sec.label}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="display text-2xl font-extrabold leading-none tabnum" style={{ color: "var(--accent)" }}>
                  {fmtPipes(pipes)}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                  pipe
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MetricChip label={`${barFt}' pipe`} value={s.bars16} />
              <MetricChip label={`${halfFt}' pipe`} value={s.bars8 || "—"} />
              <MetricChip label="Scrap" value={`${s.wastePct}%`} tone={s.wastePct > 20 ? "warn" : undefined} />
            </div>
            {(() => {
              const sp = planBySection.get(s.sectionId);
              if (!sp) return null;
              const saved = Math.max(0, sp.pipesBefore - sp.pipesAfter);
              const cuts = sp.uses.reduce((a, u) => a + u.pieces.length, 0);
              return (
                <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11px]"
                  style={{ background: "var(--good-soft)" }}>
                  <span style={{ color: "var(--ink-2)" }}>
                    ♻️ {cuts} cutting bache hue tukdon se — sirf {fmtPipes(sp.pipesAfter)} pipe khareedo
                  </span>
                  {saved > 0 && (
                    <span className="mono font-bold" style={{ color: "var(--good)" }}>−{fmtPipes(saved)} pipe</span>
                  )}
                </div>
              );
            })()}
            {priced && scrapRs > 0 && (
              <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[11px]"
                style={{ background: s.wastePct > 20 ? "var(--warn-soft)" : "var(--surface-2)" }}>
                <span style={{ color: "var(--ink-3)" }}>Is section me atka scrap</span>
                <span className="mono font-bold" style={{ color: s.wastePct > 20 ? "var(--warn)" : "var(--ink-2)" }}>{inr(scrapRs)}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* grand total — hero is what to buy once the bank is counted */}
      {(() => {
        const buy = Math.max(0, totalPipes - plan.pipesSaved);
        const saving = plan.pipesSaved > 0;
        return (
          <div className="card flex items-center justify-between p-4"
            style={{ background: saving ? "var(--good-soft)" : "var(--accent-soft)" }}>
            <div>
              <div className="eyebrow" style={{ color: saving ? "var(--good)" : "var(--accent)" }}>
                {saving ? "Khareedna kitna hai" : "Total Aluminium"}
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                {list.totals.bars16} × 16&apos;{list.totals.bars8 ? ` + ${list.totals.bars8} × 8'` : ""} · scrap {list.totals.wastePct}%
              </div>
              {saving && (
                <div className="text-[11px] font-semibold" style={{ color: "var(--good)" }}>
                  {fmtPipes(totalPipes)} chahiye — {fmtPipes(plan.pipesSaved)} bank se aa jayegi
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="display text-3xl font-extrabold tabnum"
                style={{ color: saving ? "var(--good)" : "var(--accent)" }}>{fmtPipes(buy)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>pipes</div>
            </div>
          </div>
        );
      })()}

      {/* glass / jali / sheet — same list, neeche */}
      <GlassBlock list={list} />

      {/* Two suppliers, two orders. The aluminium dealer and the glass shop are
          different people — they get different sheets, never one combined list. */}
      <SendOrder
        label="Aluminium supplier ko bhejo"
        sub={`${list.sections.length} section · ${fmtPipes(Math.max(0, (list.totals.bars16 + list.totals.bars8 * 0.5) - plan.pipesSaved))} pipe`}
        filename="aluminium-order.pdf"
        text={aluminiumWaText(list, plan, shopName)}
        build={() => buildOrderPdf({
          title: "Aluminium Order", shopName, tagline,
          blocks: [{
            rows: list.sections.map((s) => {
              const sec = getSection(s.sectionId);
              const full = sec.barLengthFt ?? 16;
              const parts: string[] = [];
              if (s.bars16) parts.push(`${s.bars16} x ${full}'`);
              if (s.bars8) parts.push(`${s.bars8} x ${full / 2}'`);
              return { left: sec.label, right: parts.join("  +  ") };
            }),
          }],
          total: `${fmtPipes(Math.max(0, (list.totals.bars16 + list.totals.bars8 * 0.5) - plan.pipesSaved))} pipe`,
          note: "FabriQ se bana — sizes deterministic engine se, AI se nahi.",
        })}
      />

      {hasGlass && (
        <SendOrder
          label="Glass / Jali supplier ko bhejo"
          sub={`${(list.glassSqft + list.mesh.sqft + list.sheet.sqft).toFixed(1)} sqft`}
          filename="glass-order.pdf"
          text={glassWaText(list, shopName)}
          build={() => buildOrderPdf({
            title: "Glass / Jali Order", shopName, tagline,
            blocks: [
              glassBlock("Glass", `${list.glassSqft.toFixed(1)} sqft`, list.glass),
              glassBlock("Jali / Mesh", `${list.mesh.sqft.toFixed(1)} sqft · spline ${list.mesh.splineFt} rft`, list.mesh.panels),
              glassBlock("Sheet", `${list.sheet.sqft.toFixed(1)} sqft`, list.sheet.panels),
            ].filter((b): b is PdfBlock => b !== null),
            note: "Har size finished panel ka hai — FabriQ se bana.",
          })}
        />
      )}

      <EngineVerified />
    </div>
  );
}

function glassBlock(heading: string, sub: string, panels: { width: Um; height: Um; count: number }[]): PdfBlock | null {
  if (!panels.length) return null;
  return {
    heading, sub,
    rows: panels.map((p) => ({
      left: `${formatFtInSut(p.width)}  x  ${formatFtInSut(p.height)}`,
      right: `${p.count} pcs`,
    })),
  };
}

/**
 * One supplier, one sheet. Tapping this builds the PDF, saves it, and hands
 * that same file to WhatsApp — on a phone through the native share sheet, on
 * desktop by downloading it and opening the chat (a wa.me link cannot carry a
 * file, so we never pretend it was attached automatically).
 */
function SendOrder({ label, sub, filename, text, build }: {
  label: string; sub: string; filename: string; text: string; build: () => Blob;
}) {
  const [state, setState] = useState<"idle" | "working" | "shared" | "downloaded">("idle");

  const go = async () => {
    setState("working");
    try {
      setState(await sharePdfToWhatsApp(build(), filename, text));
    } catch {
      setState("idle");
    }
  };

  return (
    <div className="no-print">
      <button onClick={go} disabled={state === "working"}
        className="btn-primary flex w-full items-center justify-between gap-3 px-4 py-3.5 disabled:opacity-60"
        style={{ background: "#25d366", boxShadow: "0 4px 14px rgba(37,211,102,.30)" }}>
        <span className="text-left">
          <span className="block text-sm font-bold">{state === "working" ? "PDF ban raha hai…" : label}</span>
          <span className="block text-[11px] opacity-90">{sub} · PDF</span>
        </span>
        <span className="text-lg">↗</span>
      </button>
      {state === "downloaded" && (
        <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
          PDF save ho gaya aur WhatsApp khul gaya — chat me wahi file attach kar do.
        </p>
      )}
      {state === "shared" && (
        <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--good)" }}>✓ PDF bhej diya</p>
      )}
    </div>
  );
}

/** Glass / jali / sheet sizes — Material list ke neeche, alag tab ki zaroorat nahi. */
function GlassBlock({ list }: { list: MaterialList }) {
  const rows: { title: string; sub: string; panels: { itemId: string; width: Um; height: Um; count: number }[] }[] = [];
  if (list.glass.length) rows.push({ title: "Glass", sub: `${list.glassSqft.toFixed(1)} sqft`, panels: list.glass });
  if (list.mesh.panels.length) rows.push({ title: "Jali / Mesh", sub: `${list.mesh.sqft.toFixed(1)} sqft · spline ${list.mesh.splineFt} rft`, panels: list.mesh.panels });
  if (list.sheet.panels.length) rows.push({ title: "Sheet", sub: `${list.sheet.sqft.toFixed(1)} sqft`, panels: list.sheet.panels });
  if (!rows.length) return null;

  return (
    <>
      {rows.map((r) => (
        <div key={r.title} className="card overflow-hidden">
          <div className="flex items-baseline justify-between px-4 py-2.5" style={{ background: "var(--surface-2)" }}>
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{r.title}</span>
            <span className="text-[11px] font-semibold tabnum" style={{ color: "var(--ink-2)" }}>{r.sub}</span>
          </div>
          {r.panels.map((g, i) => (
            <div key={i} className="flex items-center justify-between border-t px-4 py-3 text-sm" style={{ borderColor: "var(--surface-2)" }}>
              <span className="font-semibold">{g.itemId}</span>
              <span className="tabnum">{formatFtInSut(g.width)} × {formatFtInSut(g.height)}</span>
              <span className="font-bold tabnum">{g.count} pcs</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Offcut Bank ka asli faayda — kitni pipe kam khareedni padegi.
 * Sirf tab dikhta hai jab bank se sach me kuch kaam aa raha ho, aur ₹ tabhi
 * jab fabricator ne apna rate diya ho. Koi bana hua number nahi.
 */
function OffcutSavings({ plan, rawPlan, useStock, onToggleStock, aluRate, onUseBank }: {
  plan: OffcutPlan; rawPlan: OffcutPlan; useStock: boolean;
  onToggleStock: (v: boolean) => void; aluRate: number; onUseBank: () => void;
}) {
  // Snapshot at confirm time: once the bank is consumed the plan goes empty,
  // but the fabricator must still see what he just did.
  const [applied, setApplied] = useState<{ cuts: number; pipes: number; rupees: number } | null>(null);

  const cuts = plan.uses.reduce((a, u) => a + u.pieces.length, 0);
  // ₹ is on pipe NOT bought — not on the metal pulled out of the bank.
  const rupees = aluRate > 0 ? Math.round(plan.feetSaved * aluRate) : 0;

  // Stock available but not switched on yet — offer it, don't force it.
  if (!useStock && !applied) {
    if (!rawPlan.uses.length) return null;
    const offerCuts = rawPlan.uses.reduce((a, u) => a + u.pieces.length, 0);
    const offerRs = aluRate > 0 ? Math.round(rawPlan.feetSaved * aluRate) : 0;
    return (
      <div className="card p-4" style={{ background: "var(--good-soft)", border: "1px solid var(--good)" }}>
        <div className="display text-[15px] font-extrabold">
          ♻️ Dukaan me pade tukdon se {offerCuts} {offerCuts === 1 ? "cutting" : "cutting"} nikal jayegi
        </div>
        <div className="mt-1 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
          Pichle kaam ke jo tukde bach gaye the, unme se {offerCuts} cutting nikal sakti hai —
          phir <b style={{ color: "var(--good)" }}>{fmtPipes(rawPlan.pipesSaved)} pipe kam</b> khareedni padegi
          {offerRs > 0 ? `, lagbhag ${inr(offerRs)} ki bachat` : ""}.
          Material list aur cutting list dono usi hisaab se ban jayengi.
        </div>
        <button onClick={() => onToggleStock(true)} className="btn-dark mt-3 w-full py-3 text-sm">
          Bache hue tukde laga kar list banao
        </button>
      </div>
    );
  }

  if (applied) {
    return (
      <div className="card p-3.5" style={{ background: "var(--good-soft)" }}>
        <div className="text-[12.5px] font-bold" style={{ color: "var(--good)" }}>
          ✓ Bank se {applied.cuts} {applied.cuts === 1 ? "tukda" : "tukde"} kaat liye
        </div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
          {fmtPipes(applied.pipes)} pipe kam khareedni padi{applied.rupees > 0 ? ` — ${inr(applied.rupees)} bachi` : ""}.
          Bank update ho gaya, kaam layak bacha hua tukda wapas jama ho gaya.
        </div>
      </div>
    );
  }

  if (!plan.uses.length) return null;

  return (
    <div className="card p-4" style={{ background: "var(--good-soft)", border: "1px solid var(--good)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="display text-[15px] font-extrabold">
            ♻️ Bache hue tukde lag gaye — dono list update ho gayi
          </div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            {cuts} {cuts === 1 ? "cutting" : "cutting"} ({plan.feetFromBank}′) pade hue maal se ho jayegi —{" "}
            {fmtPipes(plan.pipesSaved)} pipe kam khareedni padegi
            {rupees > 0 ? `, lagbhag ${inr(rupees)} bachat` : ""}.
            Cutting list me har line par likha hai ki wo tukda naye pipe se kaatna hai ya bache hue se.
          </div>
        </div>
        {plan.pipesSaved > 0 && (
          <div className="shrink-0 text-right">
            <div className="display text-2xl font-extrabold tabnum" style={{ color: "var(--good)" }}>
              −{fmtPipes(plan.pipesSaved)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>pipe</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        {plan.uses.map((u, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
            <span className="font-bold" style={{ color: "var(--ink-2)" }}>
              {getSection(u.offcut.sectionId).label} · {formatFtInSut(u.offcut.length)}
            </span>
            <span className="mono" style={{ color: "var(--ink)" }}>
              → {u.pieces.map((p) => formatFtInSut(p.length)).join(" + ")}
            </span>
            {u.leftover > 0 && (
              <span className="mono" style={{ color: "var(--ink-3)" }}>· bachega {formatFtInSut(u.leftover)}</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={() => onToggleStock(false)} className="btn-ghost px-4 py-3 text-sm">
          Hatao
        </button>
        <button onClick={() => { setApplied({ cuts, pipes: plan.pipesSaved, rupees }); onUseBank(); }}
          className="btn-dark flex-1 py-3 text-sm">
          Kaat liye — bank se hata do
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10.5px]" style={{ color: "var(--ink-3)" }}>
        Ye tabhi dabaye jab tukde sach me kaat liye ho — tabhi wo bank se hatenge.
      </p>
    </div>
  );
}

/** Trust strip — har number deterministic engine se aata hai, AI se nahi. */
function EngineVerified() {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--good)" }}>
        ✓ Engine Verified
      </div>
      <div className="text-[11px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
        Deterministic calculation · catalogue profiles checked · cutting plan validated.
        Koi bhi measurement AI se generate nahi hui.
      </div>
    </div>
  );
}

function MetricChip({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  return (
    <div className="rounded-lg px-2 py-2 text-center" style={{ background: "var(--surface-2)" }}>
      <div className="display text-base font-extrabold tabnum" style={{ color: tone === "warn" ? "var(--warn)" : "var(--ink)" }}>{value}</div>
      <div className="text-[9.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{label}</div>
    </div>
  );
}

/** Money-visible scrap: turns waste feet into rupees at the shop's own rate. */
function MoneyScrap({
  cost, aluRate, onRate, totalWastePct,
}: {
  cost: JobCost | null;
  aluRate: number;
  onRate: (v: number) => void;
  totalWastePct: number;
}) {
  const [editing, setEditing] = useState(aluRate <= 0);
  const [draft, setDraft] = useState(aluRate > 0 ? String(aluRate) : "");
  const priced = aluRate > 0 && !!cost;

  if (!priced || editing) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ic.Rupee size={16} /> Aluminium rate set karo — scrap ka paisa dikhega
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>
          Aap jis rate pe pipe kharidte ho — ₹ per running foot (blended). Ek baar set karo, yaad rahega.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--ink-2)" }}>₹</span>
          <input
            type="number" min={0} inputMode="decimal" value={draft} placeholder="e.g. 45"
            onChange={(e) => setDraft(e.target.value)}
            className="dim-input w-28 px-3 py-2 text-sm" />
          <span className="text-sm" style={{ color: "var(--ink-3)" }}>/ foot</span>
          <button
            onClick={() => { onRate(Math.max(0, parseFloat(draft) || 0)); setEditing(false); }}
            disabled={!(parseFloat(draft) > 0)}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    );
  }

  const tone = totalWastePct > 20 ? "var(--warn)" : "var(--good)";
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-2 divide-x" style={{ borderColor: "var(--line)" }}>
        <div className="p-4">
          <div className="eyebrow">Aluminium Cost</div>
          <div className="display mt-1 text-2xl font-extrabold mono">{inr(cost!.totalCost)}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {Math.round(cost!.boughtFt)}&apos; bars @ ₹{aluRate}/ft
          </div>
        </div>
        <div className="p-4" style={{ background: totalWastePct > 20 ? "var(--warn-soft)" : "var(--good-soft)" }}>
          <div className="eyebrow" style={{ color: tone }}>Locked in Scrap</div>
          <div className="display mt-1 text-2xl font-extrabold mono" style={{ color: tone }}>{inr(cost!.scrapCost)}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>
            {Math.round(cost!.scrapFt)}&apos; waste · {totalWastePct}%
          </div>
        </div>
      </div>
      <button
        onClick={() => { setDraft(String(aluRate)); setEditing(true); }}
        className="flex w-full items-center justify-center gap-1.5 border-t py-2 text-[11px]"
        style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
        <Ic.Pencil size={12} /> Rate: ₹{aluRate}/ft — badlo
      </button>
    </div>
  );
}

/** Offcut Bank — save leftover bar pieces from this job, browse what's saved. */
function OffcutsPanel({
  candidates, aluRate, jobLabel,
}: {
  candidates: OffcutCandidate[];
  aluRate: number;
  jobLabel?: string;
}) {
  const [bank, setBank] = useState<Offcut[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBank(loadOffcuts());
    setSelected(new Set(candidates.map((c) => c.key)));
  }, [candidates]);

  const toggle = (key: string) =>
    setSelected((p) => {
      const next = new Set(p);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const save = () => {
    const picked = candidates.filter((c) => selected.has(c.key));
    if (!picked.length) return;
    setBank(addOffcuts(picked, jobLabel));
    setSaved(true);
  };

  const remove = (id: string) => setBank(removeOffcut(id));

  const priced = aluRate > 0;
  const bankFt = totalOffcutFt(bank);
  const bankValue = bankFt * aluRate;

  const bankBySection = useMemo(() => {
    const m = new Map<string, Offcut[]>();
    for (const o of bank) m.set(o.sectionId, [...(m.get(o.sectionId) ?? []), o]);
    return [...m.entries()];
  }, [bank]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4 text-xs" style={{ color: "var(--ink-2)" }}>
        ♻️ <span className="font-bold">Offcut Bank:</span> har bar ka bacha hua tukda (1&apos; ya
        usse zyada) yahan save karo. Agla kaam shuru karne se pehle yahan check karo — naya pipe
        kam order karna padega.
      </div>

      {candidates.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--line)" }}>
            <div>
              <div className="font-bold">Is job se bachega</div>
              <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                {candidates.length} tukde, 1&apos;+ lambe — chuno jo rakhne layak hain
              </div>
            </div>
            <button onClick={save} disabled={selected.size === 0}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40">
              {saved ? "✓ Saved" : `Save (${selected.size})`}
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--line)" }}>
            {candidates.map((c) => {
              const sec = getSection(c.sectionId);
              const on = selected.has(c.key);
              return (
                <label key={c.key} className="flex cursor-pointer items-center gap-3 p-3.5">
                  <input type="checkbox" checked={on} onChange={() => toggle(c.key)} className="h-4 w-4" />
                  <span className="shrink-0 rounded-md p-1" style={{ background: "var(--surface-2)" }}>
                    <SectionProfile sectionId={c.sectionId} />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{sec.label}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>Bar #{c.barNo}</div>
                  </div>
                  <div className="mono text-sm font-bold">{formatFtInSut(c.length)}</div>
                  {priced && (
                    <div className="mono text-xs" style={{ color: "var(--good)" }}>
                      {inr(toFeet(c.length) * aluRate)}
                    </div>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--line)" }}>
          <div className="font-bold">Your Offcut Bank</div>
          <div className="text-right">
            <div className="mono text-sm font-bold">{bankFt.toFixed(1)}&apos;</div>
            {priced && <div className="mono text-[11px]" style={{ color: "var(--good)" }}>{inr(bankValue)}</div>}
          </div>
        </div>
        {bank.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "var(--ink-3)" }}>
            Abhi khaali hai — upar se offcuts save karo.
          </div>
        ) : (
          bankBySection.map(([sectionId, offs]) => {
            const sec = getSection(sectionId);
            return (
              <div key={sectionId} className="border-t p-3" style={{ borderColor: "var(--line)" }}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <SectionProfile sectionId={sectionId} />
                  <span className="text-sm font-semibold">{sec.label}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {offs.map((o) => (
                    <div key={o.id} className="chip flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="mono font-semibold">{formatFtInSut(o.length)}</span>
                      <button onClick={() => remove(o.id)} style={{ color: "var(--ink-3)" }} title="Use kar liya / remove">
                        <Ic.X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Branded header for the Workshop Cutting Sheet. */
function SheetHeader({ shop, title, stats }: { shop: ShopProfile; title: string; stats?: React.ReactNode }) {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4"
        style={{ background: "linear-gradient(120deg,#14181d,#232a34)", color: "#fff" }}>
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold">{shop.name || "Your Workshop"}</div>
          <div className="text-[11px]" style={{ color: "#c2c8d0" }}>
            {[shop.phone, shop.gstin && `GSTIN ${shop.gstin}`].filter(Boolean).join(" · ") || "Internal fabrication sheet"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="rounded-full px-3 py-1 text-[11px] font-extrabold"
            style={{ background: "linear-gradient(180deg,var(--accent-2),var(--accent))", letterSpacing: ".1em" }}>{title}</div>
          <div className="mt-1.5 text-[11px] mono" style={{ color: "#c2c8d0" }}>{date}</div>
        </div>
      </div>
      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 py-3" style={{ background: "var(--surface-2)" }}>{stats}</div>
      )}
    </div>
  );
}

function SheetStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className="mono text-lg font-extrabold" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

/** Isolate a `.print-sheet` block and print it alone. */
function printSheet() {
  document.body.classList.add("printing-sheet");
  const cleanup = () => { document.body.classList.remove("printing-sheet"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  window.print();
  setTimeout(cleanup, 1500);
}

/** "S1 Bearing Top" / "S3 Handle (Jali)" → "Bearing Top" / "Handle" — shutter
 *  number aur glass/jali qualifier hata ke role ka asli naam. */
function baseRole(role: string): string {
  return role.replace(/^S\d+\s+/, "").replace(/\s*\((Jali|Glass|Sheet)\)\s*$/i, "").trim();
}

interface CutRow {
  key: string; label: string; count: number; forWhat: string;
  /** true = ye tukde dukaan me pade bache hue maal se kaatne hain */
  fromLeftover: boolean;
}

function rollUp(pieces: CutPiece[]) {
  const map = new Map<number, { count: number; roles: Set<string>; items: Set<string> }>();
  for (const p of pieces) {
    const e = map.get(p.length) ?? { count: 0, roles: new Set<string>(), items: new Set<string>() };
    e.count += 1; e.roles.add(baseRole(p.role)); e.items.add(p.itemId);
    map.set(p.length, e);
  }
  return map;
}

/**
 * Ek cut list — same length ek hi row me ("57\" × 5", paanch rows nahi), aur
 * har row batati hai maal kahan se aayega: naya pipe ya dukaan me pada tukda.
 * Dono ek hi table me hain taaki cutter se koi row chhoot na jaye.
 */
function buildCutRows(bars: PackedBar[], leftoverPieces: CutPiece[]): CutRow[] {
  const fresh = rollUp(bars.flatMap((b) => b.pieces));
  const used = rollUp(leftoverPieces);

  const rows: CutRow[] = [];
  const push = (len: number, e: { count: number; roles: Set<string>; items: Set<string> }, fromLeftover: boolean) => {
    const roles = [...e.roles];
    const shown = roles.slice(0, 3).join(" · ") + (roles.length > 3 ? ` +${roles.length - 3}` : "");
    rows.push({
      key: `${fromLeftover ? "L" : "N"}${len}`,
      label: formatFtInSut(len),
      count: e.count,
      forWhat: `${shown} — ${[...e.items].join(", ")}`,
      fromLeftover,
    });
  };
  for (const [len, e] of used) push(len, e, true);
  for (const [len, e] of fresh) push(len, e, false);

  // lambe tukde pehle; ek hi length par pade-maal wali row upar
  return rows.sort((a, b) => {
    const la = parseFloat(a.key.slice(1)), lb = parseFloat(b.key.slice(1));
    return lb - la || (a.fromLeftover === b.fromLeftover ? 0 : a.fromLeftover ? -1 : 1);
  });
}

/** Ek pipe ki packing ek line me: 57" ×3 + 42" */
function packLine(pieces: CutPiece[]) {
  const map = new Map<number, number>();
  for (const p of pieces) map.set(p.length, (map.get(p.length) ?? 0) + 1);
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, n]) => `${formatFtInSut(len)}${n > 1 ? ` ×${n}` : ""}`)
    .join("  +  ");
}

/** Numbered divider that turns the workshop sheet into one readable document. */
function StepBar({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mt-2 flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white"
        style={{ background: "var(--ink)" }}>{n}</span>
      <div>
        <div className="display text-base font-extrabold leading-tight">{title}</div>
        <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{sub}</div>
      </div>
    </div>
  );
}

function CuttingPanel({ list, shop, items, plan }: {
  list: MaterialList; shop: ShopProfile; items: JobItem[]; plan: OffcutPlan;
}) {
  const planBySection = useMemo(() => {
    const m = new Map<string, (typeof plan.sections)[number]>();
    for (const s of plan.sections) m.set(s.sectionId, s);
    return m;
  }, [plan]);
  const sectionGroups = useMemo(() => {
    const map = new Map<string, typeof list.bars>();
    for (const b of list.bars) {
      const arr = map.get(b.sectionId) ?? [];
      arr.push(b);
      map.set(b.sectionId, arr);
    }
    return [...map.entries()];
  }, [list.bars]);

  const hasDomal = list.sections.some((s) => s.sectionId.startsWith("domal_"));
  const hasDoor = list.sections.some((s) => s.sectionId.startsWith("door_"));
  const hasPartition = list.sections.some((s) => s.sectionId.startsWith("partition_"));
  const hasNormal = list.sections.some(
    (s) =>
      !s.sectionId.startsWith("domal_") &&
      !s.sectionId.startsWith("door_") &&
      !s.sectionId.startsWith("partition_")
  );
  const totalPieces = list.bars.reduce((a, b) => a + b.pieces.length, 0);
  // Pipes the shop actually buys, in the same full-bar units the material list
  // uses — so both sheets always quote the same number.
  const needPipes = list.totals.bars16 + list.totals.bars8 * 0.5;
  const buyPipes = Math.max(0, needPipes - plan.pipesSaved);
  const stockCuts = plan.uses.reduce((a, u) => a + u.pieces.length, 0);

  return (
    <div className="print-sheet flex flex-col gap-4">
      <SheetHeader shop={shop} title="WORKSHOP CUTTING SHEET" stats={
        <>
          <SheetStat label={stockCuts ? "Naye Pipe" : "Total Pipes"} value={fmtPipes(buyPipes)} tone="var(--accent)" />
          {stockCuts > 0 && (
            <SheetStat label="Bache tukdon se" value={`${stockCuts} cutting`} tone="var(--good)" />
          )}
          <SheetStat label="Cut Pieces" value={String(totalPieces)} />
          <SheetStat label="Sections" value={String(sectionGroups.length)} />
          <SheetStat label="Scrap" value={`${list.totals.wastePct}%`} tone={list.totals.wastePct > 20 ? "var(--warn)" : "var(--good)"} />
        </>
      } />

      {/* The karigar's copy — drawings and cut lists, saved as a PDF he can be
          sent on WhatsApp. */}
      <button onClick={printSheet} className="btn-dark no-print w-full py-3.5 display">
        📄 Karigar ke liye PDF save karo
      </button>

      {/* STEP 1 — kya banana hai: har opening ki dimensioned drawing + parts */}
      <StepBar n={1} title="Kya banana hai" sub="Har opening ki drawing, sections aur parts" />
      {items.map((it) => (
        <EngineeringSheet key={it.id} item={it} list={list} shop={shop} />
      ))}

      {/* STEP 2 — kaise kaatna hai: section-wise saw plan */}
      <StepBar n={2} title="Kaise kaatna hai" sub="Section-wise cut list aur pipe se packing" />

      {hasNormal && <CuttingGuide system="normal" />}
      {hasDomal && <CuttingGuide system="domal" />}
      {hasDoor && (
        <div className="card p-4 text-xs" style={{ color: "var(--ink-2)" }}>
          🚪 <span className="font-bold">Door ke parts:</span> Chokhat (agar banani hai) + Palla
          (leaf, charo side ek profile se) + Center Rail (jitne hisse utne rail, palla ko baantte hain).
        </div>
      )}
      {hasPartition && (
        <div className="card p-4 text-xs" style={{ color: "var(--ink-2)" }}>
          🧱 <span className="font-bold">Partition ke parts:</span> SP (perimeter frame) + DP
          (divider, jitne hisse utni DP) + Glazing Clip (panel ko pakadta hai, sheet/glass ke
          perimeter ke hisab se).
        </div>
      )}

      {sectionGroups.map(([sectionId, engineBars]) => {
        const sec = getSection(sectionId);
        const sp = planBySection.get(sectionId);
        // With shop stock switched on, the workshop follows the re-packed plan:
        // some cuts come off stock pieces, the rest off fewer fresh bars.
        const bars = sp ? sp.barsAfter : engineBars;
        const stockPieces = sp ? sp.uses.flatMap((u) => u.pieces) : [];
        const b16 = bars.filter((b) => Math.round(toFeet(b.barLength)) >= 15).length;
        const b8 = bars.length - b16;
        return (
          <div key={sectionId} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-2)" }}>
              <div className="display font-bold">{sec.label}</div>
              <div className="text-right">
                <div className="display text-lg font-extrabold" style={{ color: "var(--accent)" }}>{bars.length}</div>
                <div className="text-[10px] font-bold" style={{ color: "var(--ink-3)" }}>
                  {b16 > 0 ? `${b16}×16'` : ""}{b8 > 0 ? `${b16 > 0 ? " + " : ""}${b8}×8'` : ""}
                </div>
              </div>
            </div>
            {/* real engineering cross-section */}
            <div className="border-b px-4 py-3" style={{ borderColor: "var(--surface-2)" }}>
              <SectionDrawing sectionId={sectionId} />
            </div>
            {/* CUT LIST — har row batati hai maal kahan se aayega, taaki cutter
                galti se naya pipe na kaat de */}
            {/* No minWidth and no tick column on a phone: a cut list that needs
                sideways scrolling is useless standing at the saw. The tick box
                comes back on wider screens and in print. */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>
                    {["Length", "Tukde", "Kahan se kaatna", "Kis kaam ka", "✓ mark"].map((h, i) => (
                      <th key={h}
                        className={`px-2 py-2 text-[11px] font-bold uppercase tracking-wide sm:px-3 ${i === 4 ? "hidden sm:table-cell" : ""}`}
                        style={{ textAlign: i === 1 ? "center" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildCutRows(bars, stockPieces).map((g) => (
                    <tr key={g.key} style={{
                      borderBottom: "1px solid var(--surface-2)",
                      background: g.fromLeftover ? "var(--good-soft)" : undefined,
                    }}>
                      <td className="px-2 py-2.5 mono text-base font-bold sm:px-3" style={{ color: "var(--accent)" }}>{g.label}</td>
                      <td className="px-2 py-2.5 text-center sm:px-3">
                        <span className="display text-lg font-extrabold tabnum">{g.count}</span>
                      </td>
                      <td className="px-2 py-2.5 text-[11.5px] font-bold sm:px-3"
                        style={{ color: g.fromLeftover ? "var(--good)" : "var(--ink-2)" }}>
                        {g.fromLeftover ? "♻️ Bache tukde se" : "Naye pipe se"}
                      </td>
                      <td className="px-2 py-2.5 text-xs sm:px-3" style={{ color: "var(--ink-2)" }}>{g.forWhat}</td>
                      <td className="hidden px-3 py-2.5 sm:table-cell"><span style={{ display: "inline-block", width: 40, borderBottom: "1px solid var(--line)" }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* kaunsa maal uthana hai — pade tukde pehle, phir naye pipe */}
            <div className="border-t px-4 py-3" style={{ borderColor: "var(--surface-2)" }}>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
                Kaunsa maal uthao, usme se kya kaatna
              </div>
              <div className="flex flex-col gap-1">
                {sp?.uses.map((u, i) => (
                  <div key={`l${i}`} className="flex flex-wrap items-baseline gap-x-2 rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: "var(--good-soft)" }}>
                    <span className="font-bold" style={{ color: "var(--good)" }}>
                      ♻️ Bacha hua {formatFtInSut(u.offcut.length)} ka tukda
                      {u.offcut.jobLabel ? ` — ${u.offcut.jobLabel}` : ""}
                    </span>
                    <span className="mono font-bold" style={{ color: "var(--ink)" }}>{packLine(u.pieces)}</span>
                    {u.leftover > 0 && (
                      <span className="mono" style={{ color: "var(--ink-3)" }}>· phir bhi bachega {formatFtInSut(u.leftover)}</span>
                    )}
                  </div>
                ))}
                {bars.map((bar, bi) => (
                  <div key={`n${bi}`} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className="font-bold" style={{ color: "var(--ink-2)" }}>
                      Naya pipe {bi + 1} ({Math.round(toFeet(bar.barLength))}&apos;)
                    </span>
                    <span className="mono" style={{ color: "var(--ink)" }}>
                      {packLine(bar.pieces)}
                    </span>
                    {bar.waste > 0 && (
                      <span className="mono" style={{ color: "var(--ink-3)" }}>· bachat {formatFtInSut(bar.waste)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ————————————————— shared bits ————————————————— */

function Header({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="btn-ghost h-10 w-10 shrink-0 rounded-full text-lg">←</button>
      )}
      <div>
        <h1 className="display text-xl font-extrabold">{title}</h1>
        {sub && <p className="text-xs" style={{ color: "var(--ink-2)" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
      {children}
    </span>
  );
}

function Stat({ label, value, tone, sub }: {
  label: string; value: string | number; tone?: "good" | "warn" | "accent"; sub?: string;
}) {
  return (
    <div className="card px-2 py-3.5 text-center">
      <div className="display text-2xl font-extrabold"
        style={{ color: tone === "warn" ? "var(--warn)" : tone === "good" ? "var(--good)" : tone === "accent" ? "var(--accent)" : "var(--ink)" }}>
        {value}
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
        {label}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] leading-tight" style={{ color: "var(--ink-3)" }}>{sub}</div>
      )}
    </div>
  );
}

/** Fractional "pipes" — 1 → "1", 1.5 → "1.5" (a 16'+8' combo reads as 1.5). */
function fmtPipes(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Spinner({ tiny }: { tiny?: boolean }) {
  const s = tiny ? 14 : 28;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" className="inline animate-spin">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--steel)" strokeWidth="3" />
      <path d="M12 2 a10 10 0 0 1 10 10" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ————————————————— SETTINGS ————————————————— */

function SettingsModal({
  current, onSave, onClose,
}: {
  current: string | null; onSave: (k: string) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(current ?? "");
  const [adv, setAdv] = useState(false);
  const [provider, setProvider] = useState<"anthropic" | "openrouter">("anthropic");
  const [orKey, setOrKey] = useState("");
  const [orModel, setOrModel] = useState("");

  useEffect(() => {
    try {
      setProvider((localStorage.getItem("fabriq_ai_provider") as "anthropic" | "openrouter" | null) ?? "anthropic");
      setOrKey(localStorage.getItem("fabriq_or_key") || "");
      setOrModel(localStorage.getItem("fabriq_ai_model") || "");
    } catch { /* ignore */ }
  }, []);

  const saveAll = () => {
    try {
      localStorage.setItem("fabriq_ai_provider", provider);
      if (orKey) localStorage.setItem("fabriq_or_key", orKey); else localStorage.removeItem("fabriq_or_key");
      if (orModel) localStorage.setItem("fabriq_ai_model", orModel); else localStorage.removeItem("fabriq_ai_model");
    } catch { /* ignore */ }
    onSave(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}>
      <div className="card w-full max-w-md p-5" style={{ maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h2 className="display text-lg font-bold">⚙️ Settings</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--ink-2)" }}>
          Photo padhna, AI sawaal aur AI review ke liye ek AI key chahiye.
          Key sirf tumhare phone/browser mein save hoti hai, kahin bhejte nahi.
        </p>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          AI Key
        </label>
        <input
          type="password"
          placeholder="Yahan paste karo…"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="dim-input mt-1.5 w-full px-3 py-3 font-mono text-sm"
        />
        {/* App khud pehchan leta hai kaunsi company ki key hai — fabricator ko
            "provider" ka naam yaad rakhne ki zaroorat nahi. */}
        <p className="mt-2 text-[11px]" style={{ color: "var(--ink-3)" }}>
          Free key: <b>aistudio.google.com</b> → Get API key<br />
          Ya: <b>console.anthropic.com</b> → API Keys
        </p>

        {/* advanced — multi-model gateway */}
        <button onClick={() => setAdv((a) => !a)} className="mt-4 flex w-full items-center justify-between text-xs font-bold"
          style={{ color: "var(--ink-2)" }}>
          <span>Advanced — Copilot AI provider</span>
          <span>{adv ? "▲" : "▼"}</span>
        </button>
        {adv && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
            <div className="flex gap-2">
              {(["anthropic", "openrouter"] as const).map((p) => (
                <button key={p} onClick={() => setProvider(p)}
                  className={`chip flex-1 py-2 text-xs font-semibold ${provider === p ? "selected" : ""}`}>
                  {p === "anthropic" ? "Anthropic (direct)" : "OpenRouter (multi-model)"}
                </button>
              ))}
            </div>
            {provider === "openrouter" ? (
              <>
                <input type="password" placeholder="OpenRouter key — sk-or-…" value={orKey}
                  onChange={(e) => setOrKey(e.target.value)} className="dim-input w-full px-3 py-2.5 font-mono text-sm" />
                <input placeholder="Model — jaise anthropic/claude-3.5-sonnet" value={orModel}
                  onChange={(e) => setOrModel(e.target.value)} className="dim-input w-full px-3 py-2.5 text-sm" />
                <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                  Copilot chat OpenRouter ke kisi bhi model pe chalega (sasta/fast model choose kar sakte ho). Photo-read abhi Anthropic pe hi rahega.
                </p>
              </>
            ) : (
              <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>Copilot Anthropic key hi use karega.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={saveAll} className="btn-primary flex-1 py-3">
            Save
          </button>
          <button onClick={onClose} className="btn-ghost px-5 py-3">
            Band karo
          </button>
        </div>
        {current && (
          <button onClick={() => onSave("")} className="mt-3 w-full text-center text-xs underline"
            style={{ color: "var(--bad)" }}>
            Key hatao
          </button>
        )}
      </div>
    </div>
  );
}

/* ————————————————— WhatsApp text ————————————————— */

/**
 * A fabricator does not send one list to everyone. The aluminium dealer only
 * wants sections and bar counts; the glass shop only wants panel sizes. Two
 * separate messages, each readable straight in the chat window.
 */
function aluminiumWaText(list: MaterialList, plan: OffcutPlan, shopName?: string): string {
  const L: string[] = [];
  L.push(`*Aluminium order${shopName ? ` — ${shopName}` : ""}*`);
  L.push("");
  for (const s of list.sections) {
    const sec = getSection(s.sectionId);
    const full = sec.barLengthFt ?? 16;
    const sp = plan.sections.find((p) => p.sectionId === s.sectionId);
    const parts: string[] = [];
    if (s.bars16) parts.push(`${s.bars16} × ${full}'`);
    if (s.bars8) parts.push(`${s.bars8} × ${full / 2}'`);
    const line = `• ${sec.label} — ${parts.join(" + ")}`;
    L.push(sp ? `${line}  (${fmtPipes(sp.pipesAfter)} pipe hi chahiye)` : line);
  }
  const need = list.totals.bars16 + list.totals.bars8 * 0.5;
  const buy = Math.max(0, need - plan.pipesSaved);
  L.push("");
  L.push(`*Total: ${fmtPipes(buy)} pipe*`);
  return L.join("\n");
}

function glassWaText(list: MaterialList, shopName?: string): string {
  const L: string[] = [];
  L.push(`*Glass / Jali order${shopName ? ` — ${shopName}` : ""}*`);
  const block = (title: string, sub: string, panels: { width: Um; height: Um; count: number }[]) => {
    if (!panels.length) return;
    L.push("");
    L.push(`*${title}* — ${sub}`);
    for (const p of panels) L.push(`• ${formatFtInSut(p.width)} × ${formatFtInSut(p.height)} — ${p.count} pcs`);
  };
  block("Glass", `${list.glassSqft.toFixed(1)} sqft`, list.glass);
  block("Jali / Mesh", `${list.mesh.sqft.toFixed(1)} sqft + spline ${list.mesh.splineFt} rft`, list.mesh.panels);
  block("Sheet", `${list.sheet.sqft.toFixed(1)} sqft`, list.sheet.panels);
  return L.join("\n");
}
