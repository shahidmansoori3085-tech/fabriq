"use client";
/** A small, real drawing of a Studio system (5′ × 4′ unless told), for choice cards. */
import { inches } from "../lib/engine/units";
import type { StudioSystem } from "../lib/studio/model";
import { windowGeometry } from "../lib/studio/geometry";
import { BUILT_IN_PROFILES } from "../lib/studio/templates";
import WindowDrawing from "./studio-drawing";
import type { ProfileDef } from "../lib/studio/model";

export default function StudioThumb({ sys, tracks, mix, find }: {
  sys: StudioSystem; tracks?: number; mix?: string; find?: (id: string) => ProfileDef | undefined;
}) {
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];
  const look = find ?? ((id: string) => BUILT_IN_PROFILES.find((p) => p.id === id));
  const g = windowGeometry(sys, { id: "T", W: inches(60), H: inches(48), qty: 1, tracks: lay?.tracks ?? 2, mix: mix ?? lay?.mixes[0] ?? "GG" }, look);
  return <WindowDrawing g={g} unit="in" pick={null} compact />;
}
