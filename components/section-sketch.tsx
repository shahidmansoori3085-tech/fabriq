"use client";
/**
 * A section's cross-section, drawn to its catalogue width × height with
 * dimension lines. The shape is a clear guide by kind (track channels, sash
 * box with glass pocket, interlock hook…); the numbers are the catalogue's.
 */
import { useId } from "react";
import type { ProfileDef } from "../lib/studio/model";
import { shapeOf, type Shape } from "../lib/studio/shapes";

export default function SectionSketch({ p, tracks = 2 }: { p: ProfileDef | undefined; tracks?: number }) {
  const real = shapeOf(p);
  if (real) return <RealSection s={real} />;
  return <GuideSketch p={p} tracks={tracks} />;
}

/** The section exactly as the catalogue draws it — traced, to scale, in mm. */
function RealSection({ s }: { s: Shape }) {
  const uid = useId().replace(/:/g, "");
  const { w, h } = s;
  const big = Math.max(w, h);
  const pad = big * 0.3, fs = big / 9, lw = big / 160;
  const check = s.scaleCheck > 4;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} className="h-full w-full" role="img" aria-label={`Section ${s.code}, ${w} by ${h} mm`}>
      <defs>
        <linearGradient id={`m${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9edf1" /><stop offset="0.5" stopColor="#c3cad2" /><stop offset="1" stopColor="#dfe4ea" />
        </linearGradient>
      </defs>
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill="#f8fafc" />
      <path d={s.paths.join("")} fill={`url(#m${uid})`} stroke="#3f4752" strokeWidth={lw} strokeLinejoin="round" fillRule="evenodd" />
      <g stroke="#2563eb" strokeWidth={lw * 0.9} fill="#2563eb" fontSize={fs} fontFamily="ui-sans-serif, system-ui" fontWeight={600}>
        <line x1={0} y1={h + pad * 0.45} x2={w} y2={h + pad * 0.45} />
        <line x1={0} y1={h + pad * 0.3} x2={0} y2={h + pad * 0.6} /><line x1={w} y1={h + pad * 0.3} x2={w} y2={h + pad * 0.6} />
        <text x={w / 2} y={h + pad * 0.45 + fs * 1.15} textAnchor="middle" stroke="none">{w}</text>
        <line x1={w + pad * 0.45} y1={0} x2={w + pad * 0.45} y2={h} />
        <line x1={w + pad * 0.3} y1={0} x2={w + pad * 0.6} y2={0} /><line x1={w + pad * 0.3} y1={h} x2={w + pad * 0.6} y2={h} />
        <text transform={`translate(${w + pad * 0.45 + fs * 1.15} ${h / 2}) rotate(90)`} textAnchor="middle" stroke="none">{h}</text>
      </g>
      {check && <text x={-pad * 0.8} y={-pad * 0.35} fontSize={fs * 0.8} fill="#b45309" fontWeight={700}>check size</text>}
    </svg>
  );
}

/** A clear guide by kind, when the real shape has not been traced yet. */
function GuideSketch({ p, tracks = 2 }: { p: ProfileDef | undefined; tracks?: number }) {
  const nums = (p?.size ?? "").split(/[×x*]/).map((s) => parseFloat(s)).filter((n) => n > 0);
  const known = nums.length === 2;
  const kind = p?.kind ?? "other";
  const [w, h] = known ? [nums[0], nums[1]] : kind === "track" || kind === "frame" ? [62, 40] : [55, 26];
  const pad = Math.max(w, h) * 0.32;
  const sw = Math.max(w, h) / 70; // wall thickness in drawing
  const fs = Math.max(w, h) / 9;
  const box = (x: number, y: number, bw: number, bh: number, k?: string) =>
    <rect key={k} x={x} y={y} width={bw} height={bh} fill="none" stroke="#4b5563" strokeWidth={sw} />;

  let shape: React.ReactNode;
  const chan = Math.max(1, /4-Track/i.test(p?.name ?? "") ? 4 : /3-Track/i.test(p?.name ?? "") ? 3 : /2-Track/i.test(p?.name ?? "") ? 2 : tracks);
  if (kind === "track" || kind === "frame") {
    // base box + upright channels the shutters run in
    const baseH = h * 0.32;
    const legs: React.ReactNode[] = [];
    const n = chan + 1;
    for (let i = 0; i < n; i++) {
      const x = (w - sw * 2) * (i / (n - 1)) + sw;
      legs.push(<line key={i} x1={x} y1={h - baseH} x2={x} y2={0} stroke="#4b5563" strokeWidth={sw * 1.2} />);
      legs.push(<path key={`c${i}`} d={`M${x - w / (n * 6)} 0 h${w / (n * 3)}`} stroke="#4b5563" strokeWidth={sw} />);
    }
    shape = <>{box(0, h - baseH, w, baseH, "b")}{legs}</>;
  } else if (kind === "bearing") {
    shape = <path d={`M0 0 h${w} M0 ${h} h${w} M${w / 2} 0 v${h} M0 ${h * 0.5} h${w}`} stroke="#4b5563" strokeWidth={sw * 1.4} fill="none" />;
  } else if (kind === "interlock-patti") {
    shape = <path d={`M0 0 v${h} h${w} M0 ${h * 0.3} h${w * 0.5}`} stroke="#4b5563" strokeWidth={sw * 1.6} fill="none" />;
  } else if (kind === "bead" || kind === "rail") {
    shape = <path d={`M0 ${h} L${w * 0.55} ${h * 0.15} H${w} V${h * 0.7}`} stroke="#4b5563" strokeWidth={sw * 1.6} fill="none" />;
  } else {
    // hollow sash box with a glass pocket; interlocks get a hook
    const hook = kind === "interlock" || kind === "slim-interlock";
    shape = (
      <>
        {box(0, 0, w * (hook ? 0.78 : 1), h, "o")}
        <line x1={w * 0.3} y1={0} x2={w * 0.3} y2={h} stroke="#4b5563" strokeWidth={sw} />
        <path d={`M0 ${h * 0.3} h${-w * 0.08} M0 ${h * 0.7} h${-w * 0.08}`} stroke="#4b5563" strokeWidth={sw * 1.4} />
        {hook && <path d={`M${w * 0.78} ${h * 0.2} H${w} V${h * 0.55} H${w * 0.9}`} stroke="#4b5563" strokeWidth={sw * 1.4} fill="none" />}
        {kind === "handle" && <circle cx={w * 0.65} cy={h / 2} r={h * 0.12} fill="none" stroke="#4b5563" strokeWidth={sw} />}
      </>
    );
  }

  return (
    <svg viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} className="h-full w-full" role="img"
      aria-label={known ? `Section ${w} by ${h} mm` : "Section size not known"}>
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill="#f8fafc" />
      <g fill="#e8ebef">{shape}</g>
      {known && (
        <g stroke="#2563eb" strokeWidth={sw * 0.6} fill="#2563eb" fontSize={fs} fontFamily="ui-sans-serif, system-ui" fontWeight={600}>
          <line x1={0} y1={h + pad * 0.45} x2={w} y2={h + pad * 0.45} />
          <line x1={0} y1={h + pad * 0.3} x2={0} y2={h + pad * 0.6} /><line x1={w} y1={h + pad * 0.3} x2={w} y2={h + pad * 0.6} />
          <text x={w / 2} y={h + pad * 0.45 + fs * 1.15} textAnchor="middle" stroke="none">{w} mm</text>
          <line x1={w + pad * 0.45} y1={0} x2={w + pad * 0.45} y2={h} />
          <line x1={w + pad * 0.3} y1={0} x2={w + pad * 0.6} y2={0} /><line x1={w + pad * 0.3} y1={h} x2={w + pad * 0.6} y2={h} />
          <text transform={`translate(${w + pad * 0.45 + fs * 1.15} ${h / 2}) rotate(90)`} textAnchor="middle" stroke="none">{h} mm</text>
        </g>
      )}
      {!known && <text x={w / 2} y={h + pad * 0.6} textAnchor="middle" fontSize={fs} fill="#9ca3af">size not entered</text>}
    </svg>
  );
}
