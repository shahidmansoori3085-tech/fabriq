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

export function FeedbackCard({ system, jobKey }: { system: string; jobKey: string }) {
  const key = `fabriq.fb.${jobKey}`;
  const [state, setState] = useState<"ask" | "why" | "done">(() => {
    try { return sessionStorage.getItem(key) ? "done" : "ask"; } catch { return "ask"; }
  });
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const finish = () => { try { sessionStorage.setItem(key, "1"); } catch { /* fine */ } setState("done"); };

  if (state === "done") {
    return (
      <div className="no-print card px-4 py-3 text-center text-sm" style={{ color: "var(--ink-2)" }}>
        🙏 Shukriya! Aapki baat se FabriQ aur sahi banega.
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
          <button disabled={!reason || note.trim().length < 3} onClick={() => { markFeedback("wrong", system, reason ?? "other", note); finish(); }}
            className="btn-primary w-full py-3 disabled:opacity-50">Bhejo</button>
        </div>
      )}
    </div>
  );
}
