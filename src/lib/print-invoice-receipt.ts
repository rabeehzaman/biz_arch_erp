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
  if (isCapacitorEnvironment()) {
    // Use silent thermal printing if a printer is configured
    const { getMobilePrinterConfig, capacitorBitmapPrintWithConfig } = await import("@/lib/capacitor-print");
    const config = getMobilePrinterConfig();
    if (config && (config.host || config.address)) {
      // Build ReceiptData-compatible object for the thermal printer
      const receiptData = {
        storeName: data.storeName,
        storeAddress: data.storeAddress,
        storeCity: data.storeCity,
        storeState: data.storeState,
        storePhone: data.storePhone,
        vatNumber: data.vatNumber,
        secondaryName: data.secondaryName,
        logoUrl: data.logoUrl,
        logoHeight: data.logoHeight,
        brandColor: data.brandColor,
        currency: data.currency,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.issueDate,
        paymentType: data.paymentType,
        saudiInvoiceType: data.saudiInvoiceType,
        customerName: data.customerName,
        customerSecondaryName: data.customerSecondaryName,
        customerPhone: data.customerPhone,
        customerVatNumber: data.customerVatNumber,
        items: data.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          lineTotal: item.lineTotal,
        })),
        subtotal: data.subtotal,
        taxRate: data.taxRate,
        taxAmount: data.taxAmount,
        roundOffAmount: data.roundOffAmount,
        total: data.total,
        isTaxInclusivePrice: data.isTaxInclusivePrice,
        amountPaid: data.amountPaid,
        balanceDue: data.balanceDue,
        isOverdue: data.isOverdue,
        payments: data.payments,
        notes: data.notes,
        qrCodeDataURL: data.qrCodeDataURL,
      };
      const result = await capacitorBitmapPrintWithConfig(receiptData as never, config);
      if (result.success) return;
      // If thermal print fails, fall through to HTML print preview
    }
    // Fallback: use native print preview
    const html = generateInvoiceReceiptHtml(data, options);
    const { capacitorPrintHtml } = await import("@/lib/capacitor-pdf-printer");
    return capacitorPrintHtml(html, "Invoice Receipt");
  }

  const html = generateInvoiceReceiptHtml(data, options);
  return printReceipt(html);
}
