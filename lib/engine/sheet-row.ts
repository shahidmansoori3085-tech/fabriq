/** One opening as read off a photographed sheet, before the app turns it into
 *  engine answers. Plain data + one pure helper, so it is usable outside React. */

export interface ExtractedItem {
  type: "window" | "door" | "partition";
  width_raw: string;
  height_raw: string;
  unit_guess: "feet" | "inches" | "mm" | "ft-in-sut";
  qty: number;
  tracks?: string;
  mix?: string;
  system?: string;
  /** Z-section panel row, read straight off the sheet when the layout and
   *  each fixed panel's size were legible — e.g. "F1.83,O,F1.83" for
   *  fix|open|fix. Lets the app skip asking a panel-layout question the
   *  sheet already answered. */
  z_axis?: "cols" | "rows";
  z_panels?: string;
  /** The panel ORDER alone ("O,F,O"), when the sheet showed the sequence but
   *  not every fixed panel's size. Keeps that real information instead of
   *  discarding it, so the app asks only for the missing size rather than
   *  re-asking a layout the sheet already gave. */
  z_order?: string;
  /** Partition grid, counted straight off the drawing. */
  part_columns?: number;
  part_rows?: number;
  /** Partition: whether the sheet showed a door inside it ("1 door left
   *  side"), and its width in feet if one was written. Left undefined only
   *  when the sheet genuinely doesn't say — the app then still asks. */
  part_door?: boolean;
  part_door_ft?: number;
  /** Sliding window with a fixed glass band on top ("upar fix 2 ft") — the
   *  band's height in feet. A sheet that states this has already answered
   *  both of the questions the app would otherwise ask about it. */
  fixed_top_ft?: number;
  /** Door: centre rails written on the sheet ("3 rails" / "3 patti"). */
  rails?: number;
  /** Door: true when the sheet says the frame has to be made ("chokhat
   *  banana hai"), false when it says the frame is already fitted. Left
   *  undefined when the sheet is silent, so the app still asks. */
  frame_needed?: boolean;
  notes?: string;
  confidence: "high" | "medium" | "low";
}

/** apply unit_guess so parseDimension reads it right */
export function normalizeRaw(raw: string, unit: ExtractedItem["unit_guess"]): string {
  const s = raw.trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    if (unit === "inches") return `${s}"`;
    if (unit === "mm") return `${s}mm`;
  }
  return s;
}
