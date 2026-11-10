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
    prof("interlock", "Interlock", "interlock", { omeo: "1081" }, "", { value: 1.2, perFt: 16 }, CATALOGUE("OMEO catalogue"), { faceMm: 25 }),
    prof("bearing", "Bearing / H-Section", "bearing", { omeo: "1051" }, "", { value: 1.3, perFt: 16 }, CATALOGUE("OMEO catalogue"), { faceMm: 40 }),
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
  blurb: "45° frame (2-track 2051 / 3-track 2062); one shutter profile on all 4 sides + interlock patti",
  version: 1, status: "verified",
  layouts: [L2(), L3()],
  switches: [MODE_SWITCH],
  profiles: [
    prof("domal_frame_2t", "Domal 2-Track Frame", "frame", { omeo: "2051" }, "45×45", { value: 3.2, perFt: 15 }, CATALOGUE("OMEO 2051")),
    prof("domal_frame", "Domal 3-Track Frame", "frame", { omeo: "2062" }, "", { value: 4.968, perFt: 16 }, CATALOGUE("OMEO 2062")),
    prof("domal_glass_shutter", "Domal Glass Shutter", "shutter", { omeo: "2046/2047" }, "65×27", { value: 3.2, perFt: 15 }, CATALOGUE("OMEO 2046")),
    prof("domal_jali_shutter", "Domal Mesh Shutter", "mesh-shutter", { omeo: "2081/2082" }, "", { value: 3.226, perFt: 12 }, CATALOGUE("OMEO 2081")),
    prof("domal_interlock", "Domal Interlock Patti", "interlock-patti", { omeo: "2091" }, "", { value: 0.88, perFt: 12 }, CATALOGUE("OMEO 2091"), { faceMm: 10 }),
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
  profiles: [],
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
  parts: NORMAL_18.parts.map((p) => ({ ...p, profile: [{ id: "" }] })),
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

export const DOMAL_35: StudioSystem = base({
  id: "domal-35", name: "Domal 35×75", group: "domal",
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
  parts: DOMAL_27.parts.map((p) => ({ ...p, profile: [{ id: "" }], meshProfile: undefined })),
  notes: ["The mesh shutter in 3+1 / 4+1 is taken as the same width as a glass shutter — check it on your first job."],
});

export const MINI_DOMAL_20: StudioSystem = base({
  id: "mini-domal-20", name: "Mini domal 20×54", group: "domal",
  blurb: "Light domal: one 20×54 profile on 4 sides + interlock patti. Choose your sections.",
  sizes: UNKNOWN_SIZES(),
  parts: DOMAL_27.parts.map((p) => ({ ...p, profile: [{ id: "" }], meshProfile: undefined })),
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
  blurb: "47.7 mm track; 29×65 shutter; interlock or slim interlock picked per shutter",
  profiles: [
    prof("a29_track_2t", "29 mm 2-Track", "track", { ample: "914643" }, "50×47.7", perM(0.865), DRAWING("Ample 29 mm p.2")),
    prof("a29_track_3t", "29 mm 3-Track", "track", { ample: "41052" }, "85.8×47.7", perM(1.724), DRAWING("Ample 29 mm p.2")),
    prof("a29_track_4t", "29 mm 4-Track", "track", { ample: "41008" }, "121.6×47.69", perM(2.328), DRAWING("Ample 29 mm p.2")),
    prof("a29_shutter", "29 mm Shutter", "shutter", { ample: "41055" }, "65×29", perM(0.89), DRAWING("Ample 29 mm p.3")),
    prof("a29_interlock", "29 mm Interlock", "interlock", { ample: "41050" }, "65×29", perM(0.816), DRAWING("Ample 29 mm p.3")),
    prof("a29_interlock_b", "29 mm Interlock (heavy)", "interlock", { ample: "992325" }, "65×29", perM(0.865), DRAWING("Ample 29 mm p.7")),
    prof("a29_slim", "29 mm Slim Interlock", "slim-interlock", { ample: "992328" }, "37×29", perM(0.595), DRAWING("Ample 29 mm p.7"), { faceMm: 37 }),
    prof("a29_slim_40", "29 mm Slim Interlock 40", "slim-interlock", { ample: "41289" }, "40×29", perM(0.672), DRAWING("Ample 29 mm p.5"), { faceMm: 40 }),
    prof("a29_patti", "29 mm Interlock Clip", "interlock-patti", { ample: "41054" }, "33.63×38.89", perM(0.35), DRAWING("Ample 29 mm p.4"), { faceMm: 10 }),
    prof("a29_clip", "Glazing Clip", "bead", { ample: "992134" }, "16.2×12.9", perM(0.117), CATALOGUE("Ample 29 mm p.4")),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame(byTracks("a29_track_2t", "a29_track_3t")),
    ...stileShutter("a29_shutter", "a29_interlock").map((p) => (p.id === "shutterMeet" ? { ...p, perShutter: true } : p)),
  ],
  notes: ["Ample prints no names in this catalogue. Which section does which job is read from the drawings — confirm before buying."],
}), "shutterMeet", ["a29_interlock", "a29_slim", "a29_interlock_b"]);

export const AMPLE_37: StudioSystem = base({
  id: "ample-37", name: "37 mm sleek — Ample", group: "sleek", maker: "Ample",
  blurb: "53 mm track (41015 / 41014); 82.7×37 shutter 41068 with interlock 41074",
  profiles: [
    prof("a37_track_2t", "37 mm 2-Track", "track", { ample: "41015" }, "90×53", perM(1.822), DRAWING("Ample 37 mm p.2")),
    prof("a37_track_3t", "37 mm 3-Track", "track", { ample: "41014" }, "140×53", perM(2.688), DRAWING("Ample 37 mm p.2")),
    prof("a37_track_3t_b", "37 mm 3-Track (square)", "track", { ample: "41016" }, "109.9×49.8", perM(2.309), DRAWING("Ample 37 mm p.2")),
    prof("a37_shutter", "37 mm Shutter", "shutter", { ample: "41068" }, "82.7×37.01", perM(1.335), DRAWING("Ample 37 mm p.2")),
    prof("a37_shutter_b", "37 mm Shutter (light)", "shutter", { ample: "41076" }, "82.7×37.01", perM(1.274), DRAWING("Ample 37 mm p.2")),
    prof("a37_interlock", "37 mm Interlock", "interlock", { ample: "41074" }, "82.7×37.01", perM(1.397), DRAWING("Ample 37 mm p.2")),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame(byTracks("a37_track_2t", "a37_track_3t")),
    ...stileShutter("a37_shutter", "a37_interlock").map((p) => (p.id === "shutterMeet" ? { ...p, perShutter: true } : p)),
  ],
  notes: ["Ample prints no names in this catalogue. Which section does which job is read from the drawings — confirm before buying."],
});

export const BH_31: StudioSystem = withAlternatives(base({
  id: "bh-31", name: "31 mm slim — Banu Hashim", group: "sleek", maker: "Banu Hashim",
  blurb: "BH-6406 shutter (BH-6407 for double glass) with BH-6408 slim interlock. Choose your track.",
  profiles: [
    prof("bh31_shutter", "31 mm Shutter (single glass)", "shutter", { bh: "BH-6406" }, "59×31.4", { value: 3.45, perFt: 12 }, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_shutter_dgu", "31 mm Shutter (double glass)", "shutter", { bh: "BH-6407" }, "59×31.4", undefined, CATALOGUE("Banu Hashim p.58")),
    prof("bh31_slim", "31 mm Slim Interlock", "slim-interlock", { bh: "BH-6408" }, "38.1×20.2", undefined, CATALOGUE("Banu Hashim p.58"), { faceMm: 20.2 }),
  ],
  sizes: UNKNOWN_SIZES(),
  parts: [
    ...domalFrame([{ id: "" }]),
    ...stileShutter("bh31_shutter", "bh31_slim", "Slim Interlock"),
  ],
}), "shutterMeet", ["bh31_slim"]);

/* ———————————————— Gulf ———————————————— */

export const GULF: StudioSystem = base({
  id: "gulf", name: "Gulf series (25 / 30 / 31 / 35)", group: "gulf",
  blurb: "Separate bottom track + one top/side profile, joined at 90° with screws. Choose your sections.",
  sizes: UNKNOWN_SIZES(),
  parts: [
    part("frameTop", "Top", "", "window", "frameW", 90, "frame-top"),
    part("frameLeft", "Left Side", "", "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side", "", "window", "frameH", 90, "frame-right"),
    part("frameBottom", "Bottom Track", "", "window", "frameW", 90, "frame-bottom"),
    ...stileShutter("", ""),
  ],
  notes: ["Gulf shops differ: some run the sides full height, others the bottom track full width. Teach from one window and FabriQ follows yours."],
});

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
    part("frameTop", "Top", byTracks("at_v2", "at_v3"), "window", "frameW", 90, "frame-top"),
    part("frameLeft", "Left Side", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-left"),
    part("frameRight", "Right Side", byTracks("at_v2", "at_v3"), "window", "frameH", 90, "frame-right"),
    part("frameBottom", "Bottom Gulf Track", byTracks("at_b2", "at_b3"), "window", "frameW", 90, "frame-bottom"),
    part("shutterTop", "{s} Shutter Top{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-top"),
    part("shutterBottom", "{s} Shutter Bottom{tag}", "at_sgu", "shutter", "shutterW", 45, "sash-bottom"),
    part("shutterLeft", "{s} Shutter Left{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-lock"),
    part("shutterRight", "{s} Shutter Right{tag}", "at_sgu", "shutter", "shutterH", 45, "sash-meet"),
    part("interlock", "Interlock Clip {k}", "at_clip", "meeting", "shutterH", 90, "meeting", { count: 2 }),
  ],
  notes: ["Section names are printed in the Alucoat catalogue. Gulf shops differ on which piece runs full length — teach from one window."],
}), "interlock", ["at_clip", "at_dbl"]);

/* ———————————————— blanks ———————————————— */

export const BLANK_DOMAL_TYPE: StudioSystem = base({
  id: "blank-domal-type", name: "New system — shutter on 4 sides", group: "blank",
  blurb: "Any series where one shutter profile goes round (domal, sleek, mini domal…)",
  sizes: UNKNOWN_SIZES(),
  parts: [...domalFrame([{ id: "" }]), ...stileShutter("", "")],
  notes: ["Pick your sections, switch off pieces you do not use, then teach from one window."],
});

export const BLANK_SLIDING: StudioSystem = {
  ...NORMAL_25,
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
  notes: ["Pick your sections, switch off pieces you do not use, then teach from one window."],
};

export const TEMPLATES: StudioSystem[] = [
  NORMAL_18, DOMAL_27,
  NORMAL_25, NORMAL_5T,
  AMPLE_27, DOMAL_35, MINI_DOMAL_20, AMPLE_22, AMPLE_25, AMPLE_26,
  AMPLE_29, AMPLE_37, BH_31,
  GULF_S30, GULF,
  BLANK_DOMAL_TYPE, BLANK_SLIDING,
];

/** The kind of section each part takes (for blanks and drafts with no sections yet). */
export const PART_KIND: Record<string, ProfileKind> = {
  top: "track", left: "track", right: "track", bottom: "track",
  handle: "handle", interlock: "interlock", bearingTop: "bearing", bearingBottom: "bearing",
  frameTop: "frame", frameLeft: "frame", frameRight: "frame", frameBottom: "frame",
  shutterTop: "shutter", shutterBottom: "shutter", shutterLeft: "shutter", shutterRight: "shutter",
  shutterLock: "shutter", shutterMeet: "interlock",
};

/** Every built-in section, once — the starting section library. */
export const BUILT_IN_PROFILES: ProfileDef[] = (() => {
  const seen = new Map<string, ProfileDef>();
  for (const t of TEMPLATES) for (const p of t.profiles) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
})();
