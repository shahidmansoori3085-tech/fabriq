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
  | "sent/cutting-sheet";

export function markStep(step: Step): void {
  try {
    pageview({ route: `/done/${step}`, path: `/done/${step}` });
  } catch {
    /* analytics blocked or not loaded — the app works the same */
  }
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
