/**
 * Ready drafts the shop starts from. Numbers carry their evidence:
 *   verified = measured on a real founder job
 *   observed = seen in shop videos we read ourselves (not yet measured)
 *   unknown  = no evidence; the shop teaches it from one of its own windows
 * No number here comes from doc 18 (see docs/studio/FORMULA_EVIDENCE_REGISTER.md).
 *
 * normal-18 and domal-27 must reproduce the built-in engine EXACTLY —
 * evals/studio/parity.ts checks every golden path.
 */
import { mm, inches } from "../engine/units";
import type {
  StudioSystem, SizeDef, SizeCase, PartDef, ProfileDef, Evidence, ExtraDef, Cond, ProfileKind,
} from "./model";

const SUT = 3175;
const ev = (status: Evidence["status"], source: string): Evidence => ({ status, source });
const UNKNOWN = ev("unknown", "");
const size = (id: string, label: string, ...cases: SizeCase[]): SizeDef => ({ id, label, cases });
const rule = (base: string, add: number | null, evidence: Evidence, more: Partial<SizeCase> = {}): SizeCase =>
  ({ base, add, evidence, ...more });
const unknownFrom = (base: string, more: Partial<SizeCase> = {}) => rule(base, null, UNKNOWN, more);

function part(id: string, role: string, profile: string | { when?: Cond; id: string }[], scope: PartDef["scope"],
  length: string, angle: 90 | 45, more: Partial<PartDef> = {}): PartDef {
  return { id, role, profile: typeof profile === "string" ? [{ id: profile }] : profile, scope, count: 1, length, angle, ...more };
}
const prof = (id: string, name: string, codes: Record<string, string>, sizeMm: string,
  kg: ProfileDef["kg"], stockFt: number[], source: Evidence): ProfileDef =>
  ({ id, name, codes, size: sizeMm, kg, stockFt, source });

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
const FOUNDER = (s: string) => ev("verified", `Founder job: ${s}`);
const VIDEO = (s: string) => ev("observed", `Shop videos: ${s}`);

/* ———————————————— Normal / Bombay 18 mm ———————————————— */
export const NORMAL_18: StudioSystem = {
  id: "normal-18", name: "Normal sliding 18 mm (Bombay)", family: "sliding",
  blurb: "Top + 2 sides + bottom track; shutter from handle, interlock and 2 bearings",
  version: 1, status: "verified",
  layouts: [
    { tracks: 2, mixes: ["GG", "GJ", "JJ"] },
    { tracks: 3, mixes: ["GGJ", "GGG", "GJJ", "GG"] },
  ],
  switches: [MODE_SWITCH],
  profiles: [
    prof("2t_top", "2-Track Top/Side", { omeo: "1000", alpro: "1801" }, "62×32", { value: 2.5, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("2t_bottom", "2-Track Bottom", { omeo: "1011", alpro: "1821" }, "62×32", { value: 2.5, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("3t_top", "3-Track Top/Side", { omeo: "1021" }, "92×32", { value: 2.7, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("3t_bottom", "3-Track Bottom", { omeo: "1031", alpro: "1831" }, "92×32", { value: 2.7, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("handle_std", 'Handle 3/4"×1.5"', { omeo: "1041", alpro: "1841" }, "40×18", { value: 1.3, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("interlock", "Interlock", { omeo: "1081" }, "", { value: 1.2, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
    prof("bearing", "Bearing / H-Section", { omeo: "1051" }, "", { value: 1.3, perFt: 16 }, [16], CATALOGUE("OMEO catalogue")),
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
    part("top", "Top", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "trackW", 90),
    part("left", "Left Side", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "sideH", 90),
    part("right", "Right Side", [{ when: { tracks: "3" }, id: "3t_top" }, { id: "2t_top" }], "window", "sideH", 90),
    part("bottom", "Bottom", [{ when: { tracks: "3" }, id: "3t_bottom" }, { id: "2t_bottom" }], "window", "trackW", 90),
    part("handle", "{s} Handle{tag}", "handle_std", "shutter", "shutterH", 90),
    part("interlock", "{s} Interlock{tag}", "interlock", "shutter", "shutterH", 90),
    part("bearingTop", "{s} Bearing Top{tag}", "bearing", "shutter", "bearing", 90),
    part("bearingBottom", "{s} Bearing Bottom{tag}", "bearing", "shutter", "bearing", 90),
  ],
  infill: { w: "glassW", h: "glassH" },
  extras: SLIDING_EXTRAS,
  wastagePct: 5,
  jobs: [],
  notes: ["A 4-track window has no 4-track section in the master yet — it is built on the 2-track top/bottom."],
};

/* ———————————————— Domal 27×65 ———————————————— */
export const DOMAL_27: StudioSystem = {
  id: "domal-27", name: "Domal 27×65", family: "domal-type",
  blurb: "45° frame (2-track 2051 / 3-track 2062); one shutter profile on all 4 sides + interlock patti",
  version: 1, status: "verified",
  layouts: [
    { tracks: 2, mixes: ["GG", "GJ", "JJ"] },
    { tracks: 3, mixes: ["GGJ", "GGG", "GJJ", "GG"] },
  ],
  switches: [MODE_SWITCH],
  profiles: [
    prof("domal_frame_2t", "Domal 2-Track Frame", { omeo: "2051" }, "45×45", { value: 3.2, perFt: 15 }, [16], CATALOGUE("OMEO 2051")),
    prof("domal_frame", "Domal 3-Track Frame", { omeo: "2062" }, "", { value: 4.968, perFt: 16 }, [16], CATALOGUE("OMEO 2062")),
    prof("domal_glass_shutter", "Domal Glass Shutter", { omeo: "2046/2047" }, "27×65", { value: 3.2, perFt: 15 }, [16], CATALOGUE("OMEO 2046")),
    prof("domal_jali_shutter", "Domal Mesh Shutter", { omeo: "2081/2082" }, "", { value: 3.226, perFt: 12 }, [16], CATALOGUE("OMEO 2081")),
    prof("domal_interlock", "Domal Interlock Patti", { omeo: "2091" }, "", { value: 0.88, perFt: 12 }, [16], CATALOGUE("OMEO 2091")),
  ],
  sizes: [
    size("frameW", "Frame top / bottom", rule("W", 0, FOUNDER("45° frame, full width"))),
    size("frameH", "Frame side", rule("H", 0, FOUNDER("45° frame, full height"))),
    size("shutterW", "Shutter width",
      rule("W", 0, VIDEO("3 glass share: (W + 1⅝″) ÷ 3"), { when: { mode: "equal", glass: "3" }, pre: inches(1.625), den: 3 }),
      rule("W", 0, VIDEO("4 glass share: (W + 4″) ÷ 4"), { when: { mode: "equal", glass: "4" }, pre: inches(4), den: 4 }),
      rule("W", 0, FOUNDER("every shutter is half the window"), { den: 2 })),
    size("shutterH", "Shutter height", rule("H", -mm(66.7), FOUNDER("66×58 3-track, shutter side 55⅜″"))),
    size("glassW", "Glass width", rule("shutterW", -mm(102), FOUNDER("shutter − 102 mm; videos 4″–4⅛″"))),
    size("glassH", "Glass height", rule("shutterH", -mm(102), FOUNDER("shutter − 102 mm; videos 4″–4⅛″"))),
  ],
  parts: [
    ...(["Top", "Left", "Right", "Bottom"] as const).map((side) =>
      part(`frame${side}`, `Frame ${side}`, [{ when: { tracks: ["1", "2"] }, id: "domal_frame_2t" }, { id: "domal_frame" }],
        "window", side === "Top" || side === "Bottom" ? "frameW" : "frameH", 45)),
    ...(["Top", "Bottom", "Left", "Right"] as const).map((side) =>
      part(`shutter${side}`, `{s} Shutter ${side}{tag}`, "domal_glass_shutter", "shutter",
        side === "Top" || side === "Bottom" ? "shutterW" : "shutterH", 45, { meshProfile: "domal_jali_shutter" })),
    part("interlock", "Interlock {k}", "domal_interlock", "meeting", "shutterH", 90, { count: 2 }),
  ],
  infill: { w: "glassW", h: "glassH" },
  extras: SLIDING_EXTRAS,
  wastagePct: 5,
  jobs: [],
};

/* ———————————————— Drafts (observed / unknown) ———————————————— */

/** 25×50 / 25×65 sliding — same 4-profile shutter as 18 mm, bigger section. */
export const NORMAL_25: StudioSystem = {
  ...NORMAL_18,
  id: "normal-25", name: "Sliding 25 mm (25×50 / 25×65)", status: "draft",
  blurb: "Like 18 mm Bombay but 1″ deep: handle, built-in interlock, top and bearing",
  layouts: [{ tracks: 2, mixes: ["GG", "GJ"] }, { tracks: 3, mixes: ["GGJ", "GGG"] }],
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
  notes: ["Profiles: add the codes from your catalogue. Track and side cuts are not known yet — teach them from one window."],
};

/** 35×75 domal — two track widths and 3+1 / 4+1 on one wide frame. */
export const DOMAL_35: StudioSystem = {
  ...DOMAL_27,
  id: "domal-35", name: "Domal 35×75", status: "draft",
  blurb: "One 35×75 profile on all 4 sides + interlock patti; 2-track, 3+1 or 4+1",
  layouts: [{ tracks: 2, mixes: ["GG", "GJ"] }, { tracks: 4, mixes: ["GGGJ"] }, { tracks: 5, mixes: ["GGGGJ"] }],
  switches: [{
    id: "track", label: "Track width (2-track)", default: "1.75",
    options: [{ value: "1.75", label: '1¾″ track' }, { value: "2", label: '2″ track' }],
  }],
  profiles: [],
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
};

/** 5-track 50 mm Bombay-type. */
export const NORMAL_5T: StudioSystem = {
  ...NORMAL_25,
  id: "normal-5t", name: "5-track 50 mm sliding",
  blurb: "2″ 5-track frame at 45°; handle, interlock and bearing shutters",
  layouts: [{ tracks: 5, mixes: ["GGGGG", "GGGJJ"] }],
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

/** Ample 22 mm — parts read from the catalogue page; every cut unknown. */
export const AMPLE_22: StudioSystem = {
  ...DOMAL_27,
  id: "ample-22", name: "22 mm sliding (Ample)", status: "draft",
  blurb: "Light domal-type: 35 mm track, one 55.8×22 shutter profile on 4 sides + interlock",
  layouts: [{ tracks: 2, mixes: ["GG", "GJ"] }, { tracks: 3, mixes: ["GGJ", "GGG"] }],
  switches: [],
  profiles: [
    prof("a22_track_2t", "2-Track Track", { ample: "41083" }, "53.9×35", { value: 0.8, perFt: 3.2808 }, [16], CATALOGUE("Ample 22 mm catalogue")),
    prof("a22_track_3t", "3-Track Track", { ample: "41084" }, "83.9×35", { value: 1.13, perFt: 3.2808 }, [16], CATALOGUE("Ample 22 mm catalogue")),
    prof("a22_shutter", "Shutter", { ample: "41082" }, "55.8×22", { value: 0.606, perFt: 3.2808 }, [16], CATALOGUE("Ample 22 mm catalogue")),
    prof("a22_interlock", "Interlock", { ample: "41085" }, "65×22", { value: 0.251, perFt: 3.2808 }, [16], CATALOGUE("Ample 22 mm catalogue (code also printed on a 30.9×26.2 cap — confirm with dealer)")),
  ],
  sizes: [
    size("frameW", "Track top / bottom", unknownFrom("W")),
    size("frameH", "Track side", unknownFrom("H")),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("shutterH", "Shutter height", unknownFrom("H")),
    size("glassW", "Glass width", unknownFrom("shutterW")),
    size("glassH", "Glass height", unknownFrom("shutterH")),
  ],
  parts: DOMAL_27.parts.map((p) => ({
    ...p,
    profile: p.scope === "window"
      ? [{ when: { tracks: ["1", "2"] }, id: "a22_track_2t" }, { id: "a22_track_3t" }]
      : [{ id: p.scope === "meeting" ? "a22_interlock" : "a22_shutter" }],
    meshProfile: p.meshProfile ? "a22_shutter" : undefined,
  })),
  notes: ["Catalogue gives sizes only. Teach every cut from one window you have made."],
};

/** Blank starting points for any other series (29/31/37 sleek, Gulf, mini domal…). */
export const BLANK_DOMAL_TYPE: StudioSystem = {
  ...AMPLE_22,
  id: "blank-domal-type", name: "New system — one shutter profile on 4 sides",
  blurb: "Start here for mini domal, sleek 29/31/37, Gulf with a 4-side shutter",
  profiles: [],
  parts: DOMAL_27.parts.map((p) => ({ ...p, profile: [{ id: "" }], meshProfile: undefined })),
  notes: ["Pick your profiles, untick parts you do not use, then teach from one window."],
};

export const BLANK_SLIDING: StudioSystem = {
  ...NORMAL_25,
  id: "blank-sliding", name: "New system — handle, interlock, bearing shutter",
  blurb: "Start here for any Bombay-type series with a 4-profile shutter",
  sizes: [
    size("trackW", "Top / bottom track", unknownFrom("W")),
    size("sideH", "Frame side", unknownFrom("H")),
    size("shutterH", "Shutter height (handle, interlock)", unknownFrom("H")),
    size("bearing", "Bearing (top & bottom)", unknownFrom("W", { den: 2 })),
    size("shutterW", "Shutter width", unknownFrom("W", { den: 2 })),
    size("glassW", "Glass width", unknownFrom("bearing")),
    size("glassH", "Glass height", unknownFrom("shutterH")),
  ],
  parts: NORMAL_18.parts.map((p) => ({ ...p, profile: [{ id: "" }] })),
  notes: ["Pick your profiles, untick parts you do not use, then teach from one window."],
};

export const TEMPLATES: StudioSystem[] = [
  NORMAL_18, DOMAL_27, NORMAL_25, DOMAL_35, NORMAL_5T, AMPLE_22, BLANK_SLIDING, BLANK_DOMAL_TYPE,
];

/** What each built-in section is, so the picker can offer the right ones. */
const KIND_OF: Record<string, ProfileKind> = {
  "2t_top": "track", "2t_bottom": "track", "3t_top": "track", "3t_bottom": "track",
  handle_std: "handle", interlock: "interlock", bearing: "bearing",
  domal_frame_2t: "frame", domal_frame: "frame", domal_glass_shutter: "shutter",
  domal_jali_shutter: "mesh-shutter", domal_interlock: "interlock-patti",
  a22_track_2t: "track", a22_track_3t: "track", a22_shutter: "shutter", a22_interlock: "interlock-patti",
};
for (const t of TEMPLATES) for (const p of t.profiles) p.kind ??= KIND_OF[p.id] ?? "other";

/** The kind of section each built-in part takes (for blanks and drafts with no sections yet). */
export const PART_KIND: Record<string, ProfileKind> = {
  top: "track", left: "track", right: "track", bottom: "track",
  handle: "handle", interlock: "interlock", bearingTop: "bearing", bearingBottom: "bearing",
  frameTop: "frame", frameLeft: "frame", frameRight: "frame", frameBottom: "frame",
  shutterTop: "shutter", shutterBottom: "shutter", shutterLeft: "shutter", shutterRight: "shutter",
};

/** Every built-in section, once — the starting section library. */
export const BUILT_IN_PROFILES: ProfileDef[] = (() => {
  const seen = new Map<string, ProfileDef>();
  for (const t of TEMPLATES) for (const p of t.profiles) if (!seen.has(p.id)) seen.set(p.id, p);
  return [...seen.values()];
})();
