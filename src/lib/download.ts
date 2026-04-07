"use client";

import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";

/**
 * Download a blob as a file, handling both web browsers and Capacitor Android.
 * PDFs on Capacitor use the native PdfPrinter plugin to save to Downloads.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string
): Promise<void> {
  if (isCapacitorEnvironment() && (blob.type === "application/pdf" || filename.endsWith(".pdf"))) {
    const { capacitorDownloadPdf } = await import("@/lib/capacitor-pdf-printer");
    await capacitorDownloadPdf(blob, filename);
    return;
  }

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
