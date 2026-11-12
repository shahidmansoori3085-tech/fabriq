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
  StudioSystem, SizeDef, SizeCase, PartDef, ProfileDef, Evidence, ExtraDef, Cond, ProfileKind, Place,
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
  ],
  parts: [
    ...domalFrame(byTracks("el_2701", "el_2702")),
    part("shutterTop", "{s} Shutter Top{tag}", "el_2722", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "el_2722", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "el_2722", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "el_2722", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Eleanor prints codes and sizes but not names — which section does which job is read from the drawings. Choose your interlock patti."],
};

export const DOMAL_35: StudioSystem = base({
  id: "domal-35", name: "Domal 35×75", group: "domal",
  heightFrom: { kind: "domal-legs" },
  blurb: "One 35×75 profile on all 4 sides + interlock patti; 2-track, 3+1 or 4+1. Choose your sections.",
  layouts: [L2("GG", "GJ"), { tracks: 4, mixes: ["GGGJ"] }, { tracks: 5, mixes: ["GGGGJ"] }],
  switches: [{
    id: "track", label: "Track width (2-track)", default: "1.75",
    options: [{ value: "1.75", label: "1¾″ track" }, { value: "2", label: "2″ track" }],
  }],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, VIDEO("45° frame, full width"))),
    size("frameH", "Frame side", rule("H", 0, VIDEO("45° frame, full height"))),
    size("shutterW", "Shutter width",
      rule("W", 0, VIDEO("2-track: (W − ⅜″) ÷ 2"), { when: { tracks: "2" }, pre: -inches(0.375), den: 2 }),
      rule("W", 0, VIDEO("3+1: (W + 2⅞″) ÷ 3"), { when: { tracks: "4" }, pre: inches(2.875), den: 3 }),
      rule("W", 0, VIDEO("4+1: (W + 5⅞″) ÷ 4"), { when: { tracks: "5" }, pre: inches(5.875), den: 4 })),
    size("shutterH", "Shutter height",
      rule("H", -inches(2.375), VIDEO("2-track, 1¾″ track: H − 2⅜″"), { when: { tracks: "2", track: "1.75" } }),
      rule("H", -inches(3), VIDEO("2-track, 2″ track: H − 3″"), { when: { tracks: "2", track: "2" } }),
      rule("H", -inches(2.875), VIDEO("3+1 / 4+1: H − 2⅞″"))),
    size("glassW", "Glass width",
      rule("shutterW", -inches(4.625), VIDEO("2-track: shutter − 4⅝″"), { when: { tracks: "2" } }),
      rule("shutterW", -inches(5), VIDEO("3+1 / 4+1: shutter − 5″"))),
    size("glassH", "Glass height",
      rule("shutterH", -inches(4.625), VIDEO("2-track: shutter − 4⅝″"), { when: { tracks: "2" } }),
      rule("shutterH", -inches(5), VIDEO("3+1 / 4+1: shutter − 5″"))),
  ],
  profiles: [
    prof("d35_track_2t", "Domal 35 2-Track Frame", "frame", { bh: "BH-6701" }, "77×42.6", { value: 4.85, perFt: 12 }, CATALOGUE("Banu Hashim BH-6701")),
    prof("d35_track_3t", "Domal 35 3-Track Frame", "frame", { bh: "BH-6703" }, "122×42.5", { value: 7.8, perFt: 12 }, CATALOGUE("Banu Hashim BH-6703")),
    prof("d35_shutter", "Domal 35 Shutter 35×75", "shutter", {}, "75×35", { value: 4.2, perFt: 12 }, CATALOGUE("Domal 35×75")),
    prof("d35_interlock", "Domal 35 Interlock Patti", "interlock-patti", {}, "35×20", { value: 1.1, perFt: 12 }, CATALOGUE("Domal 35")),
  ],
  parts: DOMAL_27.parts.map((p) => ({ ...p, profile: [{ id: "" }], meshProfile: undefined })),
  notes: ["The mesh shutter in 3+1 / 4+1 is taken as the same width as a glass shutter — check it on your first job."],
});

export const MINI_DOMAL_20: StudioSystem = base({
  id: "mini-domal-20", name: "Mini domal 20×54", group: "domal",
  blurb: "Light domal: one 20×54 profile on 4 sides + interlock patti. Choose your sections.",
  sizes: UNKNOWN_SIZES(),
  profiles: [
    prof("md20_track_2t", "Mini Domal 2-Track Frame", "frame", {}, "54×20", { value: 2.1, perFt: 12 }, CATALOGUE("Mini Domal")),
    prof("md20_track_3t", "Mini Domal 3-Track Frame", "frame", {}, "84×20", { value: 3.2, perFt: 12 }, CATALOGUE("Mini Domal")),
    prof("md20_shutter", "Mini Domal Shutter 20×54", "shutter", {}, "54×20", { value: 2.4, perFt: 12 }, CATALOGUE("Mini Domal")),
    prof("md20_patti", "Mini Domal Interlock Patti", "interlock-patti", {}, "20×15", { value: 0.7, perFt: 12 }, CATALOGUE("Mini Domal")),
  ],
  parts: [
    ...domalFrame(byTracks("md20_track_2t", "md20_track_3t")),
    part("shutterTop", "{s} Shutter Top{tag}", "md20_shutter", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "md20_shutter", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "md20_shutter", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "md20_shutter", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock {k}", "md20_patti", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
});

/** Ample 22 mm — light domal-type: shutter on 3 sides, interlock profile on the meeting side. */
export const AMPLE_22: StudioSystem = base({
  id: "ample-22", name: "22 mm mini domal — Ample", group: "domal", maker: "Ample",
  blurb: "35 mm track (41083 / 41084); shutter 41082 with interlock 41085 on the meeting side",
  profiles: [
    prof("a22_track_2t", "22 mm 2-Track", "track", { ample: "41083" }, "53.9×35", perM(0.8), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_track_3t", "22 mm 3-Track", "track", { ample: "41084" }, "83.9×35", perM(1.13), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_shutter", "22 mm Shutter", "shutter", { ample: "41082" }, "55.8×22", perM(0.606), CATALOGUE("Ample 22 mm p.2")),
    prof("a22_interlock", "22 mm Interlock", "interlock", { ample: "41085" }, "65×22", perM(0.251),
      CATALOGUE("Ample 22 mm p.2 (the code is also printed on a 30.9×26.2 cap — confirm with dealer)")),
    prof("a22_clip", "22 mm Glazing Clip", "bead", { ample: "992134" }, "16.2×12.9", perM(0.117), CATALOGUE("Ample 22 mm p.2")),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [...domalFrame(byTracks("a22_track_2t", "a22_track_3t")), ...stileShutter("a22_shutter", "a22_interlock")],
  notes: ["Catalogue gives sizes only. Teach every cut from one window you have made."],
});

export const AMPLE_25: StudioSystem = base({
  id: "ample-25", name: "25 mm sliding — Ample", group: "domal", maker: "Ample",
  blurb: "40 mm track (955388 / 955389); shutter 914744 with interlock 41323",
  profiles: [
    prof("a25_track_2t", "25 mm 2-Track", "track", { ample: "955388" }, "50×40", perM(0.795), CATALOGUE("Ample 25 mm p.2")),
    prof("a25_track_3t", "25 mm 3-Track", "track", { ample: "955389" }, "85.8×40", perM(1.24), CATALOGUE("Ample 25 mm p.2")),
    prof("a25_track_2t_leg", "25 mm 2-Track with leg", "track", { ample: "992012" }, "65.2×42.5", perM(1.015), DRAWING("Ample 25 mm p.2")),
    prof("a25_track_3t_leg", "25 mm 3-Track with leg", "track", { ample: "41021" }, "101×42.5", perM(1.45), DRAWING("Ample 25 mm p.2")),
    prof("a25_shutter", "25 mm Shutter", "shutter", { ample: "914744" }, "54.9×25.52", perM(0.635), DRAWING("Ample 25 mm p.2")),
    prof("a25_interlock", "25 mm Interlock", "interlock", { ample: "41323" }, "63×25.52", perM(0.75), DRAWING("Ample 25 mm p.2")),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [...domalFrame(byTracks("a25_track_2t", "a25_track_3t")), ...stileShutter("a25_shutter", "a25_interlock")],
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
  sizes: UNKNOWN_SIZES(),
  parts: [...domalFrame(byTracks("a26_track_2t", "a26_track_3t")), ...stileShutter("a26_shutter", "a26_interlock")],
});

/* ———————————————— Sleek / slim-interlock drafts ———————————————— */

export const AMPLE_29: StudioSystem = withAlternatives(base({
  id: "ample-29", name: "29 mm sleek — Ample", group: "sleek", maker: "Ample",
  blurb: "47.7 mm track; 41010 rail, 41055 handle stile with slim interlock (41289 / 992328) and T-spine (914806)",
  profiles: [
    prof("a29_track_2t", "29 mm 2-Track", "track", { ample: "41052" }, "85.8×47.7", perM(1.724), DRAWING("Ample 29 mm p.2")),
    prof("a29_track_3t", "29 mm 3-Track", "track", { ample: "41008" }, "121.6×47.69", perM(2.328), DRAWING("Ample 29 mm p.2")),
    prof("a29_track_pocket", "29 mm Pocket Track", "track", { ample: "914643" }, "50×47.7", perM(0.865), DRAWING("Ample 29 mm p.2")),
    prof("a29_rail", "29 mm Shutter Rail (Top/Bottom)", "shutter", { ample: "41010" }, "64.4×50.2", perM(1.325), DRAWING("Ample 29 mm p.3")),
    prof("a29_handle", "29 mm Handle Stile (Lock Side)", "handle", { ample: "41055" }, "65×29", perM(0.89), DRAWING("Ample 29 mm p.3")),
    prof("a29_slim_40", "29 mm Slim Interlock 40", "slim-interlock", { ample: "41289" }, "40×29", perM(0.672), DRAWING("Ample 29 mm p.5"), { faceMm: 40 }),
    prof("a29_slim", "29 mm Slim Interlock 37", "slim-interlock", { ample: "992328" }, "37×29", perM(0.595), DRAWING("Ample 29 mm p.7"), { faceMm: 37 }),
    prof("a29_interlock", "29 mm Interlock (standard)", "interlock", { ample: "41050" }, "65×29", perM(0.816), DRAWING("Ample 29 mm p.3")),
    prof("a29_interlock_b", "29 mm Interlock (heavy)", "interlock", { ample: "992325" }, "65×29", perM(0.865), DRAWING("Ample 29 mm p.7")),
    prof("a29_spine", "29 mm T-Spine Reinforcement", "interlock", { ample: "914806" }, "45×50.61", perM(1.104), DRAWING("Ample 29 mm p.5")),
    prof("a29_patti", "29 mm Interlock Clip", "interlock-patti", { ample: "41054" }, "33.63×38.89", perM(0.35), DRAWING("Ample 29 mm p.4"), { faceMm: 10 }),
    prof("a29_clip", "Glazing Clip", "bead", { ample: "992134" }, "16.2×12.9", perM(0.117), CATALOGUE("Ample 29 mm p.4")),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame(byTracks("a29_track_2t", "a29_track_3t")),
    part("shutterTop", "{s} Top Rail{tag}", "a29_rail", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Bottom Rail{tag}", "a29_rail", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "a29_handle", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Interlock{tag}", "a29_interlock", "shutter", "shutterH", 45, "sash-meet", { perShutter: true }),
    part("interlockSpine", "T-Spine Reinforcement {k}", "a29_spine", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Top and bottom rails (41010) carry roller housing and glass; handle stile (41055) and slim interlock (41289) form the verticals with snap-on T-spine (914806)."],
}), "shutterMeet", ["a29_interlock", "a29_slim", "a29_slim_40", "a29_interlock_b"]);

export const AMPLE_37: StudioSystem = withAlternatives(base({
  id: "ample-37", name: "37 mm sleek — Ample", group: "sleek", maker: "Ample",
  blurb: "53 mm track (41015 / 41014); 41068 handle, 41069 top rail, 41300 bottom rail with roller pocket, 914806 T-spine",
  profiles: [
    prof("a37_track_2t", "37 mm 2-Track Frame", "track", { ample: "41015" }, "90×53", perM(1.822), DRAWING("Ample 37 mm p.2")),
    prof("a37_track_3t", "37 mm 3-Track Frame", "track", { ample: "41014" }, "140×53", perM(2.688), DRAWING("Ample 37 mm p.2")),
    prof("a37_track_3t_b", "37 mm 3-Track (square)", "track", { ample: "41016" }, "109.9×49.8", perM(2.309), DRAWING("Ample 37 mm p.2")),
    prof("a37_top_rail", "37 mm Top Rail", "shutter", { ample: "41069" }, "52.2×44.9", perM(1.15), DRAWING("Ample 37 mm p.3")),
    prof("a37_bottom_rail", "37 mm Bottom Rail (Roller)", "shutter", { ample: "41300" }, "52.2×57.1", perM(1.45), DRAWING("Ample 37 mm p.3")),
    prof("a37_handle", "37 mm Handle Stile", "handle", { ample: "41068" }, "82.7×37.01", perM(1.335), DRAWING("Ample 37 mm p.2")),
    prof("a37_handle_b", "37 mm Handle Stile (light)", "handle", { ample: "41076" }, "82.7×37.01", perM(1.274), DRAWING("Ample 37 mm p.2")),
    prof("a37_interlock", "37 mm Standard Interlock", "interlock", { ample: "41074" }, "82.7×37.01", perM(1.397), DRAWING("Ample 37 mm p.2")),
    prof("a37_slim", "37 mm Slim Interlock", "slim-interlock", { ample: "41310-37" }, "82.7×37.01", perM(1.35), DRAWING("Ample 37 mm p.3"), { faceMm: 37 }),
    prof("a37_spine", "37 mm T-Spine Reinforcement", "interlock", { ample: "914806" }, "45×50.61", perM(1.104), DRAWING("Ample 29 mm p.5")),
    prof("a37_cap", "37 mm Interlock Cap", "interlock-patti", { ample: "41083-37cap" }, "15.77×16.49", perM(0.25), DRAWING("Ample 37 mm p.3"), { faceMm: 10 }),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame(byTracks("a37_track_2t", "a37_track_3t")),
    part("shutterTop", "{s} Top Rail{tag}", "a37_top_rail", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Bottom Rail (Roller){tag}", "a37_bottom_rail", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "a37_handle", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Interlock{tag}", "a37_interlock", "shutter", "shutterH", 45, "sash-meet", { perShutter: true }),
    part("interlockSpine", "T-Spine Reinforcement {k}", "a37_spine", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Bottom rail (41300) carries heavy tandem rollers; top rail (41069) guides the head; 82.7mm handle stile and slim interlock form the verticals with heavy 914806 T-spine."],
}), "shutterMeet", ["a37_interlock", "a37_slim"]);

export const BH_31: StudioSystem = withAlternatives(base({
  id: "bh-31", name: "31 mm slim — Banu Hashim", group: "gulf", maker: "Banu Hashim",
  blurb: "BH-6400 / 6402 track; BH-6404 top and bottom, BH-6406 handle side; slim interlock small (6408) or big (6409) shutter by shutter",
  profiles: [
    prof("bh31_track_2t", "31 mm 2-Track", "track", { bh: "BH-6400" }, "85×33.1", { value: 3.25, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_2t_leg", "31 mm 2-Track with Leg", "track", { bh: "BH-6401" }, "80.8×47.6", { value: 4.95, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_3t", "31 mm 3-Track", "track", { bh: "BH-6402" }, "124.7×33.1", { value: 4.1, perFt: 12 }, CATALOGUE("Banu Hashim p.56")),
    prof("bh31_track_3t_leg", "31 mm 3-Track with Leg", "track", { bh: "BH-6403" }, "120.5×47.6", { value: 6.65, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_rail_sgu", "31 mm Shutter Top / Bottom (single glass)", "shutter", { bh: "BH-6404" }, "65.9×29", { value: 3.85, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_rail_dgu", "31 mm Shutter Top / Bottom (double glass)", "shutter", { bh: "BH-6405" }, "65.9×29", { value: 3.55, perFt: 12 }, CATALOGUE("Banu Hashim p.57")),
    prof("bh31_handle_sgu", "31 mm Shutter (single glass)", "handle", { bh: "BH-6406" }, "59×31.4", { value: 3.45, perFt: 12 }, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_handle_dgu", "31 mm Shutter (double glass)", "handle", { bh: "BH-6407" }, "59×31.4", { value: 3.15, perFt: 12 }, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_slim", "31 mm Slim Interlock — small", "slim-interlock", { bh: "BH-6408" }, "38.1×20.2", { value: 2.5, perFt: 12 }, CATALOGUE("Banu Hashim p.58"), { faceMm: 20.2 }),
    prof("bh31_spine", "31 mm Slim Interlock — big (reinforcement)", "slim-interlock", { bh: "BH-6409" }, "80.1×20.2", { value: 4.5, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
    prof("bh31_slim_dgu", "31 mm Slim Interlock — small, double glass", "slim-interlock", { bh: "BH-6410" }, "38.1×20.2", { value: 2.1, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
    prof("bh31_spine_dgu", "31 mm Slim Interlock — big, double glass", "slim-interlock", { bh: "BH-6411" }, "80.1×20.2", { value: 4.2, perFt: 12 }, CATALOGUE("Banu Hashim p.59"), { faceMm: 20.2 }),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame(byTracks("bh31_track_2t", "bh31_track_3t")),
    part("shutterTop", "{s} Shutter Top{tag}", "bh31_rail_sgu", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "bh31_rail_sgu", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLock", "{s} Handle Side{tag}", "bh31_handle_sgu", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterMeet", "{s} Slim Interlock{tag}", "bh31_slim", "shutter", "shutterH", 45, "sash-meet"),
  ],
  notes: ["Banu Hashim prints a plain track (6400 / 6402) and a track with leg (6401 / 6403). Pick the one your shop uses."],
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
  sizes: UNKNOWN_SIZES(),
  parts: [
    part("frameTop", "Top Track", byTracks("at_t2", "at_t3"), "window", "frameW", 90, "frame-top"),
    part("frameLeft", "Left Side (one groove)", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side (one groove)", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-right"),
    part("frameBottom", "Bottom Gulf Track", byTracks("at_b2", "at_b3"), "window", "frameW", 90, "frame-bottom"),
    part("shutterTop", "{s} Shutter Top{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock Clip {k}", "at_clip", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["The vertical Gulf (AT-30001) has one groove, so it goes on the left and right; the top takes the 2-track (AT-30016). Check which bottom your shop uses.", "Gulf shops differ on which piece runs full length — teach from one window."],
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

export const TEMPLATES: StudioSystem[] = [
  NORMAL_18, DOMAL_27,
  NORMAL_25, NORMAL_5T,
  AMPLE_27, ELEANOR_27, DOMAL_35, MINI_DOMAL_20, AMPLE_22, AMPLE_25, AMPLE_26,
  AMPLE_29, AMPLE_37,
  EURO_26, GULF_25, BH_31, BH_35, GULF_S30, GULF,
  Z_40, Z_55,
  BLANK_DOMAL_TYPE, BLANK_SLIDING,
];

/** The kind of section each part takes (for blanks and drafts with no sections yet). */
export const PART_KIND: Record<string, ProfileKind> = {
  top: "track", left: "track", right: "track", bottom: "track",
  handle: "handle", interlock: "interlock", bearingTop: "bearing", bearingBottom: "bearing",
  frameTop: "frame", frameLeft: "frame", frameRight: "frame", frameBottom: "frame",
  shutterTop: "shutter", shutterBottom: "shutter", shutterLeft: "shutter", shutterRight: "shutter",
  shutterLock: "shutter", shutterMeet: "interlock", interlockSpine: "interlock", trackClip: "rail",
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
