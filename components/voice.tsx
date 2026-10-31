"use client";

/**
 * Say the size instead of typing it. Uses the phone browser's own speech
 * engine (Chrome on Android, Safari on iPhone) — no key, no server, free.
 * Nothing is filled until the fabricator sees what was heard and taps
 * "Use this": a misheard size cut in aluminium is money gone.
 *
 * Where the browser has no speech engine the mic button simply isn't shown.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bestSpokenList, type SpokenLine } from "@/lib/engine/spoken";
import { formatFtIn } from "@/lib/engine/units";

/* The Web Speech API isn't in TypeScript's DOM types yet — just what we use. */
type Alt = { transcript: string };
type Result = { isFinal: boolean; length: number; [i: number]: Alt };
type RecEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type Recognizer = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognizerCtor = new () => Recognizer;

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

export type VoiceLang = "hi-IN" | "en-IN";
const LANG_KEY = "fabriq.voiceLang";

/** A line as shown and filled: its sizes, the boxes they go to, and the count if one was said. */
export type HeardLine = SpokenLine & { labels: string[] };

export type VoiceState =
  | { phase: "idle" }
  | { phase: "listening"; interim: string; kept: HeardLine[] }
  | { phase: "heard"; heard: string; lines: HeardLine[] }
  | { phase: "unclear"; heard: string; kept: HeardLine[] }
  | { phase: "error"; message: string; kept: HeardLine[] };

/**
 * Where what's said will go. `labels(line)` names the boxes one opening fills
 * (["Width", "Height"]) or returns null when it doesn't fit. `many`: a whole
 * list, kept across "Say more" — otherwise exactly one opening.
 */
export type VoiceTarget = { many: boolean; labels: (line: SpokenLine) => string[] | null };

/**
 * One voice input for a screen. `start` must be called straight from a tap —
 * phone browsers only open the mic from a user gesture.
 */
export function useVoice() {
  // false on the server and during hydration, so the mic button matches the server HTML
  const supported = useSyncExternalStore(noSubscribe, () => !!recognizerCtor(), () => false);
  const [state, setState] = useState<VoiceState>({ phase: "idle" });
  // only shown inside the sheet, which never renders during hydration
  const [lang, setLangState] = useState<VoiceLang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === "hi-IN" || saved === "en-IN") return saved;
    } catch { /* default is fine */ }
    return "hi-IN";
  });
  const rec = useRef<Recognizer | null>(null);
  const target = useRef<VoiceTarget>({ many: false, labels: () => null });
  /** Lines already confirmed by ear in a list, kept while more is said. */
  const kept = useRef<HeardLine[]>([]);
  const [many, setMany] = useState(false);

  useEffect(() => () => { const r = rec.current; rec.current = null; r?.abort(); }, []);

  const begin = (useLang: VoiceLang) => {
    const Ctor = recognizerCtor();
    if (!Ctor) return;
    if (!target.current.many) kept.current = [];
    const before = kept.current;
    const old = rec.current;
    const r = new Ctor();
    r.lang = useLang;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    let done = false;
    // an aborted or replaced recognizer still fires its events — ignore them
    const stale = () => rec.current !== r;
    const fail = (message: string) => setState({ phase: "error", message, kept: before });
    r.onresult = (e) => {
      if (stale()) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          done = true;
          const alts: string[] = [];
          for (let a = 0; a < res.length; a++) alts.push(res[a].transcript);
          const t = target.current;
          const best = bestSpokenList(alts, (ls) => (t.many || ls.length === 1) && ls.every((l) => t.labels(l)));
          if (!best) { setState({ phase: "unclear", heard: alts[0] ?? "", kept: before }); return; }
          const lines = [...before, ...best.lines.map((l) => ({ ...l, labels: t.labels(l)! }))];
          kept.current = lines;
          try { navigator.vibrate?.(30); } catch { /* no buzz — fine */ }
          setState({ phase: "heard", heard: best.heard, lines });
          return;
        }
        interim += res[0].transcript;
      }
      setState({ phase: "listening", interim, kept: before });
    };
    r.onerror = (e) => {
      if (stale() || e.error === "aborted") return;
      done = true;
      fail(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Mic is blocked. Allow the microphone for this site in your browser settings."
          : e.error === "network" ? "Voice needs internet. Type the size, or try again when online."
          : e.error === "no-speech" ? "Didn't hear anything. Tap Try again and say the size."
          : "Voice didn't work this time. Try again, or type the size.",
      );
    };
    r.onend = () => { if (!stale() && !done) fail("Didn't hear anything. Tap Try again and say the size."); };
    rec.current = r;
    old?.abort();
    setState({ phase: "listening", interim: "", kept: before });
    try { r.start(); } catch { fail("Voice didn't start. Try again."); }
  };

  const close = () => {
    const r = rec.current;
    rec.current = null;
    r?.abort();
    kept.current = [];
    setState({ phase: "idle" });
  };

  return {
    supported,
    state,
    lang,
    many,
    start(t: VoiceTarget) {
      target.current = t;
      setMany(t.many);
      kept.current = [];
      begin(lang);
    },
    /** Listen again — in a list, adds to what's kept; for one opening, replaces it. */
    again() { begin(lang); },
    /** Stop listening now and read what was said so far. */
    finish() { rec.current?.stop(); },
    setLang(l: VoiceLang) {
      setLangState(l);
      try { localStorage.setItem(LANG_KEY, l); } catch { /* remembered for this visit only */ }
      begin(l);
    },
    drop(i: number) {
      const lines = kept.current.filter((_, k) => k !== i);
      kept.current = lines;
      setState((st) => (st.phase === "heard" ? { ...st, lines } : st.phase === "idle" ? st : { ...st, kept: lines }));
    },
    close,
  };
}

export type Voice = ReturnType<typeof useVoice>;

export function MicButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
      <MicIcon size={16} />
    </button>
  );
}

/** The big one: say a whole list of sizes in one go. */
export function SayAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
      style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px dashed var(--accent)" }}>
      <MicIcon size={18} /> Say all sizes at once
    </button>
  );
}

/** A said size, the way the size cards echo it. */
function lineText(l: HeardLine): string {
  return l.sizes.map(formatFtIn).join(" × ");
}

/** The sheet over the bottom of the screen while listening, and to confirm what was heard. */
export function VoiceSheet({ voice, onUse, hint }: {
  voice: Voice; onUse: (lines: HeardLine[]) => void; hint?: string;
}) {
  const s = voice.state;
  if (s.phase === "idle") return null;
  const many = voice.many;
  const lines = s.phase === "heard" ? s.lines : s.kept;
  const use = () => { onUse(lines); voice.close(); };
  const other: VoiceLang = voice.lang === "hi-IN" ? "en-IN" : "hi-IN";
  const muted = { color: "var(--ink-3)" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={voice.close}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" role="dialog" aria-label="Say the size"
        style={{ background: "var(--surface)", maxHeight: "90vh", overflowY: "auto", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{many ? "Say all sizes" : "Say the size"}</h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg text-xs font-bold" style={{ border: "1px solid var(--line)" }}>
              {(["hi-IN", "en-IN"] as const).map((l) => (
                <button key={l} onClick={() => voice.setLang(l)} aria-pressed={voice.lang === l}
                  className="px-2.5 py-1.5"
                  style={voice.lang === l ? { background: "var(--ink)", color: "#fff" } : muted}>
                  {l === "hi-IN" ? "हिंदी" : "English"}
                </button>
              ))}
            </div>
            <button onClick={voice.close} aria-label="Close" className="text-2xl leading-none" style={muted}>×</button>
          </div>
        </div>

        {/* a list keeps what's already been heard on screen the whole time */}
        {many && lines.length > 0 && (
          <ol className="mt-3 flex flex-col gap-1.5">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "var(--good-soft)" }}>
                <span className="w-5 text-xs font-bold" style={muted}>{i + 1}</span>
                <span className="flex-1 text-base font-bold tabnum" style={{ color: "var(--good)" }}>{lineText(l)}</span>
                {l.qty && <span className="text-sm font-bold tabnum">× {l.qty}</span>}
                <button onClick={() => voice.drop(i)} aria-label={`Remove size ${i + 1}`} className="px-1 text-lg leading-none" style={muted}>×</button>
              </li>
            ))}
          </ol>
        )}

        {s.phase === "listening" && (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <button onClick={voice.finish} aria-label="Done speaking"
              className="voice-pulse grid h-16 w-16 place-items-center rounded-full"
              style={{ background: "var(--accent)", color: "#fff" }}>
              <MicIcon size={28} />
            </button>
            <p className="min-h-[24px] text-base font-semibold">{s.interim || "Listening… bolo"}</p>
            <p className="text-xs" style={muted}>
              {hint ?? (many
                ? "“4.6 by 5 teen nag … agla … 3 by 4 do nag”"
                : "“4 feet 6 inch by 5 feet” · “char foot chhe inch” · “saadhe chaar foot”")}
            </p>
          </div>
        )}

        {s.phase === "heard" && !many && lines[0] && (
          <div className="mt-4">
            <p className="text-xs" style={muted}>Heard: “{s.heard}”</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {lines[0].sizes.map((um, i) => (
                <div key={i} className="flex items-baseline justify-between rounded-lg px-3 py-2" style={{ background: "var(--good-soft)" }}>
                  <span className="text-sm font-semibold" style={muted}>{lines[0].labels[i]}</span>
                  <span className="text-xl font-bold tabnum" style={{ color: "var(--good)" }}>{formatFtIn(um)}</span>
                </div>
              ))}
              {lines[0].qty && (
                <div className="flex items-baseline justify-between rounded-lg px-3 py-2" style={{ background: "var(--good-soft)" }}>
                  <span className="text-sm font-semibold" style={muted}>Qty</span>
                  <span className="text-xl font-bold tabnum" style={{ color: "var(--good)" }}>{lines[0].qty}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={voice.again} className="btn-ghost flex-1 py-3">Say again</button>
              <button onClick={use} className="btn-primary flex-1 py-3">Use this</button>
            </div>
          </div>
        )}

        {s.phase === "heard" && many && (
          <div className="mt-3">
            <p className="text-xs" style={muted}>Last heard: “{s.heard}”</p>
            <div className="mt-4 flex gap-2">
              <button onClick={voice.again} className="btn-ghost flex-1 py-3">+ Say more</button>
              <button onClick={use} disabled={!lines.length} className="btn-primary flex-1 py-3 disabled:opacity-40">
                Use {lines.length} {lines.length === 1 ? "size" : "sizes"}
              </button>
            </div>
          </div>
        )}

        {(s.phase === "unclear" || s.phase === "error") && (
          <div className="mt-4">
            {s.phase === "unclear" ? (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--bad)" }}>Couldn&apos;t read a size in that.</p>
                {s.heard && <p className="mt-1 text-xs" style={muted}>Heard: “{s.heard}”</p>}
                <p className="mt-2 text-xs" style={muted}>
                  Say the unit with each number — “4 feet 6 inch” — or just “4 point 6”.{" "}
                  <button onClick={() => voice.setLang(other)} className="font-bold underline" style={{ color: "var(--accent)" }}>
                    Try in {other === "hi-IN" ? "हिंदी" : "English"}
                  </button>
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold" style={{ color: "var(--bad)" }}>{s.message}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={voice.again} className={`${many && lines.length ? "btn-ghost" : "btn-primary"} flex-1 py-3`}>Try again</button>
              {many && lines.length > 0 && (
                <button onClick={use} className="btn-primary flex-1 py-3">Use {lines.length} {lines.length === 1 ? "size" : "sizes"}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MicIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
