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

export default function WindowDrawing({ g, unit, pick, onPick, compact, labels, infill }: {
  g: WindowGeo; unit: StudioUnit; pick: Pick; onPick?: (p: Pick) => void; compact?: boolean;
  /** each pipe's name and cut (part id → { name: "Handle", value: "46″ 3s" }), written beside the
   *  window with an arrow to the pipe, like a shop drawing (founder 2026-11-18) */
  labels?: Record<string, { name: string; value: string }>;
  /** glass / mesh size written on the panes */
  infill?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const { W, H } = g;
  const big = Math.max(W, H);
  const fs = compact ? 0 : big / 21;          // label size, mm
  const pad = compact ? big * 0.02 : big * (labels ? 0.24 : 0.17);
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

  // sliding shutters are clipped to the opening (they run behind the frame);
  // casement sashes lap over the frame and are drawn on top of it
  const shuttersEl = (
      <g clipPath={compact || g.casement ? undefined : `url(#${id("opening")})`}>
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
            {g.casement && s.hinge && !compact && (() => {
              const hx = s.hinge === "left" ? s.pane.x : s.pane.x + s.pane.w, ox = s.hinge === "left" ? s.pane.x + s.pane.w : s.pane.x;
              return <polyline points={`${hx},${s.pane.y} ${ox},${s.pane.y + s.pane.h / 2} ${hx},${s.pane.y + s.pane.h}`} fill="none" stroke="#475569" strokeWidth={1} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />;
            })()}
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

  );

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

      {!g.casement && shuttersEl}
      {/* frame on top */}
      {g.frame.map((m, k) => memberEl(m, `f${k}`))}
      {g.frame.map((m, k) => glow(m, `fg${k}`))}
      {/* casement sashes lap over the frame */}
      {g.casement && shuttersEl}

      {/* rollers, seen through the bottom track */}
      {!compact && !g.casement && g.shutters.map((s) => [0.16, 0.84].map((f, k) => (
        <circle key={`r${s.index}${k}`} cx={s.x + s.w * f} cy={H - g.faces.bottom / 2} r={Math.max(4, g.faces.bottom * 0.22)}
          fill="none" stroke="#6b7280" strokeWidth={0.8} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" pointerEvents="none" />
      )))}

      {/* every pipe's cut beside it, an arrow to the pipe (founder 2026-11-18: not written on the pipe) */}
      {!compact && labels && (() => {
        const lf = fs * 1.12;
        const ctr = (m: Member) => { const xs = m.poly.map((q) => q[0]), ys = m.poly.map((q) => q[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; };
        type Call = { id: string; name: string; value: string; ax: number; ay: number; x: number; y: number };
        const calls: Call[] = [];
        const add = (m: Member | undefined, ax: number, ay: number, x: number, y: number, name?: string) => {
          const l = m && labels[m.partId];
          if (!m || !l) return;
          calls.push({ id: m.partId, name: name ?? l.name, value: l.value.replace(/~/g, ""), ax, ay, x, y });
        };
        const fr = (pl: string) => g.frame.find((m) => m.place === pl);
        const top = fr("frame-top"), bot = fr("frame-bottom"), lft = fr("frame-left"), rgt = fr("frame-right");
        // the track: top above the window, bottom and sides below it
        if (top) add(top, W * 0.74, ctr(top)[1], W * 0.74, -pad * 0.8);
        if (bot) add(bot, W * 0.74, ctr(bot)[1], W * 0.74, H + pad * 0.6);
        const same = lft && rgt && labels[lft.partId]?.value === labels[rgt.partId]?.value;
        if (lft) add(lft, ctr(lft)[0], H * 0.86, W * 0.2, H + pad * 0.6, same ? "Sides" : undefined);
        if (rgt && !same) add(rgt, ctr(rgt)[0], H * 0.86, W * 0.47, H + pad * 0.6);
        // the first shutter: its pipes inside its pane (they are the same on every shutter)
        const s0 = g.shutters[0];
        if (s0) {
          const pn = s0.pane;
          const sm = (pl: string) => g.sash.find((m) => m.shutter === 0 && m.place === pl);
          const st = sm("sash-top"), sb = sm("sash-bottom"), sl = sm("sash-lock"), sM = sm("sash-meet");
          // spread out, each beside its own pipe (founder 2026-11-18: "door door, pipe ke paas"):
          // top and bottom near their rails, the handle beside its upright, the interlock
          // over in the next shutter beside the meeting upright
          const side = (m: Member) => (ctr(m)[0] < pn.x + pn.w / 2 ? -1 : 1);
          if (st) add(st, pn.x + pn.w * 0.64, ctr(st)[1], pn.x + pn.w * 0.64, pn.y + pn.h * 0.13);
          if (sb) add(sb, pn.x + pn.w * 0.36, ctr(sb)[1], pn.x + pn.w * 0.36, pn.y + pn.h * 0.87);
          if (sl) add(sl, ctr(sl)[0], pn.y + pn.h * 0.3, pn.x + pn.w * (side(sl) < 0 ? 0.32 : 0.68), pn.y + pn.h * 0.3);
          const meet = sM ?? g.patti.find((m) => m.shutter === 0);
          if (meet) {
            const d = side(meet), mx = ctr(meet)[0];
            // beside the meeting upright, in the next shutter when there is one
            const x = g.shutters.length > 1 ? mx + d * pn.w * 0.36 : pn.x + pn.w * (d > 0 ? 0.68 : 0.32);
            add(meet, mx, pn.y + pn.h * 0.7, x, pn.y + pn.h * 0.7);
          }
        }
        const box = (c: Call) => {
          const w = Math.max(c.name.length * lf * 0.62 * 0.72, c.value.length * lf * 0.62) + lf * 0.9;
          return { w, h: lf * 2.35 };
        };
        // where the arrow leaves the box: on its edge, towards the pipe
        const edge = (c: Call) => {
          const { w, h } = box(c);
          const dx = c.ax - c.x, dy = c.ay - c.y;
          if (!dx && !dy) return [c.x, c.y];
          const t = Math.min(dx ? (w / 2) / Math.abs(dx) : Infinity, dy ? (h / 2) / Math.abs(dy) : Infinity);
          return [c.x + dx * t, c.y + dy * t];
        };
        const pane = g.shutters[0]?.pane;
        return (
          <g>
            <defs>
              <marker id={id("arrow")} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="#334155" />
              </marker>
              <marker id={id("arrowOn")} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="var(--accent)" />
              </marker>
            </defs>
            {infill && pane && (() => { const inf = infill.replace(/~/g, ""); return (
              <g pointerEvents="none" transform={`translate(${pane.x + pane.w / 2} ${pane.y + pane.h / 2})`}>
                <text textAnchor="middle" y={-lf * 0.15} fontSize={lf * 0.72} fontWeight={600} fill="#5b7a9a" fontFamily="ui-sans-serif, system-ui">{g.shutters[0]?.kind === "J" ? "Mesh" : "Glass"}</text>
                <text textAnchor="middle" y={lf * 0.85} fontSize={Math.min(lf * 0.9, pane.w / (inf.length * 0.62))} fontWeight={700} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#1e3a5f">{inf}</text>
              </g>
            ); })()}
            {calls.map((c) => {
              const on = pick?.type === "part" && pick.id === c.id;
              const [ex, ey] = edge(c);
              const { w, h } = box(c);
              return (
                <g key={`${c.id}-${c.name}`} onClick={tap({ type: "part", id: c.id })} style={{ cursor: onPick ? "pointer" : undefined }}>
                  <line x1={ex} y1={ey} x2={c.ax} y2={c.ay} stroke={on ? "var(--accent)" : "#334155"} strokeWidth={1.1} vectorEffect="non-scaling-stroke"
                    markerEnd={`url(#${id(on ? "arrowOn" : "arrow")})`} />
                  <rect x={c.x - w / 2} y={c.y - h / 2} width={w} height={h} rx={lf * 0.45}
                    fill={on ? "var(--accent)" : "#ffffff"} stroke={on ? "none" : "#cbd2da"} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
                  <text x={c.x} y={c.y - lf * 0.18} textAnchor="middle" fontSize={lf * 0.72} fontWeight={600} fontFamily="ui-sans-serif, system-ui"
                    fill={on ? "#ffffff" : "#64748b"}>{c.name}</text>
                  <text x={c.x} y={c.y + lf * 0.82} textAnchor="middle" fontSize={lf} fontWeight={800} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                    fill={on ? "#ffffff" : "#0f172a"}>{c.value}</text>
                </g>
              );
            })}
          </g>
        );
      })()}

      {/* dimensions */}
      {!compact && (
        <g fontSize={fs} fontFamily="ui-sans-serif, system-ui" fill="#374151" pointerEvents="none">
          <Dim x1={0} y1={-pad * (labels ? 0.32 : 0.45)} x2={W} y2={-pad * (labels ? 0.32 : 0.45)} label={fmtLen(W * 1000, unit)} fs={fs} />
          <Dim x1={-pad * (labels ? 0.32 : 0.45)} y1={0} x2={-pad * (labels ? 0.32 : 0.45)} y2={H} label={fmtLen(H * 1000, unit)} fs={fs} vertical />
          {!labels && g.sizesKnown && g.shutters.length > 0 && (
            <Dim x1={g.shutters[0].x} y1={H + pad * 0.42} x2={g.shutters[0].x + g.shutters[0].w} y2={H + pad * 0.42}
              label={`${g.casement ? "Sash" : "Shutter"} ${fmtLen(g.shutterW * 1000, unit)}`} fs={fs * 0.85} muted />
          )}
          {!labels && g.sizesKnown && g.shutters.length > 0 && (
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
