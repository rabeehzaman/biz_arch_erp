import type { ReceiptData } from "@/components/pos/receipt";
import { generateReceiptHtml, printReceipt as browserPrintReceipt, type ReceiptHtmlOptions } from "@/lib/print-receipt";
import { capacitorPrintWithConfig, isCapacitorEnvironment, type MobilePrinterConfig } from "@/lib/capacitor-print";

type SerializedReceiptData = Omit<ReceiptData, "date"> & {
  date: string;
} & Record<string, unknown>;

export function isElectronEnvironment(): boolean {
  return typeof window !== "undefined" && !!window.electronPOS?.isElectron;
}

function serializeReceiptData(data: ReceiptData): SerializedReceiptData {
  return {
    ...data,
    date: data.date instanceof Date ? data.date.toISOString() : new Date(data.date).toISOString(),
  };
}

function hydrateReceiptData(data: SerializedReceiptData): ReceiptData {
  return {
    ...data,
    date: new Date(data.date),
  };
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

function getReceiptRenderMode(config?: Partial<ElectronPrinterConfig>) {
  return config?.receiptRenderMode
    ?? (config?.connectionType === "windows" ? "htmlDriver" : "escposText");
}

function getRenderedReceiptHtml(
  data: ReceiptData,
  config?: Partial<ElectronPrinterConfig>
) {
  const margins: ReceiptHtmlOptions = {
    marginLeft: config?.receiptMarginLeft,
    marginRight: config?.receiptMarginRight,
  };

  return generateReceiptHtml(data, margins);
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
      nameAr: item.nameAr,
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
    footerAr: "شكراً لزيارتكم",
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
  const receiptRenderMode = getReceiptRenderMode(resolvedConfig);

  if (receiptRenderMode === "htmlDriver") {
    if (resolvedConfig?.connectionType !== "windows") {
      return { success: false, error: "Windows HTML mode requires Windows Printer connection" };
    }

    const html = getRenderedReceiptHtml(data, resolvedConfig);
    return window.electronPOS.printStyledReceipt(html, resolvedConfig);
  }

  if (receiptRenderMode === "htmlRaster") {
    const html = getRenderedReceiptHtml(data, resolvedConfig);
    return window.electronPOS.printRasterizedReceipt(html, resolvedConfig);
  }

  // ESC/POS path for rawUsb / network connections
  const mapped = mapReceiptToElectronFormat(data);
  return window.electronPOS.printReceipt(mapped, resolvedConfig);
}

export async function cacheReceiptArtifactWithConfig(
  data: ReceiptData,
  config?: Partial<ElectronPrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS?.cacheRenderedReceipt) {
    return { success: false, error: "Electron receipt cache bridge not available" };
  }

  const resolvedConfig = await resolvePrinterConfig(config);
  const receiptRenderMode = getReceiptRenderMode(resolvedConfig);
  if (receiptRenderMode !== "htmlDriver" && receiptRenderMode !== "htmlRaster") {
    return {
      success: false,
      error: "Receipt caching is only supported for HTML receipt render modes",
    };
  }

  const html = getRenderedReceiptHtml(data, resolvedConfig);
  return window.electronPOS.cacheRenderedReceipt(
    html,
    serializeReceiptData(data),
    resolvedConfig
  );
}

export async function printAndCacheReceiptWithConfig(
  data: ReceiptData,
  config?: Partial<ElectronPrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS?.printAndCacheRenderedReceipt) {
    return electronPrintWithConfig(data, config);
  }

  const resolvedConfig = await resolvePrinterConfig(config);
  const receiptRenderMode = getReceiptRenderMode(resolvedConfig);
  if (receiptRenderMode !== "htmlDriver" && receiptRenderMode !== "htmlRaster") {
    return electronPrintWithConfig(data, resolvedConfig);
  }

  const html = getRenderedReceiptHtml(data, resolvedConfig);
  return window.electronPOS.printAndCacheRenderedReceipt(
    html,
    serializeReceiptData(data),
    resolvedConfig
  );
}

export async function loadLatestCachedReceipt(): Promise<ReceiptData | null> {
  if (!window.electronPOS?.getLatestCachedReceipt) {
    return null;
  }

  try {
    const result = await window.electronPOS.getLatestCachedReceipt();
    if (!result.success || !result.receipt?.receiptData) {
      return null;
    }

    return hydrateReceiptData(result.receipt.receiptData as SerializedReceiptData);
  } catch {
    return null;
  }
}

export async function printLatestCachedReceipt(
  config?: Partial<ElectronPrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS?.printCachedReceipt) {
    return { success: false, error: "Electron cached receipt bridge not available" };
  }

  const resolvedConfig = await resolvePrinterConfig(config);
  return window.electronPOS.printCachedReceipt(undefined, resolvedConfig);
}

export async function capacitorPrint(
  data: ReceiptData
): Promise<{ success: boolean; error?: string }> {
  return capacitorPrintWithConfig(data);
}

export async function capacitorPrintWithOverride(
  data: ReceiptData,
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  return capacitorPrintWithConfig(data, config);
}

/**
 * Open the cash drawer using the saved printer config.
 * Reads the "pos-open-drawer-on-sale" localStorage flag and opens
 * the drawer via Electron IPC or Capacitor if enabled.
 */
export async function openCashDrawerIfEnabled(): Promise<void> {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("pos-open-drawer-on-sale") !== "true") return;
  } catch {
    return;
  }

  if (isElectronEnvironment() && window.electronPOS) {
    const resolvedConfig = await resolvePrinterConfig();
    window.electronPOS.openCashDrawer(resolvedConfig).catch(() => {});
  } else if (isCapacitorEnvironment()) {
    const { openMobileCashDrawer, getMobilePrinterConfig, getDefaultMobilePrinterConfig } = await import("@/lib/capacitor-print");
    const config = getMobilePrinterConfig() ?? getDefaultMobilePrinterConfig();
    openMobileCashDrawer(config).catch(() => {});
  }
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
  } else if (isCapacitorEnvironment()) {
    capacitorPrint(data).then((result) => {
      if (!result.success) {
        console.error("Capacitor print failed:", result.error);
        browserPrintReceipt(generateReceiptHtml(data));
      }
    });
  } else {
    browserPrintReceipt(generateReceiptHtml(data));
  }
}
