/**
 * Every traced section, grouped by what the recogniser calls it — to look at.
 *   npx tsx scripts/recognize-gallery.ts <out dir>   (reads lib/studio/shapes/roles.json)
 */
import { readFileSync, writeFileSync } from "node:fs";
const roles = JSON.parse(readFileSync("lib/studio/shapes/roles.json", "utf8")) as Record<string, { role: string; grooves?: number; why: string }>;
const books: Record<string, Record<string, { w: number; h: number; paths: string[] }>> = {};
const out = process.argv[2] ?? ".";
const groups = new Map<string, string[]>();
for (const k of Object.keys(roles)) { const r = roles[k].role; groups.set(r, [...(groups.get(r) ?? []), k]); }
for (const [role, keys] of groups) {
  const cards = keys.map((k) => {
    const [file, code] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
    books[file] ??= JSON.parse(readFileSync(`lib/studio/shapes/${file}.json`, "utf8"));
    const s = books[file][code]; if (!s) return "";
    const pad = Math.max(s.w, s.h) * 0.06;
    return `<div class="c"><svg viewBox="${-pad} ${-pad} ${s.w + 2 * pad} ${s.h + 2 * pad}"><path d="${s.paths.join("")}" fill="#5b6b7c" fill-rule="evenodd" stroke="#2b3540" stroke-width="${Math.max(s.w, s.h) / 300}"/></svg><div class="n">${code}</div><div class="m">${file} · ${s.w}×${s.h}</div><div class="t">${roles[k].why}</div></div>`;
  }).join("");
  writeFileSync(`${out}/role-${role}.html`, `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;font:13px system-ui;width:1176px}h1{font-size:20px;margin:0 0 8px}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}.c{border:1px solid #d8dde3;border-radius:8px;padding:4px;text-align:center}svg{width:100%;height:90px;background:#f5f7f9}.n{font-weight:700;font-size:14px}.m{color:#666;font-size:11px}.t{font-size:10px;color:#333}</style><h1>${role} (${keys.length})</h1><div class="g">${cards}</div>`);
  console.log(role, keys.length);
}
