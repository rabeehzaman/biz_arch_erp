"use client";

import { registerPlugin } from "@capacitor/core";

interface PdfPrinterPlugin {
  print(options: { data: string; jobName: string }): Promise<{ success: boolean }>;
  printHtml(options: { html: string; jobName: string }): Promise<{ success: boolean }>;
  download(options: {
    data: string;
    filename: string;
  }): Promise<{ success: boolean; uri?: string; path?: string }>;
}

const PdfPrinter = registerPlugin<PdfPrinterPlugin>("PdfPrinter");

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function capacitorPrintPdf(
  blob: Blob,
  jobName: string
): Promise<void> {
  const base64 = await blobToBase64(blob);
  await PdfPrinter.print({ data: base64, jobName });
}

export async function capacitorPrintHtml(
  html: string,
  jobName: string
): Promise<void> {
  await PdfPrinter.printHtml({ html, jobName });
}

export async function capacitorDownloadPdf(
  blob: Blob,
  filename: string
): Promise<void> {
  const base64 = await blobToBase64(blob);
  await PdfPrinter.download({ data: base64, filename });
}
