"use client";
/**
 * Supplier order — a premium purchase-order document, not the internal
 * working screen. The fabricator's rate box, colour picker and scrap notes
 * stay on his own screen; a dealer gets only what he needs to pull stock:
 * shop letterhead, the profile drawing, and how many.
 *
 * Same visual language as QuoteDoc (self-contained styling, so it renders
 * identically regardless of the app's own light/dark theme) — this is a
 * printed document, not a themed screen.
 */
import type { ShopProfile } from "./quotation";

const INK = "#14181d";
const MUT = "#6b7280";
const LINE = "#e6e9ee";
const ACCENT = "#E2661F";
const ACCENT2 = "#f3a56b";
const mono: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace" };

export interface SupplierOrderLine {
  /** catalogue cross-section image URL, e.g. /sections/2t_top.png — omitted when none exists */
  image?: string;
  label: string;
  sub?: string;
  qty: string;
}

export function SupplierOrderDoc({
  shop, title, date, lines, totalLabel, totalValue, note, className,
}: {
  shop: ShopProfile;
  title: string;
  date: string;
  lines: SupplierOrderLine[];
  totalLabel: string;
  totalValue: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className={className}
      style={{ background: "#fff", color: INK, borderRadius: 18, overflow: "hidden",
        border: `1px solid ${LINE}`, boxShadow: "0 1px 3px rgba(20,24,29,.06)",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ————— brand header ————— */}
      <div style={{ position: "relative", background: `linear-gradient(120deg, ${INK}, #232a34)`, color: "#fff",
        padding: "26px 32px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap",
        overflow: "hidden" }}>
        {/* a quiet diagonal accent, not a full block — reads as considered, not loud */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 220, height: "100%",
          background: `linear-gradient(135deg, transparent 40%, ${ACCENT}22 100%)`, pointerEvents: "none" }} />
        <div style={{ minWidth: 220, position: "relative" }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            {shop.name || "Your Shop Name"}
          </div>
          {shop.tagline && <div style={{ color: ACCENT2, fontWeight: 600, fontSize: 13, marginTop: 4 }}>{shop.tagline}</div>}
          <div style={{ color: "#c2c8d0", fontSize: 12.5, marginTop: 10, lineHeight: 1.55 }}>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>{shop.phone}</div>}
            {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right", position: "relative" }}>
          <div style={{ display: "inline-block", background: `linear-gradient(180deg, ${ACCENT2}, ${ACCENT})`,
            color: "#fff", padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 800,
            letterSpacing: "0.16em", boxShadow: "0 3px 10px rgba(226,102,31,.35)" }}>{title.toUpperCase()}</div>
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#c2c8d0", ...mono }}>
            <div>Date: <b style={{ color: "#fff" }}>{date}</b></div>
            <div>Items: <b style={{ color: "#fff" }}>{lines.length}</b></div>
          </div>
        </div>
      </div>

      {/* ————— order lines ————— */}
      <div style={{ padding: "22px 32px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "center", padding: "12px 14px",
            border: `1px solid ${LINE}`, borderRadius: 14, background: i % 2 === 1 ? "#fafbfc" : "#fff",
            breakInside: "avoid" }}>
            <div style={{ flex: "0 0 20px", width: 20, fontSize: 11.5, fontWeight: 800, color: MUT, textAlign: "center", ...mono }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ flex: "0 0 76px", width: 76, height: 58, borderRadius: 10,
              border: `1px solid ${LINE}`, background: "linear-gradient(180deg,#fff,#f7f8f9)",
              display: "grid", placeItems: "center", overflow: "hidden", padding: 5 }}>
              {l.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={l.image} alt={l.label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                : <span style={{ fontSize: 22 }}>📦</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>{l.label}</div>
              {l.sub && <div style={{ fontSize: 12, color: MUT, marginTop: 2 }}>{l.sub}</div>}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: ACCENT, ...mono, whiteSpace: "nowrap" }}>{l.qty}</div>
          </div>
        ))}
      </div>

      {/* ————— total ————— */}
      <div style={{ padding: "16px 32px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderRadius: 14,
          background: `linear-gradient(120deg, ${INK}, #232a34)`, border: `1px solid ${ACCENT}` }}>
          <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 12, letterSpacing: "0.1em", color: ACCENT2 }}>{totalLabel}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: ACCENT2, ...mono }}>{totalValue}</span>
        </div>
      </div>

      {/* ————— trust strip ————— */}
      <div style={{ margin: "0 32px 20px", padding: "10px 14px", borderRadius: 10,
        background: "#f6f8fa", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>✓</span>
        <span style={{ fontSize: 11, color: MUT }}>
          Quantities computed by FabriQ&apos;s deterministic engine from checked measurements — not estimated by AI.
        </span>
      </div>

      {note && (
        <div style={{ padding: "0 32px 22px", fontSize: 11.5, color: MUT, textAlign: "center" }}>{note}</div>
      )}
    </div>
  );
}
