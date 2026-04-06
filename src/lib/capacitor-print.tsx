"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { PosReceipt, type ReceiptData } from "@/components/pos/receipt";

const MOBILE_PRINTER_CONFIG_KEY = "bizarch.mobilePrinterConfig.v1";
const SECONDARY_PRINTER_CONFIG_KEY = "bizarch.mobilePrinterConfig.secondary.v1";

export interface MobilePrinterConfig {
  connectionType: "tcp" | "bluetooth";
  host: string;
  port: number;
  address?: string;       // Bluetooth MAC address
  deviceName?: string;    // Bluetooth device display name
  paperWidth: 58 | 80;
  timeoutSeconds: number;
  cutPaper: boolean;
  openCashDrawer: boolean;
  receiptMarginLeft: number;
  receiptMarginRight: number;
}

interface BluetoothDevice {
  name: string;
  address: string;
  isPrinter: boolean;
}

interface ConnectionTarget {
  connectionType?: "tcp" | "bluetooth";
  host?: string;
  port?: number;
  address?: string;  // BT MAC address
}

interface ThermalPrinterPlugin {
  printImage(options: ConnectionTarget & {
    printerDpi?: number;
    printerWidthMM?: number;
    base64Image: string;
    qrCodeText?: string;
    timeoutSeconds?: number;
    cutPaper?: boolean;
    openCashDrawer?: boolean;
  }): Promise<{ success: boolean }>;
  printRaw(options: ConnectionTarget & {
    data: string;
    timeoutSeconds?: number;
  }): Promise<{ success: boolean; bytesSent: number }>;
  testConnection(options: ConnectionTarget & {
    timeoutSeconds?: number;
  }): Promise<{ connected: boolean; message: string }>;
  openCashDrawer(options: ConnectionTarget & {
    timeoutSeconds?: number;
  }): Promise<{ success: boolean } | void>;
  listBluetoothDevices(): Promise<{ devices: BluetoothDevice[] }>;
}

export const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>("ThermalPrinter");

export function getDefaultMobilePrinterConfig(): MobilePrinterConfig {
  return {
    connectionType: "tcp",
    host: "",
    port: 9100,
    paperWidth: 80,
    timeoutSeconds: 10,
    cutPaper: true,
    openCashDrawer: false,
    receiptMarginLeft: 3,
    receiptMarginRight: 5,
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isCapacitorEnvironment(): boolean {
  return isBrowser()
    && Capacitor.isNativePlatform()
    && Capacitor.getPlatform() === "android";
}

function normalizePaperWidth(width?: number): 58 | 80 {
  return width === 58 ? 58 : 80;
}

function normalizeConfig(
  config?: Partial<MobilePrinterConfig> | null
): MobilePrinterConfig {
  const defaults = getDefaultMobilePrinterConfig();
  const parsedPort = Number(config?.port);
  const parsedTimeout = Number(config?.timeoutSeconds);
  const parsedLeftMargin = Number(config?.receiptMarginLeft);
  const parsedRightMargin = Number(config?.receiptMarginRight);

  const connType = config?.connectionType === "bluetooth" ? "bluetooth" : "tcp";

  return {
    connectionType: connType,
    host: String(config?.host ?? defaults.host).trim(),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : defaults.port,
    address: config?.address?.trim() || undefined,
    deviceName: config?.deviceName?.trim() || undefined,
    paperWidth: normalizePaperWidth(config?.paperWidth),
    timeoutSeconds: Number.isFinite(parsedTimeout) && parsedTimeout > 0
      ? parsedTimeout
      : defaults.timeoutSeconds,
    cutPaper: config?.cutPaper ?? defaults.cutPaper,
    openCashDrawer: config?.openCashDrawer ?? defaults.openCashDrawer,
    receiptMarginLeft: Number.isFinite(parsedLeftMargin) ? parsedLeftMargin : defaults.receiptMarginLeft,
    receiptMarginRight: Number.isFinite(parsedRightMargin) ? parsedRightMargin : defaults.receiptMarginRight,
  };
}

export function getMobilePrinterConfig(): MobilePrinterConfig | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.localStorage.getItem(MOBILE_PRINTER_CONFIG_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeConfig(JSON.parse(raw) as Partial<MobilePrinterConfig>);
  } catch {
    return null;
  }
}

export function saveMobilePrinterConfig(
  config: Partial<MobilePrinterConfig>
): MobilePrinterConfig {
  if (!isBrowser()) {
    return normalizeConfig(config);
  }

  const normalized = normalizeConfig(config);
  window.localStorage.setItem(
    MOBILE_PRINTER_CONFIG_KEY,
    JSON.stringify(normalized)
  );
  return normalized;
}

// --- Secondary receipt printer (duplicate receipt to a second printer) ---

export function getSecondaryMobilePrinterConfig(): MobilePrinterConfig | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(SECONDARY_PRINTER_CONFIG_KEY);
  if (!raw) return null;
  try {
    return normalizeConfig(JSON.parse(raw) as Partial<MobilePrinterConfig>);
  } catch {
    return null;
  }
}

export function saveSecondaryMobilePrinterConfig(
  config: Partial<MobilePrinterConfig> | null,
): void {
  if (!isBrowser()) return;
  if (!config) {
    window.localStorage.removeItem(SECONDARY_PRINTER_CONFIG_KEY);
    return;
  }
  window.localStorage.setItem(
    SECONDARY_PRINTER_CONFIG_KEY,
    JSON.stringify(normalizeConfig(config)),
  );
}

function requireConfiguredPrinter(
  config?: Partial<MobilePrinterConfig>
): MobilePrinterConfig {
  const resolved = normalizeConfig(config ?? getMobilePrinterConfig());
  if (resolved.connectionType === "bluetooth") {
    if (!resolved.address) {
      throw new Error("No Bluetooth printer address configured");
    }
  } else {
    if (!resolved.host) {
      throw new Error("No mobile printer host configured");
    }
  }
  return resolved;
}

/** Build the connection target params from config */
function connectionParams(config: MobilePrinterConfig): ConnectionTarget {
  if (config.connectionType === "bluetooth") {
    return { connectionType: "bluetooth", address: config.address };
  }
  return { connectionType: "tcp", host: config.host, port: config.port };
}

function stripPngPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })
  );
}

async function renderReceiptToBase64Image(
  data: ReceiptData,
  config: MobilePrinterConfig
): Promise<string> {
  if (!isBrowser()) {
    throw new Error("Receipt image rendering requires a browser environment");
  }

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
      <div
        style={{
          width,
          padding: `0 ${config.receiptMarginRight}mm 0 ${config.receiptMarginLeft}mm`,
          background: "#ffffff",
        }}
      >
        <PosReceipt data={data} />
      </div>
    );

    await waitForPaint();

    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    await waitForImages(container);
    await waitForPaint();

    const target = container.firstElementChild;
    if (!(target instanceof HTMLElement)) {
      throw new Error("Failed to render the receipt preview");
    }

    const png = await toPng(target, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });

    return stripPngPrefix(png);
  } finally {
    root.unmount();
    container.remove();
  }
}

/**
 * Render a React element to a base64 PNG image for thermal printing.
 * Used by both POS receipt and invoice receipt paths.
 */
export async function renderReactToBase64Image(
  element: React.ReactElement,
  config: { paperWidth: 58 | 80; receiptMarginLeft: number; receiptMarginRight: number }
): Promise<string> {
  if (!isBrowser()) {
    throw new Error("Receipt image rendering requires a browser environment");
  }

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
      <div
        style={{
          width,
          padding: `0 ${config.receiptMarginRight}mm 0 ${config.receiptMarginLeft}mm`,
          background: "#ffffff",
        }}
      >
        {element}
      </div>
    );

    await waitForPaint();
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }
    await waitForImages(container);
    await waitForPaint();

    const target = container.firstElementChild;
    if (!(target instanceof HTMLElement)) {
      throw new Error("Failed to render the receipt preview");
    }

    const png = await toPng(target, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });

    return stripPngPrefix(png);
  } finally {
    root.unmount();
    container.remove();
  }
}

/**
 * Print a pre-rendered base64 image to the configured thermal printer.
 */
export async function capacitorPrintBase64Image(
  base64Image: string,
  config?: Partial<MobilePrinterConfig>,
  options?: { qrCodeText?: string },
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }
  try {
    const resolved = requireConfiguredPrinter(config);
    await ThermalPrinter.printImage({
      ...connectionParams(resolved),
      printerDpi: 203,
      printerWidthMM: resolved.paperWidth === 58 ? 48 : 72,
      base64Image,
      qrCodeText: options?.qrCodeText,
      timeoutSeconds: resolved.timeoutSeconds,
      cutPaper: resolved.cutPaper,
      openCashDrawer: resolved.openCashDrawer,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Print failed",
    };
  }
}

export async function capacitorPrintWithConfig(
  data: ReceiptData,
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredPrinter(config);
    const base64Image = await renderReceiptToBase64Image(data, resolved);

    await ThermalPrinter.printImage({
      ...connectionParams(resolved),
      printerDpi: 203,
      printerWidthMM: resolved.paperWidth === 58 ? 48 : 72,
      base64Image,
      timeoutSeconds: resolved.timeoutSeconds,
      cutPaper: resolved.cutPaper,
      openCashDrawer: resolved.openCashDrawer,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Mobile print failed",
    };
  }
}

/**
 * Print via the canvas-based bitmap method (better Arabic text quality).
 * Uses ReceiptBitmapBuilder to draw the receipt on a Canvas, then sends
 * the PNG to the native plugin along with the QR code text for native QR generation.
 */
export async function capacitorBitmapPrintWithConfig(
  data: ReceiptData,
  config?: Partial<MobilePrinterConfig>,
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredPrinter(config);

    const { buildReceiptBitmap } = await import("@/lib/receipt-bitmap-layout");
    const builder = await buildReceiptBitmap(data, {
      paperWidth: resolved.paperWidth,
      marginLeft: resolved.receiptMarginLeft,
      marginRight: resolved.receiptMarginRight,
    });

    const pngDataUrl = builder.toPngDataUrl();
    const base64Image = pngDataUrl.replace(/^data:image\/png;base64,/, "");

    await ThermalPrinter.printImage({
      ...connectionParams(resolved),
      printerDpi: 203,
      printerWidthMM: resolved.paperWidth === 58 ? 48 : 72,
      base64Image,
      qrCodeText: data.qrCodeText ?? undefined,
      timeoutSeconds: resolved.timeoutSeconds,
      cutPaper: resolved.cutPaper,
      openCashDrawer: resolved.openCashDrawer,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Bitmap canvas mobile print failed",
    };
  }
}

/**
 * Print an Indian GST receipt using raw ESC/POS text commands.
 * Builds the receipt buffer in JS (portable, no Node.js dependency)
 * and sends raw bytes to the printer via the native printRaw() bridge.
 */
export async function capacitorRawPrintWithConfig(
  data: ReceiptData,
  config?: Partial<MobilePrinterConfig>,
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredPrinter(config);

    const { buildIndianGSTReceiptEscPos } = await import("@/lib/indian-receipt-escpos");

    const paperWidth = resolved.paperWidth === 58 ? 32 : 48;
    const escposBytes = buildIndianGSTReceiptEscPos(data, {
      paperWidth: paperWidth as 48 | 32,
      cutPaper: resolved.cutPaper,
      openDrawer: resolved.openCashDrawer,
    });

    // Convert Uint8Array to base64 for Capacitor bridge
    let binary = "";
    for (let i = 0; i < escposBytes.length; i++) {
      binary += String.fromCharCode(escposBytes[i]);
    }
    const base64Data = btoa(binary);

    await ThermalPrinter.printRaw({
      ...connectionParams(resolved),
      data: base64Data,
      timeoutSeconds: resolved.timeoutSeconds,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Raw ESC/POS print failed",
    };
  }
}

export async function testMobilePrinterConnection(
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; connected?: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredPrinter(config);
    const result = await ThermalPrinter.testConnection({
      ...connectionParams(resolved),
      timeoutSeconds: resolved.timeoutSeconds,
    });

    return {
      success: true,
      connected: result.connected,
      error: result.connected ? undefined : result.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}

export async function openMobileCashDrawer(
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredPrinter(config);
    await ThermalPrinter.openCashDrawer({
      ...connectionParams(resolved),
      timeoutSeconds: resolved.timeoutSeconds,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to open cash drawer",
    };
  }
}

export type { BluetoothDevice };

export async function listBluetoothDevices(): Promise<{
  success: boolean;
  devices?: BluetoothDevice[];
  error?: string;
}> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }
  try {
    const result = await ThermalPrinter.listBluetoothDevices();
    return { success: true, devices: result.devices };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list Bluetooth devices",
    };
  }
}
