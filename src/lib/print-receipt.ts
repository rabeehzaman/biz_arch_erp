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
    size: 80mm 297mm;
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
    overflow: visible;
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

let _printQueue: Promise<void> = Promise.resolve();

export function printReceipt(html: string): Promise<void> {
  const job = _printQueue.then(() => _printReceiptNow(html));
  _printQueue = job.catch(() => {}); // don't let queue stall on error
  return job;
}

function _printReceiptNow(html: string): Promise<void> {
  return new Promise<void>((resolve) => {
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
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for content to render before printing
    iframe.contentWindow?.addEventListener("afterprint", () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      resolve();
    });

    // Wait for all images (logo, QR) to load before printing
    const waitAndPrint = () => {
      const images = doc.querySelectorAll("img");
      const imagePromises = Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res(); // Don't block print on failed images
        });
      });

      Promise.all(imagePromises).then(() => {
        // Measure actual content height, convert px→mm, add 10mm padding
        const contentPx = doc.documentElement.scrollHeight;
        const heightMM = Math.ceil(contentPx * 25.4 / 96) + 10;
        const dynStyle = doc.createElement('style');
        dynStyle.textContent = `@page { size: 80mm ${heightMM}mm !important; margin: 0; }`;
        doc.head.appendChild(dynStyle);

        setTimeout(() => {
          try {
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Print failed:", e);
            resolve();
          }
          // Fallback cleanup if afterprint doesn't fire
          setTimeout(() => {
            if (iframe.parentNode) document.body.removeChild(iframe);
            resolve();
          }, 5000);
        }, 100);
      });
    };

    // Small delay to ensure styles are applied
    setTimeout(waitAndPrint, 150);
  });
}
