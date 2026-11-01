"use client";
/**
 * FabriQ visual language (D12): the fabricator SEES what is being asked.
 * Deterministic SVG renderers — dimensions always come from engine data.
 */
import { Um, formatFtInSut, formatFtIn, toFeet } from "@/lib/engine/units";
import type { ShutterConfig, PackedBar, JobItem } from "@/lib/engine/types";
import { getSection } from "@/lib/engine/sections";
import { partitionLayout } from "@/lib/engine/estimator";

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
    // The same grid the cut list is built from — bays, glass rows, bottom
    // sheet and door — scaled into the picture, so changing a spacing on the
    // option screen visibly changes the drawing.
    const L = partitionLayout(item);
    const sx = iw / (item.width - 2 * L.face), sy = ih / L.innerH;
    const glassBandH = L.glassRows * L.glassRowH + (L.glassRows - 1) * L.face;
    for (let b = 0; b < L.bays; b++) {
      const x = fr + b * (L.cellW + L.face) * sx;
      for (let r = 0; r < L.glassRows; r++)
        cells.push(glassFill(x + 0.5, fr + r * (L.glassRowH + L.face) * sy + 0.5, L.cellW * sx - 1, L.glassRowH * sy - 1, `g${b}-${r}`));
      if (L.sheetH > 0)
        cells.push(sheetFill(x + 0.5, fr + (glassBandH + L.face) * sy + 0.5, L.cellW * sx - 1, L.sheetH * sy - 1, `s${b}`));
    }
    if (L.hasDoor) {
      // SP/DP door: glass above the middle rail, sheet below — as the cut list
      // orders it. Z-section door: one glass leaf.
      const dx = fr + (L.fieldW + L.face) * sx, dw = L.doorW * sx;
      // fixed glass over a door shorter than the partition
      const top = L.doorTopH > 0 ? (L.doorTopH + L.face) * sy : 0;
      if (top) cells.push(glassFill(dx + 1, fr + 1, dw - 2, L.doorTopH * sy - 2, "dt"));
      const dy = fr + top, dh = ih - top;
      if (item.system === "z_section") cells.push(glassFill(dx + 1, dy + 1, dw - 2, dh - 2, "dg"));
      else {
        cells.push(glassFill(dx + 1, dy + 1, dw - 2, dh / 2 - 2, "dg"));
        cells.push(sheetFill(dx + 1, dy + dh / 2 + 1, dw - 2, dh / 2 - 2, "ds"));
      }
      cells.push(<rect key="door" x={dx + 0.5} y={dy} width={dw - 1} height={dh} fill="none" stroke="#0f6e56" strokeWidth={1.5} />);
    }
  } else if (item.type === "door") {
    const zones = item.shutters.length || 1;
    const zh = ih / zones;
    for (let z = 0; z < zones; z++) {
      const y = fr + z * zh;
      const k = item.shutters[z]?.kind;
      cells.push(k === "jali" ? jaliFill(fr + 1, y + 1, iw - 2, zh - 2, `d${z}`)
        : k === "glass" ? glassFill(fr + 1, y + 1, iw - 2, zh - 2, `d${z}`)
          : sheetFill(fr + 1, y + 1, iw - 2, zh - 2, `d${z}`));
    }
  } else {
    const fill = (k: string | undefined, x: number, y: number, w: number, h: number, key: string) =>
      k === "jali" ? jaliFill(x, y, w, h, key) : k === "sheet" ? sheetFill(x, y, w, h, key) : glassFill(x, y, w, h, key);
    /** A hinged sash: the opening "V" a fabricator draws on a casement. */
    const hinge = (x: number, y: number, w: number, h: number, key: string) => (
      <polyline key={key} points={`${x + 2},${y + 2} ${x + w - 2},${y + h / 2} ${x + 2},${y + h - 2}`}
        fill="none" stroke="#5a5f6a" strokeWidth={0.8} strokeDasharray="2 1.5" />
    );
    if (item.system === "z_section") {
      const sashes = item.meta.zLayout === "fixed" ? 0 : Math.max(1, item.shutters.length);
      const fixedFrac = Math.min(0.5, (parseFloat(item.meta.zFixedFt ?? "2") || 2) /
        toFeet(item.meta.zComboDir === "top" ? item.height : item.width));
      let ox = fr, oy = fr, ow = iw, oh = ih; // the openable zone
      if (item.meta.zLayout === "fixed") {
        cells.push(glassFill(fr + 1, fr + 1, iw - 2, ih - 2, "zf"));
      } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "top") {
        cells.push(glassFill(fr + 1, fr + 1, iw - 2, ih * fixedFrac - 2, "zf"));
        oy = fr + ih * fixedFrac; oh = ih * (1 - fixedFrac);
      } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "both") {
        const fw = iw * Math.min(0.3, fixedFrac);
        cells.push(glassFill(fr + 1, fr + 1, fw - 2, ih - 2, "zf1"));
        cells.push(glassFill(fr + iw - fw + 1, fr + 1, fw - 2, ih - 2, "zf2"));
        ox = fr + fw; ow = iw - 2 * fw;
      } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "center") {
        // openable | fixed | openable — half the shutters each side
        const fw = iw * Math.min(0.4, fixedFrac);
        const side = (iw - fw) / 2, each = Math.max(1, Math.round(sashes / 2));
        cells.push(glassFill(fr + side + 1, fr + 1, fw - 2, ih - 2, "zf"));
        for (let i = 0; i < 2 * each; i++) {
          const x = fr + (i < each ? i * (side / each) : side + fw + (i - each) * (side / each));
          cells.push(fill(item.shutters[i]?.kind, x + 1, fr + 1, side / each - 2, ih - 2, `zs${i}`));
          cells.push(hinge(x + 1, fr + 1, side / each - 2, ih - 2, `zh${i}`));
        }
        ow = 0;
      } else if (item.meta.zLayout === "combo") {
        cells.push(glassFill(fr + 1, fr + 1, iw * fixedFrac - 2, ih - 2, "zf"));
        ox = fr + iw * fixedFrac; ow = iw * (1 - fixedFrac);
      }
      const sw = ow / Math.max(1, sashes);
      for (let i = 0; ow > 0 && i < sashes; i++) {
        cells.push(fill(item.shutters[i]?.kind, ox + i * sw + 1, oy + 1, sw - 2, oh - 2, `zs${i}`));
        cells.push(hinge(ox + i * sw + 1, oy + 1, sw - 2, oh - 2, `zh${i}`));
      }
    } else {
      // Sliding (normal / Domal): an optional fixed glass band on top, then
      // the shutters side by side, each marked with a slide arrow.
      let top = fr;
      if (item.meta.domalFix === "yes") {
        const fh = ih * Math.min(0.5, (parseFloat(item.meta.domalFixFt ?? "2") || 2) / toFeet(item.height));
        cells.push(glassFill(fr + 1, fr + 1, iw - 2, fh - 2, "fix"));
        top = fr + fh;
      }
      const h = fr + ih - top;
      const n = Math.max(1, item.shutters.length);
      const sw = iw / n;
      for (let i = 0; i < n; i++) {
        const x = fr + i * sw;
        cells.push(fill(item.shutters[i]?.kind, x + 1, top + 1, sw - 2, h - 2, `w${i}`));
        const ay = top + h / 2, ax = x + sw / 2, aw = Math.min(sw * 0.25, 8);
        cells.push(<path key={`a${i}`} d={`M${ax - aw} ${ay} H${ax + aw} M${ax - aw + 2} ${ay - 2} L${ax - aw} ${ay} L${ax - aw + 2} ${ay + 2} M${ax + aw - 2} ${ay - 2} L${ax + aw} ${ay} L${ax + aw - 2} ${ay + 2}`}
          stroke="#5a5f6a" strokeWidth={0.8} fill="none" />);
      }
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
              fill={sh.kind === "glass" ? "#dbeafe" : sh.kind === "sheet" ? "#d4d8de" : "#f1f5f0"}
              stroke="#5a5f6a" strokeWidth={1.2} />
            {sh.kind === "sheet" ? null : sh.kind === "glass" ? (
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
              {sh.kind === "glass" ? "GLASS" : sh.kind === "sheet" ? "SHEET" : "MESH"}
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

/* ——— partition divider spacing ——— */
const DP = "#e8590c";
const SP = "#5a5f6a";

/** A dimension arrow ↔ (or ↕) between two points, with its size written beside it. */
function gapArrow(x1: number, y1: number, x2: number, y2: number, label: string, room: number, key: string) {
  const vertical = x1 === x2;
  const a = 3.5;
  const head = vertical
    ? `M${x1 - a} ${y1 + a} L${x1} ${y1} L${x1 + a} ${y1 + a} M${x2 - a} ${y2 - a} L${x2} ${y2} L${x2 + a} ${y2 - a}`
    : `M${x1 + a} ${y1 - a} L${x1} ${y1} L${x1 + a} ${y1 + a} M${x2 - a} ${y2 - a} L${x2} ${y2} L${x2 - a} ${y2 + a}`;
  // the label must fit the panel it names — shrink it, never let it spill over a divider
  const fs = Math.max(7, Math.min(13, room / (label.length * 0.62)));
  const tw = label.length * fs * 0.6 + 6;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  return (
    <g key={key}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e3a8a" strokeWidth={0.9} />
      <path d={head} stroke="#1e3a8a" strokeWidth={0.9} fill="none" />
      <rect x={cx - tw / 2} y={cy - fs * 0.75} width={tw} height={fs * 1.5} rx={3} fill="#fff" stroke="#bfdbfe" strokeWidth={0.6} />
      <text x={cx} y={cy + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#111827"
        style={{ fontVariantNumeric: "tabular-nums" }}>{label}</text>
    </g>
  );
}

/**
 * The divider question, answered on a drawing of THIS partition: only the
 * lines being asked about (vertical or horizontal) are drawn, and the gap each
 * choice really leaves is written inside every panel. A fabricator unsure which
 * one "vertical" is sees it — and sees that 10 ft at a 3 ft gap gives three
 * 3'2" panels, the same grid the cut list is built from.
 */
export function PartitionGapPicture({ item, axis, maxH = 230 }: { item: JobItem; axis: "v" | "h"; maxH?: number }) {
  const L = partitionLayout(item);
  const s = Math.min(300 / item.width, maxH / item.height);
  const W = item.width * s, H = item.height * s;
  const P = 6, DB = axis === "v" ? 30 : 6, DR = axis === "h" ? 34 : 6;
  const X = (um: number) => P + um * s, Y = (um: number) => P + um * s;
  const f = L.face;
  const bandH = L.glassRows * L.glassRowH + (L.glassRows - 1) * f;
  const parts: React.ReactNode[] = [];

  // the field: glass, plus the old bottom-sheet band on jobs saved with one
  parts.push(<rect key="field" x={X(f)} y={Y(f)} width={L.fieldW * s} height={L.innerH * s} fill="#dbeafe" />);
  if (L.sheetH > 0) parts.push(<rect key="sheet" x={X(f)} y={Y(f + bandH + f)} width={L.fieldW * s} height={L.sheetH * s} fill="#eef1f4" />);

  if (L.hasDoor) {
    const dx = f + L.fieldW + f;
    parts.push(<rect key="jamb" x={X(f + L.fieldW)} y={Y(f)} width={f * s} height={L.innerH * s} fill={SP} />);
    const top = L.doorTopH > 0 ? L.doorTopH + f : 0;
    if (top) parts.push(<rect key="door-top" x={X(dx)} y={Y(f)} width={L.doorW * s} height={L.doorTopH * s} fill="#dbeafe" />);
    parts.push(<rect key="door" x={X(dx)} y={Y(f + top)} width={L.doorW * s} height={(L.innerH - top) * s} fill="#e7efe9" stroke="#0f6e56" strokeWidth={1.2} />);
    parts.push(<text key="door-t" x={X(dx + L.doorW / 2)} y={Y(f + top + (L.innerH - top) / 2)} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0f6e56">Door</text>);
  }

  if (axis === "v") {
    for (let i = 0; i < L.bays - 1; i++) {
      parts.push(<rect key={`v${i}`} x={X(f + (i + 1) * L.cellW + i * f)} y={Y(f)} width={Math.max(f * s, 3)} height={L.innerH * s} fill={DP} />);
    }
    for (let b = 0; b < L.bays; b++) {
      const x = f + b * (L.cellW + f);
      parts.push(gapArrow(X(x) + 2, Y(f + L.innerH / 2), X(x + L.cellW) - 2, Y(f + L.innerH / 2), formatFtIn(L.cellW), L.cellW * s - 4, `a${b}`));
    }
    // overall width under the drawing
    const y = P + H + 12;
    parts.push(
      <g key="dim" stroke={SP} strokeWidth={0.8}>
        <line x1={P} y1={y} x2={P + W} y2={y} />
        <line x1={P} y1={y - 4} x2={P} y2={y + 4} />
        <line x1={P + W} y1={y - 4} x2={P + W} y2={y + 4} />
      </g>,
      <text key="dim-t" x={P + W / 2} y={y + 14} textAnchor="middle" fontSize={11} fontWeight={700} fill={SP}>
        Width {formatFtIn(item.width)}
      </text>,
    );
  } else {
    for (let r = 0; r < L.glassRows - 1; r++) {
      parts.push(<rect key={`h${r}`} x={X(f)} y={Y(f + (r + 1) * L.glassRowH + r * f)} width={L.fieldW * s} height={Math.max(f * s, 3)} fill={DP} />);
    }
    if (L.sheetH > 0) parts.push(<rect key="hs" x={X(f)} y={Y(f + bandH)} width={L.fieldW * s} height={Math.max(f * s, 3)} fill={DP} />);
    const cx = f + L.fieldW / 2;
    for (let r = 0; r < L.glassRows; r++) {
      const y = f + r * (L.glassRowH + f);
      parts.push(gapArrow(X(cx), Y(y) + 2, X(cx), Y(y + L.glassRowH) - 2, formatFtIn(L.glassRowH), Math.min(L.fieldW * s - 8, 90), `a${r}`));
    }
    // overall height beside the drawing
    const x = P + W + 12;
    parts.push(
      <g key="dim" stroke={SP} strokeWidth={0.8}>
        <line x1={x} y1={P} x2={x} y2={P + H} />
        <line x1={x - 4} y1={P} x2={x + 4} y2={P} />
        <line x1={x - 4} y1={P + H} x2={x + 4} y2={P + H} />
      </g>,
      <text key="dim-t" x={x + 14} y={P + H / 2} textAnchor="middle" fontSize={11} fontWeight={700} fill={SP}
        transform={`rotate(90 ${x + 14} ${P + H / 2})`}>
        Height {formatFtIn(item.height)}
      </text>,
    );
  }

  return (
    <svg viewBox={`0 0 ${W + P + DR} ${H + P + DB}`} width="100%" style={{ maxWidth: W + P + DR, display: "block" }}
      role="img" aria-label={axis === "v" ? `${L.bays} panels across` : `${L.glassRows} panels high`}>
      <rect x={P} y={P} width={W} height={H} fill={SP} rx={1.5} />
      {parts}
    </svg>
  );
}

/**
 * Frame + shutter, or shutter only, drawn: the frame (chaukhat) is the thick
 * dark border; without it the leaf sits in a dashed wall opening.
 */
export function DoorScopePicture({ item, withFrame, size = 44 }: { item: JobItem; withFrame: boolean; size?: number }) {
  const W = size, H = size * 2.1;
  const fr = withFrame ? Math.max(4, size * 0.11) : 2.5;
  const lw = W - 2 * fr, lh = H - 2 * fr;
  const zones = item.shutters.length || 1;
  const zh = (lh - 4) / zones;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }} role="img"
      aria-label={withFrame ? "Door with frame" : "Door shutter only"}>
      {withFrame
        ? <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={1.5} fill={SP} />
        : <rect x={0.75} y={0.75} width={W - 1.5} height={H - 1.5} fill="none" stroke="#9aa0ab" strokeWidth={1} strokeDasharray="3 2" />}
      <rect x={fr} y={fr} width={lw} height={lh} fill="#dde1e7" stroke={SP} strokeWidth={1} />
      {item.shutters.map((z, i) => {
        const y = fr + 2 + i * zh;
        return z.kind === "jali" ? jaliFill(fr + 2, y + 0.5, lw - 4, zh - 1, `z${i}`)
          : z.kind === "glass" ? glassFill(fr + 2, y + 0.5, lw - 4, zh - 1, `z${i}`)
            : sheetFill(fr + 2, y + 0.5, lw - 4, zh - 1, `z${i}`);
      })}
    </svg>
  );
}

/** Annotated window reference — shows where each section type goes */
export function CuttingGuide({ system = "normal", panes = "GGJ", fixTop = false }: {
  system?: "normal" | "domal";
  /** the job's shutters left to right — G glass, J mesh — e.g. "GGJ" */
  panes?: string;
  /** the job's window has a fixed glass band on top */
  fixTop?: boolean;
}) {
  const fw = 300;
  const fr = 12;
  const bandH = fixTop ? 64 : 0;       // fixed band, drawn above the sliding frame
  const slideH = 176;
  const fh = bandH + slideH;
  const innerW = fw - fr * 2;
  const innerH = slideH - fr * 2;
  const kinds = (panes || "GGJ").split("");
  const sw = innerW / kinds.length;
  const tracks = kinds.length;
  const pw = 7;
  const bh = 7;
  const domal = system === "domal";
  const y0 = bandH;                      // top of the sliding frame
  const sp = 9, clip = 5;                // SP frame and glazing clip widths

  const frameColor = { fill: "#dbeafe", stroke: "#3b82f6" };
  const bottomColor = { fill: "#e2e8f0", stroke: "#475569" };  // Normal: the bottom is its own section
  const spColor = { fill: "#fef3c7", stroke: "#d97706" };
  const clipColor = { fill: "#ccfbf1", stroke: "#0d9488" };

  const legend: [string, string, string, string][] = domal
    ? [
        ["#dbeafe", "#3b82f6", "Frame", fixTop ? "Domal track, four sides of the sliding part" : "One profile, all four sides"],
        ...(kinds.includes("G") ? [["#fafbfc", "#9aa0ab", "Glass Shutter", "All four sides — rounded nose profile"] as [string, string, string, string]] : []),
        ...(kinds.includes("J") ? [["#f0fdf4", "#9aa0ab", "Mesh Shutter", "All four sides — plain profile"] as [string, string, string, string]] : []),
        ["#e9d5ff", "#a855f7", "Interlock", "Glass shutters only, where they meet"],
      ]
    : [
        ["#dbeafe", "#3b82f6", `${tracks}-Track Top`, fixTop ? "Top + both sides of the sliding part" : "Top + both sides"],
        ["#e2e8f0", "#475569", `${tracks}-Track Bottom`, "Bottom only"],
        ["#fed7aa", "#f97316", "Handle", "Outer side of each shutter"],
        ["#e9d5ff", "#a855f7", "Interlock", "Where shutters meet"],
        ["#d1fae5", "#10b981", "Bearing", "Top and bottom (×2)"],
      ];
  if (fixTop) {
    legend.push(
      [spColor.fill, spColor.stroke, "SP Frame", "Fixed glass frame, all four sides"],
      [clipColor.fill, clipColor.stroke, "Glazing Clip", "Holds the fixed glass, all four sides"],
    );
  }

  return (
    <div className="card p-4">
      <div className="display text-sm font-bold mb-3">
        📐 Parts of a {domal ? "Domal" : "Sliding"} window{fixTop ? " with fixed top" : ""}
      </div>
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${fw} ${fh}`} width="100%" style={{ maxWidth: fw }}
          role="img" aria-label="Window parts reference">
          {fixTop && (
            <g>
              {/* SP frame: top, bottom, both sides */}
              <rect x={0.5} y={0.5} width={fw - 1} height={bandH - 1} rx={3} fill="#eef6ff" stroke="#5a5f6a" strokeWidth={1.5} />
              <rect x={0.5} y={0.5} width={fw - 1} height={sp} fill={spColor.fill} stroke={spColor.stroke} strokeWidth={0.75} />
              <rect x={0.5} y={bandH - sp - 0.5} width={fw - 1} height={sp} fill={spColor.fill} stroke={spColor.stroke} strokeWidth={0.75} />
              <rect x={0.5} y={0.5} width={sp} height={bandH - 1} fill={spColor.fill} stroke={spColor.stroke} strokeWidth={0.75} />
              <rect x={fw - sp - 0.5} y={0.5} width={sp} height={bandH - 1} fill={spColor.fill} stroke={spColor.stroke} strokeWidth={0.75} />
              {/* glazing clip all round the fixed glass */}
              <rect x={sp + clip / 2} y={sp + clip / 2} width={fw - 2 * sp - clip} height={bandH - 2 * sp - clip}
                fill="none" stroke={clipColor.stroke} strokeWidth={clip} strokeOpacity={0.45} />
              <text x={fw / 2} y={bandH / 2 + 4} textAnchor="middle" fontSize={11} fill="#5a5f6a" fontWeight={600}>
                FIXED GLASS
              </text>
            </g>
          )}
          <rect x={0.5} y={y0 + 0.5} width={fw - 1} height={slideH - 1} rx={3}
            fill="#f1f3f5" stroke="#5a5f6a" strokeWidth={1.5} />
          <rect x={0.5} y={y0 + 0.5} width={fw - 1} height={fr} rx={2} fill={frameColor.fill} stroke={frameColor.stroke} strokeWidth={0.75} />
          <rect x={0.5} y={y0 + slideH - fr - 0.5} width={fw - 1} height={fr} rx={2}
            fill={domal ? frameColor.fill : bottomColor.fill} stroke={domal ? frameColor.stroke : bottomColor.stroke} strokeWidth={0.75} />
          <rect x={0.5} y={y0 + 0.5} width={fr} height={slideH - 1} rx={2} fill={frameColor.fill} stroke={frameColor.stroke} strokeWidth={0.75} />
          <rect x={fw - fr - 0.5} y={y0 + 0.5} width={fr} height={slideH - 1} rx={2} fill={frameColor.fill} stroke={frameColor.stroke} strokeWidth={0.75} />
          {kinds.map((k, i) => {
            const x = fr + i * sw;
            const isJali = k === "J";
            const top = y0 + fr;
            /** the first shutter meets the next on its right; the rest on their left */
            const meetRight = i === 0;
            return (
              <g key={i}>
                <rect x={x + 2} y={top + 2} width={sw - 4} height={innerH - 4} rx={1}
                  fill={isJali ? "#f0fdf4" : "#fafbfc"} stroke="#9aa0ab" strokeWidth={0.75} />
                {domal ? (
                  <>
                    <rect x={x + 2} y={top + 2} width={sw - 4} height={innerH - 4} rx={1}
                      fill="none" stroke="#e9d5ff" strokeWidth={5} />
                    {/* interlock: glass shutters only, on the edge where shutters meet */}
                    {!isJali && (
                      <rect x={meetRight ? x + sw - 2 - pw : x + 2} y={top + 2} width={pw} height={innerH - 4}
                        fill="#e9d5ff" stroke="#a855f7" strokeWidth={0.5} rx={1} />
                    )}
                  </>
                ) : (
                  <>
                    {/* handle on the outer edge, interlock where shutters meet */}
                    <rect x={meetRight ? x + 2 : x + sw - 2 - pw} y={top + 2} width={pw} height={innerH - 4}
                      fill="#fed7aa" stroke="#f97316" strokeWidth={0.5} rx={1} />
                    <rect x={meetRight ? x + sw - 2 - pw : x + 2} y={top + 2} width={pw} height={innerH - 4}
                      fill="#e9d5ff" stroke="#a855f7" strokeWidth={0.5} rx={1} />
                    <rect x={x + 2} y={top + 2} width={sw - 4} height={bh}
                      fill="#d1fae5" stroke="#10b981" strokeWidth={0.5} rx={1} />
                    <rect x={x + 2} y={top + innerH - 2 - bh} width={sw - 4} height={bh}
                      fill="#d1fae5" stroke="#10b981" strokeWidth={0.5} rx={1} />
                  </>
                )}
                <text x={x + sw / 2} y={top + innerH / 2 + 4} textAnchor="middle"
                  fontSize={11} fill="#5a5f6a" fontWeight={600}>
                  {isJali ? "MESH" : "GLASS"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        {legend.map(([bg, border, label, desc], i) => (
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
          ? "Domal has no separate handle or bearing — each shutter is one profile all round, with an interlock where shutters meet"
          : "Glass or mesh, the aluminium sections are the same (Normal Sliding)"}
        {fixTop ? ". The fixed top has its own SP frame — its SP bottom sits on the frame top." : ""}
      </p>
    </div>
  );
}

/** Bar cutting diagram — one physical bar with labeled pieces + waste */
export function BarDiagram({ bar }: { bar: PackedBar }) {
  const W = 640, H = 64;
  const barFt = toFeet(bar.barLength);
  const scale = W / bar.barLength;
  // Each piece's start, worked out up front — mutating a running `x` inside
  // the JSX map breaks React's render purity rule.
  const starts = bar.pieces.reduce<number[]>((acc, p, i) => [...acc, i === 0 ? 0 : acc[i - 1] + bar.pieces[i - 1].length * scale], []);
  /** where the last piece ends and the waste begins */
  const x = bar.pieces.reduce((a, p) => a + p.length * scale, 0);
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
          const px = starts[i];
          const x = px + pw;
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
