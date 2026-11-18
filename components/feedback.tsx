"use client";

/**
 * "Hisaab sahi laga?" — under the material list. Fabricators check a new
 * app against sizes they already worked out by hand; this asks them, once
 * per job, whether it matched, and if not, what was off. The answer goes to
 * the report (lib/track.ts markFeedback), so a wrong rule is found and fixed.
 */
import { useState } from "react";
import { markFeedback } from "@/lib/track";

const REASONS: [string, string][] = [
  ["pipe-count", "Pipe ki ginti"],
  ["cutting-size", "Cutting size"],
  ["glass-size", "Glass size"],
  ["other", "Kuch aur"],
];

/** A wrong cut can be fixed in a minute on the window drawing (founder 2026-11-18). */
function FixYourself({ href, name }: { href: string; name: string }) {
  return (
    <a href={href} className="mt-3 flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--accent)", color: "#fff" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Fix the cuts yourself</span>
        <span className="block text-xs leading-snug" style={{ color: "var(--ink-3)" }}>Open {name}, tap the pipe on the drawing, press − or +. Every next job uses your cut.</span>
      </span>
      <span aria-hidden className="text-lg" style={{ color: "var(--ink-3)" }}>›</span>
    </a>
  );
}

export function FeedbackCard({ system, jobKey, fix }: {
  system: string; jobKey: string;
  /** the window system of this job, to fix its cuts on the drawing */
  fix?: { href: string; name: string };
}) {
  const key = `fabriq.fb.${jobKey}`;
  const [state, setState] = useState<"ask" | "why" | "done">(() => {
    try { return sessionStorage.getItem(key) ? "done" : "ask"; } catch { return "ask"; }
  });
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [wrong, setWrong] = useState(false);
  const finish = () => { try { sessionStorage.setItem(key, "1"); } catch { /* fine */ } setState("done"); };

  if (state === "done") {
    return (
      <div className="no-print card px-4 py-3 text-sm" style={{ color: "var(--ink-2)" }}>
        <div className="text-center">🙏 Shukriya! Aapki baat se FabriQ aur sahi banega.</div>
        {wrong && fix && <FixYourself {...fix} />}
      </div>
    );
  }

  return (
    <div className="no-print card p-4">
      <div className="text-[15px] font-bold">Hisaab sahi laga?</div>
      <div className="text-xs" style={{ color: "var(--ink-3)" }}>Apne hisaab se milaakar batayein</div>
      {state === "ask" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { markFeedback("ok", system); finish(); }}
            className="rounded-[var(--radius)] py-3 text-sm font-bold"
            style={{ background: "var(--good-soft)", color: "var(--good)", border: "1px solid #bbf7d0" }}>
            👍 Sahi hai
          </button>
          <button onClick={() => setState("why")}
            className="rounded-[var(--radius)] py-3 text-sm font-bold"
            style={{ background: "#fef2f2", color: "var(--bad)", border: "1px solid #fecaca" }}>
            👎 Galat hai
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          {fix && <div className="-mt-1 mb-1"><FixYourself {...fix} /></div>}
          <div className="text-sm font-semibold">Kya galat laga?</div>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(([v, label]) => (
              <button key={v} onClick={() => setReason(v)}
                className={`chip px-3 py-2 text-sm${reason === v ? " selected" : ""}`}>{label}</button>
            ))}
          </div>
          <div className="text-sm font-semibold">Kya galat tha? <span style={{ color: "var(--bad)" }}>*</span></div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120}
            placeholder="Jaise: Interlock 1 inch chhota aaya"
            className="dim-input w-full px-3 py-2.5 text-sm" />
          {reason && note.trim().length < 3 && (
            <div className="text-xs" style={{ color: "var(--ink-3)" }}>Kaunsa piece aur kitna fark, ek line likhein — tabhi hum theek kar paayenge</div>
          )}
          <button disabled={!reason || note.trim().length < 3} onClick={() => { markFeedback("wrong", system, reason ?? "other", note); setWrong(true); finish(); }}
            className="btn-primary w-full py-3 disabled:opacity-50">Bhejo</button>
        </div>
      )}
    </div>
  );
}
