/**
 * Instagram / Facebook open links in their own little browser. In there a
 * PDF cannot be shared or saved and the app cannot be installed — so the
 * fabricator is sent on to Chrome, with the job carried in the link (that
 * browser has its own storage: without it the sizes would be lost).
 */
import type { JobItem } from "@/lib/engine/types";

export type InApp = "Instagram" | "Facebook" | null;

export function inAppBrowser(): InApp {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  return null;
}

export const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

export interface CarriedJob { items: JobItem[]; customer?: string }

const PARAM = "j";

function encode(job: CarriedJob): string {
  const bytes = new TextEncoder().encode(JSON.stringify(job));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(s: string): CarriedJob | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const job = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return job && Array.isArray(job.items) && job.items.length ? job : null;
  } catch {
    return null;
  }
}

/** This page's link with the job in it, as Chrome should open it. */
export function chromeLink(job: CarriedJob | null): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  // counted as /from/<source>/open-in-chrome: how many made the jump
  if (url.searchParams.get("utm_source")) url.searchParams.set("utm_campaign", "open-in-chrome");
  else url.searchParams.set("utm_source", "open-in-chrome");
  if (job) url.searchParams.set(PARAM, encode(job));
  if (!isAndroid()) return url.toString();
  // Android: an intent link opens Chrome itself, out of Instagram's browser
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;`
    + `S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
}

/** The job a link brought along, taken out of the address bar. */
export function takeCarriedJob(): CarriedJob | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get(PARAM);
  if (!raw) return null;
  url.searchParams.delete(PARAM);
  // same history entry and state, only the address changes
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
  return decode(raw);
}
