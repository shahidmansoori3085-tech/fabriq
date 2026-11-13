/**
 * Teach / check behaviour of the System Studio.
 *   npx tsx evals/studio/teach.ts
 */
import { evaluate, StudioUnknownError } from "../../lib/studio/evaluate";
import { teach, check, TOLERANCE } from "../../lib/studio/teach";
import { NORMAL_18, AMPLE_22, TEMPLATES } from "../../lib/studio/templates";
import type { StudioSystem, TaughtJob } from "../../lib/studio/model";

const IN = 25400, SUT = 3175;
const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };
const job = (over: Partial<TaughtJob>): TaughtJob =>
  ({ id: "J1", W: 72 * IN, H: 60 * IN, tracks: 3, mix: "GGJ", switches: {}, measured: {}, at: "test", ...over });

// 1. Founder's 72×60 3-track job taught into a system whose height is unknown.
{
  const blankH: StudioSystem = structuredClone(NORMAL_18);
  const sh = blankH.sizes.find((s) => s.id === "shutterH")!;
  sh.cases = [{ base: "H", add: null, evidence: { status: "unknown", source: "" } }];
  const before = JSON.stringify(blankH);

  let threw = false;
  try { evaluate(blankH, { id: "W1", W: 72 * IN, H: 60 * IN, qty: 1, tracks: 3, mix: "GGJ" }); }
  catch (e) { threw = e instanceof StudioUnknownError && e.missing.some((m) => /height/i.test(m)); }
  expect(threw, "unknown shutter height must block cutting and name the size");

  const r = teach(blankH, job({ measured: { handle: Math.round(58.375 * IN) } }));
  expect(JSON.stringify(blankH) === before, "teach must not change the system it was given");
  const l = r.learned.find((x) => x.size === "shutterH");
  expect(!!l && Math.abs(l.constant - -Math.round(1.625 * IN)) <= 1, `learned height constant ${l?.constant}, expected −1⅝″`);

  // same track count, another mix and size: height now known
  const out = evaluate(r.system, { id: "W2", W: 48 * IN, H: 48 * IN, qty: 1, tracks: 3, mix: "GGG" });
  const hd = out.pieces.find((p) => p.role === "S1 Handle")!;
  expect(Math.abs(hd.length - (48 - 1.625) * IN) <= 1, `3T handle on 48″ should be 46⅜″, got ${hd.length / IN}`);
  expect(out.sizes.find((s) => s.id === "shutterH")!.status === "suggested", "a once-taught size is 'suggested'");

  // 2-track was never taught: still blocked — no silent guessing across layouts
  let blocked = false;
  try { evaluate(r.system, { id: "W3", W: 48 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG" }); }
  catch (e) { blocked = e instanceof StudioUnknownError; }
  expect(blocked, "a layout that was not taught must stay blocked");

  // 2. Check on a second real job: within ½ sut → verified
  const c = check(r.system, job({ id: "J2", W: 66 * IN, H: 54 * IN, measured: { interlock: Math.round(52.375 * IN) } }));
  expect(c.allOk, "second job within tolerance should pass");
  expect(evaluate(c.system, { id: "W", W: 60 * IN, H: 60 * IN, qty: 1, tracks: 3, mix: "GGJ" })
    .sizes.find((s) => s.id === "shutterH")!.status === "verified", "passed check marks the rule verified");

  // 3. A wrong measurement is caught and named, not averaged in
  const bad = check(r.system, job({ id: "J3", W: 66 * IN, H: 54 * IN, measured: { handle: Math.round(51.375 * IN) } }));
  expect(!bad.allOk && bad.rows[0].label.includes("height") && Math.abs(bad.rows[0].diff! + IN) <= 1,
    "a 1″ misread must fail the check and name shutter height");
}

// 4. A job that agrees with an existing verified rule changes nothing.
{
  const r = teach(NORMAL_18, job({ measured: { handle: Math.round(58.375 * IN) } }));
  const l = r.learned.find((x) => x.size === "shutterH")!;
  expect(!l.changed && r.system.version === NORMAL_18.version, "a confirming job must not create a new rule or version");
}

// 5. Two pieces cut to the same size but measured differently → flagged.
{
  const r = teach(NORMAL_18, job({ measured: { handle: Math.round(58.375 * IN), interlock: Math.round(58 * IN) } }));
  expect(r.conflicts.length === 1, "handle and interlock disagreeing must be flagged");
}

// 6. A catalogue-only draft (Ample 22): fully taught from one window, then
//    checked on a different width. Test numbers only — not real shop data.
{
  // a copy with every cut unknown (the shipped draft now carries drawing-derived rules)
  const A22: StudioSystem = structuredClone(AMPLE_22);
  for (const sz of A22.sizes) { const last = sz.cases[sz.cases.length - 1]; sz.cases = [{ ...last, when: undefined, add: null, evidence: { status: "unknown", source: "" } }]; }
  let threw = false;
  try { evaluate(A22, { id: "W1", W: 48 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG" }); }
  catch (e) { threw = e instanceof StudioUnknownError && e.missing.length >= 4; }
  expect(threw, "Ample 22 draft must refuse to cut before it is taught");

  const cuts = (W: number, H: number) => ({
    frameTop: W, frameLeft: H,
    shutterTop: Math.round(W / 2) - 4 * SUT, shutterLock: H - 20 * SUT,
  });
  const g = (W: number, H: number) => ({ w: Math.round(W / 2) - 4 * SUT - 28 * SUT, h: H - 20 * SUT - 28 * SUT });
  const t = teach(A22, job({ W: 48 * IN, H: 48 * IN, tracks: 2, mix: "GG", measured: cuts(48 * IN, 48 * IN), glass: g(48 * IN, 48 * IN) }));
  expect(t.skipped.length === 0 && t.conflicts.length === 0, `22 mm teach skipped ${JSON.stringify(t.skipped)}`);
  const r = evaluate(t.system, { id: "W2", W: 60 * IN, H: 52 * IN, qty: 1, tracks: 2, mix: "GJ" });
  expect(r.pieces.length === 4 + 8 + 0, `22 mm GJ: 4 frame + 8 shutter pieces, no interlock — got ${r.pieces.length}`);
  const c = check(t.system, job({ id: "J2", W: 60 * IN, H: 52 * IN, tracks: 2, mix: "GG", measured: cuts(60 * IN, 52 * IN), glass: g(60 * IN, 52 * IN) }));
  expect(c.allOk, `22 mm check on a second width: ${JSON.stringify(c.rows.filter((x) => !x.ok))}`);
}

// 6b. Video-based drafts give the video numbers, labelled "observed".
{
  const d35 = TEMPLATES.find((s) => s.id === "domal-35")!;
  let noSection = false;
  try { evaluate(d35, { id: "W1", W: 60 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG", switches: { track: "2" } }); }
  catch (e) { noSection = e instanceof StudioUnknownError && e.missing.every((m) => m.startsWith("Section for")); }
  expect(noSection, "a draft with no sections chosen must ask for sections (and only that)");
  const r = evaluate(d35, { id: "W1", W: 60 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG", switches: { track: "2" } }, { allowUnknown: true });
  const v = (id: string) => r.sizes.find((s) => s.id === id)!;
  expect(Math.abs(v("shutterH").value! - 45 * IN) <= 1 && v("shutterH").status === "observed", "35×75 2″ track: H − 3″, observed");
  expect(Math.abs(v("shutterW").value! - 29.8125 * IN) <= 1, "35×75 2-track width (W − ⅜″) ÷ 2");
  const r4 = evaluate(d35, { id: "W1", W: 120 * IN, H: 60 * IN, qty: 1, tracks: 4, mix: "GGGJ" }, { allowUnknown: true });
  expect(r4.pieces.filter((p) => /Interlock/.test(p.role)).length === 4, "3+1: 2 glass meetings × 2 patti");
}

// 6c. One window, two interlocks: small on one shutter, slim on the next.
{
  const a29 = TEMPLATES.find((t) => t.id === "ample-29")!;
  const r = evaluate(a29, { id: "W1", W: 60 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG", perShutter: [{}, { pick_shutterMeet: "a29_slim" }] }, { allowUnknown: true });
  const meet = r.pieces.filter((p) => /Interlock/.test(p.role)).map((p) => `${p.role}:${p.sectionId}`);
  expect(meet.join(",") === "S1 Interlock:a29_interlock,S2 Interlock:a29_slim", `per-shutter interlock: ${meet.join(",")}`);
}

// 7. Every template is well-formed: sizes only use W, H or an earlier size;
//    parts and infill point at real sizes.
for (const sys of TEMPLATES) {
  const known = new Set(["W", "H"]);
  for (const s of sys.sizes) {
    for (const c of s.cases) if (!known.has(c.base)) fails.push(`${sys.id}: size ${s.id} uses ${c.base} before it exists`);
    known.add(s.id);
  }
  for (const p of sys.parts) if (!known.has(p.length)) fails.push(`${sys.id}: part ${p.id} cut to missing size ${p.length}`);
  if (!known.has(sys.infill.w) || !known.has(sys.infill.h)) fails.push(`${sys.id}: infill sizes missing`);
}
expect(TOLERANCE === 1588, "tolerance is ½ sut");

if (fails.length) { console.error("Studio teach FAILED:"); for (const f of fails) console.error(" ✗ " + f); process.exit(1); }
console.log("Studio teach/check: all cases pass.");
