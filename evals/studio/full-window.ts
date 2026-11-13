/**
 * Full cut lists of every system built from its drawings.
 *   npx tsx evals/studio/full-window.ts
 *
 * Frame: 45° systems cut W and H; Gulf (90°) sides H, top/bottom W − 2 × side.
 * Shutters W/2. Glass smaller than its shutter on both sides. Meeting pieces
 * (interlock / slim interlock / patti) run the shutter height. A shutter with a
 * big slim interlock gets its own glass width.
 */
import { TEMPLATES } from "../../lib/studio/templates";
import { evaluate } from "../../lib/studio/evaluate";

const IN = 25400;
const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };

// [id, gulf side mm or 0 for 45°, glass width known, glass height known]
const SYSTEMS: [string, number, boolean, boolean][] = [
  ["domal-27", 0, true, true], ["ample-27", 0, true, true], ["eleanor-27", 0, true, true], ["bh-27", 0, false, false],
  ["ample-22", 0, false, true], ["euro-26", 0, true, true], ["ample-25", 0, false, false], ["ample-29", 0, false, true],
  ["ample-37", 0, false, true], ["gulf-25", 24.8, true, true], ["bh-35", 32.8, true, true], ["bh-31", 33.1, true, true],
  ["gulf-s30", 33, true, true],
];

for (const [id, side, gw, gh] of SYSTEMS) {
  const sys = TEMPLATES.find((s) => s.id === id);
  if (!sys) { fails.push(`${id}: missing`); continue; }
  for (const [w, h] of [[48, 48], [60, 48], [72, 60], [96, 72]]) {
    const W = w * IN, H = h * IN;
    const r = evaluate(sys, { id: "W", W, H, qty: 1, tracks: 2, mix: "GG" }, { allowUnknown: true });
    const at = (place: RegExp) => r.pieces.filter((p) => place.test(p.role));
    const frameTop = at(/^(Frame Top|Top Track|Top)$/)[0], frameSide = at(/^(Frame Left|Left Side)/)[0];
    const sh = at(/Shutter Left|Handle Side/)[0], st = at(/Shutter Top/)[0];
    const tag = `${id} ${w}×${h}`;
    expect(!!frameTop && !!frameSide && !!sh && !!st, `${tag}: frame or shutter pieces missing`);
    if (!frameTop || !frameSide || !sh || !st) continue;
    if (side === 0) {
      expect(frameTop.angle === 45 && frameTop.length === W && frameSide.length === H, `${tag}: 45° frame should be W × H, is ${frameTop.length} × ${frameSide.length} @${frameTop.angle}`);
    } else {
      expect(frameTop.angle === 90 && frameSide.length === H && Math.abs(frameTop.length - (W - 2 * side * 1000)) <= 1, `${tag}: Gulf frame should be sides H, top W − ${2 * side}`);
    }
    expect(st.length === Math.round(W / 2), `${tag}: shutter width should be W/2, is ${st.length}`);
    expect(sh.length > 0 && sh.length < H - 20000, `${tag}: shutter height ${sh.length} looks wrong`);
    for (const m of at(/Interlock|Slim/)) expect(m.length === sh.length, `${tag}: ${m.role} should run the shutter height`);
    const clip = at(/Roller Clip/)[0];
    if (clip) expect(clip.length > W - 140000 && clip.length < frameTop.length + 1, `${tag}: clip ${clip.length} should sit inside the frame`);
    const g = r.panels[0];
    if (gw) expect(g.w > 0 && g.w < st.length - 40000, `${tag}: glass width ${g.w} should be known and well inside the shutter`);
    if (gh) expect(g.h > 0 && g.h < sh.length - 40000, `${tag}: glass height ${g.h} should be known and well inside the shutter`);
  }
}

// a big slim interlock on one shutter changes only that shutter's glass
{
  const sys = TEMPLATES.find((s) => s.id === "gulf-25")!;
  const r = evaluate(sys, { id: "W", W: 60 * IN, H: 48 * IN, qty: 1, tracks: 2, mix: "GG", perShutter: [{ pick_shutterMeet: "bh_2556" }, { pick_shutterMeet: "bh_2557" }] });
  expect(r.panels.length === 2 && r.panels[0].w !== r.panels[1].w, "gulf-25: small and big slim interlock should give two glass widths");
}

if (fails.length) { console.error(`\nfull-window: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log(`full-window: ${SYSTEMS.length} systems × 4 sizes — frames, shutters, meeting pieces, clips and glass hold ✓`);
