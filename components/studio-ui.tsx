"use client";
/** Small shared pieces for the System Studio screens. */
import type { ReactNode } from "react";

export type Tone = "good" | "glass" | "warn" | "bad" | "plain";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: "var(--good-soft)", fg: "var(--good)" },
  glass: { bg: "var(--glass-soft)", fg: "var(--glass)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  bad: { bg: "var(--bad-soft)", fg: "var(--bad)" },
  plain: { bg: "var(--surface-3)", fg: "var(--ink-2)" },
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONES[tone];
  return <span className="badge whitespace-nowrap" style={{ background: t.bg, color: t.fg }}>{children}</span>;
}

/** A segmented choice — 2 to 5 short options. */
export function Seg<T extends string | number>({ value, options, onChange, small }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg p-0.5" style={{ background: "var(--surface-3)" }} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`rounded-md font-semibold ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
            style={{ background: on ? "var(--surface)" : "transparent", color: on ? "var(--ink)" : "var(--ink-3)", boxShadow: on ? "0 1px 2px rgba(17,24,39,.08)" : "none" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface)", maxHeight: "88vh", overflowY: "auto", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold leading-tight">{title}</h2>
            {sub && <p className="mt-1 text-xs" style={{ color: "var(--ink-3)" }}>{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="-mt-1 text-2xl leading-none" style={{ color: "var(--ink-3)" }}>×</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: "var(--ink-2)" }}>{label}</span>
      {children}
      {hint && <span className="text-xs" style={{ color: "var(--ink-3)" }}>{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between gap-2">
      <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{children}</h3>
      {aside}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--accent)" : "var(--steel)" }}>
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </button>
  );
}

/** A thin front view of a sliding window: frame, shutters, glass/mesh. */
export function SlidingThumb({ mix, domal }: { mix: string; domal?: boolean }) {
  const n = Math.max(1, mix.length);
  const W = 120, H = 80, f = domal ? 7 : 5;
  const sw = (W - 2 * f) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden>
      <rect x="1" y="1" width={W - 2} height={H - 2} rx="2" fill="var(--surface-2)" stroke="var(--ink-2)" strokeWidth="2" />
      {[...mix].map((c, i) => (
        <g key={i}>
          <rect x={f + i * sw + 1} y={f} width={sw - 2} height={H - 2 * f} rx="1.5" fill="var(--surface)" stroke="var(--ink-3)" strokeWidth="1.5" />
          <rect x={f + i * sw + 5} y={f + 4} width={sw - 10} height={H - 2 * f - 8}
            fill={c === "J" ? "url(#mesh)" : "var(--glass-soft)"} stroke={c === "J" ? "var(--ink-3)" : "var(--glass)"} strokeWidth="0.8" />
        </g>
      ))}
      <defs>
        <pattern id="mesh" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 0L4 4M4 0L0 4" stroke="var(--steel)" strokeWidth="0.6" />
        </pattern>
      </defs>
    </svg>
  );
}
