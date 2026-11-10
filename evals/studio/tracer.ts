/** The in-phone section tracer, on a drawn test picture. npx tsx evals/studio/tracer.ts */
import { traceImage } from "../../lib/studio/tracer";

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
if (fails.length) { console.error("Tracer FAILED:"); fails.forEach((f) => console.error(" ✗ " + f)); process.exit(1); }
console.log("Tracer: filled and outline drawings traced, dimension lines left out.");
