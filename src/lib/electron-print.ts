import type { ReceiptData } from "@/components/pos/receipt";
import { generateReceiptHtml, printReceipt as browserPrintReceipt } from "@/lib/print-receipt";

export function isElectronEnvironment(): boolean {
  return typeof window !== "undefined" && !!window.electronPOS?.isElectron;
}

/**
 * Maps the web app's ReceiptData shape to the Electron printer-service format.
 */
export function mapReceiptToElectronFormat(data: ReceiptData): Record<string, unknown> {
  return {
    header: {
      storeName: data.storeName,
      address: [data.storeAddress, data.storeCity, data.storeState]
        .filter(Boolean)
        .join(", "),
      phone: data.storePhone,
      vatNumber: data.storeGstin,
    },
    invoiceNo: data.invoiceNumber,
    date: data.date instanceof Date
      ? data.date.toLocaleString()
      : String(data.date),
    customerName: data.customerName,
    items: data.items.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.unitPrice,
    })),
    totals: {
      subtotal: data.subtotal,
      tax: data.taxAmount,
      total: data.total,
    },
    payment: data.payments.map((p) => ({
      method: p.method,
      amount: p.amount,
    })),
    change: data.change,
    barcode: data.invoiceNumber.replace(/[^A-Za-z0-9]/g, ""),
    footer: "Thank you for your purchase!",
    cutPaper: true,
    openDrawer: false,
  };
}

/**
 * Print via Electron's silent thermal printing.
 */
export async function electronPrint(data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }
  const mapped = mapReceiptToElectronFormat(data);
  return window.electronPOS.printReceipt(mapped);
}

/**
 * Smart print: uses Electron silent printing if available, otherwise falls back
 * to browser iframe print dialog.
 */
export function smartPrintReceipt(data: ReceiptData): void {
  if (isElectronEnvironment()) {
    electronPrint(data).then((result) => {
      if (!result.success) {
        console.error("Electron print failed:", result.error);
        // Fallback to browser print on Electron failure
        const html = generateReceiptHtml(data);
        browserPrintReceipt(html);
      }
    });
  } else {
    const html = generateReceiptHtml(data);
    browserPrintReceipt(html);
  }
}
