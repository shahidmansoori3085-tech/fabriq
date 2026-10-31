/**
 * Sizes said out loud — what the phone's speech engine hands back, in
 * English, Hinglish or Devanagari:
 *   "4 feet 6 inch 2 sut"      "char foot chhe inch"     "चार फुट छह इंच"
 *   "saadhe chaar foot"        "4 foot 6" (6 = inches)   "fifty four inch"
 *   "4 feet 6 by 5 feet"       → two sizes, width × height
 *
 * Same rule as the typed parser: never guess. A number with no unit is
 * only read when it is the whole size ("4.6", handed to parseTradeSize like
 * a typed box) or when it trails a unit ("4 foot 6" → 6 inches). Anything
 * else left over and the size is refused, so the fabricator says it again
 * instead of cutting a wrong one.
 */
import { parseTradeSize, UM_PER_FOOT, UM_PER_INCH, UM_PER_SUT, UM_PER_MM, type Um } from "./units";

const NUMBER_WORDS: Record<string, number> = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Hinglish (Roman), with the spellings speech engines actually produce
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, chār: 4, paanch: 5, panch: 5, pach: 5, paach: 5,
  chhe: 6, chhah: 6, chah: 6, che: 6, chheh: 6, saat: 7, sat: 7, aath: 8, ath: 8, nau: 9, no: 9,
  das: 10, dus: 10, gyarah: 11, gyara: 11, barah: 12, bara: 12, terah: 13, tera: 13,
  chaudah: 14, chauda: 14, pandrah: 15, pandra: 15, solah: 16, sola: 16, satrah: 17, satra: 17,
  atharah: 18, athara: 18, unnis: 19, bees: 20, bis: 20, shunya: 0,
  ikkis: 21, bais: 22, teis: 23, tais: 23, chaubis: 24, chobis: 24, pachchis: 25, pachis: 25,
  chhabbis: 26, chabbis: 26, sattais: 27, satais: 27, atthais: 28, athais: 28, untis: 29,
  tees: 30, tis: 30, iktis: 31, ikattis: 31, battis: 32, taintis: 33, tetis: 33, chautis: 34, chontis: 34,
  paintis: 35, pentis: 35, chhattis: 36, chattis: 36, saintis: 37, adtis: 38, artis: 38, untalis: 39,
  chalis: 40, chaalis: 40, iktalis: 41, bayalis: 42, byalis: 42, taintalis: 43, chavalis: 44, chauvalis: 44,
  paintalis: 45, chhiyalis: 46, saintalis: 47, adtalis: 48, artalis: 48, unchas: 49,
  pachas: 50, pachaas: 50, ikyavan: 51, bavan: 52, tirepan: 53, chauvan: 54, chauwan: 54, pachpan: 55,
  chhappan: 56, chappan: 56, sattavan: 57, atthavan: 58, unsath: 59, saath: 60, iksath: 61, basath: 62,
  tirsath: 63, chausath: 64, painsath: 65, chhiyasath: 66, sadsath: 67, adsath: 68, unhattar: 69,
  sattar: 70, ikhattar: 71, bahattar: 72, tihattar: 73, chauhattar: 74, pachhattar: 75, chhihattar: 76,
  sathattar: 77, athattar: 78, unyasi: 79, assi: 80, ikyasi: 81, bayasi: 82, tirasi: 83, chaurasi: 84,
  pachasi: 85, chhiyasi: 86, sattasi: 87, atthasi: 88, navasi: 89, nabbe: 90,
  // what en-IN hears when a number is said quickly
  for: 4, fore: 4, to: 2, too: 2, ate: 8,
  // Devanagari
  "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "छः": 6, "छे": 6, "छ": 6,
  "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "ग्यारह": 11, "बारह": 12, "तेरह": 13, "चौदह": 14,
  "पंद्रह": 15, "पन्द्रह": 15, "सोलह": 16, "सत्रह": 17, "अठारह": 18, "उन्नीस": 19, "बीस": 20,
  "इक्कीस": 21, "बाईस": 22, "तेईस": 23, "चौबीस": 24, "पच्चीस": 25, "छब्बीस": 26, "सत्ताईस": 27,
  "अट्ठाईस": 28, "उनतीस": 29, "तीस": 30, "इकतीस": 31, "बत्तीस": 32, "तैंतीस": 33, "चौंतीस": 34,
  "पैंतीस": 35, "छत्तीस": 36, "सैंतीस": 37, "अड़तीस": 38, "उनतालीस": 39, "चालीस": 40, "इकतालीस": 41,
  "बयालीस": 42, "तैंतालीस": 43, "चवालीस": 44, "पैंतालीस": 45, "छियालीस": 46, "सैंतालीस": 47,
  "अड़तालीस": 48, "उनचास": 49, "पचास": 50, "इक्यावन": 51, "बावन": 52, "तिरेपन": 53, "चौवन": 54,
  "पचपन": 55, "छप्पन": 56, "सत्तावन": 57, "अट्ठावन": 58, "उनसठ": 59, "साठ": 60, "इकसठ": 61,
  "बासठ": 62, "तिरसठ": 63, "चौंसठ": 64, "पैंसठ": 65, "छियासठ": 66, "सड़सठ": 67, "अड़सठ": 68,
  "उनहत्तर": 69, "सत्तर": 70, "इकहत्तर": 71, "बहत्तर": 72, "तिहत्तर": 73, "चौहत्तर": 74,
  "पचहत्तर": 75, "छिहत्तर": 76, "सतहत्तर": 77, "अठहत्तर": 78, "उन्यासी": 79, "अस्सी": 80,
  "इक्यासी": 81, "बयासी": 82, "तिरासी": 83, "चौरासी": 84, "पचासी": 85, "छियासी": 86, "सत्तासी": 87,
  "अट्ठासी": 88, "नवासी": 89, "नब्बे": 90,
};
/** "ek sau bees" = 120, "fifteen hundred mm" = 1500. */
const HUNDRED = new Set(["sau", "hundred", "सौ"]);
const TENS = new Set([20, 30, 40, 50, 60, 70, 80, 90]);

/** Words that change the number after them: saadhe 4 = 4.5, sava 4 = 4.25, paune 4 = 3.75. */
const FRACTION_PREFIX: Record<string, number> = {
  saadhe: 0.5, sadhe: 0.5, saade: 0.5, sade: 0.5, "साढ़े": 0.5, "साढे": 0.5,
  sava: 0.25, sawa: 0.25, "सवा": 0.25,
  paune: -0.25, pone: -0.25, "पौने": -0.25,
};
/** Whole words for a half-number: dedh = 1.5, dhai = 2.5. */
const HALF_WORDS: Record<string, number> = {
  dedh: 1.5, dedhh: 1.5, derh: 1.5, "डेढ़": 1.5, "डेढ": 1.5,
  dhai: 2.5, dhaai: 2.5, dhaee: 2.5, "ढाई": 2.5,
};

type Unit = "ft" | "in" | "sut" | "mm" | "cm";
const UNIT_WORDS: Record<string, Unit> = {
  ft: "ft", feet: "ft", foot: "ft", fit: "ft", fut: "ft", feat: "ft", phoot: "ft", fits: "ft",
  "फुट": "ft", "फ़ुट": "ft", "फीट": "ft", "'": "ft",
  in: "in", inch: "in", inches: "in", inchi: "in", ich: "in", "इंच": "in", "इन्च": "in", '"': "in",
  sut: "sut", soot: "sut", suit: "sut", sutt: "sut", "सूत": "sut", "सुत": "sut", "सूट": "sut",
  mm: "mm", millimeter: "mm", millimetre: "mm", "मिलीमीटर": "mm", "एमएम": "mm",
  cm: "cm", centimeter: "cm", centimetre: "cm", "सेंटीमीटर": "cm",
};
const UNIT_UM: Record<Unit, number> = {
  ft: UM_PER_FOOT, in: UM_PER_INCH, sut: UM_PER_SUT, mm: UM_PER_MM, cm: UM_PER_MM * 10,
};
/** The unit a bare trailing number takes: "4 foot 6" is 6 inches, "54 inch 3" is 3 sut. */
const NEXT_DOWN: Partial<Record<Unit, Unit>> = { ft: "in", in: "sut" };
/** Most of the next unit down a part may hold before it is a mishearing, not a size. */
const MAX_PART: Partial<Record<Unit, number>> = { in: 11, sut: 7 };

/** Said between the numbers but carrying no size. */
const FILLER = new Set([
  "and", "aur", "or", "ka", "ki", "ke", "hai", "he", "h", "bas", "just", "only", "size", "the", "a",
  "width", "height", "chaudai", "chodai", "lambai", "unchai", "uchai", "wide", "high", "tall",
  "और", "का", "की", "के", "है", "बस", "चौड़ाई", "चौडाई", "लंबाई", "ऊंचाई", "ऊँचाई",
]);

/** Splits two sizes said together: "4 feet by 5 feet". */
const PAIR_SPLIT = /\s+(?:by|bye|buy|into|x|cross|बाय|बाई|गुणा|इनटू)\s+|\s*[×*]\s*/;

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[’‘′`´]/g, "'").replace(/[”“″]/g, '"')
    // "4.6" stays a decimal; a full stop or comma at a word edge is speech punctuation
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/[,?!।]/g, " ")
    .replace(/\.(?!\d)/g, " ")
    // "4feet" / "feet4" / "4'6"" — split numbers from words and symbols
    .replace(/(\d)([^\d\s.])/g, "$1 $2")
    .replace(/([^\d\s.])(\d)/g, "$1 $2")
    .replace(/(['"])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A number keeps the digits as said: "4.10" is 4'10" in the size box, not 4.1. */
type Tok = { n: number; digits?: string } | { u: Unit } | { point: true };

function tokenize(text: string): Tok[] | null {
  const words = text.split(" ").filter(Boolean);
  const out: Tok[] = [];
  let frac = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (FILLER.has(w)) continue;
    if (w in FRACTION_PREFIX) { frac = FRACTION_PREFIX[w]; continue; }
    if (w === "point" || w === "dot" || w === "पॉइंट" || w === "प्वाइंट") { out.push({ point: true }); continue; }
    if (w === "half" || w === "aadha" || w === "adha" || w === "आधा") {
      // "4 and a half feet" → 4.5; a lone "half foot" → 0.5
      const last = out[out.length - 1];
      if (last && "n" in last) { last.n += 0.5; last.digits = undefined; } else out.push({ n: 0.5 });
      continue;
    }
    if (HUNDRED.has(w)) {
      const last = out[out.length - 1];
      if (last && "n" in last && !last.digits && Number.isInteger(last.n) && last.n < 100) last.n *= 100;
      else out.push({ n: 100 });
      continue;
    }
    let n: number | null = null;
    if (/^\d+(?:\.\d+)?$/.test(w)) { out.push({ n: parseFloat(w), digits: w }); continue; }
    else if (w in NUMBER_WORDS) n = NUMBER_WORDS[w];
    else if (w in HALF_WORDS) n = HALF_WORDS[w];
    if (n !== null) {
      if (frac) { n += frac; frac = 0; }
      // "fifty four" → 54
      const last = out[out.length - 1];
      if (last && "n" in last && !last.digits && Number.isInteger(n) && n > 0
        && ((TENS.has(last.n) && n < 10) || (last.n >= 100 && last.n % 100 === 0 && n < 100))) { last.n += n; continue; }
      out.push({ n });
      continue;
    }
    if (w in UNIT_WORDS) { out.push({ u: UNIT_WORDS[w] }); continue; }
    return null; // a word we don't know — refuse, never guess
  }
  if (frac) return null;
  return out;
}

/** One size said out loud → µm, or null if it can't be read with certainty. */
export function parseSpokenSize(raw: string): Um | null {
  const toks = tokenize(normalize(raw));
  if (!toks || !toks.length) return null;

  // No unit said at all: "4.6", "char point chhe", "54" — read exactly as if
  // typed into the size box, where 4.6 means 4'6".
  if (!toks.some((t) => "u" in t)) {
    // "saadhe chaar" alone is 4½ feet — a spoken fraction is never 4'5"
    if (toks.length === 1 && "n" in toks[0] && !toks[0].digits && !Number.isInteger(toks[0].n)) {
      return Math.round(toks[0].n * UM_PER_FOOT);
    }
    let s = "";
    for (const t of toks) {
      if ("point" in t) s += ".";
      else if ("n" in t) {
        if (s && !s.endsWith(".")) return null; // two bare numbers — which is which?
        if (!t.digits && !Number.isInteger(t.n)) return null;
        s += t.digits ?? String(t.n);
      }
    }
    return parseTradeSize(s);
  }
  if (toks.some((t) => "point" in t)) return null; // "4 point 6 feet" — speech engines give "4.6" instead

  let total = 0;
  let lastUnit: Unit | null = null;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!("n" in t)) return null; // a unit with no number before it
    const next = toks[i + 1];
    let unit: Unit;
    if (next && "u" in next) { unit = next.u; i++; }
    else {
      // a bare number only counts when it trails a unit and is the last thing said
      const down: Unit | undefined = lastUnit ? NEXT_DOWN[lastUnit] : undefined;
      if (!down || i !== toks.length - 1) return null;
      unit = down;
    }
    const cap = MAX_PART[unit];
    if (lastUnit && cap !== undefined && NEXT_DOWN[lastUnit] === unit && t.n > cap) return null;
    total += t.n * UNIT_UM[unit];
    lastUnit = unit;
  }
  const um = Math.round(total);
  return um > 0 ? um : null;
}

/**
 * Everything said in one go: "4 feet 6 by 5 feet" → [width, height]. Returns
 * null if any part can't be read — the fabricator says it again.
 */
export function parseSpokenSizes(raw: string): Um[] | null {
  const parts = normalize(raw).split(PAIR_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 3) return null;
  const out: Um[] = [];
  for (const p of parts) {
    const um = parseSpokenSize(p);
    if (um === null) return null;
    out.push(um);
  }
  return out;
}

/** Try each thing the speech engine thought it heard; the first that reads wins. */
export function bestSpokenSizes(alternatives: string[]): { heard: string; sizes: Um[] } | null {
  for (const heard of alternatives) {
    const sizes = parseSpokenSizes(heard);
    if (sizes) return { heard, sizes };
  }
  return null;
}

/** One opening said out loud: its sizes, and how many — if a count was said. */
export type SpokenLine = { sizes: Um[]; qty: number | null };

/** "teen nag", "2 piece", "qty 3" — the count of one size. */
const QTY_AFTER = new Set(["nag", "naag", "nug", "piece", "pieces", "peace", "pcs", "pc", "nos", "number",
  "window", "windows", "khidki", "door", "doors", "darwaza", "नग", "पीस", "नंबर", "खिड़की", "दरवाजा"]);
const QTY_BEFORE = new Set(["qty", "quantity", "kwantiti", "क्वांटिटी", "क्वांटिटी"]);
/** Said between two openings: "4.6 by 5 agla 3 by 4". */
const LINE_WORDS = /\s+(?:agla|agli|agle|next|phir|fir|then|aur ek|अगला|अगली|अगले|फिर)\s+|;|\n/;
/** A comma usually splits openings too — but an engine may also write "4 feet, 6 inch". */
const LINE_COMMA = /\s+(?:agla|agli|agle|next|phir|fir|then|aur ek|अगला|अगली|अगले|फिर)\s+|,\s+|;|\n/;

function countWord(w: string): number | null {
  const n = /^\d+$/.test(w) ? parseInt(w, 10) : NUMBER_WORDS[w];
  return n !== undefined && n >= 1 && n <= 999 && Number.isInteger(n) ? n : null;
}

/** One opening: sizes plus an optional count, the count taken out before the sizes are read. */
export function parseSpokenLine(raw: string): SpokenLine | null {
  const words = normalize(raw).split(" ").filter(Boolean);
  let qty: number | null = null;
  for (let i = 0; i < words.length; i++) {
    if (QTY_AFTER.has(words[i]) && i > 0) {
      const n = countWord(words[i - 1]);
      if (n !== null && qty === null) { qty = n; words.splice(i - 1, 2); break; }
    }
    if (QTY_BEFORE.has(words[i]) && i < words.length - 1) {
      const n = countWord(words[i + 1]);
      if (n !== null && qty === null) { qty = n; words.splice(i, 2); break; }
    }
  }
  const sizes = parseSpokenSizes(words.join(" "));
  return sizes ? { sizes, qty } : null;
}

/** A whole list said in one go — "4.6 by 5 teen nag, agla 3 by 4 do nag". */
export function parseSpokenList(raw: string): SpokenLine[] | null {
  return splitLines(raw, LINE_COMMA) ?? splitLines(raw, LINE_WORDS);
}

function splitLines(raw: string, by: RegExp): SpokenLine[] | null {
  const parts = raw.toLowerCase().split(by).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out: SpokenLine[] = [];
  for (const p of parts) {
    const line = parseSpokenLine(p);
    if (!line) return null;
    out.push(line);
  }
  return out;
}

/** The first of the speech engine's guesses that reads as a list, and passes `fits`. */
export function bestSpokenList(
  alternatives: string[], fits: (lines: SpokenLine[]) => boolean,
): { heard: string; lines: SpokenLine[] } | null {
  for (const heard of alternatives) {
    for (const by of [LINE_COMMA, LINE_WORDS]) {
      const lines = splitLines(heard, by);
      if (lines && fits(lines)) return { heard, lines };
    }
  }
  return null;
}
