// main.js — Electron main process
const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');
const PrinterService = require('./printer-service');

// ─── Configuration ──────────────────────────────────────────────
const ERP_URL = process.env.ERP_URL || 'https://erp.bizarch.in';
const CONFIG_DIR = path.join(app.getPath('userData'));
const CONFIG_FILE = path.join(CONFIG_DIR, 'printer-config.json');

let mainWindow;
let splashWindow;
let loadTimeout;

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
    const printerName = normalized.windowsPrinterName;

    const printWin = new BrowserWindow({
      show: false,
      width: 302,   // ~80mm at 96dpi
      height: 800,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    return await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: true,
          deviceName: printerName || undefined,
          printBackground: true,
        },
        (success, failureReason) => {
          printWin.destroy();
          resolve({
            success,
            error: success ? undefined : failureReason,
          });
        }
      );
    });
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

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(`Update available: v${info.version}`);
    dialog
      .showMessageBox(mainWindow, {
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
    sendStatusToWindow('App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow(`Downloading: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', () => {
    sendStatusToWindow('Update downloaded. Restarting...');
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The app will restart to apply it.',
        buttons: ['Restart Now'],
      })
      .then(() => {
        autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow(`Update error: ${err.message}`);
  });

  autoUpdater.checkForUpdates();
}

function sendStatusToWindow(message) {
  if (mainWindow && mainWindow.webContents) {
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
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
