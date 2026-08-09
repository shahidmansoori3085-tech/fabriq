"use client";
/**
 * Photo flow: capture/upload sheet photo → downscale client-side (cost) →
 * /api/ai/read-sheet → editable extracted items.
 */
import { useRef, useState } from "react";
import { parseDimension, formatFtInSut } from "@/lib/engine/units";

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

export function PhotoCapture({
  apiKey, onExtracted, onNeedKey,
}: {
  apiKey: string | null;
  onExtracted: (items: ExtractedItem[], sheetNotes?: string) => void;
  onNeedKey: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => {
    if (!apiKey) {
      onNeedKey();
      return;
    }
    fileRef.current?.click();
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(f));
    try {
      const { data, mediaType } = await downscale(f);
      const r = await fetch("/api/ai/read-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType, apiKey }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.message || "Photo padhne mein dikkat aayi.");
      } else if (!d.legible || !d.items?.length) {
        setError("Photo dhundhli hai ya sheet samajh nahi aayi — dobara kheencho ya haath se bharo.");
      } else {
        onExtracted(d.items, d.sheet_notes);
      }
    } catch {
      setError("Network problem — dobara try karo.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <button
        onClick={pick}
        disabled={busy}
        className="btn-primary flex w-full flex-col items-center gap-1 py-6 display disabled:opacity-60"
      >
        <span className="text-3xl">📷</span>
        <span className="text-lg">Sheet ki Photo Upload Karo</span>
        <span className="text-xs font-normal opacity-90">AI khud padhega — sizes, system, sab</span>
      </button>

      {busy && preview && (
        <div className="card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="sheet" className="max-h-56 w-full object-cover opacity-70" />
          <div className="flex items-center justify-center gap-2 p-4 text-sm font-semibold"
            style={{ color: "var(--accent)" }}>
            <ScanSpinner /> AI sheet padh raha hai…
          </div>
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

  const allValid = rows.length > 0 && rows.every((r) => {
    const w = parseDimension(normalizeRaw(r.width_raw, r.unit_guess));
    const h = parseDimension(normalizeRaw(r.height_raw, r.unit_guess));
    return w && h;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-3 text-xs" style={{ background: "var(--accent-soft)", color: "var(--ink-2)" }}>
        🤖 AI ne yeh padha — galat ho toh number tap karke theek karo. Yeh 5 second
        ka check hi 99% accuracy ki guarantee hai.
      </div>
      {rows.map((r, i) => {
        const w = parseDimension(normalizeRaw(r.width_raw, r.unit_guess));
        const h = parseDimension(normalizeRaw(r.height_raw, r.unit_guess));
        return (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="display font-bold">
                {r.type === "door" ? "🚪 Door" : r.type === "partition" ? "🧱 Partition" : "🪟 Window"} {i + 1}
                {r.confidence !== "high" && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
                    CHECK KARO
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
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: w ? "var(--good)" : "var(--bad)" }}>
                  {w ? `W = ${formatFtInSut(w)}` : "width samajh nahi aayi"}
                </div>
              </div>
              <div>
                <input
                  value={r.height_raw}
                  onChange={(e) => update(i, { height_raw: e.target.value })}
                  className="dim-input w-full px-3 py-2 font-semibold"
                  style={!h ? { borderColor: "var(--bad)" } : undefined}
                />
                <div className="mt-0.5 text-[11px] font-semibold" style={{ color: h ? "var(--good)" : "var(--bad)" }}>
                  {h ? `H = ${formatFtInSut(h)}` : "height samajh nahi aayi"}
                </div>
              </div>
            </div>
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
                📝 Sheet pe likha: “{r.notes}”
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
        ✓ Sahi Hai — Aage Badho
      </button>
      <button onClick={onCancel} className="btn-ghost w-full py-3">
        Haath se bharo
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
