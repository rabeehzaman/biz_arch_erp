import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PosReceipt, type ReceiptData } from "@/components/pos/receipt";

export function generateReceiptHtml(data: ReceiptData): string {
  const markup = renderToStaticMarkup(createElement(PosReceipt, { data }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: 80mm auto;
    margin: 0;
  }
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    width: 80mm;
    padding: 0 4mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    -webkit-print-color-adjust: exact;
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
    document.body.removeChild(iframe);
  });

  // Small delay to ensure styles are applied
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Print failed:", e);
    }
    // Fallback cleanup if afterprint doesn't fire (some browsers)
    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  }, 250);
}
