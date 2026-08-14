"use client";
/**
 * FabriQ visual language (D12): the fabricator SEES what is being asked.
 * Deterministic SVG renderers — dimensions always come from engine data.
 */
import { Um, formatFtInSut, toFeet } from "@/lib/engine/units";
import type { ShutterConfig, PackedBar, JobItem } from "@/lib/engine/types";
import { getSection } from "@/lib/engine/sections";

/* ——— fills shared by elevations ——— */
function glassFill(x: number, y: number, w: number, h: number, key: string) {
  return (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} fill="#dbeafe" stroke="#3b82f6" strokeWidth={1} />
      <line x1={x + w * 0.12} y1={y + h * 0.85} x2={x + w * 0.55} y2={y + h * 0.15} stroke="#93c5fd" strokeWidth={1} />
      <line x1={x + w * 0.4} y1={y + h * 0.88} x2={x + w * 0.85} y2={y + h * 0.3} stroke="#bfdbfe" strokeWidth={1} />
    </g>
  );
}
function jaliFill(x: number, y: number, w: number, h: number, key: string) {
  const lines = [];
  for (let i = 1; i < 5; i++) lines.push(<line key={`h${i}`} x1={x + 2} y1={y + (i * h) / 5} x2={x + w - 2} y2={y + (i * h) / 5} stroke="#94a89a" strokeWidth={0.4} />);
  for (let i = 1; i < 4; i++) lines.push(<line key={`v${i}`} x1={x + (i * w) / 4} y1={y + 2} x2={x + (i * w) / 4} y2={y + h - 2} stroke="#94a89a" strokeWidth={0.4} />);
  return <g key={key}><rect x={x} y={y} width={w} height={h} fill="#f1f5f0" stroke="#8ca08c" strokeWidth={1} />{lines}</g>;
}
function sheetFill(x: number, y: number, w: number, h: number, key: string) {
  return <rect key={key} x={x} y={y} width={w} height={h} fill="#eef1f4" stroke="#aab2bd" strokeWidth={1} />;
}

/**
 * MiniElevation — a clean, exact front-view of any opening (window / door /
 * partition), drawn straight from its dimensions. Used in the quotation so the
 * customer SEES the design. Deterministic — no AI/image API needed.
 */
export function MiniElevation({ item, size = 60 }: { item: JobItem; size?: number }) {
  const ar = item.height / item.width;
  const W = size;
  const H = Math.min(Math.max(size * ar, size * 0.6), size * 1.7);
  const fr = 3;
  const iw = W - fr * 2, ih = H - fr * 2;
  const frame = (
    <>
      <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} rx={2} fill="#dde1e7" stroke="#5a5f6a" strokeWidth={1.5} />
      <rect x={fr} y={fr} width={iw} height={ih} fill="#fff" />
    </>
  );
  const cells: React.ReactNode[] = [];

  if (item.type === "partition") {
    const hasDoor = item.meta.partDoor === "yes";
    const doorFrac = hasDoor ? Math.min(0.42, (parseFloat(item.meta.partDoorW ?? "3") || 3) / toFeet(item.width)) : 0;
    const sheetFt = parseFloat(item.meta.partSheetFt ?? "0") || 0;
    const sheetFrac = sheetFt > 0 ? Math.min(0.5, sheetFt / toFeet(item.height)) : 0;
    const fieldW = iw * (1 - doorFrac);
    const bays = Math.max(1, Math.round(toFeet(item.width) * (1 - doorFrac) / (parseFloat(item.meta.partBayFt ?? "2.5") || 2.5)));
    const bw = fieldW / bays;
    const sheetH = ih * sheetFrac, glassH = ih - sheetH;
    for (let b = 0; b < bays; b++) {
      const x = fr + b * bw;
      cells.push(glassFill(x + 0.5, fr, bw - 1, glassH - 0.5, `g${b}`));
      if (sheetH > 0) cells.push(sheetFill(x + 0.5, fr + glassH, bw - 1, sheetH, `s${b}`));
    }
    if (hasDoor) {
      const dx = fr + fieldW;
      cells.push(<rect key="door" x={dx + 1} y={fr} width={iw * doorFrac - 1} height={ih} fill="#e6efe9" stroke="#0f6e56" strokeWidth={1.5} />);
      cells.push(<line key="dh" x1={dx + 3} y1={fr + ih * 0.5} x2={dx + iw * doorFrac - 2} y2={fr + ih * 0.5} stroke="#0f6e56" strokeWidth={0.6} />);
    }
  } else if (item.type === "door") {
    const zones = item.shutters.length || 1;
    const zh = ih / zones;
    for (let z = 0; z < zones; z++) {
      const y = fr + z * zh;
      const k = item.shutters[z]?.kind;
      cells.push(k === "jali" ? jaliFill(fr + 1, y + 1, iw - 2, zh - 2, `d${z}`) : sheetFill(fr + 1, y + 1, iw - 2, zh - 2, `d${z}`));
    }
  } else {
    // window — N shutters side by side
    const n = Math.max(1, item.shutters.length);
    const sw = iw / n;
    for (let i = 0; i < n; i++) {
      const x = fr + i * sw;
      const k = item.shutters[i]?.kind;
      cells.push(k === "jali" ? jaliFill(x + 1, fr + 1, sw - 2, ih - 2, `w${i}`)
        : k === "sheet" ? sheetFill(x + 1, fr + 1, sw - 2, ih - 2, `w${i}`)
          : glassFill(x + 1, fr + 1, sw - 2, ih - 2, `w${i}`));
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }} role="img"
      aria-label={`${item.type} elevation`}>
      {frame}{cells}
    </svg>
  );
}

/** Window elevation with shutters, glass/jali fill and dimension labels */
export function WindowDiagram({
  width, height, shutters, size = 210,
}: {
  width: Um; height: Um; shutters: ShutterConfig[]; size?: number;
}) {
  const ratio = height / width;
  const w = size;
  const h = Math.min(Math.max(size * ratio, 90), size * 1.5);
  const frame = 7;
  const n = Math.max(shutters.length, 1);
  const innerW = w - frame * 2;
  const innerH = h - frame * 2;
  const shW = innerW / n;

  return (
    <svg
      viewBox={`0 0 ${w + 56} ${h + 40}`}
      width="100%"
      style={{ maxWidth: w + 56 }}
      role="img"
      aria-label="Window diagram"
    >
      {/* frame */}
      <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={3}
        fill="#dde1e7" stroke="#5a5f6a" strokeWidth={1.5} />
      <rect x={frame} y={frame} width={innerW} height={innerH}
        fill="#f8fafc" stroke="#9aa0ab" strokeWidth={0.75} />
      {/* shutters */}
      {shutters.map((sh, i) => {
        const x = frame + i * shW;
        return (
          <g key={i}>
            <rect x={x + 2} y={frame + 2} width={shW - 4} height={innerH - 4}
              fill={sh.kind === "glass" ? "#dbeafe" : "#f1f5f0"}
              stroke="#5a5f6a" strokeWidth={1.2} />
            {sh.kind === "glass" ? (
              <>
                <line x1={x + 8} y1={frame + innerH * 0.6} x2={x + shW * 0.55} y2={frame + 10}
                  stroke="#93c5fd" strokeWidth={1.5} />
                <line x1={x + 8} y1={frame + innerH * 0.85} x2={x + shW * 0.8} y2={frame + 12}
                  stroke="#93c5fd" strokeWidth={1} />
              </>
            ) : (
              <g stroke="#94a89a" strokeWidth={0.5}>
                {Array.from({ length: 6 }).map((_, r) => (
                  <line key={`h${r}`} x1={x + 4} y1={frame + 8 + (r * (innerH - 16)) / 5}
                    x2={x + shW - 4} y2={frame + 8 + (r * (innerH - 16)) / 5} />
                ))}
                {Array.from({ length: 5 }).map((_, c) => (
                  <line key={`v${c}`} x1={x + 6 + (c * (shW - 12)) / 4} y1={frame + 4}
                    x2={x + 6 + (c * (shW - 12)) / 4} y2={frame + innerH - 4} />
                ))}
              </g>
            )}
            <text x={x + shW / 2} y={h - frame - 8} textAnchor="middle"
              fontSize={11} fontWeight={700} fill="#5a5f6a">
              {sh.kind === "glass" ? "GLASS" : "MESH"}
            </text>
          </g>
        );
      })}
      {/* width dim */}
      <line x1={0} y1={h + 14} x2={w} y2={h + 14} stroke="#e8590c" strokeWidth={1} />
      <line x1={0} y1={h + 9} x2={0} y2={h + 19} stroke="#e8590c" strokeWidth={1} />
      <line x1={w} y1={h + 9} x2={w} y2={h + 19} stroke="#e8590c" strokeWidth={1} />
      <text x={w / 2} y={h + 32} textAnchor="middle" fontSize={13} fontWeight={700} fill="#e8590c">
        {formatFtInSut(width)}
      </text>
      {/* height dim */}
      <line x1={w + 14} y1={0} x2={w + 14} y2={h} stroke="#e8590c" strokeWidth={1} />
      <line x1={w + 9} y1={0} x2={w + 19} y2={0} stroke="#e8590c" strokeWidth={1} />
      <line x1={w + 9} y1={h} x2={w + 19} y2={h} stroke="#e8590c" strokeWidth={1} />
      <text x={w + 30} y={h / 2} textAnchor="middle" fontSize={13} fontWeight={700}
        fill="#e8590c" transform={`rotate(90 ${w + 30} ${h / 2})`}>
        {formatFtInSut(height)}
      </text>
    </svg>
  );
}

/** Small cross-section comparison for track questions */
export function TrackDiagram({ tracks }: { tracks: number }) {
  const w = 120, h = 34;
  const tw = (w - 16) / tracks;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} role="img" aria-label={`${tracks} track`}>
      <rect x={1} y={h - 12} width={w - 2} height={11} fill="#dde1e7" stroke="#5a5f6a" />
      {Array.from({ length: tracks }).map((_, i) => (
        <g key={i}>
          <rect x={8 + i * tw + tw * 0.25} y={4} width={tw * 0.5} height={h - 14}
            fill="#f8fafc" stroke="#5a5f6a" strokeWidth={1} />
          <rect x={8 + i * tw + tw * 0.25} y={h - 16} width={tw * 0.5} height={4} fill="#e8590c" />
        </g>
      ))}
    </svg>
  );
}

/**
 * Partition elevation preview — one zone per character in `zonemix`
 * (S=sheet, G=glass), stacked bottom-to-top with a DP divider between
 * zones. Used both as a small per-option preview (question chooser) and
 * larger in the live preview.
 */
export function PartitionDiagram({ zonemix, size = 96 }: { zonemix: string; size?: number }) {
  const w = size, h = size;
  const frame = Math.max(3, size * 0.04);
  const innerW = w - frame * 2;
  const innerH = h - frame * 2;
  const zones = zonemix.split("");
  const n = zones.length;
  const dividerH = Math.max(2, size * 0.03);
  const zoneH = (innerH - dividerH * (n - 1)) / n;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }} role="img"
      aria-label={`Partition ${zonemix}`}>
      <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={2}
        fill="#dde1e7" stroke="#5a5f6a" strokeWidth={1.5} />
      {/* zones stacked bottom-up so index 0 (first char) renders at bottom */}
      {zones.map((z, i) => {
        const yFromBottom = i * (zoneH + dividerH);
        const y = h - frame - yFromBottom - zoneH;
        return (
          <g key={i}>
            <rect x={frame} y={y} width={innerW} height={zoneH}
              fill={z === "G" ? "#dbeafe" : "#f1f3f5"}
              stroke={z === "G" ? "#3b82f6" : "#9aa0ab"} strokeWidth={1} />
            {z === "G" && (
              <line x1={frame + innerW * 0.12} y1={y + zoneH * 0.85} x2={frame + innerW * 0.55} y2={y + zoneH * 0.15}
                stroke="#93c5fd" strokeWidth={1} />
            )}
            {i < n - 1 && (
              <rect x={frame} y={y - dividerH} width={innerW} height={dividerH} fill="#5a5f6a" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Partition bay preview — splits the actual partition width into N vertical
 * bays for a chosen bay-width, so the fabricator SEES how many dividers a
 * choice produces before picking. (Drawing-driven divider spacing.)
 */
export function PartitionBayDiagram({
  widthUm, bayFt, size = 104,
}: { widthUm: Um; bayFt: number; size?: number }) {
  const w = size, h = size * 0.72;
  const frame = 4;
  const innerW = w - frame * 2;
  const innerH = h - frame * 2;
  const widthFt = toFeet(widthUm);
  const bays = Math.max(1, Math.round(widthFt / bayFt));
  const bw = innerW / bays;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }} role="img"
      aria-label={`Partition ${bays} bays`}>
      <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={2}
        fill="#dde1e7" stroke="#5a5f6a" strokeWidth={1.5} />
      {Array.from({ length: bays }).map((_, i) => {
        const x = frame + i * bw;
        return (
          <g key={i}>
            {/* glass upper ~65%, sheet lower ~35% */}
            <rect x={x + 1} y={frame} width={bw - 2} height={innerH * 0.62}
              fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.75} />
            <rect x={x + 1} y={frame + innerH * 0.64} width={bw - 2} height={innerH * 0.36}
              fill="#f1f3f5" stroke="#9aa0ab" strokeWidth={0.75} />
            {i < bays - 1 && (
              <rect x={x + bw - 1.5} y={frame} width={3} height={innerH} fill="#e8590c" />
            )}
          </g>
        );
      })}
      <text x={w / 2} y={h - 1} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#5a5f6a">
        {bays} panel
      </text>
    </svg>
  );
}

/**
 * Partition ROW preview — splits the glass band (total height minus the bottom
 * sheet) into N horizontal rows for a chosen row-height, so the fabricator sees
 * how many horizontal (leta) dividers a choice produces.
 */
export function PartitionRowDiagram({
  heightUm, sheetFt, rowFt, size = 104,
}: { heightUm: Um; sheetFt: number; rowFt: number; size?: number }) {
  const w = size * 0.7, h = size;
  const frame = 4;
  const innerW = w - frame * 2;
  const innerH = h - frame * 2;
  const heightFt = toFeet(heightUm);
  const glassFt = Math.max(1, heightFt - sheetFt);
  const rows = Math.max(1, Math.round(glassFt / rowFt));
  const sheetFrac = sheetFt > 0 ? Math.min(0.5, sheetFt / heightFt) : 0;
  const sheetPx = innerH * sheetFrac;
  const glassPx = innerH - sheetPx;
  const rowPx = glassPx / rows;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }} role="img"
      aria-label={`Partition ${rows} rows`}>
      <rect x={0.75} y={0.75} width={w - 1.5} height={h - 1.5} rx={2}
        fill="#dde1e7" stroke="#5a5f6a" strokeWidth={1.5} />
      {/* glass rows (top) */}
      {Array.from({ length: rows }).map((_, i) => {
        const y = frame + i * rowPx;
        return (
          <g key={i}>
            <rect x={frame} y={y} width={innerW} height={rowPx - 0.5}
              fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.6} />
            {i < rows - 1 && (
              <rect x={frame} y={y + rowPx - 1.5} width={innerW} height={3} fill="#e8590c" />
            )}
          </g>
        );
      })}
      {/* sheet band (bottom) */}
      {sheetPx > 0 && (
        <rect x={frame} y={frame + glassPx} width={innerW} height={sheetPx}
          fill="#f1f3f5" stroke="#9aa0ab" strokeWidth={0.75} />
      )}
      <text x={w / 2} y={h - 1} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#5a5f6a">
        {rows} row
      </text>
    </svg>
  );
}

/** Annotated window reference — shows where each section type goes */
export function CuttingGuide({ system = "normal" }: { system?: "normal" | "domal" }) {
  const fw = 300, fh = 200;
  const fr = 12;
  const innerW = fw - fr * 2;
  const innerH = fh - fr * 2;
  const sw = innerW / 3;
  const pw = 7;
  const bh = 7;
  const domal = system === "domal";

  return (
    <div className="card p-4">
      <div className="display text-sm font-bold mb-3">
        📐 Parts of a {domal ? "Domal " : ""}window
      </div>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${fw} ${fh}`} width="100%" style={{ maxWidth: fw }}
          role="img" aria-label="Window parts reference">
          <rect x={0.5} y={0.5} width={fw - 1} height={fh - 1} rx={3}
            fill="#f1f3f5" stroke="#5a5f6a" strokeWidth={1.5} />
          <rect x={0.5} y={0.5} width={fw - 1} height={fr} rx={2}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.75} />
          <rect x={0.5} y={fh - fr - 0.5} width={fw - 1} height={fr} rx={2}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.75} />
          <rect x={0.5} y={0.5} width={fr} height={fh - 1} rx={2}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.75} />
          <rect x={fw - fr - 0.5} y={0.5} width={fr} height={fh - 1} rx={2}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth={0.75} />
          {[0, 1, 2].map((i) => {
            const x = fr + i * sw;
            const isJali = i === 2;
            return (
              <g key={i}>
                <rect x={x + 2} y={fr + 2} width={sw - 4} height={innerH - 4} rx={1}
                  fill={isJali ? "#f0fdf4" : "#fafbfc"} stroke="#9aa0ab" strokeWidth={0.75} />
                {domal ? (
                  <>
                    <rect x={x + 2} y={fr + 2} width={sw - 4} height={innerH - 4} rx={1}
                      fill="none" stroke="#e9d5ff" strokeWidth={5} />
                    <rect x={x + 2} y={fr + 2} width={pw} height={innerH - 4}
                      fill="#e9d5ff" stroke="#a855f7" strokeWidth={0.5} rx={1} />
                  </>
                ) : (
                  <>
                    <rect x={x + 2} y={fr + 2} width={pw} height={innerH - 4}
                      fill="#fed7aa" stroke="#f97316" strokeWidth={0.5} rx={1} />
                    <rect x={x + sw - 4 - pw} y={fr + 2} width={pw} height={innerH - 4}
                      fill="#e9d5ff" stroke="#a855f7" strokeWidth={0.5} rx={1} />
                    <rect x={x + 2} y={fr + 2} width={sw - 4} height={bh}
                      fill="#d1fae5" stroke="#10b981" strokeWidth={0.5} rx={1} />
                    <rect x={x + 2} y={fr + innerH - 2 - bh} width={sw - 4} height={bh}
                      fill="#d1fae5" stroke="#10b981" strokeWidth={0.5} rx={1} />
                  </>
                )}
                <text x={x + sw / 2} y={fr + innerH / 2 + 4} textAnchor="middle"
                  fontSize={11} fill="#5a5f6a" fontWeight={600}>
                  {isJali ? "MESH" : "GLASS"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        {(domal
          ? [
              ["#dbeafe", "#3b82f6", "Frame", "One profile, all four sides"],
              ["#fafbfc", "#9aa0ab", "Glass Shutter", "All four sides — rounded nose profile"],
              ["#f0fdf4", "#9aa0ab", "Mesh Shutter", "All four sides — plain profile"],
              ["#e9d5ff", "#a855f7", "Interlock", "Full shutter height, where they meet"],
            ]
          : [
              ["#dbeafe", "#3b82f6", "Frame (Track)", "Top + 2 sides + bottom"],
              ["#fed7aa", "#f97316", "Handle", "One side of the shutter"],
              ["#e9d5ff", "#a855f7", "Interlock", "The other side"],
              ["#d1fae5", "#10b981", "Bearing", "Top and bottom (×2)"],
            ]
        ).map(([bg, border, label, desc], i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded"
              style={{ background: bg, border: `1.5px solid ${border}` }} />
            <span>
              <span className="font-bold">{label}</span>
              <span className="ml-1" style={{ color: "var(--ink-3)" }}>— {desc}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center text-[10px]" style={{ color: "var(--ink-3)" }}>
        {domal
          ? "Domal has no separate handle, interlock or bearing — the whole shutter is built from one profile"
          : "Glass or mesh, the aluminium sections are the same (Normal Sliding)"}
      </p>
    </div>
  );
}

/** Bar cutting diagram — one physical bar with labeled pieces + waste */
export function BarDiagram({ bar }: { bar: PackedBar }) {
  const W = 640, H = 64;
  const barFt = toFeet(bar.barLength);
  const scale = W / bar.barLength;
  let x = 0;
  const section = getSection(bar.sectionId);
  const colors = ["#dbeafe", "#fde8d4", "#e6f4ea", "#f3e8ff", "#fef9c3", "#fce7f3"];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 480 }} role="img"
        aria-label={`Bar ${bar.barNo} cutting layout`}>
        <rect x={0.5} y={14} width={W - 1} height={34} rx={4}
          fill="#f1f3f5" stroke="#5a5f6a" strokeWidth={1} />
        {bar.pieces.map((p, i) => {
          const pw = p.length * scale;
          const px = x;
          x += pw;
          return (
            <g key={i}>
              <rect x={px + 1} y={15} width={Math.max(pw - 2, 2)} height={32} rx={3}
                fill={colors[i % colors.length]} stroke="#5a5f6a" strokeWidth={0.75} />
              <text x={px + pw / 2} y={30} textAnchor="middle" fontSize={10.5}
                fontWeight={700} fill="#16181d">
                {pw > 60 ? `${p.itemId} ${p.role}` : p.itemId}
              </text>
              <text x={px + pw / 2} y={43} textAnchor="middle" fontSize={10} fill="#5a5f6a">
                {formatFtInSut(p.length)}
              </text>
              {i < bar.pieces.length - 1 && (
                <line x1={x} y1={12} x2={x} y2={50} stroke="#e8590c"
                  strokeWidth={1.5} strokeDasharray="3 2" />
              )}
            </g>
          );
        })}
        {bar.waste > 0 && (
          <>
            <rect x={x + 1} y={15} width={Math.max(W - x - 2, 0)} height={32}
              fill="url(#wasteHatch)" stroke="#9aa0ab" strokeWidth={0.5} strokeDasharray="4 3" />
            {W - x > 44 && (
              <text x={x + (W - x) / 2} y={34} textAnchor="middle" fontSize={10}
                fontWeight={600} fill="#9aa0ab">
                waste {formatFtInSut(bar.waste)}
              </text>
            )}
          </>
        )}
        <text x={0} y={9} fontSize={11} fontWeight={800} fill="#16181d">
          BAR {bar.barNo} — {section.label} ({section.size}mm) — {barFt}&apos;
        </text>
        <text x={W} y={9} fontSize={10} textAnchor="end" fill="#5a5f6a">
          {section.omeo ? `OMEO ${section.omeo}` : section.alpro ? `Alpro ${section.alpro}` : ""}
        </text>
        <defs>
          <pattern id="wasteHatch" patternUnits="userSpaceOnUse" width="6" height="6"
            patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#f8f9fa" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#d5d9de" strokeWidth="2" />
          </pattern>
        </defs>
      </svg>
    </div>
  );
}
