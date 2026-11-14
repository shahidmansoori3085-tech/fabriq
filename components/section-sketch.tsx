"use client";
/**
 * A section's cross-section, drawn to its catalogue width × height with
 * dimension lines.
 *
 * Priority:
 * 1. Real manufacturer catalogue cropped photo from /public/sections/<id>.png
 *    (when available in SECTION_IMAGES)
 * 2. Vector CAD cross-section traced from manufacturer dies (in mm)
 * 3. Parametric architectural extrusion guide sketch by kind
 */
import { useId } from "react";
import type { ProfileDef } from "../lib/studio/model";
import { shapeOf, type Shape } from "../lib/studio/shapes";
import { hasImage, imageSrc } from "./section-profiles";

export default function SectionSketch({ p, tracks = 2 }: { p: ProfileDef | undefined; tracks?: number }) {
  // 1. If we have the cropped catalogue photo PNG, show the real photo
  if (p?.id && hasImage(p.id)) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-white p-1 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc(p.id)}
          alt={p.name ?? "Section photo"}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  // 2. If we have the traced vector CAD die shape, render it full-scale
  const real = shapeOf(p);
  if (real) return <RealSection s={real} />;

  // 3. Fallback: parametric architectural vector sketch
  return <GuideSketch p={p} tracks={tracks} />;
}

/** The section exactly as the catalogue draws it — traced, to scale, in mm. */
function RealSection({ s }: { s: Shape }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { w, h } = s;
  const big = Math.max(w, h);
  // Tight padding (0.12) so the profile is 2.5× larger and clearly legible
  const pad = big * 0.12;
  const fs = big / 9;
  const lw = Math.max(0.7, big / 110);
  // room for the size numbers below and to the right, so nothing is cut off
  const x0 = -pad * 0.5, y0 = -pad * 0.5;
  const vw = w + pad * 0.35 + fs * 1.05 + fs * 0.95 - x0;
  const vh = h + pad * 0.35 + fs * 1.05 + fs * 0.4 - y0;

  return (
    <svg
      viewBox={`${x0} ${y0} ${vw} ${vh}`}
      className="h-full w-full bg-white"
      role="img"
      aria-label={`Section ${s.code}, ${w} by ${h} mm`}
    >
      <defs>
        <linearGradient id={`m_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="45%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
      </defs>

      {/* Grid background subtle */}
      <rect
        x={x0}
        y={y0}
        width={vw}
        height={vh}
        fill="#f8fafc"
      />

      {/* Extrusion profile */}
      <path
        d={s.paths.join("")}
        fill={`url(#m_${uid})`}
        stroke="#0f172a"
        strokeWidth={lw}
        strokeLinejoin="round"
        fillRule="evenodd"
      />

      {/* Dimensions in mm */}
      <g
        stroke="#2563eb"
        strokeWidth={lw * 0.85}
        fill="#2563eb"
        fontSize={fs}
        fontFamily="ui-sans-serif, system-ui"
        fontWeight={700}
      >
        {/* Width line at bottom */}
        <line x1={0} y1={h + pad * 0.35} x2={w} y2={h + pad * 0.35} />
        <line x1={0} y1={h + pad * 0.2} x2={0} y2={h + pad * 0.5} />
        <line x1={w} y1={h + pad * 0.2} x2={w} y2={h + pad * 0.5} />
        <text x={w / 2} y={h + pad * 0.35 + fs * 1.05} textAnchor="middle" stroke="none">
          {w}
        </text>

        {/* Height line at right */}
        <line x1={w + pad * 0.35} y1={0} x2={w + pad * 0.35} y2={h} />
        <line x1={w + pad * 0.2} y1={0} x2={w + pad * 0.5} y2={0} />
        <line x1={w + pad * 0.2} y1={h} x2={w + pad * 0.5} y2={h} />
        <text
          transform={`translate(${w + pad * 0.35 + fs * 1.05} ${h / 2}) rotate(90)`}
          textAnchor="middle"
          stroke="none"
        >
          {h}
        </text>
      </g>

    </svg>
  );
}

/** Architectural parametric extrusion sketch for profiles without CAD shapes */
function GuideSketch({ p, tracks = 2 }: { p: ProfileDef | undefined; tracks?: number }) {
  const nums = (p?.size ?? "").split(/[×x*]/).map((s) => parseFloat(s)).filter((n) => n > 0);
  const known = nums.length === 2;
  const kind = p?.kind ?? "other";
  const [w, h] = known ? [nums[0], nums[1]] : kind === "track" || kind === "frame" ? [62, 40] : [55, 26];

  const big = Math.max(w, h);
  const pad = big * 0.12;
  const sw = Math.max(1, big / 50); // wall thickness in drawing
  const fs = big / 9;

  let content: React.ReactNode;
  const chan = Math.max(
    1,
    /4-Track/i.test(p?.name ?? "")
      ? 4
      : /3-Track/i.test(p?.name ?? "")
      ? 3
      : /2-Track/i.test(p?.name ?? "")
      ? 2
      : tracks
  );

  if (!p || !known) {
    // Elegant blank placeholder
    content = (
      <g stroke="#94a3b8" strokeWidth={sw} fill="none" strokeDasharray="3 2">
        <rect x={0} y={0} width={w} height={h} rx={2} />
        <line x1={0} y1={0} x2={w} y2={h} />
        <line x1={0} y1={h} x2={w} y2={0} />
      </g>
    );
  } else if (kind === "track" || kind === "frame") {
    // Multi-chamber sliding track: base web + track channels with runner rail heads
    const baseH = Math.max(h * 0.28, sw * 2);
    const n = chan + 1;
    const legs: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const x = (w - sw * 2) * (i / (n - 1)) + sw;
      legs.push(<line key={`l${i}`} x1={x} y1={h - baseH} x2={x} y2={0} stroke="#1e293b" strokeWidth={sw * 1.3} />);
      legs.push(<line key={`c${i}`} x1={x - w / (n * 5)} y1={0} x2={x + w / (n * 5)} y2={0} stroke="#1e293b" strokeWidth={sw * 1.3} />);
    }
    // Runner rail ridges in channels
    const runners: React.ReactNode[] = [];
    for (let i = 0; i < chan; i++) {
      const rx = (w / chan) * (i + 0.5);
      runners.push(<circle key={`r${i}`} cx={rx} cy={h - baseH - sw * 1.5} r={sw * 0.8} fill="#2563eb" />);
    }

    content = (
      <>
        <rect x={0} y={h - baseH} width={w} height={baseH} rx={1} fill="#cbd5e1" stroke="#1e293b" strokeWidth={sw} />
        {legs}
        {runners}
      </>
    );
  } else if (kind === "bearing" || kind === "rail") {
    // Heavy rail / bottom bearing: hollow box + roller pocket + glass rebate
    const pocketH = h * 0.45;
    content = (
      <>
        <rect x={0} y={0} width={w} height={h} rx={1} fill="#cbd5e1" stroke="#1e293b" strokeWidth={sw} />
        <rect x={sw * 1.5} y={sw * 1.5} width={w - sw * 3} height={h - pocketH - sw * 2} rx={1} fill="#f8fafc" stroke="#334155" strokeWidth={sw * 0.8} />
        {/* Roller chamber */}
        <path d={`M${w * 0.2} ${h} V${h - pocketH} H${w * 0.8} V${h}`} stroke="#1e293b" strokeWidth={sw} fill="#f8fafc" />
      </>
    );
  } else if (kind === "interlock" || kind === "slim-interlock") {
    // Interlock stile: hollow body + glass pocket + prominent interlock mating hook
    const bodyW = w * 0.72;
    content = (
      <>
        {/* Main box */}
        <rect x={0} y={0} width={bodyW} height={h} rx={1} fill="#cbd5e1" stroke="#1e293b" strokeWidth={sw} />
        <rect x={sw * 1.5} y={sw * 1.5} width={bodyW - sw * 3} height={h - sw * 3} rx={1} fill="#f8fafc" stroke="#334155" strokeWidth={sw * 0.8} />
        {/* Interlock hook with weatherstrip pocket */}
        <path
          d={`M${bodyW} ${h * 0.22} H${w} V${h * 0.65} H${w * 0.88} V${h * 0.42} H${bodyW}`}
          fill="#cbd5e1"
          stroke="#1e293b"
          strokeWidth={sw}
        />
        {/* Woolpile groove */}
        <rect x={bodyW - sw * 2} y={h * 0.3} width={sw * 1.5} height={h * 0.4} fill="#64748b" />
      </>
    );
  } else if (kind === "interlock-patti") {
    // Slim interlock patti clip
    content = (
      <path
        d={`M0 0 V${h} H${w} V${h * 0.3} H${w * 0.5} V0 Z`}
        fill="#cbd5e1"
        stroke="#1e293b"
        strokeWidth={sw}
      />
    );
  } else if (kind === "bead") {
    // Snap-in glazing clip with gasket leg
    content = (
      <path
        d={`M0 ${h} L${w * 0.55} ${h * 0.12} H${w} V${h * 0.68} H${w * 0.82} L${w * 0.4} ${h} Z`}
        fill="#cbd5e1"
        stroke="#1e293b"
        strokeWidth={sw}
      />
    );
  } else {
    // Sash / Handle stile: hollow profile + glass pocket + handle recess
    content = (
      <>
        <rect x={0} y={0} width={w} height={h} rx={1} fill="#cbd5e1" stroke="#1e293b" strokeWidth={sw} />
        <rect x={sw * 1.5} y={sw * 1.5} width={w - sw * 3} height={h - sw * 3} rx={1} fill="#f8fafc" stroke="#334155" strokeWidth={sw * 0.8} />
        {/* Glass pocket groove on left */}
        <path d={`M0 ${h * 0.25} H${sw * 2.5} V${h * 0.75} H0`} fill="#94a3b8" stroke="#1e293b" strokeWidth={sw * 0.7} />
        {/* Handle finger recess */}
        {kind === "handle" && (
          <circle cx={w * 0.65} cy={h / 2} r={Math.min(h * 0.22, w * 0.18)} fill="#e2e8f0" stroke="#1e293b" strokeWidth={sw} />
        )}
      </>
    );
  }

  return (
    <svg
      viewBox={`${-pad * 0.5} ${-pad * 0.5} ${w + pad * 1.8} ${h + pad * 1.8}`}
      className="h-full w-full bg-white"
      role="img"
      aria-label={known ? `Section ${w} by ${h} mm` : "Section size not known"}
    >
      <rect
        x={-pad * 0.5}
        y={-pad * 0.5}
        width={w + pad * 1.8}
        height={h + pad * 1.8}
        fill="#f8fafc"
      />
      {content}

      {known && (
        <g
          stroke="#2563eb"
          strokeWidth={sw * 0.7}
          fill="#2563eb"
          fontSize={fs}
          fontFamily="ui-sans-serif, system-ui"
          fontWeight={700}
        >
          <line x1={0} y1={h + pad * 0.35} x2={w} y2={h + pad * 0.35} />
          <line x1={0} y1={h + pad * 0.2} x2={0} y2={h + pad * 0.5} />
          <line x1={w} y1={h + pad * 0.2} x2={w} y2={h + pad * 0.5} />
          <text x={w / 2} y={h + pad * 0.35 + fs * 1.05} textAnchor="middle" stroke="none">
            {w}
          </text>

          <line x1={w + pad * 0.35} y1={0} x2={w + pad * 0.35} y2={h} />
          <line x1={w + pad * 0.2} y1={0} x2={w + pad * 0.5} y2={0} />
          <line x1={w + pad * 0.2} y1={h} x2={w + pad * 0.5} y2={h} />
          <text
            transform={`translate(${w + pad * 0.35 + fs * 1.05} ${h / 2}) rotate(90)`}
            textAnchor="middle"
            stroke="none"
          >
            {h}
          </text>
        </g>
      )}

      {!known && (
        <text x={w / 2} y={h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs * 0.8} fill="#94a3b8" fontWeight={600}>
          Select
        </text>
      )}
    </svg>
  );
}
