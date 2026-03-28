"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { PosReceipt, type ReceiptData } from "@/components/pos/receipt";

const MOBILE_PRINTER_CONFIG_KEY = "bizarch.mobilePrinterConfig.v1";

export interface MobilePrinterConfig {
  connectionType: "tcp";
  host: string;
  port: number;
  paperWidth: 58 | 80;
  timeoutSeconds: number;
  cutPaper: boolean;
  openCashDrawer: boolean;
  receiptMarginLeft: number;
  receiptMarginRight: number;
}

interface ThermalPrinterPlugin {
  printImage(options: {
    host: string;
    port: number;
    printerDpi?: number;
    printerWidthMM?: number;
    base64Image: string;
    qrCodeText?: string;
    timeoutSeconds?: number;
    cutPaper?: boolean;
    openCashDrawer?: boolean;
  }): Promise<{ success: boolean }>;
  testConnection(options: {
    host: string;
    port: number;
    timeoutSeconds?: number;
  }): Promise<{ connected: boolean; message: string }>;
  openCashDrawer(options: {
    host: string;
    port: number;
    timeoutSeconds?: number;
  }): Promise<{ success: boolean } | void>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>("ThermalPrinter");

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

  return {
    connectionType: "tcp",
    host: String(config?.host ?? defaults.host).trim(),
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : defaults.port,
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

function requireConfiguredHost(
  config?: Partial<MobilePrinterConfig>
): MobilePrinterConfig {
  const resolved = normalizeConfig(config ?? getMobilePrinterConfig());
  if (!resolved.host) {
    throw new Error("No mobile printer host configured");
  }
  return resolved;
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

export async function capacitorPrintWithConfig(
  data: ReceiptData,
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredHost(config);
    const base64Image = await renderReceiptToBase64Image(data, resolved);

    await ThermalPrinter.printImage({
      host: resolved.host,
      port: resolved.port,
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
    const resolved = requireConfiguredHost(config);

    const { buildReceiptBitmap } = await import("@/lib/receipt-bitmap-layout");
    const builder = await buildReceiptBitmap(data, {
      paperWidth: resolved.paperWidth,
      marginLeft: resolved.receiptMarginLeft,
      marginRight: resolved.receiptMarginRight,
    });

    const pngDataUrl = builder.toPngDataUrl();
    const base64Image = pngDataUrl.replace(/^data:image\/png;base64,/, "");

    await ThermalPrinter.printImage({
      host: resolved.host,
      port: resolved.port,
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

export async function testMobilePrinterConnection(
  config?: Partial<MobilePrinterConfig>
): Promise<{ success: boolean; connected?: boolean; error?: string }> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = requireConfiguredHost(config);
    const result = await ThermalPrinter.testConnection({
      host: resolved.host,
      port: resolved.port,
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
    const resolved = requireConfiguredHost(config);
    await ThermalPrinter.openCashDrawer({
      host: resolved.host,
      port: resolved.port,
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
