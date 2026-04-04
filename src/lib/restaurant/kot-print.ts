"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KOTReceipt, type KOTReceiptData } from "@/components/restaurant/kot-receipt";
import { isElectronEnvironment } from "@/lib/electron-print";
import { isCapacitorEnvironment, type MobilePrinterConfig } from "@/lib/capacitor-print";

export type { KOTReceiptData } from "@/components/restaurant/kot-receipt";

// --- Multi-printer station types ---

/** A single KOT printer station (e.g., "Hot Kitchen", "Bar") */
export interface KOTPrinterStation {
  id: string;
  name: string;
  categoryIds: string[];
  isDefault: boolean;
  mobileConfig: MobilePrinterConfig | null;
  electronConfig: ElectronPrinterConfig | null;
}

/** Multi-printer config stored in localStorage */
export interface KOTMultiPrinterConfig {
  version: 2;
  stations: KOTPrinterStation[];
}

// --- Config keys (separate from receipt printer) ---

const KOT_ELECTRON_CONFIG_KEY = "kot-printer-config";
const KOT_MOBILE_CONFIG_KEY = "bizarch.kotPrinterConfig.v1";
const KOT_MULTI_CONFIG_KEY = "bizarch.kotMultiPrinterConfig.v2";

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

// --- Multi-printer config helpers ---

export function getKotMultiPrinterConfig(): KOTMultiPrinterConfig | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(KOT_MULTI_CONFIG_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as KOTMultiPrinterConfig;
    } catch {
      // fall through
    }
  }

  // Auto-migrate from single-printer config
  return migrateToMultiPrinterConfig();
}

export function saveKotMultiPrinterConfig(config: KOTMultiPrinterConfig): void {
  if (!isBrowser()) return;
  localStorage.setItem(KOT_MULTI_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Migrate old single-printer config into a one-station multi config.
 * Returns null if no old config exists.
 */
function migrateToMultiPrinterConfig(): KOTMultiPrinterConfig | null {
  const mobileConfig = getKotMobilePrinterConfig() ?? getReceiptMobilePrinterConfig();
  const electronConfig = getKotElectronConfig();

  if (!mobileConfig && !electronConfig) return null;

  const config: KOTMultiPrinterConfig = {
    version: 2,
    stations: [{
      id: generateStationId(),
      name: "Kitchen",
      categoryIds: [],
      isDefault: true,
      mobileConfig: mobileConfig ?? null,
      electronConfig: electronConfig ?? null,
    }],
  };

  saveKotMultiPrinterConfig(config);
  return config;
}

function generateStationId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

  // ESC/POS text mode: KOT has a dedicated ESC/POS text formatter (kot-escpos.ts)
  // but Electron lacks a printRawBuffer IPC bridge — rasterize the HTML instead.
  // Raw ESC/POS is used on Capacitor/Android for faster, sharper output.
  return window.electronPOS.printRasterizedReceipt(html, config);
}

// --- Capacitor printing ---

/**
 * Raw ESC/POS text path — sharper, faster output on thermal printers.
 */
async function printKotCapacitorRaw(
  data: KOTReceiptData,
  config: MobilePrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  const { buildKotEscPos } = await import("@/lib/restaurant/kot-escpos");
  const { ThermalPrinter } = await import("@/lib/capacitor-print");

  const paperWidth = config.paperWidth === 58 ? 32 : 48;
  const escposBytes = buildKotEscPos(data, {
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
    host: config.host,
    port: config.port,
    data: base64Data,
    timeoutSeconds: config.timeoutSeconds,
  });

  return { success: true };
}

/**
 * Image-based fallback — renders KOT as PNG then sends as ESC/POS image.
 */
async function printKotCapacitorImage(
  data: KOTReceiptData,
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
}

async function printKotCapacitor(data: KOTReceiptData): Promise<{ success: boolean; error?: string }> {
  const config = getKotMobilePrinterConfig()
    ?? getReceiptMobilePrinterConfig()
    ?? getDefaultKotMobileConfig();

  if (!config.host) {
    return { success: false, error: "No KOT printer host configured" };
  }

  // Try raw ESC/POS text first (sharper, faster)
  try {
    const result = await printKotCapacitorRaw(data, config);
    if (result.success) return result;
    console.error("KOT raw ESC/POS failed:", result.error, "— falling back to image");
  } catch (err) {
    console.error("KOT raw ESC/POS threw:", err, "— falling back to image");
  }

  // Fall back to image print
  try {
    return await printKotCapacitorImage(data, config);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "KOT mobile print failed",
    };
  }
}

// --- Per-station printing (used by multi-printer routing) ---

/**
 * Print a KOT to a specific Electron printer using explicit config.
 */
async function printKotElectronWithConfig(
  data: KOTReceiptData,
  config: ElectronPrinterConfig,
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }

  const renderMode = config.receiptRenderMode
    ?? (config.connectionType === "windows" ? "htmlDriver" : "escposText");

  const html = generateKotHtml(data);

  if (renderMode === "htmlDriver") {
    return window.electronPOS.printStyledReceipt(html, config);
  }

  return window.electronPOS.printRasterizedReceipt(html, config);
}

/**
 * Print a KOT to a specific printer station, auto-detecting platform.
 */
async function printKotToStation(
  data: KOTReceiptData,
  station: KOTPrinterStation,
): Promise<{ success: boolean; error?: string }> {
  if (isElectronEnvironment()) {
    if (!station.electronConfig) {
      return { success: false, error: `No Electron config for station "${station.name}"` };
    }
    return printKotElectronWithConfig(data, station.electronConfig);
  }

  if (isCapacitorEnvironment()) {
    const config = station.mobileConfig;
    if (!config?.host) {
      return { success: false, error: `No mobile config for station "${station.name}"` };
    }

    // Try raw ESC/POS text first, fall back to image
    try {
      const result = await printKotCapacitorRaw(data, config);
      if (result.success) return result;
      console.error(`KOT raw ESC/POS to "${station.name}" failed:`, result.error);
    } catch (err) {
      console.error(`KOT raw ESC/POS to "${station.name}" threw:`, err);
    }

    try {
      return await printKotCapacitorImage(data, config);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : `Print to "${station.name}" failed`,
      };
    }
  }

  // Web fallback — can't route to specific printers
  return printKotWeb(data);
}

// --- Multi-printer routing ---

/**
 * Print a KOT with multi-printer routing by category.
 * Items are grouped by their category→station mapping and printed separately.
 * Falls back to single-printer printKOT if no multi-config or only one default station.
 */
export async function printKOTMulti(
  data: KOTReceiptData,
): Promise<{ success: boolean; errors: string[] }> {
  const multiConfig = getKotMultiPrinterConfig();

  // No multi config or single default with no category assignments → use simple path
  if (
    !multiConfig ||
    multiConfig.stations.length === 0 ||
    (multiConfig.stations.length === 1 &&
      multiConfig.stations[0].isDefault &&
      multiConfig.stations[0].categoryIds.length === 0)
  ) {
    const result = await printKOT(data);
    return { success: result.success, errors: result.error ? [result.error] : [] };
  }

  const stations = multiConfig.stations;

  // Build category→station lookup
  const categoryToStation = new Map<string, KOTPrinterStation>();
  let defaultStation: KOTPrinterStation | null = null;

  for (const station of stations) {
    if (station.isDefault) defaultStation = station;
    for (const catId of station.categoryIds) {
      categoryToStation.set(catId, station);
    }
  }

  // If no explicit default, use first station
  if (!defaultStation) defaultStation = stations[0];

  // Group items by station
  const stationItems = new Map<string, KOTReceiptData["items"]>();

  for (const item of data.items) {
    const station = (item.categoryId && categoryToStation.get(item.categoryId)) || defaultStation;
    const existing = stationItems.get(station.id) ?? [];
    existing.push(item);
    stationItems.set(station.id, existing);
  }

  // Print to each station that has items
  const errors: string[] = [];
  let anySuccess = false;

  const printJobs = Array.from(stationItems.entries()).map(async ([stationId, items]) => {
    const station = stations.find(s => s.id === stationId);
    if (!station) return;

    const stationData: KOTReceiptData = {
      ...data,
      items,
      stationName: stations.length > 1 ? station.name : undefined,
    };

    try {
      const result = await printKotToStation(stationData, station);
      if (result.success) {
        anySuccess = true;
      } else if (result.error) {
        errors.push(`${station.name}: ${result.error}`);
      }
    } catch (err) {
      errors.push(`${station.name}: ${err instanceof Error ? err.message : "Print failed"}`);
    }
  });

  await Promise.all(printJobs);

  return { success: anySuccess || errors.length === 0, errors };
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
export { generateKotHtml, generateStationId };
