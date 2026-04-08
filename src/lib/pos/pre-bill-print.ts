"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreBillReceipt, type PreBillReceiptData } from "@/components/pos/pre-bill-receipt";
import { isElectronEnvironment } from "@/lib/electron-print";
import { isCapacitorEnvironment, type MobilePrinterConfig } from "@/lib/capacitor-print";

export type { PreBillReceiptData } from "@/components/pos/pre-bill-receipt";

// --- Config keys (reuse receipt printer, not KOT printer) ---

const RECEIPT_MOBILE_CONFIG_KEY = "bizarch.mobilePrinterConfig.v1";

// --- Helpers ---

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getReceiptMobileConfig(): MobilePrinterConfig | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(RECEIPT_MOBILE_CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobilePrinterConfig;
  } catch {
    return null;
  }
}

// --- HTML generation ---

function generatePreBillHtml(data: PreBillReceiptData): string {
  const markup = renderToStaticMarkup(createElement(PreBillReceipt, { data }));

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
    padding: 0 5mm 0 3mm;
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

// --- Electron printing (uses receipt printer config) ---

async function printPreBillElectron(data: PreBillReceiptData): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }

  let config: Partial<ElectronPrinterConfig> | undefined;
  try {
    const result = await window.electronPOS.getPrinterConfig();
    if (result.success && result.config) {
      config = result.config;
    }
  } catch {
    // continue without config
  }

  const renderMode = config?.receiptRenderMode
    ?? (config?.connectionType === "windows" ? "htmlDriver" : "escposText");

  const html = generatePreBillHtml(data);

  if (renderMode === "htmlDriver") {
    return window.electronPOS.printStyledReceipt(html, config);
  }

  // For all other modes (htmlRaster, escposText, bitmapCanvas), rasterize the HTML
  return window.electronPOS.printRasterizedReceipt(html, config);
}

// --- Capacitor printing (uses receipt printer) ---

function connectionParams(config: MobilePrinterConfig) {
  if (config.connectionType === "bluetooth") {
    return { connectionType: "bluetooth" as const, address: config.address };
  }
  return { connectionType: "tcp" as const, host: config.host, port: config.port };
}

/**
 * Raw ESC/POS text path — sharper, faster output on thermal printers.
 */
async function printPreBillCapacitorRaw(
  data: PreBillReceiptData,
  config: MobilePrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  const { buildPreBillEscPos } = await import("@/lib/pos/pre-bill-escpos");
  const { ThermalPrinter } = await import("@/lib/capacitor-print");

  const paperWidth = config.paperWidth === 58 ? 32 : 48;
  const escposBytes = buildPreBillEscPos(data, {
    paperWidth: paperWidth as 48 | 32,
    cutPaper: config.cutPaper,
  });

  // Convert Uint8Array to base64 for Capacitor bridge
  let binary = "";
  for (let i = 0; i < escposBytes.length; i++) {
    binary += String.fromCharCode(escposBytes[i]);
  }
  const base64Data = btoa(binary);

  await ThermalPrinter.printRaw({
    ...connectionParams(config),
    data: base64Data,
    timeoutSeconds: config.timeoutSeconds,
  });

  return { success: true };
}

/**
 * Image-based fallback — renders pre-bill as PNG then sends as ESC/POS image.
 */
async function printPreBillCapacitorImage(
  data: PreBillReceiptData,
  config: MobilePrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  const { createRoot } = await import("react-dom/client");
  const { toPng } = await import("html-to-image");
  const { ThermalPrinter } = await import("@/lib/capacitor-print");

  const container = document.createElement("div");
  const width = config.paperWidth === 58 ? "58mm" : "80mm";

  Object.assign(container.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    pointerEvents: "none",
    background: "#ffffff",
  });

  document.body.appendChild(container);
  const root = createRoot(container);

  try {
    root.render(
      createElement("div", {
        style: {
          width,
          padding: `0 ${config.receiptMarginRight}mm 0 ${config.receiptMarginLeft}mm`,
          background: "#ffffff",
        },
      }, createElement(PreBillReceipt, { data }))
    );

    // Wait for paint
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    const target = container.firstElementChild;
    if (!(target instanceof HTMLElement)) {
      throw new Error("Failed to render pre-bill preview");
    }

    const png = await toPng(target, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });

    const base64Image = png.replace(/^data:image\/png;base64,/, "");

    await ThermalPrinter.printImage({
      ...connectionParams(config),
      printerDpi: 203,
      printerWidthMM: config.paperWidth === 58 ? 48 : 72,
      base64Image,
      timeoutSeconds: config.timeoutSeconds,
      cutPaper: config.cutPaper,
      openCashDrawer: false, // Pre-bill never opens cash drawer
    });

    return { success: true };
  } finally {
    root.unmount();
    container.remove();
  }
}

async function printPreBillCapacitor(data: PreBillReceiptData): Promise<{ success: boolean; error?: string }> {
  const config = getReceiptMobileConfig();
  if (!config || (!config.host && config.connectionType !== "bluetooth")) {
    return { success: false, error: "No receipt printer configured" };
  }

  // Try raw ESC/POS text first (sharper, faster)
  try {
    const result = await printPreBillCapacitorRaw(data, config);
    if (result.success) return result;
    console.error("Pre-bill raw ESC/POS failed:", result.error, "— falling back to image");
  } catch (err) {
    console.error("Pre-bill raw ESC/POS threw:", err, "— falling back to image");
  }

  // Fall back to image print
  try {
    return await printPreBillCapacitorImage(data, config);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Pre-bill mobile print failed",
    };
  }
}

// --- Web/browser printing ---

async function printPreBillWeb(data: PreBillReceiptData): Promise<void> {
  const { printReceipt } = await import("@/lib/print-receipt");
  const html = generatePreBillHtml(data);
  await printReceipt(html);
}

// --- Main entry point ---

export async function printPreBill(data: PreBillReceiptData): Promise<void> {
  // Electron desktop
  if (isElectronEnvironment()) {
    const result = await printPreBillElectron(data);
    if (!result.success) {
      // Fallback to browser print
      console.error("Electron pre-bill print failed:", result.error, "— falling back to browser print");
      await printPreBillWeb(data);
    }
    return;
  }

  // Capacitor mobile
  if (isCapacitorEnvironment()) {
    const result = await printPreBillCapacitor(data);
    if (!result.success) {
      console.error("Capacitor pre-bill print failed:", result.error, "— falling back to browser print");
      await printPreBillWeb(data);
    }
    return;
  }

  // Web fallback
  await printPreBillWeb(data);
}
