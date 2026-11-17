"use client";
/**
 * The ⋮ menu beside a window system or a section, and the read-only sheets it
 * opens: everything about a system (its pipes, their sizes, its choices, how
 * each length is worked out, its hardware) or about one section (its drawing,
 * code, size, bar length and the pieces cut from it in this job).
 */
import { useEffect, useRef, useState } from "react";
import type { StudioSystem, ProfileDef } from "@/lib/studio/model";
import { loadLibrary, findProfile } from "@/lib/studio/store";
import { shapeOf } from "@/lib/studio/shapes";
import { partLabel, alternativesOf } from "@/lib/studio/edit";
import { ruleText, sectionTitle, layoutLabel, mixText, whenText } from "@/lib/studio/format";
import { getSection } from "@/lib/engine/sections";
import { formatFtInSut } from "@/lib/engine/units";
import { Sheet } from "@/components/studio-ui";
import StudioThumb, { MiniSection } from "@/components/studio-thumb";
import { SectionProfile } from "@/components/section-profiles";

/**
 * A ⋯ button with a small menu. The menu is laid over the whole page (fixed,
 * above everything), so the next card or a card's own edge never hides it;
 * near the bottom of the screen it opens upwards.
 */
export function DotsMenu({ items, label = "More" }: { items: { label: string; onClick: () => void }[]; label?: string }) {
  const [at, setAt] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const open = !!at;
  useEffect(() => {
    if (!open) return;
    // the page moved under the menu: close it (a tiny scroll from the tap itself does not count)
    const y0 = window.scrollY;
    const gone = () => { if (Math.abs(window.scrollY - y0) > 24) setAt(null); };
    window.addEventListener("scroll", gone);
    return () => window.removeEventListener("scroll", gone);
  }, [open]);
  const toggle = () => {
    if (open || !btn.current) { setAt(null); return; }
    const r = btn.current.getBoundingClientRect();
    const tall = items.length * 44 + 12;
    const right = Math.max(8, window.innerWidth - r.right);
    setAt(r.bottom + tall + 8 > window.innerHeight ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 });
  };
  return (
    <div ref={box} className="shrink-0">
      <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="grid h-10 w-10 place-items-center rounded-lg text-xl font-bold leading-none" style={{ color: "var(--ink-3)" }}>⋯</button>
      {/* a tap anywhere else only closes the menu (nothing under it is pressed) */}
      {at && <div aria-hidden className="fixed inset-0 z-[59]" onClick={(e) => { e.stopPropagation(); setAt(null); }}
        onTouchMove={() => setAt(null)} />}
      {at && (
        <div role="menu" className="card fixed z-[60] w-44 overflow-hidden p-1"
          style={{ boxShadow: "var(--shadow-lg)", right: at.right, top: at.top, bottom: at.bottom }}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" type="button"
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold hover:bg-[var(--surface-2)]"
              onClick={(e) => { e.stopPropagation(); setAt(null); it.onClick(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Frame Top", "Frame Left" → "Frame top, left" */
const joinParts = (names: string[]) => {
  const first = names[0]?.split(" ")[0];
  if (names.length > 1 && names.every((n) => n.split(" ")[0] === first && n.includes(" ")))
    return `${first} ${names.map((n) => n.slice(first.length + 1).toLowerCase()).join(", ")}`;
  return names.join(", ");
};

const codeText = (p?: { codes?: Record<string, string> }) => [...new Set(Object.values(p?.codes ?? {}).filter(Boolean))].join(" / ");

function Head({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{children}</h3>;
}

function SectionLine({ p, what }: { p: ProfileDef | undefined; what: string }) {
  const sh = shapeOf(p);
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderTop: "1px solid var(--line)" }}>
      <span className="grid h-12 w-14 shrink-0 place-items-center rounded-md bg-white" style={{ border: "1px solid var(--line)" }}>
        {sh ? <span className="block h-10 w-12"><MiniSection s={sh} /></span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{what}</span>
        <span className="block text-sm font-semibold leading-tight">{p ? sectionTitle(p.name) : "Not chosen yet"}</span>
        <span className="block text-xs tabnum" style={{ color: "var(--ink-3)" }}>{[codeText(p), p?.size ? `${p.size} mm` : ""].filter(Boolean).join(" · ")}</span>
      </span>
    </div>
  );
}

/** Everything about one window system, read only. */
export function SystemSheet({ sys, title, onClose, onEdit }: { sys: StudioSystem; title: string; onClose: () => void; onEdit: () => void }) {
  const lib = loadLibrary();
  const find = (id: string) => findProfile(lib, id) ?? sys.profiles.find((x) => x.id === id);
  const parts = sys.parts.filter((p) => p.enabled !== false);
  const sizeLabel = (id: string) => (id === "W" ? "Window width" : id === "H" ? "Window height" : sys.sizes.find((x) => x.id === id)?.label ?? id);
  const options = sys.switches.filter((s) => !s.id.startsWith("pick_") && s.id !== "joint" && s.options.length > 1);
  return (
    <Sheet title={title} sub={sys.layouts.map((l) => `${layoutLabel(sys, l.tracks)}: ${l.mixes.map(mixText).join(", ")}`).join(" · ")} onClose={onClose}>
      <div className="rounded-xl bg-white p-2" style={{ border: "1px solid var(--line)" }}>
        <StudioThumb sys={sys} find={find} withTrack />
      </div>

      <Head>Sections</Head>
      {(() => {
        // one line per section and use: "Frame top, left, right, bottom · 3-track"
        const rows = new Map<string, { id: string; note: string; parts: string[] }>();
        const add = (id: string, note: string, part: string) => {
          if (!id) return;
          const key = `${id}|${note}`;
          const r = rows.get(key) ?? { id, note, parts: [] };
          if (!r.parts.includes(part)) r.parts.push(part);
          rows.set(key, r);
        };
        for (const p of parts) {
          const alts = alternativesOf(sys, p);
          if (alts) alts.forEach((id) => add(id, alts.length > 1 ? "one of the choices" : "", partLabel(p)));
          else for (const c of p.profile) add(c.id, c.when ? whenText(sys, c.when) : p.profile.length > 1 ? "other layouts" : "", partLabel(p));
          if (p.meshProfile) add(p.meshProfile, "mesh shutter", partLabel(p));
        }
        return [...rows.values()].map((r) => (
          <SectionLine key={`${r.id}|${r.note}`} p={find(r.id)} what={`${joinParts(r.parts)}${r.note ? ` · ${r.note}` : ""}`} />
        ));
      })()}

      {options.length > 0 && <>
        <Head>Choices</Head>
        {options.map((s) => (
          <div key={s.id} className="py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="block text-xs" style={{ color: "var(--ink-3)" }}>{s.label}</span>
            <span className="font-semibold">{s.options.map((o) => (o.value === s.default ? `${o.label} (usual)` : o.label)).join(" · ")}</span>
          </div>
        ))}
      </>}

      <Head>Cut sizes</Head>
      {sys.sizes.map((s) => {
        const c = s.cases[s.cases.length - 1];
        return (
          <div key={s.id} className="flex items-baseline justify-between gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <span>{s.label}</span>
            <span className="mono text-right text-xs font-semibold">{c ? (c.add === null ? "Measure 2 windows" : ruleText(c, sizeLabel(c.base), "in")) : "—"}{s.cases.length > 1 ? ` (+${s.cases.length - 1} more)` : ""}</span>
          </div>
        );
      })}

      {sys.extras.length > 0 && <>
        <Head>Hardware</Head>
        {sys.extras.map((x) => (
          <div key={x.id} className="flex items-baseline justify-between gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <span>{x.name}</span><span className="text-xs" style={{ color: "var(--ink-3)" }}>{x.formula}</span>
          </div>
        ))}
      </>}

      <button className="btn-primary mt-5 w-full py-3" onClick={onEdit}>Edit this system</button>
    </Sheet>
  );
}

/** One section: drawing, code, size, bar length and the pieces cut from it in this job. */
export function SectionSheet({ sectionId, pieces, onClose, onEdit }: {
  sectionId: string; pieces?: { len: number; count: number; forWhat: string }[]; onClose: () => void; onEdit?: () => void;
}) {
  const sec = getSection(sectionId);
  const codes = [sec.omeo && `OMEO ${sec.omeo}`, sec.alpro && `Alpro ${sec.alpro}`, sec.napl && `NAPL ${sec.napl}`].filter(Boolean).join(" · ");
  const p = findProfile(loadLibrary(), sectionId);
  return (
    <Sheet title={sec.name} sub={[codes || codeText(p), sec.size ? `${sec.size} mm` : ""].filter(Boolean).join(" · ")} onClose={onClose}>
      <div className="grid place-items-center rounded-xl bg-white p-3" style={{ border: "1px solid var(--line)" }}>
        <SectionProfile sectionId={sectionId} w={260} h={170} />
      </div>
      <Head>Details</Head>
      {[
        ["Size", sec.size ? `${sec.size} mm` : "Not known"],
        ["Pipe length", `${sec.barLengthFt ?? 16} ft`],
        ["Last piece", sec.sellsPiece === false ? "Full pipe only" : "Cut to the feet needed"],
        ...(p?.kg ? [["Weight", `${p.kg.value} kg per ${p.kg.perFt} ft`]] : []),
        ...(p?.stockFt?.length ? [["Pipes you buy", p.stockFt.map((f) => `${f} ft`).join(", ")]] : []),
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
          <span style={{ color: "var(--ink-3)" }}>{k}</span><span className="font-semibold">{v}</span>
        </div>
      ))}
      {pieces && pieces.length > 0 && <>
        <Head>Pieces in this job</Head>
        {pieces.map((r, i) => (
          <div key={`${r.len}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm" style={{ borderTop: "1px solid var(--line)" }}>
            <span className="mono font-bold">{formatFtInSut(r.len)}</span>
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--ink-3)" }}>{r.forWhat}</span>
            <span className="font-bold tabnum">× {r.count}</span>
          </div>
        ))}
      </>}
      {onEdit && <button className="btn-primary mt-5 w-full py-3" onClick={onEdit}>Edit this section</button>}
    </Sheet>
  );
}
