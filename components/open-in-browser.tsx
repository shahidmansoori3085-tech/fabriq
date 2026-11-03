"use client";

/**
 * Inside Instagram's browser a PDF cannot leave the phone and the app cannot
 * be installed. These send the fabricator on to Chrome with the open job.
 */
import { useEffect, useState } from "react";
import { chromeLink, inAppBrowser, isAndroid, type CarriedJob, type InApp } from "@/lib/inapp";
import { loadProjects } from "@/lib/projects";

/** The job being edited right now, as autosave last wrote it. */
function openJob(): CarriedJob | null {
  try {
    const id = localStorage.getItem("fabriq.openJob");
    const p = loadProjects().find((x) => x.id === id);
    return p ? { items: p.items, customer: p.customer } : null;
  } catch {
    return null;
  }
}

/** null on the server and outside an in-app browser. */
export function useInApp(): InApp {
  const [app, setApp] = useState<InApp>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setApp(inAppBrowser()), []);
  return app;
}

/** The bottom sheet: one button on Android, the menu steps on iPhone. */
export function OpenInChromeSheet({ app, what, onClose }: { app: string; what: string; onClose: () => void }) {
  const android = isAndroid();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Open FabriQ in {android ? "Chrome" : "Safari"}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-2)" }}>
          {what} does not work inside {app}. Your sizes go with you.
        </p>
        {android ? (
          <>
            <a href={chromeLink(openJob())} className="btn-primary mt-4 block w-full py-3.5 text-center">
              Open in Chrome
            </a>
            <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-3)" }}>
              Not opening? Tap <b>⋮</b> at the top right → <b>Open in Chrome</b>.
            </p>
          </>
        ) : (
          <ol className="mt-4 flex flex-col gap-2 text-sm">
            <li className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
              1. Tap <b>•••</b> (the menu) at the top or bottom right.
            </li>
            <li className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
              2. Tap <b>Open in external browser</b> or <b>Open in Safari</b>.
            </li>
          </ol>
        )}
        <button onClick={onClose} className="btn-ghost mt-3 w-full py-3">Not now</button>
      </div>
    </div>
  );
}

/** A quiet line on the first screen, before any sizes are typed in. */
export function InAppNotice() {
  const app = useInApp();
  const [open, setOpen] = useState(false);
  // Android: go straight on to Chrome, once per visit (if Chrome does not
  // open, the page stays here with this notice and the menu steps).
  useEffect(() => {
    if (!app || !isAndroid()) return;
    try {
      if (sessionStorage.getItem("fabriq.toChrome")) return;
      sessionStorage.setItem("fabriq.toChrome", "1");
    } catch {
      return; // without the mark it could try again on every reload
    }
    window.location.href = chromeLink(openJob());
  }, [app]);
  if (!app) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-left text-sm"
        style={{ background: "var(--warn-soft)", border: "1px solid #fde68a" }}>
        <span className="min-w-0 flex-1">
          You&apos;re inside {app}. To send PDFs and install the app, open in {isAndroid() ? "Chrome" : "Safari"}.
        </span>
        <span className="shrink-0 font-bold" style={{ color: "var(--accent)" }}>Open</span>
      </button>
      {open && <OpenInChromeSheet app={app} what="Sending PDFs and installing" onClose={() => setOpen(false)} />}
    </>
  );
}
