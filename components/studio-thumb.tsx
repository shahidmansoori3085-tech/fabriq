"use client";
/** A small, real drawing of a Studio system (5′ × 4′ unless told), for choice cards. */
import { inches } from "../lib/engine/units";
import type { StudioSystem } from "../lib/studio/model";
import { windowGeometry } from "../lib/studio/geometry";
import { BUILT_IN_PROFILES } from "../lib/studio/templates";
import { shopProfile } from "../lib/studio/runtime";
import { jobVars, matches } from "../lib/studio/evaluate";
import { shapeOf, type Shape } from "../lib/studio/shapes";
import WindowDrawing from "./studio-drawing";
import type { ProfileDef } from "../lib/studio/model";

export default function StudioThumb({ sys, tracks, mix, find, withTrack }: {
  sys: StudioSystem; tracks?: number; mix?: string; find?: (id: string) => ProfileDef | undefined;
  /** show the bottom track's real section in the corner: from the front every sliding window looks alike */
  withTrack?: boolean;
}) {
  const lay = sys.layouts.find((l) => l.tracks === tracks) ?? sys.layouts[0];
  const look = find ?? ((id: string) => shopProfile(id) ?? BUILT_IN_PROFILES.find((p) => p.id === id));
  const job = { id: "T", W: inches(60), H: inches(48), qty: 1, tracks: lay?.tracks ?? 2, mix: mix ?? lay?.mixes[0] ?? "GG" };
  const g = windowGeometry(sys, job, look);
  let shape: Shape | undefined;
  if (withTrack) {
    const vars = jobVars(sys, job);
    const bottom = sys.parts.find((p) => p.place === "frame-bottom" && p.enabled !== false);
    shape = shapeOf(look(bottom?.profile.find((c) => matches(c.when, vars))?.id ?? ""));
  }
  return (
    <span className="relative block">
      <WindowDrawing g={g} unit="in" pick={null} compact />
      {shape && (
        <span className="absolute bottom-0 right-0 flex h-[46%] w-[40%] items-center justify-center rounded-md border bg-white p-1 shadow-sm">
          <MiniSection s={shape} />
        </span>
      )}
    </span>
  );
}

/** A section's real outline, filled, no dimensions: small enough for a card. */
export function MiniSection({ s }: { s: Shape }) {
  const pad = Math.max(s.w, s.h) * 0.06;
  return (
    <svg viewBox={`${-pad} ${-pad} ${s.w + 2 * pad} ${s.h + 2 * pad}`} className="h-full w-full" role="img" aria-label={`Section ${s.code}`}>
      <path d={s.paths.join(" ")} fill="#94a3b8" fillRule="evenodd" stroke="#475569" strokeWidth={Math.max(s.w, s.h) / 160} />
    </svg>
  );
}
