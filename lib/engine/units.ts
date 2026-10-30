/**
 * FabriQ unit system.
 *
 * Display language: feet / inches / sut (1 sut = 1/8" = 3.175 mm)
 * Engine language:  integer hundredths of a millimetre (mm100)
 *
 * All engine math happens in mm100 integers — no float drift on sut fractions.
 * (1 sut = 317.5 mm100 exactly? No: 3.175mm = 317.5 mm100 — half unit.
 *  So we use mm100 = mm × 100, and 1 sut = 317.5 is not integral.
 *  Instead: 1 inch = 2540 mm100, 1 sut = 2540/8 = 317.5 — still fractional.
 *  Fix: use mm200 internally? Simpler: use "sut-atoms": 1/16 inch = 158.75…
 *  Cleanest exact base: 1 inch = 25.4mm → use micrometres? µm: 1 inch = 25400µm,
 *  1 sut = 3175µm — integral! So engine unit = micrometres (µm).)
 */

/** Engine length: integer micrometres. 1 inch = 25400 µm, 1 sut = 3175 µm, 1 ft = 304800 µm. */
export type Um = number;

export const UM_PER_MM = 1000;
export const UM_PER_INCH = 25400;
export const UM_PER_SUT = 3175; // 1/8 inch
export const UM_PER_FOOT = 304800;

export const BAR_16FT: Um = 16 * UM_PER_FOOT; // 4876800 µm = 4876.8 mm
export const BAR_8FT: Um = 8 * UM_PER_FOOT; // 2438400 µm = 2438.4 mm

/**
 * Word-based units — "feet", "inch", "sut", "mm" — spelled out rather than as
 * a symbol, PLUS the symbols (" ') as their own tokens so a MIXED size like
 * `33" 5sut` (inches by symbol, sut by word — exactly how a photo-read sheet
 * comes through) tokenizes and totals correctly instead of the symbol part
 * going unclaimed and silently vanishing from the total. "fit"/"fits" is
 * accepted alongside "feet"/"ft" — a common misspelling/OCR reading a
 * fabricator's own handwriting produces often enough to be worth handling
 * rather than rejecting. A fabricator writes these in whichever order comes
 * naturally: "10 feet" as often as "feet 10", and a compound size in any
 * order of parts ("4 feet 6 inch 4 sut" or "6 inch 4 feet").
 */
const UNIT_WORD_VALUE: Record<string, number> = {
  mm: UM_PER_MM, cm: UM_PER_MM * 10,
  ft: UM_PER_FOOT, feet: UM_PER_FOOT, fit: UM_PER_FOOT, fits: UM_PER_FOOT, "फुट": UM_PER_FOOT, "'": UM_PER_FOOT,
  in: UM_PER_INCH, inch: UM_PER_INCH, inches: UM_PER_INCH, "\"": UM_PER_INCH,
  // "s" is how this app itself writes sut (58"3s) — a size copied back from
  // the app's own screen has to parse.
  sut: UM_PER_SUT, s: UM_PER_SUT,
};
const UNIT_WORD_RE = /^(mm|cm|ft|feet|fit|fits|फुट|'|in|inch|inches|"|sut|s)$/;
const NUMBER_TOKEN_RE = /^\d+(?:\.\d+)?$/;

/**
 * "feet 10 inch 6", "10 feet 6 inch", "sut 4", "inch 54", `33" 5sut` — any
 * order, any spacing, symbol or word, unit before or after its number. Every
 * number must sit next to a unit token or the whole thing is refused (never
 * guess which part is unitless) — that is what keeps this safe to try before
 * the older, order-fixed parsing below.
 */
function parseUnitPhrase(raw: string): Um | null {
  const lower = raw.trim().toLowerCase();
  // insert a boundary at every digit<->letter edge AND around every quote/
  // apostrophe, so "4feet6inch", "4 feet 6 inch" and `33"5sut` all tokenize
  // the same way
  const spaced = lower
    .replace(/(\d)([a-zA-Zऀ-ॿ'"])/g, "$1 $2")
    .replace(/([a-zA-Zऀ-ॿ'"])(\d)/g, "$1 $2")
    .replace(/(['"])/g, " $1 ");
  const tokens = spaced.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || !tokens.some((t) => UNIT_WORD_RE.test(t))) return null;

  let total = 0;
  const used = new Array(tokens.length).fill(false);
  for (let i = 0; i < tokens.length; i++) {
    if (!UNIT_WORD_RE.test(tokens[i])) continue;
    const before = i > 0 && !used[i - 1] && NUMBER_TOKEN_RE.test(tokens[i - 1]);
    const after = i < tokens.length - 1 && !used[i + 1] && NUMBER_TOKEN_RE.test(tokens[i + 1]);
    const numIdx = before ? i - 1 : after ? i + 1 : -1;
    if (numIdx === -1) return null; // a unit word with no number beside it
    total += parseFloat(tokens[numIdx]) * UNIT_WORD_VALUE[tokens[i]];
    used[i] = true;
    used[numIdx] = true;
  }
  // anything left unclaimed — a bare number with no unit, or a stray symbol —
  // means the string wasn't fully accounted for. Refuse rather than silently
  // total up only the part we understood.
  if (tokens.some((t, i) => !used[i])) return null;
  return Math.round(total);
}

/** Parse a human dimension string into µm. Returns null if unparseable.
 * Accepts: 4'6"  |  4-6-4 (ft-in-sut)  |  54  (inches if ≤ threshold? no — feet default)  |
 *          4.5 (decimal feet) | 1372mm | 137.2cm | 4 (feet) | 4x3 handled at caller level |
 *          spelled-out units in any order — "feet 10", "10 feet 6 inch", "sut 4"
 */
/**
 * Sheets write half feet as "4½", "3 1/2'" or "3-1/2", and feet-inches as
 * "5'-6\"". The reader copies them as written (it must never convert), so
 * the parser has to accept them — they used to come back "not understood".
 */
/**
 * Phones replace typed quotes with "smart" ones — iOS does it by default — so
 * `4'6"` arrives as `4’6”`. Fold every look-alike back to the plain symbols
 * the parser knows, or the size is simply not read.
 */
function normalizeQuotes(raw: string): string {
  return raw.replace(/[’‘′`´]/g, "'").replace(/[”“″]/g, '"');
}

function normalizeFractions(raw: string): string {
  const VULGAR: Record<string, string> = { "½": ".5", "¼": ".25", "¾": ".75" };
  return normalizeQuotes(raw)
    .replace(/(\d+)\s*([½¼¾])/g, (_, n, f) => `${n}${VULGAR[f]}`)
    .replace(/^\s*([½¼¾])/, (_, f) => `0${VULGAR[f]}`)
    .replace(/(\d+)[\s-]+(\d+)\/(\d+)/g, (_, n, a, b) => String(parseInt(n, 10) + parseInt(a, 10) / parseInt(b, 10)))
    .replace(/(['′])\s*-\s*(?=\d)/g, "$1");
}

export function parseDimension(raw: string): Um | null {
  raw = normalizeFractions(raw);
  const phrase = parseUnitPhrase(raw);
  if (phrase !== null) return phrase;

  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  // millimetres: "1372mm"
  let m = s.match(/^(\d+(?:\.\d+)?)mm$/);
  if (m) return Math.round(parseFloat(m[1]) * UM_PER_MM);

  // centimetres
  m = s.match(/^(\d+(?:\.\d+)?)cm$/);
  if (m) return Math.round(parseFloat(m[1]) * UM_PER_MM * 10);

  // inches only: 54" or 54in
  m = s.match(/^(\d+(?:\.\d+)?)(?:"|in|inch)$/);
  if (m) return Math.round(parseFloat(m[1]) * UM_PER_INCH);

  // ft-in-sut: 4-6-4 — an inch part of 12+ or a sut part of 8+ is a typo,
  // not a value to fold silently into the next unit up.
  m = s.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inch = parseInt(m[2], 10);
    const sut = m[3] ? parseInt(m[3], 10) : 0;
    if (inch >= 12 || sut >= 8) return null;
    return ft * UM_PER_FOOT + inch * UM_PER_INCH + sut * UM_PER_SUT;
  }

  // 4'6" or 4'6 or 4ft6in
  m = s.match(/^(\d+)(?:'|ft|feet|फुट)(?:(\d+(?:\.\d+)?)(?:"|in|inch)?)?$/);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inch = m[2] ? parseFloat(m[2]) : 0;
    if (inch >= 12) return null;
    return ft * UM_PER_FOOT + Math.round(inch * UM_PER_INCH);
  }

  // decimal feet: "4.5" or plain "4" → feet (fabricator default unit)
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(parseFloat(m[1]) * UM_PER_FOOT);

  return null;
}

/**
 * Format µm as inch-sut display string — NO feet folding (fabricator wants
 * every measurement in inch+sut, e.g. 69"7s not 5'9"7s), 2026-07-27.
 */
export function formatFtInSut(um: Um): string {
  const negative = um < 0;
  const v = Math.abs(Math.round(um));
  const inch = Math.floor(v / UM_PER_INCH);
  const rem = v - inch * UM_PER_INCH;
  let fInch = inch;
  let sut = Math.round(rem / UM_PER_SUT);
  if (sut === 8) { sut = 0; fInch += 1; }
  let out = `${fInch}"`;
  if (sut > 0) out += `${sut}s`;
  return (negative ? "-" : "") + out;
}

/** Opening-scale size the way it is measured on site — feet first: 5', 4'6", 3'2"4s. */
export function formatFtIn(um: Um): string {
  const totalSut = Math.round(um / UM_PER_SUT);
  const ft = Math.floor(totalSut / 96);
  const inch = Math.floor((totalSut % 96) / 8);
  const sut = totalSut % 8;
  return `${ft}'${inch || sut ? `${inch}"` : ""}${sut ? `${sut}s` : ""}`;
}

/** Format µm as mm (rounded) */
export function formatMm(um: Um): string {
  return `${Math.round(um / UM_PER_MM)}mm`;
}

/* ————————————————— opening dimensions ————————————————— */

/**
 * Reading a size the fabricator typed.
 *
 * A fabricator writing "4" means four FEET. The same "4" from someone working
 * off an inch tape means something twelve times smaller — and the app has no
 * way to know which. So we infer from magnitude, record HOW we read it, and the
 * UI always echoes the interpretation back (`describeDim`). A wrong guess then
 * shows up as a visible typo instead of a silently ruined job.
 */
export type UnitMode = "auto" | "feet" | "inch" | "mm";

export interface ParsedDim {
  um: Um;
  /** the written value carried its own unit — 4'6", 54", 1372mm, 4-6-4 */
  explicit: boolean;
  /** how a bare, unit-less number was read */
  assumed?: "feet" | "inch" | "mm";
  /** the other reading is believable too at this magnitude — worth a nudge */
  ambiguous: boolean;
}

/**
 * Magnitude bands for a bare, unit-less number. A fabricator never states the
 * unit, so the number itself has to say it — and the three bands do not
 * meaningfully overlap for real openings:
 *   under 20  → feet   (windows 3–6, doors 3–7, partitions up to ~20)
 *   20 – 299  → inches (24"–240" is the same 2–20 ft range on a tape)
 *   300 and up→ mm     (openings run 600–7000 mm; 300" would be 25 ft)
 */
const BARE_INCH_FROM = 20;
const BARE_MM_FROM = 300;
/** Below this, a bare number can only sensibly be feet — nothing is 12" wide. */
const BARE_FEET_UPTO = 12;

/**
 * Sanity band for a real opening. Outside it we refuse rather than confidently
 * pack bars for something that cannot exist.
 */
export const MIN_OPENING: Um = inches(12);
export const MAX_OPENING: Um = feet(25);

/**
 * Parse one opening dimension. `mode` is the entry screen's unit control:
 * "auto" infers from magnitude, the others force a reading for bare numbers.
 * Values written WITH a unit always win, whatever the mode.
 */
export function parseOpening(
  raw: string,
  mode: UnitMode = "auto",
  /** In auto mode, bare numbers below this are feet. Partitions run 20–25 ft,
   *  so for them a bare "20" is 20 ft, not the 20" a small window would be. */
  feetBelow: number = BARE_INCH_FROM,
): ParsedDim | null {
  const spaced = normalizeFractions(raw).trim().toLowerCase();
  if (!spaced) return null;

  const explicit = (um: Um): ParsedDim => ({ um, explicit: true, ambiguous: false });

  // "54 3s" — inches then sut, the way the app itself prints a size
  let m = spaced.match(/^(\d+)\s+(\d)\s*(?:s|sut)$/);
  if (m) {
    const sut = parseInt(m[2], 10);
    return sut >= 8 ? null : explicit(parseInt(m[1], 10) * UM_PER_INCH + sut * UM_PER_SUT);
  }

  // A space between plain numbers means the same as a dash: "4 6" is 4'6",
  // "4 6 4" is 4'6"4s. Joining them into "46" read a 4'6" window as 3'10".
  const s = spaced.replace(/^(\d+)\s+(\d+)(?:\s+(\d+))?$/, (_, a, b, c) => (c ? `${a}-${b}-${c}` : `${a}-${b}`))
    .replace(/\s+/g, "");

  // ft-in-sut: "4-6-4" — three parts is unambiguous, but an inch part of 12+
  // or a sut part of 8+ is a typo, never a value to carry over silently
  m = s.match(/^(\d+)-(\d+)-(\d+)$/);
  if (m) {
    const inch = parseInt(m[2], 10);
    const sut = parseInt(m[3], 10);
    if (inch >= 12 || sut >= 8) return null;
    return explicit(parseInt(m[1], 10) * UM_PER_FOOT + inch * UM_PER_INCH + sut * UM_PER_SUT);
  }

  // two-part dash is genuinely two notations: "4-6" is 4ft 6in, but "54-4" is
  // 54in 4sut. Sut never exceeds 7, and a feet part never reaches 13 in this
  // trade, so magnitude separates them cleanly.
  m = s.match(/^(\d+)-(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a >= 13) return b <= 7 ? explicit(a * UM_PER_INCH + b * UM_PER_SUT) : null;
    return b >= 12 ? null : explicit(a * UM_PER_FOOT + b * UM_PER_INCH);
  }

  // anything carrying its own unit — mm / cm / inch / feet / sut forms,
  // symbol or spelled-out word, in either order (parseDimension handles both;
  // it gets the spaced text so "4 ft 6 in" keeps its word boundaries)
  if (/(mm|cm|"|in|inch|'|ft|feet|fit|फुट|sut)/.test(s)) {
    const um = parseDimension(spaced);
    return um === null ? null : explicit(um);
  }

  // bare number — this is where the guessing happens
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!(n > 0)) return null;
  // "4.6" is written in the trade for 4'6" as often as for 4.6 ft. Quarters
  // and halves read the same either way; anything else is worth flagging.
  const frac = Math.round((n % 1) * 100);
  const oddDecimal = frac !== 0 && frac !== 25 && frac !== 50 && frac !== 75;

  if (mode === "mm") return { um: Math.round(n * UM_PER_MM), explicit: false, assumed: "mm", ambiguous: false };
  if (mode === "inch") return { um: Math.round(n * UM_PER_INCH), explicit: false, assumed: "inch", ambiguous: false };
  if (mode === "feet") return { um: Math.round(n * UM_PER_FOOT), explicit: false, assumed: "feet", ambiguous: false };

  // auto: the fabricator states no unit, so magnitude decides. The echo under
  // the input always shows the reading back, so a wrong band is visible.
  if (n >= BARE_MM_FROM) {
    return { um: Math.round(n * UM_PER_MM), explicit: false, assumed: "mm", ambiguous: false };
  }
  if (n >= feetBelow) {
    return { um: Math.round(n * UM_PER_INCH), explicit: false, assumed: "inch", ambiguous: false };
  }
  return {
    um: Math.round(n * UM_PER_FOOT),
    explicit: false,
    assumed: "feet",
    ambiguous: n > BARE_FEET_UPTO || oddDecimal,
  };
}

/**
 * A size typed on the phone's number keyboard, which has no ' or " key: the
 * point separates feet from inches the way the workshop writes it — 4.6 is
 * 4'6", 3.10 is 3'10", 4.6.2 is 4'6"2s. An inch part over 11 is a typo, never
 * guessed at. Everything else reads as parseOpening does: 54 → 54", 12 → 12 ft,
 * 1372 → mm, and 4'6" typed in full on a computer.
 */
export function parseTradeSize(raw: string, feetBelow?: number): Um | null {
  const t = raw.trim();
  if (!t) return null;
  const m = /^(\d+)\.(\d{1,2})?(?:\.(\d))?$/.exec(t);
  if (m) {
    const inch = m[2] ? parseInt(m[2], 10) : 0;
    const sut = m[3] ? parseInt(m[3], 10) : 0;
    if (inch > 11 || sut > 7) return null;
    const um = parseInt(m[1], 10) * UM_PER_FOOT + inch * UM_PER_INCH + sut * UM_PER_SUT;
    return um > 0 ? um : null;
  }
  return parseOpening(t, "auto", feetBelow)?.um ?? null;
}

/** A size back into the way it is typed: 4'6"2s → "4.6.2", 5' → "5". */
export function formatTradeSize(um: Um): string {
  const totalSut = Math.round(um / UM_PER_SUT);
  const ft = Math.floor(totalSut / 96);
  const inch = Math.floor((totalSut % 96) / 8);
  const sut = totalSut % 8;
  return `${ft}${inch || sut ? `.${inch}` : ""}${sut ? `.${sut}` : ""}`;
}

/** Human echo of a parsed size: `4'0" (48")` — what the app actually understood. */
export function describeDim(um: Um): string {
  const totalInch = um / UM_PER_INCH;
  // Round to whole sut FIRST, then split — rounding the sut last printed
  // "4'5"8s" instead of carrying it into 4'6".
  const totalSut = Math.round(um / UM_PER_SUT);
  const ft = Math.floor(totalSut / 96);
  const inch = Math.floor((totalSut % 96) / 8);
  const sut = totalSut % 8;
  // Under a foot, "0'4"" reads like a typo — just say 4".
  let head = ft > 0 ? `${ft}'` : "";
  if (!ft || inch || sut) head += `${inch}"`;
  if (sut) head += `${sut}s`;
  const total = Math.round(totalInch * 10) / 10;
  return ft > 0 ? `${head} (${total}")` : head;
}

/** Why this opening looks wrong, or null when it is believable. */
export function openingWarning(w: Um, h: Um): string | null {
  const small = Math.min(w, h);
  const large = Math.max(w, h);
  // The size was read in whatever unit its magnitude suggested — the advice
  // must not assume which one, or "300" (read as mm) is told to become 300 ft.
  if (small < MIN_OPENING) {
    return `${describeDim(small)} is too small. Check the unit — feet: 4'6, inches: 54", mm: 1372mm.`;
  }
  if (large > MAX_OPENING) {
    return `${describeDim(large)} is too large. Check the unit — feet: 4'6, inches: 54", mm: 1372mm.`;
  }
  return null;
}

/** µm → decimal feet (for totals) */
export function toFeet(um: Um): number {
  return um / UM_PER_FOOT;
}

/** µm → square-feet given two lengths */
export function sqft(w: Um, h: Um): number {
  return (w / UM_PER_FOOT) * (h / UM_PER_FOOT);
}

export function feet(n: number): Um {
  return Math.round(n * UM_PER_FOOT);
}
export function mm(n: number): Um {
  return Math.round(n * UM_PER_MM);
}
export function inches(n: number): Um {
  return Math.round(n * UM_PER_INCH);
}
