/**
 * Order PDFs — one clean, branded sheet per supplier.
 *
 * Built programmatically (not screenshotted), so the text stays crisp, the file
 * stays small enough to send over WhatsApp, and the layout is identical on
 * every phone.
 *
 * The flow the fabricator asked for: tap send → the PDF is created and saved →
 * that same file is handed to WhatsApp. On phones that is the native share
 * sheet (Web Share with files); on a desktop browser, which cannot attach a
 * file to a wa.me link, the PDF downloads and WhatsApp opens with the text so
 * he can attach the file he just got.
 */
import { jsPDF } from "jspdf";

export interface PdfRow { left: string; right: string }
export interface PdfBlock { heading?: string; sub?: string; rows: PdfRow[] }

const INK = "#14181d";
const DIM = "#6b7480";
const LINE = "#d7dde3";

export function buildOrderPdf(opts: {
  title: string;
  shopName?: string;
  tagline?: string;
  blocks: PdfBlock[];
  total?: string;
  note?: string;
}): Blob {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = 20;

  const page = () => {
    if (y < 268) return;
    doc.addPage();
    y = 20;
  };

  // header
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(INK);
  doc.text(opts.shopName || "FabriQ", M, y);
  y += 5;
  if (opts.tagline) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(DIM);
    doc.text(opts.tagline, M, y);
    y += 4;
  }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(DIM);
  doc.text(opts.title.toUpperCase(), W - M, 20, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    W - M, 25, { align: "right" });

  y += 3;
  doc.setDrawColor(LINE).setLineWidth(0.4).line(M, y, W - M, y);
  y += 8;

  for (const b of opts.blocks) {
    page();
    if (b.heading) {
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(INK);
      doc.text(b.heading, M, y);
      if (b.sub) {
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(DIM);
        doc.text(b.sub, W - M, y, { align: "right" });
      }
      y += 6;
    }
    for (const r of b.rows) {
      page();
      doc.setFont("helvetica", "normal").setFontSize(10.5).setTextColor(INK);
      doc.text(r.left, M, y);
      doc.setFont("helvetica", "bold");
      doc.text(r.right, W - M, y, { align: "right" });
      y += 5.5;
      doc.setDrawColor("#eef1f4").setLineWidth(0.2).line(M, y - 1.8, W - M, y - 1.8);
    }
    y += 4;
  }

  if (opts.total) {
    page();
    y += 2;
    doc.setDrawColor(LINE).setLineWidth(0.4).line(M, y, W - M, y);
    y += 7;
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(INK);
    doc.text("Total", M, y);
    doc.text(opts.total, W - M, y, { align: "right" });
    y += 8;
  }

  if (opts.note) {
    page();
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(DIM);
    doc.text(opts.note, M, y);
  }

  return doc.output("blob");
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
