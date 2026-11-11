"use client";
/**
 * Photorealistic Architectural 3D Viewer for Aluminum Window Systems.
 * Engineered to match the Reynaers / Crystal Windows technical cutaway renders:
 *   1. 360° Architectural Corner Cutaway:
 *      - True multi-chamber hollow extrusions with exposed cut faces
 *      - Two-tone PBR materials: powder-coated outer walls + machined metallic cutfaces
 *      - Razor-sharp architectural silhouette outlines (EdgesGeometry)
 *      - DGU Insulated Double Glazing (outer pane, 12mm cavity, spacer bar, inner pane)
 *      - EPDM rubber wedge gaskets & weatherseals
 *      - Stainless steel runner rail (SS patri) & tandem roller wheels
 *   2. Cutface Zoom View: Instant close-up inspection of internal die chambers
 *   3. Full Window 3D Assembly with movable shutters and dimension scale
 *   4. Architectural Finishes: Anthracite Grey (RAL 7016), Matt Noir (9005),
 *      Silver Anodised (EV1), Champagne Bronze, and Traffic White (9016).
 */
import { useEffect, useMemo, useState, useRef } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { Member, WindowGeo } from "../lib/studio/geometry";
import type { Pick } from "./studio-drawing";

type V2 = [number, number];

export type FinishId = "anthracite" | "black" | "silver" | "champagne" | "white";

interface FinishDef {
  id: FinishId;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  dotColor: string;
}

const FINISHES: FinishDef[] = [
  { id: "anthracite", label: "Anthracite Grey (RAL 7016)", color: "#374151", metalness: 0.65, roughness: 0.38, dotColor: "#374151" },
  { id: "black", label: "Matt Noir (RAL 9005)", color: "#1f242d", metalness: 0.55, roughness: 0.42, dotColor: "#1f242d" },
  { id: "silver", label: "Silver Anodised (EV1)", color: "#d1d5db", metalness: 0.88, roughness: 0.22, dotColor: "#d1d5db" },
  { id: "champagne", label: "Champagne Bronze", color: "#786b59", metalness: 0.78, roughness: 0.28, dotColor: "#786b59" },
  { id: "white", label: "Traffic White (RAL 9016)", color: "#f8fafc", metalness: 0.25, roughness: 0.45, dotColor: "#f1f5f9" },
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

/** Converts SVG path loops into THREE.Shape objects with interior hollow holes. */
function buildHollowShapes(loops: V2[][]): THREE.Shape[] {
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

/** Full window member section shape (for full window assembly). */
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
    const f = m.face ?? (role === "frame" ? 45 : 55);
    const d = m.depth ?? (role === "frame" ? 65 : 30);
    const t = 1.8;
    loops = [
      [[0, 0], [f, 0], [f, d], [0, d]],
      [[t, t], [t, d - t], [f * 0.45, d - t], [f * 0.45, t]],
      [[f * 0.55, t], [f * 0.55, d - t], [f - t, d - t], [f - t, t]],
    ];
  }
  return buildHollowShapes(loops);
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

/** Soft studio reflections generated in memory — zero network roundtrips. */
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
  const [mode, setMode] = useState<"corner" | "cutface" | "full">("corner");
  const [finish, setFinish] = useState<FinishId>("anthracite");
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const { W, H } = g;
  const frameDepth = Math.max(45, ...g.frame.map((m) => m.depth ?? 0));
  const activeFinish = FINISHES.find((f) => f.id === finish) ?? FINISHES[0];

  // PBR Powder-Coat Material (Extruded outer walls)
  const powderCoatMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: activeFinish.color,
        metalness: activeFinish.metalness,
        roughness: activeFinish.roughness,
        envMapIntensity: 1.3,
        side: THREE.DoubleSide,
      }),
    [activeFinish]
  );

  // Machined Cut Face Material (Reynaers metallic cutaway slice)
  const cutFaceMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#94a3b8",
        metalness: 0.88,
        roughness: 0.22,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Picked Highlight Material
  const pickedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ea580c",
        metalness: 0.45,
        roughness: 0.35,
        emissive: "#c2410c",
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
      }),
    []
  );

  // EPDM Black Rubber Wedge Gasket
  const gasketMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#181a1f",
        metalness: 0.05,
        roughness: 0.94,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Polished Stainless Steel Track Rail (SS Patri) & Rollers
  const steelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        metalness: 0.98,
        roughness: 0.12,
        envMapIntensity: 1.8,
      }),
    []
  );

  // Architectural DGU Glass Material (Double Glazed)
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#a5c9eb",
        metalness: 0.08,
        roughness: 0.04,
        transmission: 0.92,
        transparent: true,
        opacity: 0.38,
        ior: 1.52,
        envMapIntensity: 1.4,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Warm-Edge Insulating Spacer Bar
  const spacerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#1e242b",
        metalness: 0.65,
        roughness: 0.45,
      }),
    []
  );

  // Mesh Screen Material
  const meshMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#374151",
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Full Window Assembly Geometries
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

  // Architectural Corner Cutaway (Reynaers / Crystal Windows Style)
  const cornerData = useMemo(() => {
    const mFb = g.frame.find((m) => m.place === "frame-bottom") ?? g.frame[0];
    const mFs = g.frame.find((m) => m.place === "frame-left") ?? g.frame[1];
    const mSb = g.sash.find((m) => m.place === "sash-bottom") ?? g.sash[0];
    const mSs =
      g.sash.find((m) => m.place === "sash-lock" || m.place === "sash-meet") ??
      g.sash[1];

    if (!mFb && !mFs) return null;

    const cornerLength = 280; // mm length of bottom track sill cutaway
    const jambHeight = 280; // mm height of vertical jamb cutaway
    const sashLength = 220; // mm length of bottom sash rail
    const sashHeight = 220; // mm height of vertical sash stile
    const glassSize = 190; // mm visible glass square

    const out: { key: string; geo: THREE.BufferGeometry; edges: THREE.BufferGeometry; m: Member }[] = [];

    // Frame Depth & Bottom Track Height
    const fDepth = mFb?.shape ? mFb.shape.w : (mFb?.depth ?? 62);
    const fHeight = mFb?.shape ? mFb.shape.h : (mFb?.face ?? 32);

    // 1. Frame Bottom Track (Sill) Extrusion along +X axis
    if (mFb) {
      let loops: V2[][];
      if (mFb.shape && mFb.shape.paths && mFb.shape.paths.length) {
        const { w, h } = mFb.shape;
        loops = loopsOf(mFb.shape.paths).map((l) => l.map(([x, y]): V2 => [x, h - y]));
      } else {
        const t = 1.8;
        loops = [
          [[0, 0], [fDepth, 0], [fDepth, fHeight], [0, fHeight]],
          [[t, t], [t, fHeight - t], [fDepth * 0.45, fHeight - t], [fDepth * 0.45, t]],
          [[fDepth * 0.55, t], [fDepth * 0.55, fHeight - t], [fDepth - t, fHeight - t], [fDepth - t, t]],
        ];
      }
      const shapes = buildHollowShapes(loops);
      if (shapes.length) {
        const gFb = new THREE.ExtrudeGeometry(shapes, { depth: cornerLength, bevelEnabled: false });
        // Transform: local X(depth) -> world Z, local Y(height) -> world Y, local Z(length) -> world X
        // Basis: A=(0,0,1), B=(0,1,0), C=(1,0,0) with det = +1
        const basis = new THREE.Matrix4().set(
          0, 0, 1, 0,
          0, 1, 0, 0,
          1, 0, 0, 0,
          0, 0, 0, 1
        );
        if (mFb.angle === 45) {
          const pos = gFb.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            const x = pos.getX(i);
            if (Math.abs(z) < 1e-4) {
              // Mitre 45° across the corner at origin
              pos.setZ(i, (x / fDepth) * fHeight);
            }
          }
          pos.needsUpdate = true;
        }
        gFb.applyMatrix4(basis);
        gFb.computeVertexNormals();
        const edges = new THREE.EdgesGeometry(gFb, 24);
        out.push({ key: "cfb", geo: gFb, edges, m: mFb });
      }
    }

    // 2. Frame Vertical Jamb Extrusion rising along +Y axis
    if (mFs) {
      let loops: V2[][];
      const jambFace = mFs.shape ? mFs.shape.h : (mFs.face ?? 32);
      if (mFs.shape && mFs.shape.paths && mFs.shape.paths.length) {
        const { w, h } = mFs.shape;
        loops = loopsOf(mFs.shape.paths).map((l) => l.map(([x, y]): V2 => [x, h - y]));
      } else {
        const t = 1.8;
        loops = [
          [[0, 0], [fDepth, 0], [fDepth, jambFace], [0, jambFace]],
          [[t, t], [t, jambFace - t], [fDepth * 0.45, jambFace - t], [fDepth * 0.45, t]],
          [[fDepth * 0.55, t], [fDepth * 0.55, jambFace - t], [fDepth - t, jambFace - t], [fDepth - t, t]],
        ];
      }
      const shapes = buildHollowShapes(loops);
      if (shapes.length) {
        const gFs = new THREE.ExtrudeGeometry(shapes, { depth: jambHeight, bevelEnabled: false });
        // Transform: local X(depth) -> world Z, local Y(face) -> world X, local Z(length) -> world Y
        const basis = new THREE.Matrix4().set(
          0, 1, 0, 0,
          0, 0, 1, 0,
          1, 0, 0, 0,
          0, 0, 0, 1
        );
        if (mFs.angle === 45) {
          const pos = gFs.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i++) {
            const z = pos.getZ(i);
            const y = pos.getY(i);
            if (Math.abs(z) < 1e-4) {
              pos.setZ(i, y);
            }
          }
          pos.needsUpdate = true;
        } else {
          // Butt joint: vertical jamb sits directly on top of the bottom sill
          basis.setPosition(0, fHeight, 0);
        }
        gFs.applyMatrix4(basis);
        gFs.computeVertexNormals();
        const edges = new THREE.EdgesGeometry(gFs, 24);
        out.push({ key: "cfs", geo: gFs, edges, m: mFs });
      }
    }

    // 3. Sash Bottom Rail Extrusion along +X axis (sitting on Track 1)
    const trackCenterZ = fDepth * 0.32;
    const trackFloorY = fHeight * 0.55;
    const sashFace = mSb?.shape ? mSb.shape.w : (mSb?.face ?? 55);
    const sashThickness = mSb?.shape ? mSb.shape.h : (mSb?.depth ?? 28);
    const sashStartX = Math.max(36, (mFs?.face ?? 32) + 2);

    if (mSb) {
      let loops: V2[][];
      if (mSb.shape && mSb.shape.paths && mSb.shape.paths.length) {
        const { w, h } = mSb.shape;
        loops = loopsOf(mSb.shape.paths).map((l) => l.map(([x, y]): V2 => [h > w ? w - x : h - y, h > w ? y : x]));
      } else {
        const t = 1.6;
        loops = [
          [[0, 0], [sashThickness, 0], [sashThickness, sashFace], [0, sashFace]],
          [[t, t], [t, sashFace * 0.4], [sashThickness - t, sashFace * 0.4], [sashThickness - t, t]],
          [[t, sashFace * 0.48], [t, sashFace - t], [sashThickness - t, sashFace - t], [sashThickness - t, sashFace * 0.48]],
        ];
      }
      const shapes = buildHollowShapes(loops);
      if (shapes.length) {
        const gSb = new THREE.ExtrudeGeometry(shapes, { depth: sashLength - sashStartX, bevelEnabled: false });
        const basis = new THREE.Matrix4().set(
          0, 0, 1, sashStartX,
          0, 1, 0, trackFloorY + 2,
          1, 0, 0, trackCenterZ - sashThickness / 2,
          0, 0, 0, 1
        );
        gSb.applyMatrix4(basis);
        gSb.computeVertexNormals();
        const edges = new THREE.EdgesGeometry(gSb, 24);
        out.push({ key: "csb", geo: gSb, edges, m: mSb });
      }
    }

    // 4. Sash Vertical Stile (Handle Stile or Slim Interlock)
    if (mSs) {
      let loops: V2[][];
      const stileFace = mSs.shape ? mSs.shape.w : (mSs.face ?? 40);
      const stileThickness = mSs.shape ? mSs.shape.h : (mSs.depth ?? 28);
      if (mSs.shape && mSs.shape.paths && mSs.shape.paths.length) {
        const { w, h } = mSs.shape;
        loops = loopsOf(mSs.shape.paths).map((l) => l.map(([x, y]): V2 => [h > w ? w - x : h - y, h > w ? y : x]));
      } else {
        const t = 1.6;
        loops = [
          [[0, 0], [stileThickness, 0], [stileThickness, stileFace], [0, stileFace]],
          [[t, t], [t, stileFace - t], [stileThickness - t, stileFace - t], [stileThickness - t, t]],
        ];
      }
      const shapes = buildHollowShapes(loops);
      if (shapes.length) {
        const gSs = new THREE.ExtrudeGeometry(shapes, { depth: sashHeight - (trackFloorY + sashFace), bevelEnabled: false });
        const basis = new THREE.Matrix4().set(
          0, 1, 0, sashStartX,
          0, 0, 1, trackFloorY + sashFace + 2,
          1, 0, 0, trackCenterZ - stileThickness / 2,
          0, 0, 0, 1
        );
        gSs.applyMatrix4(basis);
        gSs.computeVertexNormals();
        const edges = new THREE.EdgesGeometry(gSs, 24);
        out.push({ key: "css", geo: gSs, edges, m: mSs });
      }
    }

    return {
      members: out,
      cornerLength,
      jambHeight,
      sashLength,
      sashHeight,
      glassSize,
      fDepth,
      fHeight,
      trackCenterZ,
      trackFloorY,
      sashFace,
      sashStartX,
      sashThickness,
    };
  }, [g]);

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

  const setViewPreset = (nextMode: "corner" | "cutface" | "full") => {
    setMode(nextMode);
    if (!controlsRef.current) return;
    if (nextMode === "corner") {
      controlsRef.current.object.position.set(310, 240, 260);
      controlsRef.current.target.set(120, 85, 40);
    } else if (nextMode === "cutface") {
      // Direct view into the sliced extrusion cross-section chambers
      controlsRef.current.object.position.set(480, 75, 45);
      controlsRef.current.target.set(240, 65, 40);
    } else {
      controlsRef.current.object.position.set(W * 0.5 + big * 0.55, H * 0.55 + big * 0.18, big * 1.45);
      controlsRef.current.target.set(W / 2, H / 2, -frameDepth / 2);
    }
    controlsRef.current.update();
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50 via-slate-100 to-stone-200 shadow-inner">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-2.5 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Mode Selector */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg bg-white/90 p-1 shadow-sm backdrop-blur-md border border-stone-200/80">
          <button
            type="button"
            onClick={() => setViewPreset("corner")}
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
            onClick={() => setViewPreset("cutface")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "cutface"
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <span>🔍</span> Profile Cut
          </button>
          <button
            type="button"
            onClick={() => setViewPreset("full")}
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
        camera={{
          position: [310, 240, 260],
          fov: 34,
          near: 5,
          far: 3000,
        }}
        style={{ height: 440 }}
        onPointerMissed={() => onPick(null)}
      >
        <StudioLight />
        <hemisphereLight args={["#ffffff", "#94a3b8", 0.65]} />
        <directionalLight position={[-250, 420, 380]} intensity={1.8} castShadow />
        <directionalLight position={[380, 180, -180]} intensity={0.9} />
        <directionalLight position={[80, -180, 180]} intensity={0.35} />

        {(mode === "corner" || mode === "cutface") && cornerData && (
          <group position={[-50, -35, -20]}>
            {/* Extruded Profile Members with Two-Tone Reynaers Cutaway Materials */}
            {cornerData.members.map(({ key, geo, edges, m }) => {
              const isPicked = pick?.type === "part" && pick.id === m.partId;
              const mats = isPicked ? [pickedMat, pickedMat] : [cutFaceMat, powderCoatMat];
              return (
                <group key={key} onClick={click({ type: "part", id: m.partId })}>
                  {/* Hollow 3D Extrusion */}
                  <mesh geometry={geo} material={mats} castShadow receiveShadow />
                  {/* Sharp Architectural Silhouette Edges */}
                  <lineSegments geometry={edges}>
                    <lineBasicMaterial color="#111827" transparent opacity={0.65} />
                  </lineSegments>
                </group>
              );
            })}

            {/* Stainless Steel Track Rail (SS Patri) along bottom frame */}
            <mesh position={[cornerData.cornerLength / 2, cornerData.trackFloorY, cornerData.trackCenterZ]} material={steelMat}>
              <cylinderGeometry args={[2.2, 2.2, cornerData.cornerLength, 24]} />
              <primitive object={new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)} attach="quaternion" />
            </mesh>

            {/* Brass / Nylon Tandem Roller Wheels inside bottom sash roller pocket */}
            <mesh position={[cornerData.sashStartX + 45, cornerData.trackFloorY + 1.2, cornerData.trackCenterZ]} material={steelMat}>
              <cylinderGeometry args={[7, 7, 6, 24]} />
              <primitive object={new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)} attach="quaternion" />
            </mesh>
            <mesh position={[cornerData.sashLength - 45, cornerData.trackFloorY + 1.2, cornerData.trackCenterZ]} material={steelMat}>
              <cylinderGeometry args={[7, 7, 6, 24]} />
              <primitive object={new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)} attach="quaternion" />
            </mesh>

            {/* DGU Outer Glass Pane (4mm) */}
            <mesh
              position={[
                cornerData.sashStartX + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2 - 8,
                cornerData.trackCenterZ - 6.5,
              ]}
              material={glassMat}
            >
              <boxGeometry args={[cornerData.glassSize, cornerData.glassSize, 4]} />
            </mesh>

            {/* Warm-Edge Insulating Spacer Bar (Bottom & Left) */}
            <mesh
              position={[
                cornerData.sashStartX + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + 3,
                cornerData.trackCenterZ,
              ]}
              material={spacerMat}
            >
              <boxGeometry args={[cornerData.glassSize, 6, 9]} />
            </mesh>
            <mesh
              position={[
                cornerData.sashStartX + 14,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2,
                cornerData.trackCenterZ,
              ]}
              material={spacerMat}
            >
              <boxGeometry args={[6, cornerData.glassSize, 9]} />
            </mesh>

            {/* DGU Inner Glass Pane (4mm) */}
            <mesh
              position={[
                cornerData.sashStartX + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace + cornerData.glassSize / 2 - 8,
                cornerData.trackCenterZ + 6.5,
              ]}
              material={glassMat}
            >
              <boxGeometry args={[cornerData.glassSize, cornerData.glassSize, 4]} />
            </mesh>

            {/* Black EPDM Rubber Wedge Gaskets */}
            <mesh
              position={[
                cornerData.sashStartX + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace,
                cornerData.trackCenterZ - 9.5,
              ]}
              material={gasketMat}
            >
              <boxGeometry args={[cornerData.glassSize + 12, 4.5, 2.5]} />
            </mesh>
            <mesh
              position={[
                cornerData.sashStartX + cornerData.glassSize / 2 + 10,
                cornerData.trackFloorY + cornerData.sashFace,
                cornerData.trackCenterZ + 9.5,
              ]}
              material={gasketMat}
            >
              <boxGeometry args={[cornerData.glassSize + 12, 4.5, 2.5]} />
            </mesh>

            {/* Ground Contact Shadow */}
            <ContactShadows position={[140, -1, cornerData.fDepth / 2]} scale={440} blur={2.4} opacity={0.45} far={320} />
            <OrbitControls
              ref={controlsRef}
              target={[120, 85, 40]}
              enablePan={true}
              minDistance={90}
              maxDistance={1100}
            />
          </group>
        )}

        {mode === "full" && (
          <group>
            {fullItems.map(({ key, geo, m }) => (
              <mesh
                key={key}
                geometry={geo}
                material={pick?.type === "part" && pick.id === m.partId ? pickedMat : powderCoatMat}
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
              ref={controlsRef}
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
              {selectedPart.angle === 45 ? "45° Mitre Joint" : "90° Butt Joint"}
            </span>
          </div>
        ) : (
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1 text-[11px] text-stone-600 shadow-xs backdrop-blur-xs border border-stone-200/60">
            <span className="text-stone-400">ℹ️</span>
            <span>
              {mode === "corner"
                ? "360° Architectural Cutaway (Reynaers style) • Drag to turn • Scroll to zoom"
                : mode === "cutface"
                ? "Cutface Inspection: Exposed internal extrusion chambers & hollows"
                : "Full window 3D • Tap any piece to inspect section"}
            </span>
          </div>
        )}
        <div className="text-[10px] font-mono text-stone-500 hidden sm:block bg-white/80 px-2 py-0.5 rounded backdrop-blur-xs border border-stone-200/50">
          {activeFinish.label}
        </div>
      </div>
    </div>
  );
}
