"use client";
/**
 * The window, drawn to scale from its own system data. Every piece can be
 * tapped; the chosen piece lights up everywhere it is used.
 */
import { useId } from "react";
import type { WindowGeo, Member, Pt } from "../lib/studio/geometry";
import { fmtLen, type StudioUnit } from "../lib/studio/format";

export type Pick = { type: "part"; id: string } | { type: "shutter"; index: number } | null;

const pts = (poly: Pt[]) => poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export default function WindowDrawing({ g, unit, pick, onPick, compact }: {
  g: WindowGeo; unit: StudioUnit; pick: Pick; onPick?: (p: Pick) => void; compact?: boolean;
}) {
  const uid = useId().replace(/[:]/g, "");
  const { W, H } = g;
  const big = Math.max(W, H);
  const fs = compact ? 0 : big / 21;          // label size, mm
  const pad = compact ? big * 0.02 : big * 0.17;
  const vb = `${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad + (compact ? 0 : fs * 1.6)}`;
  const isPart = (m: Member) => pick?.type === "part" && pick.id === m.partId;
  const isShutter = (i: number) => pick?.type === "shutter" && pick.index === i;
  const tap = (p: Pick) => onPick && ((e: React.MouseEvent) => { e.stopPropagation(); onPick(p); });
  const id = (s: string) => `${s}-${uid}`;

  const memberEl = (m: Member, key: string) => {
    const on = isPart(m);
    // the real section seen from the front: its steps and grooves run the length of the piece
    const relief = m.stops && m.axis && !compact;
    const gid = id(`r${key}`);
    return (
      <g key={key}>
        {relief && (
          <defs>
            <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={m.axis![0]} y1={m.axis![1]} x2={m.axis![2]} y2={m.axis![3]}>
              {m.stops!.map((s, k) => <stop key={k} offset={s.o} stopColor={s.c} />)}
            </linearGradient>
          </defs>
        )}
      <polygon points={pts(m.poly)}
        fill={relief ? `url(#${gid})` : `url(#${id(m.vertical ? "aluV" : "aluH")})`}
        stroke={on ? "var(--accent)" : "#7d8794"} strokeWidth={on ? 2.2 : 0.7} vectorEffect="non-scaling-stroke"
        strokeDasharray={m.known ? undefined : "4 3"}
        style={{ cursor: onPick ? "pointer" : undefined }}
        onClick={tap({ type: "part", id: m.partId })}>
      </polygon>
      </g>
    );
  };
  const glow = (m: Member, key: string) => isPart(m) && (
    <polygon key={key} points={pts(m.poly)} fill="var(--accent)" fillOpacity={0.32} pointerEvents="none" />
  );

  // back tracks first, so the front shutter laps over the one behind it
  const order = [...g.shutters].sort((a, b) => b.track - a.track || a.index - b.index);

  return (
    <svg viewBox={vb} className="block h-auto w-full select-none" role="img"
      aria-label={`Window ${fmtLen(W * 1000, unit)} by ${fmtLen(H * 1000, unit)}`} onClick={() => onPick?.(null)}>
      <defs>
        <linearGradient id={id("aluH")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" /><stop offset="0.45" stopColor="#d5dae0" />
          <stop offset="0.55" stopColor="#c9cfd6" /><stop offset="1" stopColor="#e6e9ed" />
        </linearGradient>
        <linearGradient id={id("aluV")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f4f6f8" /><stop offset="0.45" stopColor="#d5dae0" />
          <stop offset="0.55" stopColor="#c9cfd6" /><stop offset="1" stopColor="#e6e9ed" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbeafe" /><stop offset="0.5" stopColor="#eef5ff" /><stop offset="1" stopColor="#cfe0f7" />
        </linearGradient>
        <pattern id={id("mesh")} width={big / 140} height={big / 140} patternUnits="userSpaceOnUse">
          <rect width={big / 140} height={big / 140} fill="#f1f3f5" />
          <path d={`M0 0L${big / 140} ${big / 140}M${big / 140} 0L0 ${big / 140}`} stroke="#9aa3ad" strokeWidth={big / 1400} />
        </pattern>
        <clipPath id={id("opening")}>
          <rect x={g.faces.left} y={g.faces.top} width={W - g.faces.left - g.faces.right} height={H - g.faces.top - g.faces.bottom} />
        </clipPath>
      </defs>

      {/* wall opening shadow */}
      <rect x={0} y={0} width={W} height={H} fill="#e5e7eb" />

      {/* shutters, clipped to what shows inside the frame (they run behind it) */}
      <g clipPath={compact ? undefined : `url(#${id("opening")})`}>
        {order.map((s) => (
          <g key={s.index} onClick={tap({ type: "shutter", index: s.index })} style={{ cursor: onPick ? "pointer" : undefined }}>
            <rect x={s.pane.x} y={s.pane.y} width={s.pane.w} height={s.pane.h}
              fill={s.kind === "J" ? `url(#${id("mesh")})` : s.kind === "S" ? "#d6d3d1" : `url(#${id("glass")})`} />
            {s.kind === "G" && (
              <g pointerEvents="none" stroke="#ffffff" strokeOpacity={0.75} strokeLinecap="round">
                <line x1={s.pane.x + s.pane.w * 0.18} y1={s.pane.y + s.pane.h * 0.42} x2={s.pane.x + s.pane.w * 0.42} y2={s.pane.y + s.pane.h * 0.16} strokeWidth={big / 260} />
                <line x1={s.pane.x + s.pane.w * 0.26} y1={s.pane.y + s.pane.h * 0.5} x2={s.pane.x + s.pane.w * 0.5} y2={s.pane.y + s.pane.h * 0.24} strokeWidth={big / 520} />
              </g>
            )}
            {isShutter(s.index) && <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="var(--accent)" fillOpacity={0.12} stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            {g.sash.filter((m) => m.shutter === s.index).map((m, k) => memberEl(m, `s${s.index}-${k}`))}
            {g.sash.filter((m) => m.shutter === s.index).map((m, k) => glow(m, `sg${s.index}-${k}`))}
            {g.patti.filter((m) => m.shutter === s.index).map((m, k) => (
              <g key={`p${k}`}>
                <polygon points={pts(m.poly)} fill="#9aa3ad" stroke={isPart(m) ? "var(--accent)" : "#5f6874"} strokeWidth={isPart(m) ? 2.2 : 0.6} vectorEffect="non-scaling-stroke"
                  onClick={tap({ type: "part", id: m.partId })} style={{ cursor: onPick ? "pointer" : undefined }} />
                {glow(m, `pg${k}`)}
              </g>
            ))}
            {/* handle on the lock stile */}
            {!compact && (() => {
              const lockM = g.sash.find((m) => m.shutter === s.index && m.place === "sash-lock");
              if (!lockM) return null;
              const xs = lockM.poly.map((p) => p[0]);
              const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = s.y + s.h / 2;
              const hw = Math.max(6, (Math.max(...xs) - Math.min(...xs)) * 0.32);
              return <rect x={cx - hw / 2} y={cy - big / 40} width={hw} height={big / 20} rx={hw / 2} fill="#4b5563" pointerEvents="none" />;
            })()}
          </g>
        ))}
      </g>

      {/* frame on top */}
      {g.frame.map((m, k) => memberEl(m, `f${k}`))}
      {g.frame.map((m, k) => glow(m, `fg${k}`))}

      {/* rollers, seen through the bottom track */}
      {!compact && g.shutters.map((s) => [0.16, 0.84].map((f, k) => (
        <circle key={`r${s.index}${k}`} cx={s.x + s.w * f} cy={H - g.faces.bottom / 2} r={Math.max(4, g.faces.bottom * 0.22)}
          fill="none" stroke="#6b7280" strokeWidth={0.8} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      )))}

      {/* dimensions */}
      {!compact && (
        <g fontSize={fs} fontFamily="ui-sans-serif, system-ui" fill="#374151" pointerEvents="none">
          <Dim x1={0} y1={-pad * 0.45} x2={W} y2={-pad * 0.45} label={fmtLen(W * 1000, unit)} fs={fs} />
          <Dim x1={-pad * 0.45} y1={0} x2={-pad * 0.45} y2={H} label={fmtLen(H * 1000, unit)} fs={fs} vertical />
          {g.sizesKnown && g.shutters.length > 0 && (
            <Dim x1={g.shutters[0].x} y1={H + pad * 0.42} x2={g.shutters[0].x + g.shutters[0].w} y2={H + pad * 0.42}
              label={`Shutter ${fmtLen(g.shutterW * 1000, unit)}`} fs={fs * 0.85} muted />
          )}
          {g.sizesKnown && g.shutters.length > 0 && (
            <Dim x1={W + pad * 0.45} y1={g.shutters[0].y} x2={W + pad * 0.45} y2={g.shutters[0].y + g.shutters[0].h}
              label={fmtLen(g.shutterH * 1000, unit)} fs={fs * 0.85} vertical muted />
          )}
        </g>
      )}
    </svg>
  );
}

function Dim({ x1, y1, x2, y2, label, fs, vertical, muted }: {
  x1: number; y1: number; x2: number; y2: number; label: string; fs: number; vertical?: boolean; muted?: boolean;
}) {
  const t = fs * 0.35;
  const col = muted ? "#6b7280" : "#374151";
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <g stroke={col} strokeWidth={0.8} vectorEffect="non-scaling-stroke">
      <line x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} vectorEffect="non-scaling-stroke" />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} vectorEffect="non-scaling-stroke" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} vectorEffect="non-scaling-stroke" />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} vectorEffect="non-scaling-stroke" />
        </>
      )}
      <g transform={vertical ? `translate(${mx} ${my}) rotate(-90)` : `translate(${mx} ${my})`}>
        <rect x={-label.length * fs * 0.29} y={-fs * 0.72} width={label.length * fs * 0.58} height={fs * 1.1} fill="#ffffff" stroke="none" />
        <text textAnchor="middle" y={fs * 0.18} fill={col} stroke="none" fontWeight={600}>{label}</text>
      </g>
    </g>
  );
}
