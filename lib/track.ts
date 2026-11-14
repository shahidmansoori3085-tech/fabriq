/**
 * Counts the steps that matter — a material list made, an order sent — as
 * page views on made-up paths ("/done/material-list"), so they show up in
 * Vercel Web Analytics on the free plan (custom events need Pro). Nothing
 * about the job or the shop is sent: only the step's name.
 */
import { pageview } from "@vercel/analytics";

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
  } catch {
    /* storage or analytics blocked — the app works the same */
  }
}
