"use client";

/**
 * "Install app" — puts FabriQ on the phone's home screen.
 *
 * Android / Chrome hand the page an install prompt (beforeinstallprompt); the
 * button opens that real dialog in one tap. iPhone has no such prompt — the
 * only way is Share → Add to Home Screen — so there the button opens a short
 * picture guide instead. Once the app runs from the home screen, the button
 * is gone.
 */
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The browser can fire its install event before React has drawn the page, so
// it is caught as soon as this file loads, not when the button mounts.
let saved: InstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    saved = e as InstallPromptEvent;
    window.dispatchEvent(new Event("fabriq-installable"));
  });
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function InstallButton() {
  /** null until mounted — the server can't know, so nothing renders there. */
  const [show, setShow] = useState<boolean | null>(null);
  const [help, setHelp] = useState<"ios" | "other" | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!isStandalone());
    const onInstalled = () => { saved = null; setShow(false); setHelp(null); };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (!show) return null;

  const install = async () => {
    if (saved) {
      const ev = saved;
      saved = null; // a prompt can only be shown once
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      if (outcome === "accepted") setShow(false);
      return;
    }
    setHelp(isIOS() ? "ios" : "other");
  };

  return (
    <>
      <button onClick={install}
        className="flex items-center gap-1.5 rounded-full py-2 pl-2.5 pr-3.5 text-sm font-bold text-white"
        style={{ background: "var(--accent)", boxShadow: "0 1px 2px rgba(232, 89, 12, 0.35)" }}>
        <PhoneDownIcon />
        Install app
      </button>
      {help && <InstallHelp kind={help} onClose={() => setHelp(null)} />}
    </>
  );
}

/** Step-by-step, with the same icons the browser shows. */
function InstallHelp({ kind, onClose }: { kind: "ios" | "other"; onClose: () => void }) {
  const steps: [React.ReactNode, React.ReactNode][] = kind === "ios"
    ? [
        [<ShareIcon key="s" />, <>Tap the <b>Share</b> button in Safari&apos;s bottom bar.</>],
        [<PlusSquareIcon key="p" />, <>Scroll down and tap <b>Add to Home Screen</b>.</>],
        [<span key="a" className="text-sm font-bold" style={{ color: "var(--glass)" }}>Add</span>, <>Tap <b>Add</b> at the top right.</>],
      ]
    : [
        [<span key="m" className="text-xl font-bold leading-none">⋮</span>, <>Tap the browser <b>menu</b> (⋮) at the top right.</>],
        [<PhoneDownIcon key="i" dark />, <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>],
        [<span key="c" className="text-sm font-bold" style={{ color: "var(--glass)" }}>Install</span>, <>Confirm with <b>Install</b>.</>],
      ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white"
            style={{ background: "var(--accent)" }}>FQ</span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Install FabriQ on your phone</h2>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              Opens from your home screen like an app, and works without internet.
            </p>
          </div>
        </div>
        <ol className="mt-4 flex flex-col gap-2">
          {steps.map(([icon, text], i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)" }}>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--ink)" }}>{i + 1}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>{icon}</span>
              <span className="text-sm">{text}</span>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="btn-primary mt-5 w-full py-3.5">Got it</button>
      </div>
    </div>
  );
}

function PhoneDownIcon({ dark }: { dark?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dark ? "var(--ink)" : "currentColor"}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M12 7v7M9 11.5l3 3 3-3M10 18.5h4" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--glass)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

function PlusSquareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
