import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosReceipt, type ReceiptData } from "@/components/pos/receipt";

export { smartPrintReceipt } from "@/lib/electron-print";

export interface ReceiptHtmlOptions {
  marginLeft?: number;  // mm, default 3
  marginRight?: number; // mm, default 5
}

export function generateReceiptHtml(data: ReceiptData, options?: ReceiptHtmlOptions): string {
  const markup = renderToStaticMarkup(createElement(PosReceipt, { data }));
  const ml = options?.marginLeft ?? 3;
  const mr = options?.marginRight ?? 5;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: 80mm 150mm;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    width: 80mm;
    padding: 0 ${mr}mm 0 ${ml}mm;
    font-family: 'Arial', 'Noto Sans Arabic', sans-serif;
    font-size: 13px;
    text-rendering: geometricPrecision;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: hidden;
    page-break-after: always;
  }
  img {
    max-width: 100%;
  }
  @media print {
    body {
      -webkit-font-smoothing: none;
    }
  }
</style>
</head>
<body>${markup}</body>
</html>`;
}

export function printReceipt(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for content to render before printing
  iframe.contentWindow?.addEventListener("afterprint", () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  });

  // Wait for all images (logo, QR) to load before printing
  const waitAndPrint = () => {
    const images = doc.querySelectorAll("img");
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Don't block print on failed images
      });
    });

    Promise.all(imagePromises).then(() => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Print failed:", e);
        }
        // Fallback cleanup if afterprint doesn't fire
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 5000);
      }, 100);
    });
  };

  // Small delay to ensure styles are applied
  setTimeout(waitAndPrint, 150);
}
