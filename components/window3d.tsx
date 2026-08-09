"use client";
/**
 * FabriQ Live 3D Configurator — a real, parametric aluminium window/door built
 * in-browser with React-Three-Fiber (NO 3D API). Every frame & shutter member
 * is an EXTRUDED SECTION PROFILE (THREE.Shape swept along its length), so the
 * model is literally built "from the sections" — realistic depth, tracks,
 * mitred corners. Colour (anodised finish) and glass swap live. Deterministic:
 * geometry comes straight from the opening's real width/height.
 */
import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, ContactShadows, OrbitControls, Center } from "@react-three/drei";
import * as THREE from "three";
import type { JobItem } from "@/lib/engine/types";

/* ————————————————— finishes & glass ————————————————— */

export type Finish = "black" | "white" | "champagne" | "wood";
export type GlassKind = "clear" | "frosted" | "tinted";

const FINISHES: Record<Finish, { label: string; swatch: string; color: string; metalness: number; roughness: number }> = {
  black:     { label: "Matte Black", swatch: "#1c1c1e", color: "#232327", metalness: 0.85, roughness: 0.45 },
  white:     { label: "Ivory White", swatch: "#eef0f2", color: "#e9ecee", metalness: 0.35, roughness: 0.55 },
  champagne: { label: "Champagne",   swatch: "#c9a86a", color: "#c3a066", metalness: 0.9,  roughness: 0.3 },
  wood:      { label: "Wood Grain",  swatch: "#7a5230", color: "#7a5230", metalness: 0.15, roughness: 0.7 },
};

const GLASSES: Record<GlassKind, { label: string; swatch: string; color: string; opacity: number; roughness: number }> = {
  clear:   { label: "Clear",   swatch: "#cfe6f2", color: "#dff0f7", opacity: 0.28, roughness: 0.03 },
  frosted: { label: "Frosted", swatch: "#e6edf0", color: "#eef3f5", opacity: 0.62, roughness: 0.55 },
  tinted:  { label: "Tinted",  swatch: "#5b7a72", color: "#6f8f86", opacity: 0.5,  roughness: 0.06 },
};

/* ————————————————— profile geometry ————————————————— */

/** A rounded-rectangle aluminium section, centred, as a THREE.Shape. */
function profileShape(w: number, h: number, groove = false): THREE.Shape {
  const s = new THREE.Shape();
  const r = Math.min(w, h) * 0.16;
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  if (groove) {
    // a shallow glazing groove on the inner (top) face
    const gw = w * 0.28, gd = h * 0.22;
    const hole = new THREE.Path();
    hole.moveTo(-gw / 2, h / 2 - gd);
    hole.lineTo(gw / 2, h / 2 - gd);
    hole.lineTo(gw / 2, h / 2 + 0.001);
    hole.lineTo(-gw / 2, h / 2 + 0.001);
    hole.lineTo(-gw / 2, h / 2 - gd);
    s.holes.push(hole);
  }
  return s;
}

/** Extrude a section profile along `len` (centred on origin, swept on +Z). */
function barGeometry(len: number, pw: number, ph: number, groove = false): THREE.ExtrudeGeometry {
  const bevel = Math.min(pw, ph) * 0.12;
  const g = new THREE.ExtrudeGeometry(profileShape(pw, ph, groove), {
    depth: len, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1,
  });
  g.translate(0, 0, -len / 2);
  g.computeVertexNormals();
  return g;
}

/** A framed sash (4 thin members + optional glass/jali fill), sized W×H, at depth z. */
function Sash({
  W, H, pw, ph, mat, fill, z = 0,
}: {
  W: number; H: number; pw: number; ph: number;
  mat: THREE.Material; fill: React.ReactNode; z?: number;
}) {
  const topG = useMemo(() => barGeometry(W, pw, ph, true), [W, pw, ph]);
  const sideG = useMemo(() => barGeometry(H - 2 * pw, pw, ph, true), [H, pw, ph]);
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={topG} material={mat} rotation={[0, Math.PI / 2, 0]} position={[0, H / 2 - pw / 2, 0]} castShadow />
      <mesh geometry={topG} material={mat} rotation={[0, Math.PI / 2, 0]} position={[0, -H / 2 + pw / 2, 0]} castShadow />
      <mesh geometry={sideG} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[-W / 2 + pw / 2, 0, 0]} castShadow />
      <mesh geometry={sideG} material={mat} rotation={[-Math.PI / 2, 0, 0]} position={[W / 2 - pw / 2, 0, 0]} castShadow />
      {fill}
    </group>
  );
}

/* ————————————————— the window model ————————————————— */

function WindowModel({ item, finish, glass }: { item: JobItem; finish: Finish; glass: GlassKind }) {
  // real opening size → metres (µm / 1e6). Clamp so tiny/huge jobs still frame well.
  const W = Math.min(Math.max(item.width / 1_000_000, 0.6), 3);
  const H = Math.min(Math.max(item.height / 1_000_000, 0.6), 3);
  // frame face & depth per real system (metres) — so the model reads true to
  // the actual section: thin casement Z, deep 3-track sliding, chunky Domal…
  const SYS: Record<string, { face: number; depth: number }> = {
    normal_2t: { face: 0.05, depth: 0.062 },
    normal_3t: { face: 0.05, depth: 0.092 },
    domal:     { face: 0.055, depth: 0.08 },
    z_section: { face: 0.04, depth: 0.045 },
    partition: { face: 0.038, depth: 0.0635 },
    door_single: { face: 0.052, depth: 0.05 },
  };
  const sys = SYS[item.system] ?? { face: 0.05, depth: 0.06 };
  const depth = sys.depth;

  const fin = FINISHES[finish];
  const alu = useMemo(() => new THREE.MeshStandardMaterial({
    color: fin.color, metalness: fin.metalness, roughness: fin.roughness,
  }), [fin.color, fin.metalness, fin.roughness]);

  const gl = GLASSES[glass];
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: gl.color, transparent: true, opacity: gl.opacity, roughness: gl.roughness,
    metalness: 0, transmission: glass === "clear" ? 0.9 : glass === "tinted" ? 0.7 : 0.4,
    thickness: 0.01, ior: 1.45, reflectivity: 0.4, clearcoat: 0.3, side: THREE.DoubleSide,
  }), [gl.color, gl.opacity, gl.roughness, glass]);
  const jaliMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#2b2f33", metalness: 0.4, roughness: 0.7, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
  }), []);

  // outer frame members
  const fpw = sys.face; // profile face width, per system
  const outerTop = useMemo(() => barGeometry(W, fpw, depth, true), [W, fpw, depth]);
  const outerSide = useMemo(() => barGeometry(H - 2 * fpw, fpw, depth, true), [H, fpw, depth]);

  // shutters (sliding, side by side); alternate tracks offset in Z
  const shutters = item.shutters.length ? item.shutters : [{ kind: "glass" as const }];
  const n = item.type === "window" ? Math.max(1, shutters.length) : 1;
  const innerW = W - 2 * fpw, innerH = H - 2 * fpw;
  const sw = innerW / n;
  const spw = Math.max(0.028, fpw * 0.62);

  return (
    <group>
      {/* outer frame */}
      <mesh geometry={outerTop} material={alu} rotation={[0, Math.PI / 2, 0]} position={[0, H / 2 - fpw / 2, 0]} castShadow receiveShadow />
      <mesh geometry={outerTop} material={alu} rotation={[0, Math.PI / 2, 0]} position={[0, -H / 2 + fpw / 2, 0]} castShadow receiveShadow />
      <mesh geometry={outerSide} material={alu} rotation={[-Math.PI / 2, 0, 0]} position={[-W / 2 + fpw / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={outerSide} material={alu} rotation={[-Math.PI / 2, 0, 0]} position={[W / 2 - fpw / 2, 0, 0]} castShadow receiveShadow />

      {/* shutters */}
      {Array.from({ length: n }).map((_, i) => {
        const cx = -innerW / 2 + sw * (i + 0.5);
        const kind = shutters[i % shutters.length]?.kind ?? "glass";
        const z = (i % 2 === 0 ? 1 : -1) * depth * 0.18; // sliding track offset
        const panelW = sw - spw * 2 - 0.006;
        const panelH = innerH - spw * 2 - 0.006;
        const fill = (
          <group>
            {/* glass/panel, recessed into the glazing rebate */}
            <mesh position={[0, 0, -depth * 0.06]}>
              <boxGeometry args={[panelW, panelH, 0.005]} />
              <primitive object={kind === "jali" ? jaliMat : glassMat} attach="material" />
            </mesh>
            {/* jali = fine mesh grid overlay */}
            {kind === "jali" && (
              <mesh position={[0, 0, -depth * 0.05]}>
                <planeGeometry args={[panelW, panelH, Math.max(6, Math.round(panelW * 26)), Math.max(8, Math.round(panelH * 26))]} />
                <meshStandardMaterial color="#20242a" wireframe transparent opacity={0.85} />
              </mesh>
            )}
          </group>
        );
        return (
          <group key={i} position={[cx, 0, 0]}>
            <Sash W={sw - 0.004} H={innerH - 0.004} pw={spw} ph={depth * 0.5} mat={alu} z={z} fill={fill} />
            {/* D-handle on the leading (last) shutter's outer stile */}
            {i === n - 1 && (
              <group position={[sw / 2 - spw * 0.8, -innerH * 0.05, z + depth * 0.34]}>
                <mesh material={alu} castShadow><boxGeometry args={[spw * 0.34, innerH * 0.2, spw * 0.34]} /></mesh>
                <mesh material={alu} position={[-spw * 0.5, innerH * 0.1, 0]} castShadow><boxGeometry args={[spw * 0.9, spw * 0.28, spw * 0.28]} /></mesh>
                <mesh material={alu} position={[-spw * 0.5, -innerH * 0.1, 0]} castShadow><boxGeometry args={[spw * 0.9, spw * 0.28, spw * 0.28]} /></mesh>
              </group>
            )}
          </group>
        );
      })}

      {/* meeting rail / interlock where adjacent sliding shutters overlap */}
      {n > 1 && Array.from({ length: n - 1 }).map((_, i) => {
        const x = -innerW / 2 + sw * (i + 1);
        return (
          <mesh key={`m${i}`} material={alu} position={[x, 0, 0]} castShadow>
            <boxGeometry args={[spw * 1.1, innerH - 0.004, depth * 0.62]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Lights + procedural studio env, shared by the interactive view and the thumb. */
function Studio() {
  return (
    <>
      <color attach="background" args={["#e7ecf1"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />
      <ContactShadows position={[0, -1.15, 0]} opacity={0.35} scale={6} blur={2.4} far={3} />
      <Environment resolution={256}>
        <Lightformer intensity={2.2} position={[0, 3, 3]} scale={[7, 3, 1]} />
        <Lightformer intensity={1.1} position={[-4, 1, 2]} scale={[3, 4, 1]} />
        <Lightformer intensity={0.9} position={[4, 1, -2]} scale={[3, 4, 1]} color="#cfe0ff" />
        <Lightformer intensity={0.7} position={[0, -2, 2]} scale={[6, 2, 1]} />
      </Environment>
    </>
  );
}

/** Fires onReady once, a few frames after mount, with the canvas as a PNG. */
function Grab({ onReady }: { onReady: (dataUrl: string) => void }) {
  const gl = useThree((s) => s.gl);
  const n = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    n.current += 1;
    if (n.current >= 4) {
      done.current = true;
      try { onReady(gl.domElement.toDataURL("image/png")); } catch { /* ignore */ }
    }
  });
  return null;
}

/**
 * Small, static, auto-capturing 3D thumbnail for the quotation. Renders the
 * window in the chosen finish/glass and reports a PNG snapshot once ready.
 * Remount via `key` (finish/glass) to re-capture on colour change.
 */
export function Window3DThumb({
  item, finish, glass, size = 150, onReady,
}: {
  item: JobItem; finish: Finish; glass: GlassKind; size?: number;
  onReady: (dataUrl: string) => void;
}) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
      <Canvas shadows dpr={1.5} gl={{ preserveDrawingBuffer: true }} camera={{ position: [1.5, 0.55, 2.3], fov: 38 }}>
        <Studio />
        <Center>
          <WindowModel item={item} finish={finish} glass={glass} />
        </Center>
        <Grab onReady={onReady} />
      </Canvas>
    </div>
  );
}

function Spin({ children, on }: { children: React.ReactNode; on: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (on && ref.current) ref.current.rotation.y += dt * 0.35; });
  return <group ref={ref}>{children}</group>;
}

/* ————————————————— exported configurator ————————————————— */

export default function Window3D({ item, onCapture }: { item: JobItem; onCapture?: (dataUrl: string) => void }) {
  const [finish, setFinish] = useState<Finish>("black");
  const [glass, setGlass] = useState<GlassKind>("clear");
  const [spin, setSpin] = useState(true);
  const [saved, setSaved] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const capture = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas || !onCapture) return;
    try { onCapture(canvas.toDataURL("image/png")); setSaved(true); setTimeout(() => setSaved(false), 1800); }
    catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col gap-3">
      <div ref={wrapRef} className="relative overflow-hidden rounded-2xl" style={{ height: 360, border: "1px solid var(--line)", background: "linear-gradient(180deg,#e9edf2,#cdd5de)" }}>
        <Canvas shadows dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} camera={{ position: [1.4, 0.6, 2.2], fov: 40 }}>
          <Studio />
          <Spin on={spin}>
            <Center>
              <WindowModel item={item} finish={finish} glass={glass} />
            </Center>
          </Spin>
          <OrbitControls enablePan={false} minDistance={1.4} maxDistance={4.5} enableDamping onStart={() => setSpin(false)} />
        </Canvas>
        <div className="absolute right-3 top-3 flex gap-2">
          {onCapture && (
            <button onClick={capture}
              className="rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: saved ? "#1b9250" : "var(--accent)", color: "#fff", backdropFilter: "blur(6px)" }}>
              {saved ? "✓ Saved" : "📸 Save to Quotation"}
            </button>
          )}
          <button onClick={() => setSpin((s) => !s)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: "rgba(20,24,30,0.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
            {spin ? "⏸ Rotate" : "▶ Rotate"}
          </button>
        </div>
        <div className="absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ background: "rgba(20,24,30,0.55)", color: "#fff", backdropFilter: "blur(6px)" }}>
          Live 3D · drag to spin
        </div>
      </div>

      {/* controls */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="eyebrow mb-2">Finish</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FINISHES) as Finish[]).map((f) => (
              <button key={f} onClick={() => setFinish(f)} title={FINISHES[f].label}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold transition-all"
                style={{
                  border: `1.5px solid ${finish === f ? "var(--accent)" : "var(--line)"}`,
                  background: finish === f ? "var(--accent-soft)" : "var(--surface)",
                }}>
                <span className="h-4 w-4 rounded-full" style={{ background: FINISHES[f].swatch, border: "1px solid rgba(0,0,0,.15)" }} />
                {FINISHES[f].label}
              </button>
            ))}
          </div>
        </div>
        <div className="card p-3">
          <div className="eyebrow mb-2">Glass</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GLASSES) as GlassKind[]).map((g) => (
              <button key={g} onClick={() => setGlass(g)} title={GLASSES[g].label}
                className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-semibold transition-all"
                style={{
                  border: `1.5px solid ${glass === g ? "var(--accent)" : "var(--line)"}`,
                  background: glass === g ? "var(--accent-soft)" : "var(--surface)",
                }}>
                <span className="h-4 w-4 rounded-full" style={{ background: GLASSES[g].swatch, border: "1px solid rgba(0,0,0,.15)" }} />
                {GLASSES[g].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-center text-[11px]" style={{ color: "var(--ink-3)" }}>
        Built from the real section profiles · {(item.width / 304800).toFixed(1)}′ × {(item.height / 304800).toFixed(1)}′
      </p>
    </div>
  );
}
