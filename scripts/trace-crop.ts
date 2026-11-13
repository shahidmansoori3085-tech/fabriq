/**
 * Trace one drawing cut out of a catalogue page, with the phone-photo tracer.
 *   npx tsx scripts/trace-crop.ts <out.json> <pdf> <page> <code> <wMm> <hMm> <x0> <y0> <x1> <y1>
 * x0..y1 are fractions of the page. Adds the shape to <out.json>.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { traceImage } from "../lib/studio/tracer";

const [out, pdf, page, code, wMm, hMm, x0, y0, x1, y1] = process.argv.slice(2);
const PDFTOPPM = process.env.PDFTOPPM ?? "pdftoppm";
const dpi = 300;
const info = execFileSync(PDFTOPPM.replace(/pdftoppm(\.exe)?$/, "pdfinfo$1"), ["-f", page, "-l", page, pdf]).toString();
const m = info.match(/Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/) ?? info.match(/Page size:\s+([\d.]+)\s+x\s+([\d.]+)/);
const pw = (parseFloat(m![1]) / 72) * dpi, ph = (parseFloat(m![2]) / 72) * dpi;
const dir = mkdtempSync(join(tmpdir(), "crop-"));
const X = Math.round(+x0 * pw), Y = Math.round(+y0 * ph), W = Math.round((+x1 - +x0) * pw), H = Math.round((+y1 - +y0) * ph);
execFileSync(PDFTOPPM, ["-r", String(dpi), "-f", page, "-l", page, "-x", String(X), "-y", String(Y), "-W", String(W), "-H", String(H), "-gray", pdf, join(dir, "c")]);
const file = execFileSync("ls", [dir]).toString().trim().split("\n")[0];
const buf = readFileSync(join(dir, file));
// binary PGM: P5\n<w> <h>\n255\n<data>
const head = buf.toString("latin1", 0, 64).split(/\s+/);
const gw = +head[1], gh = +head[2];
const off = buf.indexOf(0x0a, buf.indexOf(0x0a, buf.indexOf(0x0a) + 1) + 1) + 1;
const gray = new Uint8Array(buf.subarray(off, off + gw * gh));
const t = traceImage(gray, gw, gh, +wMm, +hMm, false);
if (!t) { console.log(`${code}: nothing traced`); process.exit(1); }
const book = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
book[code] = { code, maker: "Banu Hashim", w: +wMm, h: +hMm, paths: t.paths, source: `${pdf.split(/[\/]/).pop()} p.${page} (cut out, photo tracer)`, scaleCheck: t.scaleCheck };
writeFileSync(out, JSON.stringify(book));
console.log(`${code}: ${t.paths.length} loops, ${t.scaleCheck}% off the printed size`);
