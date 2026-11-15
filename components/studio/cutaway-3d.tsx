"use client";
/**
 * Corner cutaway of the chosen sliding window, in the style of a system maker's
 * product render: the real sections (traced from the catalogue) extruded and cut,
 * the bottom track and side jamb meeting at the frame's own joint (45° or 90°),
 * the track clip in every lane, the first shutter standing on its lane with its own
 * bottom section and upright mitred at 45°, its glass in the pocket with glazing
 * rubber, and the roller on the clip. Laid out by lib/studio/cutaway.ts — the same
 * engine that checks every system against its drawings.
 */
import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { solidOf, place, bounds, type Solid } from "../../lib/studio/assemble";
import type { Cutaway } from "../../lib/studio/cutaway";
import { MEET_RUN, type Meeting } from "../../lib/studio/meeting";
import type { WindowGeo } from "../../lib/studio/geometry";
import type { Pick } from "../studio-drawing";

type V2 = [number, number];

/** sill run and upright height of the cutaway, mm */
export const CUT_L = 320;
export const CUT_H = 300;

const area = (l: V2[]) => l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function inside(pt: V2, l: V2[]) {
  let c = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i], [xj, yj] = l[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** loops → outer shapes with their hollow chambers as holes */
function shapesOf(loops: V2[][]): THREE.Shape[] {
  const info = loops.filter((l) => l.length > 2 && Math.abs(area(l)) > 0.05).map((l) => ({ l, a: Math.abs(area(l)) })).sort((x, y) => y.a - x.a);
  const out: { s: THREE.Shape; l: V2[] }[] = [];
  for (const { l, a } of info) {
    const depth = info.filter((x) => x.a > a && inside(l[0], x.l)).length;
    const host = out.filter((x) => inside(l[0], x.l)).at(-1);
    if (depth % 2 === 1 && host) host.s.holes.push(new THREE.Path((area(l) > 0 ? [...l].reverse() : l).map(([x, y]) => new THREE.Vector2(x, y))));
    else out.push({ s: new THREE.Shape((area(l) < 0 ? [...l].reverse() : l).map(([x, y]) => new THREE.Vector2(x, y))), l });
  }
  return out.map((x) => x.s);
}

/**
 * Extrude a cross-section (a, b) and lay it in the world.
 * along "x": a → Z (across the frame), b → Y (up), length along +X from `from`.
 * along "y": a → X (inward), b → Z, length along +Y from `from`.
 * `cut(v)` moves the start face to make a mitre: start = from + cut(the other coordinate).
 */
function extrude(sol: Solid, along: "x" | "y", from: number, len: number, cut?: (v: number) => number): THREE.BufferGeometry | null {
  const shapes = shapesOf(sol as V2[][]);
  if (!shapes.length || !(len > 1)) return null;
  const g = new THREE.ExtrudeGeometry(shapes, { depth: len, bevelEnabled: false, curveSegments: 1, steps: 1 });
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i), b = pos.getY(i), z = pos.getZ(i);
    const c = cut ? cut(along === "x" ? b : a) : 0;
    const L = Math.abs(z) < 1e-6 ? from + c : from + len;
    if (along === "x") pos.setXYZ(i, L, b, a);
    else pos.setXYZ(i, a, L, b);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

interface Mats {
  coat: THREE.Material; cut: THREE.Material; picked: THREE.Material; glass: THREE.Material;
  mesh: THREE.Material; rubber: THREE.Material; steel: THREE.Material;
}

export function CutawayScene({ cut, g, mats, pick, onPick, hideUprights }: {
  cut: Cutaway; g: WindowGeo; mats: Mats; pick: Pick; onPick: (p: Pick) => void; hideUprights?: boolean;
}) {
  const parts = useMemo(() => {
    const items: { key: string; geo: THREE.BufferGeometry; partId?: string; metal: boolean; mat?: THREE.Material }[] = [];
    const idOf = (pl: string, shutter?: number) => [...g.frame, ...g.sash].find((m) => m.place === pl && (shutter === undefined || m.shutter === shutter))?.partId;
    const H = cut.trackH;

    // the side jamb: its own section if Gulf, else the track itself, tips pointing inward
    const sideShape = cut.side;
    const side: Solid = sideShape ? place(solidOf(sideShape.paths), 1, 0, 0, 0, -1, sideShape.h) : cut.track;
    const sideFace = sideShape ? sideShape.h : H;
    // jamb cross-section in (X inward, Z across): X = height of the section, Z = its depth
    const jambSol: Solid = side.map((l) => l.map(([x, y]) => [y, x] as [number, number]));
    const mitre = cut.frameAngle === 45;
    const jamb = extrude(jambSol, "y", 0, CUT_H, mitre ? (x) => x : undefined);
    if (jamb) items.push({ key: "jamb", geo: jamb, partId: idOf("frame-left"), metal: true });
    // the bottom track: mitred into the jamb, or between the jambs (Gulf, 90°)
    const sill = mitre ? extrude(cut.track, "x", 0, CUT_L, (y) => y) : extrude(cut.track, "x", sideFace, CUT_L - sideFace);
    if (sill) items.push({ key: "sill", geo: sill, partId: idOf("frame-bottom"), metal: true });

    // the track clip in every lane
    const clipFrom = mitre ? H : sideFace;
    for (const ln of cut.lanes) {
      if (!ln.clip.length) continue;
      const c = extrude(ln.clip, "x", clipFrom, CUT_L - clipFrom);
      if (c) items.push({ key: `clip${ln.lane}`, geo: c, partId: "trackClip", metal: true });
    }

    // the first shutter (its lock side is at this corner) on its own lane
    const ln = cut.lanes.find((l) => l.shutter === 0) ?? cut.lanes[0];
    if (ln) {
      const sx0 = sideFace * 0.45;                 // the shutter's edge runs into the jamb's groove
      const sashMitre = cut.sashAngle === 45;
      const rail = extrude(ln.rail, "x", sx0, CUT_L - sx0, sashMitre ? (y) => y - ln.y0 : () => ln.face);
      if (rail) items.push({ key: "rail", geo: rail, partId: idOf("sash-bottom", 0), metal: true });
      if (!hideUprights) {
        // the upright: its own section, face inward from the shutter edge, thickness on the rail's
        const up = ln.lock ?? ln.bottom;
        const own = solidOf(up.paths), ob = bounds(own);
        const face = (x: number) => (ln.mouth === "start" ? x - ob.x0 : ob.x1 - x);
        const sol: Solid = own.map((l) => l.map(([x, y]) => [sx0 + face(x), y + ln.depth0] as [number, number]));
        const stile = extrude(sol, "y", ln.y0, CUT_H - ln.y0 - 10, sashMitre ? (x) => x - sx0 : undefined);
        if (stile) items.push({ key: "stile", geo: stile, partId: idOf("sash-lock", 0), metal: true });
      }
      // glass (or mesh) in the pocket, with glazing rubber on both faces
      const rb = bounds(ln.rail);
      const zc = (rb.x0 + rb.x1) / 2, t = ln.kind === "J" ? 1 : 5;
      const gx0 = sx0 + ln.face * 0.72, gy0 = ln.y0 + ln.face * 0.72;
      const gw = CUT_L - gx0, gh = CUT_H - 10 - gy0;
      const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z);
      items.push({ key: "pane", geo: box(gw, gh, t, gx0, gy0, zc), metal: false, mat: ln.kind === "J" ? mats.mesh : mats.glass });
      if (ln.kind !== "J") for (const side of [-1, 1]) {
        const z = zc + side * (t / 2 + 1.2);
        items.push({ key: `rb${side}`, geo: box(gw, 3, 2.4, gx0, gy0 + 0.5, z), metal: false, mat: mats.rubber });
        if (!hideUprights) items.push({ key: `rs${side}`, geo: box(3, gh, 2.4, gx0 + 0.5, gy0, z), metal: false, mat: mats.rubber });
      }
      // the 24 mm roller on the clip, in the shutter's channel
      const wheel = new THREE.CylinderGeometry(9.5, 9.5, 8, 28).rotateX(Math.PI / 2).translate(sx0 + 70, ln.run + 9.5, ln.x);
      items.push({ key: "roller", geo: wheel, metal: false, mat: mats.steel });
    }
    return items;
  }, [cut, g, mats, hideUprights]);

  const edges = useMemo(() => parts.filter((p) => p.metal).map((p) => ({ key: p.key, geo: new THREE.EdgesGeometry(p.geo, 25) })), [parts]);
  const click = (p: Pick) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(p); };

  return (
    <group>
      {parts.map((p) => {
        const picked = !!p.partId && pick?.type === "part" && pick.id === p.partId;
        const material = p.metal ? (picked ? [mats.picked, mats.picked] : [mats.cut, mats.coat]) : p.mat!;
        return <mesh key={p.key} geometry={p.geo} material={material} castShadow receiveShadow
          onClick={p.partId ? click({ type: "part", id: p.partId }) : undefined} />;
      })}
      {edges.map((e) => (
        <lineSegments key={`e${e.key}`} geometry={e.geo}>
          <lineBasicMaterial color="#0f172a" transparent opacity={0.55} />
        </lineSegments>
      ))}
    </group>
  );
}

/**
 * Where two shutters meet: both bottom rails on their lanes, the meeting uprights
 * (slim interlocks, or the shutter section with its interlock clip) standing up,
 * both glasses, and the track with its clips under them. Centred on X = 0.
 */
export function MeetingScene({ cut, meeting, g, mats, pick, onPick }: {
  cut: Cutaway; meeting: Meeting; g: WindowGeo; mats: Mats; pick: Pick; onPick: (p: Pick) => void;
}) {
  const parts = useMemo(() => {
    const items: { key: string; geo: THREE.BufferGeometry; partId?: string; metal: boolean; mat?: THREE.Material }[] = [];
    const idOf = (pl: string, shutter?: number) => [...g.frame, ...g.sash].find((m) => m.place === pl && (shutter === undefined || m.shutter === shutter))?.partId;
    const run = MEET_RUN + 30;
    const sill = extrude(cut.track, "x", -run, 2 * run);
    if (sill) items.push({ key: "sill", geo: sill, partId: idOf("frame-bottom"), metal: true });
    for (const ln of cut.lanes) {
      if (!ln.clip.length) continue;
      const c = extrude(ln.clip, "x", -run, 2 * run);
      if (c) items.push({ key: `clip${ln.lane}`, geo: c, partId: "trackClip", metal: true });
    }
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x + w / 2, y + h / 2, z);
    meeting.sides.forEach((sd, i) => {
      const ln = sd.lane;
      const rail = extrude(ln.rail, "x", sd.railFrom, sd.railTo - sd.railFrom);
      if (rail) items.push({ key: `rail${i}`, geo: rail, partId: idOf("sash-bottom", ln.shutter), metal: true });
      sd.uprights.forEach((u, j) => {
        const geo = extrude(u, "y", ln.y0, CUT_H - 10 - ln.y0);
        if (geo) items.push({ key: `up${i}${j}`, geo, partId: j === 0 ? idOf("sash-meet", ln.shutter) : g.patti[0]?.partId, metal: true });
      });
      const t = ln.kind === "J" ? 1 : 5, gy0 = ln.y0 + ln.face * 0.72, gh = CUT_H - 10 - gy0;
      items.push({ key: `pane${i}`, geo: box(sd.glassTo - sd.glassFrom, gh, t, sd.glassFrom, gy0, sd.zg), metal: false, mat: ln.kind === "J" ? mats.mesh : mats.glass });
      if (ln.kind !== "J") for (const s of [-1, 1]) items.push({ key: `rb${i}${s}`, geo: box(sd.glassTo - sd.glassFrom, 3, 2.4, sd.glassFrom, gy0 + 0.5, sd.zg + s * (t / 2 + 1.2)), metal: false, mat: mats.rubber });
      const wheel = new THREE.CylinderGeometry(9.5, 9.5, 8, 28).rotateX(Math.PI / 2).translate(i === 0 ? sd.railFrom + 60 : sd.railTo - 60, ln.run + 9.5, ln.x);
      items.push({ key: `roller${i}`, geo: wheel, metal: false, mat: mats.steel });
    });
    return items;
  }, [cut, meeting, g, mats]);

  const edges = useMemo(() => parts.filter((p) => p.metal).map((p) => ({ key: p.key, geo: new THREE.EdgesGeometry(p.geo, 25) })), [parts]);
  const click = (p: Pick) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(p); };
  return (
    <group>
      {parts.map((p) => {
        const picked = !!p.partId && pick?.type === "part" && pick.id === p.partId;
        const material = p.metal ? (picked ? [mats.picked, mats.picked] : [mats.cut, mats.coat]) : p.mat!;
        return <mesh key={p.key} geometry={p.geo} material={material} castShadow receiveShadow onClick={p.partId ? click({ type: "part", id: p.partId }) : undefined} />;
      })}
      {edges.map((e) => (
        <lineSegments key={`e${e.key}`} geometry={e.geo}>
          <lineBasicMaterial color="#0f172a" transparent opacity={0.55} />
        </lineSegments>
      ))}
    </group>
  );
}
