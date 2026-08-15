/**
 * PDFs the app hands to WhatsApp — always a screenshot of a real on-screen
 * document (the quotation, the workshop sheet, a supplier order), never a
 * re-typed summary of one. The branded layout, drawings and diagrams the
 * fabricator already checked on screen are the same pixels the client, the
 * workshop or the dealer receives.
 */
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Turn an on-screen document into a PDF, sliced across A4 pages.
 *
 * Anything carrying the `no-print` class (buttons, the WhatsApp control
 * itself) is left out of the capture — the same class the app already uses
 * to keep those controls off a real printout.
 */
export async function elementToPdfBlob(el: HTMLElement): Promise<Blob> {
  // Capturing before web fonts / catalogue images have actually finished
  // painting is exactly how you get a half-settled layout. Wait for both,
  // each capped so a fabricator sharing this in the background — screen
  // off, WhatsApp already switched to — can never hang forever: a
  // backgrounded tab can suspend rAF and stall font/image loads outright.
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<void>((res) => setTimeout(res, ms))]);
  await withTimeout(document.fonts.ready.catch(() => undefined), 2000);
  const images = Array.from(el.querySelectorAll("img"));
  await withTimeout(Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise((res) => {
    img.addEventListener("load", res, { once: true });
    img.addEventListener("error", res, { once: true });
  }))), 3000);
  await new Promise((res) => setTimeout(res, 30));

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    imageTimeout: 8000,
    backgroundColor: "#ffffff",
    ignoreElements: (node) => node instanceof HTMLElement && node.classList.contains("no-print"),
  });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const imgW = pageW;
  // How many source pixels make one full PDF page at this image width.
  const pagePx = (pageH * canvas.width) / imgW;

  let sliced = 0;
  let firstPage = true;
  while (sliced < canvas.height) {
    const sliceH = Math.min(pagePx, canvas.height - sliced);
    const page = document.createElement("canvas");
    page.width = canvas.width;
    page.height = sliceH;
    const ctx = page.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(canvas, 0, sliced, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    if (!firstPage) doc.addPage();
    doc.addImage(page.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgW, (sliceH * imgW) / canvas.width);
    sliced += sliceH;
    firstPage = false;
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
