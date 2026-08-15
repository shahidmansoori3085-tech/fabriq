"use client";
/**
 * Photo flow: capture/upload sheet photo → downscale client-side (cost) →
 * /api/ai/read-sheet → editable extracted items.
 */
import { useRef, useState } from "react";
import { parseDimension, describeDim, openingWarning } from "@/lib/engine/units";

export interface ExtractedItem {
  type: "window" | "door" | "partition";
  width_raw: string;
  height_raw: string;
  unit_guess: "feet" | "inches" | "mm" | "ft-in-sut";
  qty: number;
  tracks?: string;
  mix?: string;
  system?: string;
  notes?: string;
  confidence: "high" | "medium" | "low";
}

/** apply unit_guess so parseDimension reads it right */
export function normalizeRaw(raw: string, unit: ExtractedItem["unit_guess"]): string {
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    if (unit === "inches") return `${s}"`;
    if (unit === "mm") return `${s}mm`;
  }
  return s;
}

/** downscale to max 2000px long edge, JPEG q80, return base64 (no prefix) */
export async function downscale(file: File): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new window.Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const MAX = 2000;
    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ————————————————— composer ————————————————— */

interface Shot { id: string; url: string; data: string; mediaType: string }

/**
 * Attach-and-send composer for sheet photos.
 *
 * The founder asked for something "chatbot type" here. A message THREAD is the
 * wrong shape for data entry — it adds turns and hides what you have already
 * attached — so this takes the part that matters: several photos, a free-text
 * note underneath, one send. Everything stays visible and removable until sent.
 *
 * A real sheet is often more than one photo: separate pages, or a close-up of a
 * corner the wide shot could not read. One analysis call sees them together.
 */
export function PhotoComposer({ apiKey, onExtracted, onNeedKey }: {
  apiKey: string | null;
  onExtracted: (items: ExtractedItem[], sheetNotes?: string) => void;
  onNeedKey: () => void;
}) {
  // Two inputs, not one: `capture` takes a phone straight to the camera, but
  // it also forces single-shot capture — a fabricator picking several
  // existing photos of one sheet needs the plain gallery picker instead.
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const next: Shot[] = [];
    for (const f of Array.from(files)) {
      try {
        const { data, mediaType } = await downscale(f);
        next.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url: URL.createObjectURL(f), data, mediaType });
      } catch { /* skip unreadable file, keep the rest */ }
    }
    setShots((s) => [...s, ...next]);
  };

  const remove = (id: string) =>
    setShots((s) => {
      const gone = s.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return s.filter((x) => x.id !== id);
    });

  const send = async () => {
    if (!shots.length || busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/ai/read-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: shots.map((s) => ({ data: s.data, mediaType: s.mediaType })),
          notes: note.trim() || undefined,
          apiKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.message || "Could not read the photo.");
        if (d.error === "no_key") onNeedKey();
      } else if (!d.legible || !d.items?.length) {
        setError("The photo is blurred, or the sheet could not be understood. Take it again, or enter the sizes yourself.");
      } else {
        onExtracted(d.items, d.sheet_notes);
      }
    } catch { setError("Network problem. Please try again."); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

      {/* attachment tray — every photo stays visible and removable until sent */}
      {shots.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shots.map((s, i) => (
            <div key={s.id} className="relative overflow-hidden rounded-xl"
              style={{ border: "1px solid var(--line)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={`sheet ${i + 1}`} className="h-24 w-24 object-cover" />
              <span className="absolute bottom-0 left-0 px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: "rgba(0,0,0,.55)" }}>{i + 1}</span>
              {!busy && (
                <button onClick={() => remove(s.id)} aria-label="Remove"
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: "rgba(0,0,0,.6)" }}>✕</button>
              )}
            </div>
          ))}
          {!busy && (
            <>
              <button onClick={() => cameraRef.current?.click()} aria-label="Take another photo"
                className="grid h-24 w-24 place-items-center rounded-xl text-2xl"
                style={{ border: "1px dashed var(--steel)", color: "var(--ink-3)" }}>📷</button>
              <button onClick={() => galleryRef.current?.click()} aria-label="Add from gallery"
                className="grid h-24 w-24 place-items-center rounded-xl text-2xl"
                style={{ border: "1px dashed var(--steel)", color: "var(--ink-3)" }}>🖼️</button>
            </>
          )}
        </div>
      )}

      {shots.length === 0 && (
        <div className="flex items-stretch gap-2">
          <button onClick={() => cameraRef.current?.click()} disabled={busy}
            className="btn-primary flex flex-1 flex-col items-center gap-1 py-6 display disabled:opacity-60">
            <span className="text-3xl">📷</span>
            <span className="text-lg">Take a Photo</span>
            <span className="text-xs font-normal opacity-90">One page or several — all read together</span>
          </button>
          <button onClick={() => galleryRef.current?.click()} disabled={busy}
            className="btn-ghost flex flex-col items-center justify-center gap-1 px-4 disabled:opacity-60"
            style={{ border: "1px solid var(--line)" }}>
            <span className="text-xl">🖼️</span>
            <span className="text-xs font-semibold">Gallery</span>
          </button>
        </div>
      )}

      {shots.length > 0 && (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} disabled={busy}
            placeholder="Anything else we should know? For example — all in Domal, or this is a third-floor job…"
            className="dim-input w-full px-3 py-2.5 text-sm" />
          <button onClick={send} disabled={busy}
            className="btn-primary w-full py-4 text-base display disabled:opacity-60">
            {busy
              ? "Reading…"
              : `Read ${shots.length} ${shots.length === 1 ? "photo" : "photos"}${note.trim() ? " + my notes" : ""} →`}
          </button>
        </>
      )}

      {busy && (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: "var(--accent)" }}>
          <ScanSpinner /> Reading the sheet…
        </div>
      )}

      {error && (
        <div className="card p-4 text-sm" style={{ background: "var(--bad-soft)", color: "var(--ink)" }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}

/** Editable review of what AI read */
export function ExtractReview({
  items, onConfirm, onCancel,
}: {
  items: ExtractedItem[];
  onConfirm: (items: ExtractedItem[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<ExtractedItem[]>(items);

  const update = (i: number, patch: Partial<ExtractedItem>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));

  // A row is only good enough to build if both sides read AND the result is a
  // real opening — a mis-guessed unit makes a 4" window look perfectly parseable.
  const allValid = rows.length > 0 && rows.every((r) => {
    const w = parseDimension(normalizeRaw(r.width_raw, r.unit_guess));
    const h = parseDimension(normalizeRaw(r.height_raw, r.unit_guess));
    return w && h && !openingWarning(w, h);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-3 text-xs" style={{ background: "var(--accent-soft)", color: "var(--ink-2)" }}>
        🤖 This is what we read. Tap any number to correct it — a five-second check here
        is what makes the rest of the job accurate.
      </div>
      {rows.map((r, i) => {
        const w = parseDimension(normalizeRaw(r.width_raw, r.unit_guess));
        const h = parseDimension(normalizeRaw(r.height_raw, r.unit_guess));
        const sizeWarn = w && h ? openingWarning(w, h) : null;
        return (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="display font-bold">
                {r.type === "door" ? "🚪 Door" : r.type === "partition" ? "🧱 Partition" : "🪟 Window"} {i + 1}
                {r.confidence !== "high" && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    CHECK THIS
                  </span>
                )}
              </span>
              <button onClick={() => remove(i)} className="text-sm" style={{ color: "var(--bad)" }}>✕</button>
            </div>
            {/* type — editable so a mis-read (door vs window vs partition) is fixed before questions */}
            <div className="mt-2 flex gap-1.5">
              {(["window", "door", "partition"] as const).map((t) => (
                <button key={t} onClick={() => update(i, { type: t })}
                  className={`chip flex-1 px-2 py-1.5 text-xs font-semibold ${r.type === t ? "selected" : ""}`}>
                  {t === "window" ? "🪟 Window" : t === "door" ? "🚪 Door" : "🧱 Partition"}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <input
                  value={r.width_raw}
                  onChange={(e) => update(i, { width_raw: e.target.value })}
                  className="dim-input w-full px-3 py-2 font-semibold"
                  style={!w ? { borderColor: "var(--bad)" } : undefined}
                />
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: w && !sizeWarn ? "var(--good)" : "var(--bad)" }}>
                  {w ? `W = ${describeDim(w)}` : "Width not understood"}
                </div>
              </div>
              <div>
                <input
                  value={r.height_raw}
                  onChange={(e) => update(i, { height_raw: e.target.value })}
                  className="dim-input w-full px-3 py-2 font-semibold"
                  style={!h ? { borderColor: "var(--bad)" } : undefined}
                />
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: h && !sizeWarn ? "var(--good)" : "var(--bad)" }}>
                  {h ? `H = ${describeDim(h)}` : "Height not understood"}
                </div>
              </div>
            </div>
            {sizeWarn && (
              <div className="mt-2 rounded-lg px-3 py-2 text-[11px] font-semibold"
                style={{ background: "var(--bad-soft)", color: "var(--ink)" }}>
                ⚠️ {sizeWarn}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs" style={{ color: "var(--ink-3)" }}>Qty:</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => update(i, { qty: n })}
                  className={`chip px-3 py-1 text-sm ${r.qty === n ? "selected" : ""}`}>
                  {n}
                </button>
              ))}
              <input
                type="number" min={1} max={50} value={r.qty}
                onChange={(e) => update(i, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                className="dim-input w-16 px-2 py-1 text-sm"
              />
            </div>
            {r.notes && (
              <p className="mt-2 text-xs italic" style={{ color: "var(--ink-3)" }}>
                📝 Written on the sheet: “{r.notes}”
              </p>
            )}
          </div>
        );
      })}
      <button
        onClick={() => onConfirm(rows)}
        disabled={!allValid}
        className="btn-primary w-full py-4 text-lg display disabled:opacity-40"
      >
        ✓ Looks Right — Continue
      </button>
      <button onClick={onCancel} className="btn-ghost w-full py-3">
        Enter sizes myself
      </button>
    </div>
  );
}

function ScanSpinner() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="10" fill="none" stroke="var(--steel)" strokeWidth="3" />
      <path d="M12 2 a10 10 0 0 1 10 10" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
