"use client";
/**
 * The first material list of a window series asks once: do these cuts match your shop?
 * (founder 2026-11-18) — not at once, but after the list has been looked at: when the
 * shop reaches its end, or when it leaves the list. It shows the window and its main cuts
 * so the shop can compare at a glance. "All correct" never asks again for that series;
 * "Change cuts" opens the series on its drawing.
 */
import { useEffect, useRef, useState } from "react";

const KEY = "fabriq.seriesOk";
const confirmed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; } };

/** Leave the list: a series still unchecked is asked about first, then `go` runs. */
export function leaveList(go: () => void) {
  const e = new CustomEvent<{ go: () => void }>("fabriq:leave-list", { cancelable: true, detail: { go } });
  if (window.dispatchEvent(e)) go();
}

export function SeriesCheck({ series, size, cuts }: {
  series?: { id: string; name: string; href: string };
  /** the window the cuts are for: "5′ × 4′" */
  size?: string;
  /** its main cuts: pipe and length */
  cuts?: { name: string; value: string }[];
}) {
  const [open, setOpen] = useState(false);
  const asked = useRef(false);
  const then = useRef<(() => void) | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  useEffect(() => { shown.current = Date.now(); }, []);
  const due = () => !!series && !asked.current && !confirmed().includes(series.id);

  // at the end of the list (after a few seconds of looking)
  useEffect(() => {
    const el = end.current;
    if (!el || !series) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting) && Date.now() - shown.current > 4000 && due()) { asked.current = true; setOpen(true); }
    });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id]);

  // on leaving the list
  useEffect(() => {
    const onLeave = (e: Event) => {
      if (!due()) return;
      e.preventDefault();
      asked.current = true;
      then.current = (e as CustomEvent<{ go: () => void }>).detail.go;
      setOpen(true);
    };
    window.addEventListener("fabriq:leave-list", onLeave);
    return () => window.removeEventListener("fabriq:leave-list", onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series?.id]);

  const finish = (ok: boolean) => {
    if (ok && series) { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...confirmed(), series.id])])); } catch { /* fine */ } }
    setOpen(false);
    const go = then.current; then.current = null;
    go?.();
  };

  return (
    <>
      <div ref={end} aria-hidden className="h-px" />
      {open && series && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={() => finish(false)}
          style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)" }}>
          <style>{`@keyframes fq-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
          <div role="dialog" aria-modal="true" aria-labelledby="fq-sc-title" className="w-full max-w-md overflow-hidden rounded-t-[24px] sm:rounded-[24px]"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", boxShadow: "0 24px 60px -12px rgba(15,23,42,.35)", animation: "fq-rise .28s ease-out" }}>
            {/* head: a ruler-and-tick mark, what this is, the series */}
            <div className="px-6 pb-4 pt-6 text-center" style={{ background: "linear-gradient(180deg, var(--surface-2), var(--surface))" }}>
              <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "0 4px 14px -6px rgba(15,23,42,.25)", color: "var(--accent)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /><path d="M14 18l2 2 4-4" />
                </svg>
              </span>
              <h2 id="fq-sc-title" className="mt-3 text-[20px] font-bold leading-tight">Check your first list</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-3)" }}>
                <b style={{ color: "var(--ink)" }}>{series.name}</b>{size ? <> · {size} window</> : null}
              </p>
            </div>

            {/* the main cuts, to compare with the shop's own */}
            {cuts && cuts.length > 0 && (
              <div className="mx-5 overflow-hidden rounded-2xl" style={{ border: "1px solid var(--line)" }}>
                {cuts.map((c, i) => (
                  <div key={c.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" style={i ? { borderTop: "1px solid var(--line)" } : undefined}>
                    <span style={{ color: "var(--ink-2)" }}>{c.name}</span>
                    <span className="mono font-bold">{c.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 pb-5 pt-4" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
              <p className="text-center text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                Same as your shop? Tap <b>All correct</b>.<br />Different? Change them once. Every next list follows your cuts.
              </p>
              <button type="button" className="btn-primary mt-4 w-full py-3.5 text-base" onClick={() => finish(true)}>All correct</button>
              <a href={series.href} className="mt-2 block w-full rounded-[var(--radius)] py-3 text-center text-sm font-semibold"
                style={{ border: "1px solid var(--line)", color: "var(--ink)" }}
                onClick={() => { asked.current = true; then.current = null; }}>Change cuts</a>
              <button type="button" className="mt-1 w-full py-2.5 text-sm" style={{ color: "var(--ink-3)" }} onClick={() => finish(false)}>Ask me later</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
