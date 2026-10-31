"use client";
/**
 * Supplier order — the purchase order a dealer or glass shop receives on
 * WhatsApp. A plain, printed-document look: the shop's letterhead, one clean
 * table of what to pull and how many, and the total. White paper and black
 * ink — it is read small on a phone and often printed, so no dark blocks.
 * The fabricator's own working screen (scrap, drawings, notes) stays with him.
 *
 * Self-contained styling, so it renders the same whatever the app's theme.
 * The "Made with FabriQ" link is stamped onto each PDF page by lib/pdf.ts,
 * where it can be a real, tappable link.
 */
import type { ShopProfile } from "@/lib/shop";

const INK = "#111827";
const MUT = "#6b7280";
const LINE = "#e5e7eb";
const HEAD = "#f3f4f6";
const ACCENT = "#e8590c";
const num: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

export interface SupplierOrderLine {
  /** catalogue cross-section image URL — omitted when none exists */
  image?: string;
  label: string;
  sub?: string;
  qty: string;
  /** a second, smaller line under the quantity (e.g. "1 × 16' + 1 × 8'") */
  qtySub?: string;
}

export function SupplierOrderDoc({
  shop, title, date, job, lines, totalLabel, totalValue, totalSub, columns, note, className,
}: {
  shop: ShopProfile;
  title: string;
  date: string;
  /** job / customer name, so the dealer can tell two orders apart */
  job?: string;
  lines: SupplierOrderLine[];
  totalLabel: string;
  totalValue: string;
  totalSub?: string;
  /** the table's column headings: item, quantity */
  columns?: [string, string];
  note?: string;
  className?: string;
}) {
  const pictures = lines.some((l) => l.image);
  const th: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 700, color: MUT,
    letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "left", background: HEAD };
  return (
    <div className={className}
      style={{ background: "#fff", color: INK, padding: "34px 36px 28px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>

      {/* ————— letterhead ————— */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          {/* No placeholder name: "Your Shop" printed on a real order looks broken. */}
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            {shop.name || title}
          </div>
          <div style={{ color: MUT, fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>{shop.phone}</div>}
            {shop.gstin && <div>GSTIN {shop.gstin}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {shop.name && (
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", color: ACCENT }}>{title.toUpperCase()}</div>
          )}
          <div style={{ fontSize: 12.5, color: MUT, marginTop: shop.name ? 8 : 0, lineHeight: 1.7, ...num }}>
            <div>Date <b style={{ color: INK }}>{date}</b></div>
            {job && <div>Job <b style={{ color: INK }}>{job}</b></div>}
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: INK, margin: "18px 0 0" }} />

      {/* ————— the order ————— */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 34, textAlign: "center", borderRadius: "8px 0 0 8px" }}>#</th>
            <th style={th}>{columns?.[0] ?? "Item"}</th>
            <th style={{ ...th, textAlign: "right", borderRadius: "0 8px 8px 0" }}>{columns?.[1] ?? "Qty"}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${LINE}`, breakInside: "avoid" }}>
              <td style={{ padding: "12px 0", textAlign: "center", fontSize: 12, fontWeight: 700, color: MUT, ...num }}>{i + 1}</td>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  {pictures && (
                    <div style={{ flex: "0 0 72px", width: 72, height: 52, display: "grid", placeItems: "center" }}>
                      {l.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.image} alt={l.label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                      )}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{l.label}</div>
                    {l.sub && <div style={{ fontSize: 12, color: MUT, marginTop: 2, ...num }}>{l.sub}</div>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 18, fontWeight: 800, ...num }}>{l.qty}</div>
                {l.qtySub && <div style={{ fontSize: 11.5, color: MUT, marginTop: 2, ...num }}>{l.qtySub}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ————— total ————— */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16,
        marginTop: 14, padding: "14px 14px 0", borderTop: `2px solid ${INK}` }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>{totalLabel}</span>
        <span style={{ textAlign: "right" }}>
          <span style={{ display: "block", fontSize: 22, fontWeight: 800, ...num }}>{totalValue}</span>
          {totalSub && <span style={{ display: "block", fontSize: 12, color: MUT, marginTop: 2, ...num }}>{totalSub}</span>}
        </span>
      </div>

      {note && <div style={{ marginTop: 22, fontSize: 11.5, color: MUT }}>{note}</div>}
    </div>
  );
}
