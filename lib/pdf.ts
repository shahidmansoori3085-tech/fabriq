/**
 * PDFs the app hands to WhatsApp — always a screenshot of a real on-screen
 * document (the workshop sheet, a supplier order), never a re-typed summary
 * of one. The layout and drawings the fabricator already checked on screen
 * are the same pixels the workshop or the dealer receives.
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/** Phones refuse canvases past roughly 16.7 M pixels or 16 384 px a side —
 *  past that html2canvas returns a blank or throws. Stay well under both. */
const MAX_CANVAS_AREA = 14_000_000;
const MAX_CANVAS_SIDE = 15_000;

/**
 * Turn an on-screen document into a PDF, sliced across A4 pages.
 *
 * Anything carrying the `no-print` class (buttons, the WhatsApp control
 * itself) is left out of the capture.
 */
export async function elementToPdfBlob(el: HTMLElement, opts: {
  /** lay the document out this wide (px) for the PDF — the on-screen phone
   *  column is too narrow for A4: blown up, its text is huge and runs to
   *  many pages */
  width?: number;
} = {}): Promise<Blob> {
  // Every page carries a small "Made with FabriQ" in its bottom corner — a
  // real link, drawn by the PDF itself (the page body is a picture), so a
  // dealer or karigar who opens the PDF can tap straight into the app.
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  // Wait for fonts and catalogue images to paint, each capped so a
  // backgrounded tab (rAF suspended) can never hang the share forever.
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<void>((res) => setTimeout(res, ms))]);
  await withTimeout(document.fonts.ready.catch(() => undefined), 2000);
  const images = Array.from(el.querySelectorAll("img"));
  await withTimeout(Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
    img.addEventListener("load", res, { once: true });
    img.addEventListener("error", res, { once: true });
  }))), 3000);
  await new Promise((res) => setTimeout(res, 30));

  // Sharp (2×) where the phone allows it; a long job's sheet scales down
  // instead of silently failing.
  const w = el.scrollWidth || el.offsetWidth || 1;
  const h = el.scrollHeight || el.offsetHeight || 1;
  const scale = Math.max(0.6, Math.min(2, Math.sqrt(MAX_CANVAS_AREA / (w * h)), MAX_CANVAS_SIDE / h));

  /** Where a page may break, in CSS px from the top of the document: the top
   *  of a card (best — nothing is split), else of a table row or figure. */
  const cardTops: number[] = [];
  const rowTops: number[] = [];

  const canvas = await html2canvas(el, {
    scale,
    useCORS: true,
    imageTimeout: 8000,
    backgroundColor: "#ffffff",
    ignoreElements: (node) => node instanceof HTMLElement && node.classList.contains("no-print"),
    ...(opts.width ? { windowWidth: opts.width + 200 } : {}),
    onclone: (doc, clone) => {
      // html2canvas mis-spaces tabular figures ("16 '") and clips one-line
      // truncated text at the top; neither matters on paper, so drop both.
      const st = doc.createElement("style");
      st.textContent = "*{font-variant-numeric:normal!important;font-feature-settings:normal!important}" +
        ".truncate{overflow:visible!important;text-overflow:clip!important;white-space:normal!important}";
      doc.head.appendChild(st);
      if (opts.width) {
        clone.style.width = `${opts.width}px`;
        clone.style.maxWidth = "none";
      }
      const top0 = clone.getBoundingClientRect().top;
      clone.querySelectorAll(".card").forEach((n) => cardTops.push(n.getBoundingClientRect().top - top0));
      clone.querySelectorAll("tr, figure").forEach((n) => rowTops.push(n.getBoundingClientRect().top - top0));
    },
  });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 6;
  const imgW = pageW - 2 * margin;
  // How many source pixels make one full PDF page at this image width.
  const pagePx = Math.floor(((pageH - 2 * margin) * canvas.width) / imgW);
  const ctx = canvas.getContext("2d");

  /** Is this canvas row blank (near-white)? A page break there cuts no text.
   *  The outer 6% each side is skipped: card and document borders run down
   *  the edges of every row and would otherwise make no row ever "blank". */
  const edge = Math.floor(canvas.width * 0.06);
  const blankRow = (y: number): boolean => {
    if (!ctx) return true;
    const row = ctx.getImageData(edge, y, canvas.width - 2 * edge, 1).data;
    for (let i = 0; i < row.length; i += 16) {
      if (row[i] < 245 || row[i + 1] < 245 || row[i + 2] < 245) return false;
    }
    return true;
  };

  let sliced = 0;
  let firstPage = true;
  while (sliced < canvas.height) {
    let sliceH = Math.min(pagePx, canvas.height - sliced);
    // Break in the white gap between rows / cards rather than through one:
    // look back up to a third of a page for a blank line.
    if (sliced + sliceH < canvas.height) {
      // Break above a card if one starts in the lower half of the page, else
      // above a table row / figure, else in the nearest blank line.
      const px = (css: number) => Math.round(css * scale) - 4;
      const lastIn = (tops: number[], from: number) =>
        tops.map(px).filter((y) => y > sliced + from && y <= sliced + sliceH).sort((a, b) => b - a)[0];
      const at = lastIn(cardTops, pagePx * 0.45) ?? lastIn(rowTops, pagePx * 0.3);
      if (at !== undefined) sliceH = at - sliced;
      else {
        for (let back = 0; back < pagePx / 3; back++) {
          if (blankRow(sliced + sliceH - back)) { sliceH -= back; break; }
        }
      }
    }
    // A last sliver of white (the document's bottom padding) is not a page.
    if (!firstPage) {
      let blank = true;
      for (let y = sliced; y < sliced + sliceH; y += 4) if (!blankRow(y)) { blank = false; break; }
      if (blank) break;
    }
    const page = document.createElement("canvas");
    page.width = canvas.width;
    page.height = sliceH;
    const pctx = page.getContext("2d");
    if (!pctx) break;
    pctx.drawImage(canvas, 0, sliced, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!firstPage) doc.addPage();
    doc.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, (sliceH * imgW) / canvas.width);
    if (appUrl) {
      const label = "Made with FabriQ";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(232, 89, 12);
      const tw = doc.getTextWidth(label);
      const x = pageW - margin - tw, y = pageH - 3;
      doc.text(label, x, y);
      doc.link(x - 1, y - 3.5, tw + 2, 5, { url: appUrl });
    }
    sliced += sliceH;
    firstPage = false;
  }

  return doc.output("blob");
}

export type ShareResult =
  /** the share sheet took it */
  | "shared"
  /** the fabricator closed the share sheet — nothing was sent */
  | "cancelled"
  /** the browser wants a fresh tap before it opens the share sheet */
  | "needs-tap"
  /** no share sheet here (desktop): the PDF was saved; offer the chat link */
  | "downloaded";

/**
 * Hand the PDF to WhatsApp. Returns what actually happened so the UI can tell
 * the truth instead of claiming it was sent.
 *
 * The share sheet only opens inside a fresh tap. Building the PDF takes a few
 * seconds, which can use that tap up (iPhone especially) — then this returns
 * "needs-tap" and the caller asks for one more tap with the PDF already built.
 */
export async function sharePdfToWhatsApp(blob: Blob, filename: string, text: string): Promise<ShareResult> {
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
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      if (e instanceof DOMException && e.name === "NotAllowedError") return "needs-tap";
      // anything else: fall through and save it instead
    }
  }

  // Desktop: a wa.me link cannot carry a file, so save it. Opening the chat
  // here would be a popup outside any tap — the caller shows a link instead.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}

export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
