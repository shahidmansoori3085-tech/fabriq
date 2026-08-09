"use client";
/**
 * Fabricator Copilot — a floating "Ask FabriQ" chat. The fabricator can type or
 * speak a fabrication question and get a short, workshop-practical answer.
 * Reads the AI provider/key from localStorage (Anthropic or OpenRouter).
 */
import { useEffect, useRef, useState } from "react";
import { VoiceButton } from "@/components/voice";

interface Msg { role: "user" | "assistant"; content: string }

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
  "Domal 3 track window ke parts kya hote hain?",
  "Sliding window me interlock kitne lagte hain?",
  "Partition me glazing clip kaha lagti hai?",
];

export function Copilot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
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
      if (!r.ok) setErr(d.message || "Copilot jawab nahi de paaya.");
      else setMsgs((m) => [...m, { role: "assistant", content: d.reply }]);
    } catch { setErr("Network problem — dobara try karo."); }
    setBusy(false);
  };

  return (
    <>
      {/* launcher */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className="no-print fixed z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white shadow-lg"
          style={{ right: 16, bottom: 16, background: "linear-gradient(180deg,var(--accent-2),var(--accent))", boxShadow: "var(--shadow-accent)" }}>
          <SparkIcon /> Ask FabriQ
        </button>
      )}

      {/* chat panel */}
      {open && (
        <div className="no-print fixed z-40 flex flex-col overflow-hidden rounded-2xl"
          style={{ right: 16, bottom: 16, width: "min(400px, calc(100vw - 32px))", height: "min(560px, calc(100vh - 90px))",
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
                  👷 Fabrication ka koi bhi sawaal poocho — systems, cutting method, interlock, glass, hardware. Exact cutting size ke liye material list dekho.
                </div>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="chip px-3 py-2 text-left text-xs">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`mb-2 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm"
                  style={m.role === "user"
                    ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "var(--surface-2)", color: "var(--ink)", borderBottomLeftRadius: 4 }}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="mb-2 flex justify-start"><div className="rounded-2xl px-3 py-2 text-sm" style={{ background: "var(--surface-2)", color: "var(--ink-3)" }}>soch raha hoon…</div></div>}
            {err && <div className="card p-2.5 text-xs" style={{ background: "var(--bad-soft)", color: "var(--ink)" }}>⚠️ {err}</div>}
          </div>

          {/* input */}
          <div className="flex items-center gap-2 border-t p-2.5" style={{ borderColor: "var(--line)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Sawaal likho ya 🎤 bolo…"
              className="dim-input flex-1 px-3 py-2.5 text-sm" />
            <VoiceButton onTranscript={(t) => setInput((c) => (c ? `${c} ${t}` : t))} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              className="btn-primary grid h-[42px] w-[42px] place-items-center disabled:opacity-40" aria-label="Send">➤</button>
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
