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
import { useEffect, useMemo, useState, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import * as THREE from "three";
import type { Member, WindowGeo } from "../lib/studio/geometry";
import type { Pick } from "./studio-drawing";
import { buildCutaway } from "../lib/studio/cutaway";
import { CutawayScene, MeetingScene } from "./studio/cutaway-3d";
import { buildMeeting } from "../lib/studio/meeting";

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

/** camera [position, target] for the cutaway views (world mm, scene shifted by [-50, -35, -20]) */
const CUT_VIEWS: Record<"corner" | "sliding" | "cutface" | "meeting", [[number, number, number], [number, number, number]]> = {
  meeting: [[330, 620, 470], [80, 170, 35]],
  corner: [[640, 420, 600], [115, 70, 30]],
  sliding: [[600, 170, 430], [150, 15, 30]],
  cutface: [[620, 95, 210], [255, 5, 30]],
};

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
  const [mode, setMode] = useState<"corner" | "sliding" | "cutface" | "meeting" | "full">("corner");
  const [spin, setSpin] = useState(false);
  /** bumped on every view button, so the same view can be asked for again */
  const [viewAsk, setViewAsk] = useState(0);
  const [finish, setFinish] = useState<FinishId>("anthracite");
  const controlsRef = useRef<OrbitImpl>(null);

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
        // bare machined aluminium where the section is cut: bright, so the chambers read clearly
        color: "#e2e8f0",
        metalness: 0.75,
        roughness: 0.3,
        envMapIntensity: 1.6,
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

  // the chosen window laid out from its drawings (series, track, clip, each shutter's section)
  const cut = useMemo(() => (g.casement ? null : buildCutaway(g.section)), [g]);
  // where two shutters meet: the chosen slim interlocks, or the shutter with its interlock clip
  const meeting = useMemo(() => (cut ? buildMeeting(cut, g.section.meeting) : null), [cut, g]);
  const cutMats = useMemo(() => ({ coat: powderCoatMat, cut: cutFaceMat, picked: pickedMat, glass: glassMat, mesh: meshMat, rubber: gasketMat, steel: spacerMat }),
    [powderCoatMat, cutFaceMat, pickedMat, glassMat, meshMat, gasketMat, spacerMat]);

  // Architectural corner cutaway (fallback for Normal and casement)
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
  // stable look-at points, so a re-render never pulls a moved view back
  const cutTarget = useMemo(() => (cut ? CUT_VIEWS.corner[1] : [120, 85, 40]) as [number, number, number], [cut]);
  const fullTarget = useMemo(() => [W / 2, H / 2, -frameDepth / 2] as [number, number, number], [W, H, frameDepth]);
  const click = (p: Pick) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // a finger that moved was turning the window, not tapping a piece
    if (e.delta > 8) return;
    onPick(p);
  };

  const selectedPart = useMemo(() => {
    if (pick?.type !== "part") return null;
    const all = [...g.frame, ...g.sash, ...g.patti];
    return all.find((m) => m.partId === pick.id);
  }, [pick, g]);

  const setViewPreset = (nextMode: "corner" | "sliding" | "cutface" | "meeting" | "full") => {
    setMode(nextMode);
    setViewAsk((k) => k + 1);
  };
  /** Puts the camera where the view wants it; run by <ApplyView> inside the canvas, after the
   *  view's own controls exist. The full window is framed whole, whatever its size. */
  const placeView = (nextMode: typeof mode, aspect: number) => {
    if (!controlsRef.current) return;
    if (cut && nextMode !== "full") {
      // the cutaway of the chosen window: corner from above, the sill run, or straight into the cut
      const [p, t] = CUT_VIEWS[nextMode];
      controlsRef.current.object.position.set(...p);
      controlsRef.current.target.set(...t);
    } else if (nextMode === "corner") {
      controlsRef.current.object.position.set(310, 240, 260);
      controlsRef.current.target.set(120, 85, 40);
    } else if (nextMode === "sliding") {
      // Architectural sliding patio cutaway view (Reynaers CP 130 / ConceptPatio 45Pa)
      controlsRef.current.object.position.set(320, 160, 240);
      controlsRef.current.target.set(130, 65, 45);
    } else if (nextMode === "cutface") {
      // Direct view into the sliced extrusion cross-section chambers
      controlsRef.current.object.position.set(480, 75, 45);
      controlsRef.current.target.set(240, 65, 40);
    } else {
      // far enough that the whole window and a margin fit the canvas, both ways
      const cam = controlsRef.current.object as THREE.PerspectiveCamera;
      const half = Math.tan(((cam.fov ?? 34) * Math.PI) / 360);
      const dist = (Math.max(H, W / Math.max(0.3, aspect)) * 0.62) / half;
      controlsRef.current.target.set(W / 2, H / 2, -frameDepth / 2);
      controlsRef.current.object.position.set(W / 2 + dist * 0.26, H / 2 + dist * 0.12, -frameDepth / 2 + dist * 0.96);
    }
    controlsRef.current.object.up.set(0, 1, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200 bg-gradient-to-b from-stone-50 via-slate-100 to-stone-200 shadow-inner">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-2.5 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Mode Selector */}
        {/* five views do not fit a phone: the row scrolls sideways instead of cutting "Full Window" off */}
        <div className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-white/90 p-1 shadow-sm backdrop-blur-md border border-stone-200/80 [scrollbar-width:none] [&>button]:shrink-0">
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
            onClick={() => setViewPreset("sliding")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              mode === "sliding"
                ? "bg-stone-900 text-white shadow-xs"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
            }`}
          >
            <span>🏗️</span> Patio Cut
          </button>
          {meeting && (
            <button
              type="button"
              onClick={() => setViewPreset("meeting")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mode === "meeting" ? "bg-stone-900 text-white shadow-xs" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
              }`}
            >
              <span>🔗</span> Interlock
            </button>
          )}
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

        {/* Spin the whole model round, 360° */}
        <button
          type="button"
          onClick={() => setSpin(!spin)}
          className={`pointer-events-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm border ${spin ? "bg-stone-900 text-white border-stone-900" : "bg-white/90 text-stone-700 border-stone-200/80"}`}
          aria-pressed={spin}
        >
          ↻ 360°
        </button>

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
          position: cut ? CUT_VIEWS.corner[0] : [310, 240, 260],
          fov: 34,
          near: 5,
          // a big window seen whole sits several metres away
          far: 30000,
        }}
        style={{ height: 440, touchAction: "none" }}
        onPointerMissed={() => onPick(null)}
      >
        <StudioLight />
        <hemisphereLight args={["#ffffff", "#94a3b8", 0.65]} />
        <directionalLight position={[-250, 420, 380]} intensity={1.8} castShadow />
        <directionalLight position={[380, 180, -180]} intensity={0.9} />
        <directionalLight position={[80, -180, 180]} intensity={0.35} />

        {(mode === "corner" || mode === "sliding" || mode === "cutface" || mode === "meeting") && (cut || cornerData) && (
          <group position={[-50, -35, -20]}>
            {cut ? (
              mode === "meeting" && meeting ? (
                <group position={[130, 0, 0]}>
                  <MeetingScene cut={cut} meeting={meeting} g={g} mats={cutMats} pick={pick} onPick={onPick} />
                </group>
              ) : (
                <CutawayScene cut={cut} g={g} mats={cutMats} pick={pick} onPick={onPick} hideUprights={mode === "sliding"} />
              )
            ) : cornerData && (<>
            {/* Extruded Profile Members with Two-Tone Reynaers Cutaway Materials */}
            {cornerData.members.map(({ key, geo, edges, m }) => {
              if (mode === "sliding" && (key === "cfs" || key === "css")) return null;
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
            <mesh position={[cornerData.cornerLength / 2, cornerData.trackFloorY, cornerData.trackCenterZ]} rotation={[0, 0, Math.PI / 2]} material={steelMat}>
              <cylinderGeometry args={[2.2, 2.2, cornerData.cornerLength, 24]} />
            </mesh>

            {/* Brass / Nylon Tandem Roller Wheels inside bottom sash roller pocket */}
            <mesh position={[cornerData.sashStartX + 45, cornerData.trackFloorY + 1.2, cornerData.trackCenterZ]} rotation={[Math.PI / 2, 0, 0]} material={steelMat}>
              <cylinderGeometry args={[7, 7, 6, 24]} />
            </mesh>
            <mesh position={[cornerData.sashLength - 45, cornerData.trackFloorY + 1.2, cornerData.trackCenterZ]} rotation={[Math.PI / 2, 0, 0]} material={steelMat}>
              <cylinderGeometry args={[7, 7, 6, 24]} />
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

            </>)}

            {/* Ground Contact Shadow */}
            <ContactShadows position={[140, -1, (cut ? cut.trackW : cornerData?.fDepth ?? 60) / 2]} scale={440} blur={2.4} opacity={0.45} far={320} />
            <OrbitControls
              ref={controlsRef}
              target={cutTarget}
              rotateSpeed={0.75}
              zoomSpeed={1}
              panSpeed={0.8}
              enableDamping
              dampingFactor={0.12}
              screenSpacePanning
              minDistance={40}
              maxDistance={1400}
            />
            <Spin on={spin} controls={controlsRef} />
            <ApplyView ask={viewAsk} place={(a) => placeView(mode, a)} />
          </group>
        )}

        {mode === "full" && (
          <group>
            {fullItems.filter(({ m }) => m.shutter == null || !g.sash.includes(m)).map(({ key, geo, m }) => (
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
              // sliding: along its track, as far as the frame lets it — a tap sends it away from its
              // handle side; casement: on its hinges, outwards
              const margin = W * 0.03;
              const lo = margin - s.x, hi = W - s.w - margin - s.x;
              const away = s.lockSide === "left" ? 1 : -1;
              const reach = (d: number) => Math.min(Math.max(d * s.w * 0.8, lo), hi);
              const slide = Math.abs(reach(away)) > s.w * 0.25 ? reach(away) : reach(-away);
              return (
                <MovableShutter key={`sh${s.index}-${W}-${H}`} onHold={(h) => { if (controlsRef.current) controlsRef.current.enabled = !h; }} planeZ={center}
                  slide={g.casement ? undefined : { full: slide, lo, hi }}
                  swing={g.casement ? { x: s.hinge === "right" ? s.x + s.w : s.x, z: center + 30, dir: s.hinge === "right" ? 1 : -1, width: s.w } : undefined}>
                  {fullItems.filter(({ m }) => m.shutter === s.index && g.sash.includes(m)).map(({ key, geo }) => (
                    <mesh key={key} geometry={geo} material={powderCoatMat} />
                  ))}
                  <mesh
                    position={[p.x + p.w / 2, H - (p.y + p.h / 2), center]}
                    material={s.kind === "J" ? meshMat : glassMat}
                  >
                    <boxGeometry args={[p.w + 10, p.h + 10, s.kind === "J" ? 1 : 5]} />
                  </mesh>
                </MovableShutter>
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
              target={fullTarget}
              rotateSpeed={0.75}
              zoomSpeed={1}
              panSpeed={0.8}
              enableDamping
              dampingFactor={0.12}
              screenSpacePanning
              minDistance={big * 0.15}
              maxDistance={big * 5}
            />
            <Spin on={spin} controls={controlsRef} />
            <ApplyView ask={viewAsk} place={(a) => placeView("full", a)} />
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
                ? "Drag to turn any way • Right-drag or two fingers to move • Scroll or pinch to zoom"
                : mode === "meeting"
                ? (meeting?.kind === "slim" ? "Where the shutters meet • the chosen slim interlocks hooked" : "Where the shutters meet • shutter with its interlock clip")
                : mode === "sliding"
                ? "Patio cutaway • Sill track, runner rail, rollers & double glazing"
                : mode === "cutface"
                ? "Cutface Inspection: Exposed internal extrusion chambers & hollows"
                : g.casement ? "Tap a shutter to open it, or pull it open with a finger" : "Tap a shutter to slide it, or drag it where you want"}
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

/**
 * A shutter of the full window (founder 2026-11-23, Vaibhav ji's idea): a tap slides it open along
 * its track (or swings a casement open), a second tap closes it; a finger on it drags it anywhere
 * the frame lets it go. While a shutter is held, the view does not turn.
 */
function MovableShutter({ onHold, planeZ, slide, swing, children }: {
  /** a shutter is being held: the view must not turn meanwhile */
  onHold: (held: boolean) => void;
  /** the depth the shutter moves in, to read the finger's position on */
  planeZ: number;
  slide?: { full: number; lo: number; hi: number };
  swing?: { x: number; z: number; dir: 1 | -1; width: number };
  children: React.ReactNode;
}) {
  const outer = useRef<THREE.Group>(null);
  /** where the shutter is going: a slide in mm, or a swing angle */
  const goal = useRef(0);
  const MAX_SWING = 1.35;
  const held = useRef<{ x: number; from: number; px: number; py: number; moved: boolean } | null>(null);
  useFrame((_, dt) => {
    const o = outer.current;
    if (!o) return;
    // a held shutter follows the finger closely; a tapped one eases there
    const k = 1 - Math.exp(-dt * (held.current ? 24 : 6));
    if (swing) o.rotation.y += (goal.current * swing.dir - o.rotation.y) * k;
    else o.position.x += (goal.current - o.position.x) * k;
  });
  const xOn = (e: ThreeEvent<PointerEvent>) => {
    const r = e.ray, d = r.direction.z;
    return Math.abs(d) < 1e-6 ? e.point.x : r.origin.x + ((planeZ - r.origin.z) / d) * r.direction.x;
  };
  const down = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    onHold(true);
    held.current = { x: xOn(e), from: goal.current, px: e.nativeEvent.clientX, py: e.nativeEvent.clientY, moved: false };
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    const h = held.current;
    if (!h) return;
    e.stopPropagation();
    if (Math.hypot(e.nativeEvent.clientX - h.px, e.nativeEvent.clientY - h.py) > 8) h.moved = true;
    if (!h.moved) return;
    const dx = xOn(e) - h.x;
    if (slide) goal.current = Math.min(Math.max(h.from + dx, slide.lo), slide.hi);
    // a swing opens as far as the finger pulls the free edge across
    else if (swing) goal.current = Math.min(Math.max(h.from + (-swing.dir * dx) / (swing.width * 0.6), 0), MAX_SWING);
  };
  const up = (e: ThreeEvent<PointerEvent>) => {
    const h = held.current;
    if (!h) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    onHold(false);
    held.current = null;
    if (h.moved) return;
    // a tap: open fully, or close what is open
    const opened = slide ? Math.abs(goal.current) > 1 : goal.current > 0.05;
    goal.current = opened ? 0 : slide ? slide.full : MAX_SWING * 0.9;
  };
  const handlers = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up,
    onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation() };
  // a swing turns about the hinge line, so the group sits on it and its pieces sit back
  return swing ? (
    <group ref={outer} position={[swing.x, 0, swing.z]} {...handlers}>
      <group position={[-swing.x, 0, -swing.z]}>{children}</group>
    </group>
  ) : (
    <group ref={outer} {...handlers}>{children}</group>
  );
}

/** Sets the view's camera when the view is opened (and when it is asked for again). */
function ApplyView({ ask, place }: { ask: number; place: (aspect: number) => void }) {
  const size = useThree((st) => st.size);
  const run = useRef(place);
  useEffect(() => { run.current = place; });
  useEffect(() => {
    if (ask === 0) return;
    run.current(size.width / Math.max(1, size.height));
    // only when a view is asked for, not on every resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);
  return null;
}

/** Turns the camera slowly round the model while 360° is on (the shop can still drag, move and zoom). */
function Spin({ on, controls }: { on: boolean; controls: RefObject<OrbitImpl | null> }) {
  useFrame((_, dt) => {
    const c = controls.current; if (!on || !c) return;
    const cam = c.object, off = cam.position.clone().sub(c.target);
    off.applyAxisAngle(cam.up.clone().normalize(), dt * 0.5);
    cam.position.copy(c.target).add(off); cam.lookAt(c.target);
  });
  return null;
}
