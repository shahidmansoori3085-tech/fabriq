"use client";

/**
 * "Install app" — puts FabriQ on the phone's home screen.
 *
 * Android / Chrome hand the page an install prompt (beforeinstallprompt); the
 * button opens that real dialog in one tap. iPhone has no such prompt — the
 * only way is Share → Add to Home Screen — so there the button opens a short
 * picture guide instead. An Android phone's own browser (Oppo, Vivo, Mi…)
 * hides install deep in its menu, so there the button sends the fabricator on
 * to Chrome, where the install dialog opens by itself. Once the app runs from
 * the home screen, the button is gone.
 */
import { useEffect, useState } from "react";
import { OpenInChromeSheet, openJob, useInApp } from "@/components/open-in-browser";
import { chromeLink, isOtherAndroidBrowser, takeInstallAsk } from "@/lib/inapp";

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
  const [help, setHelp] = useState<"ios" | "samsung" | "other" | "inapp" | "chrome" | "ready" | null>(null);
  const inApp = useInApp();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(!isStandalone());
    // Sent here by another browser's Install button: offer it straight away
    // (the install dialog itself needs a tap, the browser insists on it)
    if (takeInstallAsk() && !isStandalone()) setHelp("ready");
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
    // Instagram's browser cannot install anything: go to Chrome first
    setHelp(inApp ? "inapp" : isIOS() ? "ios" : isOtherAndroidBrowser() ? "chrome" : "other");
  };

  return (
    <>
      {/* quiet, like Settings — the page's one orange button is its next step */}
      <button onClick={install} aria-label="Install app"
        className="btn-ghost flex items-center gap-1.5 px-3 py-2 text-sm">
        <PhoneDownIcon dark />
        Install
      </button>
      {help === "inapp" && inApp
        ? <OpenInChromeSheet app={inApp} what="Installing the app" onClose={() => setHelp(null)} />
        : help === "chrome" ? <ToChromeSheet onClose={() => setHelp(null)} onMenu={() => setHelp("samsung")} isSamsung={/SamsungBrowser/.test(navigator.userAgent)} onOther={() => setHelp("other")} />
        : help === "ready" ? <ReadySheet onInstall={() => { setHelp(null); void install(); }} onClose={() => setHelp(null)} />
        : help && help !== "inapp" && <InstallHelp kind={help} onClose={() => setHelp(null)} />}
    </>
  );
}

/** The sheet's frame: icon, title, one line under it. */
function Sheet({ title, sub, onClose, children }: { title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 48px icon in a sheet */}
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>{sub}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Oppo / Vivo / Mi browser: one button on to Chrome, which installs in two taps. */
function ToChromeSheet({ onClose, onMenu, onOther, isSamsung }: { onClose: () => void; onMenu: () => void; onOther: () => void; isSamsung: boolean }) {
  return (
    <Sheet title="Install FabriQ" sub="This browser cannot install apps easily. Chrome installs FabriQ in 2 taps. Your sizes go with you." onClose={onClose}>
      <a href={chromeLink(openJob(), { install: true })} className="btn-primary mt-5 block w-full py-3.5 text-center">
        Open in Chrome to install
      </a>
      <button onClick={isSamsung ? onMenu : onOther} className="mt-3 w-full py-2 text-center text-xs" style={{ color: "var(--ink-3)" }}>
        No Chrome on this phone? <u>Install from this browser&apos;s menu</u>
      </button>
    </Sheet>
  );
}

/** Arrived in Chrome to install: the one tap the browser needs before its dialog. */
function ReadySheet({ onInstall, onClose }: { onInstall: () => void; onClose: () => void }) {
  return (
    <Sheet title="Install FabriQ" sub="Opens from your home screen like an app, and works without internet." onClose={onClose}>
      <button onClick={onInstall} className="btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5">
        <PhoneDownIcon />
        Install app
      </button>
      <button onClick={onClose} className="btn-ghost mt-3 w-full py-3">Not now</button>
    </Sheet>
  );
}

/** Step-by-step, with the same icons the browser shows. */
function InstallHelp({ kind, onClose }: { kind: "ios" | "samsung" | "other"; onClose: () => void }) {
  const steps: [React.ReactNode, React.ReactNode][] = kind === "ios"
    ? [
        [<ShareIcon key="s" />, /CriOS/.test(navigator.userAgent)
          ? <>Tap the <b>Share</b> button at the top right, next to the address.</>
          : <>Tap the <b>Share</b> button in Safari&apos;s bottom bar.</>],
        [<PlusSquareIcon key="p" />, <>Scroll down and tap <b>Add to Home Screen</b>.</>],
        [<span key="a" className="text-sm font-bold" style={{ color: "var(--glass)" }}>Add</span>, <>Tap <b>Add</b> at the top right.</>],
      ]
    : kind === "samsung"
    ? [
        [<span key="m" className="text-xl font-bold leading-none">≡</span>, <>Tap the <b>menu</b> (≡) at the bottom right.</>],
        [<PlusSquareIcon key="p" />, <>Tap <b>Add page to</b>, then <b>Home screen</b>.</>],
        [<span key="c" className="text-sm font-bold" style={{ color: "var(--glass)" }}>Add</span>, <>Confirm with <b>Add</b>.</>],
      ]
    : [
        [<span key="m" className="text-xl font-bold leading-none">⋮</span>, <>Tap the <b>menu</b> (⋮) at the top right. Opened from WhatsApp? Tap <b>Open in Chrome</b> first.</>],
        [<PhoneDownIcon key="i" dark />, <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>],
        [<span key="c" className="text-sm font-bold" style={{ color: "var(--glass)" }}>Install</span>, <>Confirm with <b>Install</b>.</>],
      ];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a 48px icon in a sheet */}
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl" />
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
