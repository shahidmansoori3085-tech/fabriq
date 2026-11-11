"use client";
/**
 * Photorealistic Architectural 3D Viewer for Aluminum Window Systems.
 * Supports:
 *   1. Architectural Corner Cutaway Model (Reynaers / Crystal Windows style)
 *      with true multi-chamber profile extrusions, DGU insulated glass,
 *      EPDM rubber wedge gaskets, stainless steel runner rail (patri),
 *      and exposed cross-section cutfaces.
 *   2. Full Window 3D Assembly.
 *   3. PBR Finishes: Titanium Grey, Silver Anodised, Architectural Black, Champagne.
 */
import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { Member, WindowGeo } from "../lib/studio/geometry";
import type { Pick } from "./studio-drawing";

type V2 = [number, number];

export type FinishId = "titan" | "silver" | "black" | "champagne";

interface FinishDef {
  id: FinishId;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  dotColor: string;
}

const FINISHES: FinishDef[] = [
  { id: "titan", label: "Titanium Grey", color: "#4f5661", metalness: 0.82, roughness: 0.28, dotColor: "#545b66" },
  { id: "silver", label: "Silver Anodised", color: "#d2d7de", metalness: 0.88, roughness: 0.22, dotColor: "#d2d7de" },
  { id: "black", label: "Matt Black", color: "#25292e", metalness: 0.72, roughness: 0.38, dotColor: "#25292e" },
  { id: "champagne", label: "Champagne Bronze", color: "#8a7e72", metalness: 0.82, roughness: 0.26, dotColor: "#8a7e72" },
];

function loopsOf(paths: string[]): V2[][] {
  const out: V2[][] = [];
  for (const d of paths) for (const part of d.split("M").filter(Boolean)) {
    const pts = part.replace(/Z/g, "").split("L").map((p) => p.trim().split(/\s+/).map(Number) as V2);
    if (pts.length > 2) out.push(pts);
  }
  return out;
}

const area = (l: V2[]) => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function inside(pt: V2, l: V2[]) {
  let c = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** The member's section in (a = across face, b = depth) as THREE shapes with hollow chambers/holes. */
function sectionShapes(m: Member): THREE.Shape[] {
  const role = m.place.startsWith("frame") ? "frame" : "sash";
  let loops: V2[][];
  if (m.shape && m.shape.paths && m.shape.paths.length) {
    const { w, h } = m.shape;
    loops = loopsOf(m.shape.paths).map((l) => l.map(([x, y]): V2 => {
      if (role === "frame") return [m.flip ? y : h - y, x];
      return [m.flip ? w - x : x, y];
    }));
  } else {
    // Realistic multi-chamber profile fallback if unvectorized
    const f = m.face ?? (role === "frame" ? 45 : 55);
    const d = m.depth ?? (role === "frame" ? 65 : 30);
    const t = 1.8; // standard 1.8mm extrusion wall
    loops = [
      [[0, 0], [f, 0], [f, d], [0, d]],
      [[t, t], [t, d - t], [f * 0.45, d - t], [f * 0.45, t]],
      [[f * 0.55, t], [f * 0.55, d - t], [f - t, d - t], [f - t, t]],
    ];
  }
  const info = loops.map((l) => ({ l, a: Math.abs(area(l)) })).sort((x, y) => y.a - x.a);
  const shapes: { s: THREE.Shape; l: V2[] }[] = [];
  for (const { l } of info) {
    const holders = shapes.filter((x) => inside(l[0], x.l));
    const parentLoops = info.filter((x) => x.l !== l && x.a > Math.abs(area(l)) && inside(l[0], x.l));
    if (parentLoops.length % 2 === 1 && holders.length) {
      const host = holders[holders.length - 1];
      const ccw = area(l) > 0 ? [...l].reverse() : l;
      host.s.holes.push(new THREE.Path(ccw.map(([x, y]) => new THREE.Vector2(x, y))));
    } else {
      const ccw = area(l) < 0 ? [...l].reverse() : l;
      shapes.push({ s: new THREE.Shape(ccw.map(([x, y]) => new THREE.Vector2(x, y))), l });
    }
  }
  return shapes.map((x) => x.s);
}

/** Full window member extrusion. */
function memberGeometry(m: Member, H: number, zFront: number): THREE.BufferGeometry | null {
  const xs = m.poly.map((p) => p[0]), ys = m.poly.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const horizontal = !m.vertical;
  const L = horizontal ? maxX - minX : maxY - minY;
  if (!(L > 1) || !m.axis) return null;
  const shapes = sectionShapes(m);
  if (!shapes.length) return null;
  const g = new THREE.ExtrudeGeometry(shapes, { depth: L, bevelEnabled: false, curveSegments: 1, steps: 1 });
  if (m.angle === 45) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const a = pos.getX(i), c = pos.getZ(i);
      if (Math.abs(c) < 1e-6) pos.setZ(i, a);
      else if (Math.abs(c - L) < 1e-6) pos.setZ(i, L - a);
    }
    pos.needsUpdate = true;
  }
  const [ax, ay, bx, by] = m.axis;
  let A: THREE.Vector3, C: THREE.Vector3, O: THREE.Vector3;
  if (horizontal) {
    A = new THREE.Vector3(0, by > ay ? -1 : 1, 0);
    C = new THREE.Vector3(1, 0, 0);
    O = new THREE.Vector3(minX, H - ay, zFront);
  } else {
    A = new THREE.Vector3(bx > ax ? 1 : -1, 0, 0);
    C = new THREE.Vector3(0, 1, 0);
    O = new THREE.Vector3(ax, H - maxY, zFront);
  }
  const B = new THREE.Vector3(0, 0, -1);
  const M = new THREE.Matrix4().makeBasis(A, B, C).setPosition(O);
  g.applyMatrix4(M);
  g.computeVertexNormals();
  return g;
}

/** Soft studio reflections, generated in the phone — no download needed. */
function StudioLight() {
  const gl = useThree((st) => st.gl);
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  }, [gl]);
  useEffect(() => () => env.dispose(), [env]);
  return <primitive object={env} attach="environment" />;
}

export default function Window3D({
  g,
  pick,
  onPick,
  tracks,
}: {
  g: WindowGeo;
  pick: Pick;
  onPick: (p: Pick) => void;
  tracks: number;
}) {
  const [mode, setMode] = useState<"corner" | "full">("corner");
  const [finish, setFinish] = useState<FinishId>("titan");

  const { W, H } = g;
  const frameDepth = Math.max(40, ...g.frame.map((m) => m.depth ?? 0));
  const activeFinish = FINISHES.find((f) => f.id === finish) ?? FINISHES[0];

  // Realistic PBR Materials
  const metalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: activeFinish.color,
        metalness: activeFinish.metalness,
        roughness: activeFinish.roughness,
        envMapIntensity: 1.25,
        side: THREE.DoubleSide,
      }),
    [activeFinish]
  );

  const pickedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f97316",
        metalness: 0.5,
        roughness: 0.35,
        emissive: "#ea580c",
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
      }),
    []
  );

  const gasketMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#181b20",
        metalness: 0.05,
        roughness: 0.92,
        side: THREE.DoubleSide,
      }),
    []
  );

  const steelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f1f5f9",
        metalness: 0.95,
        roughness: 0.15,
        envMapIntensity: 1.5,
      }),
    []
  );

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c0ddf3",
        metalness: 0.1,
        roughness: 0.04,
        transparent: true,
        opacity: 0.36,
        side: THREE.DoubleSide,
      }),
    []
  );

  const spacerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#272c33",
        metalness: 0.65,
        roughness: 0.45,
      }),
    []
  );

  const meshMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#4b5563",
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Full Window Geometries
  const fullItems = useMemo(() => {
    const out: { key: string; geo: THREE.BufferGeometry; m: Member }[] = [];
    g.frame.forEach((m, i) => {
      const geo = memberGeometry(m, H, 0);
      if (geo) out.push({ key: `f${i}`, geo, m });
    });
    g.sash.forEach((m, i) => {
      const s = g.shutters[m.shutter ?? 0];
      const center = g.casement
        ? (m.depth ?? 28) * 0.35
        : (-frameDepth * ((s?.track ?? 0) + 0.5)) / Math.max(1, tracks);
      const geo = memberGeometry(m, H, center + (m.depth ?? 28) / 2);
      if (geo) out.push({ key: `s${i}`, geo, m });
    });
    return out;
  }, [g, H, frameDepth, tracks]);

  // Architectural Corner Cutaway Geometries (Reynaers / Crystal Windows Style)
  const cornerData = useMemo(() => {
    const mFb = g.frame.find((m) => m.place === "frame-bottom") ?? g.frame[0];
    const mFs = g.frame.find((m) => m.place === "frame-left") ?? g.frame[1];
    const mSb = g.sash.find((m) => m.place === "sash-bottom") ?? g.sash[0];
    const mSs =
      g.sash.find((m) => m.place === "sash-lock" || m.place === "sash-meet") ??
      g.sash[1];

    if (!mFb && !mFs) return null;

    const cornerLength = 260; // mm length of cutaway frame
    const sashLength = 205; // mm length of cutaway sash
    const glassSize = 175; // mm glass height & width in corner sample

    const out: { key: string; geo: THREE.BufferGeometry; m: Member; isSash?: boolean }[] = [];

    // Frame Bottom Extrusion along +X axis
    if (mFb) {
      const shapes = sectionShapes(mFb);
      if (shapes.length) {
        const gFb = new THREE.ExtrudeGeometry(shapes, { depth: cornerLength, bevelEnabled: false });
        if (mFb.angle === 45) {
          const pos = gFb.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const a = pos.getX(i), c = pos.getZ(i);
            if (Math.abs(c) < 1e-6) pos.setZ(i, a); // Mitre 45° at corner origin, 90° cut at end!
          }
          gFb.needsUpdate = true;
        }
        // Rotate so depth extrudes along +X
        const rot = new THREE.Matrix4().makeRotationY(Math.PI / 2);
        rot.setPosition(0, 0, 0);
        gFb.applyMatrix4(rot);
        gFb.computeVertexNormals();
        out.push({ key: "cfb", geo: gFb, m: mFb });
      }
    }

    // Frame Side Extrusion along +Y axis
    if (mFs) {
      const shapes = sectionShapes(mFs);
      if (shapes.length) {
        const gFs = new THREE.ExtrudeGeometry(shapes, { depth: cornerLength, bevelEnabled: false });
        if (mFs.angle === 45) {
          const pos = gFs.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const a = pos.getX(i), c = pos.getZ(i);
            if (Math.abs(c) < 1e-6) pos.setZ(i, a); // Mitre 45° at corner origin, 90° cut at top!
          }
          gFs.needsUpdate = true;
        }
        // Rotate so depth extrudes along +Y
        const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        rot.setPosition(0, 0, 0);
        gFs.applyMatrix4(rot);
        gFs.computeVertexNormals();
        out.push({ key: "cfs", geo: gFs, m: mFs });
      }
    }

    // Sash Bottom Rail Extrusion along +X axis
    const trackOffsetZ = -Math.max(15, frameDepth * 0.28);
    const trackFloorY = Math.max(10, (mFb?.face ?? 45) * 0.35);
    const sashFace = mSb?.face ?? 55;

    if (mSb) {
      const shapes = sectionShapes(mSb);
      if (shapes.length) {
        const gSb = new THREE.ExtrudeGeometry(shapes, { depth: sashLength, bevelEnabled: false });
        if (mSb.angle === 45) {
          const pos = gSb.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const a = pos.getX(i), c = pos.getZ(i);
            if (Math.abs(c) < 1e-6) pos.setZ(i, a);
          }
          gSb.needsUpdate = true;
        }
        const rot = new THREE.Matrix4().makeRotationY(Math.PI / 2);
        rot.setPosition(sashFace, trackFloorY, trackOffsetZ);
        gSb.applyMatrix4(rot);
        gSb.computeVertexNormals();
        out.push({ key: "csb", geo: gSb, m: mSb, isSash: true });
      }
    }

    // Sash Side Stile Extrusion along +Y axis
    if (mSs) {
      const shapes = sectionShapes(mSs);
      if (shapes.length) {
        const gSs = new THREE.ExtrudeGeometry(shapes, { depth: sashLength, bevelEnabled: false });
        if (mSs.angle === 45) {
          const pos = gSs.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const a = pos.getX(i), c = pos.getZ(i);
            if (Math.abs(c) < 1e-6) pos.setZ(i, a);
          }
          gSs.needsUpdate = true;
        }
        const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        rot.setPosition(sashFace, trackFloorY, trackOffsetZ);
        gSs.applyMatrix4(rot);
        gSs.computeVertexNormals();
        out.push({ key: "css", geo: gSs, m: mSs, isSash: true });
      }
    }

    return {
      members: out,
      cornerLength,
      sashLength,
      glassSize,
      trackOffsetZ,
      trackFloorY,
      sashFace,
    };
  }, [g, frameDepth]);

  const big = Math.max(W, H);
  const click = (p: Pick) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onPick(p);
  };

  const selectedPart = useMemo(() => {
    if (pick?.type !== "part") return null;
    const all = [...g.frame, ...g.sash, ...g.patti];
    return all.find((m) => m.partId === pick.id);
  }, [pick, g]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50 via-slate-100 to-stone-200 shadow-inner">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-2.5 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Mode Selector */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-white/90 p-1 shadow-sm backdrop-blur-md border border-stone-200/80">
          <button
            type="button"
            onClick={() => setMode("corner")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "corner"
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <span>📐</span> Corner Cutaway
          </button>
          <button
            type="button"
            onClick={() => setMode("full")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "full"
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <span>🪟</span> Full Window
          </button>
        </div>

        {/* Architectural Finish Swatches */}
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/90 px-2.5 py-1.5 shadow-sm backdrop-blur-md border border-stone-200/80">
          <span className="text-[11px] font-medium text-stone-500 mr-1 hidden sm:inline">Finish:</span>
          {FINISHES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFinish(f.id)}
              title={f.label}
              className={`relative h-5 w-5 rounded-full border transition transform hover:scale-110 ${
                finish === f.id
                  ? "ring-2 ring-stone-900 ring-offset-1 scale-105 border-white"
                  : "border-stone-300 opacity-80"
              }`}
              style={{ backgroundColor: f.dotColor }}
            />
          ))}
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={
          mode === "corner"
            ? { position: [230, 210, 270], fov: 34, near: 5, far: 2000 }
            : {
                position: [W * 0.5 + big * 0.55, H * 0.55 + big * 0.18, big * 1.45],
                fov: 38,
                near: 10,
                far: big * 20,
              }
        }
        style={{ height: 440 }}
        onPointerMissed={() => onPick(null)}
      >
        <StudioLight />
        <hemisphereLight args={["#ffffff", "#9aa3ad", 0.6]} />
        <directionalLight position={[-300, 450, 400]} intensity={1.7} />
        <directionalLight position={[400, 200, -200]} intensity={0.8} />
        <directionalLight position={[100, -200, 200]} intensity={0.3} />

        {mode === "corner" && cornerData && (
          <group position={[-50, -40, 20]}>
            {/* Extruded Profile Members */}
            {cornerData.members.map(({ key, geo, m }) => (
              <mesh
                key={key}
                geometry={geo}
                material={pick?.type === "part" && pick.id === m.partId ? pickedMat : metalMat}
                onClick={click({ type: "part", id: m.partId })}
              />
            ))}

            {/* Stainless Steel Track Rail (Patri) */}
            <mesh position={[cornerData.cornerLength / 2, cornerData.trackFloorY - 1, cornerData.trackOffsetZ]} material={steelMat}>
              <cylinderGeometry args={[2.5, 2.5, cornerData.cornerLength, 24]} />
              <primitive object={new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)} attach="quaternion" />
            </mesh>

            {/* DGU Outer Glass Pane */}
            <mesh
              position={[
                cornerData.sashFace + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2,
                cornerData.trackOffsetZ - 7,
              ]}
              material={glassMat}
            >
              <boxGeometry args={[cornerData.glassSize, cornerData.glassSize, 5]} />
            </mesh>

            {/* Warm-Edge Spacer Bar */}
            <mesh
              position={[
                cornerData.sashFace + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + 3,
                cornerData.trackOffsetZ,
              ]}
              material={spacerMat}
            >
              <boxGeometry args={[cornerData.glassSize, 6, 9]} />
            </mesh>
            <mesh
              position={[
                cornerData.sashFace + 13,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2,
                cornerData.trackOffsetZ,
              ]}
              material={spacerMat}
            >
              <boxGeometry args={[6, cornerData.glassSize, 9]} />
            </mesh>

            {/* DGU Inner Glass Pane */}
            <mesh
              position={[
                cornerData.sashFace + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2,
                cornerData.trackOffsetZ + 7,
              ]}
              material={glassMat}
            >
              <boxGeometry args={[cornerData.glassSize, cornerData.glassSize, 5]} />
            </mesh>

            {/* EPDM Rubber Wedge Gaskets */}
            <mesh
              position={[
                cornerData.sashFace + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace - 1,
                cornerData.trackOffsetZ - 10.5,
              ]}
              material={gasketMat}
            >
              <boxGeometry args={[cornerData.glassSize + 10, 4, 3]} />
            </mesh>
            <mesh
              position={[
                cornerData.sashFace + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace - 1,
                cornerData.trackOffsetZ + 10.5,
              ]}
              material={gasketMat}
            >
              <boxGeometry args={[cornerData.glassSize + 10, 4, 3]} />
            </mesh>

            <ContactShadows position={[120, -5, 0]} scale={420} blur={2.2} opacity={0.4} far={300} />
            <OrbitControls target={[95, 75, -20]} enablePan={true} minDistance={120} maxDistance={900} />
          </group>
        )}

        {mode === "full" && (
          <group>
            {fullItems.map(({ key, geo, m }) => (
              <mesh
                key={key}
                geometry={geo}
                material={pick?.type === "part" && pick.id === m.partId ? pickedMat : metalMat}
                onClick={click({ type: "part", id: m.partId })}
              />
            ))}
            {g.shutters.map((s) => {
              const center = g.casement
                ? 6
                : (-frameDepth * (s.track + 0.5)) / Math.max(1, tracks);
              const p = s.pane;
              return (
                <mesh
                  key={`g${s.index}`}
                  position={[p.x + p.w / 2, H - (p.y + p.h / 2), center]}
                  material={s.kind === "J" ? meshMat : glassMat}
                  onClick={click({ type: "shutter", index: s.index })}
                >
                  <boxGeometry args={[p.w + 10, p.h + 10, s.kind === "J" ? 1 : 5]} />
                </mesh>
              );
            })}
            <ContactShadows
              position={[W / 2, -2, -frameDepth / 2]}
              scale={big * 1.8}
              blur={2.4}
              opacity={0.35}
              far={big}
            />
            <OrbitControls
              target={[W / 2, H / 2, -frameDepth / 2]}
              enablePan={false}
              minDistance={big * 0.4}
              maxDistance={big * 4}
            />
          </group>
        )}
      </Canvas>

      {/* Bottom Floating Info / Status Badge */}
      <div className="absolute bottom-2.5 inset-x-3 pointer-events-none flex items-center justify-between gap-2">
        {selectedPart ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-stone-900/90 px-3 py-1.5 text-xs text-white shadow-md backdrop-blur-md border border-stone-700/60 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="font-semibold text-stone-100">{selectedPart.partId}</span>
            <span className="text-stone-400">|</span>
            <span className="text-stone-300">
              {selectedPart.face ? `${selectedPart.face} mm face` : "standard"}
              {selectedPart.depth ? ` × ${selectedPart.depth} mm depth` : ""}
            </span>
            <span className="text-stone-400">|</span>
            <span className="text-orange-300 font-medium">
              {selectedPart.angle === 45 ? "45° Mitre" : "90° Butt"}
            </span>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-stone-600 shadow-xs backdrop-blur-xs border border-stone-200/60">
            <span className="text-stone-400">ℹ️</span>
            <span>
              {mode === "corner"
                ? "360° Architectural Cutaway (Reynaers style) • Drag to turn • Scroll to zoom"
                : "Full window 3D • Tap any piece to inspect section"}
            </span>
          </div>
        )}
        <div className="text-[10px] font-mono text-stone-400 hidden sm:block bg-white/60 px-2 py-0.5 rounded backdrop-blur-xs border border-stone-200/40">
          {activeFinish.label}
        </div>
      </div>
    </div>
  );
}