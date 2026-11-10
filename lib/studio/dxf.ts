/**
 * Read a section from a DXF file (the CAD file extruders send). Closed
 * polylines are taken as they are; loose LINE / ARC pieces are chained end to
 * end into closed loops. Arcs and polyline bulges become short straight runs.
 * Result is in mm, y down, origin at the top-left of the section — the same
 * shape format the tracer and the catalogue shapes use.
 */
import type { Traced } from "./tracer";

type P = [number, number];

function pairs(text: string): [number, string][] {
  const lines = text.split(/\r?\n/);
  const out: [number, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  return out;
}

/** Points along an arc from a to b with the polyline bulge (tan of a quarter of the angle). */
function bulgePoints(a: P, b: P, bulge: number): P[] {
  if (!bulge) return [];
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const r = chord / (2 * Math.sin(theta / 2));
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const d = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2)) * Math.sign(bulge) * (Math.abs(theta) > Math.PI ? -1 : 1);
  const ux = (b[0] - a[0]) / chord, uy = (b[1] - a[1]) / chord;
  const cx = mx - uy * d, cy = my + ux * d;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(theta) / (Math.PI / 18)));
  const pts: P[] = [];
  for (let k = 1; k < n; k++) { const t = a0 + (theta * k) / n; pts.push([cx + Math.abs(r) * Math.cos(t), cy + Math.abs(r) * Math.sin(t)]); }
  return pts;
}

function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number): P[] {
  let sweep = a1 - a0; if (sweep <= 0) sweep += 360;
  const n = Math.max(2, Math.ceil(sweep / 10));
  return Array.from({ length: n + 1 }, (_, k) => {
    const t = ((a0 + (sweep * k) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as P;
  });
}

export function readDxf(text: string): Traced | null {
  const ps = pairs(text);
  // drawing units: $INSUNITS 1 = inch, 4 = mm (default), 5 = cm, 6 = m
  let unit = 1;
  const iu = ps.findIndex(([c, v]) => c === 9 && v === "$INSUNITS");
  if (iu >= 0) { const v = parseInt(ps[iu + 1]?.[1] ?? "4", 10); unit = v === 1 ? 25.4 : v === 5 ? 10 : v === 6 ? 1000 : 1; }

  const loops: P[][] = [];
  const pieces: P[][] = [];
  const start = ps.findIndex(([c, v]) => c === 2 && v === "ENTITIES");
  let i = start >= 0 ? start + 1 : 0;
  const read = (from: number) => { const g: [number, string][] = []; let j = from; while (j < ps.length && ps[j][0] !== 0) g.push(ps[j++]); return { g, next: j }; };
  while (i < ps.length) {
    const [code, val] = ps[i];
    if (code !== 0) { i++; continue; }
    if (val === "ENDSEC") break;
    const { g, next } = read(i + 1);
    const num = (c: number) => parseFloat(g.find(([k]) => k === c)?.[1] ?? "0");
    if (val === "LWPOLYLINE") {
      const closed = (parseInt(g.find(([k]) => k === 70)?.[1] ?? "0", 10) & 1) === 1;
      const vs: { p: P; b: number }[] = [];
      for (const [k, v] of g) {
        if (k === 10) vs.push({ p: [parseFloat(v), 0], b: 0 });
        else if (k === 20 && vs.length) vs[vs.length - 1].p[1] = parseFloat(v);
        else if (k === 42 && vs.length) vs[vs.length - 1].b = parseFloat(v);
      }
      const pts: P[] = [];
      vs.forEach((v, n) => {
        pts.push(v.p);
        const nx = vs[(n + 1) % vs.length];
        if (n < vs.length - 1 || closed) pts.push(...bulgePoints(v.p, nx.p, v.b));
      });
      (closed ? loops : pieces).push(pts);
      i = next;
    } else if (val === "POLYLINE") {
      const closed = (num(70) & 1) === 1;
      const vs: { p: P; b: number }[] = [];
      let j = next;
      while (j < ps.length && !(ps[j][0] === 0 && ps[j][1] === "SEQEND")) {
        if (ps[j][0] === 0 && ps[j][1] === "VERTEX") {
          const v = read(j + 1);
          const n2 = (c: number) => parseFloat(v.g.find(([k]) => k === c)?.[1] ?? "0");
          vs.push({ p: [n2(10), n2(20)], b: n2(42) });
          j = v.next;
        } else j++;
      }
      const pts: P[] = [];
      vs.forEach((v, n) => { pts.push(v.p); if (n < vs.length - 1 || closed) pts.push(...bulgePoints(v.p, vs[(n + 1) % vs.length].p, v.b)); });
      (closed ? loops : pieces).push(pts);
      i = j + 1;
    } else if (val === "LINE") {
      pieces.push([[num(10), num(20)], [num(11), num(21)]]);
      i = next;
    } else if (val === "ARC") {
      pieces.push(arcPoints(num(10), num(20), num(40), num(50), num(51)));
      i = next;
    } else if (val === "CIRCLE") {
      const pts = arcPoints(num(10), num(20), num(40), 0, 360); pts.pop();
      loops.push(pts);
      i = next;
    } else i = next;
  }

  // chain loose pieces end to end into closed loops
  const near = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.02;
  const left = pieces.slice();
  while (left.length) {
    let chain = left.shift()!;
    let grew = true;
    while (grew && !near(chain[0], chain[chain.length - 1])) {
      grew = false;
      for (let k = 0; k < left.length; k++) {
        const p = left[k], end = chain[chain.length - 1];
        if (near(end, p[0])) { chain = [...chain, ...p.slice(1)]; }
        else if (near(end, p[p.length - 1])) { chain = [...chain, ...p.slice(0, -1).reverse()]; }
        else continue;
        left.splice(k, 1); grew = true; break;
      }
    }
    if (chain.length > 3 && near(chain[0], chain[chain.length - 1])) loops.push(chain.slice(0, -1));
  }
  if (!loops.length) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const l of loops) for (const [x, y] of l) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const w = (maxX - minX) * unit, h = (maxY - minY) * unit;
  if (!(w > 0 && h > 0)) return null;
  // DXF y runs up; ours runs down from the top edge
  const paths = loops.map((l) => "M" + l.map(([x, y]) => `${((x - minX) * unit).toFixed(2)} ${((maxY - y) * unit).toFixed(2)}`).join("L") + "Z");
  return { w: +w.toFixed(2), h: +h.toFixed(2), paths, scaleCheck: 0 };
}
