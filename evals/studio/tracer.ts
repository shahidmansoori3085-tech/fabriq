/** The in-phone section tracer, on a drawn test picture. npx tsx evals/studio/tracer.ts */
import { traceImage, traceOptions } from "../../lib/studio/tracer";

const fails: string[] = [];
function picture(outline: boolean) {
  const w = 400, h = 220, g = new Uint8Array(w * h).fill(250);
  const box = (x0: number, y0: number, x1: number, y1: number, v: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  if (outline) {
    // walls drawn as two thin lines 8 px apart
    box(50, 40, 350, 42, 20); box(50, 138, 350, 140, 20); box(50, 40, 52, 140, 20); box(348, 40, 350, 140, 20);
    box(58, 48, 342, 50, 20); box(58, 130, 342, 132, 20); box(58, 48, 60, 132, 20); box(340, 48, 342, 132, 20);
  } else {
    box(50, 40, 350, 140, 90); box(58, 48, 342, 132, 250); // hollow grey tube, 8 px walls
  }
  box(50, 175, 350, 176, 0);  // a dimension line under it
  box(180, 182, 220, 196, 0); // its text
  return { w, h, g };
}
for (const outline of [false, true]) {
  const p = picture(outline);
  const r = traceImage(p.g, p.w, p.h, 60, 20);
  if (!r) { fails.push(`${outline ? "outline" : "filled"}: nothing traced`); continue; }
  if (r.scaleCheck > 2) fails.push(`${outline ? "outline" : "filled"}: scale off ${r.scaleCheck}% (dimension line picked up?)`);
  if (r.paths.length !== 2) fails.push(`${outline ? "outline" : "filled"}: expected outer + 1 hole, got ${r.paths.length} loops`);
}

// a catalogue screenshot: thick walls, and 3 px extension / dimension lines touching the section
{
  const w = 500, h = 260, g = new Uint8Array(w * h).fill(250);
  const box = (x0: number, y0: number, x1: number, y1: number, v: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y * w + x] = v; };
  box(50, 40, 350, 140, 20); box(62, 52, 338, 128, 250);   // tube, 12 px walls
  box(350, 40, 420, 43, 20); box(350, 137, 420, 140, 20);  // extension lines off its corners
  box(410, 40, 413, 140, 20);                              // the dimension line between them
  box(200, 128, 203, 200, 20);                             // a leader line from inside out
  const opts = traceOptions(g, w, h, 60, 20);
  const box2 = (t: { paths: string[] }) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of t.paths) for (const m of q.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) { x0 = Math.min(x0, +m[1]); x1 = Math.max(x1, +m[1]); y0 = Math.min(y0, +m[2]); y1 = Math.max(y1, +m[2]); } return (x1 - x0) / (y1 - y0); };
  if (!opts.some((t) => Math.abs(box2(t) - 3) < 0.1)) fails.push("screenshot: no reading without the dimension lines (" + opts.map((t) => box2(t).toFixed(2)).join(", ") + ")");
}
if (fails.length) { console.error("Tracer FAILED:"); fails.forEach((f) => console.error(" ✗ " + f)); process.exit(1); }
console.log("Tracer: filled and outline drawings traced, dimension lines left out (also 3 px lines touching the section).");
