/** The pipe length a job buys a section in: how it is typed, stepped and shown. */
import { UM_PER_FOOT, UM_PER_SUT, formatFtIn, feet, parseSizeIn } from "./units";

export const PIPE_MIN_FT = 1;
export const PIPE_MAX_FT = 30;

/** Feet: "16", "15.6" (15 ft 6 inch). Inch: "186", "186.4". A unit that is written out always wins. */
export function readPipeFt(raw: string, unit: "ft" | "in"): number | null {
  const named = /[a-z'"′″]/i.test(raw);
  const typed = raw.trim();
  // a plain number under Feet is feet: 31 is too long a pipe, never 31 inches
  if (unit === "ft" && !named && /^\d+$/.test(typed) && +typed > PIPE_MAX_FT) return null;
  const um = parseSizeIn(typed.replace(/′/g, "'").replace(/″/g, '"'), named ? "ft" : unit, PIPE_MAX_FT + 1);
  if (um === null || um < feet(PIPE_MIN_FT) || um > feet(PIPE_MAX_FT)) return null;
  return um / UM_PER_FOOT;
}

/** One foot up or down; at either end it stays where it is. */
export function stepPipeFt(ft: number, d: 1 | -1): number {
  const to = ft + d;
  return to < PIPE_MIN_FT || to > PIPE_MAX_FT ? ft : to;
}

/** On screen: "16 ft", "15 ft 6 in", "15 ft 6 in 4s". */
export function pipeText(ft: number): string {
  const sut = Math.round(feet(ft) / UM_PER_SUT);
  const inch = Math.floor((sut % 96) / 8);
  return `${Math.floor(sut / 96)} ft${inch || sut % 8 ? ` ${inch} in` : ""}${sut % 8 ? ` ${sut % 8}s` : ""}`;
}

/** In orders and sheets: 16', 15'6". */
export const pipeMark = (ft: number): string => formatFtIn(feet(ft));
