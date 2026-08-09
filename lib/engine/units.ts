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

/** Parse a human dimension string into µm. Returns null if unparseable.
 * Accepts: 4'6"  |  4-6-4 (ft-in-sut)  |  54  (inches if ≤ threshold? no — feet default)  |
 *          4.5 (decimal feet) | 1372mm | 137.2cm | 4 (feet) | 4x3 handled at caller level
 */
export function parseDimension(raw: string): Um | null {
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

  // ft-in-sut: 4-6-4
  m = s.match(/^(\d+)-(\d+)(?:-(\d+))?$/);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inch = parseInt(m[2], 10);
    const sut = m[3] ? parseInt(m[3], 10) : 0;
    return ft * UM_PER_FOOT + inch * UM_PER_INCH + sut * UM_PER_SUT;
  }

  // 4'6" or 4'6 or 4ft6in
  m = s.match(/^(\d+)(?:'|ft|feet|फुट)(?:(\d+(?:\.\d+)?)(?:"|in|inch)?)?$/);
  if (m) {
    const ft = parseInt(m[1], 10);
    const inch = m[2] ? parseFloat(m[2]) : 0;
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

/** Format µm as mm (rounded) */
export function formatMm(um: Um): string {
  return `${Math.round(um / UM_PER_MM)}mm`;
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
