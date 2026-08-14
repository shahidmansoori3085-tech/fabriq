"use client";
/**
 * FabriQ voice input — the fabricator can SPEAK instead of type (hands often
 * busy/dirty in the workshop). Uses the browser's Web Speech API (on-device on
 * most phones), Hindi-first. Gracefully hides itself where unsupported.
 */
import { useEffect, useRef, useState } from "react";

/* minimal typing for the non-standard SpeechRecognition API */
interface SR extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
}
type SRCtor = new () => SR;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({
  onTranscript, lang = "hi-IN", title = "Speak your answer",
}: {
  onTranscript: (text: string) => void;
  lang?: string;
  title?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const Ctor = getSR();
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim();
      if (t) onTranscript(t);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* ignore */ } };
  }, [lang, onTranscript]);

  if (!supported) return null;

  const toggle = () => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) { try { rec.stop(); } catch { /* ignore */ } setListening(false); }
    else { try { rec.start(); setListening(true); } catch { /* ignore */ } }
  };

  return (
    <button type="button" onClick={toggle} title={title} aria-label={title}
      className={`grid shrink-0 place-items-center rounded-xl transition-all ${listening ? "pulse-ring" : ""}`}
      style={{
        width: 42, height: 42,
        background: listening ? "var(--accent)" : "var(--surface)",
        color: listening ? "#fff" : "var(--ink-2)",
        border: `1.5px solid ${listening ? "var(--accent)" : "var(--line)"}`,
      }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
      </svg>
    </button>
  );
}
