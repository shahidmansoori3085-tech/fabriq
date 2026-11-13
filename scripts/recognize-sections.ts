/**
 * Recognise every traced section and compare with the role the templates give it.
 *   npx tsx scripts/recognize-sections.ts            → table + mismatches
 *   npx tsx scripts/recognize-sections.ts --write    → lib/studio/shapes/roles.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { recognize } from "../lib/studio/recognize";
import { BUILT_IN_PROFILES } from "../lib/studio/templates";
import { shapeOf } from "../lib/studio/shapes";

const files = ["omeo", "ample", "eleanor", "banuhashim", "banuhashim-euro", "banuhashim-27", "alucoat"];
const out: Record<string, { role: string; grooves?: number; why: string }> = {};
for (const f of files) {
  const book = JSON.parse(readFileSync(`lib/studio/shapes/${f}.json`, "utf8")) as Record<string, { w: number; h: number; paths: string[] }>;
  for (const [code, s] of Object.entries(book)) out[`${f}:${code}`] = recognize(s);
}
const KIND_ROLE: Record<string, string[]> = {
  shutter: ["glass-shutter", "double-glass-shutter"], handle: ["glass-shutter", "double-glass-shutter"], "mesh-shutter": ["mesh-shutter"],
  track: ["track", "side-track"], frame: ["track"], "slim-interlock": ["slim-interlock"], rail: ["clip"],
};
const rows: string[] = [], odd: string[] = [];
for (const p of BUILT_IN_PROFILES) {
  const s = shapeOf(p); if (!s || !p.kind) continue;
  if (p.id.startsWith("z_") || ["handle_std", "interlock", "bearing"].includes(p.id)) continue; // casement and Bombay: not covered yet
  const r = recognize(s);
  const ok = (KIND_ROLE[p.kind] ?? []).includes(r.role);
  const line = `${ok ? "  " : "✗ "}${p.id.padEnd(18)} ${s.code.padEnd(10)} app: ${p.kind.padEnd(15)} shape: ${r.role}${r.grooves ? ` (${r.grooves})` : ""} — ${r.why}`;
  rows.push(line); if (!ok && KIND_ROLE[p.kind]) odd.push(line);
}
console.log(rows.join("\n"));
console.log(`\n${odd.length} sections whose shape does not match their job in the app:\n${odd.join("\n")}`);
if (process.argv.includes("--write")) writeFileSync("lib/studio/shapes/roles.json", JSON.stringify(out, null, 0));
