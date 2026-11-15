/**
 * Trace a section from a photo or screenshot, in the phone. The shop types
 * the section's width × height; the darkest shape in the picture becomes
 * the section, scaled to those sizes. Works for filled drawings (Ample,
 * Banu Hashim, Alucoat) and for outline drawings (walls drawn as two lines).
 */

export interface Traced { w: number; h: number; paths: string[]; scaleCheck: number }

/** Otsu's threshold for a grey image. */
function otsu(g: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of g) hist[v]++;
  const total = g.length;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; t = i; }
  }
  return t;
}

/** Square erode / dilate of radius r (outside the picture counts as paper). Summed-area table: same speed for any r. */
function morph(m: Uint8Array, w: number, h: number, r: number, erode: boolean): Uint8Array {
  const W = w + 1, S = new Int32Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += m[y * w + x]; S[(y + 1) * W + x + 1] = S[y * W + x + 1] + row; }
  }
  const full = (2 * r + 1) * (2 * r + 1), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = S[y1 * W + x1] - S[y0 * W + x1] - S[y1 * W + x0] + S[y0 * W + x0];
      out[y * w + x] = erode ? (s === full ? 1 : 0) : (s > 0 ? 1 : 0);
    }
  }
  return out;
}

function largest(m: Uint8Array, w: number, h: number): Uint8Array {
  const lab = new Int32Array(w * h).fill(-1); let best = -1, bestN = 0; const st: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i] >= 0) continue; let n = 0; lab[i] = i; st.push(i);
    while (st.length) {
      const q = st.pop()!; n++; const x = q % w, y = (q - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q2 = ny * w + nx; if (m[q2] && lab[q2] < 0) { lab[q2] = i; st.push(q2); }
      }
    }
    if (n > bestN) { bestN = n; best = i; }
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) if (lab[i] === best) out[i] = 1;
  return out;
}

/** Outline drawings: fill narrow enclosed regions (walls drawn as two lines); wide ones are chambers. */
function fillThin(m: Uint8Array, w: number, h: number, T: number) {
  const dist = new Int32Array(w * h).fill(1 << 29); const q: number[] = [];
  for (let i = 0; i < m.length; i++) if (m[i]) { dist[i] = 0; q.push(i); }
  for (let k = 0; k < q.length; k++) {
    const p = q[k], x = p % w, y = (p - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const p2 = ny * w + nx; if (dist[p2] > dist[p] + 1) { dist[p2] = dist[p] + 1; q.push(p2); }
    }
  }
  const reg = new Int32Array(w * h).fill(-1); const st: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] || reg[i] >= 0) continue;
    const members: number[] = []; let maxD = 0, edge = false; reg[i] = i; st.push(i);
    while (st.length) {
      const p = st.pop()!; members.push(p); const x = p % w, y = (p - x) / w;
      if (dist[p] > maxD) maxD = dist[p]; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const p2 = ny * w + nx; if (!m[p2] && reg[p2] < 0) { reg[p2] = i; st.push(p2); }
      }
    }
    if (!edge && maxD <= T) for (const p of members) m[p] = 1;
  }
}

/** Boundary loops with metal on the left (pixel-corner coordinates). */
export function contours(mask: Uint8Array, bw: number, bh: number): [number, number][][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < bw && y < bh ? mask[y * bw + x] : 0);
  const W1 = bw + 2;
  const id = (x: number, y: number) => (y + 1) * W1 + (x + 1);
  const outs = new Map<number, number[]>();
  const add = (a: number, b: number) => { const l = outs.get(a); if (l) l.push(b); else outs.set(a, [b]); };
  for (let y = -1; y < bh; y++) for (let x = -1; x < bw; x++) {
    const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1);
    if (a !== b) { if (a) add(id(x + 1, y + 1), id(x + 1, y)); else add(id(x + 1, y), id(x + 1, y + 1)); }
    if (a !== c) { if (a) add(id(x, y + 1), id(x + 1, y + 1)); else add(id(x + 1, y + 1), id(x, y + 1)); }
  }
  const xy = (k: number): [number, number] => [(k % W1) - 1, Math.floor(k / W1) - 1];
  const loops: [number, number][][] = [];
  for (const [startPt, list] of outs) {
    while (list.length) {
      const loop: [number, number][] = [xy(startPt)];
      let prev = startPt, cur = list.pop()!, guard = 0;
      while (cur !== startPt && guard++ < 2_000_000) {
        loop.push(xy(cur));
        const opts = outs.get(cur); if (!opts || !opts.length) break;
        let pick = 0;
        if (opts.length > 1) {
          const [px, py] = xy(prev), [cx, cy] = xy(cur), dx = cx - px, dy = cy - py;
          pick = opts.findIndex((o) => { const [ox, oy] = xy(o); return ox - cx === -dy && oy - cy === dx; });
          if (pick < 0) pick = 0;
        }
        const nxt = opts.splice(pick, 1)[0]; prev = cur; cur = nxt;
      }
      if (loop.length > 8) loops.push(loop);
    }
  }
  return loops;
}

function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!; let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol && mi > 0) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function simplifyLoop(l: [number, number][], tol: number): [number, number][] {
  let far = 0, fd = 0;
  for (let i = 1; i < l.length; i++) { const d = Math.hypot(l[i][0] - l[0][0], l[i][1] - l[0][1]); if (d > fd) { fd = d; far = i; } }
  const a = simplify(l.slice(0, far + 1), tol), b = simplify([...l.slice(far), l[0]], tol);
  return [...a, ...b.slice(1, -1)];
}

/**
 * gray: one byte per pixel (0 = black). wMm × hMm: the section's printed size.
 * invert: the section is light on a dark background.
 */
export function traceImage(gray: Uint8Array, w: number, h: number, wMm: number, hMm: number, invert = false): Traced | null {
  return traceOptions(gray, w, h, wMm, hMm, invert)[0] ?? null;
}

/**
 * Every way of reading the picture, the usual choice first:
 *  A) wipe thin lines first (filled drawings with dimension lines crossing them)
 *  B) take the ink as it is (outline drawings whose walls are thin lines)
 *  C) wipe harder, up to what the walls allow: a catalogue screenshot's dimension
 *     and extension lines are often 2–4 px, thin next to the section's walls.
 * The usual choice is the best fit to the printed size (of near-equal fits the gentlest).
 * A catalogue drawing is not always to scale, so the size alone can pick a reading that
 * still carries a dimension line; the section reader (know.ts) then tries the others and
 * keeps the one that matches a known section clearly better.
 */
export function traceOptions(gray: Uint8Array, w: number, h: number, wMm: number, hMm: number, invert = false): Traced[] {
  // Paper is the common light level; anything clearly darker is ink (grey metal
  // fill and black lines alike — the opening below removes the thin lines).
  const sorted = Uint8Array.from(gray).sort();
  const paper = invert ? sorted[Math.floor(sorted.length * 0.3)] : sorted[Math.floor(sorted.length * 0.7)];
  const t = invert ? paper + 45 : Math.max(Math.min(otsu(gray), paper - 25), paper - 45);
  const m = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) m[i] = (invert ? gray[i] > t : gray[i] < t) ? 1 : 0;
  const wipe = (k: number) => {
    const opened = morph(morph(m, w, h, k, true), w, h, k, false);
    const grown = morph(largest(opened, w, h), w, h, k + 1, false);
    const a1 = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) a1[i] = grown[i] && m[i] ? 1 : 0;
    return finish(largest(a1, w, h), w, h, wMm, hMm);
  };
  const whole = largest(m, w, h);
  const r = Math.max(1, Math.round(Math.min(w, h) / 400));
  const all = [wipe(r), finish(whole, w, h, wMm, hMm)];
  // up to a quarter of the wall, and never less than 3 steps (curved corners and text pull the wall estimate down)
  const rWall = Math.floor(wallPx(whole, w, h) / 4);
  for (let k = r + 1; k <= Math.min(Math.max(rWall, r + 3), r + 5); k++) all.push(wipe(k));
  const ok = all.filter(Boolean) as Traced[];
  if (!ok.length) return [];
  const best = Math.min(...ok.map((c) => c.scaleCheck));
  const first = ok.find((c) => c.scaleCheck <= best + 1)!;
  return [first, ...ok.filter((c) => c !== first)];
}

/**
 * The section's usual wall thickness in pixels: for each ink pixel the shorter of its
 * across and up-down ink runs; walls carry most of the ink, so take the 60th percentile.
 */
function wallPx(m: Uint8Array, w: number, h: number): number {
  const hr = new Int32Array(w * h), vr = new Int32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w;) {
    if (!m[y * w + x]) { x++; continue; }
    let e = x; while (e < w && m[y * w + e]) e++;
    for (let k = x; k < e; k++) hr[y * w + k] = e - x;
    x = e;
  }
  for (let x = 0; x < w; x++) for (let y = 0; y < h;) {
    if (!m[y * w + x]) { y++; continue; }
    let e = y; while (e < h && m[e * w + x]) e++;
    for (let k = y; k < e; k++) vr[k * w + x] = e - y;
    y = e;
  }
  const t: number[] = [];
  for (let i = 0; i < m.length; i++) if (m[i]) t.push(Math.min(hr[i], vr[i]));
  if (!t.length) return 0;
  t.sort((a, b) => a - b);
  return t[Math.floor(t.length * 0.6)];
}

function finish(m: Uint8Array, w: number, h: number, wMm: number, hMm: number): Traced | null {
  let minX = w, minY = h, maxX = 0, maxY = 0, n = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) { n++; const x = i % w, y = (i - x) / w; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (n < 30) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  // an outline drawing covers little of its box — fill its walls
  if (n / (bw * bh) < 0.12) fillThin(m, w, h, Math.max(3, Math.round(Math.min(bw, bh) * 0.035)));
  const sx = wMm / bw, sy = hMm / bh;
  const check = Math.abs(sx - sy) / Math.max(sx, sy);
  const s = (sx + sy) / 2;
  const paths = contours(m, w, h).map((l) => simplifyLoop(l, 1.1)).filter((l) => l.length > 3)
    .map((l) => "M" + l.map(([x, y]) => `${((x - minX) * s).toFixed(2)} ${((y - minY) * s).toFixed(2)}`).join("L") + "Z");
  return { w: wMm, h: hMm, paths, scaleCheck: +(check * 100).toFixed(1) };
}
