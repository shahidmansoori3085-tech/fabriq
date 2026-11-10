"use client";
/**
 * The window in 3D, built from the real traced sections: every piece is its
 * catalogue section pushed along its cut length, mitred at 45° where the
 * system says so, in anodised aluminium. Turn it with a finger.
 */
import { useEffect, useMemo } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { Member, WindowGeo } from "../lib/studio/geometry";
import type { Pick } from "./studio-drawing";

type V2 = [number, number];

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

/** The member's section in (a = across the face from its outer edge, b = depth) as THREE shapes with holes. */
function sectionShapes(m: Member): THREE.Shape[] {
  const role = m.place.startsWith("frame") ? "frame" : "sash";
  let loops: V2[][];
  if (m.shape) {
    const { w, h } = m.shape;
    loops = loopsOf(m.shape.paths).map((l) => l.map(([x, y]): V2 => {
      if (role === "frame") return [m.flip ? y : h - y, x];
      return [m.flip ? w - x : x, y];
    }));
  } else {
    const f = m.face ?? 40, d = m.depth ?? 40, t = Math.min(1.6, f / 8);
    loops = [[[0, 0], [f, 0], [f, d], [0, d]], [[t, t], [t, d - t], [f - t, d - t], [f - t, t]]];
  }
  // nesting: even depth = metal outline, odd = hole of the loop that holds it
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

/** Extrude a member along its length, mitre its ends, and place it in the window (mm, y up). */
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

export default function Window3D({ g, pick, onPick, tracks }: { g: WindowGeo; pick: Pick; onPick: (p: Pick) => void; tracks: number }) {
  const { W, H } = g;
  const frameDepth = Math.max(40, ...g.frame.map((m) => m.depth ?? 0));
  const items = useMemo(() => {
    const out: { key: string; geo: THREE.BufferGeometry; m: Member }[] = [];
    g.frame.forEach((m, i) => { const geo = memberGeometry(m, H, 0); if (geo) out.push({ key: `f${i}`, geo, m }); });
    g.sash.forEach((m, i) => {
      const s = g.shutters[m.shutter ?? 0];
      const center = g.casement ? (m.depth ?? 28) * 0.35 : -frameDepth * ((s?.track ?? 0) + 0.5) / Math.max(1, tracks);
      const geo = memberGeometry(m, H, center + (m.depth ?? 28) / 2);
      if (geo) out.push({ key: `s${i}`, geo, m });
    });
    return out;
  }, [g, H, frameDepth, tracks]);

  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4d9df", metalness: 0.85, roughness: 0.3, envMapIntensity: 1.1, side: THREE.DoubleSide }), []);
  const picked = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f08a4b", metalness: 0.4, roughness: 0.4, emissive: "#e8590c", emissiveIntensity: 0.35, side: THREE.DoubleSide }), []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a9cdef", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide }), []);
  const mesh = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6b7280", transparent: true, opacity: 0.45, side: THREE.DoubleSide }), []);

  const big = Math.max(W, H);
  const click = (p: Pick) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(p); };

  return (
    <Canvas shadows camera={{ position: [W * 0.5 + big * 0.55, H * 0.55 + big * 0.18, big * 1.45], fov: 38, near: 10, far: big * 20 }}
      style={{ height: 380, background: "linear-gradient(#f4f6f9, #e3e7ec)", borderRadius: 12 }} onPointerMissed={() => onPick(null)}>
      <StudioLight />
      <hemisphereLight args={["#ffffff", "#9aa3ad", 0.5]} />
      <directionalLight position={[-big, big * 1.5, big * 1.2]} intensity={1.6} />
      <directionalLight position={[big * 1.2, big * 0.4, -big]} intensity={0.5} />
      {items.map(({ key, geo, m }) => (
        <mesh key={key} geometry={geo} material={pick?.type === "part" && pick.id === m.partId ? picked : metal}
          onClick={click({ type: "part", id: m.partId })} />
      ))}
      {g.shutters.map((s) => {
        const center = g.casement ? 6 : -frameDepth * (s.track + 0.5) / Math.max(1, tracks);
        const p = s.pane;
        return (
          <mesh key={`g${s.index}`} position={[p.x + p.w / 2, H - (p.y + p.h / 2), center]} material={s.kind === "J" ? mesh : glass}
            onClick={click({ type: "shutter", index: s.index })}>
            <boxGeometry args={[p.w + 10, p.h + 10, s.kind === "J" ? 1 : 5]} />
          </mesh>
        );
      })}
      <ContactShadows position={[W / 2, -2, -frameDepth / 2]} scale={big * 1.8} blur={2.4} opacity={0.35} far={big} />
      <OrbitControls target={[W / 2, H / 2, -frameDepth / 2]} enablePan={false} minDistance={big * 0.4} maxDistance={big * 4} />
    </Canvas>
  );
}
