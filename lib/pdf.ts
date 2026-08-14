/**
 * Order PDFs — the sheet a supplier actually receives.
 *
 * This document is the fabricator's face at the counter, so it is built like
 * stationery, not a text dump: a branded header carrying his shop name and
 * address, a real table with column headings, and a total that can be read
 * across a shop counter. It replaces an earlier version that printed plain
 * left/right lines with no address, no headings and no rules — technically
 * correct and impossible to be proud of.
 *
 * Built programmatically (not screenshotted), so the text stays crisp, the file
 * stays small enough to send over WhatsApp, and the layout is identical on
 * every phone.
 */
import { jsPDF } from "jspdf";

const INK = "#14181d";
const DIM = "#6b7480";
const LINE = "#d7dde3";
const ZEBRA = "#f6f8fa";
/** One accent, used only for the header band and the total — same discipline as the app. */
const ACCENT = "#E2661F";
const ACCENT_SOFT = "#fdf0e8";

export interface PdfColumn {
  label: string;
  /** share of the content width, any scale — normalised across the row */
  width: number;
  align?: "left" | "right";
}

export interface PdfTable {
  heading?: string;
  sub?: string;
  columns: PdfColumn[];
  rows: string[][];
  /** One data-URL (or null) per row — a small cross-section thumbnail drawn
   *  in a left-hand gutter before the text columns, so a supplier reading the
   *  PDF sees the same profile shape the app shows on screen. */
  rowImages?: (string | null)[];
}

export interface OrderPdfOpts {
  title: string;
  shopName?: string;
  tagline?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  tables: PdfTable[];
  totalLabel?: string;
  total?: string;
  note?: string;
}

export function buildOrderPdf(opts: OrderPdfOpts): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const CW = W - M * 2;

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  /* —— branded header band —— */
  const band = 26;
  doc.setFillColor(ACCENT).rect(0, 0, W, band, "F");

  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text(opts.shopName || "FabriQ", M, 11);

  // Contact details ride under the name, so the supplier can call without asking.
  const contact = [opts.address, opts.phone && `Ph: ${opts.phone}`, opts.gstin && `GSTIN: ${opts.gstin}`]
    .filter(Boolean).join("  ·  ");
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  if (contact) doc.text(contact.slice(0, 110), M, 16.5);
  if (opts.tagline) doc.text(opts.tagline.slice(0, 70), M, 21);

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(opts.title.toUpperCase(), W - M, 11, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(today, W - M, 16.5, { align: "right" });

  let y = band + 10;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed <= H - 18) return;
    doc.addPage();
    y = 18;
  };

  /* —— tables —— */
  for (const t of opts.tables) {
    if (!t.rows.length) continue;
    newPageIfNeeded(24);

    if (t.heading) {
      doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(INK);
      doc.text(t.heading, M, y);
      if (t.sub) {
        doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(DIM);
        doc.text(t.sub, W - M, y, { align: "right" });
      }
      y += 5;
    }

    // A row-image gutter, if this table carries drawings, pushes every text
    // column right — the declared widths still normalise to what's left.
    const gutter = t.rowImages ? 16 : 0;
    const totalW = t.columns.reduce((a, c) => a + c.width, 0) || 1;
    const widths = t.columns.map((c) => (c.width / totalW) * (CW - gutter));
    const xAt = (i: number) => M + gutter + widths.slice(0, i).reduce((a, w) => a + w, 0);

    const cell = (i: number, text: string) => {
      const c = t.columns[i];
      if (c.align === "right") doc.text(text, xAt(i) + widths[i] - 2, y, { align: "right" });
      else doc.text(text, xAt(i) + 2, y);
    };

    // header row
    const headH = 7;
    doc.setFillColor("#eef1f4").rect(M, y - 4.6, CW, headH, "F");
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(DIM);
    t.columns.forEach((c, i) => cell(i, c.label.toUpperCase()));
    y += headH - 0.5;

    // body rows — taller when a gutter drawing needs the room
    const rowH = gutter ? 15 : 7;
    const drawRowImage = (data: string | null | undefined, rowTop: number) => {
      if (!data) return;
      try {
        doc.addImage(data, "PNG", M + 1.5, rowTop + 1, gutter - 3, rowH - 2);
      } catch { /* a malformed data URL should never break the rest of the PDF */ }
    };
    t.rows.forEach((r, ri) => {
      if (y + rowH > H - 18) {
        doc.addPage();
        y = 18;
        doc.setFillColor("#eef1f4").rect(M, y - 4.6, CW, headH, "F");
        doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(DIM);
        t.columns.forEach((c, i) => cell(i, c.label.toUpperCase()));
        y += headH - 0.5;
      }
      if (ri % 2 === 1) doc.setFillColor(ZEBRA).rect(M, y - 4.6, CW, rowH, "F");
      drawRowImage(t.rowImages?.[ri], y - 4.6);
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(INK);
      r.forEach((v, i) => {
        if (i === 0) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        cell(i, v ?? "");
      });
      y += rowH;
      doc.setDrawColor(LINE).setLineWidth(0.15).line(M, y - 4.6, W - M, y - 4.6);
    });

    y += 6;
  }

  /* —— total —— */
  if (opts.total) {
    newPageIfNeeded(20);
    const boxH = 14;
    doc.setFillColor(ACCENT_SOFT).rect(M, y - 4, CW, boxH, "F");
    doc.setDrawColor(ACCENT).setLineWidth(0.4).rect(M, y - 4, CW, boxH, "S");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(INK);
    doc.text(opts.totalLabel || "Total", M + 4, y + 5);
    doc.setFontSize(13).setTextColor(ACCENT);
    doc.text(opts.total, W - M - 4, y + 5, { align: "right" });
    y += boxH + 6;
  }

  /* —— footer on every page —— */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(LINE).setLineWidth(0.2).line(M, H - 13, W - M, H - 13);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(DIM);
    doc.text(opts.note || "Generated by FabriQ — sizes come from a deterministic engine, not from AI.", M, H - 8.5);
    if (pages > 1) doc.text(`${p} / ${pages}`, W - M, H - 8.5, { align: "right" });
  }

  return doc.output("blob");
}

/**
 * Fetch a catalogue cross-section PNG (from /public/sections) and flatten it
 * onto a white background as a data URL jsPDF can embed. Returns null for a
 * section with no cropped image (or any load failure) — the caller just
 * skips the drawing for that row rather than breaking the whole PDF.
 */
export async function sectionImageDataUrl(sectionId: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
    });
    img.src = `/sections/${sectionId}.png`;
    await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Save the PDF and hand it to WhatsApp. Returns what actually happened so the
 * UI can tell the truth instead of claiming it was sent.
 */
export async function sharePdfToWhatsApp(
  blob: Blob, filename: string, text: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (d: ShareData) => boolean;
    share?: (d: ShareData) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      // user dismissed the sheet — don't fall through to a download he didn't ask for
      if (e instanceof DOMException && e.name === "AbortError") return "shared";
    }
  }

  // Desktop: a wa.me link cannot carry a file, so save it and open the chat.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return "downloaded";
}
