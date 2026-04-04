"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KOTReceipt, type KOTReceiptData } from "@/components/restaurant/kot-receipt";
import { isElectronEnvironment } from "@/lib/electron-print";
import { isCapacitorEnvironment, type MobilePrinterConfig } from "@/lib/capacitor-print";

export type { KOTReceiptData } from "@/components/restaurant/kot-receipt";

// --- Config keys (separate from receipt printer) ---

const KOT_ELECTRON_CONFIG_KEY = "kot-printer-config";
const KOT_MOBILE_CONFIG_KEY = "bizarch.kotPrinterConfig.v1";

// Reuse the receipt printer mobile config key as fallback
const RECEIPT_MOBILE_CONFIG_KEY = "bizarch.mobilePrinterConfig.v1";

// --- Mobile config helpers ---

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getDefaultKotMobileConfig(): MobilePrinterConfig {
  return {
    connectionType: "tcp",
    host: "",
    port: 9100,
    paperWidth: 80,
    timeoutSeconds: 10,
    cutPaper: true,
    openCashDrawer: false,
    receiptMarginLeft: 2,
    receiptMarginRight: 2,
  };
}

export function getKotMobilePrinterConfig(): MobilePrinterConfig | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(KOT_MOBILE_CONFIG_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MobilePrinterConfig;
  } catch {
    return null;
  }
}

export function saveKotMobilePrinterConfig(config: MobilePrinterConfig): void {
  if (!isBrowser()) return;
  localStorage.setItem(KOT_MOBILE_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Fallback: read the receipt printer mobile config if KOT-specific one is not set.
 */
function getReceiptMobilePrinterConfig(): MobilePrinterConfig | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(RECEIPT_MOBILE_CONFIG_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as MobilePrinterConfig;
  } catch {
    return null;
  }
}

// --- KOT HTML generation ---

function generateKotHtml(data: KOTReceiptData): string {
  const markup = renderToStaticMarkup(createElement(KOTReceipt, { data }));

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
    padding: 0 2mm;
    font-family: 'Courier New', 'Courier', monospace;
    font-size: 14px;
    text-rendering: geometricPrecision;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow: visible;
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

// --- Electron KOT config helpers ---

async function getElectronKotConfig(): Promise<Partial<ElectronPrinterConfig> | undefined> {
  if (!window.electronPOS) return undefined;

  // Try KOT-specific config first
  try {
    const raw = localStorage.getItem(KOT_ELECTRON_CONFIG_KEY);
    if (raw) {
      const config = JSON.parse(raw) as Partial<ElectronPrinterConfig>;
      if (config.connectionType) return config;
    }
  } catch {
    // fall through
  }

  // Fall back to default receipt printer config
  try {
    const result = await window.electronPOS.getPrinterConfig();
    if (result.success && result.config) {
      return result.config;
    }
  } catch {
    // fall through
  }

  return undefined;
}

export function saveKotElectronConfig(config: ElectronPrinterConfig): void {
  if (!isBrowser()) return;
  localStorage.setItem(KOT_ELECTRON_CONFIG_KEY, JSON.stringify(config));
}

export function getKotElectronConfig(): ElectronPrinterConfig | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(KOT_ELECTRON_CONFIG_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ElectronPrinterConfig;
  } catch {
    return null;
  }
}

// --- Electron printing ---

async function printKotElectron(data: KOTReceiptData): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }

  const config = await getElectronKotConfig();
  const renderMode = config?.receiptRenderMode
    ?? (config?.connectionType === "windows" ? "htmlDriver" : "escposText");

  const html = generateKotHtml(data);

  if (renderMode === "htmlDriver") {
    return window.electronPOS.printStyledReceipt(html, config);
  }

  if (renderMode === "htmlRaster") {
    return window.electronPOS.printRasterizedReceipt(html, config);
  }

  // ESC/POS text mode: still use HTML rasterized since KOT doesn't have
  // a dedicated ESC/POS text formatter — rasterize the HTML instead
  return window.electronPOS.printRasterizedReceipt(html, config);
}

// --- Capacitor printing ---

async function printKotCapacitor(data: KOTReceiptData): Promise<{ success: boolean; error?: string }> {
  const config = getKotMobilePrinterConfig()
    ?? getReceiptMobilePrinterConfig()
    ?? getDefaultKotMobileConfig();

  if (!config.host) {
    return { success: false, error: "No KOT printer host configured" };
  }

  try {
    // Dynamically import to avoid issues in non-Capacitor environments
    const { Capacitor } = await import("@capacitor/core");
    const { createRoot } = await import("react-dom/client");
    const { toPng } = await import("html-to-image");
    const { ThermalPrinter } = await import("@/lib/capacitor-print");

    // Render KOT receipt to image
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
        }, createElement(KOTReceipt, { data }))
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
        throw new Error("Failed to render KOT preview");
      }

      const png = await toPng(target, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2,
      });

      const base64Image = png.replace(/^data:image\/png;base64,/, "");

      await ThermalPrinter.printImage({
        host: config.host,
        port: config.port,
        printerDpi: 203,
        printerWidthMM: config.paperWidth === 58 ? 48 : 72,
        base64Image,
        timeoutSeconds: config.timeoutSeconds,
        cutPaper: config.cutPaper,
        openCashDrawer: false, // KOT never opens cash drawer
      });

      return { success: true };
    } finally {
      root.unmount();
      container.remove();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "KOT mobile print failed",
    };
  }
}

// --- Web fallback ---

async function printKotWeb(data: KOTReceiptData): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generateKotHtml(data);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-10000px";
    iframe.style.top = "0";
    iframe.style.width = "80mm";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      iframe.remove();
      return { success: false, error: "Failed to create print frame" };
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      setTimeout(resolve, 500);
    });

    iframe.contentWindow?.print();

    setTimeout(() => iframe.remove(), 2000);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "KOT web print failed",
    };
  }
}

// --- Main print function ---

/**
 * Print a KOT receipt. Detects the platform and uses the appropriate method:
 * - Electron: silent thermal print via IPC
 * - Capacitor: render to image and send to thermal printer
 * - Web: browser print dialog
 */
export async function printKOT(data: KOTReceiptData): Promise<{ success: boolean; error?: string }> {
  if (isElectronEnvironment()) {
    return printKotElectron(data);
  }

  if (isCapacitorEnvironment()) {
    return printKotCapacitor(data);
  }

  return printKotWeb(data);
}

/**
 * Generate the KOT HTML string (useful for previews or custom print flows).
 */
export { generateKotHtml };
