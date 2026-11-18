"use client";
/**
 * The first material list of a window series asks once: do these cuts match your shop?
 * (founder 2026-11-18) — not at once, but after the list has been looked at: when the
 * shop reaches its end, or when it leaves the list. "All correct" never asks again for
 * that series; "Change cuts" opens the series on its drawing.
 */
import { useEffect, useRef, useState } from "react";

const KEY = "fabriq.seriesOk";
const confirmed = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; } };

/** Leave the list: a series still unchecked is asked about first, then `go` runs. */
export function leaveList(go: () => void) {
  const e = new CustomEvent<{ go: () => void }>("fabriq:leave-list", { cancelable: true, detail: { go } });
  if (window.dispatchEvent(e)) go();
}

export function SeriesCheck({ series }: { series?: { id: string; name: string; href: string } }) {
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
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => finish(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--ink-3)" }}>First list for this series</div>
            <h2 className="mt-1 text-xl font-bold leading-tight">{series.name}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
              Do these cuts match your shop? If not, change them your way. Every next list will follow your cuts.
            </p>
            <button type="button" className="btn-primary mt-5 w-full py-3.5 text-base" onClick={() => finish(true)}>All correct</button>
            <a href={series.href} className="btn-ghost mt-2 block w-full py-3 text-center text-sm font-semibold"
              onClick={() => { asked.current = true; then.current = null; }}>Change cuts</a>
            <button type="button" className="mt-2 w-full py-2 text-sm" style={{ color: "var(--ink-3)" }} onClick={() => finish(false)}>Later</button>
          </div>
        </div>
      )}
    </>
  );
}
