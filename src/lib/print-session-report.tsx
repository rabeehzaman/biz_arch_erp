import { Capacitor, registerPlugin } from "@capacitor/core";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { toPng } from "html-to-image";
import {
  getDefaultMobilePrinterConfig,
  getMobilePrinterConfig,
  isCapacitorEnvironment,
  type MobilePrinterConfig,
} from "@/lib/capacitor-print";
import { isElectronEnvironment } from "@/lib/electron-print";
import { printReceipt as browserPrintReceipt } from "@/lib/print-receipt";
import {
  POSSessionReportReceipt,
  type SessionReportCompanyInfo,
  type SessionReportData,
  type SessionReportLanguage,
} from "@/components/pos/session-report-receipt";

interface ThermalPrinterPlugin {
  printImage(options: {
    host: string;
    port: number;
    printerDpi?: number;
    printerWidthMM?: number;
    base64Image: string;
    timeoutSeconds?: number;
    cutPaper?: boolean;
    openCashDrawer?: boolean;
  }): Promise<{ success: boolean }>;
}

const ThermalPrinter = registerPlugin<ThermalPrinterPlugin>("ThermalPrinter");

type PrintResult = { success: boolean; error?: string };

type PrintInput = {
  report: SessionReportData;
  company?: SessionReportCompanyInfo | null;
  language: SessionReportLanguage;
};

const DEFAULT_MARGIN_LEFT = 3;
const DEFAULT_MARGIN_RIGHT = 5;

async function resolveElectronPrinterConfig(
  config?: Partial<ElectronPrinterConfig>
): Promise<Partial<ElectronPrinterConfig> | undefined> {
  if (config?.connectionType) {
    return config;
  }

  if (!window.electronPOS?.getPrinterConfig) {
    return config;
  }

  try {
    const result = await window.electronPOS.getPrinterConfig();
    if (result.success) {
      return result.config;
    }
  } catch {
    // Fall through to the provided config/default path.
  }

  return config;
}

function wrapThermalHtml({
  markup,
  marginLeft,
  marginRight,
  width,
}: {
  markup: string;
  marginLeft: number;
  marginRight: number;
  width: number;
}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {
    size: ${width}mm 297mm;
    margin: 0;
  }
  * {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    width: ${width}mm;
    padding: 0 ${marginRight}mm 0 ${marginLeft}mm;
    font-family: 'Arial', 'Noto Sans Arabic', sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: geometricPrecision;
  }
  img {
    max-width: 100%;
  }
</style>
</head>
<body>${markup}</body>
</html>`;
}

function generateSessionReportHtml(
  input: PrintInput,
  options?: {
    marginLeft?: number;
    marginRight?: number;
    width?: number;
  }
) {
  const markup = renderToStaticMarkup(
    createElement(POSSessionReportReceipt, {
      report: input.report,
      company: input.company ?? undefined,
      language: input.language,
    })
  );

  return wrapThermalHtml({
    markup,
    marginLeft: options?.marginLeft ?? DEFAULT_MARGIN_LEFT,
    marginRight: options?.marginRight ?? DEFAULT_MARGIN_RIGHT,
    width: options?.width ?? 80,
  });
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

function stripPngPrefix(dataUrl: string) {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

async function renderSessionReportToBase64Image(
  input: PrintInput,
  config: MobilePrinterConfig
): Promise<string> {
  const container = document.createElement("div");

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
          width: `${config.paperWidth === 58 ? 58 : 80}mm`,
          padding: `0 ${config.receiptMarginRight}mm 0 ${config.receiptMarginLeft}mm`,
          background: "#ffffff",
        }}
      >
        <POSSessionReportReceipt
          report={input.report}
          company={input.company ?? undefined}
          language={input.language}
        />
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
      throw new Error("Failed to render the session report preview");
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

async function printSessionReportWithElectron(
  input: PrintInput,
  config?: Partial<ElectronPrinterConfig>
): Promise<PrintResult> {
  if (!window.electronPOS) {
    return { success: false, error: "Electron POS bridge not available" };
  }

  try {
    const resolvedConfig = await resolveElectronPrinterConfig(config);
    const html = generateSessionReportHtml(input, {
      marginLeft: resolvedConfig?.receiptMarginLeft,
      marginRight: resolvedConfig?.receiptMarginRight,
    });

    const useStyledDriver = resolvedConfig?.connectionType === "windows"
      && resolvedConfig?.receiptRenderMode !== "htmlRaster";

    if (useStyledDriver && window.electronPOS.printStyledReceipt) {
      return window.electronPOS.printStyledReceipt(html, resolvedConfig);
    }

    if (window.electronPOS.printRasterizedReceipt) {
      return window.electronPOS.printRasterizedReceipt(html, {
        ...resolvedConfig,
        receiptRenderMode: "htmlRaster",
      });
    }

    if (window.electronPOS.printStyledReceipt) {
      return window.electronPOS.printStyledReceipt(html, resolvedConfig);
    }

    browserPrintReceipt(html);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Session report print failed",
    };
  }
}

async function printSessionReportWithCapacitor(
  input: PrintInput,
  config?: Partial<MobilePrinterConfig>
): Promise<PrintResult> {
  if (!isCapacitorEnvironment()) {
    return { success: false, error: "Capacitor mobile bridge not available" };
  }

  try {
    const resolved = {
      ...(getMobilePrinterConfig() ?? getDefaultMobilePrinterConfig()),
      ...(config ?? {}),
    };

    if (!resolved.host) {
      throw new Error("No mobile printer host configured");
    }

    const base64Image = await renderSessionReportToBase64Image(
      input,
      resolved
    );

    await ThermalPrinter.printImage({
      host: resolved.host,
      port: resolved.port,
      printerDpi: 203,
      printerWidthMM: resolved.paperWidth === 58 ? 48 : 72,
      base64Image,
      timeoutSeconds: resolved.timeoutSeconds,
      cutPaper: resolved.cutPaper,
      openCashDrawer: false,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Session report print failed",
    };
  }
}

export async function printPOSSessionReport(input: PrintInput): Promise<PrintResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Printing requires a browser environment" };
  }

  if (isElectronEnvironment()) {
    const result = await printSessionReportWithElectron(input);
    if (!result.success) {
      try {
        browserPrintReceipt(generateSessionReportHtml(input));
        return { success: true };
      } catch {
        return result;
      }
    }
    return result;
  }

  if (isCapacitorEnvironment() && Capacitor.isNativePlatform()) {
    const result = await printSessionReportWithCapacitor(input);
    if (!result.success) {
      try {
        browserPrintReceipt(generateSessionReportHtml(input));
        return { success: true };
      } catch {
        return result;
      }
    }
    return result;
  }

  try {
    browserPrintReceipt(generateSessionReportHtml(input));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Session report print failed",
    };
  }
}
