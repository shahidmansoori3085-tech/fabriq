"use client";
/**
 * FabriQ Engineering Drawing Sheet — a proper, dimensioned fabrication drawing
 * per opening, the kind used on real aluminium projects: a dimensioned
 * ELEVATION (overall + panel dimensions), the real SECTION cut-throughs, and a
 * PARTS / cut schedule, wrapped in a title block. 100% code-generated SVG from
 * engine data — deterministic, print-clean, no image-gen (anti-jugad).
 */
import { formatFtInSut, toFeet, mm } from "@/lib/engine/units";
import type { JobItem, MaterialList } from "@/lib/engine/types";
import { getSection } from "@/lib/engine/sections";
import { partitionLayout, zGeometry, domalFix } from "@/lib/engine/estimator";
import { SectionDrawing } from "./section-profiles";

const INK = "#1b2330";
const LINE = "#c4ccd6";
const DIM = "#8a94a2";
const GLASS = "#3b82f6";

const mmOf = (um: number) => Math.round(um / 1000);
const dimLabel = (um: number) => `${mmOf(um)} mm  ·  ${formatFtInSut(um)}`;

/* ————— dimension primitives (architectural tick style) ————— */
function tick(x: number, y: number, vertical: boolean) {
  // 45° witness tick
  return <line x1={vertical ? x - 3 : x - 3} y1={vertical ? y - 3 : y - 3}
    x2={vertical ? x + 3 : x + 3} y2={vertical ? y + 3 : y + 3} stroke={DIM} strokeWidth={1} />;
}
function HDim({ x1, x2, y, edgeY, label }: { x1: number; x2: number; y: number; edgeY: number; label: string }) {
  return (
    <g>
      <line x1={x1} y1={edgeY} x2={x1} y2={y} stroke={DIM} strokeWidth={0.5} />
      <line x1={x2} y1={edgeY} x2={x2} y2={y} stroke={DIM} strokeWidth={0.5} />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={DIM} strokeWidth={0.9} />
      {tick(x1, y, false)}{tick(x2, y, false)}
      <text x={(x1 + x2) / 2} y={y - 5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={INK}
        style={{ fontVariantNumeric: "tabular-nums" }}>{label}</text>
    </g>
  );
}
function VDim({ y1, y2, x, edgeX, label }: { y1: number; y2: number; x: number; edgeX: number; label: string }) {
  return (
    <g>
      <line x1={edgeX} y1={y1} x2={x} y2={y1} stroke={DIM} strokeWidth={0.5} />
      <line x1={edgeX} y1={y2} x2={x} y2={y2} stroke={DIM} strokeWidth={0.5} />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={DIM} strokeWidth={0.9} />
      {tick(x, y1, true)}{tick(x, y2, true)}
      <text x={x + 4} y={(y1 + y2) / 2} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={INK}
        transform={`rotate(90 ${x + 11} ${(y1 + y2) / 2})`}
        style={{ fontVariantNumeric: "tabular-nums" }}>{label}</text>
    </g>
  );
}

/* ————— panel fills ————— */
function panelFill(x: number, y: number, w: number, h: number, kind: string, key: string) {
  if (kind === "jali") {
    const ls: React.ReactNode[] = [];
    for (let i = 1; i < 6; i++) ls.push(<line key={`h${i}`} x1={x} y1={y + (i * h) / 6} x2={x + w} y2={y + (i * h) / 6} stroke="#9aa8a0" strokeWidth={0.4} />);
    for (let i = 1; i < Math.max(2, Math.round(w / 12)); i++) ls.push(<line key={`v${i}`} x1={x + (i * w) / Math.max(2, Math.round(w / 12))} y1={y} x2={x + (i * w) / Math.max(2, Math.round(w / 12))} y2={y + h} stroke="#9aa8a0" strokeWidth={0.4} />);
    return <g key={key}><rect x={x} y={y} width={w} height={h} fill="#f2f6f2" stroke="#8ca08c" strokeWidth={1} />{ls}</g>;
  }
  if (kind === "sheet") return <rect key={key} x={x} y={y} width={w} height={h} fill="#eef1f4" stroke="#aab2bd" strokeWidth={1} />;
  // glass — diagonal indicators
  return (
    <g key={key}>
      <rect x={x} y={y} width={w} height={h} fill="#eaf2fd" stroke={GLASS} strokeWidth={1} />
      <line x1={x + w * 0.12} y1={y + h * 0.86} x2={x + w * 0.5} y2={y + h * 0.14} stroke="#9cc4f5" strokeWidth={0.8} />
      <line x1={x + w * 0.42} y1={y + h * 0.9} x2={x + w * 0.82} y2={y + h * 0.34} stroke="#c3ddfa" strokeWidth={0.8} />
    </g>
  );
}

/**
 * Dimensioned front elevation, drawn to the opening's real proportions.
 *
 * Every panel position comes from the same geometry the cut list is built
 * from (partition grid, Domal fixed band, Z-section panels) — a drawing that
 * re-derives its own layout ends up showing a different number of panes than
 * the pipes being cut, which is worse than no drawing at all.
 */
export function DimensionedElevation({ item }: { item: JobItem }) {
  const wFt = toFeet(item.width), hFt = toFeet(item.height);
  const DW = 300;
  const DH = Math.min(Math.max((DW * hFt) / wFt, 150), 430);
  const P = 52; // margin for dimension lines + labels
  const x0 = P, y0 = P, W = DW + P * 2, H = DH + P * 2 + 14;
  const sx = DW / item.width, sy = DH / item.height;
  const fr = 7; // visual frame band for systems drawn without real faces

  const cells: React.ReactNode[] = [];
  const botDims: React.ReactNode[] = [];
  let note = "";
  /** A panel placed in real µm from the opening's top-left corner. */
  const at = (x: number, y: number, w: number, h: number, kind: string, key: string) =>
    panelFill(x0 + x * sx + 0.5, y0 + y * sy + 0.5, Math.max(w * sx - 1, 1), Math.max(h * sy - 1, 1), kind, key);
  const ix = x0 + fr, iy = y0 + fr, iw = DW - fr * 2, ih = DH - fr * 2;

  if (item.type === "partition") {
    const L = partitionLayout(item);
    const f = L.face;
    const glassBandH = L.glassRows * L.glassRowH + (L.glassRows - 1) * f;
    for (let b = 0; b < L.bays; b++) {
      const x = f + b * (L.cellW + f);
      for (let r = 0; r < L.glassRows; r++) cells.push(at(x, f + r * (L.glassRowH + f), L.cellW, L.glassRowH, "glass", `p${b}-${r}`));
      if (L.sheetH > 0) cells.push(at(x, f + glassBandH + f, L.cellW, L.sheetH, "sheet", `s${b}`));
    }
    if (L.hasDoor) {
      const dx = f + L.fieldW + f;
      const top = L.doorTopH > 0 ? L.doorTopH + f : 0;
      if (top) cells.push(at(dx, f, L.doorW, L.doorTopH, "glass", "door-top"));
      const dh = L.innerH - top;
      cells.push(<rect key="door" x={x0 + dx * sx} y={y0 + (f + top) * sy} width={L.doorW * sx} height={dh * sy}
        fill="#e7efe9" stroke="#0f6e56" strokeWidth={1.5} />);
      cells.push(<line key="door-mid" x1={x0 + dx * sx} x2={x0 + (dx + L.doorW) * sx} y1={y0 + (f + top + dh / 2) * sy}
        y2={y0 + (f + top + dh / 2) * sy} stroke="#0f6e56" strokeWidth={1.5} />);
    }
    for (let b = 0; b < Math.min(L.bays, 6); b++) {
      const x = x0 + (f + b * (L.cellW + f)) * sx;
      botDims.push(<HDim key={`bd${b}`} x1={x} x2={x + L.cellW * sx} y={y0 + DH + 24} edgeY={y0 + DH} label={`${mmOf(L.cellW)} mm`} />);
    }
    note = `${L.bays} bay${L.bays > 1 ? "s" : ""} × ${L.glassRows} glass row${L.glassRows > 1 ? "s" : ""}${L.sheetH > 0 ? " + bottom sheet" : ""}${L.hasDoor ? ` · ${mmOf(L.doorW)} mm door` : ""}`;
  } else if (item.type === "door") {
    const zones = item.shutters.length || 1, zh = ih / zones;
    for (let z = 0; z < zones; z++)
      cells.push(panelFill(ix + 0.5, iy + z * zh + 0.5, iw - 1, zh - 1, item.shutters[z]?.kind ?? "sheet", `d${z}`));
  } else if (item.system === "z_section") {
    const g = zGeometry(item);
    const face = mm(40);
    const openW = item.width - 2 * face, openH = item.height - 2 * face;
    const fixedFt = mm((parseFloat(item.meta.zFixedFt ?? "2") || 2) * 304.8);
    const sashKinds = g.sashes.map((s) => s.kind);
    const row = (x: number, y: number, w: number, h: number, tag: string) => {
      const n = Math.max(1, sashKinds.length), each = w / n;
      sashKinds.forEach((k, i) => cells.push(at(x + i * each, y, each, h, k, `${tag}${i}`)));
    };
    if (item.meta.zLayout === "fixed") {
      cells.push(at(face, face, openW, openH, g.fixed[0]?.kind ?? "glass", "zf"));
    } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "top") {
      cells.push(at(face, face, openW, fixedFt - face, g.fixed[0]?.kind ?? "glass", "zf"));
      row(face, fixedFt, openW, item.height - fixedFt - face, "zs");
    } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "side") {
      cells.push(at(face, face, fixedFt - face, openH, g.fixed[0]?.kind ?? "glass", "zf"));
      row(fixedFt, face, item.width - fixedFt - face, openH, "zs");
    } else if (item.meta.zLayout === "combo" && item.meta.zComboDir === "both") {
      cells.push(at(face, face, fixedFt - face, openH, "glass", "zf1"));
      cells.push(at(item.width - fixedFt, face, fixedFt - face, openH, "glass", "zf2"));
      row(fixedFt, face, item.width - 2 * fixedFt, openH, "zs");
    } else {
      row(face, face, openW, openH, "zs");
    }
    if (g.sashes.length) note = `${g.sashes.length} openable sash${g.sashes.length > 1 ? "es" : ""}, each ${mmOf(g.sashes[0].shW)} × ${mmOf(g.sashes[0].shH)} mm`;
  } else {
    // Sliding (normal / Domal): every shutter is HALF the window wide — they
    // overlap in the tracks — so the panes are drawn side by side but the
    // label states the real shutter width rather than W ÷ shutters.
    const fx = item.system === "domal" ? domalFix(item) : null;
    let top = 0;
    if (fx?.hasFix) {
      cells.push(at(mm(38.1), mm(38.1), item.width - 2 * mm(38.1), fx.fixRaw - mm(38.1), "glass", "fix"));
      top = fx.fixRaw;
      note = `Fixed top ${mmOf(fx.fixRaw)} mm · `;
    }
    const n = Math.max(1, item.shutters.length);
    const each = (item.width - 2 * mm(30)) / n;
    for (let i = 0; i < n; i++)
      cells.push(at(mm(30) + i * each, top + mm(30), each, item.height - top - 2 * mm(30), item.shutters[i]?.kind ?? "glass", `w${i}`));
    note += `${n} shutters, each ${mmOf(Math.round(item.width / 2))} mm wide (overlapping)`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }} role="img" aria-label="elevation">
      {/* frame */}
      <rect x={x0} y={y0} width={DW} height={DH} fill="#dfe4ea" stroke={INK} strokeWidth={2} />
      {item.type === "door" && <rect x={ix} y={iy} width={iw} height={ih} fill="#fff" stroke={INK} strokeWidth={1} />}
      {cells}
      {/* overall dimensions */}
      <HDim x1={x0} x2={x0 + DW} y={y0 - 26} edgeY={y0} label={dimLabel(item.width)} />
      <VDim y1={y0} y2={y0 + DH} x={x0 + DW + 26} edgeX={x0 + DW} label={dimLabel(item.height)} />
      {botDims}
      {note && (
        <text x={x0 + DW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={DIM}>{note}</text>
      )}
    </svg>
  );
}

/** "S1 Bearing Top" / "S3 Handle (Mesh)" → "Bearing Top" / "Handle" — drops the
 *  shutter number and the glass/mesh qualifier so identical cuts can merge.
 *  "Jali" is still matched so projects saved before the copy rewrite keep
 *  merging exactly as they did. */
function baseRole(role: string): string {
  return role.replace(/^S\d+\s+/, "").replace(/\s*\((Mesh|Jali|Glass|Sheet)\)\s*$/i, "").trim();
}

/** Full engineering sheet: title block + elevation + sections + parts schedule.
 *  `others` — openings that came out with the exact same system, shutter mix,
 *  meta answers AND size as `item`. When a sheet lists 5 identical windows the
 *  AI still creates 5 separate JobItems (one per row), but they don't need 5
 *  drawings — one drawing, checked against every opening it applies to, is
 *  what a shop actually works from. Listed here so the fabricator can tick
 *  each physical opening against the one drawing before cutting. */
export function EngineeringSheet({ item, others, list, shop }: { item: JobItem; others?: JobItem[]; list: MaterialList; shop?: { name?: string } }) {
  const sec = getSection;
  // Parts for ONE unit of this opening — the table header says "per unit"
  // and means it. When qty > 1, expandItem gives each physical unit its own
  // piece id ("W1.1", "W1.2", …), never the bare item id, so filtering on
  // item.id alone found nothing at all for any opening built more than
  // once — the whole parts schedule and section list came back empty. Only
  // the first unit's pieces are wanted here regardless; grouping ALL units'
  // pieces together would multiply every quantity by item.qty while the
  // header still claimed "per unit".
  const repId = item.qty > 1 ? `${item.id}.1` : item.id;
  const parts = list.pieces.filter((p) => p.itemId === repId);
  const grouped = new Map<string, { section: string; role: string; len: number; qty: number }>();
  for (const p of parts) {
    const role = baseRole(p.role);
    const k = `${p.sectionId}|${role}|${p.length}`;
    const g = grouped.get(k);
    if (g) g.qty += 1;
    else grouped.set(k, { section: sec(p.sectionId).label, role, len: p.length, qty: 1 });
  }
  const rows = [...grouped.values()];
  // unique sections used → show their real cross-sections
  // Every section this opening uses — a Domal with a fixed top needs six, and
  // a cross-section left off the sheet is one the workshop has to guess.
  const sectionIds = [...new Set(parts.map((p) => p.sectionId))];
  const SYS_NAME: Record<string, string> = {
    normal_2t: "Normal Sliding 2-Track", normal_3t: "Normal Sliding 3-Track", domal: "Domal",
    z_section: "Z-Section", door_single: "Door", partition: "Partition",
  };
  const systemName = SYS_NAME[item.system] ?? item.system;

  const label = item.type === "window" ? "WINDOW" : item.type === "door" ? "DOOR" : "PARTITION";

  const group = [item, ...(others ?? [])];
  const groupIds = group.map((g) => g.id).join(", ");
  const totalQty = group.reduce((a, g) => a + g.qty, 0);

  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden", background: "#fff", color: INK,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", breakInside: "avoid" }}>
      {/* sheet header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "10px 16px", borderBottom: `1px solid ${LINE}`, background: "#f6f8fa" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em" }}>
          {groupIds} — {label} <span style={{ color: DIM, fontWeight: 600 }}>ELEVATION &amp; SECTIONS</span>
        </div>
        <div style={{ fontSize: 11, color: DIM, fontVariantNumeric: "tabular-nums" }}>
          {formatFtInSut(item.width)} × {formatFtInSut(item.height)} · ×{totalQty}
        </div>
      </div>

      {/* elevation */}
      <div style={{ padding: "14px 16px 6px", display: "grid", placeItems: "center" }}>
        <DimensionedElevation item={item} />
      </div>

      {/* sections */}
      {sectionIds.length > 0 && (
        <div style={{ padding: "6px 16px 12px" }}>
          <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, marginBottom: 8 }}>Section Details (cut-through)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            {sectionIds.map((id) => (
              <div key={id} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: 6, background: "#fcfdfe" }}>
                <SectionDrawing sectionId={id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* parts schedule */}
      <div style={{ padding: "0 16px 14px" }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, margin: "6px 0 8px" }}>Parts Schedule (per unit)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f6f8fa", color: DIM }}>
                {["Part / Section", "Position", "Qty", "Cut length"].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 ? "right" : "left", padding: "7px 10px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${LINE}` }}>
                  <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.section}</td>
                  <td style={{ padding: "7px 10px", color: "#4a5460" }}>
                    {r.role.toLowerCase() === r.section.toLowerCase() ? "—" : r.role}
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.qty}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatFtInSut(r.len)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* applies-to checklist — only shown when this one drawing covers more
          than one opening, so the fabricator knows which physical openings
          to check against it before cutting */}
      {group.length > 1 && (
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: DIM, margin: "6px 0 8px" }}>
            This drawing covers {group.length} openings (same size &amp; design)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {group.map((g) => (
              <div key={g.id} style={{ border: `1px solid ${LINE}`, borderRadius: 6, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, background: "#fcfdfe" }}>
                {g.id} <span style={{ color: DIM, fontWeight: 600 }}>× {g.qty}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: DIM, marginTop: 8 }}>
            Measure each opening on site before cutting — any opening that is not exactly {formatFtInSut(item.width)} × {formatFtInSut(item.height)} needs its own drawing.
          </div>
        </div>
      )}

      {/* title block */}
      <div style={{ display: "flex", borderTop: `1px solid ${LINE}`, fontSize: 10.5 }}>
        {[["Drawn by", shop?.name || "FabriQ"], ["Type", `${label} · ${systemName || item.system}`], ["Scale", "NTS"], ["Unit", "mm / ft-in"]].map(([k, v], i) => (
          <div key={i} style={{ flex: 1, padding: "8px 12px", borderLeft: i ? `1px solid ${LINE}` : "none" }}>
            <div style={{ color: DIM, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 9 }}>{k}</div>
            <div style={{ fontWeight: 700, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
