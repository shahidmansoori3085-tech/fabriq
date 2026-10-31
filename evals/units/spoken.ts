/**
 * Sizes said out loud — English, Hinglish, Devanagari — must read exactly,
 * and anything unclear must be refused, never guessed.
 * `npx tsx evals/units/spoken.ts` exits non-zero on any regression.
 */
import { parseSpokenSize, parseSpokenSizes, bestSpokenSizes, parseSpokenList, bestSpokenList } from "../../lib/engine/spoken";
import { formatFtInSut } from "../../lib/engine/units";

const ONE: [string, string | null][] = [
  // English, as Chrome's en-IN engine writes it
  ["4 feet 6 inch", '54"'], ["4 feet 6 inches 2 sut", '54"2s'], ["4 foot 6", '54"'], ["5 feet", '60"'],
  ["54 inch", '54"'], ["54 inch 3", '54"3s'], ["fifty four inches", '54"'], ["four feet six inches", '54"'],
  ["4 and a half feet", '54"'], ["1372 mm", '54"'], ["4'6\"", '54"'], ["4 ft. 6 in.", '54"'],
  // no unit said — read like the size box: 4.6 is 4'6"
  ["4.6", '54"'], ["4.10", '58"'], ["char point chhe", '54"'], ["54", '54"'], ["4", '48"'],
  // Hinglish
  ["char foot chhe inch", '54"'], ["chaar feet do sut", '48"2s'], ["saadhe chaar foot", '54"'],
  ["sava paanch feet", '63"'], ["paune chhe feet", '69"'], ["dedh foot", '18"'], ["saadhe chaar", '54"'],
  ["4 fut 6 inch", '54"'], ["width 4 feet 6 inch", '54"'],
  // Devanagari, as the hi-IN engine writes it
  ["चार फुट छह इंच", '54"'], ["4 फुट 6 इंच", '54"'], ["४ फुट ६ इंच", '54"'], ["साढ़े चार फुट", '54"'],
  ["5 फीट 2 इंच 3 सूत", '62"3s'],
  // bigger Hindi numbers, hundreds, and what en-IN mishears
  ["चौवन इंच", '54"'], ["chauvan inch", '54"'], ["बासठ इंच तीन सूत", '62"3s'], ["ek sau bees inch", '120"'],
  ["fifteen hundred mm", '59"'], ["एक सौ बीस इंच", '120"'], ["for feet six inch", '54"'], ["to feet", '24"'],
  // must refuse
  ["", null], ["hello", null], ["4 6", null], ["feet", null], ["4 feet 14 inch", null], ["4 inch 9 sut", null],
  ["4 feet 6 2", null], ["saadhe", null], ["4 point 6 feet", null],
];

let fail = 0;
for (const [raw, want] of ONE) {
  const v = parseSpokenSize(raw);
  const got = v == null ? null : formatFtInSut(v);
  if (got !== want) { fail++; console.log(`FAIL ${JSON.stringify(raw)}: want ${want} got ${got}`); }
}

const MANY: [string, string[] | null][] = [
  ["4 feet 6 by 5 feet", ['54"', '60"']], ["4.6 x 5", ['54"', '60"']], ["4.6 × 5.3", ['54"', '63"']],
  ["char foot by paanch foot", ['48"', '60"']], ["4 फुट बाय 5 फुट", ['48"', '60"']], ["4.6", ['54"']],
  ["4 by 5 by 2", ['48"', '60"', '24"']], ["4 by hello", null], ["by", null],
];
for (const [raw, want] of MANY) {
  const v = parseSpokenSizes(raw);
  const got = v == null ? null : v.map(formatFtInSut);
  if (JSON.stringify(got) !== JSON.stringify(want)) { fail++; console.log(`FAIL many ${JSON.stringify(raw)}: want ${JSON.stringify(want)} got ${JSON.stringify(got)}`); }
}

const LIST: [string, string | null][] = [
  ["4.6 by 5", '54"×60"'], ["4.6 by 5 teen nag", '54"×60" ×3'], ["qty 2 4 feet by 5 feet", '48"×60" ×2'],
  ["4.6 by 5 3 piece agla 3 by 4", '54"×60" ×3 | 36"×48"'], ["4.6 by 5, 3 by 4 do nag", '54"×60" | 36"×48" ×2'],
  ["चार फुट बाय पांच फुट दो नग अगला तीन फुट बाय चार फुट", '48"×60" ×2 | 36"×48"'],
  ["4.6 by 5 agla hello", null],
];
const fmtLines = (ls: ReturnType<typeof parseSpokenList>) =>
  ls == null ? null : ls.map((l) => l.sizes.map(formatFtInSut).join("×") + (l.qty ? ` ×${l.qty}` : "")).join(" | ");
for (const [raw, want] of LIST) {
  const got = fmtLines(parseSpokenList(raw));
  if (got !== want) { fail++; console.log(`FAIL list ${JSON.stringify(raw)}: want ${want} got ${got}`); }
}
// "4 feet, 6 inch" is one size, not two openings — the comma split must not win when it doesn't fit
const comma = bestSpokenList(["4 feet, 6 inch by 5 feet"], (ls) => ls.every((l) => l.sizes.length === 2));
if (fmtLines(comma?.lines ?? null) !== '54"×60"') { fail++; console.log(`FAIL comma: got ${fmtLines(comma?.lines ?? null)}`); }

const best = bestSpokenSizes(["for feet sex inch", "4 feet 6 inch"]);
if (best?.heard !== "4 feet 6 inch") { fail++; console.log(`FAIL best: got ${JSON.stringify(best)}`); }

const total = ONE.length + MANY.length + LIST.length + 2;
console.log(fail ? `${fail}/${total} failed` : `all ${total} spoken cases ok`);
process.exit(fail ? 1 : 0);
