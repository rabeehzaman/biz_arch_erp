import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceReceipt, type InvoiceReceiptData } from "@/components/invoices/invoice-receipt";
import { printReceipt } from "@/lib/print-receipt";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";

export type { InvoiceReceiptData } from "@/components/invoices/invoice-receipt";

export interface ReceiptHtmlOptions {
  marginLeft?: number;  // mm, default 3
  marginRight?: number; // mm, default 5
}

export function generateInvoiceReceiptHtml(data: InvoiceReceiptData, options?: ReceiptHtmlOptions): string {
  const markup = renderToStaticMarkup(createElement(InvoiceReceipt, { data }));
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

export async function printInvoiceReceipt(data: InvoiceReceiptData, options?: ReceiptHtmlOptions): Promise<void> {
  const html = generateInvoiceReceiptHtml(data, options);

  if (isCapacitorEnvironment()) {
    const { capacitorPrintHtml } = await import("@/lib/capacitor-pdf-printer");
    return capacitorPrintHtml(html, "Invoice Receipt");
  }

  return printReceipt(html);
}
