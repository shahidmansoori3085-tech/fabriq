/**
 * Look for anything wrong in every built-in system: run every layout and mix at
 * several sizes and check the data and the results.
 *   npx tsx scripts/audit-studio.ts
 */
import { TEMPLATES, BUILT_IN_PROFILES, PART_KIND } from "../lib/studio/templates";
import { evaluate, computeSizes, jobVars, matches } from "../lib/studio/evaluate";
import { shapeOf } from "../lib/studio/shapes";
import { pickSwitchId } from "../lib/studio/edit";

const IN = 25400;
const issues: string[] = [];
const say = (sys: string, m: string) => issues.push(`${sys}: ${m}`);
const ids = new Set<string>();

for (const sys of TEMPLATES) {
  if (ids.has(sys.id)) say(sys.id, "duplicate system id"); ids.add(sys.id);
  const find = (id: string) => sys.profiles.find((p) => p.id === id) ?? BUILT_IN_PROFILES.find((p) => p.id === id);
  // profiles
  const pids = new Set<string>();
  for (const p of sys.profiles) {
    if (pids.has(p.id)) say(sys.id, `profile ${p.id} listed twice`); pids.add(p.id);
    if (!p.size && p.codes && Object.keys(p.codes).length) say(sys.id, `profile ${p.id} has no size`);
    if (p.kg && (!(p.kg.value > 0) || !(p.kg.perFt > 0))) say(sys.id, `profile ${p.id} weight looks wrong`);
    if (p.codes && Object.keys(p.codes).length && !shapeOf(p)) say(sys.id, `profile ${p.id} (${Object.values(p.codes).join("/")}) has no traced drawing`);
  }
  // parts → sections exist
  for (const part of sys.parts) {
    for (const o of part.profile) if (o.id && !find(o.id)) say(sys.id, `part ${part.id} uses missing section ${o.id}`);
    if (part.meshProfile && !find(part.meshProfile)) say(sys.id, `part ${part.id} mesh section ${part.meshProfile} missing`);
    if (!sys.sizes.some((s) => s.id === part.length)) say(sys.id, `part ${part.id} length "${part.length}" is not a size`);
    if (!PART_KIND[part.id] && sys.family !== "casement") say(sys.id, `part ${part.id} has no kind for the section picker`);
  }
  // sizes: base must be W, H or an earlier size
  sys.sizes.forEach((s, i) => {
    for (const c of s.cases) {
      if (!["W", "H", ...sys.sizes.slice(0, i).map((x) => x.id)].includes(c.base)) say(sys.id, `size ${s.id} starts from ${c.base}, not known yet`);
      for (const k of Object.keys(c.when ?? {})) if (!["tracks", "glass", "shutters", "mix", ...sys.switches.map((w) => w.id)].includes(k)) say(sys.id, `size ${s.id} rule depends on unknown "${k}"`);
    }
    if (!s.cases.some((c) => !c.when)) say(sys.id, `size ${s.id} has no catch-all rule`);
  });
  for (const sw of sys.switches) if (!sw.options.some((o) => o.value === sw.default)) say(sys.id, `switch ${sw.id} default "${sw.default}" is not an option`);
  // run every layout / mix at several sizes
  for (const lay of sys.layouts) for (const mix of lay.mixes) for (const [w, h] of [[36, 36], [60, 48], [96, 72], [144, 96]]) {
    const W = w * IN, H = h * IN, tag = `${lay.tracks}T ${mix} ${w}×${h}`;
    let r;
    try { r = evaluate(sys, { id: "A", W, H, qty: 2, tracks: lay.tracks, mix }, { allowUnknown: true }); }
    catch (e) { say(sys.id, `${tag}: crashed — ${(e as Error).message}`); continue; }
    const { values } = computeSizes(sys, { id: "A", W, H, qty: 1, tracks: lay.tracks, mix });
    for (const [k, v] of Object.entries(values)) if (v !== null && (!Number.isFinite(v) || v <= 0)) say(sys.id, `${tag}: size ${k} = ${v}`);
    for (const p of r.pieces) {
      if (!p.sectionId) say(sys.id, `${tag}: "${p.role}" has no section`);
      if (p.length > Math.max(W, H) + 1) say(sys.id, `${tag}: "${p.role}" ${p.length} longer than the window`);
      if (p.length < 0) say(sys.id, `${tag}: "${p.role}" negative`);
      if (p.angle !== 45 && p.angle !== 90) say(sys.id, `${tag}: "${p.role}" angle ${p.angle}`);
    }
    for (const g of r.panels) {
      if (g.w && values.shutterW && g.w >= values.shutterW) say(sys.id, `${tag}: glass wider than its shutter`);
      if (g.h && values.shutterH && g.h >= values.shutterH) say(sys.id, `${tag}: glass taller than its shutter`);
    }
    const frames = r.pieces.filter((p) => /^(Frame|Top|Bottom|Left|Right|Outer)/.test(p.role) && p.itemId === "A.1");
    if (sys.family !== "casement" && frames.length && frames.length !== 4) say(sys.id, `${tag}: ${frames.length} frame pieces, expected 4`);
    const sh = mix.length;
    // meeting pieces: 2 per glass–glass meeting for each meeting part in use (its 'when' matches)
    const vars = jobVars(sys, { id: "A", W, H, qty: 1, tracks: lay.tracks, mix });
    const meetParts = sys.parts.filter((p) => p.scope === "meeting" && p.enabled !== false && matches(p.when, vars));
    const want = meetParts.reduce((n, p) => n + p.count * Math.max(0, [...mix].filter((c) => c !== "J").length - 1), 0);
    const got = r.pieces.filter((p) => p.itemId === "A.1" && meetParts.some((m) => p.role.startsWith(m.role.split(" {k}")[0]))).length;
    if (got !== want) say(sys.id, `${tag}: ${got} meeting pieces, expected ${want}`);
    void sh;
  }
  // per-shutter picks exist
  const pick = sys.switches.find((s) => s.id === pickSwitchId("shutterMeet"));
  if (pick) for (const o of pick.options) if (!find(o.value)) say(sys.id, `slim choice ${o.value} missing`);
}
console.log(issues.length ? issues.join("\n") : "no issues");
console.log(`\n${issues.length} issues in ${TEMPLATES.length} systems`);
