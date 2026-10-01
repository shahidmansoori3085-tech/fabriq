/**
 * Sheet-reading eval: renders each hard case to an image, sends it through the
 * real /api/ai/read-sheet route, and scores the result against ground truth —
 * sizes, quantity, every engine answer the sheet should have produced, and
 * how many questions the fabricator would be asked that the sheet answered.
 *
 *   EVAL_API_KEY=<key> npx tsx evals/sheets/run.ts [caseIdPrefix...]
 *
 * Needs the dev server on :3002 (or EVAL_URL) and Microsoft Edge for rendering.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CASES, pageHtml } from "./cases.mjs";
import { seedFromRow } from "../../lib/engine/sheet-seed";
import { normalizeRaw, type ExtractedItem } from "../../lib/engine/sheet-row";
import { parseDimension } from "../../lib/engine/units";
import { generateQuestions } from "../../lib/engine/questions";

const URL_ = process.env.EVAL_URL ?? "http://localhost:3002/api/ai/read-sheet";
const KEY = process.env.EVAL_API_KEY ?? "";
const EDGE = process.env.EDGE_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const OUT = resolve(__dirname, "out");
mkdirSync(OUT, { recursive: true });

type Truth = ExtractedItem & { onSheet?: string[]; unreadable?: boolean };
type Case = { id: string; truth: Truth[]; totalsOnly?: boolean; noisy?: boolean };

const dim = (raw: string, unit: ExtractedItem["unit_guess"]) =>
  raw ? parseDimension(normalizeRaw(String(raw), unit)) : null;
const INCH = 25400;
const sameDim = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) <= INCH / 2;

function asked(row: ExtractedItem): string[] {
  const w = dim(row.width_raw, row.unit_guess), h = dim(row.height_raw, row.unit_guess);
  if (!w || !h) return [];
  return generateQuestions({ type: row.type, width: w, height: h, qty: row.qty || 1, known: seedFromRow(row) }).map((q) => q.id);
}

function render(c: Case & Record<string, unknown>): string {
  const html = join(OUT, `${c.id}.html`), png = join(OUT, `${c.id}.png`);
  writeFileSync(html, pageHtml(c));
  execFileSync(EDGE, ["--headless=new", "--disable-gpu", `--screenshot=${png}`, "--window-size=1050,1100", pathToFileURL(html).href], { stdio: "ignore" });
  return png;
}

async function read(png: string): Promise<{ items: ExtractedItem[]; raw: unknown }> {
  const data = readFileSync(png).toString("base64");
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(URL_, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [{ data, mediaType: "image/png" }], apiKey: KEY }),
      });
      const j = await res.json();
      if (res.ok) return { items: j.items ?? [], raw: j };
      if (attempt === 4) return { items: [], raw: j };
      // free-tier per-minute caps: waiting out the minute is the fix, not a fast retry
      if (j.reason === "rate_limited") { await new Promise((r) => setTimeout(r, 65000)); continue; }
    } catch (e) {
      if (attempt === 4) return { items: [], raw: { error: String(e) } };
    }
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  return { items: [], raw: null };
}

interface Miss { case: string; item: number; field: string; want: unknown; got: unknown }

function score(c: Case, got: ExtractedItem[]) {
  const misses: Miss[] = [];
  let checks = 0, ok = 0;
  const check = (item: number, field: string, want: unknown, gotV: unknown, pass: boolean) => {
    checks++; if (pass) ok++; else misses.push({ case: c.id, item, field, want, got: gotV });
  };

  if (c.totalsOnly) {
    const tally = (rows: ExtractedItem[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const w = dim(r.width_raw, r.unit_guess), h = dim(r.height_raw, r.unit_guess);
        const k = `${r.type}|${w && Math.round(w / INCH)}|${h && Math.round(h / INCH)}|${seedFromRow(r).mix ?? ""}`;
        m.set(k, (m.get(k) ?? 0) + (r.qty || 1));
      }
      return m;
    };
    const want = tally(c.truth), have = tally(got);
    for (const [k, n] of want) check(-1, `total ${k}`, n, have.get(k) ?? 0, have.get(k) === n);
    return { checks, ok, misses, extraAsks: 0, appGapAsks: 0 };
  }

  check(-1, "item count", c.truth.length, got.length, got.length === c.truth.length);
  let extraAsks = 0, appGapAsks = 0;
  c.truth.forEach((t, i) => {
    const g = got[i];
    if (!g) { check(i, "missing item", t.type, null, false); return; }
    if (t.unreadable) {
      const h = dim(g.height_raw, g.unit_guess), w = dim(g.width_raw, g.unit_guess);
      check(i, "no invented size", "unreadable", `${g.width_raw} x ${g.height_raw}`, !(h && w) || g.confidence === "low");
      return;
    }
    check(i, "type", t.type, g.type, g.type === t.type);
    const tw = dim(t.width_raw, t.unit_guess), th = dim(t.height_raw, t.unit_guess);
    const gw = dim(g.width_raw, g.unit_guess), gh = dim(g.height_raw, g.unit_guess);
    check(i, "width", t.width_raw, g.width_raw, sameDim(tw, gw));
    check(i, "height", t.height_raw, g.height_raw, sameDim(th, gh));
    check(i, "qty", t.qty || 1, g.qty || 1, (g.qty || 1) === (t.qty || 1));

    const ts = seedFromRow(t), gs = seedFromRow(g);
    for (const [k, v] of Object.entries(ts)) {
      const gv = gs[k];
      const pass = k.endsWith("Ft") ? Math.abs(parseFloat(gv) - parseFloat(v)) < 0.1 : gv === v;
      check(i, k, v, gv, pass);
    }

    const truthAsk = new Set(asked(t)), gotAsk = asked(g);
    extraAsks += gotAsk.filter((q) => !truthAsk.has(q)).length;
    const onSheet = new Set(t.onSheet ?? []);
    if (t.type === "door" && typeof t.frame_needed === "boolean") onSheet.add("chokhat");
    for (const q of truthAsk) if (onSheet.has(q)) { appGapAsks++; misses.push({ case: c.id, item: i, field: `APP asks "${q}" though sheet answers it`, want: "not asked", got: "asked" }); }
  });
  return { checks, ok, misses, extraAsks, appGapAsks };
}

async function main() {
  if (!KEY) { console.error("Set EVAL_API_KEY"); process.exit(1); }
  const args = process.argv.slice(2);
  // --cached: reuse a case's last successful read instead of paying for it again
  // (re-score after an app-side change without re-reading every sheet).
  const cached = args.includes("--cached");
  const only = args.filter((a) => !a.startsWith("--"));
  const cases = (CASES as unknown as (Case & Record<string, unknown>)[]).filter((c) => !only.length || only.some((p) => c.id.startsWith(p)));
  const allMisses: Miss[] = [];
  const rows: string[] = [];
  let T = 0, O = 0, EX = 0, GAP = 0;
  for (const c of cases) {
    const prevPath = join(OUT, `${c.id}.json`);
    const prev = cached && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
    const fresh = !prev?.items?.length;
    const { items, raw } = fresh ? await read(render(c)) : { items: prev.items as ExtractedItem[], raw: prev };
    if (fresh) await new Promise((r) => setTimeout(r, Number(process.env.EVAL_DELAY_MS ?? 6000)));
    writeFileSync(prevPath, JSON.stringify(raw, null, 2));
    const s = score(c, items);
    T += s.checks; O += s.ok; EX += s.extraAsks; GAP += s.appGapAsks;
    allMisses.push(...s.misses);
    rows.push(`${c.id.padEnd(22)} ${String(s.ok).padStart(3)}/${String(s.checks).padEnd(3)} ${((100 * s.ok) / Math.max(1, s.checks)).toFixed(0).padStart(4)}%  extraAsks ${s.extraAsks}  appGap ${s.appGapAsks}`);
    console.log(rows[rows.length - 1]);
  }
  const byField = new Map<string, number>();
  for (const m of allMisses) {
    const f = m.field.startsWith("APP asks") ? m.field.replace(/ though.*/, "") : m.field.replace(/^total .*/, "total units");
    byField.set(f, (byField.get(f) ?? 0) + 1);
  }
  console.log(`\nOVERALL ${O}/${T} = ${((100 * O) / T).toFixed(1)}%   questions from misreads: ${EX}   app-side redundant questions: ${GAP}`);
  console.log("\nMisses by field:");
  for (const [f, n] of [...byField].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${f}`);
  console.log("\nAll misses:");
  for (const m of allMisses) console.log(`  ${m.case} #${m.item} ${m.field}: want ${JSON.stringify(m.want)} got ${JSON.stringify(m.got)}`);
  writeFileSync(join(OUT, `report-${Date.now()}.json`), JSON.stringify({ overall: { ok: O, checks: T, extraAsks: EX, appGap: GAP }, rows, misses: allMisses }, null, 2));
}
main();
