/**
 * Counts the steps that matter — a material list made, an order sent — as
 * page views on made-up paths ("/done/material-list"), so they show up in
 * Vercel Web Analytics on the free plan (custom events need Pro). Nothing
 * about the job or the shop is sent: only the step's name.
 */
import { pageview } from "@vercel/analytics";
import { loadProjects } from "@/lib/projects";

export type Step =
  | "material-list"
  | "cutting-sheet"
  | "sent/aluminium-order"
  | "sent/glass-order"
  | "sent/cutting-sheet"
  | `shared-app/${"banner" | "card" | "home"}`;

/**
 * Where this phone first came from (a QR, a friend's share, Instagram…),
 * kept for good. Every step is then counted a second time under
 * "/via/<source>/<step>", so a report can follow each source all the way:
 * how many came, how many made a material list, sent an order, installed,
 * came back. Nothing about the person or the job is sent.
 */
const VIA_KEY = "fabriq.via";
function via(): string | null {
  try { return localStorage.getItem(VIA_KEY); } catch { return null; }
}

function view(path: string): void {
  try {
    pageview({ route: path, path });
  } catch {
    /* analytics blocked or not loaded — the app works the same */
  }
}

export function markStep(step: Step): void {
  view(`/done/${step}`);
  const v = via();
  if (v) view(`/via/${v}/${step}`);
  // per phone, for the "who comes back" report: lists made and orders sent
  const u = uid();
  if (u && (step === "material-list" || step.startsWith("sent/"))) view(`/u/${u}/${step}`);
}

/**
 * Where the visitor came from — the `utm_source` on the link or QR (e.g. the
 * Diwali sweet-box QR carries `diwali_box`). The free plan cannot break
 * visits down by UTM, so the source is counted as a view of "/from/<source>"
 * (and "/from/<source>/<campaign>" when a campaign is set), once per visit.
 */
export function markSource(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const clean = (v: string | null) => (v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const src = clean(q.get("utm_source"));
    if (!src) return;
    const camp = clean(q.get("utm_campaign"));
    // first source wins: the jump on to Chrome is not a source of its own
    if (src !== "open-in-chrome" && !localStorage.getItem(VIA_KEY)) localStorage.setItem(VIA_KEY, src);
    const path = `/from/${src}${camp ? `/${camp}` : ""}`;
    if (sessionStorage.getItem("fabriq.from") === path) return; // a reload is not a new visit
    // <Analytics> sets up window.va a moment after the page mounts: wait for
    // it (up to ~5 s), or the view is dropped without a sound.
    let tries = 0;
    const send = () => {
      const w = window as unknown as { va?: unknown };
      if (typeof w.va === "function") {
        pageview({ route: path, path });
        sessionStorage.setItem("fabriq.from", path);
      } else if (++tries < 25) setTimeout(send, 200);
    };
    send();
  } catch {
    /* storage or analytics blocked — the app works the same */
  }
}

/** Sends a view of `path` once <Analytics> is ready (it sets up window.va a
 *  moment after the page mounts); gives up quietly after ~5 s. */
function sendWhenReady(path: string, onSent?: () => void): void {
  let tries = 0;
  const send = () => {
    try {
      const w = window as unknown as { va?: unknown };
      if (typeof w.va === "function") { pageview({ route: path, path }); onSent?.(); }
      else if (++tries < 25) setTimeout(send, 200);
    } catch { /* analytics blocked — nothing to count */ }
  };
  send();
}

/**
 * The installed app: an install is counted as /done/installed when the phone
 * adds FabriQ to its home screen, and an opening from the home screen
 * (standalone display, or iOS's navigator.standalone) as /from/home-screen,
 * once per session — the shops that keep FabriQ on their phone and use it.
 */
export function markInstalls(): void {
  try {
    window.addEventListener("appinstalled", () => {
      sendWhenReady("/done/installed");
      const v = via();
      if (v) sendWhenReady(`/via/${v}/installed`);
    }, { once: true });
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone || sessionStorage.getItem("fabriq.home") === "1") return;
    sendWhenReady("/from/home-screen", () => sessionStorage.setItem("fabriq.home", "1"));
    const v = via();
    if (v) sendWhenReady(`/via/${v}/home-screen`);
    // tie the opening to the phone's code, so the report can say which of
    // the people who made lists or sent orders came in through the icon
    sendWhenReady(`/u/${ensureUid()}/home-screen`);
  } catch {
    /* storage or analytics blocked — the app works the same */
  }
}

/** One opening as the report needs it: what kind, which system, how built, how big. */
export interface MadeItem { type: string; system: string; label: string; wFt: number; hFt: number; qty: number }

const slug = (v: string) => v.replace(/undefined|null/g, "").toLowerCase().replace(/×/g, "x").replace(/[^a-z0-9.x]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const half = (ft: number) => (Math.round(ft * 2) / 2).toString();

/**
 * What the material list was made for — counted as views of made-up paths so
 * the report can say what fabricators build most:
 *   /made/<type>/<system>/<how it is built>   once per opening, weighted by qty
 *   /size/<type>/<w>x<h>                      size to the nearest half foot
 *   /job/pcs/<n>, /job/unit/<ft|in|mm>        size of the job, unit typed in
 * No customer name, shop or price leaves the phone. The same job shown again
 * in the same visit is not counted twice.
 */
export function markMade(items: MadeItem[], unit: string): void {
  if (!items.length) return;
  try {
    const key = JSON.stringify(items);
    if (sessionStorage.getItem("fabriq.made") === key) return;
    sessionStorage.setItem("fabriq.made", key);
  } catch { /* storage blocked — count it anyway */ }
  let pcs = 0;
  for (const it of items) {
    const n = Math.min(Math.max(1, it.qty), 50);
    pcs += it.qty;
    const made = `/made/${slug(it.type)}/${slug(it.system)}/${slug(it.label)}`;
    const size = `/size/${slug(it.type)}/${half(it.wFt)}x${half(it.hFt)}`;
    for (let i = 0; i < n; i++) { view(made); view(size); }
  }
  const bucket = pcs <= 1 ? "1" : pcs <= 3 ? "2-3" : pcs <= 5 ? "4-5" : pcs <= 10 ? "6-10" : pcs <= 20 ? "11-20" : "21+";
  view(`/job/pcs/${bucket}`);
  view(`/job/unit/${slug(unit)}`);
}

/* —— the same person, day after day ——
 * Vercel forgets a visitor after a day, so "14 people today" cannot say how
 * many came yesterday too. Each phone gets a short random code of its own
 * (no name, no number — the code is all the report ever sees), and once a
 * day the app says: this code is here, new or returning, since when, and on
 * how many days so far.
 */
const UID_KEY = "fabriq.uid";
function uid(): string | null {
  try { return localStorage.getItem(UID_KEY); } catch { return null; }
}
/** this phone's code, made on first need (storage errors are the caller's) */
function ensureUid(): string {
  let id = localStorage.getItem(UID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 8);
    localStorage.setItem(UID_KEY, id);
  }
  return id;
}
/** today in India, YYYY-MM-DD */
const istDay = (t: number) => new Date(t + 5.5 * 3600_000).toISOString().slice(0, 10);

export function markVisitor(): void {
  try {
    const today = istDay(Date.now());
    if (localStorage.getItem("fabriq.seen") === today) return; // counted today already
    const id = ensureUid();
    // first day: kept from the first visit after this change; for a phone that
    // was here before, its oldest saved job says when it started
    let first = localStorage.getItem("fabriq.first");
    let isNew = false;
    if (!first) {
      const oldest = loadProjects().reduce((m, p) => Math.min(m, p.created || Infinity), Infinity);
      first = Number.isFinite(oldest) ? istDay(oldest) : today;
      isNew = !Number.isFinite(oldest);
      localStorage.setItem("fabriq.first", first);
    }
    const days: string[] = JSON.parse(localStorage.getItem("fabriq.days") || "[]");
    if (!days.includes(today)) days.push(today);
    localStorage.setItem("fabriq.days", JSON.stringify(days.slice(-120)));
    const since = Math.round((Date.parse(today) - Date.parse(first)) / 86400_000);
    const sinceB = since === 0 ? "0" : since <= 3 ? "1-3" : since <= 7 ? "4-7" : since <= 14 ? "8-14" : since <= 30 ? "15-30" : "31+";
    const n = days.length;
    const daysB = n === 1 ? "1" : n === 2 ? "2" : n <= 4 ? "3-4" : n <= 7 ? "5-7" : n <= 14 ? "8-14" : "15+";
    const done = () => localStorage.setItem("fabriq.seen", today);
    sendWhenReady(`/u/${id}`, done);
    sendWhenReady(isNew ? "/active/new" : "/active/returning");
    sendWhenReady(`/active/since/${sinceB}`);
    sendWhenReady(`/active/days/${daysB}`);
  } catch {
    /* storage blocked — nothing to count */
  }
}

/** How many times this phone has opened FabriQ (a reload is not a new opening). */
function opens(): number {
  let n = Number(localStorage.getItem("fabriq.opens")) || 0;
  if (!sessionStorage.getItem("fabriq.open")) {
    n += 1;
    localStorage.setItem("fabriq.opens", String(n));
    sessionStorage.setItem("fabriq.open", "1");
  }
  return n;
}

/** Not this phone's first opening of FabriQ (the very first time, they are still finding their way). */
export function isReturning(): boolean {
  try {
    if (opens() >= 2) return true;
    // here before openings were counted: an earlier first day, or a job saved before today
    const today = istDay(Date.now());
    const first = localStorage.getItem("fabriq.first");
    if (first && first !== today) return true;
    return loadProjects().some((p) => p.created && istDay(p.created) !== today);
  } catch {
    return false;
  }
}

/**
 * "Hisaab sahi laga?" under the material list. A yes, or what was wrong
 * (and an optional line in their words), with the system the list was for:
 *   /feedback/ok/<type>-<system>
 *   /feedback/wrong/<reason>/<type>-<system>
 *   /feedback/note/<their line, made path-safe>
 * The note is what they typed about the sizes — nothing else is sent.
 */
export function markFeedback(what: "ok" | "wrong", system: string, reason?: string, note?: string): void {
  const sys = slug(system) || "unknown";
  if (what === "ok") { view(`/feedback/ok/${sys}`); return; }
  view(`/feedback/wrong/${slug(reason ?? "other") || "other"}/${sys}`);
  const n = (note ?? "").trim().toLowerCase().replace(/[^a-z0-9\u0900-\u097f.x]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  if (n) view(`/feedback/note/${sys}/${n}`);
}
