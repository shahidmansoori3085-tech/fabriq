"use client";
/**
 * Client-facing QUOTATION — a premium PROPOSAL, not a bill. Visual-first:
 * every opening gets its own product card with a 3D render (or exact
 * elevation), spec highlights and a clear investment line — the layout big
 * window brands (Fenesta / Schüco / Eternia) use to win the customer.
 * Self-contained light styling so it prints identically in any app theme.
 */

export interface QuoteLine {
  name: string;      // "Domal Sliding Window"
  size: string;      // "4' × 5'"
  detail?: string;   // "3 track · 2 Glass + 1 Jali"
  qty: number;
  sqft: number;      // area per unit × qty already folded in
  rate: number;      // ₹ / sqft
  amount: number;    // sqft × rate
  drawing?: React.ReactNode; // exact elevation SVG, drawn from the dimensions
  render?: string;   // 3D snapshot (data URL) captured from the live configurator
}

export interface ShopProfile {
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
  tagline?: string;
  upi?: string; // UPI ID for the "Scan to Pay" QR on the proposal
}

/** Indian-system amount in words (₹). */
export function amountInWords(n: number): string {
  n = Math.round(n);
  if (n <= 0) return "Zero Rupees Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string =>
    x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x);
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(" ") + " Rupees Only";
}

const inr = (n: number) => "₹ " + Math.round(n).toLocaleString("en-IN");

// Luxury dark-gold palette (customer-facing proposal — matches the premium
// black+gold moodboard; distinct from the app's orange action accent).
const ACCENT = "#B08628";  // deep gold
const ACCENT2 = "#E4C77E"; // light champagne
const INK = "#14181d";
const MUT = "#6b7280";
const LINE = "#e6e9ee";
const mono: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace" };

export function QuoteDoc({
  shop, customer, quoteNo, date, validTill, lines, discountPct = 0, gstPct = 0, terms, note, className, payQr,
}: {
  shop: ShopProfile;
  customer: string;
  quoteNo: string;
  date: string;
  validTill?: string;
  lines: QuoteLine[];
  discountPct?: number;
  gstPct?: number;
  terms?: string;
  note?: string;
  className?: string;
  payQr?: string; // data-URL of the UPI "scan to pay" QR
}) {
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const discount = subtotal * (discountPct / 100);
  const taxable = subtotal - discount;
  const gst = taxable * (gstPct / 100);
  const grand = taxable + gst;
  const totalSqft = lines.reduce((a, l) => a + l.sqft, 0);
  const totalQty = lines.reduce((a, l) => a + l.qty, 0);

  return (
    <div className={`quote-doc ${className ?? ""}`}
      style={{ background: "#fff", color: INK, borderRadius: 16, overflow: "hidden",
        border: `1px solid ${LINE}`, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* ————— brand header ————— */}
      <div style={{ background: `linear-gradient(120deg, ${INK}, #232a34)`, color: "#fff",
        padding: "24px 30px", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
            {shop.name || "Your Shop Name"}
          </div>
          {shop.tagline && <div style={{ color: ACCENT2, fontWeight: 600, fontSize: 13, marginTop: 4 }}>{shop.tagline}</div>}
          <div style={{ color: "#c2c8d0", fontSize: 12.5, marginTop: 10, lineHeight: 1.55 }}>
            {shop.address && <div>{shop.address}</div>}
            {shop.phone && <div>{shop.phone}</div>}
            {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "inline-block", background: `linear-gradient(180deg, ${ACCENT2}, ${ACCENT})`,
            color: "#fff", padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 800,
            letterSpacing: "0.16em" }}>PROPOSAL</div>
          <div style={{ marginTop: 12, fontSize: 12.5, color: "#c2c8d0", ...mono }}>
            <div>No: <b style={{ color: "#fff" }}>{quoteNo}</b></div>
            <div>Date: <b style={{ color: "#fff" }}>{date}</b></div>
            {validTill && <div>Valid till: <b style={{ color: "#fff" }}>{validTill}</b></div>}
          </div>
        </div>
      </div>

      {/* ————— prepared for + snapshot stats ————— */}
      <div style={{ padding: "18px 30px", display: "flex", justifyContent: "space-between",
        alignItems: "flex-end", gap: 16, flexWrap: "wrap", borderBottom: `1px solid ${LINE}` }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: MUT }}>Prepared exclusively for</div>
          <div style={{ fontSize: 19, fontWeight: 800, marginTop: 3 }}>{customer || "Customer Name"}</div>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <Stat label="Openings" value={String(totalQty)} />
          <Stat label="Total Area" value={`${totalSqft.toFixed(0)} sqft`} />
          <Stat label="Estimate" value={inr(grand)} accent />
        </div>
      </div>

      {/* ————— product cards ————— */}
      <div style={{ padding: "20px 30px 6px", display: "flex", flexDirection: "column", gap: 14 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 16, alignItems: "stretch", padding: 14,
            border: `1px solid ${LINE}`, borderRadius: 14, background: "#fff", breakInside: "avoid" }}>
            {/* visual — 3D render if captured, else exact elevation */}
            <div style={{ flex: "0 0 128px", width: 128, minHeight: 104, borderRadius: 10,
              border: `1px solid ${LINE}`, background: "linear-gradient(180deg,#f5f7f9,#e9edf1)",
              display: "grid", placeItems: "center", overflow: "hidden", padding: 6 }}>
              {l.render
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={l.render} alt={l.name} style={{ maxWidth: "100%", maxHeight: 120, objectFit: "contain" }} />
                : <div style={{ width: "100%" }}>{l.drawing}</div>}
            </div>
            {/* details */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{l.name}</div>
                <div style={{ fontSize: 12, color: MUT, ...mono, whiteSpace: "nowrap" }}>Item {i + 1}</div>
              </div>
              {/* spec chips from the detail line */}
              {l.detail && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {l.detail.split("·").map((d, j) => (
                    <span key={j} style={{ fontSize: 11.5, fontWeight: 600, color: "#3a4150",
                      background: "#f1f4f7", border: `1px solid ${LINE}`, borderRadius: 999, padding: "3px 10px" }}>
                      {d.trim()}
                    </span>
                  ))}
                </div>
              )}
              {/* metrics */}
              <div style={{ display: "flex", gap: 18, marginTop: "auto", paddingTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Metric k="Size" v={l.size} />
                <Metric k="Qty" v={String(l.qty)} />
                <Metric k="Area" v={`${l.sqft.toFixed(1)} sqft`} />
                <Metric k="Rate" v={`${inr(l.rate)}/sqft`} />
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: MUT }}>Amount</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: ACCENT, ...mono }}>{inr(l.amount)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ————— investment summary ————— */}
      <div style={{ padding: "10px 30px 4px", display: "flex", justifyContent: "flex-end" }}>
        <div style={{ width: 320, maxWidth: "100%" }}>
          <Row k="Subtotal" v={inr(subtotal)} />
          {discountPct > 0 && <Row k={`Discount (${discountPct}%)`} v={"– " + inr(discount)} />}
          {gstPct > 0 && <Row k={`GST (${gstPct}%)`} v={inr(gst)} />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 8, padding: "15px 18px", borderRadius: 12,
            background: `linear-gradient(120deg, ${INK}, #232a34)`, border: `1px solid ${ACCENT}` }}>
            <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: 12, letterSpacing: "0.1em", color: ACCENT2 }}>Grand Total</span>
            <span style={{ fontSize: 23, fontWeight: 800, color: ACCENT2, ...mono }}>{inr(grand)}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: "6px 30px 0", fontSize: 12.5, fontStyle: "italic", color: MUT, textAlign: "right" }}>
        In words: {amountInWords(grand)}
      </div>

      {/* ————— scan to pay (UPI) ————— */}
      {payQr && (
        <div style={{ margin: "16px 30px 0", padding: 16, borderRadius: 12, background: `linear-gradient(120deg, ${INK}, #232a34)`,
          display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payQr} alt="Scan to pay" width={92} height={92}
            style={{ borderRadius: 8, background: "#fff", padding: 6 }} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Scan to Pay the Advance</div>
            <div style={{ fontSize: 11.5, color: "#c2c8d0", marginTop: 3 }}>
              Kisi bhi UPI app se scan karo — GPay · PhonePe · Paytm · BHIM
            </div>
            {shop.upi && <div style={{ fontSize: 11, color: ACCENT2, marginTop: 6, ...mono }}>{shop.upi}</div>}
          </div>
        </div>
      )}

      {/* ————— assurance strip ————— */}
      <div style={{ margin: "18px 30px 0", padding: 14, borderRadius: 12, background: "#f7f9fb",
        border: `1px solid ${LINE}`, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "space-around" }}>
        <Assure title="Precision Cut" sub="Exact sizes, zero guesswork" />
        <Assure title="Branded Hardware" sub="Smooth, long-lasting fittings" />
        <Assure title="Professional Fitting" sub="Clean, on-time installation" />
      </div>

      {/* ————— terms + signature ————— */}
      <div style={{ padding: "18px 30px 8px", display: "flex", gap: 26, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: MUT, marginBottom: 6 }}>Terms &amp; Conditions</div>
          <div style={{ fontSize: 12, color: MUT, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {terms || "• Rates valid for 15 days from proposal date.\n• 50% advance, balance before installation.\n• Glass / hardware as per selected specification.\n• Prices include fabrication & fitting unless stated."}
          </div>
          {note && <div style={{ fontSize: 12, color: INK, marginTop: 10 }}>Note: {note}</div>}
        </div>
        <div style={{ flex: "0 0 200px", textAlign: "right", alignSelf: "flex-end" }}>
          <div style={{ height: 42, borderBottom: `1px solid ${LINE}`, marginBottom: 6 }} />
          <div style={{ fontSize: 12, color: MUT }}>For {shop.name || "Your Shop"}</div>
          <div style={{ fontSize: 11, color: MUT }}>Authorised Signature</div>
        </div>
      </div>

      {/* ————— footer ————— */}
      <div style={{ marginTop: 12, padding: "14px 30px", borderTop: `1px solid ${LINE}`, background: "#fafbfc",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>Thank you for the opportunity to serve you.</span>
        <span style={{ fontSize: 11, color: MUT }}>Generated with FabriQ</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: MUT }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: accent ? ACCENT : INK, ...mono }}>{value}</div>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: MUT }}>{k}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, ...mono }}>{v}</div>
    </div>
  );
}

function Assure({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 150 }}>
      <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999,
        background: "#f5ecd6", color: ACCENT, fontWeight: 900, fontSize: 15 }}>✓</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: MUT }}>{sub}</div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 16px", fontSize: 13.5 }}>
      <span style={{ color: MUT }}>{k}</span>
      <span style={{ color: INK, ...mono }}>{v}</span>
    </div>
  );
}
