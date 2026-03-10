import type { ReceiptData } from "@/components/pos/receipt";
import { generateReceiptHtml, printReceipt as browserPrintReceipt, type ReceiptHtmlOptions } from "@/lib/print-receipt";

export function isElectronEnvironment(): boolean {
  return typeof window !== "undefined" && !!window.electronPOS?.isElectron;
}

async function resolvePrinterConfig(
  config?: Partial<ElectronPrinterConfig>
): Promise<Partial<ElectronPrinterConfig> | undefined> {
  if (config?.connectionType) {
    return config;
  }

  if (!window.electronPOS?.getPrinterConfig) {
    return config;
  }

  try {
    const configResult = await window.electronPOS.getPrinterConfig();
    if (configResult.success) {
      return configResult.config;
    }
  } catch {
    // Fall back to the provided override or the raw ESC/POS path below.
  }

  return config;
}

/**
 * Maps the web app's ReceiptData shape to the Electron printer-service format.
 */
export function mapReceiptToElectronFormat(data: ReceiptData): Record<string, unknown> {
  return {
    header: {
      storeName: data.storeName,
      storeNameAr: data.arabicName,
      arabicName: data.arabicName,
      address: [data.storeAddress, data.storeCity, data.storeState]
        .filter(Boolean)
        .join(", "),
      phone: data.storePhone,
      vatNumber: data.vatNumber || data.storeGstin,
    },
    logoUrl: data.logoUrl,
    qrCodeDataURL: data.qrCodeDataURL,
    brandColor: data.brandColor,
    taxLabel: data.taxLabel || "Tax",
    invoiceNo: data.invoiceNumber,
    date: data.date instanceof Date
      ? data.date.toLocaleString()
      : String(data.date),
    customerName: data.customerName,
    items: data.items.map((item) => ({
      name: item.name,
      qty: item.quantity,
      price: item.unitPrice,
      total: item.lineTotal,
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
    qrcode: data.qrCodeText,
    qrCodeText: data.qrCodeText,
    footer: "Thank you for your purchase!",
    cutPaper: true,
    openDrawer: false,
  };
}

/**
 * Print via Electron's silent thermal printing.
 * For "windows" connection type, prints styled HTML via the system printer driver.
 * For "rawUsb" / "network", sends ESC/POS commands.
 */
export async function electronPrint(data: ReceiptData): Promise<{ success: boolean; error?: string }> {
  return electronPrintWithConfig(data);
}

export async function electronPrintWithConfig(
  data: ReceiptData,
  config?: Partial<ElectronPrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }

  const resolvedConfig = await resolvePrinterConfig(config);
  const receiptRenderMode = resolvedConfig?.receiptRenderMode
    ?? (resolvedConfig?.connectionType === "windows" ? "htmlDriver" : "escposText");

  if (receiptRenderMode === "htmlDriver") {
    if (resolvedConfig?.connectionType !== "windows") {
      return { success: false, error: "Windows HTML mode requires Windows Printer connection" };
    }

    const margins: ReceiptHtmlOptions = {
      marginLeft: resolvedConfig.receiptMarginLeft,
      marginRight: resolvedConfig.receiptMarginRight,
    };
    const html = generateReceiptHtml(data, margins);
    return window.electronPOS.printStyledReceipt(html, resolvedConfig);
  }

  if (receiptRenderMode === "htmlRaster") {
    const margins: ReceiptHtmlOptions = {
      marginLeft: resolvedConfig?.receiptMarginLeft,
      marginRight: resolvedConfig?.receiptMarginRight,
    };
    const html = generateReceiptHtml(data, margins);
    return window.electronPOS.printRasterizedReceipt(html, resolvedConfig);
  }

  // ESC/POS path for rawUsb / network connections
  const mapped = mapReceiptToElectronFormat(data);
  return window.electronPOS.printReceipt(mapped, resolvedConfig);
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
        browserPrintReceipt(generateReceiptHtml(data));
      }
    });
  } else {
    browserPrintReceipt(generateReceiptHtml(data));
  }
}
