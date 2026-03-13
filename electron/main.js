// main.js — Electron main process
const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');
const PrinterService = require('./printer-service');
const ReceiptSpool = require('./receipt-spool');
const {
  getWindowsPrintJobCount,
  getWindowsPrinterTcpEndpoint,
  printRawToWindowsPrinter,
  waitForWindowsPrintQueueToDrain,
} = require('./winspool-raw');

// ─── Configuration ──────────────────────────────────────────────
const ERP_URL = process.env.ERP_URL || 'https://erp.bizarch.in';
const CONFIG_DIR = path.join(app.getPath('userData'));
const CONFIG_FILE = path.join(CONFIG_DIR, 'printer-config.json');

let mainWindow;
let splashWindow;
let loadTimeout;

const RECEIPT_WINDOW_WIDTH = 302; // ~80mm at 96dpi
const RECEIPT_RASTER_WINDOW_WIDTH = 288; // 288 × DPR 2 = 576 — matches RECEIPT_RASTER_WIDTH exactly (no resize needed)
const RECEIPT_RASTER_WIDTH = 576; // Typical 80mm printer width at 203dpi
const RECEIPT_RASTER_ZOOM = 1.15; // Scale up receipt content (text, QR, etc.) within fixed 576px width
const HTML_DRIVER_TOP_TRIM_MM = 1.5;
const HTML_DRIVER_BOTTOM_SAFE_MM = 10;
const HTML_DRIVER_MIN_HEIGHT_MICRONS = 150000;

// ─── Printer Config Persistence ─────────────────────────────────
function loadPrinterConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return PrinterService.normalizeConfig(
        JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      );
    }
  } catch (err) {
    console.error('Failed to load printer config:', err.message);
  }
  return PrinterService.normalizeConfig({});
}

function savePrinterConfig(config) {
  try {
    const normalized = PrinterService.normalizeConfig(config);
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(normalized, null, 2),
      'utf-8'
    );
    return { success: true, config: normalized };
  } catch (err) {
    console.error('Failed to save printer config:', err.message);
    return { success: false };
  }
}

// ─── Create Printer Service from Config ─────────────────────────
function createPrinterServiceFromConfig(configOverride) {
  return new PrinterService(configOverride || loadPrinterConfig());
}

function getReceiptCacheDir() {
  return path.join(CONFIG_DIR, 'receipt-cache');
}

function persistReceiptArtifact(normalized, receiptData, html, buffer, key) {
  return ReceiptSpool.saveReceiptArtifact(getReceiptCacheDir(), {
    normalizedConfig: normalized,
    renderMode: normalized.receiptRenderMode,
    receiptData,
    html,
    buffer,
    key,
  });
}

function createReceiptWindow() {
  return new BrowserWindow({
    show: false,
    width: RECEIPT_WINDOW_WIDTH,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
}

// Offscreen window for raster capture — uses CPU-based software renderer so
// capturePage() reliably returns content even though the window is never shown.
// Regular show:false windows rely on the GPU compositor which may skip hidden
// windows, causing capturePage() to return a blank 0×0 image.
function createRasterReceiptWindow() {
  return new BrowserWindow({
    show: false,
    width: RECEIPT_RASTER_WINDOW_WIDTH,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true, offscreen: true, deviceScaleFactor: 2 },
  });
}

async function measureReceiptContentHeight(printWin) {
  return printWin.webContents.executeJavaScript(
    `new Promise((resolve) => {
      const waitForImages = Array.from(document.images).map((img) => {
        if (img.complete) {
          return Promise.resolve();
        }
        return new Promise((done) => {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        });
      });

      const waitForFonts = document.fonts?.ready
        ? document.fonts.ready.catch(() => undefined)
        : Promise.resolve();

      Promise.all([waitForFonts, ...waitForImages]).finally(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const receipt = document.body.children[0] || document.body;
            const rectHeight = Math.ceil(receipt.getBoundingClientRect().height || 0);
            const measuredHeight = Math.max(
              rectHeight,
              receipt.scrollHeight || 0,
              receipt.offsetHeight || 0,
              document.body.scrollHeight || 0
            );
            resolve(measuredHeight);
          });
        });
      });
    })`
  );
}

async function waitForReceiptPaint(printWin) {
  await printWin.webContents.executeJavaScript(
    'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))'
  );
}

// Replace data-URL <img> elements with <canvas> in the offscreen window.
// The offscreen compositor (`offscreen: true`) can skip the image decode
// pipeline for data:image/png;base64 src attributes, leaving blank pixels
// even though the element occupies layout space.  We fetch the data URL as
// a blob and use createImageBitmap() to force a full pixel decode through
// a separate code-path that works in offscreen mode, then draw to canvas.
async function convertDataUrlImagesToCanvas(printWin) {
  await printWin.webContents.executeJavaScript(
    `(async () => {
      const imgs = Array.from(document.querySelectorAll('img[src^="data:"]'));
      for (const img of imgs) {
        try {
          const resp = await fetch(img.src);
          const blob = await resp.blob();
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          canvas.style.cssText = img.style.cssText;
          canvas.style.imageRendering = 'pixelated';
          canvas.style.display = img.style.display || 'inline-block';
          img.replaceWith(canvas);
        } catch (e) {
          // leave original img if conversion fails
        }
      }
    })()`
  );
}

async function loadReceiptWindow(html) {
  const printWin = createReceiptWindow();
  // Write HTML to a temp file to avoid ENAMETOOLONG when the receipt
  // contains large base64 images (logos, QR codes, etc.).
  const tmpDir = app.getPath('temp');
  const tmpFile = path.join(tmpDir, `bizarch-receipt-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  try {
    await printWin.loadFile(tmpFile);
  } catch (err) {
    // Clean up on load failure
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    throw err;
  }

  // Schedule temp file cleanup when the window is destroyed
  printWin.on('closed', () => {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  const contentHeightPx = await measureReceiptContentHeight(printWin);
  return { printWin, contentHeightPx };
}

async function loadRasterReceiptWindow(html) {
  const printWin = createRasterReceiptWindow();
  const tmpDir = app.getPath('temp');
  const tmpFile = path.join(tmpDir, `bizarch-receipt-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html, 'utf-8');

  try {
    await printWin.loadFile(tmpFile);
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    throw err;
  }

  printWin.on('closed', () => {
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  });

  if (RECEIPT_RASTER_ZOOM !== 1) {
    // Use Electron's native page zoom instead of CSS zoom on <html>.
    // CSS zoom can cause data-URL images (QR codes) to vanish in the
    // offscreen compositor; setZoomFactor uses Chromium's built-in zoom
    // which composites all content correctly.
    printWin.webContents.setZoomFactor(RECEIPT_RASTER_ZOOM);
    // The zoomed viewport is narrower (288/1.15 ≈ 250 CSS px), so force
    // the body to fill it instead of overflowing at its fixed 80mm width.
    await printWin.webContents.executeJavaScript(
      `document.body.style.width = '100%';`
    );
    await waitForReceiptPaint(printWin);
  }

  let contentHeightPx = await measureReceiptContentHeight(printWin);
  if (RECEIPT_RASTER_ZOOM !== 1) {
    // JS measurements (scrollHeight etc.) are in CSS pixels which don't
    // include the zoom factor.  Window/capture APIs work in DIPs, so
    // scale up to ensure the capture rect is tall enough.
    contentHeightPx = Math.ceil(contentHeightPx * RECEIPT_RASTER_ZOOM);
  }
  return { printWin, contentHeightPx };
}

async function prepareHtmlReceiptWindow(printWin) {
  const compensationStyle = `
    html, body {
      margin: 0 !important;
      padding-top: 0 !important;
    }
    body {
      padding-top: 0 !important;
      padding-bottom: ${HTML_DRIVER_BOTTOM_SAFE_MM + HTML_DRIVER_TOP_TRIM_MM}mm !important;
      overflow: hidden !important;
    }
    body > *:first-child {
      position: relative !important;
      top: -${HTML_DRIVER_TOP_TRIM_MM}mm !important;
    }
  `;

  await printWin.webContents.executeJavaScript(
    `(function () {
      const styleId = 'bizarch-html-driver-compensation';
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = ${JSON.stringify(compensationStyle)};
    })()`
  );

  await waitForReceiptPaint(printWin);

  const contentHeightPx = await measureReceiptContentHeight(printWin);
  const totalHeight = Math.max(1, Math.ceil(contentHeightPx));
  printWin.setContentSize(RECEIPT_WINDOW_WIDTH, Math.max(totalHeight, 800));
  await waitForReceiptPaint(printWin);

  return totalHeight;
}

async function captureReceiptRasterBuffers(printWin, contentHeightPx) {
  const totalHeight = Math.max(1, Math.ceil(contentHeightPx));
  printWin.setContentSize(RECEIPT_RASTER_WINDOW_WIDTH, totalHeight);
  await waitForReceiptPaint(printWin);
  // Convert data-URL images to canvas so offscreen compositor renders them
  await convertDataUrlImagesToCanvas(printWin);
  await waitForReceiptPaint(printWin);
  // Guarantee offscreen compositor buffer availability
  await new Promise((resolve) => setTimeout(resolve, 150));

  // Capture the entire receipt as a single image — no chunking.
  // This avoids white gap lines caused by per-chunk resize rounding
  // (each chunk's height must be a multiple of 24 for ESC * stripes).
  const image = await printWin.webContents.capturePage({
    x: 0,
    y: 0,
    width: RECEIPT_RASTER_WINDOW_WIDTH,
    height: totalHeight,
  });
  const resized = image.getSize().width === RECEIPT_RASTER_WIDTH
    ? image
    : image.resize({ width: RECEIPT_RASTER_WIDTH });

  return [resized.toPNG()];
}

async function printBufferWithConfig(buffer, normalized) {
  const ps = createPrinterServiceFromConfig(normalized);
  await ps.sendBuffer(buffer, 'BizArch Receipt');
  return { success: true };
}

async function buildRasterReceiptBufferFromHtml(html, normalized) {
  let printWin;

  try {
    const loaded = await loadRasterReceiptWindow(html);
    printWin = loaded.printWin;
    const imageBuffers = await captureReceiptRasterBuffers(printWin, loaded.contentHeightPx);
    const ps = createPrinterServiceFromConfig(normalized);
    const printOptions = ps.mode === 'rawUsb' ? { openDrawer: true } : {};
    const buffer = await ps.buildImageReceiptBuffer(imageBuffers, printOptions);
    return { buffer };
  } finally {
    if (printWin && !printWin.isDestroyed()) {
      printWin.destroy();
    }
  }
}

async function queueHtmlCutIfNeeded(printerName, initialQueueCount) {
  if (!printerName) {
    return;
  }

  try {
    // Wait for the HTML driver job to finish printing before sending the cut
    await waitForWindowsPrintQueueToDrain(printerName, initialQueueCount);

    const cutBuffer = Buffer.from([
      0x1B, 0x40,             // ESC @ — Initialize printer (enter ESC/POS mode)
      0x1D, 0x56, 0x42, 0x03, // GS V B 3 — Partial cut with 3-line feed
    ]);

    const tcpEndpoint = await getWindowsPrinterTcpEndpoint(printerName).catch(() => null);
    if (tcpEndpoint?.host) {
      await PrinterService.sendRawTCP(tcpEndpoint.host, tcpEndpoint.port || 9100, cutBuffer);
      return;
    }

    await printRawToWindowsPrinter(printerName, cutBuffer, 'BizArch Cut');
  } catch (cutError) {
    console.warn('HTML receipt cut command failed:', cutError.message);
  }
}

async function printStyledReceiptHtml(html, normalized) {
  const printerName = normalized.windowsPrinterName;

  const initialQueueCount = printerName
    ? await getWindowsPrintJobCount(printerName).catch(() => 0)
    : 0;

  const { printWin } = await loadReceiptWindow(html);
  const contentHeightPx = await prepareHtmlReceiptWindow(printWin);
  const measuredMicrons = Math.ceil(contentHeightPx * 25400 / 96) + 1000;
  const pageCssMm = (measuredMicrons / 1000).toFixed(2);
  const heightMicrons = Math.max(measuredMicrons, HTML_DRIVER_MIN_HEIGHT_MICRONS);

  await printWin.webContents.executeJavaScript(
    `(function(){var s=document.createElement('style');` +
    `s.textContent='@page{size:80mm ${pageCssMm}mm !important;margin:0;}';` +
    `document.head.appendChild(s);})()`
  );
  await waitForReceiptPaint(printWin);

  return await new Promise((resolve) => {
    printWin.webContents.print(
      {
        silent: true,
        deviceName: printerName || undefined,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: heightMicrons },
      },
      async (success, failureReason) => {
        printWin.destroy();

        if (success && printerName) {
          await queueHtmlCutIfNeeded(printerName, initialQueueCount);
        }

        resolve({
          success,
          error: success ? undefined : failureReason,
        });
      }
    );
  });
}

async function cacheRenderedReceiptHtml(html, receiptData, normalized, key) {
  if (normalized.receiptRenderMode === 'htmlDriver') {
    const receipt = persistReceiptArtifact(normalized, receiptData, html, null, key);
    return { success: true, key: receipt.key, cachedAt: receipt.cachedAt };
  }

  if (normalized.receiptRenderMode === 'htmlRaster') {
    const { buffer } = await buildRasterReceiptBufferFromHtml(html, normalized);
    const receipt = persistReceiptArtifact(normalized, receiptData, html, buffer, key);
    return { success: true, key: receipt.key, cachedAt: receipt.cachedAt };
  }

  return {
    success: false,
    error: 'Receipt caching is only supported for rendered HTML receipt modes',
  };
}

async function printAndCacheRenderedReceiptHtml(html, receiptData, normalized, key) {
  if (normalized.receiptRenderMode === 'htmlDriver') {
    try {
      persistReceiptArtifact(normalized, receiptData, html, null, key);
    } catch (cacheError) {
      console.warn('Failed to cache HTML driver receipt:', cacheError.message);
    }
    return printStyledReceiptHtml(html, normalized);
  }

  if (normalized.receiptRenderMode === 'htmlRaster') {
    const { buffer } = await buildRasterReceiptBufferFromHtml(html, normalized);
    try {
      persistReceiptArtifact(normalized, receiptData, html, buffer, key);
    } catch (cacheError) {
      console.warn('Failed to cache raster receipt:', cacheError.message);
    }
    return printBufferWithConfig(buffer, normalized);
  }

  return {
    success: false,
    error: 'Combined print/cache is only supported for rendered HTML receipt modes',
  };
}

async function printCachedReceiptArtifact(cacheKey, configOverride) {
  const normalized = PrinterService.normalizeConfig(configOverride || loadPrinterConfig());
  const receipt = cacheKey
    ? ReceiptSpool.loadReceiptArtifact(getReceiptCacheDir(), cacheKey)
    : ReceiptSpool.loadLatestReceiptArtifact(getReceiptCacheDir());

  if (!receipt) {
    return { success: false, error: 'No cached receipt found' };
  }

  const cachedBuffer = ReceiptSpool.readReceiptBuffer(getReceiptCacheDir(), receipt);
  if (cachedBuffer) {
    return printBufferWithConfig(cachedBuffer, normalized);
  }

  const cachedHtml = ReceiptSpool.readReceiptHtml(getReceiptCacheDir(), receipt);
  if (!cachedHtml) {
    return { success: false, error: 'Cached receipt artifact is incomplete' };
  }

  if (normalized.receiptRenderMode === 'htmlDriver' || receipt.renderMode === 'htmlDriver') {
    return printStyledReceiptHtml(cachedHtml, normalized);
  }

  return printAndCacheRenderedReceiptHtml(
    cachedHtml,
    receipt.receiptData,
    normalized,
    receipt.key
  );
}

// ─── Window Creation ────────────────────────────────────────────
function createWindow() {
  // ── Splash window ──
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: Math.round((screenW - 400) / 2),
    y: Math.round((screenH - 300) / 2),
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'BizArch ERP',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'loading.html'));

  // If user closes splash before main is ready, quit the app
  splashWindow.on('closed', () => {
    splashWindow = null;
    if (!mainWindow || !mainWindow.isVisible()) {
      app.quit();
    }
  });

  // ── Main window (hidden until loaded) ──
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: 'BizArch ERP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.loadURL(ERP_URL);

  // ── Fix Electron rendering: backdrop-filter causes blur/clarity issues ──
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.webContents.insertCSS(`
      body::after {
        filter: none !important;
      }
      *, *::before, *::after {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
    `);
  });

  // ── Transition: splash → main ──
  let transitioned = false;
  function showMainWindow() {
    if (transitioned) return;
    transitioned = true;
    if (loadTimeout) clearTimeout(loadTimeout);
    mainWindow.show();
    if (splashWindow) {
      splashWindow.close();
    }
  }

  mainWindow.webContents.on('did-finish-load', showMainWindow);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc) => {
    console.error(`Page failed to load: ${errorCode} - ${errorDesc}`);
    showMainWindow();
  });

  // Fallback: show main after 30 seconds no matter what
  loadTimeout = setTimeout(showMainWindow, 30000);

  mainWindow.on('closed', () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    mainWindow = null;
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────

// Print receipt — routes to network, Windows printer, or raw USB based on config
ipcMain.handle('print-receipt', async (_event, receiptData, config) => {
  try {
    if (!receiptData || typeof receiptData !== 'object') {
      throw new Error('Invalid receipt data');
    }

    const ps = createPrinterServiceFromConfig(config);
    await ps.printReceipt(receiptData);
    return { success: true };
  } catch (error) {
    console.error('Print failed:', error.message);
    return { success: false, error: error.message };
  }
});

// List installed system printers as seen by Electron/Windows/macOS
ipcMain.handle('list-printers', async () => {
  try {
    if (!mainWindow) return { success: false, error: 'No window' };
    const printers = await mainWindow.webContents.getPrintersAsync();
    return {
      success: true,
      printers: printers.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        isDefault: p.isDefault,
        status: p.status,
      })),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// List candidate raw USB receipt printers
ipcMain.handle('list-usb-printers', async () => {
  try {
    const printers = await PrinterService.listRawUsbPrinters();
    return { success: true, printers };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test printer connection
ipcMain.handle('test-printer', async (_event, config) => {
  try {
    const ps = createPrinterServiceFromConfig(config);
    const connected = await ps.testConnection();
    return { success: true, connected };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open cash drawer
ipcMain.handle('open-cash-drawer', async (_event, config) => {
  try {
    const ps = createPrinterServiceFromConfig(config);
    await ps.openCashDrawer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Print styled HTML receipt via hidden BrowserWindow (for Windows printer driver)
ipcMain.handle('print-styled-receipt', async (_event, html, config) => {
  try {
    const normalized = PrinterService.normalizeConfig(config || loadPrinterConfig());
    return printStyledReceiptHtml(html, normalized);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-rasterized-receipt', async (_event, html, config) => {
  try {
    const normalized = PrinterService.normalizeConfig(config || loadPrinterConfig());
    const { buffer } = await buildRasterReceiptBufferFromHtml(html, normalized);
    return await printBufferWithConfig(buffer, normalized);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cache-rendered-receipt', async (_event, html, receiptData, config) => {
  try {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid receipt HTML');
    }

    const normalized = PrinterService.normalizeConfig(config || loadPrinterConfig());
    return await cacheRenderedReceiptHtml(html, receiptData, normalized);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-and-cache-rendered-receipt', async (_event, html, receiptData, config) => {
  try {
    if (typeof html !== 'string' || !html.trim()) {
      throw new Error('Invalid receipt HTML');
    }

    const normalized = PrinterService.normalizeConfig(config || loadPrinterConfig());
    return await printAndCacheRenderedReceiptHtml(html, receiptData, normalized);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-cached-receipt', async (_event, options, config) => {
  try {
    const cacheKey = options?.key || null;
    return await printCachedReceiptArtifact(cacheKey, config);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-latest-cached-receipt', async () => {
  try {
    const receipt = ReceiptSpool.loadLatestReceiptArtifact(getReceiptCacheDir());
    return {
      success: true,
      receipt: receipt
        ? {
            key: receipt.key,
            invoiceNumber: receipt.invoiceNumber,
            cachedAt: receipt.cachedAt,
            renderMode: receipt.renderMode,
            printerProfileHash: receipt.printerProfileHash,
            receiptData: receipt.receiptData,
          }
        : null,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear web cache on demand
ipcMain.handle('clear-cache', async () => {
  try {
    const ses = require('electron').session.defaultSession;
    await ses.clearCache();
    await ses.clearStorageData({ storages: ['cachestorage'] });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Printer config management
ipcMain.handle('get-printer-config', async () => {
  return { success: true, config: loadPrinterConfig() };
});

ipcMain.handle('save-printer-config', async (_event, config) => {
  return savePrinterConfig(config);
});

// ─── Auto Updater ───────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] Update available: v${info.version}`);
    sendStatusToWindow(`Update available: v${info.version}`);
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    if (!win) return;
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Download now?`,
        buttons: ['Download', 'Later'],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.downloadUpdate();
      });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] App is up to date.');
    sendStatusToWindow('App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    const pct = Math.round(progress.percent);
    console.log(`[updater] Download progress: ${pct}%`);
    sendStatusToWindow(`Downloading update: ${pct}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] Update downloaded: v${info.version}`);
    sendStatusToWindow('Update downloaded. Ready to install.');
    const win = mainWindow || BrowserWindow.getFocusedWindow();
    if (!win) {
      autoUpdater.quitAndInstall();
      return;
    }
    dialog
      .showMessageBox(win, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded. Restart now to apply the update.`,
        buttons: ['Restart Now', 'Later'],
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
    sendStatusToWindow(`Update error: ${err.message}`);
  });

  // Delay initial check to let the app finish loading
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[updater] Check failed:', err.message);
    });
  }, 5000);
}

// Allow renderer to trigger a manual update check
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { updateAvailable: !!result?.updateInfo };
  } catch (err) {
    return { error: err.message };
  }
});

// Return current app version to renderer
ipcMain.handle('get-app-version', () => app.getVersion());

function sendStatusToWindow(message) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', message);
  }
}

// ─── Security: Restrict Navigation ─────────────────────────────
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const erpUrl = new URL(ERP_URL);
    if (parsedUrl.origin !== erpUrl.origin) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    const erpUrl = new URL(ERP_URL);
    if (parsedUrl.origin === erpUrl.origin) {
      return { action: 'allow' };
    }
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
});

// ─── App Lifecycle ──────────────────────────────────────────────
app.whenReady().then(async () => {
  // Clear cached web content so updated CSS/JS takes effect immediately
  const ses = require('electron').session.defaultSession;
  await ses.clearCache();
  await ses.clearStorageData({ storages: ['cachestorage'] });

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
