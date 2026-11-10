/** DXF section import. npx tsx evals/studio/dxf.ts */
import { readDxf } from "../../lib/studio/dxf";

const fails: string[] = [];
const ent = (body: string) => `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${body}0\nENDSEC\n0\nEOF\n`;
const lw = (pts: [number, number][], closed = true) =>
  `0\nLWPOLYLINE\n90\n${pts.length}\n70\n${closed ? 1 : 0}\n` + pts.map(([x, y]) => `10\n${x}\n20\n${y}\n`).join("");
const line = (a: [number, number], b: [number, number]) => `0\nLINE\n10\n${a[0]}\n20\n${a[1]}\n11\n${b[0]}\n21\n${b[1]}\n`;

// 1. hollow 65 × 29 box drawn as two closed polylines
{
  const r = readDxf(ent(lw([[10, 5], [75, 5], [75, 34], [10, 34]]) + lw([[12, 7], [73, 7], [73, 32], [12, 32]])));
  if (!r || r.w !== 65 || r.h !== 29 || r.paths.length !== 2) fails.push(`hollow box: ${JSON.stringify(r && { w: r.w, h: r.h, n: r.paths.length })}`);
}
// 2. an L shape from loose LINEs (given out of order) — chained into one loop, y flipped
{
  const r = readDxf(ent(line([0, 0], [40, 0]) + line([10, 30], [0, 30]) + line([40, 0], [40, 10]) + line([0, 30], [0, 0]) + line([40, 10], [10, 10]) + line([10, 10], [10, 30])));
  if (!r || r.w !== 40 || r.h !== 30 || r.paths.length !== 1) fails.push(`L from lines: ${JSON.stringify(r && { w: r.w, h: r.h, n: r.paths.length })}`);
  else if (!r.paths[0].includes("0.00 30.00")) fails.push("y not flipped (base should be at y = 30 mm)");
}
// 3. inch drawing is turned into mm
{
  const r = readDxf(ent(lw([[0, 0], [2, 0], [2, 1], [0, 1]])).replace("70\n4", "70\n1"));
  if (!r || r.w !== 50.8 || r.h !== 25.4) fails.push(`inch units: ${JSON.stringify(r && { w: r.w, h: r.h })}`);
}
if (fails.length) { console.error("DXF FAILED:"); fails.forEach((f) => console.error(" ✗ " + f)); process.exit(1); }
console.log("DXF: closed polylines, loose lines chained, inch drawings scaled to mm.");
