/**
 * Every size format seen on real and eval sheets must parse — and keep
 * parsing. `npx tsx evals/units/parse.ts` exits non-zero on any regression.
 */
import { parseDimension, formatFtInSut, parseTradeSize, formatTradeSize } from "../../lib/engine/units";

const CASES: [string, string | null][] = [
  // the app's own display format, copied back by a fabricator
  ['58"3s', '58"3s'], ['57"2s', '57"2s'], ['57"2sut', '57"2s'], ['57" 2s', '57"2s'], ["4'9\"2s", '57"2s'],
  // fractions and dashed feet-inches
  ["4½", '54"'], ["3 1/2'", '42"'], ["3-1/2", '42"'], ["½'", '6"'], ["5'-6\"", '66"'], ["4'-3\"", '51"'],
  // classic shorthand
  ["4-6-4", '54"4s'], ["4'6\"", '54"'], ["4.5", '54"'], ["4", '48"'], ["54\"", '54"'], ["4ft", '48"'], ["4.5ft", '54"'],
  ["1500mm", '59"'], ["137.2cm", '54"'],
  // spelled out
  ["4 feet 6 inch", '54"'], ["feet 10", '120"'],
  // must refuse, never guess
  ["", null], ["abc", null], ["7x?", null],
];

let fail = 0;
for (const [raw, want] of CASES) {
  const v = parseDimension(raw);
  const got = v == null ? null : formatFtInSut(v);
  const ok = want == null ? got == null : got != null && got.startsWith(want.replace(/"$/, ""));
  if (!ok) { fail++; console.log(`FAIL ${JSON.stringify(raw)}: want ${want} got ${got}`); }
}
// The size boxes: the phone's number keyboard has no ' or ", so the point
// separates feet from inches — 4.6 is 4'6", never 4.6 ft.
const TRADE: [string, string | null][] = [
  ["4.6", '54"'], ["3.10", '46"'], ["4.11", '59"'], ["4.6.2", '54"2s'], ["4", '48"'], ["4.", '48"'], ["0.9", '9"'],
  ["54", '54"'], ["4'6\"", '54"'], ["1372", '54"'],
  ["4.12", null], ["4.6.8", null], ["4.25", null], ["", null], ["4..x", null],
];
for (const [raw, want] of TRADE) {
  const v = parseTradeSize(raw);
  const got = v == null ? null : formatFtInSut(v);
  const ok = want == null ? got == null : got === want;
  if (!ok) { fail++; console.log(`FAIL trade ${JSON.stringify(raw)}: want ${want} got ${got}`); }
  if (v != null && parseTradeSize(formatTradeSize(v)) !== Math.round(v / 3175) * 3175) {
    fail++; console.log(`FAIL trade round-trip ${JSON.stringify(raw)} → ${formatTradeSize(v)}`);
  }
}
const total = CASES.length + TRADE.length;
console.log(fail ? `${fail}/${total} failed` : `all ${total} parse cases ok`);
process.exit(fail ? 1 : 0);
