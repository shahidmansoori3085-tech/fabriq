/**
 * Writes docs/SYSTEMS-REFERENCE.md straight from lib/studio/templates.ts,
 * so the agents' system reference can never drift from what the app cuts.
 *
 *   npx tsx scripts/systems-reference.ts          (write the file)
 *   npx tsx scripts/systems-reference.ts --check  (fail if it is out of date)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATES, OFFERED } from "../lib/studio/templates";
import { evaluate } from "../lib/studio/evaluate";
import type { SizeCase, StudioSystem } from "../lib/studio/model";

const OUT = join(__dirname, "..", "docs", "SYSTEMS-REFERENCE.md");
const mm = (u: number) => (u / 1000).toFixed(1).replace(/\.0$/, "");

function formula(c: SizeCase): string {
  const num = c.num ?? 1, den = c.den ?? 1;
  let f = num === 1 ? c.base : `${num} × ${c.base}`;
  if (c.pre) f = `(${f} ${c.pre < 0 ? "−" : "+"} ${mm(Math.abs(c.pre))})`;
  if (den !== 1) f = `${f} ÷ ${den}`;
  if (c.add === null) return `${f} + **UNKNOWN** (app refuses to cut)`;
  if (c.add) f = `${f} ${c.add < 0 ? "−" : "+"} ${mm(Math.abs(c.add))}`;
  return f;
}
const when = (w?: Record<string, string | string[]>) =>
  w ? Object.entries(w).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("/") : v}`).join(", ") : "always";

function section(s: StudioSystem, id: string): string {
  if (!id) return "(none — no catalogue section)";
  const p = s.profiles.find((x) => x.id === id);
  if (!p) return id;
  const codes = [...new Set(Object.values(p.codes ?? {}).filter(Boolean))].join(" / ");
  return `${p.name}${codes ? ` — code ${codes}` : ""}${p.size ? ` — ${p.size} mm` : ""}${p.kind ? ` — ${p.kind}` : ""}`;
}

function example(s: StudioSystem): string[] {
  const W = 1828800, H = 1219200; // 6 ft × 4 ft
  const out: string[] = [];
  const layout = s.layouts.find((l) => l.tracks === 2) ?? s.layouts[0];
  const mix = layout.mixes.find((m) => !m.includes("J")) ?? layout.mixes[0];
  const sets: Record<string, string>[] = [{}];
  const meet = s.switches.find((x) => x.id === "meet");
  if (meet) for (const o of meet.options) if (o.value !== meet.default) sets.push({ meet: o.value });
  for (const sw of sets) {
    try {
      const r = evaluate(s, { id: "W1", W, H, qty: 1, tracks: layout.tracks, mix, switches: sw }, { allowUnknown: true });
      out.push("", `Worked example: 6′×4′ (1828.8 × 1219.2 mm), ${layout.tracks} track, ${mix}${Object.keys(sw).length ? `, ${when(sw)}` : ", default choices"}:`, "");
      const seen = new Map<string, number>();
      for (const p of r.pieces) {
        const key = `${p.role.replace(/^S\d+\s*/, "Shutter ")} | ${mm(p.length)} mm | ${p.angle ?? 90}°`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      out.push("| Piece | Length | Cut | Pieces |", "|---|---|---|---|");
      for (const [k, n] of seen) { const [a, b, c] = k.split(" | "); out.push(`| ${a} | ${b} | ${c} | ${n} |`); }
      for (const pn of r.panels) out.push(`| Glass/mesh ${pn.kind} | ${mm(pn.w)} × ${mm(pn.h)} mm | — | ${pn.count} |`);
      if (r.missing.length) out.push("", `Still unknown here: ${r.missing.join(", ")} — the app will not cut these.`);
    } catch (e) {
      out.push("", `Worked example could not run: ${(e as Error).message}`);
    }
  }
  return out;
}

const L: string[] = [
  "# Systems reference (generated — do not edit by hand)",
  "",
  "Made by `npx tsx scripts/systems-reference.ts` from `lib/studio/templates.ts`.",
  "If you change a system, run it again. `--check` fails when this file is stale.",
  "Read `docs/WINDOW-KNOWLEDGE.md` first: it explains what every word here means.",
  "",
  "Evidence: **verified** = founder's real job · **observed** = shop videos / founder said ·",
  "**suggested** = worked out from catalogue drawings, must be checked on one real window ·",
  "**UNKNOWN** = nobody knows yet, the app blocks the cut.",
  "",
  "Sizes are worked top to bottom; each line may use the ones above it. The first",
  "line whose condition matches wins. Shutter width shares (W ÷ 2, (W − K) ÷ 3 …) are",
  "worked out by the shutter layout, so a plain `W` there means \"the share\".",
];

for (const s of TEMPLATES) {
  if (!OFFERED.has(s.id)) continue;
  L.push("", "---", "", `## ${s.name}`, "");
  L.push(`- App id: \`${s.id}\` · family: ${s.family} · series: ${s.series ? `${s.series.type} ${s.series.mm} mm` : "—"} · status: ${s.status}`);
  L.push(`- In short: ${s.blurb}`);
  L.push(`- Layouts: ${s.layouts.map((l) => `${l.tracks} track (${l.mixes.join(", ")})`).join("; ")}  (G glass, J jali/mesh)`);
  if (s.switches.length) {
    L.push("- Choices the shop makes:");
    for (const w of s.switches) L.push(`  - ${w.label} (\`${w.id}\`): ${w.options.map((o) => `${o.label}${o.value === w.default ? " (default)" : ""}`).join(" · ")}`);
  }
  L.push("", "Pieces:", "", "| Piece | Per | Qty | Length rule | Cut | Section |", "|---|---|---|---|---|---|");
  for (const p of s.parts) {
    const role = p.role.replace(/\{s\}\s*/g, "").replace(/\{tag\}/g, "").replace(/\s*\{k\}/g, "");
    const secs = p.profile.map((c) => (p.profile.length > 1 ? `${when(c.when)}: ${section(s, c.id)}` : section(s, c.id))).join("<br>");
    L.push(`| ${role}${p.when ? ` (only if ${when(p.when)})` : ""} | ${p.scope} | ${p.count} | ${p.length} | ${p.angle}° | ${secs} |`);
  }
  L.push("", "Size rules:", "", "| Size | When | Rule | Evidence | Why |", "|---|---|---|---|---|");
  for (const z of s.sizes) for (const c of z.cases)
    L.push(`| ${z.label} (\`${z.id}\`) | ${when(c.when)} | ${formula(c)} | ${c.add === null ? "unknown" : c.evidence.status} | ${(c.evidence.source || "—").replace(/\|/g, "/")} |`);
  L.push(...example(s));
}
L.push("");
const text = L.join("\n");

if (process.argv.includes("--check")) {
  let old = "";
  try { old = readFileSync(OUT, "utf8"); } catch { /* missing */ }
  if (old.replace(/\r\n/g, "\n") !== text) { console.error("docs/SYSTEMS-REFERENCE.md is out of date: run npx tsx scripts/systems-reference.ts"); process.exit(1); }
  console.log("systems reference up to date");
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT} (${L.length} lines)`);
}
