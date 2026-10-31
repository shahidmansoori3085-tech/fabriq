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
import { bestSpokenSizes } from "@/lib/engine/spoken";
import { formatFtIn, type Um } from "@/lib/engine/units";

/* The Web Speech API isn't in TypeScript's DOM types yet — just what we use. */
type Alt = { transcript: string };
type Result = { isFinal: boolean; length: number; [i: number]: Alt };
type RecEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type Recognizer = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; abort: () => void;
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

export type VoiceState =
  | { phase: "idle" }
  | { phase: "listening"; interim: string }
  | { phase: "heard"; heard: string; sizes: Um[]; labels: string[] }
  | { phase: "unclear"; heard: string }
  | { phase: "error"; message: string };

/**
 * One voice input for a screen. `start` must be called straight from a tap —
 * phone browsers only open the mic from a user gesture.
 * `labelsFor(n)` names where n spoken sizes would go (["Width", "Height"]),
 * or null when n sizes don't fit this row.
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
  const labelsFor = useRef<(n: number) => string[] | null>(() => null);

  useEffect(() => () => { const r = rec.current; rec.current = null; r?.abort(); }, []);

  const begin = (useLang: VoiceLang) => {
    const Ctor = recognizerCtor();
    if (!Ctor) return;
    const old = rec.current;
    const r = new Ctor();
    r.lang = useLang;
    r.interimResults = true;
    r.maxAlternatives = 5;
    r.continuous = false;
    let done = false;
    // an aborted or replaced recognizer still fires its events — ignore them
    const stale = () => rec.current !== r;
    r.onresult = (e) => {
      if (stale()) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          done = true;
          const alts: string[] = [];
          for (let a = 0; a < res.length; a++) alts.push(res[a].transcript);
          const best = bestSpokenSizes(alts);
          const labels = best ? labelsFor.current(best.sizes.length) : null;
          setState(best && labels
            ? { phase: "heard", heard: best.heard, sizes: best.sizes, labels }
            : { phase: "unclear", heard: alts[0] ?? "" });
          return;
        }
        interim += res[0].transcript;
      }
      setState({ phase: "listening", interim });
    };
    r.onerror = (e) => {
      if (stale() || e.error === "aborted") return;
      done = true;
      setState({
        phase: "error",
        message:
          e.error === "not-allowed" || e.error === "service-not-allowed"
            ? "Mic is blocked. Allow the microphone for this site in your browser settings."
            : e.error === "network" ? "Voice needs internet. Type the size, or try again when online."
            : e.error === "no-speech" ? "Didn't hear anything. Tap the mic and say the size."
            : "Voice didn't work this time. Try again, or type the size.",
      });
    };
    r.onend = () => {
      if (!stale() && !done) setState({ phase: "error", message: "Didn't hear anything. Tap the mic and say the size." });
    };
    rec.current = r;
    old?.abort();
    setState({ phase: "listening", interim: "" });
    try { r.start(); } catch { setState({ phase: "error", message: "Voice didn't start. Try again." }); }
  };

  return {
    supported,
    state,
    lang,
    start(names: (n: number) => string[] | null) {
      labelsFor.current = names;
      begin(lang);
    },
    again() { begin(lang); },
    setLang(l: VoiceLang) {
      setLangState(l);
      try { localStorage.setItem(LANG_KEY, l); } catch { /* remembered for this visit only */ }
      begin(l);
    },
    close() {
      const r = rec.current;
      rec.current = null;
      r?.abort();
      setState({ phase: "idle" });
    },
  };
}

export type Voice = ReturnType<typeof useVoice>;

export function MicButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}

/** The sheet over the bottom of the screen while listening, and to confirm what was heard. */
export function VoiceSheet({ voice, onUse }: { voice: Voice; onUse: (sizes: Um[]) => void }) {
  const s = voice.state;
  if (s.phase === "idle") return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={voice.close}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" role="dialog" aria-label="Say the size"
        style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Say the size</h2>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg text-xs font-bold" style={{ border: "1px solid var(--line)" }}>
              {(["hi-IN", "en-IN"] as const).map((l) => (
                <button key={l} onClick={() => voice.setLang(l)} aria-pressed={voice.lang === l}
                  className="px-2.5 py-1.5"
                  style={voice.lang === l ? { background: "var(--ink)", color: "#fff" } : { color: "var(--ink-3)" }}>
                  {l === "hi-IN" ? "हिंदी" : "English"}
                </button>
              ))}
            </div>
            <button onClick={voice.close} aria-label="Close" className="text-2xl leading-none" style={{ color: "var(--ink-3)" }}>×</button>
          </div>
        </div>

        {s.phase === "listening" && (
          <div className="mt-5 flex flex-col items-center gap-3 text-center">
            <span className="voice-pulse grid h-16 w-16 place-items-center rounded-full"
              style={{ background: "var(--accent)", color: "#fff" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </span>
            <p className="min-h-[24px] text-base font-semibold">{s.interim || "Listening…"}</p>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              “4 feet 6 inch by 5 feet” · “char foot chhe inch” · “saadhe chaar foot”
            </p>
          </div>
        )}

        {s.phase === "heard" && (
          <div className="mt-4">
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>Heard: “{s.heard}”</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {s.sizes.map((um, i) => (
                <div key={i} className="flex items-baseline justify-between rounded-lg px-3 py-2"
                  style={{ background: "var(--good-soft)" }}>
                  <span className="text-sm font-semibold" style={{ color: "var(--ink-3)" }}>{s.labels[i]}</span>
                  <span className="text-xl font-bold tabnum" style={{ color: "var(--good)" }}>{formatFtIn(um)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={voice.again} className="btn-ghost flex-1 py-3">Say again</button>
              <button onClick={() => { onUse(s.sizes); voice.close(); }} className="btn-primary flex-1 py-3">Use this</button>
            </div>
          </div>
        )}

        {(s.phase === "unclear" || s.phase === "error") && (
          <div className="mt-4">
            {s.phase === "unclear" ? (
              <>
                <p className="text-sm font-semibold" style={{ color: "var(--bad)" }}>Couldn&apos;t read a size in that.</p>
                {s.heard && <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>Heard: “{s.heard}”</p>}
                <p className="mt-2 text-xs" style={{ color: "var(--ink-3)" }}>
                  Say the unit with each number: “4 feet 6 inch”, or just “4 point 6”.
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold" style={{ color: "var(--bad)" }}>{s.message}</p>
            )}
            <button onClick={voice.again} className="btn-primary mt-4 w-full py-3">Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}
