/**
 * Ready drafts the shop starts from. Numbers carry their evidence:
 *   verified = measured on a real founder job
 *   observed = seen in shop videos we read ourselves (not yet measured)
 *   unknown  = no evidence; the shop teaches it from one of its own windows
 * Section codes and sizes come from catalogue pages read on 2026-11-09/10
 * (OMEO, Ample 22/25/26/27-domal/29/37, Banu Hashim 31). Where a catalogue
 * prints no name, the part a section plays is read from its drawing and is
 * labelled "role read from drawing — confirm".
 * No number here comes from doc 18 (see docs/studio/FORMULA_EVIDENCE_REGISTER.md).
 *
 * normal-18 and domal-27 must reproduce the built-in engine EXACTLY —
 * evals/studio/parity.ts checks every golden path.
 */
import { mm, inches } from "../engine/units";
import type {
  StudioSystem, SizeDef, SizeCase, PartDef, ProfileDef, Evidence, ExtraDef, Cond, ProfileKind, Place, SeriesType,
} from "./model";
import { withAlternatives } from "./edit";

const SUT = 3175;
const ev = (status: Evidence["status"], source: string): Evidence => ({ status, source });
const UNKNOWN = ev("unknown", "");
const size = (id: string, label: string, ...cases: SizeCase[]): SizeDef => ({ id, label, cases });
const rule = (base: string, add: number | null, evidence: Evidence, more: Partial<SizeCase> = {}): SizeCase =>
  ({ base, add, evidence, ...more });
const unknownFrom = (base: string, more: Partial<SizeCase> = {}) => rule(base, null, UNKNOWN, more);

type ProfSpec = string | { when?: Cond; id: string }[];
function part(id: string, role: string, profile: ProfSpec, scope: PartDef["scope"],
  length: string, angle: 90 | 45, place: Place, more: Partial<PartDef> = {}): PartDef {
  return { id, role, profile: typeof profile === "string" ? [{ id: profile }] : profile, scope, count: 1, length, angle, place, ...more };
}
const prof = (id: string, name: string, kind: ProfileKind, codes: Record<string, string>, sizeMm: string,
  kg: ProfileDef["kg"], source: Evidence, more: Partial<ProfileDef> = {}): ProfileDef =>
  ({ id, name, kind, codes, size: sizeMm, kg, stockFt: [16], source, ...more });
/** Catalogue weight printed per metre → our {value, perFt} */
const perM = (kg: number) => ({ value: kg, perFt: 3.2808 });

const SLIDING_EXTRAS: ExtraDef[] = [
  { id: "rollers", name: "Rollers / Bearings", kind: "count", per: "shutter", qty: 2, formula: "2 per shutter", unit: "nos" },
  { id: "lock", name: "Lock", kind: "count", per: "window", qty: 1, formula: "1 per window/door", unit: "nos" },
  { id: "cleats", name: "Cleats (cast)", kind: "count", per: "window", qty: 4, formula: "4 per frame", unit: "nos" },
  { id: "woolpile", name: "Wool pile", kind: "perimeter", per: "shutter", of: ["shutterW", "shutterH"], formula: "2×(shutterH+shutterW)×shutters +5%", unit: "rft" },
];

const MODE_SWITCH = {
  id: "mode", label: "Shutter size",
  options: [{ value: "half", label: "Half each (opens 50%)" }, { value: "equal", label: "Equal share (opens more)" }],
  default: "half",
};

const CATALOGUE = (s: string) => ev("verified", s);
const DRAWING = (s: string) => ev("observed", `${s} — role read from drawing, confirm`);
const FOUNDER = (s: string) => ev("verified", `Founder job: ${s}`);
const VIDEO = (s: string) => ev("observed", `Shop videos: ${s}`);
const FROM_DRAWING_35 = (t: string) => ev("suggested", `From the drawings (window built from the sections): ${t}. Check on one window.`);

const L2 = (...mixes: string[]) => ({ tracks: 2, mixes: mixes.length ? mixes : ["GG", "GJ", "JJ"] });
const L3 = (...mixes: string[]) => ({ tracks: 3, mixes: mixes.length ? mixes : ["GGJ", "GGG", "GJJ", "GG"] });
const byTracks = (two: string, three: string): ProfSpec => [{ when: { tracks: ["1", "2"] }, id: two }, { id: three }];

/* ———————————————— shared shapes ———————————————— */

/** Domal-type frame: one track profile on 4 sides, 45°. */
const domalFrame = (p: ProfSpec, w = "frameW", h = "frameH"): PartDef[] => [
  part("frameTop", "Frame Top", p, "window", w, 45, "frame-top"),
  part("frameLeft", "Frame Left", p, "window", h, 45, "frame-left"),
  part("frameRight", "Frame Right", p, "window", h, 45, "frame-right"),
  part("frameBottom", "Frame Bottom", p, "window", w, 45, "frame-bottom"),
];

/** Shutter made of one profile on top, bottom and handle side, and an interlock
 *  profile on the meeting side (Ample 22 / 25 / 26 / 29 / 37, slim systems). */
function stileShutter(sash: string, meet: ProfSpec, meetLabel = "Interlock"): PartDef[] {
  return [
    part("shutterTop", "{s} Shutter Top{tag}", sash, "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", sash, "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", sash, "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", `{s} ${meetLabel}{tag}`, meet, "shutter", "shutterH", 45, "sash-meet"),
  ];
}

const UNKNOWN_SIZES = (): SizeDef[] => [
  size("frameW", "Frame top / bottom", unknownFrom("W")),
  size("frameH", "Frame side", unknownFrom("H")),
  size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
  size("shutterH", "Shutter height", unknownFrom("H")),
  size("glassW", "Glass width", unknownFrom("shutterW")),
  size("glassH", "Glass height", unknownFrom("shutterH")),
];

const base = (o: Partial<StudioSystem> & Pick<StudioSystem, "id" | "name" | "blurb" | "parts" | "sizes">): StudioSystem => ({
  family: "domal-type", version: 1, status: "draft", layouts: [L2("GG", "GJ"), L3("GGJ", "GGG")],
  switches: [], profiles: [], infill: { w: "glassW", h: "glassH" }, extras: SLIDING_EXTRAS,
  wastagePct: 5, jobs: [], ...o,
});

/* ———————————————— Normal / Bombay 18 mm (verified) ———————————————— */
export const NORMAL_18: StudioSystem = {
  id: "normal-18", name: "Normal sliding 18 mm (Bombay)", family: "sliding", group: "ready", maker: "OMEO",
  blurb: "Top + 2 sides + bottom track at 90°; shutter from handle, interlock and 2 bearings",
  version: 1, status: "verified",
  layouts: [L2(), L3()],
  switches: [MODE_SWITCH],
  profiles: [
    prof("2t_top", "2-Track Top/Side", "track", { omeo: "1000", alpro: "1801" }, "62×32", { value: 2.5, perFt: 16 }, CATALOGUE("OMEO catalogue")),
    prof("2t_bottom", "2-Track Bottom", "track", { omeo: "1011", alpro: "1821" }, "62×32", { value: 2.5, perFt: 16 }, CATALOGUE("OMEO catalogue")),
    prof("3t_top", "3-Track Top/Side", "track", { omeo: "1021" }, "92×32", { value: 2.7, perFt: 16 }, CATALOGUE("OMEO catalogue")),
    prof("3t_bottom", "3-Track Bottom", "track", { omeo: "1031", alpro: "1831" }, "92×32", { value: 2.7, perFt: 16 }, CATALOGUE("OMEO catalogue")),
    prof("handle_std", 'Handle 3/4"×1.5"', "handle", { omeo: "1041", alpro: "1841" }, "40×18", { value: 1.3, perFt: 16 }, CATALOGUE("OMEO catalogue")),
    prof("interlock", "Interlock Stile 40×18", "interlock", { omeo: "1081" }, "40×18", { value: 1.2, perFt: 16 }, CATALOGUE("OMEO catalogue"), { faceMm: 25 }),
    prof("bearing", "Bottom Bearing / Rail 40×18", "bearing", { omeo: "1051" }, "40×18", { value: 1.3, perFt: 16 }, CATALOGUE("OMEO catalogue"), { faceMm: 40 }),
  ],
  sizes: [
    size("trackW", "Top / bottom track", rule("W", -6 * SUT, FOUNDER("90° frame, track sits between the sides (W − 6 sut)"))),
    size("sideH", "Frame side", rule("H", 0, FOUNDER("sides run full height"))),
    size("shutterW", "Shutter width",
      rule("W", mm(80), VIDEO("3 glass share: (W − 7½″) ÷ 3, + 80 mm handle/interlock"), { when: { mode: "equal", glass: "3" }, pre: -inches(7.5), den: 3 }),
      rule("W", mm(80), VIDEO("4 glass share: (W − 11″) ÷ 4, + 80 mm"), { when: { mode: "equal", glass: "4" }, pre: -inches(11), den: 4 }),
      rule("W", 0, FOUNDER("every shutter is half the window"), { den: 2 })),
    size("shutterH", "Shutter height (handle, interlock)", rule("H", -mm(41.3), FOUNDER("72×60 3-track, handle 58⅜″"))),
    size("bearing", "Bearing (top & bottom)", rule("shutterW", -mm(80), FOUNDER("shutter width − handle and interlock"))),
    size("glassW", "Glass width", rule("shutterW", -mm(64.125), VIDEO("bearing + 5 sut (5 videos)"))),
    size("glassH", "Glass height", rule("shutterH", -mm(66.675), VIDEO("H − 4″2 sut"))),
  ],
  parts: [
    part("top", "Top", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "trackW", 90, "frame-top"),
    part("left", "Left Side", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "sideH", 90, "frame-left"),
    part("right", "Right Side", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "sideH", 90, "frame-right"),
    part("bottom", "Bottom", [{ when: { tracks: "3" }, id: "3t_bottom" }, { id: "2t_bottom" }], "window", "trackW", 90, "frame-bottom"),
    part("handle", "{s} Handle{tag}", "handle_std", "shutter", "shutterH", 90, "sash-lock"),
    part("interlock", "{s} Interlock{tag}", "interlock", "shutter", "shutterH", 90, "sash-meet"),
    part("bearingTop", "{s} Bearing Top{tag}", "bearing", "shutter", "bearing", 90, "sash-top"),
    part("bearingBottom", "{s} Bearing Bottom{tag}", "bearing", "shutter", "bearing", 90, "sash-bottom"),
  ],
  infill: { w: "glassW", h: "glassH" },
  extras: SLIDING_EXTRAS,
  wastagePct: 5,
  jobs: [],
  notes: ["A 4-track window has no 4-track section in the master yet — it is built on the 2-track top/bottom."],
};

/* ———————————————— Domal 27×65 OMEO (verified) ———————————————— */
const DOMAL_27_SIZES: SizeDef[] = [
  size("frameW", "Frame top / bottom", rule("W", 0, FOUNDER("45° frame, full width"))),
  size("frameH", "Frame side", rule("H", 0, FOUNDER("45° frame, full height"))),
  size("shutterW", "Shutter width",
    rule("W", 0, VIDEO("3 glass share: (W + 1⅝″) ÷ 3"), { when: { mode: "equal", glass: "3" }, pre: inches(1.625), den: 3 }),
    rule("W", 0, VIDEO("4 glass share: (W + 4″) ÷ 4"), { when: { mode: "equal", glass: "4" }, pre: inches(4), den: 4 }),
    rule("W", 0, FOUNDER("every shutter is half the window"), { den: 2 })),
  size("shutterH", "Shutter height", rule("H", -mm(66.7), FOUNDER("66×58 3-track, shutter side 55⅜″"))),
  size("glassW", "Glass width", rule("shutterW", -mm(102), FOUNDER("shutter − 102 mm; videos 4″–4⅛″"))),
  size("glassH", "Glass height", rule("shutterH", -mm(102), FOUNDER("shutter − 102 mm; videos 4″–4⅛″"))),
];

export const DOMAL_27: StudioSystem = {
  id: "domal-27", name: "Domal 27×65", family: "domal-type", group: "ready", maker: "OMEO",
  heightFrom: { kind: "domal-legs" },
  blurb: "45° frame (2-track 2051 / 3-track 2062); one shutter profile on all 4 sides + interlock patti",
  version: 1, status: "verified",
  layouts: [L2(), L3()],
  switches: [MODE_SWITCH],
  profiles: [
    prof("domal_frame_2t", "Domal 2-Track Frame", "frame", { omeo: "2051" }, "45×45", { value: 3.2, perFt: 15 }, CATALOGUE("OMEO 2051")),
    prof("domal_frame", "Domal 3-Track Frame 80×45", "frame", { omeo: "2062" }, "80.5×45.4", { value: 4.968, perFt: 16 }, CATALOGUE("OMEO 2062")),
    prof("domal_glass_shutter", "Domal Glass Shutter", "shutter", { omeo: "2046/2047" }, "65×27", { value: 3.2, perFt: 15 }, CATALOGUE("OMEO 2046")),
    prof("domal_jali_shutter", "Domal Mesh Shutter", "mesh-shutter", { omeo: "2081/2082" }, "65.3×27.3", { value: 3.226, perFt: 12 }, CATALOGUE("OMEO 2081")),
    prof("domal_interlock", "Domal Interlock Patti 39×28", "interlock-patti", { omeo: "2091" }, "39.4×28", { value: 0.88, perFt: 12 }, CATALOGUE("OMEO 2091"), { faceMm: 10 }),
  ],
  sizes: DOMAL_27_SIZES,
  parts: [
    ...domalFrame(byTracks("domal_frame_2t", "domal_frame")),
    part("shutterTop", "{s} Shutter Top{tag}", "domal_glass_shutter", "shutter", "shutterW", 45, "sash-top", { meshProfile: "domal_jali_shutter" }),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "domal_glass_shutter", "shutter", "shutterW", 45, "sash-bottom", { meshProfile: "domal_jali_shutter" }),
    part("shutterLeft", "{s} Shutter Left{tag}", "domal_glass_shutter", "shutter", "shutterH", 45, "sash-lock", { meshProfile: "domal_jali_shutter" }),
    part("shutterRight", "{s} Shutter Right{tag}", "domal_glass_shutter", "shutter", "shutterH", 45, "sash-meet", { meshProfile: "domal_jali_shutter" }),
    part("interlock", "Interlock {k}", "domal_interlock", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  infill: { w: "glassW", h: "glassH" },
  extras: SLIDING_EXTRAS,
  wastagePct: 5,
  jobs: [],
};

/* ———————————————— Bombay-type drafts ———————————————— */

export const NORMAL_25: StudioSystem = {
  ...NORMAL_18,
  id: "normal-25", name: "25 mm sliding — Bombay type (1″×2″)", group: "bombay", maker: undefined, status: "draft",
  blurb: "Like 18 mm Bombay but 1″ deep: handle, built-in interlock, top and bearing. Choose your sections.",
  layouts: [L2("GG", "GJ"), L3("GGJ", "GGG")],
  switches: [],
  profiles: [
    prof("2t_top_25", "25 mm 2-Track Top/Side 50×25", "track", { omeo: "2000" }, "50×25", { value: 1.6, perFt: 16 }, CATALOGUE("OMEO 2000")),
    prof("2t_bottom_25", "25 mm 2-Track Bottom 50×25", "track", { omeo: "2011" }, "50×25", { value: 1.77, perFt: 16 }, CATALOGUE("OMEO 2011")),
    prof("3t_top_25", "25 mm 3-Track Top/Side 75×25", "track", {}, "75×25", { value: 2.4, perFt: 16 }, CATALOGUE("Bombay 25")),
    prof("3t_bottom_25", "25 mm 3-Track Bottom 75×25", "track", {}, "75×25", { value: 2.6, perFt: 16 }, CATALOGUE("Bombay 25")),
    prof("handle_25", '25 mm Handle Stile (1″×2″)', "handle", { omeo: "2000" }, "50×25", { value: 1.6, perFt: 16 }, CATALOGUE("OMEO 2000")),
    prof("interlock_25", '25 mm Interlock Stile (1″×2″)', "interlock", {}, "50×25", { value: 1.5, perFt: 16 }, CATALOGUE("Bombay 25")),
    prof("bearing_25", "25 mm Bottom Bearing / Top Rail", "bearing", { omeo: "2031" }, "50×25", { value: 1.625, perFt: 16 }, CATALOGUE("OMEO 2031")),
  ],
  sizes: [
    size("trackW", "Top / bottom track", unknownFrom("W")),
    size("sideH", "Frame side", unknownFrom("H")),
    size("shutterH", "Shutter height (handle, interlock)", rule("H", -inches(1.125), VIDEO("H − 1⅛″"))),
    size("bearing", "Bearing (top & bottom)",
      rule("W", 0, VIDEO("2-track: (W − 7½″) ÷ 2"), { when: { tracks: "2" }, pre: -inches(7.5), den: 2 }),
      unknownFrom("W", { den: 3 })),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("glassW", "Glass width", rule("bearing", inches(0.75), VIDEO("bearing + ¾″"))),
    size("glassH", "Glass height", rule("shutterH", -inches(4.125), VIDEO("shutter − 4⅛″"))),
  ],
  parts: [
    part("top", "Top", [{ when: { tracks: "3" }, id: "3t_top_25" }, { id: "2t_top_25" }], "window", "trackW", 90, "frame-top"),
    part("left", "Left Side", [{ when: { tracks: "3" }, id: "3t_top_25" }, { id: "2t_top_25" }], "window", "sideH", 90, "frame-left"),
    part("right", "Right Side", [{ when: { tracks: "3" }, id: "3t_top_25" }, { id: "2t_top_25" }], "window", "sideH", 90, "frame-right"),
    part("bottom", "Bottom", [{ when: { tracks: "3" }, id: "3t_bottom_25" }, { id: "2t_bottom_25" }], "window", "trackW", 90, "frame-bottom"),
    part("handle", "{s} Handle{tag}", "handle_25", "shutter", "shutterH", 90, "sash-lock"),
    part("interlock", "{s} Interlock{tag}", "interlock_25", "shutter", "shutterH", 90, "sash-meet"),
    part("bearingTop", "{s} Bearing Top{tag}", "bearing_25", "shutter", "bearing", 90, "sash-top"),
    part("bearingBottom", "{s} Bearing Bottom{tag}", "bearing_25", "shutter", "bearing", 90, "sash-bottom"),
  ],
  notes: ["Choose your sections. Track and side cuts are not known yet — teach them from one window."],
};

export const NORMAL_5T: StudioSystem = {
  ...NORMAL_25,
  id: "normal-5t", name: "5-track 50 mm sliding", group: "special",
  blurb: "2″ 5-track frame; handle, interlock and bearing shutters. Choose your sections.",
  layouts: [{ tracks: 5, mixes: ["GGGGJ", "GGGGG", "GGGJJ"] }],
  sizes: [
    size("trackW", "Top / bottom track", unknownFrom("W")),
    size("sideH", "Frame side", unknownFrom("H")),
    size("shutterH", "Shutter height (handle, interlock)", rule("H", -inches(1.5), VIDEO("H − 1½″"))),
    size("bearing", "Bearing (top & bottom)", rule("W", 0, VIDEO("(W − 13¾″) ÷ 5"), { pre: -inches(13.75), den: 5 })),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 5 })),
    size("glassW", "Glass width", rule("bearing", 5 * SUT, VIDEO("bearing + 5 sut"))),
    size("glassH", "Glass height", rule("shutterH", -inches(3.5), VIDEO("shutter − 3½″"))),
  ],
};

/* ———————————————— Domal-type drafts ———————————————— */

/** Ample's own 27×65 domal set. Same shape as OMEO 2046, so OMEO's measured cuts are offered — check once. */
export const AMPLE_27: StudioSystem = base({
  id: "ample-27", name: "Domal 27×65 — Ample", group: "domal", maker: "Ample",
  heightFrom: { kind: "domal-legs" },
  blurb: "Ample 214314 / 214313 track, 214315 shutter on 4 sides, 214342 interlock patti",
  switches: [MODE_SWITCH],
  layouts: [L2(), L3()],
  profiles: [
    prof("a27_track_2t", "Domal 2-Track", "frame", { ample: "214314" }, "45×45", perM(0.68), CATALOGUE("Ample domal p.2")),
    prof("a27_track_3t", "Domal 3-Track", "frame", { ample: "214313" }, "76×45.51", perM(1.06), CATALOGUE("Ample domal p.2")),
    prof("a27_track_3t_box", "Domal 3-Track (box)", "frame", { ample: "42054" }, "130×46", perM(1.844), CATALOGUE("Ample domal p.3")),
    prof("a27_track_2t_leg", "Domal 2-Track with leg", "frame", { ample: "214319" }, "117.7×44.98", perM(1.25), DRAWING("Ample domal p.2")),
    prof("a27_shutter", "Domal Shutter", "shutter", { ample: "214315" }, "65.98×25.99", perM(0.67), CATALOGUE("Ample domal p.2")),
    prof("a27_patti", "Interlock Patti", "interlock-patti", { ample: "214342" }, "9.68×7.1", perM(0.27), DRAWING("Ample domal p.3"), { faceMm: 10 }),
  ],
  sizes: DOMAL_27_SIZES.map((s) => ({
    ...s,
    cases: s.cases.map((c) => (c.evidence.status === "verified"
      ? { ...c, evidence: ev("observed", `Same 27×65 shape as OMEO — ${c.evidence.source}. Check once on yours.`) } : c)),
  })),
  parts: [
    ...domalFrame(byTracks("a27_track_2t", "a27_track_3t")),
    part("shutterTop", "{s} Shutter Top{tag}", "a27_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "a27_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "a27_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "a27_shutter", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "a27_patti", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
});

/**
 * Banu Hashim 27×65 domal (catalogue pp.42–46). Same build as OMEO domal, but
 * its running legs stand 48.9 mm (OMEO 45.4), so the shutter is ~7 mm shorter.
 * Measured by building the window from the traced drawings (lib/studio/assemble.ts).
 */
export const BH_27: StudioSystem = withAlternatives(base({
  id: "bh-27", name: "Domal 27×65 — Banu Hashim", group: "domal", maker: "Banu Hashim",
  blurb: "BH-6032 2-track / 6040 3-track with leg, 45°; shutter BH-2122 on 4 sides; domal clip 6048 or interlock 2118",
  switches: [MODE_SWITCH],
  layouts: [L2(), L3()],
  profiles: [
    prof("bh27_t2", "Domal 27 2-Track with Leg", "frame", { bh: "BH-6032" }, "66.3×49.91", { value: 4.2, perFt: 12 }, CATALOGUE("Banu Hashim p.44")),
    prof("bh27_t3", "Domal 27 3-Track with Leg", "frame", { bh: "BH-6040" }, "101.9×50", { value: 5.45, perFt: 12 }, CATALOGUE("Banu Hashim p.45")),
    prof("bh27_t4", "Domal 27 4-Track with Leg", "frame", { bh: "BH-6045" }, "136×49.81", { value: 7.55, perFt: 12 }, CATALOGUE("Banu Hashim p.45")),
    prof("bh27_t1", "Domal 27 Single Track", "frame", { bh: "BH-6031" }, "39.7×48.2", { value: 2.1, perFt: 12 }, CATALOGUE("Banu Hashim p.44")),
    prof("bh27_shutter", "Domal 27 Shutter 66×26", "shutter", { bh: "BH-2122" }, "66×26", { value: 2.3, perFt: 12 }, CATALOGUE("Banu Hashim p.42")),
    prof("bh27_clip", "Domal Clip", "interlock-patti", { bh: "BH-6048" }, "39×28.7", { value: 1.1, perFt: 12 }, CATALOGUE("Banu Hashim p.46"), { faceMm: 10 }),
    prof("bh27_interlock", "Interlock", "interlock-patti", { bh: "BH-2118" }, "28.1×28.5", { value: 0.9, perFt: 12 }, CATALOGUE("Banu Hashim p.42"), { faceMm: 10 }),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "Domal frame goes round at 45°, full width (as OMEO)"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "Domal frame goes round at 45°, full height (as OMEO)"))),
    size("shutterW", "Shutter width", rule("W", 0, ev("observed", "Half the window, as Domal"), { den: 2 })),
    size("shutterH", "Shutter height",
      rule("H", -mm(73.7), ev("suggested", "From the drawings (window built from the sections): 2 × 48.9 leg − 24 roller. OMEO is H − 66.7: these legs stand 3.5 mm taller. Check on one window."), { when: { tracks: "2" } }),
      rule("H", -mm(74.3), ev("suggested", "From the drawings (window built from the sections): 2 × 49.2 leg (BH-6040) − 24 roller. Check on one window."), { when: { tracks: "3" } }),
      unknownFrom("H")),
    size("glassW", "Glass width", unknownFrom("shutterW")),
    size("glassH", "Glass height", unknownFrom("shutterH")),
  ],
  parts: [
    ...domalFrame(byTracks("bh27_t2", "bh27_t3")),
    part("shutterTop", "{s} Shutter Top{tag}", "bh27_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh27_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "bh27_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "bh27_shutter", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "bh27_clip", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: [
    "Banu Hashim's 27 mm domal legs stand 48.9 mm; OMEO, Ample and Eleanor stand 45. Do not use an OMEO cut list with these tracks: the shutter comes out about 7 mm too long.",
    "Glass not worked out yet: the shutter 2122 drawing shares its page with a photo and does not trace cleanly. Teach it from one window.",
  ],
}), "interlock", ["bh27_clip", "bh27_interlock"]);

/** Eleanor's 27 mm domal set (catalogue pages 28–29). Codes and sizes printed; roles read from the drawings. */
export const ELEANOR_27: StudioSystem = {
  ...AMPLE_27,
  id: "eleanor-27", name: "Domal 27×65 — Eleanor", maker: "Eleanor",
  blurb: "Eleanor 2701 2-track / 2702 3-track frame, 2722 shutter on 4 sides; pick your interlock patti",
  profiles: [
    prof("el_2701", "27 mm 2-Track Frame", "frame", { eleanor: "2701" }, "45×45", { value: 2.9, perFt: 12 }, DRAWING("Eleanor p.28")),
    prof("el_2702", "27 mm 3-Track Frame", "frame", { eleanor: "2702" }, "75×45", { value: 4.45, perFt: 12 }, DRAWING("Eleanor p.28")),
    prof("el_2703", "27 mm 3-Track Frame (leg)", "frame", { eleanor: "2703" }, "75×45", { value: 4.0, perFt: 12 }, DRAWING("Eleanor p.28")),
    prof("el_2704", "27 mm 3-Track + Mesh Frame", "frame", { eleanor: "2704" }, "80.5×45.4", { value: 4.0, perFt: 12 }, DRAWING("Eleanor p.28")),
    prof("el_2722", "27 mm Shutter", "shutter", { eleanor: "2722" }, "65×27", { value: 2.7, perFt: 12 }, DRAWING("Eleanor p.29")),
    prof("el_2720", "27 mm Shutter (light)", "shutter", { eleanor: "2720" }, "65×26", { value: 2.2, perFt: 12 }, DRAWING("Eleanor p.29")),
    prof("el_2719", "27 mm Shutter 66", "shutter", { eleanor: "2719" }, "66×27", { value: 2.7, perFt: 12 }, DRAWING("Eleanor p.29")),
    prof("el_2718", "27 mm Shutter (hook)", "shutter", { eleanor: "2718" }, "65×27", { value: 2.85, perFt: 12 }, DRAWING("Eleanor p.29")),
    prof("el_2725", "27 mm Interlock Patti", "interlock-patti", { eleanor: "2725" }, "28.5×39", { value: 1.03, perFt: 12 }, DRAWING("Eleanor p.30 — same shape as OMEO 2091"), { faceMm: 10 }),
    prof("el_2726", "27 mm Interlock Patti (B)", "interlock-patti", { eleanor: "2726" }, "27.9×39.5", { value: 1.0, perFt: 12 }, DRAWING("Eleanor p.30"), { faceMm: 10 }),
  ],
  parts: [
    ...domalFrame(byTracks("el_2701", "el_2702")),
    part("shutterTop", "{s} Shutter Top{tag}", "el_2722", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "el_2722", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "el_2722", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "el_2722", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "el_2725", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Eleanor prints codes and sizes but not names — which section does which job is read from the drawings. Interlock patti 2725 has the shape of OMEO 2091; 2726 is the other one on the page."],
};

/**
 * Domal 35×75 (founder: 35 mm comes as Domal, Euro and Gulf). Domal = the tracks
 * with running legs: Banu Hashim 6701 / 6703 (42.6) and 6702 / 6704 (48, two legs).
 * The 46.3 U-groove tracks (6705 / 6706 = Eleanor 3501 / 3502) are Euro 35.
 * Cuts from the window built from the drawings (24 mm roller on the legs).
 */
export const DOMAL_35: StudioSystem = withAlternatives(base({
  id: "domal-35", name: "Domal 35×75", group: "domal",
  heightFrom: { kind: "domal-legs" },
  blurb: "One 75×35 shutter on all 4 sides + I/L clip; leg track 42.6 (BH 6701 / 6703) or 48 with 2 legs (6702 / 6704)",
  layouts: [L2(), L3(), { tracks: 4, mixes: ["GGGJ"] }, { tracks: 5, mixes: ["GGGGJ"] }],
  switches: [{
    id: "track", label: "Track", default: "42",
    options: [
      { value: "42", label: "42.6 mm, one leg" },
      { value: "48", label: "48 mm, two legs" },
    ],
  }],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "45° frame goes round, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "45° frame goes round, full height"))),
    size("shutterW", "Shutter width",
      rule("W", 0, VIDEO("2-track: (W − ⅜″) ÷ 2"), { when: { tracks: "2" }, pre: -inches(0.375), den: 2 }),
      rule("W", 0, VIDEO("3+1: (W + 2⅞″) ÷ 3"), { when: { tracks: "4" }, pre: inches(2.875), den: 3 }),
      rule("W", 0, VIDEO("4+1: (W + 5⅞″) ÷ 4"), { when: { tracks: "5" }, pre: inches(5.875), den: 4 }),
      rule("W", 0, ev("observed", "Every shutter half the window (W/2)"), { den: 2 })),
    size("shutterH", "Shutter height",
      rule("H", -mm(61.1), FROM_DRAWING_35("2 × 42.6 track − 24 roller; the 1¾″-track videos cut H − 2⅜″ (60.3), 0.8 mm apart"), { when: { tracks: "2", track: "42" } }),
      rule("H", -mm(60.8), FROM_DRAWING_35("2 × 42.4 track − 24 roller"), { when: { tracks: "3", track: "42" } }),
      rule("H", -mm(71.8), FROM_DRAWING_35("2 × 47.9 track − 24 roller"), { when: { tracks: ["2", "3"], track: "48" } }),
      rule("H", -inches(2.875), VIDEO("3+1 / 4+1: H − 2⅞″"))),
    size("glassW", "Glass width",
      rule("shutterW", -mm(118), FROM_DRAWING_35("glass stops 59 mm in from each shutter edge (BH-6712); the videos cut shutter − 4⅝″ (117.5)"), { when: { tracks: ["2", "3"] } }),
      rule("shutterW", -inches(5), VIDEO("3+1 / 4+1: shutter − 5″"))),
    size("glassH", "Glass height",
      rule("shutterH", -mm(118), FROM_DRAWING_35("glass stops 59 mm in from each shutter edge (BH-6712); the videos cut shutter − 4⅝″ (117.5)"), { when: { tracks: ["2", "3"] } }),
      rule("shutterH", -inches(5), VIDEO("3+1 / 4+1: shutter − 5″"))),
  ],
  profiles: [
    prof("d35_track_2t", "Domal 35 2-Track with Leg", "frame", { bh: "BH-6701" }, "77.01×42.62", { value: 5.03, perFt: 12 }, CATALOGUE("Banu Hashim p.66")),
    prof("d35_track_3t", "Domal 35 3-Track with Leg", "frame", { bh: "BH-6703" }, "122×42.5", { value: 7.9, perFt: 12 }, CATALOGUE("Banu Hashim p.66")),
    prof("d35_t2_48", "Domal 35 2-Track with 2 Legs", "frame", { bh: "BH-6702" }, "95×48", { value: 6.5, perFt: 12 }, CATALOGUE("Banu Hashim p.66")),
    prof("d35_t3_48", "Domal 35 3-Track with 2 Legs", "frame", { bh: "BH-6704" }, "139.8×47.85", { value: 8.7, perFt: 12 }, CATALOGUE("Banu Hashim p.67")),
    prof("d35_shutter", "Domal 35 Shutter 75×35", "shutter", { bh: "BH-6712" }, "75×35", { value: 4.0, perFt: 12 }, CATALOGUE("Banu Hashim p.69")),
    prof("d35_shutter_dgu", "Domal 35 Shutter 75×35 (double glass)", "shutter", { bh: "BH-6713" }, "75×35", { value: 3.75, perFt: 12 }, CATALOGUE("Banu Hashim p.70")),
    prof("d35_clip", "Domal 35 I/L Clip", "interlock-patti", { bh: "BH-6711", eleanor: "3510" }, "41×38.9", { value: 1.5, perFt: 12 }, CATALOGUE("Banu Hashim p.69 / Eleanor p.35"), { faceMm: 12 }),
    prof("d35_interlock", "Domal 35 Interlock", "interlock", { bh: "BH-6707", eleanor: "3506" }, "42.55×31", { value: 2.5, perFt: 12 }, CATALOGUE("Banu Hashim p.68 / Eleanor p.35")),
  ],
  parts: [
    ...domalFrame([
      { when: { tracks: "2", track: "42" }, id: "d35_track_2t" }, { when: { tracks: "3", track: "42" }, id: "d35_track_3t" },
      { when: { tracks: "2", track: "48" }, id: "d35_t2_48" }, { when: { tracks: "3", track: "48" }, id: "d35_t3_48" },
      { id: "" },
    ]),
    part("shutterTop", "{s} Shutter Top{tag}", "d35_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "d35_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "d35_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "d35_shutter", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "d35_clip", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: [
    "35 mm comes as Domal (this), Euro (U-groove track with clip) and Gulf (one-groove sides). Banu Hashim and Eleanor print the same 35×75 shutter and clip.",
    "4-track (3+1) and 5-track (4+1) have no section in the catalogues here — choose your frame; their cuts come from shop videos.",
    "The mesh shutter is taken as the same width as a glass shutter — check it on your first job.",
  ],
}), "interlock", ["d35_clip", "d35_interlock"]);

/**
 * Euro 35 (founder: 35 mm comes as Domal, Euro and Gulf). Banu Hashim 6705 / 6706
 * and Eleanor 3501 / 3502 print the same U-groove track (46.3); a roller clip sits
 * in each groove. Shutter 75×35 on 3 sides; slim interlock small (6707) or big
 * (6709), shutter by shutter. Built from the drawings.
 */
export const EURO_35: StudioSystem = withAlternatives(base({
  id: "euro-35", name: "Euro 35 mm — Banu Hashim / Eleanor", group: "gulf", maker: "Banu Hashim",
  blurb: "U-groove track 6705 / 6706 (= Eleanor 3501 / 3502) all round with roller clip; shutter 6712; slim interlock small (6707) or big (6709)",
  layouts: [L2(), L3()],
  profiles: [
    prof("e35_t2", "Euro 35 2-Track", "frame", { bh: "BH-6705", eleanor: "3501" }, "77.71×46.3", { value: 4.58, perFt: 12 }, CATALOGUE("Banu Hashim p.67 / Eleanor p.35")),
    prof("e35_t3", "Euro 35 3-Track", "frame", { bh: "BH-6706", eleanor: "3502" }, "124.09×46.3", { value: 6.9, perFt: 12 }, CATALOGUE("Banu Hashim p.67 / Eleanor p.35")),
    prof("e35_clip", "Euro 35 Roller Clip (track rail)", "rail", { bh: "BH-6513" }, "14.5×17.96", { value: 0.65, perFt: 12 }, CATALOGUE("Banu Hashim p.65")),
    prof("e35_shutter", "Euro 35 Shutter 75×35", "shutter", { bh: "BH-6712", eleanor: "3503" }, "75×35", { value: 4.0, perFt: 12 }, CATALOGUE("Banu Hashim p.69 / Eleanor p.35")),
    prof("e35_slim", "Euro 35 Slim Interlock — small", "slim-interlock", { bh: "BH-6707", eleanor: "3506" }, "42.55×31", { value: 2.5, perFt: 12 }, CATALOGUE("Banu Hashim p.68"), { faceMm: 31 }),
    prof("e35_big", "Euro 35 Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-6709" }, "89.86×31.1", { value: 5.0, perFt: 12 }, CATALOGUE("Banu Hashim p.68"), { faceMm: 31 }),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "Euro track goes round at 45°, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "Euro track goes round at 45°, full height"))),
    size("clipW", "Roller clip", rule("W", -mm(92.6), FROM_DRAWING_35("clear width between the side U tips (2 × 46.3)"))),
    size("shutterW", "Shutter width", rule("W", 0, ev("observed", "Every shutter half the window (W/2)"), { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(72.6), FROM_DRAWING_35("2 × 46.3 track + 4.0 clip − 24 roller"))),
    size("glassW", "Glass width",
      rule("shutterW", -mm(73.1), FROM_DRAWING_35("shutter pocket 59.0 + slim 6707 pocket 14.1"), { when: { pick_shutterMeet: "e35_slim" } }),
      rule("shutterW", -mm(73.6), FROM_DRAWING_35("shutter pocket 59.0 + slim 6709 pocket 14.6"), { when: { pick_shutterMeet: "e35_big" } }),
      unknownFrom("shutterW")),
    size("glassH", "Glass height", rule("shutterH", -mm(118), FROM_DRAWING_35("glass stops 59 mm in from the top and bottom edges (6712)"))),
  ],
  parts: [
    ...domalFrame(byTracks("e35_t2", "e35_t3")),
    part("trackClip", "{s} Roller Clip", "e35_clip", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "e35_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "e35_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "e35_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "e35_slim", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Euro: the same U-groove track on all four sides; the roller runs on a clip in the bottom track.",
    "Banu Hashim and Eleanor print the same track, shutter and interlock sizes.",
  ],
}), "shutterMeet", ["e35_slim", "e35_big"]);

/**
 * Domal 20 — Banu Hashim Mini Domal 20 × 54 (catalogue pp.32–34, founder 2026-11-14).
 * Built from the drawings: the shutter 2507 runs on the track's U tops (2504 / 2505,
 * 31.4 high) with the 24 mm roller in its 30 mm channel → H − 38.8; its glass pocket
 * takes the glass 10.8 mm in → glass = shutter − 95.0 (Ample's 22 mm gives − 94.8).
 */
const BH20 = (p: number) => CATALOGUE("Banu Hashim Mini Domal p." + p);
export const MINI_DOMAL_20: StudioSystem = base({
  id: "mini-domal-20", name: "Domal 20 mm", group: "domal", maker: "Banu Hashim",
  heightFrom: { kind: "domal-legs" },
  blurb: "Track 2504 / 2505, shutter 2507 on all 4 sides, interlock clip 2509 (slim 2503)",
  profiles: [
    prof("md20_track_2t", "20 mm 2-Track", "track", { bh: "BH-2504" }, "56.3×31.4", { value: 2.1, perFt: 12 }, BH20(33)),
    prof("md20_track_3t", "20 mm 3-Track", "track", { bh: "BH-2505" }, "86.8×31.4", { value: 3.05, perFt: 12 }, BH20(33)),
    prof("md20_track_2t_leg", "20 mm 2-Track with leg", "track", { bh: "BH-2500" }, "56.5×36", { value: 2.6, perFt: 12 }, BH20(32)),
    prof("md20_track_3t_leg", "20 mm 3-Track with leg", "track", { bh: "BH-2501" }, "87×36", { value: 3.8, perFt: 12 }, BH20(32)),
    prof("md20_shutter", "20 mm Shutter", "shutter", { bh: "BH-2507" }, "54.4×20.7", { value: 2.3, perFt: 12 }, BH20(34)),
    prof("md20_shutter_b", "20 mm Shutter (light)", "shutter", { bh: "BH-2508" }, "54.4×20.7", { value: 1.9, perFt: 12 }, BH20(34), { shapeKey: "BH-2507" }),
    prof("md20_slim", "20 mm Slim Interlock", "slim-interlock", { bh: "BH-2503" }, "27.4×25", { value: 1.55, perFt: 12 }, BH20(33)),
    prof("md20_patti", "20 mm Interlock Clip (mini clip)", "interlock-patti", { bh: "BH-2509" }, "34×24.5", { value: 0.85, perFt: 12 }, BH20(34), { faceMm: 10 }),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "45° frame goes round, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "45° frame goes round, full height"))),
    size("shutterW", "Shutter width", rule("W", 0, ev("observed", "Every shutter half the window (W/2) — the usual shop way"), { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(38.8), FROM_DRAWING_35("2 × 31.4 track (2504 / 2505) − 24 roller; shutter 2507 runs on the U tops"))),
    size("glassW", "Glass width", rule("shutterW", -mm(95.0), FROM_DRAWING_35("glass goes 10.8 mm into the 2507 pocket: stops 47.5 mm in from each shutter edge"))),
    size("glassH", "Glass height", rule("shutterH", -mm(95.0), FROM_DRAWING_35("glass goes 10.8 mm into the 2507 pocket: stops 47.5 mm in from each shutter edge"))),
  ],
  parts: [
    ...domalFrame(byTracks("md20_track_2t", "md20_track_3t")),
    part("shutterTop", "{s} Shutter Top{tag}", "md20_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "md20_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "md20_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "md20_slim", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Domal 20 = a small domal (founder): the shutter runs on the track itself, the 24 mm roller in its channel. A leg on a track is design only.",
    "Slim 2503: glass slot 10.1 mm wide, 10.3 mm deep to the middle wall (measured by hand on the drawing; the T size mark sits on that wall) → glass edge 18.6 mm from the meeting edge.",
  ],
});

/** Ample 22 mm — light domal-type: shutter on 3 sides, interlock profile on the meeting side. */
export const AMPLE_22: StudioSystem = base({
  id: "ample-22", name: "22 mm mini domal — Ample", group: "domal", maker: "Ample",
  blurb: "35 mm track (41083 / 41084), no clip; shutter 41082 on all sides; jali shutter 41085",
  profiles: [
    prof("a22_track_2t", "22 mm 2-Track", "track", { ample: "41083" }, "53.9×35", perM(0.8), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_track_3t", "22 mm 3-Track", "track", { ample: "41084" }, "83.9×35", perM(1.13), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_shutter", "22 mm Shutter", "shutter", { ample: "41082" }, "55.8×22", perM(0.606), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_interlock", "22 mm Mesh (Jali) Shutter", "mesh-shutter", { ample: "41085" }, "65×22", perM(0.251),
      CATALOGUE("Ample 22 mm p.2 (the code is also printed on a 30.9×26.2 cap — confirm with dealer)")),
    prof("a22_clip", "22 mm Glazing Clip", "bead", { ample: "992134" }, "16.2×12.9", perM(0.117), CATALOGUE("Ample 22 mm p.2")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 3),
    size("shutterH", "Shutter height", rule("H", -mm(46), ev("suggested", "From the drawings (window built from the sections): 2 × 35.0 track − 24 roller; roller on the pointed track, no clip. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [...domalFrame(byTracks("a22_track_2t", "a22_track_3t")), ...stileShutter("a22_shutter", "a22_shutter", "Shutter Meeting Side").map((p) => ({ ...p, meshProfile: "a22_interlock" }))],
  notes: [
    "The shutter runs on the pointed track; the tall hooked wall on the outside is only design. No clip in the track.",
    "Catalogue gives sizes only. Teach every other cut from one window you have made.",
  ],
});

export const AMPLE_25: StudioSystem = base({
  id: "ample-25", name: "25 mm sliding — Ample", group: "domal", maker: "Ample",
  blurb: "40 mm U track (955388 / 955389) with roller clip 914401; shutter 41323 on all sides; interlock clip or slim interlock",
  profiles: [
    prof("a25_track_2t", "25 mm 2-Track", "track", { ample: "955388" }, "50×40", perM(0.795), CATALOGUE("Ample 25 mm p.2")),
    prof("a25_track_3t", "25 mm 3-Track", "track", { ample: "955389" }, "85.8×40", perM(1.24), CATALOGUE("Ample 25 mm p.2")),
    prof("a25_track_2t_leg", "25 mm 2-Track with leg", "track", { ample: "992012" }, "65.2×42.5", perM(1.015), DRAWING("Ample 25 mm p.2")),
    prof("a25_track_3t_leg", "25 mm 3-Track with leg", "track", { ample: "41021" }, "101×42.5", perM(1.45), DRAWING("Ample 25 mm p.2")),
    prof("a25_shutter", "25 mm Shutter", "shutter", { ample: "41323" }, "63×25.52", perM(0.75), DRAWING("Ample 25 mm p.2 — glass pocket on one side, track channel on the other")),
    prof("a25_interlock", "25 mm Section 914744 (not used in shops)", "shutter", { ample: "914744" }, "54.9×25.52", perM(0.635), DRAWING("Ample 25 mm p.2 — founder: not used")),
    prof("a25_clip", "25 mm Roller Clip", "rail", { ample: "914401" }, "12.99×16.09", perM(0.148), CATALOGUE("Ample 25 mm p.3; drawing traced from the 29 mm catalogue p.5")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(58.4), ev("suggested", "From the drawings (window built from the sections): 2 × 40.0 track + 2.4 clip − 24 roller. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    ...domalFrame(byTracks("a25_track_2t", "a25_track_3t")),
    part("trackClip", "{s} Roller Clip", "a25_clip", "shutter", "clipW", 90, "other"),
    ...stileShutter("a25_shutter", "a25_shutter", "Shutter Meeting Side"),
  ],
  notes: ["The roller runs on clip 914401 snapped into the track, like Euro. Any outer leg on the track is only design."],
});

export const AMPLE_26: StudioSystem = base({
  id: "ample-26", name: "26 mm sliding — Ample", group: "domal", maker: "Ample",
  blurb: "40 mm track (955388 / 995389); shutter 992265 with interlock 992266",
  profiles: [
    prof("a26_track_2t", "26 mm 2-Track", "track", { ample: "955388" }, "50×40", perM(0.795), CATALOGUE("Ample 26 mm p.2")),
    prof("a26_track_3t", "26 mm 3-Track", "track", { ample: "995389" }, "85.8×40", perM(1.24), CATALOGUE("Ample 26 mm p.2")),
    prof("a26_shutter", "26 mm Shutter", "shutter", { ample: "992265" }, "56×26", perM(0.694), DRAWING("Ample 26 mm p.2")),
    prof("a26_interlock", "26 mm Interlock", "interlock", { ample: "992266" }, "56×26", perM(0.753), DRAWING("Ample 26 mm p.3")),
  ],
  sizes: [...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")), ...UNKNOWN_SIZES().slice(2)],
  parts: [
    ...domalFrame(byTracks("a26_track_2t", "a26_track_3t")),
    part("trackClip", "{s} Roller Clip", "a25_clip", "shutter", "clipW", 90, "other"),
    ...stileShutter("a26_shutter", "a26_interlock"),
  ],
  notes: [
    "The roller runs on clip 914401 in the track (it is printed on the 26 mm page).",
    "Shutter 992265's channel on the track side is only 15 mm deep with a closed box behind it, so a 24 mm roller does not go fully in. Shutter height is not worked out until we know how the roller is fitted — teach it from one window.",
  ],
});

/* ———————————————— Sleek / slim-interlock drafts ———————————————— */

export const AMPLE_29: StudioSystem = withAlternatives(base({
  id: "ample-29", name: "29 mm sleek — Ample", group: "sleek", maker: "Ample",
  blurb: "47.7 mm U track with roller clip 914401; shutter 41055 on all sides + interlock clip 41054, or slim interlock; jali 41050",
  profiles: [
    prof("a29_track_2t", "29 mm 2-Track", "track", { ample: "914400" }, "50×47.69", perM(1.1), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_track_2t_b", "29 mm 2-Track (light)", "track", { ample: "914643" }, "50×47.7", perM(0.865), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_track_2t_leg", "29 mm 2-Track with leg", "track", { ample: "41010" }, "64.4×50.19", perM(1.325), CATALOGUE("Ample 29 mm p.3")),
    prof("a29_track_3t", "29 mm 3-Track", "track", { ample: "41052" }, "85.8×47.7", perM(1.724), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_track_3t_b", "29 mm 3-Track (light)", "track", { ample: "41053" }, "85.8×47.7", perM(1.42), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_track_3t_leg", "29 mm 3-Track with leg", "track", { ample: "41005" }, "100.2×50.19", perM(1.969), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_track_4t", "29 mm 4-Track", "track", { ample: "41008" }, "121.6×47.69", perM(2.328), CATALOGUE("Ample 29 mm p.2")),
    prof("a29_clip", "29 mm Roller Clip", "rail", { ample: "914401" }, "12.99×16.09", perM(0.148), CATALOGUE("Ample 29 mm p.5")),
    prof("a29_cap", "29 mm Track Cap", "rail", { ample: "914565" }, "14.49×11.65", perM(0.093), CATALOGUE("Ample 29 mm p.5")),
    prof("a29_handle", "29 mm Shutter", "shutter", { ample: "41055" }, "65×29", perM(0.89), CATALOGUE("Ample 29 mm p.3")),
    prof("a29_shutter_b", "29 mm Shutter (light)", "shutter", { ample: "914900" }, "65×29", perM(0.705), CATALOGUE("Ample 29 mm p.3")),
    prof("a29_shutter_54", "29 mm Section 914698 (not used in shops)", "shutter", { ample: "914698" }, "54×29", perM(0.617), CATALOGUE("Ample 29 mm p.3")),
    prof("a29_mesh", "29 mm Mesh (Jali) Shutter", "mesh-shutter", { ample: "41050" }, "65×29", perM(0.816), CATALOGUE("Ample 29 mm p.3 — jali shutter (founder)")),
    prof("a29_interlock_b", "29 mm Interlock (heavy)", "interlock", { ample: "992325" }, "65×29", perM(0.865), DRAWING("Ample 29 mm p.7")),
    prof("a29_slim_40", "29 mm Slim Interlock 40", "slim-interlock", { ample: "41289" }, "40×29", perM(0.672), CATALOGUE("Ample 29 mm p.5"), { faceMm: 40 }),
    prof("a29_slim", "29 mm Section 992328 (not used in shops)", "slim-interlock", { ample: "992328" }, "37×29", perM(0.595), DRAWING("Ample 29 mm p.7"), { faceMm: 37 }),
    prof("a29_spine", "29 mm Reinforcement", "interlock", { ample: "914806" }, "45×50.61", perM(1.104), CATALOGUE("Ample 29 mm p.5")),
    prof("a29_patti", "29 mm Interlock Clip", "interlock-patti", { ample: "41054" }, "33.63×38.89", perM(0.35), DRAWING("Ample 29 mm p.4"), { faceMm: 10 }),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(73.8), ev("suggested", "From the drawings (window built from the sections): 2 × 47.7 track + 2.4 clip − 24 roller. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    ...domalFrame(byTracks("a29_track_2t", "a29_track_3t")),
    part("trackClip", "{s} Roller Clip", "a29_clip", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "a29_handle", "shutter", "shutterW", 45, "sash-top", { meshProfile: "a29_mesh" }),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "a29_handle", "shutter", "shutterW", 45, "sash-bottom", { meshProfile: "a29_mesh" }),
    part("shutterLock", "{s} Handle Side{tag}", "a29_handle", "shutter", "shutterH", 45, "sash-lock", { meshProfile: "a29_mesh" }),
    part("shutterMeet", "{s} Shutter Meeting Side{tag}", "a29_handle", "shutter", "shutterH", 45, "sash-meet", { meshProfile: "a29_mesh" }),
  ],
  notes: [
    "The roller (24 mm) runs on clip 914401 snapped into the track. Any outer leg on a track is only design.",
    "41010 and 41330 are tracks with a leg, not shutter rails.",
  ],
}), "shutterMeet", ["a29_slim_40"]);

/**
 * Euro 29 — Eleanor (catalogue pages 32–33). Track 48.0 mm (2901 / 2902), so the
 * shutter comes 0.7 mm shorter than Ample / BH 47.7 (built from the drawings).
 */
const EL29 = (p: number) => CATALOGUE("Eleanor 29 mm p." + p);
export const ELEANOR_29: StudioSystem = base({
  id: "eleanor-29", name: "Euro 29 mm — Eleanor", group: "sleek", maker: "Eleanor",
  blurb: "48 mm U track 2901 / 2902 with roller clip 2917; shutter 2903 or 2906 on all sides (double glass 2909) + interlock clip 2918",
  profiles: [
    prof("el29_track_2t", "29 mm 2-Track", "track", { eleanor: "2901" }, "50×48", { value: 3.85, perFt: 12 }, EL29(32)),
    prof("el29_track_3t", "29 mm 3-Track", "track", { eleanor: "2902" }, "86.5×48", { value: 6.35, perFt: 12 }, EL29(32)),
    prof("el29_track_2t_b", "29 mm 2-Track (48.1)", "track", { eleanor: "2904" }, "50.1×48.1", { value: 3.9, perFt: 12 }, EL29(32)),
    prof("el29_track_3t_b", "29 mm 3-Track (48.6)", "track", { eleanor: "2905" }, "86.9×48.6", { value: 6.15, perFt: 12 }, EL29(32)),
    prof("el29_clip", "29 mm Roller Clip", "rail", { eleanor: "2917" }, "13×16", { value: 0.6, perFt: 12 }, EL29(33)),
    prof("el29_shutter", "29 mm Shutter", "shutter", { eleanor: "2903" }, "65×29", { value: 3.25, perFt: 12 }, EL29(32)),
    prof("el29_shutter_b", "29 mm Shutter (2906)", "shutter", { eleanor: "2906" }, "65×29", { value: 3.2, perFt: 12 }, EL29(32)),
    prof("el29_dgu", "29 mm Shutter (double glass)", "shutter", { eleanor: "2909" }, "65×29", { value: 2.9, perFt: 12 }, CATALOGUE("Eleanor 29 mm p.32 — double glass (founder)")),
    prof("el29_patti", "29 mm Interlock Clip", "interlock-patti", { eleanor: "2918" }, "32.5×38.5", { value: 1.15, perFt: 12 }, DRAWING("Eleanor 29 mm p.33"), { faceMm: 10 }),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "45° frame goes round, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "45° frame goes round, full height"))),
    size("clipW", "Roller clip", rule("W", -mm(96), FROM_DRAWING_35("clear width between the side U tips (2 × 48.0)"))),
    size("shutterW", "Shutter width", rule("W", 0, ev("observed", "Every shutter half the window (W/2) — the usual shop way"), { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(74.5), FROM_DRAWING_35("2 × 48.0 track + 2.5 clip − 24 roller (Ample / BH 47.7 track: H − 73.8)"))),
    size("glassW", "Glass width", rule("shutterW", -mm(108.7), FROM_DRAWING_35("glass stops 54.3 mm in from each shutter edge (2903)"))),
    size("glassH", "Glass height", rule("shutterH", -mm(108.7), FROM_DRAWING_35("glass stops 54.3 mm in from each shutter edge (2903)"))),
  ],
  parts: [
    ...domalFrame(byTracks("el29_track_2t", "el29_track_3t")),
    part("trackClip", "{s} Roller Clip", "el29_clip", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "el29_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "el29_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "el29_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Shutter Meeting Side{tag}", "el29_shutter", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "The roller (24 mm) runs on clip 2917 snapped into the track.",
    "Track 2904 (48.1) is 0.1 mm taller and 2905 (48.6) 0.6 mm taller than 2901 / 2902: with 2905 the shutter is H − 75.7. Teach from one window if you use them.",
    "Shutter choice (founder): 2903 or 2906 for single glass, 2909 for double glass. Glass: 2903 shutter − 108.7, 2906 / 2909 shutter − 106.3.",
  ],
});

export const AMPLE_37: StudioSystem = withAlternatives(base({
  id: "ample-37", name: "37 mm sleek — Ample", group: "sleek", maker: "Ample",
  blurb: "Track 41015 / 41014 with round roller clip 41310; shutter 41068 on all sides; double glass 41076; jali 41074",
  profiles: [
    prof("a37_track_2t", "37 mm 2-Track", "track", { ample: "41015" }, "90×53", perM(1.822), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_track_3t", "37 mm 3-Track", "track", { ample: "41014" }, "140×53", perM(2.688), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_track_3t_b", "37 mm 3-Track (square)", "track", { ample: "41016" }, "109.9×49.8", perM(2.309), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_clip", "37 mm Roller Clip", "rail", { ample: "41310" }, "13×17.09", perM(0.151), CATALOGUE("Ample 37 mm p.3"), { shapeKey: "41310-cap" }),
    prof("a37_cap", "37 mm Track Cap", "rail", { ample: "41083" }, "15.77×16.49", perM(0.8), CATALOGUE("Ample 37 mm p.3"), { shapeKey: "41083-37cap" }),
    prof("a37_handle", "37 mm Shutter", "shutter", { ample: "41068" }, "82.7×37.01", perM(1.335), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_handle_b", "37 mm Shutter (double glass)", "shutter", { ample: "41076" }, "82.7×37.01", perM(1.274), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_interlock", "37 mm Mesh (Jali) Shutter", "mesh-shutter", { ample: "41074" }, "82.7×37.01", perM(1.397), CATALOGUE("Ample 37 mm p.2")),
    prof("a37_slim", "37 mm Mesh (Jali) Shutter 41310", "mesh-shutter", { ample: "41310" }, "82.7×37.01", perM(1.35), DRAWING("Ample 37 mm p.3 — jali shutter (founder)"), { shapeKey: "41310-37" }),
    prof("a37_spine", "37 mm Reinforcement", "interlock", { ample: "914806" }, "45×50.61", perM(1.104), CATALOGUE("Ample 29 mm p.5")),
    prof("a37_frame_a", "37 mm Section 41300", "frame", { ample: "41300" }, "52.2×57.1", perM(1.055), CATALOGUE("Ample 37 mm p.3")),
    prof("a37_frame_b", "37 mm Section 41069", "frame", { ample: "41069" }, "52.21×44.94", perM(0.689), CATALOGUE("Ample 37 mm p.3")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(79.1), ev("suggested", "From the drawings (window built from the sections): 2 × 49.7 track + 3.8 clip − 24 roller. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    ...domalFrame(byTracks("a37_track_2t", "a37_track_3t")),
    part("trackClip", "{s} Roller Clip", "a37_clip", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "a37_handle", "shutter", "shutterW", 45, "sash-top", { meshProfile: "a37_interlock" }),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "a37_handle", "shutter", "shutterW", 45, "sash-bottom", { meshProfile: "a37_interlock" }),
    part("shutterLock", "{s} Handle Side{tag}", "a37_handle", "shutter", "shutterH", 45, "sash-lock", { meshProfile: "a37_interlock" }),
    part("shutterMeet", "{s} Shutter Meeting Side{tag}", "a37_handle", "shutter", "shutterH", 45, "sash-meet", { meshProfile: "a37_interlock" }),
  ],
  notes: [
    "The roller (24 mm) runs on the round clip 41310 (13 × 17.09) snapped into the track. The outer leg on the track is only design.",
    "What 41300 and 41069 are used for is not clear from the catalogue — they are kept in the section list only.",
  ],
}), "shutterMeet", ["a37_handle"]);

export const BH_31: StudioSystem = withAlternatives(base({
  id: "bh-31", name: "31 mm slim — Banu Hashim", group: "gulf", maker: "Banu Hashim",
  blurb: "Gulf: BH-6401 / 6403 top and bottom with roller clip; left and right one-groove BH-6400 / 6402; slim interlock small (6408) or big (6409)",
  profiles: [
    prof("bh31_track_2t", "31 mm Side Track, one groove (2-track)", "track", { bh: "BH-6400" }, "85×33.1", { value: 3.25, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_2t_leg", "31 mm 2-Track (top and bottom)", "track", { bh: "BH-6401" }, "80.8×47.6", { value: 4.95, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_3t", "31 mm Side Track, one groove (3-track)", "track", { bh: "BH-6402" }, "124.7×33.1", { value: 4.1, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_3t_leg", "31 mm 3-Track (top and bottom)", "track", { bh: "BH-6403" }, "120.5×47.6", { value: 6.65, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_rail_sgu", "31 mm Shutter Top / Bottom (single glass)", "shutter", { bh: "BH-6404" }, "65.9×29", { value: 3.85, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_rail_dgu", "31 mm Shutter Top / Bottom (double glass)", "shutter", { bh: "BH-6405" }, "65.9×29", { value: 3.55, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_handle_sgu", "31 mm Shutter (single glass)", "handle", { bh: "BH-6406" }, "59×31.4", { value: 3.45, perFt: 12 }, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_handle_dgu", "31 mm Shutter (double glass)", "handle", { bh: "BH-6407" }, "59×31.4", { value: 3.15, perFt: 12 }, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_slim", "31 mm Slim Interlock — small", "slim-interlock", { bh: "BH-6408" }, "38.1×20.2", { value: 2.5, perFt: 12 }, CATALOGUE("Banu Hashim p.58"), { faceMm: 20.2 }),
    prof("bh31_spine", "31 mm Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-6409" }, "80.1×20.2", { value: 4.5, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
    prof("bh31_slim_dgu", "31 mm Slim Interlock — small, double glass", "slim-interlock", { bh: "BH-6410" }, "38.1×20.2", { value: 2.1, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
    prof("bh31_spine_dgu", "31 mm Slim Interlock — big, double glass", "slim-interlock", { bh: "BH-6411" }, "80.1×20.2", { value: 4.2, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
    prof("bh31_clip", "Roller Clip (track rail)", "rail", { bh: "BH-2559" }, "11×13.47", { value: 0.52, perFt: 12 }, CATALOGUE("Banu Hashim p.38")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", 
      rule("H", -mm(65.3), ev("suggested", "From the drawings (window built from the sections): 2 × 42.7 track + 3.9 clip − 24 roller. Check on one window."), { when: { tracks: "2" } }),
      rule("H", -mm(65.9), ev("suggested", "From the drawings: 3-track BH-6403 with clip 2559 and shutter 6404 — shutter runs H − 65.9. Check on one window."), { when: { tracks: "3" } }),
      unknownFrom("H")),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    part("frameTop", "Top Track", byTracks("bh31_track_2t_leg", "bh31_track_3t_leg"), "window", "frameW", 90, "frame-top"),
    part("frameBottom", "Bottom Track", byTracks("bh31_track_2t_leg", "bh31_track_3t_leg"), "window", "frameW", 90, "frame-bottom"),
    part("frameLeft", "Left Side (one groove)", byTracks("bh31_track_2t", "bh31_track_3t"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side (one groove)", byTracks("bh31_track_2t", "bh31_track_3t"), "window", "frameH", 90, "frame-right"),
    part("trackClip", "{s} Roller Clip", "bh31_clip", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "bh31_rail_sgu", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh31_rail_sgu", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "bh31_handle_sgu", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "bh31_slim", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Gulf (founder): one-groove track on the left and right (6400 / 6402); top and bottom 6401 / 6403 with a roller clip; 24 mm roller.",
    "The 31 mm pages print no clip of their own — clip BH-2559 is used here. 3-track height not measured (the 6403 drawing did not trace cleanly).",
  ],
}), "shutterMeet", ["bh31_slim", "bh31_spine", "bh31_slim_dgu", "bh31_spine_dgu"]);

export const BH_35: StudioSystem = withAlternatives(base({
  id: "bh-35", name: "35 mm Gulf — Banu Hashim", group: "gulf", maker: "Banu Hashim",
  blurb: "Like Euro: BH-6501 / 6503 top and bottom with track rail 6513; left and right one-groove BH-6500 / 6502; slim interlock small (6506) or big (6508)",
  profiles: [
    prof("bh35_v2", "35 mm Side Track, one groove (2-track)", "track", { bh: "BH-6500" }, "100×32.8", { value: 3.55, perFt: 12 }, CATALOGUE("Banu Hashim p.61")),
    prof("bh35_b2", "35 mm 2-Track (top and bottom)", "track", { bh: "BH-6501" }, "95×31.2", { value: 5.3, perFt: 12 }, CATALOGUE("Banu Hashim p.61")),
    prof("bh35_v3", "35 mm Side Track, one groove (3-track)", "track", { bh: "BH-6502" }, "150×32.8", { value: 4.9, perFt: 12 }, CATALOGUE("Banu Hashim p.61")),
    prof("bh35_b3", "35 mm 3-Track (top and bottom)", "track", { bh: "BH-6503" }, "145.6×31.2", { value: 7.58, perFt: 12 }, CATALOGUE("Banu Hashim p.62")),
    prof("bh35_rail", "35 mm Shutter Top / Bottom (single glass)", "shutter", { bh: "BH-6504" }, "58×31.7", { value: 3.55, perFt: 12 }, CATALOGUE("Banu Hashim p.62")),
    prof("bh35_rail_dgu", "35 mm Shutter Top / Bottom (double glass)", "shutter", { bh: "BH-6505" }, "58×31.7", { value: 3.65, perFt: 12 }, CATALOGUE("Banu Hashim p.62")),
    prof("bh35_handle", "35 mm Shutter (single glass)", "handle", { bh: "BH-6510" }, "58.9×35.2", { value: 4.0, perFt: 12 }, CATALOGUE("Banu Hashim p.64")),
    prof("bh35_handle_dgu", "35 mm Shutter (double glass)", "handle", { bh: "BH-6511" }, "58.9×35.2", { value: 3.75, perFt: 12 }, CATALOGUE("Banu Hashim p.64")),
    prof("bh35_slim", "35 mm Slim Interlock — small", "slim-interlock", { bh: "BH-6506" }, "47.2×27.5", { value: 2.95, perFt: 12 }, CATALOGUE("Banu Hashim p.63"), { faceMm: 27.5 }),
    prof("bh35_spine", "35 mm Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-6508" }, "96×27", { value: 5.25, perFt: 12 }, CATALOGUE("Banu Hashim p.63"), { faceMm: 27 }),
    prof("bh35_slim_dgu", "35 mm Slim Interlock — small, double glass", "slim-interlock", { bh: "BH-6507" }, "47.2×27.5", { value: 2.6, perFt: 12 }, CATALOGUE("Banu Hashim p.63"), { faceMm: 27.5 }),
    prof("bh35_spine_dgu", "35 mm Slim Interlock — big, double glass", "slim-interlock", { bh: "BH-6509" }, "96×27", { value: 5.0, perFt: 12 }, CATALOGUE("Banu Hashim p.64"), { faceMm: 27 }),
    prof("bh35_patri", "35 mm Roller Clip (track rail)", "rail", { bh: "BH-6513" }, "14.5×17.96", { value: 0.65, perFt: 12 }, CATALOGUE("Banu Hashim p.65")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(42.4), ev("suggested", "From the drawings (window built from the sections): 2 × 31.2 track + 4.0 clip − 24 roller. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    part("frameTop", "Top Track", byTracks("bh35_b2", "bh35_b3"), "window", "frameW", 90, "frame-top"),
    part("frameBottom", "Bottom Track", byTracks("bh35_b2", "bh35_b3"), "window", "frameW", 90, "frame-bottom"),
    part("frameLeft", "Left Side (one groove)", byTracks("bh35_v2", "bh35_v3"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side (one groove)", byTracks("bh35_v2", "bh35_v3"), "window", "frameH", 90, "frame-right"),
    part("trackClip", "{s} Roller Clip", "bh35_patri", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "bh35_rail", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh35_rail", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "bh35_handle", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "bh35_slim", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Gulf is built like Euro. Only the left and right sides change: a one-groove track takes the place of the Euro track there.",
    "Top and bottom are the same track (Banu Hashim prints 6501 as \"top and bottom\"); the roller runs on the 6513 clip.",
  ],
}), "shutterMeet", ["bh35_slim", "bh35_spine", "bh35_slim_dgu", "bh35_spine_dgu"]);

/* ———————————————— Euro (one track all round + roller clip) ———————————————— */

/**
 * Euro 26 — Banu Hashim (founder 2026-11-12): the same track on all four sides
 * (BH-6000 2-track / BH-6001 3-track, 45°); a clip (BH-2559) snaps into the
 * bottom track and the roller runs on it. The shutter is built like Domal, but
 * the meeting side is a slim interlock — small or big, shutter by shutter.
 */
export const EURO_26: StudioSystem = withAlternatives(base({
  id: "euro-26", name: "Euro 26 mm — Banu Hashim", group: "gulf", maker: "Banu Hashim",
  blurb: "BH-6000 / 6001 track on all 4 sides, BH-2559 roller clip; shutter BH-6003, slim interlock small (6052) or big (6053)",
  profiles: [
    prof("bh_6000", "Euro 2-Track", "frame", { bh: "BH-6000" }, "64.3×45", { value: 3.9, perFt: 12 }, CATALOGUE("Banu Hashim p.39")),
    prof("bh_6001", "Euro 3-Track", "frame", { bh: "BH-6001" }, "99.3×45", { value: 5.95, perFt: 12 },
      CATALOGUE("Banu Hashim p.39 — table prints H 35; the drawing says 45 and the trace fits 45")),
    prof("bh_2559", "Euro Roller Clip (track rail)", "rail", { bh: "BH-2559" }, "11×13.47", { value: 0.52, perFt: 12 }, CATALOGUE("Banu Hashim p.38")),
    prof("bh_6003", "Euro Shutter 65×26", "shutter", { bh: "BH-6003" }, "65×26", { value: 2.7, perFt: 12 }, CATALOGUE("Banu Hashim p.39")),
    prof("bh_6052", "Euro Slim Interlock — small", "slim-interlock", { bh: "BH-6052" }, "32.6×23.7", { value: 1.7, perFt: 12 }, CATALOGUE("Banu Hashim p.40"), { faceMm: 23.7 }),
    prof("bh_6053", "Euro Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-6053" }, "62.6×23.7", { value: 2.6, perFt: 12 },
      CATALOGUE("Banu Hashim p.40 — table prints W 61.73; the drawing says 62.6"), { faceMm: 23.7 }),
    prof("bh_6050", "Domal Shutter 66×26", "shutter", { bh: "BH-6050" }, "66×26", { value: 2.35, perFt: 12 }, CATALOGUE("Banu Hashim p.40")),
    prof("bh_6054", "Domal Clip", "interlock-patti", { bh: "BH-6054" }, "38×30.3", { value: 1.1, perFt: 12 }, CATALOGUE("Banu Hashim p.41")),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "Founder: Euro track goes round like Domal — 45°, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "Founder: Euro track goes round like Domal — 45°, full height"))),
    size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height",
      rule("H", -mm(69.8), ev("suggested", "From the drawings (window built from the sections): 2 × 44.9 track + 3.9 clip − 24 roller. Check on one window."), { when: { tracks: "2" } }),
      rule("H", -mm(69.9), ev("suggested", "From the drawings (window built from the sections): 2 × 45.0 track + 3.9 clip − 24 roller. Check on one window."))),
    size("glassW", "Glass width", unknownFrom("shutterW")),
    size("glassH", "Glass height", unknownFrom("shutterH")),
  ],
  parts: [
    ...domalFrame(byTracks("bh_6000", "bh_6001")),
    part("trackClip", "{s} Roller Clip", "bh_2559", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "bh_6003", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh_6003", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "bh_6003", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "bh_6052", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Euro: one track on all four sides. The roller runs on a clip snapped into the bottom track — one clip under each shutter.",
    "Where Domal puts a clip on the shutter, Euro uses a slim interlock: both small, or one small and one big.",
    "Every roller is 24 mm high. Teach the shutter height from one window you made.",
  ],
}), "shutterMeet", ["bh_6052", "bh_6053"]);

/* ———————————————— Gulf (separate bottom track) ———————————————— */

/** Gulf slim 25 — Banu Hashim catalogue pp.35–38. */
export const GULF_25: StudioSystem = withAlternatives(base({
  id: "gulf-25", name: "Gulf slim 25 mm — Banu Hashim", group: "gulf", maker: "Banu Hashim",
  blurb: "Like Euro: BH-2551 / 2553 top and bottom with roller clip 2559; left and right one-groove BH-2550 / 2552; slim interlock small (2556) or big (2557)",
  profiles: [
    prof("bh_2550", "Gulf 25 Side Track, one groove (2-track)", "track", { bh: "BH-2550" }, "75.7×24.8", { value: 2.9, perFt: 12 }, CATALOGUE("Banu Hashim p.35")),
    prof("bh_2551", "Gulf 25 2-Track (top and bottom)", "track", { bh: "BH-2551" }, "71.8×29.8", { value: 3.65, perFt: 12 }, CATALOGUE("Banu Hashim p.35")),
    prof("bh_2552", "Gulf 25 Side Track, one groove (3-track)", "track", { bh: "BH-2552" }, "112.5×24.8", { value: 4.1, perFt: 12 }, CATALOGUE("Banu Hashim p.35")),
    prof("bh_2553", "Gulf 25 3-Track (top and bottom)", "track", { bh: "BH-2553" }, "108.6×29.8", { value: 5.1, perFt: 12 }, CATALOGUE("Banu Hashim p.36")),
    prof("bh_2554", "Gulf 25 Shutter Top / Bottom", "shutter", { bh: "BH-2554" }, "53.8×22.2", { value: 2.2, perFt: 12 }, CATALOGUE("Banu Hashim p.36")),
    prof("bh_2555", "Gulf 25 Shutter", "handle", { bh: "BH-2555" }, "62.37×25.5", { value: 2.4, perFt: 12 }, CATALOGUE("Banu Hashim p.36")),
    prof("bh_2556", "Gulf 25 Slim Interlock — small", "slim-interlock", { bh: "BH-2556" }, "35.8×20.3", { value: 1.9, perFt: 12 }, CATALOGUE("Banu Hashim p.37"), { faceMm: 20.3 }),
    prof("bh_2557", "Gulf 25 Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-2557" }, "80×20.2", { value: 3.55, perFt: 12 }, CATALOGUE("Banu Hashim p.37"), { faceMm: 20.2 }),
    prof("bh_2558", "Gulf 25 Top Track Guide", "rail", { bh: "BH-2558" }, "12×15", { value: 0.7, perFt: 12 }, CATALOGUE("Banu Hashim p.37")),
    prof("bh_2559", "Euro Roller Clip (track rail)", "rail", { bh: "BH-2559" }, "11×13.47", { value: 0.52, perFt: 12 }, CATALOGUE("Banu Hashim p.38")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 2), size("clipW", "Roller clip", unknownFrom("W")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(39.6), ev("suggested", "From the drawings (window built from the sections): 2 × 29.8 track + 3.9 clip − 24 roller. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    part("frameTop", "Top Track", byTracks("bh_2551", "bh_2553"), "window", "frameW", 90, "frame-top"),
    part("frameBottom", "Bottom Track", byTracks("bh_2551", "bh_2553"), "window", "frameW", 90, "frame-bottom"),
    part("frameLeft", "Left Side (one groove)", byTracks("bh_2550", "bh_2552"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side (one groove)", byTracks("bh_2550", "bh_2552"), "window", "frameH", 90, "frame-right"),
    part("trackClip", "{s} Roller Clip", "bh_2559", "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "bh_2554", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh_2554", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "bh_2555", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "bh_2556", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: [
    "Gulf is built like Euro. Only the left and right sides change: a one-groove track takes the place of the Euro track there.",
    "Top and bottom are the same track; the roller runs on the clip in the bottom track.",
    "Gulf shops differ on which piece runs full length — teach from one window.",
  ],
}), "shutterMeet", ["bh_2556", "bh_2557"]);

/** Alucoat S-30 Gulf — every section named on the catalogue page (p.20). */
export const GULF_S30: StudioSystem = withAlternatives(base({
  id: "gulf-s30", name: "Gulf S-30 — Alucoat", group: "gulf", maker: "Alucoat",
  blurb: "Vertical Gulf top and sides, separate bottom Gulf track, 90° screwed; glass or DGU shutter with interlock clip",
  profiles: [
    prof("at_v2", "2 Track Vertical Gulf", "track", { alucoat: "AT-30001" }, "85×33", { value: 5.1, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_b2", "2 Track Bottom Gulf", "track", { alucoat: "AT-30002" }, "81.8×47", { value: 7.7, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_v3", "3 Track Vertical Gulf", "track", { alucoat: "AT-30003" }, "124×33", { value: 6.9, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_b3", "3 Track Bottom Gulf", "track", { alucoat: "AT-30004" }, "120.6×47", { value: 10.6, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_t2", "2 Track", "track", { alucoat: "AT-30016" }, "54.4×37.8", { value: 5.1, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_t3", "3 Track", "track", { alucoat: "AT-30017" }, "93.8×37.8", { value: 7.5, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_t2l", "2 Track with Leg", "track", { alucoat: "AT-30018" }, "71.6×37.8", { value: 6.5, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_t3l", "3 Track with Leg", "track", { alucoat: "AT-30019" }, "111×37.8", { value: 9.3, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_sgu", "Single Glass Shutter", "shutter", { alucoat: "AT-30005" }, "67.4×30", { value: 4.45, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_dgu", "DGU Shutter", "shutter", { alucoat: "AT-30006" }, "67.4×30", { value: 4.3, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
    prof("at_clip", "Interlock Clip", "interlock-patti", { alucoat: "AT-30007" }, "37.1×35.1", { value: 1.75, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20"), { faceMm: 12 }),
    prof("at_dbl", "Double Interlock", "interlock", { alucoat: "AT-30008" }, "37.1×41.62", { value: 2.8, perFt: 16 }, CATALOGUE("Alucoat S-30 p.20")),
  ],
  sizes: [
    ...UNKNOWN_SIZES().slice(0, 3),
    size("shutterH", "Shutter height", rule("H", -mm(58.0), ev("suggested", "From the drawings: Bottom Gulf on top and bottom (tip 42.5), solid rail AT-30101 (10.5) on the U floor → runs at 39.5; 42.5 + 39.5 − 24 roller. If your top is the 2-Track AT-30016 it is H − 53.3. Check on one window."))),
    ...UNKNOWN_SIZES().slice(4),
  ],
  parts: [
    part("frameTop", "Top Track", byTracks("at_b2", "at_b3"), "window", "frameW", 90, "frame-top"),
    part("frameLeft", "Left Side (one groove)", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side (one groove)", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-right"),
    part("frameBottom", "Bottom Gulf Track", byTracks("at_b2", "at_b3"), "window", "frameW", 90, "frame-bottom"),
    part("shutterTop", "{s} Shutter Top{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock Clip {k}", "at_clip", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Gulf (founder): the one-groove Vertical Gulf goes on the left and right; top and bottom are the same track. The roller runs on the solid bottom rail AT-30101 (5 × 10.5) set in the track.", "Gulf shops differ on which piece runs full length — teach from one window."],
}), "interlock", ["at_clip", "at_dbl"]);

/* ———————————————— Gulf series ———————————————— */

export const GULF: StudioSystem = base({
  id: "gulf", name: "Gulf series — any size (25 to 35)", group: "gulf",
  blurb: "Built like Euro; the left and right sides take a one-groove track. Choose your sections.",
  sizes: UNKNOWN_SIZES(),
  profiles: GULF_S30.profiles,
  parts: GULF_S30.parts,
  notes: ["Gulf is built like Euro; only the left and right sides change to a one-groove track.", "Gulf shops differ: some run the sides full height, others the bottom track full width. Teach from one window and FabriQ follows yours."],
});

/* ———————————————— Casement / Z-section (verified) ———————————————— */
// Founder-verified Z rules (engine, docs/09): sight line 40 mm on frame and Z-pipe,
// sash laps 5 mm onto the frame / mullion on every side (+10 mm), glass 5 mm
// smaller than its pocket on every side, mullion takes 20 mm from each sash.
const Z_SIZES: SizeDef[] = [
  size("frameW", "Outer top / bottom", rule("W", 0, FOUNDER("outer frame full width, 45°"))),
  size("frameH", "Outer sides", rule("H", 0, FOUNDER("outer frame full height, 45°"))),
  size("sashW", "Sash width",
    rule("W", mm(10), FOUNDER("1 sash: W − 80 + 10 mm overlap"), { when: { shutters: "1" }, pre: -mm(80) }),
    rule("W", mm(10), FOUNDER("2 sashes: (W − 80 − 40) ÷ 2 + 10"), { when: { shutters: "2" }, pre: -mm(120), den: 2 }),
    rule("W", mm(10), FOUNDER("3 sashes: (W − 80 − 80) ÷ 3 + 10"), { when: { shutters: "3" }, pre: -mm(160), den: 3 }),
    rule("W", mm(10), FOUNDER("4 sashes: (W − 80 − 120) ÷ 4 + 10"), { when: { shutters: "4" }, pre: -mm(200), den: 4 })),
  size("sashH", "Sash height", rule("H", -mm(70), FOUNDER("H − 80 + 10 mm overlap"))),
  size("mullionH", "Mullion", rule("H", -mm(80), FOUNDER("between outer top and bottom: H − 2 × 40"))),
  size("pocketW", "Glass pocket width (clip)", rule("sashW", -mm(80), FOUNDER("sash − 2 × 40"))),
  size("pocketH", "Glass pocket height (clip)", rule("sashH", -mm(80), FOUNDER("sash − 2 × 40"))),
  size("glassW", "Glass width", rule("pocketW", -mm(10), FOUNDER("pocket − 5 mm each side"))),
  size("glassH", "Glass height", rule("pocketH", -mm(10), FOUNDER("pocket − 5 mm each side"))),
];

function zSystem(id: string, name: string, outer: string, pipe: string, center: string, blurb: string): StudioSystem {
  return {
    id, name, family: "casement", group: "casement", maker: "OMEO", blurb, version: 1, status: "verified",
    layouts: [{ tracks: 1, mixes: ["G", "J"] }, { tracks: 2, mixes: ["GG", "GJ"] }, { tracks: 3, mixes: ["GGG"] }, { tracks: 4, mixes: ["GGGG"] }],
    switches: [],
    profiles: [
      prof("z_outer_40", "Z Outer Frame 40×40", "frame", { omeo: "2076" }, "40×40", { value: 2.37, perFt: 15 }, CATALOGUE("OMEO 2076")),
      prof("z_outer_55", "Z Outer Frame 40×55", "frame", { omeo: "2088" }, "55.6×40.4", { value: 2.81, perFt: 12 }, CATALOGUE("OMEO 2088"), { faceMm: 40 }),
      prof("z_pipe_40", "Z-Pipe (sash) 40×40", "shutter", { omeo: "2077" }, "40×40", { value: 3.094, perFt: 15 }, CATALOGUE("OMEO 2077")),
      prof("z_pipe_55", "Z-Pipe (sash) 40×55", "shutter", { napl: "20610" }, "55.6×40.2", undefined, CATALOGUE("NAPL 20610"), { faceMm: 40 }),
      prof("z_center_55", "Z Center / Mullion 40×55", "mullion", { omeo: "2086" }, "54.3×40.3", { value: 3.275, perFt: 12 }, CATALOGUE("OMEO 2086"), { faceMm: 40 }),
      prof("z_center_70", "Z Center / Mullion 40×70", "mullion", { omeo: "2079" }, "70.6×40.4", { value: 3.18, perFt: 12 }, CATALOGUE("OMEO 2079"), { faceMm: 40 }),
      prof("z_clip", "Z Glazing Clip", "bead", { omeo: "2078" }, "22.2×17.9", { value: 0.755, perFt: 12 }, CATALOGUE("OMEO 2078")),
    ].filter((p) => [outer, pipe, center, "z_clip"].includes(p.id)),
    sizes: Z_SIZES,
    parts: [
      part("outerTop", "Outer Top", outer, "window", "frameW", 45, "frame-top"),
      part("outerBottom", "Outer Bottom", outer, "window", "frameW", 45, "frame-bottom"),
      part("outerLeft", "Outer Left", outer, "window", "frameH", 45, "frame-left"),
      part("outerRight", "Outer Right", outer, "window", "frameH", 45, "frame-right"),
      part("mullion", "Mullion {k}", center, "between", "mullionH", 90, "mullion"),
      part("sashTop", "{s} Shutter Top{tag}", pipe, "shutter", "sashW", 45, "sash-top"),
      part("sashBottom", "{s} Shutter Bottom{tag}", pipe, "shutter", "sashW", 45, "sash-bottom"),
      part("sashLeft", "{s} Shutter Left{tag}", pipe, "shutter", "sashH", 45, "sash-lock"),
      part("sashRight", "{s} Shutter Right{tag}", pipe, "shutter", "sashH", 45, "sash-meet"),
      part("clipTop", "{s} Clip Top", "z_clip", "shutter", "pocketW", 90, "other", { onlyGlass: true }),
      part("clipBottom", "{s} Clip Bottom", "z_clip", "shutter", "pocketW", 90, "other", { onlyGlass: true }),
      part("clipLeft", "{s} Clip Left", "z_clip", "shutter", "pocketH", 90, "other", { onlyGlass: true }),
      part("clipRight", "{s} Clip Right", "z_clip", "shutter", "pocketH", 90, "other", { onlyGlass: true }),
    ],
    infill: { w: "glassW", h: "glassH" },
    extras: [],
    wastagePct: 5,
    jobs: [],
    notes: ["Openable sashes on friction stays. Hardware is not in the list (founder scope)."],
  };
}

export const Z_40 = zSystem("z-40", "Z-section 40 (casement)", "z_outer_40", "z_pipe_40", "z_center_55",
  "Openable windows: Z outer frame and Z-pipe sash at 45°, center mullion between sashes, glass held by clip");
export const Z_55 = zSystem("z-55", "Z-section 55 heavy (casement)", "z_outer_55", "z_pipe_55", "z_center_70",
  "Large windows and doors: heavy Z frame, Z-pipe and 70 mm center");

/* ———————————————— blanks ———————————————— */

export const BLANK_DOMAL_TYPE: StudioSystem = base({
  id: "blank-domal-type", name: "New system — shutter on 4 sides", group: "blank",
  heightFrom: { kind: "domal-legs" },
  blurb: "Any series where one shutter profile goes round (domal, sleek, mini domal…)",
  sizes: UNKNOWN_SIZES(),
  profiles: DOMAL_27.profiles,
  parts: DOMAL_27.parts,
  notes: ["Starts with standard 4-side shutter pieces. Every section and rule can be customized after."],
});

export const BLANK_SLIDING: StudioSystem = {
  ...NORMAL_18,
  id: "blank-sliding", name: "New system — handle, interlock, bearing", group: "blank",
  blurb: "Any Bombay-type series with a 4-profile shutter",
  sizes: [
    size("trackW", "Top / bottom track", unknownFrom("W")),
    size("sideH", "Frame side", unknownFrom("H")),
    size("shutterH", "Shutter height (handle, interlock)", unknownFrom("H")),
    size("bearing", "Bearing (top & bottom)", unknownFrom("W", { den: 2 })),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("glassW", "Glass width", unknownFrom("bearing")),
    size("glassH", "Glass height", unknownFrom("shutterH")),
  ],
  profiles: NORMAL_18.profiles,
  parts: NORMAL_18.parts,
  notes: ["Starts with standard handle, interlock, and bearing shutter pieces. Every section and rule can be customized after."],
};

/* ———————————————— cuts read off the drawings (window built from the sections) ———————————————— */
// lib/studio/assemble.ts builds each window from its traced sections; scripts/
// assemble-window.ts and evals/studio/assemble.ts show and check the numbers.
//  • Glass: a 5 mm glass is slid into each shutter section's glass pocket until it
//    stops; it is cut 3.9 mm short of that on every side — the gap that makes OMEO
//    Domal's founder rule (shutter − 102) come out exactly. (Normal 18's bearing
//    gives shutter H − 67.8 this way; the engine's video rule is − 66.7.)
//  • Shutter width: every shutter half the window (W/2) — the shops' usual way.
//  • Roller clip: runs the clear width between the side frames' running tips.
//  • Gulf (90°): sides full height, top and bottom between the one-groove sides.
// A meeting-side glass pocket that the drawing does not show clearly is left
// unknown rather than guessed.

const FROM_DRAWING = (t: string) => ev("suggested", `From the drawings (window built from the sections): ${t}. Check on one window.`);
const HALF = rule("W", 0, ev("observed", "Every shutter half the window (W/2) — the usual shop way"), { den: 2 });
const PICK = "pick_shutterMeet";

type Drawn = Partial<Record<"frameW" | "frameH" | "clipW" | "shutterW" | "glassW" | "glassH", SizeCase[]>>;
function drawn(sys: StudioSystem, d: Drawn): StudioSystem {
  const sizes = sys.sizes.map((s) => (d[s.id as keyof Drawn] ? { ...s, cases: d[s.id as keyof Drawn]! } : s));
  return Object.assign(sys, { sizes });
}
const glassBoth = (offset: number, src: string) => ({
  glassW: [rule("shutterW", -mm(2 * offset), FROM_DRAWING(`${src}: glass stops ${offset} mm in from each shutter edge`))],
  glassH: [rule("shutterH", -mm(2 * offset), FROM_DRAWING(`${src}: glass stops ${offset} mm in from each shutter edge`))],
});
const glassH = (offset: number, src: string) =>
  [rule("shutterH", -mm(2 * offset), FROM_DRAWING(`${src}: glass stops ${offset} mm in from the top and bottom edges`))];
/** glass width with a lock side and a meeting side chosen shutter by shutter */
const glassW = (lock: number, lockSrc: string, meet: Record<string, [number, string]>) => [
  ...Object.entries(meet).map(([id, [m, src]]) =>
    rule("shutterW", -mm(Math.round((lock + m) * 10) / 10), FROM_DRAWING(`${lockSrc} ${lock} mm + ${src} ${m} mm`), { when: { [PICK]: id } })),
  unknownFrom("shutterW"),
];
const clip = (take: number, src: string) => [rule("W", -mm(take), FROM_DRAWING(`clear width between the side tips: W − ${take} (${src})`))];
const gulfFrame = (side: number, code: string) => ({
  frameH: [rule("H", 0, ev("observed", "Gulf: sides run full height (90°)"))],
  frameW: [rule("W", -mm(2 * side), FROM_DRAWING(`top and bottom fit between the ${code} sides (${side} mm each, 90°); if your shop runs them full width, set this to W`))],
});

// Domal 27 from other makers — their own glass pockets
drawn(AMPLE_27, glassBoth(51.9, "Ample 214315 pocket"));
drawn(ELEANOR_27, glassBoth(52.7, "Eleanor 2722 pocket"));
drawn(BH_27, { shutterW: [HALF] });
const MITRED = { frameW: [rule("W", 0, ev("observed", "45° frame goes round, full width"))], frameH: [rule("H", 0, ev("observed", "45° frame goes round, full height"))] };
for (const sys of [AMPLE_22, AMPLE_25, AMPLE_26, AMPLE_29, AMPLE_37]) drawn(sys, MITRED);
// Mini domal 22: one shutter profile on 3 sides
drawn(AMPLE_22, { shutterW: [HALF], ...glassBoth(47.4, "Ample 41082 pocket (shutter on all 4 sides)") });
// Euro 26
drawn(EURO_26, { shutterW: [HALF], clipW: [rule("W", -mm(89.9), FROM_DRAWING("clear width between the side U tips (2 × 45.0)"))], glassH: glassH(59.1, "BH-6003 pocket"),
  glassW: glassW(59.1, "BH-6003 pocket", { bh_6052: [17.4, "slim 6052 pocket (glass enters its 10.2 mm top slot)"], bh_6053: [17.4, "slim 6053 pocket"] }) });
// Gulf 25 / 35 and BH 31 — slim interlock small or big, shutter by shutter
drawn(GULF_25, {
  ...gulfFrame(24.8, "BH-2550"), shutterW: [HALF], clipW: clip(49.6, "BH-2550 sides"),
  glassH: glassH(44.2, "BH-2554 pocket"),
  glassW: glassW(54.1, "BH-2555 pocket", { bh_2556: [11.7, "slim 2556 pocket"], bh_2557: [11.5, "slim 2557 pocket"] }),
});
drawn(BH_35, {
  ...gulfFrame(32.8, "BH-6500"), shutterW: [HALF], clipW: clip(65.6, "BH-6500 sides"), glassH: glassH(46.8, "BH-6504 pocket"),
  glassW: glassW(46.7, "BH-6510 pocket", { bh35_slim: [15.6, "slim 6506 pocket (15 mm top slot)"], bh35_spine: [15.2, "slim 6508 pocket"] }),
});
drawn(BH_31, {
  ...gulfFrame(33.1, "BH-6400"), shutterW: [HALF], clipW: clip(66.2, "BH-6400 sides"),
  glassH: glassH(56.4, "BH-6404 pocket"),
  glassW: glassW(49.8, "BH-6406 pocket", { bh31_slim: [11.3, "slim 6408 pocket"], bh31_spine: [10.7, "slim 6409 pocket"] }),
});
// Ample 25 / 29 / 37 — 45° frame, clip in the track
drawn(AMPLE_25, { shutterW: [HALF], clipW: clip(80, "2 × 40.0"), ...glassBoth(54.3, "Ample 41323 pocket (shutter on all 4 sides)") });
drawn(AMPLE_29, { shutterW: [HALF], clipW: clip(95.4, "2 × 47.7"), ...glassBoth(52.7, "Ample 41055 pocket (shutter on all 4 sides)") });
drawn(AMPLE_37, { shutterW: [HALF], clipW: clip(99.4, "2 × 49.7"), ...glassBoth(63.5, "Ample 41068 pocket (shutter on all 4 sides)") });
// Alucoat S-30: one shutter profile on 4 sides, interlock clip at the meeting
drawn(GULF_S30, { ...gulfFrame(33, "AT-30001"), shutterW: [HALF], ...glassBoth(55.1, "AT-30005 pocket") });

/* ———————————————— meeting side: slim interlock, or shutter + interlock clip ———————————————— */
// Founder (2026-11-13): the slim interlock is a choice. Many shops put the glass
// shutter on all four sides and an interlock clip on top of it at the meeting;
// others fit a slim interlock — both small, or one small and one big. Any
// Domal / Euro / Gulf of 25–31 mm can be made either way.
const MEET_SWITCH = (def: "slim" | "clip") => ({
  id: "meet", label: "Meeting side", default: def,
  options: [{ value: "slim", label: "Slim interlock" }, { value: "clip", label: "Shutter + interlock clip" }],
});
/** An interlock clip of your series: cut to the shutter height, whatever its code (founder, 2026-11-13). */
const ANY_CLIP: ProfileDef = { ...prof("interlock_clip", "Interlock Clip", "interlock-patti", {}, "", undefined,
  ev("observed", "Founder: the interlock clip is cut to the shutter height. Choose your clip section to show its code."), { faceMm: 10 }), codes: undefined, size: undefined };
function withMeetChoice(sys: StudioSystem, o: { lock: string; clip: string; glassW: number | null; src: string; def?: "slim" | "clip" }): StudioSystem {
  sys.switches = [...sys.switches.filter((s) => s.id !== "meet"), MEET_SWITCH(o.def ?? "slim")];
  // the meeting side is the slim interlock or the shutter itself: name it for both
  sys.parts = sys.parts.map((p) => (p.id === "shutterMeet" ? { ...p, role: "{s} Meeting Side{tag}", profile: [{ when: { meet: "clip" }, id: o.lock }, ...p.profile] } : p));
  sys.parts = [...sys.parts.filter((p) => p.id !== "meetClip"),
    part("meetClip", "Interlock Clip {k}", o.clip || ANY_CLIP.id, "meeting", "shutterH", 90, "meeting", { count: 2, when: { meet: "clip" } })];
  // no clip section known: it is still cut to the shutter height (founder) — never block the cut
  if (!o.clip && !sys.profiles.some((p) => p.id === ANY_CLIP.id)) sys.profiles = [...sys.profiles, ANY_CLIP];
  sys.sizes = sys.sizes.map((s) => (s.id !== "glassW" ? s : {
    ...s,
    cases: [o.glassW === null
      ? unknownFrom("shutterW", { when: { meet: "clip" } })
      : rule("shutterW", -mm(o.glassW), FROM_DRAWING(`${o.src} — the same shutter on both sides`), { when: { meet: "clip" } }), ...s.cases],
  }));
  return sys;
}

withMeetChoice(EURO_26, { lock: "bh_6003", clip: "bh_6054", glassW: 118.2, src: "glass stops 59.1 mm in (BH-6003)" });
withMeetChoice(EURO_35, { lock: "e35_shutter", clip: "d35_clip", glassW: 118, src: "glass stops 59.0 mm in (BH-6712)" });
withMeetChoice(GULF_25, { lock: "bh_2555", clip: "", glassW: 108.2, src: "glass stops 54.1 mm in (BH-2555)" });
withMeetChoice(BH_31, { lock: "bh31_handle_sgu", clip: "", glassW: 99.6, src: "glass stops 49.8 mm in (BH-6406)" });
withMeetChoice(BH_35, { lock: "bh35_handle", clip: "d35_clip", glassW: 93.4, src: "glass stops 46.7 mm in (BH-6510)" });
withMeetChoice(AMPLE_29, { lock: "a29_handle", clip: "a29_patti", glassW: 105.4, src: "glass stops 52.7 mm in (Ample 41055)", def: "clip" });
withMeetChoice(ELEANOR_29, { lock: "el29_shutter", clip: "el29_patti", glassW: 108.7, src: "glass stops 54.3 mm in (Eleanor 2903)", def: "clip" });
withShutterChoice(ELEANOR_29, [
  { value: "2903", label: "2903 — single glass", id: "el29_shutter", take: 108.7, src: "shutter 2903: glass stops 54.3 mm in from each shutter edge" },
  { value: "2906", label: "2906 — single glass", id: "el29_shutter_b", take: 106.3, src: "shutter 2906: glass stops 53.1 mm in from each shutter edge" },
  { value: "2909", label: "2909 — double glass", id: "el29_dgu", take: 106.3, src: "double-glass shutter 2909 (founder): glass stops 53.1 mm in from each shutter edge" },
]);

slimSide(ELEANOR_29, "");

/** Which shutter section goes on all four sides (single glass, double glass…), each with its own glass size. First = default. */
function withShutterChoice(sys: StudioSystem, opts: { value: string; label: string; id: string; take: number; src: string }[]): StudioSystem {
  sys.switches = [...sys.switches.filter((s) => s.id !== "shutter"), {
    id: "shutter", label: "Shutter", default: opts[0].value, options: opts.map((o) => ({ value: o.value, label: o.label })),
  }];
  const sides = ["shutterTop", "shutterBottom", "shutterLock", "shutterMeet"];
  const rest = opts.slice(1);
  const meets = sys.switches.some((w) => w.id === "meet");
  const whenFor = (v: string, meetSide: boolean): Record<string, string> => (meetSide && meets ? { shutter: v, meet: "clip" } : { shutter: v });
  sys.parts = sys.parts.map((p) => (sides.includes(p.id) ? { ...p, profile: [...rest.map((o) => ({ when: whenFor(o.value, p.id === "shutterMeet"), id: o.id })), ...p.profile] } : p));
  sys.sizes = sys.sizes.map((s) => (s.id !== "glassW" && s.id !== "glassH" ? s : {
    ...s, cases: [...rest.map((o) => rule(s.id === "glassW" ? "shutterW" : "shutterH", -mm(o.take), FROM_DRAWING(o.src), { when: whenFor(o.value, s.id === "glassW") })), ...s.cases],
  }));
  return sys;
}
AMPLE_25.profiles.push(prof("a25_patti", "25 mm Interlock Clip", "interlock-patti", { ample: "955391" }, "35.54×39.8", perM(0.37), CATALOGUE("Ample 25 mm p.3"), { faceMm: 10 }));
withMeetChoice(MINI_DOMAL_20, { lock: "md20_shutter", clip: "md20_patti", glassW: 95.0, src: "glass stops 47.5 mm in (2507)", def: "clip" });
MINI_DOMAL_20.sizes = MINI_DOMAL_20.sizes.map((x) => (x.id !== "glassW" ? x : { ...x, cases: [
  ...x.cases.filter((c) => c.when),
  rule("shutterW", -mm(66.1), FROM_DRAWING("2507 pocket 47.5 + slim 2503 18.6 (glass slot 10.3 mm deep, measured on the drawing)"), { when: { meet: "slim" } }),
  unknownFrom("shutterW"),
] }));
withMeetChoice(AMPLE_25, { lock: "a25_shutter", clip: "a25_patti", glassW: 108.6, src: "glass stops 54.3 mm in (Ample 41323)", def: "clip" });
withMeetChoice(AMPLE_37, { lock: "a37_handle", clip: "", glassW: 127, src: "glass stops 63.5 mm in (Ample 41068)", def: "clip" });

/** With a slim interlock the meeting side is the slim, never the shutter: where the
 *  slim's section is not known the shop chooses it, and its glass width is not guessed. */
function slimSide(sys: StudioSystem, slim: string): StudioSystem {
  sys.parts = sys.parts.map((p) => (p.id !== "shutterMeet" ? p : { ...p, profile: [...p.profile.filter((c) => c.when), { id: slim }] }));
  sys.sizes = sys.sizes.map((x) => (x.id !== "glassW" ? x : { ...x, cases: [...x.cases.filter((c) => c.when), unknownFrom("shutterW")] }));
  return sys;
}
slimSide(AMPLE_25, "");
slimSide(AMPLE_37, "");
slimSide(AMPLE_29, "a29_slim_40");
AMPLE_29.sizes = AMPLE_29.sizes.map((x) => (x.id !== "glassW" ? x : { ...x, cases: [
  ...x.cases.filter((c) => c.when),
  rule("shutterW", -mm(83.6), FROM_DRAWING("41055 pocket 52.7 mm + slim 41289 pocket 30.9 mm (glass goes 13.0 mm into the slim)"), { when: { meet: "slim" } }),
  unknownFrom("shutterW"),
] }));

/* ———————————————— Euro 27 ———————————————— */
/**
 * Euro 27 (founder): the Euro 29 track (Ample 914400 / 41052) with its roller
 * clip 914401, and a 27 mm glass shutter. Built from the drawings: the 27 mm
 * shutter (OMEO 2046) runs clear over the 29 track and clip.
 */
const pick = (from: StudioSystem[], ids: string[]) => ids.map((id) => from.flatMap((s) => s.profiles).find((p) => p.id === id)!);
export const EURO_27: StudioSystem = withMeetChoice(withAlternatives(base({
  id: "euro-27", name: "Euro 27 mm", group: "gulf",
  blurb: "Euro 29 track (Ample 914400 / 41052 or Eleanor 2901 / 2902) with its roller clip; 27 mm shutter on all sides; interlock clip, or slim interlock",
  layouts: [L2(), L3()],
  profiles: [
    ...pick([AMPLE_29, ELEANOR_29, DOMAL_27], ["a29_track_2t", "a29_track_3t", "a29_clip", "el29_track_2t", "el29_track_3t", "el29_clip", "domal_glass_shutter", "domal_jali_shutter", "domal_interlock"]),
    // slim interlocks of the 27 mm series (founder, 2026-11-14): 2728 small, 2729 big, 2730 double glass
    prof("el27_slim", "27 mm Slim Interlock — small", "slim-interlock", { eleanor: "2728" }, "35.2×22.7", { value: 2.3, perFt: 12 }, CATALOGUE("Eleanor 27 mm p.30 — small slim (founder)")),
    prof("el27_slim_big", "27 mm Slim Interlock — big", "slim-interlock", { eleanor: "2729" }, "85.2×22.7", { value: 4.1, perFt: 12 }, CATALOGUE("Eleanor 27 mm p.30 — big slim (founder)")),
    prof("el27_slim_dgu", "27 mm Slim Interlock — double glass", "slim-interlock", { eleanor: "2730" }, "32.3×22.7", { value: 2.1, perFt: 12 }, CATALOGUE("Eleanor 27 mm p.30 — double glass slim (founder)")),
  ],
  switches: [{
    id: "track", label: "29 track", default: "47",
    options: [
      { value: "47", label: "47.7 mm track" },
      { value: "48", label: "48.0 mm track" },
    ],
  }],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, ev("observed", "Euro track goes round at 45°, full width"))),
    size("frameH", "Frame side", rule("H", 0, ev("observed", "Euro track goes round at 45°, full height"))),
    size("clipW", "Roller clip",
      rule("W", -mm(96), FROM_DRAWING("clear width between the side U tips (2 × 48.0, Eleanor)"), { when: { track: "48" } }),
      rule("W", -mm(95.4), FROM_DRAWING("clear width between the side U tips (2 × 47.7)"))),
    size("shutterW", "Shutter width", HALF),
    size("shutterH", "Shutter height",
      rule("H", -mm(74.5), FROM_DRAWING("2 × 48.0 Eleanor track + 2.5 clip 2917 − 24 roller; the 27 mm shutter runs clear"), { when: { track: "48" } }),
      rule("H", -mm(73.8), FROM_DRAWING("2 × 47.7 track + 2.4 clip − 24 roller; the 27 mm shutter runs clear"))),
    size("glassW", "Glass width", unknownFrom("shutterW")),
    size("glassH", "Glass height", rule("shutterH", -mm(102), ev("observed", "27 mm shutter pocket (OMEO 2046): shutter − 102, as Domal 27"))),
  ],
  parts: [
    ...domalFrame([
      { when: { tracks: ["1", "2"], track: "48" }, id: "el29_track_2t" }, { when: { track: "48" }, id: "el29_track_3t" },
      { when: { tracks: ["1", "2"] }, id: "a29_track_2t" }, { id: "a29_track_3t" },
    ]),
    part("trackClip", "{s} Roller Clip", [{ when: { track: "48" }, id: "el29_clip" }, { id: "a29_clip" }], "shutter", "clipW", 90, "other"),
    part("shutterTop", "{s} Shutter Top{tag}", "domal_glass_shutter", "shutter", "shutterW", 45, "sash-top", { meshProfile: "domal_jali_shutter" }),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "domal_glass_shutter", "shutter", "shutterW", 45, "sash-bottom", { meshProfile: "domal_jali_shutter" }),
    part("shutterLock", "{s} Handle Side{tag}", "domal_glass_shutter", "shutter", "shutterH", 45, "sash-lock", { meshProfile: "domal_jali_shutter" }),
    part("shutterMeet", "{s} Slim Interlock{tag}", "", "shutter", "shutterH", 45, "sash-meet", { meshProfile: "domal_jali_shutter" }),
  ],
  notes: [
    "Euro 27 uses the Euro 29 track and clip; the shutter is the 27 mm one (founder). Choose whose 29 track you use: Eleanor's is 0.3 mm taller, so its shutter is 0.7 mm shorter.",
    "Meeting side: the shutter itself with the interlock patti on it, or your slim interlock (choose its section).",
  ],
}), "shutterMeet", ["el27_slim", "el27_slim_big", "el27_slim_dgu"]), { lock: "domal_glass_shutter", clip: "domal_interlock", glassW: 102, src: "27 mm shutter pocket (OMEO 2046) — as Domal 27", def: "clip" });
// glass with each slim: shutter pocket 51.0 (2046) + where the glass stops in the slim's top slot (measured on the drawing, + 3.9)
EURO_27.sizes = EURO_27.sizes.map((x) => (x.id !== "glassW" ? x : { ...x, cases: [
  ...x.cases.filter((c) => c.when),
  rule("shutterW", -mm(63.0), FROM_DRAWING("2046 pocket 51.0 + small slim 2728 12.0 (glass goes 14.6 mm into its top slot)"), { when: { meet: "slim", pick_shutterMeet: "el27_slim" } }),
  rule("shutterW", -mm(58.7), FROM_DRAWING("2046 pocket 51.0 + big slim 2729 7.7 (glass goes 19.0 mm into its top slot)"), { when: { meet: "slim", pick_shutterMeet: "el27_slim_big" } }),
  rule("shutterW", -mm(63.1), FROM_DRAWING("2046 pocket 51.0 + double-glass slim 2730 12.1"), { when: { meet: "slim", pick_shutterMeet: "el27_slim_dgu" } }),
  unknownFrom("shutterW"),
] }));

/** Euro 25 (founder, 2026-11-14): Banu Hashim's 25 mm series — BH-2551 / 2553 on all
 *  four sides at 45°, roller clip 2559, shutter 2554 / 2555, slim interlock small 2556 or
 *  big 2557 (or the shutter with an interlock clip). Built from the drawings: H − 39.5
 *  (the Gulf 25 height), clip between the side U tips 2 × 29.8. */
export const EURO_25: StudioSystem = (() => {
  const g: StudioSystem = structuredClone(GULF_25);
  g.id = "euro-25"; g.name = "Euro 25 mm"; g.group = "gulf";
  g.blurb = "BH-2551 / 2553 track on all 4 sides at 45°, roller clip 2559; slim interlock small (2556) or big (2557), or interlock clip";
  g.profiles = g.profiles.filter((p) => p.id !== "bh_2550" && p.id !== "bh_2552");
  g.parts = [...domalFrame(byTracks("bh_2551", "bh_2553")), ...g.parts.filter((p) => !/^frame/.test(p.id))];
  g.sizes = g.sizes.map((x) => x.id === "frameW" ? { ...x, cases: [rule("W", 0, ev("observed", "Euro track goes round at 45°, full width"))] }
    : x.id === "frameH" ? { ...x, cases: [rule("H", 0, ev("observed", "Euro track goes round at 45°, full height"))] }
    : x.id === "clipW" ? { ...x, cases: clip(59.6, "2 × 29.8, BH-2551 on the sides") } : x);
  g.notes = ["Euro 25: the same track all round (founder). The Gulf 25 has one-groove 2550 / 2552 on the sides instead."];
  return g;
})();

export const TEMPLATES: StudioSystem[] = [
  NORMAL_18, DOMAL_27,
  NORMAL_25, NORMAL_5T,
  AMPLE_27, ELEANOR_27, BH_27, EURO_27, DOMAL_35, MINI_DOMAL_20, AMPLE_22, AMPLE_25, AMPLE_26,
  AMPLE_29, ELEANOR_29, AMPLE_37,
  EURO_25, EURO_26, EURO_35, GULF_25, BH_31, BH_35, GULF_S30, GULF,
  Z_40, Z_55,
  BLANK_DOMAL_TYPE, BLANK_SLIDING,
];

/* ———————————————— what shops call each system ———————————————— */
// Size in mm + kind, and the ones most shops run (founder, 2026-11-13): 25 Euro and
// Gulf, 27 Euro and Domal, 29 Euro, 30 Gulf, 31 Gulf, 35 Domal, Euro and Gulf.
const SERIES: Record<string, [number, SeriesType, string, boolean?]> = {
  // shown in Window and in Settings → Window systems: one per kind and size, no company (founder, 2026-11-13)
  "normal-18": [18, "bombay", "Normal 18 mm", true],
  "domal-27": [27, "domal", "Domal 27 mm", true],
  "mini-domal-20": [20, "domal", "Domal 20 mm"],
  "ample-22": [22, "domal", "Mini domal 22 mm"],
  "domal-35": [35, "domal", "Domal 35 mm", true],
  "euro-25": [25, "euro", "Euro 25 mm", true],
  "euro-26": [26, "euro", "Euro 26 mm"],
  "euro-27": [27, "euro", "Euro 27 mm", true],
  "ample-29": [29, "euro", "Euro 29 mm", true],
  "euro-35": [35, "euro", "Euro 35 mm", true],
  "gulf-25": [25, "gulf", "Gulf 25 mm", true],
  "gulf-s30": [30, "gulf", "Gulf 30 mm", true],
  "bh-31": [31, "gulf", "Gulf 31 mm", true],
  "bh-35": [35, "gulf", "Gulf 35 mm", true],
  "z-40": [40, "casement", "Casement Z 40 mm", true],
  "z-55": [55, "casement", "Casement Z 55 mm"],
  "blank-domal-type": [0, "other", "New — one shutter section on 4 sides"],
  "blank-sliding": [0, "other", "New — handle, interlock, bearing"],
  // kept for the drawings and tests, not offered: another maker's version of a size above, or set aside by the founder
  "normal-25": [25, "bombay", "Normal 25 mm (1″ × 2″)"],
  "normal-5t": [50, "bombay", "Normal 5-track 50 mm"],
  "ample-27": [27, "domal", "Domal 27 mm (shutter 214315)"],
  "eleanor-27": [27, "domal", "Domal 27 mm (shutter 2722)"],
  "bh-27": [27, "domal", "Domal 27 mm (track 45.5)"],
  "ample-26": [26, "euro", "Euro 26 mm (shutter 41300)"],
  "ample-25": [25, "euro", "Euro 25 mm (track 40, clip only)"],
  "ample-37": [37, "euro", "Euro 37 mm"], // founder 2026-11-14: 37 mm taken out of the app
  "eleanor-29": [29, "euro", "Euro 29 mm (track 48.0)"],
  "gulf": [0, "gulf", "Gulf — any size"],
};
/** What Window offers: one system per kind and size. Normal 18, Domal 27 and Z run on the
 *  checked engine until the shop changes them in Settings. */
export const WINDOW_SYSTEMS: { id: string; kind: SeriesType; mm: number; engine?: "normal" | "domal" | "z_section" }[] = [
  { id: "normal-18", kind: "bombay", mm: 18, engine: "normal" },
  { id: "mini-domal-20", kind: "domal", mm: 20 }, { id: "ample-22", kind: "domal", mm: 22 }, { id: "domal-27", kind: "domal", mm: 27, engine: "domal" }, { id: "domal-35", kind: "domal", mm: 35 },
  { id: "euro-25", kind: "euro", mm: 25 }, { id: "euro-26", kind: "euro", mm: 26 }, { id: "euro-27", kind: "euro", mm: 27 },
  { id: "ample-29", kind: "euro", mm: 29 }, { id: "euro-35", kind: "euro", mm: 35 },
  { id: "gulf-25", kind: "gulf", mm: 25 }, { id: "gulf-s30", kind: "gulf", mm: 30 }, { id: "bh-31", kind: "gulf", mm: 31 }, { id: "bh-35", kind: "gulf", mm: 35 },
  { id: "z-40", kind: "casement", mm: 40, engine: "z_section" },
];
/** Shown in Settings → New system (the window ones, Z 55 and the blanks). */
export const OFFERED = new Set([...WINDOW_SYSTEMS.map((w) => w.id), "z-55", "blank-domal-type", "blank-sliding"]);
for (const t of TEMPLATES) {
  const x = SERIES[t.id];
  if (!x) continue;
  t.series = { mm: x[0], type: x[1] };
  t.name = x[2];
  t.popular = !!x[3];
}

/** The kind of section each part takes (for blanks and drafts with no sections yet). */
export const PART_KIND: Record<string, ProfileKind> = {
  top: "track", left: "track", right: "track", bottom: "track",
  handle: "handle", interlock: "interlock", bearingTop: "bearing", bearingBottom: "bearing",
  frameTop: "frame", frameLeft: "frame", frameRight: "frame", frameBottom: "frame",
  shutterTop: "shutter", shutterBottom: "shutter", shutterLeft: "shutter", shutterRight: "shutter",
  shutterLock: "shutter", shutterMeet: "interlock", interlockSpine: "interlock", trackClip: "rail", meetClip: "interlock-patti",
  outerTop: "frame", outerBottom: "frame", outerLeft: "frame", outerRight: "frame", mullion: "mullion",
  sashTop: "shutter", sashBottom: "shutter", sashLeft: "shutter", sashRight: "shutter",
  clipTop: "bead", clipBottom: "bead", clipLeft: "bead", clipRight: "bead",
};

/** Every built-in section, once — the starting section library. */
export const BUILT_IN_PROFILES: ProfileDef[] = (() => {
  const seen = new Map<string, ProfileDef>();
  for (const t of TEMPLATES) for (const p of t.profiles) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
})();
