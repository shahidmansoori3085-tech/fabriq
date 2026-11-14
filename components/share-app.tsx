"use client";

/**
 * "FabriQ achha laga?" — lets a fabricator send FabriQ on to another
 * fabricator (WhatsApp or any app the phone offers). Shown where the app has
 * just been useful: under the material list, and on the first screen once
 * there is at least one job behind them.
 */
import { whatsAppLink } from "@/lib/pdf";
import { markStep } from "@/lib/track";

const LINE = "FabriQ achha laga? To apne fabricator dost ko bhi share kijiye";

function message(): string {
  const link = `${window.location.origin}/?utm_source=friend_share`;
  return [
    "*FabriQ – Aluminium Fabricators ke liye*",
    "",
    "Window, door aur partition ka naap daalein. Poori *material list* aur *cutting sheet* turant tayyar.",
    "",
    "✔ Sahi hisaab, kam wastage",
    "✔ Order seedha WhatsApp par",
    "",
    "Main apne kaam mein FabriQ use karta hoon. Aap bhi dekhein 👇",
    link,
  ].join("\n");
}

async function shareApp(): Promise<void> {
  const text = message();
  // the phone's own share menu: WhatsApp, Telegram, Instagram… (the link goes
  // inside the text — some apps drop the text when a separate url is given)
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      markStep("shared-app");
    } catch {
      /* closed the menu — nothing sent */
    }
    return;
  }
  markStep("shared-app");
  window.open(whatsAppLink(text), "_blank", "noopener,noreferrer");
}

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
      <path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
    </svg>
  );
}

/** Under the material list: the moment FabriQ has just saved them the sums. */
export function ShareAppCard() {
  const [q, rest] = LINE.split("? ");
  return (
    <div className="no-print card flex items-center gap-3 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 40px icon */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight">{q}?</div>
        <div className="text-xs" style={{ color: "var(--ink-2)" }}>{rest}</div>
      </div>
      <button onClick={shareApp} className="btn-primary flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm">
        <ShareIcon size={16} />
        Share
      </button>
    </div>
  );
}

/** First screen, for someone who has made a job before: one quiet row. */
export function ShareAppRow() {
  return (
    <button onClick={shareApp} className="card flex items-center gap-3 px-4 py-3 text-left">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <ShareIcon />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{LINE}</span>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--ink-3)" }}><path d="M9 6l6 6-6 6" /></svg>
    </button>
  );
}
