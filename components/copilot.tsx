"use client";
/**
 * Fabricator Copilot — the app's command centre, reachable from every screen.
 *
 * It is a chat, but not only a chat: the fabricator can attach sheet photos
 * here and have them read, and when he asks to DO something the reply carries a
 * real button into that part of the app instead of describing it. The home
 * screen has always promised "just ask"; this is what makes that true.
 *
 * The Copilot routes and explains. It never produces a measurement — every
 * number still comes from the deterministic engine.
 */
import { useEffect, useRef, useState } from "react";
import { VoiceButton } from "@/components/voice";
import { downscale, type ExtractedItem } from "@/components/photo";
import type { JobItem } from "@/lib/engine/types";

/** Mirrors the allow-list the copilot route validates against. */
export type CopilotAction = "photo" | "material_list" | "quotation" | "cutting" | "offcuts";

const ACTION_LABEL: Record<CopilotAction, string> = {
  photo: "📷 Add a sheet photo",
  material_list: "📦 New material list",
  quotation: "💰 Create a quotation",
  cutting: "🔧 Open the cutting sheet",
  offcuts: "♻️ Open the offcut bank",
};

interface Msg { role: "user" | "assistant"; content: string; action?: CopilotAction; item?: JobItem }

interface Shot { id: string; url: string; data: string; mediaType: string }

function readAIConfig() {
  try {
    const provider = (localStorage.getItem("fabriq_ai_provider") as "anthropic" | "openrouter" | null) ?? "anthropic";
    const model = localStorage.getItem("fabriq_ai_model") || undefined;
    const apiKey = provider === "openrouter"
      ? localStorage.getItem("fabriq_or_key") || ""
      : localStorage.getItem("fabriq_api_key") || "";
    return { provider, model, apiKey };
  } catch { return { provider: "anthropic" as const, model: undefined, apiKey: "" }; }
}

const SUGGESTIONS = [
  "What are the parts of a Domal 3-track window?",
  "How many interlocks does a sliding window need?",
  "Where does the glazing clip go in a partition?",
];

export function Copilot({ onAction, onExtracted, onComputed }: {
  /** Take the fabricator to the part of the app he just asked for. */
  onAction?: (a: CopilotAction) => void;
  /** Sheet photos read here feed the same review screen as the main flow. */
  onExtracted?: (rows: ExtractedItem[], notes?: string) => void;
  /** The Copilot ran a size straight through the real engine — add it to the job. */
  onComputed?: (item: JobItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, shots]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      try {
        const { data, mediaType } = await downscale(f);
        next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(f), data, mediaType });
      } catch { /* skip unreadable file, keep the rest */ }
    }
    setShots((s) => [...s, ...next]);
  };

  const removeShot = (id: string) =>
    setShots((s) => {
      const gone = s.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return s.filter((x) => x.id !== id);
    });

  /** Attached photos go to the vision route, not the chat route — reading a
   *  sheet is an extraction job, and its result belongs in the review screen
   *  where every number can still be corrected before anything is built. */
  const sendPhotos = async (note: string) => {
    if (!shots.length || busy) return;
    setErr(null);
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: `📷 ${shots.length} sheet photo${note ? ` — ${note}` : ""}` }]);
    setInput("");
    try {
      const cfg = readAIConfig();
      const r = await fetch("/api/ai/read-sheet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: shots.map((s) => ({ data: s.data, mediaType: s.mediaType })),
          notes: note || undefined, apiKey: cfg.apiKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.message || "Could not read the photo.");
      else if (!d.legible || !d.items?.length) {
        setErr("The photo is blurred, or the sheet could not be understood. Please take it again.");
      } else {
        shots.forEach((s) => URL.revokeObjectURL(s.url));
        setShots([]);
        setMsgs((m) => [...m, {
          role: "assistant",
          content: `Read ${d.items.length} ${d.items.length === 1 ? "item" : "items"}. Check them below and correct anything that looks wrong before confirming.`,
        }]);
        setOpen(false);
        onExtracted?.(d.items, d.sheet_notes);
      }
    } catch { setErr("Network problem. Please try again."); }
    setBusy(false);
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (shots.length) { sendPhotos(q); return; }
    if (!q || busy) return;
    setErr(null);
    const cfg = readAIConfig();
    // no client-side key gate: the server falls back to its own AI key or
    // AWS Bedrock credentials when Settings has no key configured.
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/ai/copilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, apiKey: cfg.apiKey, provider: cfg.provider, model: cfg.model }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.message || "The Copilot could not answer.");
      else setMsgs((m) => [...m, { role: "assistant", content: d.reply, action: d.action, item: d.item }]);
    } catch { setErr("Network problem. Please try again."); }
    setBusy(false);
  };

  const runAction = (a: CopilotAction) => {
    if (a === "photo") { fileRef.current?.click(); return; }
    setOpen(false);
    onAction?.(a);
  };

  return (
    <>
      {/* launcher */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="copilot-float no-print fixed z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-lg"
          style={{ right: 16, background: "linear-gradient(180deg,var(--accent-2),var(--accent))", boxShadow: "var(--shadow-accent)" }}>
          <SparkIcon /> Ask FabriQ
        </button>
      )}

      {/* chat panel */}
      {open && (
        <div className="copilot-float no-print fixed z-40 flex flex-col overflow-hidden rounded-2xl"
          style={{ right: 16, width: "min(400px, calc(100vw - 32px))", height: "min(560px, calc(100vh - 90px))",
            background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}>
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(120deg,#14181d,#232a34)", color: "#fff" }}>
            <div className="flex items-center gap-2">
              <SparkIcon /> <span className="font-bold">FabriQ Copilot</span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-lg leading-none opacity-80 hover:opacity-100">✕</button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="flex flex-col gap-2">
                <div className="card p-3 text-xs" style={{ color: "var(--ink-2)" }}>
                  👷 Tell me a size and I&rsquo;ll work it out &mdash; &ldquo;4x4 window, how
                  much material?&rdquo; &mdash; or attach a sheet photo, or just ask a
                  question. Every number still comes from the real engine, never guessed.
                </div>
                {/* The command centre's own shortcuts — no model call needed to
                    reach the thing he actually came to do. */}
                <div className="flex flex-wrap gap-1.5">
                  {(["photo", "material_list", "quotation"] as CopilotAction[]).map((a) => (
                    <button key={a} onClick={() => runAction(a)} className="chip px-3 py-2 text-xs font-semibold">
                      {ACTION_LABEL[a]}
                    </button>
                  ))}
                </div>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="chip px-3 py-2 text-left text-xs">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`mb-2 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm"
                  style={m.role === "user"
                    ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "var(--surface-2)", color: "var(--ink)", borderBottomLeftRadius: 4 }}>
                  {m.content}
                </div>
                {/* A reply that describes an action gets the action itself. */}
                {m.action && (
                  <button onClick={() => runAction(m.action!)}
                    className="btn-primary mt-1.5 px-3.5 py-2 text-xs font-bold">
                    {ACTION_LABEL[m.action]}
                  </button>
                )}
                {/* The Copilot ran this size through the real engine — one tap
                    puts it straight into the job, no re-entering it. */}
                {m.item && (
                  <button onClick={() => { onComputed?.(m.item!); setOpen(false); }}
                    className="btn-primary mt-1.5 px-3.5 py-2 text-xs font-bold">
                    ➕ Add to job &amp; open cutting sheet
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="mb-2 flex justify-start"><div className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>{shots.length ? "Reading the sheet…" : "Thinking…"}</div></div>}
            {err && <div className="card p-2.5 text-xs" style={{ background: "var(--bad-soft)", color: "var(--ink)" }}>⚠️ {err}</div>}
          </div>

          {/* composer */}
          <div className="flex flex-col gap-2 border-t p-2.5" style={{ borderColor: "var(--line)" }}>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

            {/* attached sheets stay visible until they are actually sent */}
            {shots.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {shots.map((s, i) => (
                  <div key={s.id} className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={`sheet ${i + 1}`} className="h-14 w-14 object-cover" />
                    {!busy && (
                      <button onClick={() => removeShot(s.id)} aria-label="Remove"
                        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "rgba(0,0,0,.6)" }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="btn-ghost grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl text-lg disabled:opacity-40"
                aria-label="Add photo" title="Add a photo of the sheet">📷</button>
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder={shots.length ? "Anything to add? (optional)" : "Type a question, or tap 🎤 to speak…"}
                className="dim-input min-w-0 flex-1 px-3 py-2.5 text-sm" />
              <VoiceButton onTranscript={(t) => setInput((c) => (c ? `${c} ${t}` : t))} />
              <button onClick={() => send(input)} disabled={busy || (!input.trim() && !shots.length)}
                className="btn-primary grid h-[42px] w-[42px] shrink-0 place-items-center disabled:opacity-40"
                aria-label="Send">{shots.length ? "📤" : "➤"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SparkIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
    </svg>
  );
}
