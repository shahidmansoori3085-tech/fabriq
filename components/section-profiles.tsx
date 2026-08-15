"use client";
/**
 * FabriQ engineering section profiles — the REAL cross-section of each
 * aluminium extrusion, drawn parametrically from the founder-verified
 * catalogue geometry in docs/08 (OMEO ALTECH / ELICOAT / Alpro). No AI, no
 * image API — deterministic SVG. Every drawing carries its true W×H (mm) from
 * the Section Master, so the fabricator and his supplier recognise the pipe.
 *
 * Two renderers share one geometry model:
 *   <SectionProfile/> — compact cross-section for tight table cells (no dims)
 *   <SectionDrawing/> — full engineering plate: dimensioned cross-section +
 *                       3D isometric extrusion + section code.
 */
import { getSection } from "@/lib/engine/sections";

/* ————————————————— geometry model ————————————————— */

type Kind =
  | "track" | "tube" | "interlock" | "hbeam" | "domal_frame" | "domal_shutter"
  | "small_guide" | "box" | "clip" | "door_frame" | "z_outer" | "z_pipe" | "z_center";

interface Spec {
  kind: Kind;
  wmm: number;   // true cross-section width (mm)
  hmm: number;   // true cross-section height/depth (mm)
  tracks?: number;
  side?: "top" | "bottom";
  grooves?: ("l" | "r")[];
  nose?: boolean;
  mesh?: boolean;
  handle?: boolean;
}

/** Parse "62×32" / "63.5×38.1" → [w,h] mm. */
function parseSize(size: string): [number, number] {
  const m = size.replace(/[^\d.×xX]/g, "").split(/[×xX]/).map((s) => parseFloat(s));
  const w = m[0] > 0 ? m[0] : 60;
  const h = m[1] > 0 ? m[1] : 30;
  return [w, h];
}

/** Map a section id + its catalogue size to a drawable profile spec. */
export function specFor(sectionId: string): Spec {
  const sec = getSection(sectionId);
  const [wmm, hmm] = parseSize(sec.size);
  const id = sectionId;

  if (/^3t_(top|bottom)/.test(id)) return { kind: "track", wmm, hmm, tracks: 3, side: id.includes("top") ? "top" : "bottom" };
  if (/^2t_(top|bottom)/.test(id)) return { kind: "track", wmm, hmm, tracks: 2, side: id.includes("top") ? "top" : "bottom" };
  if (/^handle/.test(id)) return { kind: "tube", wmm, hmm, grooves: ["r"], handle: true };
  if (/^interlock$/.test(id)) return { kind: "interlock", wmm, hmm };
  if (/^bearing$/.test(id)) return { kind: "hbeam", wmm, hmm };
  if (/^domal_frame/.test(id)) return { kind: "domal_frame", wmm, hmm };
  if (/^domal_glass_shutter/.test(id)) return { kind: "domal_shutter", wmm, hmm, nose: true, grooves: ["r"] };
  if (/^domal_jali_shutter/.test(id)) return { kind: "domal_shutter", wmm, hmm, nose: false, mesh: true, grooves: ["r"] };
  if (/^domal_interlock/.test(id)) return { kind: "small_guide", wmm, hmm };
  if (/^partition_frame/.test(id)) return { kind: "box", wmm, hmm, grooves: ["r"] };
  if (/^partition_divider/.test(id)) return { kind: "box", wmm, hmm, grooves: ["l", "r"] };
  if (/glazing_clip|z_clip/.test(id)) return { kind: "clip", wmm, hmm };
  if (/^door_frame/.test(id)) return { kind: "door_frame", wmm, hmm };
  if (/^door_center/.test(id)) return { kind: "box", wmm, hmm, grooves: ["l", "r"] };
  if (/^door_palla/.test(id)) return { kind: "tube", wmm, hmm, grooves: ["r"] };
  if (/^z_outer/.test(id)) return { kind: "z_outer", wmm, hmm };
  if (/^z_pipe/.test(id)) return { kind: "z_pipe", wmm, hmm };
  if (/^z_center/.test(id)) return { kind: "z_center", wmm, hmm };
  return { kind: "tube", wmm, hmm, grooves: ["r"] };
}

/* ————————————————— cross-section faces ————————————————— */
// Colours are theme tokens so the profile reads on light + dark cards.
const METAL = "var(--steel)";
const EDGE = "var(--ink-2)";
const BORE = "var(--surface)";

/** Draw the detailed cross-section in a local [0,0]-[W,H] px box. */
function face(spec: Spec, W: number, H: number): React.ReactNode {
  const t = Math.min(Math.max(Math.min(W, H) * 0.17, 2.4), 7); // wall thickness px
  const r = Math.min(W, H) * 0.08;
  const s = { fill: METAL, stroke: EDGE, strokeWidth: 1.2, strokeLinejoin: "round" as const };
  const bore = { fill: BORE, stroke: EDGE, strokeWidth: 0.9 };

  switch (spec.kind) {
    case "track": {
      const tracks = spec.tracks ?? 2;
      const web = Math.max(H * 0.26, t); // base slab thickness
      const top = spec.side === "top";
      const baseY = top ? 0 : H - web;
      const finTop = top ? web : 0;       // fins grow from the slab into the opening
      const finBot = top ? H : H - web;
      const finH = finBot - finTop;
      const walls = tracks + 1;
      const gap = (W - walls * t) / tracks;
      const els: React.ReactNode[] = [
        <rect key="web" x={0} y={baseY} width={W} height={web} rx={r * 0.5} {...s} />,
      ];
      for (let i = 0; i < walls; i++) {
        const x = i * (t + gap);
        // outer walls full height, inner fins ~72%
        const isOuter = i === 0 || i === walls - 1;
        const h = isOuter ? finH : finH * 0.72;
        const y = top ? finTop : finBot - h;
        els.push(<rect key={`f${i}`} x={x} y={y} width={t} height={h} rx={t * 0.3} {...s} />);
      }
      return <g>{els}</g>;
    }
    case "tube": {
      const grooveR = spec.grooves?.includes("r");
      const grooveL = spec.grooves?.includes("l");
      const gw = t * 0.9, gd = H * 0.5;
      return (
        <g>
          <rect x={0} y={0} width={W} height={H} rx={r} {...s} />
          <rect x={t} y={t} width={W - 2 * t} height={H - 2 * t} rx={r * 0.6} {...bore} />
          {grooveR && <rect x={W - gw} y={H / 2 - gd / 2} width={gw} height={gd} fill={BORE} stroke={EDGE} strokeWidth={0.8} />}
          {grooveL && <rect x={0} y={H / 2 - gd / 2} width={gw} height={gd} fill={BORE} stroke={EDGE} strokeWidth={0.8} />}
          {spec.handle && <rect x={-t * 0.7} y={H * 0.32} width={t * 0.7} height={H * 0.36} rx={t * 0.3} {...s} />}
        </g>
      );
    }
    case "interlock": {
      // hollow tube + interlock hook on the right edge
      const hookW = W * 0.34;
      return (
        <g>
          <rect x={0} y={0} width={W - hookW} height={H} rx={r} {...s} />
          <rect x={t} y={t} width={W - hookW - 2 * t} height={H - 2 * t} rx={r * 0.5} {...bore} />
          <path
            d={`M ${W - hookW} ${H * 0.16} h ${hookW * 0.7} v ${t} h ${-hookW * 0.7 + t} v ${H * 0.5} h ${hookW * 0.6} v ${t} h ${-hookW * 0.6}`}
            {...s} fill="none" strokeWidth={t * 0.9} strokeLinecap="round" />
        </g>
      );
    }
    case "hbeam": {
      // I / H bearing section
      const flange = H * 0.24;
      const web = W * 0.2;
      return (
        <g {...s}>
          <rect x={0} y={0} width={W} height={flange} rx={r * 0.4} />
          <rect x={0} y={H - flange} width={W} height={flange} rx={r * 0.4} />
          <rect x={W / 2 - web / 2} y={flange} width={web} height={H - 2 * flange} />
        </g>
      );
    }
    case "domal_frame": {
      // large hollow mullion/track box with two shutter channels on the front face
      const chGap = W * 0.14;
      return (
        <g>
          <rect x={0} y={0} width={W} height={H} rx={r} {...s} />
          <rect x={t} y={t} width={W - 2 * t} height={H - 2 * t} rx={r * 0.6} {...bore} />
          <rect x={W / 2 - chGap - t} y={0} width={t} height={H * 0.34} {...s} />
          <rect x={W / 2 + chGap} y={0} width={t} height={H * 0.34} {...s} />
        </g>
      );
    }
    case "domal_shutter": {
      // hollow shutter box; rounded interlock nose on the left, glazing groove right
      const gw = t, gd = H * 0.46;
      return (
        <g>
          <rect x={spec.nose ? W * 0.1 : 0} y={0} width={W - (spec.nose ? W * 0.1 : 0)} height={H} rx={r} {...s} />
          <rect x={(spec.nose ? W * 0.1 : 0) + t} y={t} width={W - (spec.nose ? W * 0.1 : 0) - 2 * t} height={H - 2 * t} rx={r * 0.5} {...bore} />
          {spec.nose && <path d={`M ${W * 0.1} ${H * 0.3} a ${W * 0.1} ${H * 0.2} 0 0 0 0 ${H * 0.4} Z`} {...s} />}
          {spec.grooves?.includes("r") && <rect x={W - gw} y={H / 2 - gd / 2} width={gw} height={gd} fill={BORE} stroke={EDGE} strokeWidth={0.8} />}
          {spec.mesh && <rect x={W - gw * 2.2} y={H * 0.2} width={gw * 0.8} height={H * 0.6} fill={BORE} stroke={EDGE} strokeWidth={0.7} />}
        </g>
      );
    }
    case "small_guide": {
      return (
        <g>
          <rect x={0} y={0} width={W * 0.7} height={H} rx={r} {...s} />
          <rect x={t} y={t} width={W * 0.7 - 2 * t} height={H - 2 * t} rx={r * 0.5} {...bore} />
          <path d={`M ${W * 0.7} ${H * 0.2} h ${W * 0.28} v ${t} h ${-W * 0.28 + t} v ${H * 0.55} h ${W * 0.26} v ${t} h ${-W * 0.26}`}
            {...s} fill="none" strokeWidth={t * 0.85} strokeLinecap="round" />
        </g>
      );
    }
    case "box": {
      const gw = t, gd = H * 0.5;
      return (
        <g>
          <rect x={0} y={0} width={W} height={H} rx={r} {...s} />
          <rect x={t} y={t} width={W - 2 * t} height={H - 2 * t} rx={r * 0.6} {...bore} />
          {spec.grooves?.includes("r") && <rect x={W - gw} y={H / 2 - gd / 2} width={gw} height={gd} fill={BORE} stroke={EDGE} strokeWidth={0.8} />}
          {spec.grooves?.includes("l") && <rect x={0} y={H / 2 - gd / 2} width={gw} height={gd} fill={BORE} stroke={EDGE} strokeWidth={0.8} />}
        </g>
      );
    }
    case "clip": {
      // glazing bead: spine + barbed foot that snaps into the groove
      return (
        <g {...s} strokeWidth={t * 0.9} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${W * 0.5} ${H * 0.12} V ${H * 0.88}`} />
          <path d={`M ${W * 0.5} ${H * 0.2} L ${W * 0.14} ${H * 0.42} M ${W * 0.5} ${H * 0.2} L ${W * 0.86} ${H * 0.42}`} />
          <path d={`M ${W * 0.22} ${H * 0.86} H ${W * 0.78}`} />
        </g>
      );
    }
    case "door_frame": {
      // chokhat / pattam — L channel with a rebate to receive the leaf
      const leg = W * 0.34;
      return (
        <g {...s}>
          <path d={`M 0 0 H ${W} V ${leg} H ${leg} V ${H} H 0 Z`} />
          <rect x={t} y={t} width={leg - 2 * t} height={H - 2 * t} rx={r * 0.4} {...bore} />
          <rect x={t} y={t} width={W - 2 * t} height={leg - 2 * t} rx={r * 0.4} {...bore} />
        </g>
      );
    }
    case "z_outer": {
      // outer frame angle with a return lip
      const leg = t * 1.6;
      return (
        <g {...s}>
          <path d={`M 0 0 H ${W} V ${leg} H ${leg} V ${H} H 0 Z`} />
          <rect x={W - leg * 1.8} y={leg} width={leg} height={H * 0.44} rx={t * 0.3} />
        </g>
      );
    }
    case "z_pipe": {
      // Z shutter profile: top-left flange, web, bottom-right flange
      const b = t * 1.7;
      return (
        <g {...s}>
          <path d={`M 0 0 H ${W * 0.62} V ${b} H ${W / 2 + b / 2} V ${H - b} H ${W} V ${H} H ${W * 0.38} V ${H - b} H ${W / 2 - b / 2} V ${b} H 0 Z`} />
        </g>
      );
    }
    case "z_center": {
      // mullion / T
      const b = t * 1.6;
      return (
        <g {...s}>
          <rect x={0} y={0} width={W} height={b} rx={t * 0.3} />
          <rect x={W / 2 - b / 2} y={0} width={b} height={H} rx={t * 0.3} />
        </g>
      );
    }
  }
}

/* ————————————————— REAL catalogue cross-sections —————————————————
 * The manufacturer's own CAD cross-section (with its true dimension callouts),
 * cropped from the OMEO / NAPL catalogue. This is the honest engineering
 * drawing — no re-interpretation. Section codes are intentionally NOT shown.
 * Files live in /public/sections/<id>.png. The `specFor`/`face` vector above
 * is a graceful fallback for any section not yet cropped.
 */
const SECTION_IMAGES = new Set<string>([
  // Normal Sliding
  "2t_top", "2t_bottom", "3t_top", "3t_bottom", "handle_std", "handle_2x1", "bearing", "interlock",
  // Domal 27mm
  "domal_frame", "domal_glass_shutter", "domal_jali_shutter", "domal_interlock",
  // Partition
  "partition_frame", "partition_divider", "glazing_clip",
  // Z-Section
  "z_outer_40", "z_outer_55", "z_pipe_40", "z_pipe_55", "z_center_55", "z_center_70", "z_clip",
  // Door
  "door_palla_75", "door_palla_60", "door_palla_50", "door_center_75", "door_frame_pattam",
]);

export function hasImage(sectionId: string): boolean {
  return SECTION_IMAGES.has(sectionId);
}

/* ————————————————— compact profile (table cells) ————————————————— */

export function SectionProfile({ sectionId, w = 46, h = 30 }: { sectionId: string; w?: number; h?: number }) {
  const sec = getSection(sectionId);
  if (hasImage(sectionId)) {
    return (
      <span className="grid place-items-center overflow-hidden rounded-md"
        style={{ width: w + 8, height: h + 6, background: "#fff", border: "1px solid var(--line)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/sections/${sectionId}.png`} alt={`${sec.label} cross-section`}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", padding: 2 }} />
      </span>
    );
  }
  // vector fallback
  const spec = specFor(sectionId);
  const ar = spec.wmm / spec.hmm;
  const pad = 3;
  let dw = w - pad * 2, dh = h - pad * 2;
  if (dw / dh > ar) dw = dh * ar; else dh = dw / ar;
  const ox = (w - dw) / 2, oy = (h - dh) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img"
      aria-label={`${sec.label} cross-section`} style={{ display: "block" }}>
      <g transform={`translate(${ox} ${oy})`}>{face(spec, dw, dh)}</g>
    </svg>
  );
}

/* ————————————————— full engineering plate ————————————————— */

export function SectionDrawing({ sectionId }: { sectionId: string }) {
  const sec = getSection(sectionId);

  if (hasImage(sectionId)) {
    return (
      <figure className="overflow-hidden rounded-xl" style={{ background: "#fff", border: "1px solid var(--line)" }}>
        <div className="grid place-items-center px-3 py-3" style={{ background: "#fff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/sections/${sectionId}.png`} alt={`${sec.label} — engineering cross-section (mm)`}
            style={{ maxWidth: "100%", maxHeight: 190, objectFit: "contain" }} />
        </div>
        <figcaption className="flex items-center justify-between px-3 py-2"
          style={{ borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--ink)" }}>{sec.label}</span>
          <span className="mono text-[11px]" style={{ color: "var(--ink-3)" }}>Cross-section · {sec.size} mm</span>
        </figcaption>
      </figure>
    );
  }

  // vector fallback (dimensioned) for sections not yet cropped
  const spec = specFor(sectionId);
  const [wmm, hmm] = [spec.wmm, spec.hmm];
  const long = 96;
  const dw = wmm >= hmm ? long : long * (wmm / hmm);
  const dh = wmm >= hmm ? long * (hmm / wmm) : long;
  const A = "var(--accent)";
  const dim = { stroke: A, strokeWidth: 1 };
  const M = 30;
  return (
    <svg viewBox={`0 0 ${dw + M} ${dh + M}`} width={dw + M} height={dh + M}
      role="img" aria-label={`${sec.label} dimensioned cross-section`} style={{ overflow: "visible" }}>
      <g transform={`translate(2 2)`}>{face(spec, dw, dh)}</g>
      <line x1={2} y1={dh + 12} x2={dw + 2} y2={dh + 12} {...dim} />
      <line x1={2} y1={dh + 8} x2={2} y2={dh + 16} {...dim} />
      <line x1={dw + 2} y1={dh + 8} x2={dw + 2} y2={dh + 16} {...dim} />
      <text x={dw / 2 + 2} y={dh + 26} textAnchor="middle" fontSize={11} fontWeight={700} fill={A} className="mono">{wmm}mm</text>
      <line x1={dw + 12} y1={2} x2={dw + 12} y2={dh + 2} {...dim} />
      <line x1={dw + 8} y1={2} x2={dw + 16} y2={2} {...dim} />
      <line x1={dw + 8} y1={dh + 2} x2={dw + 16} y2={dh + 2} {...dim} />
      <text x={dw + 24} y={dh / 2 + 2} textAnchor="middle" fontSize={11} fontWeight={700} fill={A}
        transform={`rotate(90 ${dw + 24} ${dh / 2 + 2})`} className="mono">{hmm}mm</text>
    </svg>
  );
}
