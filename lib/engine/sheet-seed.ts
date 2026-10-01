/**
 * Photo-sheet rows -> engine inputs. Shared by the app and the sheet-reading
 * eval (evals/sheets), so what the eval scores is exactly what the app does.
 */
import { parseDimension, toFeet, mm, type Um } from "./units";
import { mixToShutters, doorMixToZones } from "./questions";
import { countZPanelSashes, composeZPanels } from "./quick-item";
import type { JobItem, OpeningType, SystemId } from "./types";
import { normalizeRaw, type ExtractedItem } from "./sheet-row";
/**
 * Turn a photo-extracted row into a `known` map for the question engine, so it
 * only asks what the photo did NOT capture. System is seeded only when the
 * sketch clearly indicated it; otherwise it stays unset and gets asked.
 */
export function seedFromRow(row: ExtractedItem): Record<string, string> {
  const k: Record<string, string> = {};
  if (row.type === "window") {
    const sys = (row.system ?? "").toLowerCase();
    if (/domal|doomal/.test(sys)) k.system = "domal";
    else if (/z[\s-]?section|z\b/.test(sys)) k.system = "z_section";
    else if (/normal|18|bombay|sliding/.test(sys)) k.system = "normal";
    if (row.tracks === "2" || row.tracks === "3" || row.tracks === "4") k.tracks = row.tracks;
    if (row.mix && /^[GJS]+$/i.test(row.mix)) k.mix = row.mix.toUpperCase();
    // The mix string IS the track count — "GJJ" is only a 3-shutter mix on a
    // 3-track window, so a sheet that wrote the shutters ("glass, glass,
    // jali") but not the track number in so many words has still answered
    // this question. Never asked otherwise: track count came only from an
    // explicit row.tracks, so a mix-only sheet asked for a number it had
    // already implied.
    if (!k.tracks && k.mix && k.mix.length >= 2 && k.mix.length <= 4) {
      k.tracks = String(k.mix.length);
    }
    // The sheet already showed the panel layout — asking "what is the
    // layout?" again would be a question the app already has the answer to.
    // "ALL FIX" — a single fixed panel spanning the whole opening, whichever
    // field the reader put it in (seen as both z_panels "F" and z_order "F").
    // As a one-panel row it asked "how wide is the fixed panel?" when the
    // answer can only be the full width, or broke on an unsized "F"; it is
    // simply the fixed layout.
    const zLayout = (row.z_panels?.trim() || row.z_order?.trim() || "").toUpperCase().split(",").filter(Boolean);
    if (k.system === "z_section" && !zLayout.length && /\bdoor\b|darwaza|दरवाज/i.test(row.notes ?? "")) {
      // "Z door 3x7" — the Z-section door layout; asking "fixed, openable or
      // door?" would re-ask what the sheet just said.
      k.zType = "door";
    } else if (k.system === "z_section" && zLayout.length === 1 && zLayout[0].startsWith("F")) {
      k.zType = "fixed";
    } else if (k.system === "z_section" && row.z_axis && row.z_panels?.trim()) {
      k.zType = "row";
      k.zAxis = row.z_axis;
      k.zPanels = row.z_panels.trim();
    } else if (k.system === "z_section" && row.z_axis && row.z_order?.trim()) {
      // Order known, at least one fixed size not. Seed the layout so the app
      // never re-asks what the sheet already showed (and whose shape the
      // preset layouts cannot express anyway) — the question engine then
      // asks only for the missing size(s) and composes zPanels from both.
      k.zType = "row";
      k.zAxis = row.z_axis;
      k.zOrder = row.z_order.trim().toUpperCase().replace(/[^OF,]/g, "");
    }
    // "upar fix 2 ft" on a sliding window answers BOTH fixed-band questions.
    // Only Domal builds a fixed band today. The band is kept as sheetFixFt
    // whatever the system turns out to be — deriveItem applies it if the
    // window ends up Domal, and a Normal window gets asked how to build it
    // (it used to be dropped without a word, cutting every shutter too tall).
    if (k.system !== "z_section" && typeof row.fixed_top_ft === "number" && row.fixed_top_ft > 0) {
      k.sheetFixFt = String(row.fixed_top_ft);
    }
  }
  if (row.type === "door") {
    if (row.rails === 2 || row.rails === 3) k.rails = String(row.rails);
    // A sheet that says "chokhat banana hai" has answered this. Defaulting it
    // the other way drops the whole frame from the material list, so the
    // sheet's own word has to win over the question's first option.
    if (typeof row.frame_needed === "boolean") k.chokhat = row.frame_needed ? "needed" : "existing";
  }
  if (row.type === "partition") {
    // "1 door left side" on the sheet has already answered the question the
    // app would otherwise ask — a partition drawn with no door mentioned is
    // just as real an answer (panels/glass only), so false is seeded too,
    // not just true.
    if (typeof row.part_door === "boolean") {
      k.partDoor = row.part_door ? "yes" : "no";
      if (row.part_door && typeof row.part_door_ft === "number" && row.part_door_ft > 0) {
        k.partDoorW = String(row.part_door_ft);
      }
    }
    // Columns and rows are independent facts — a sheet saying "4 columns"
    // and nothing about rows has still answered the bay width. Requiring
    // both threw the column count away and asked for it again.
    if (row.part_columns || row.part_rows) {
      // Grid counted straight off the drawing — derive the bay/row spacing
      // the engine actually needs instead of asking for a spacing the
      // drawing already implies. The columns were counted across the PANEL
      // field the fabricator drew, not the door's own bay, so the door's
      // width comes out of the total before dividing — otherwise a 10ft
      // partition with a 3ft door and "3 columns" seeds bays as if all
      // 10ft were glass, one column too wide.
      const w = parseDimension(normalizeRaw(row.width_raw, row.unit_guess));
      const h = parseDimension(normalizeRaw(row.height_raw, row.unit_guess));
      const doorW = row.part_door ? mm((row.part_door_ft ?? 3) * 304.8) : 0;
      const fieldW = w ? Math.max(0, w - doorW) : null;
      if (fieldW && row.part_columns && row.part_columns > 0) k.partBayFt = (toFeet(fieldW) / row.part_columns).toFixed(2);
      if (h && row.part_rows && row.part_rows > 0) k.partRowFt = (toFeet(h) / row.part_rows).toFixed(2);
    }
  }
  return k;
}

/** How many of these rows the sheet already identified as Z-section. */
export function countZSection(rows: ExtractedItem[]): number {
  return rows.filter((r) => seedFromRow(r).system === "z_section").length;
}

/** Rows that are the same type, same size and would be seeded with the same
 *  known answers don't need to be asked about separately — they get bundled
 *  into one group, one Q&A round, and the answers are then replayed onto
 *  every row in the group. Order is preserved: the first time a signature is
 *  seen fixes that group's place in the queue. */
export function groupIdenticalRows(rows: ExtractedItem[], shared: Record<string, string>): ExtractedItem[][] {
  const groups = new Map<string, ExtractedItem[]>();
  for (const row of rows) {
    const w = parseDimension(normalizeRaw(row.width_raw, row.unit_guess));
    const h = parseDimension(normalizeRaw(row.height_raw, row.unit_guess));
    const known = { ...shared, ...seedFromRow(row) };
    const key = `${row.type}|${w}|${h}|${JSON.stringify(known)}`;
    const g = groups.get(key);
    if (g) g.push(row); else groups.set(key, [row]);
  }
  return [...groups.values()];
}

/** Turns a type + size + answers-so-far into the JobItem the engine reads —
 *  the one place this translation happens, so the live preview shown
 *  DURING the Q&A and the item actually built once it's done can never
 *  drift apart (e.g. the sash count for a preview looking different from
 *  the sash count that gets cut). Answers not yet given fall back to the
 *  same defaults the finished build uses, so an early preview is rough but
 *  never wrong about what has already been decided. */
export function deriveItem(
  id: string, type: OpeningType, width: Um, height: Um, qty: number, answers: Record<string, string>,
): JobItem {
  const next = { ...answers };
  let sys: SystemId;
  let shutters: JobItem["shutters"];
  if (type === "door") {
    sys = "door_single";
    const rails = next.rails ?? "2";
    const zonemix = next.zonemix ?? (rails === "3" ? "SSSJ" : "SSJ");
    shutters = doorMixToZones(zonemix);
  } else if (type === "partition") {
    sys = "partition";
    next.partSheetFt = next.partSheetFt ?? "0";
    shutters = [];
  } else if (next.system === "z_section") {
    sys = "z_section";
    const zType = next.zType ?? "openable";
    next.zDoor = zType === "door" ? "yes" : "no";
    next.zLayout = zType === "fixed" ? "fixed" : zType === "combo" ? "combo" : zType === "row" ? "row" : "openable";
    if (zType === "row" && !next.zPanels && next.zOrder) {
      const composed = composeZPanels(next.zOrder, next);
      if (composed) next.zPanels = composed;
    }
    const n = zType === "fixed" || zType === "door"
      ? 1
      : zType === "row"
      ? countZPanelSashes(next.zPanels)
      : Math.max(1, parseInt(next.zSashCount ?? "1", 10));
    shutters = Array.from({ length: n }, () => ({ kind: "glass" as const }));
  } else {
    if (next.fixPlan === "domal") next.system = "domal";
    // A fixed band from the sheet goes onto the only build that has one.
    if (next.system === "domal" && next.sheetFixFt && !next.domalFix) {
      next.domalFix = "yes";
      next.domalFixFt = next.sheetFixFt;
    }
    sys = next.system === "domal" ? "domal" : (next.tracks ?? "2") === "3" ? "normal_3t" : "normal_2t";
    next.handle = next.handle ?? "std";
    const mix = next.mix ?? ((next.tracks ?? "2") === "4" ? "GGGJ" : (next.tracks ?? "2") === "3" ? "GGJ" : "GG");
    shutters = mixToShutters(mix);
  }
  return { id, type, width, height, qty, system: sys, shutters, meta: next };
}
