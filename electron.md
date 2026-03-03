# Building an Electron.js Thermal Printer Bridge for Web ERPs

**The fastest path to silent receipt printing from a web-based ERP is an Electron wrapper that loads your web app in a BrowserWindow and exposes a `window.printReceipt()` function via `contextBridge`, with all ESC/POS printing handled in the main process over raw TCP to port 9100.** This approach avoids native driver dependencies entirely, works with Epson TM-T88 series printers on the network, and packages cleanly as a Windows installer with built-in auto-updates. Below is the complete, production-ready implementation.

---

## Project structure and dependencies

Create this directory layout:

```
electron-erp-printer/
├── package.json
├── main.js              # Electron main process — IPC handlers + printing
├── preload.js           # contextBridge — exposes window.electronPOS API
├── printer-service.js   # ESC/POS printing logic (TCP + node-thermal-printer)
├── build/
│   ├── icon.ico         # App icon (256×256 minimum)
│   └── icon.png         # App icon for Linux
└── assets/
    └── fonts/           # Optional: Arabic fonts for canvas rendering
```

### package.json — complete configuration

```json
{
  "name": "electron-erp-printer",
  "version": "1.0.0",
  "description": "Electron wrapper for web ERP with thermal receipt printing",
  "main": "main.js",
  "author": "Your Company <dev@yourcompany.com>",
  "license": "MIT",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder build --win",
    "build:publish": "electron-builder build --win --publish always",
    "pack": "electron-builder --dir",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "electron-updater": "^6.8.3",
    "node-thermal-printer": "^4.6.0",
    "iconv-lite": "^0.6.3"
  },
  "devDependencies": {
    "electron": "^33.2.1",
    "electron-builder": "^26.8.1"
  },
  "build": {
    "appId": "com.yourcompany.erp-printer",
    "productName": "ERP Printer Bridge",
    "copyright": "Copyright © 2025 Your Company",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "main.js",
      "preload.js",
      "printer-service.js",
      "node_modules/**/*",
      "package.json"
    ],
    "asar": true,
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "ERP Printer Bridge",
      "runAfterFinish": true
    },
    "publish": [
      {
        "provider": "github",
        "owner": "your-github-username",
        "repo": "electron-erp-printer"
      }
    ]
  }
}
```

Install everything:

```bash
mkdir electron-erp-printer && cd electron-erp-printer
npm init -y
npm install electron-updater node-thermal-printer iconv-lite
npm install --save-dev electron electron-builder
```

**`node-thermal-printer` v4.6.0** is the recommended package — actively maintained through 2025, supports Epson/Star printers, and has built-in TCP interface using Node's `net` module. The older `escpos` package is abandoned (last published 6+ years ago) and should be avoided. **`iconv-lite`** handles Arabic text encoding to Windows-1256 for code-page-based Arabic printing.

---

## main.js — the complete main process

This is the heart of the application. It creates the BrowserWindow pointing at your external ERP URL, registers all IPC handlers for printing, configures the auto-updater, and enforces security restrictions.

```js
// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { autoUpdater } = require('electron-updater');
const PrinterService = require('./printer-service');

// ─── Configuration ──────────────────────────────────────────────
const ERP_URL = 'https://your-erp-app.com';  // Your web ERP URL
const DEFAULT_PRINTER_IP = '192.168.1.100';
const DEFAULT_PRINTER_PORT = 9100;

let mainWindow;
let printerService;

// ─── Window Creation ────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ERP Printer Bridge',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,     // REQUIRED — isolates preload from page
      nodeIntegration: false,     // REQUIRED — no Node.js in renderer
      sandbox: false,             // false so preload can require('electron')
      webSecurity: true,          // Keep enabled in production
      allowRunningInsecureContent: false
    }
  });

  // Load the external web ERP
  mainWindow.loadURL(ERP_URL);

  // Open DevTools in development only
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Initialize printer service
  printerService = new PrinterService(DEFAULT_PRINTER_IP, DEFAULT_PRINTER_PORT);
}

// ─── IPC Handlers ───────────────────────────────────────────────

// Primary print handler — called by window.electronPOS.printReceipt()
ipcMain.handle('print-receipt', async (_event, receiptData) => {
  try {
    // Validate input
    if (!receiptData || typeof receiptData !== 'object') {
      throw new Error('Invalid receipt data');
    }

    const printerIP = receiptData.printerIP || DEFAULT_PRINTER_IP;
    const printerPort = receiptData.printerPort || DEFAULT_PRINTER_PORT;

    // Create printer service with specified IP if different from default
    const ps = (printerIP !== DEFAULT_PRINTER_IP || printerPort !== DEFAULT_PRINTER_PORT)
      ? new PrinterService(printerIP, printerPort)
      : printerService;

    await ps.printReceipt(receiptData);
    return { success: true };
  } catch (error) {
    console.error('Print failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Raw ESC/POS print handler — for advanced users sending raw commands
ipcMain.handle('print-raw', async (_event, { printerIP, printerPort, rawBase64 }) => {
  try {
    const ip = printerIP || DEFAULT_PRINTER_IP;
    const port = printerPort || DEFAULT_PRINTER_PORT;
    const buffer = Buffer.from(rawBase64, 'base64');
    await PrinterService.sendRawTCP(ip, port, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test printer connection
ipcMain.handle('test-printer', async (_event, { printerIP, printerPort }) => {
  try {
    const ps = new PrinterService(
      printerIP || DEFAULT_PRINTER_IP,
      printerPort || DEFAULT_PRINTER_PORT
    );
    const connected = await ps.testConnection();
    return { success: true, connected };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Open cash drawer
ipcMain.handle('open-cash-drawer', async (_event, { printerIP, printerPort }) => {
  try {
    const ps = new PrinterService(
      printerIP || DEFAULT_PRINTER_IP,
      printerPort || DEFAULT_PRINTER_PORT
    );
    await ps.openCashDrawer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ─── Auto Updater ───────────────────────────────────────────────
function setupAutoUpdater() {
  // Disable auto-download — notify user first
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow(`Update available: v${info.version}`);
    // Prompt user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available. Download now?`,
      buttons: ['Download', 'Later']
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatusToWindow('App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToWindow(`Downloading: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatusToWindow('Update downloaded. Restarting...');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. The app will restart to apply it.',
      buttons: ['Restart Now']
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    sendStatusToWindow(`Update error: ${err.message}`);
  });

  // Check for updates after launch
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
    // Open external links in default browser
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
```

A critical detail: **`sandbox` is set to `false`** in `webPreferences`. While Electron defaults sandbox to `true` since v20, a sandboxed preload can only import `electron` via `require('electron')` — which is sufficient for our preload. However, setting it to `false` provides more flexibility if you later need additional preload functionality. **`contextIsolation: true`** is the real security boundary here, ensuring the loaded web page cannot access Node.js APIs directly.

---

## preload.js — exposing window.electronPOS to the web ERP

The preload script bridges the gap between the Electron main process and the web page. It exposes a clean `window.electronPOS` API that the web ERP's JavaScript can call.

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPOS', {
  // ─── Identity ──────────────────────────────────────
  isElectron: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // ─── Receipt Printing ─────────────────────────────
  /**
   * Print a formatted receipt to thermal printer.
   * @param {Object} receiptData - Receipt configuration and content
   * @param {string} [receiptData.printerIP] - Printer IP (default: configured IP)
   * @param {number} [receiptData.printerPort] - Printer port (default: 9100)
   * @param {Object} receiptData.header - Store header info
   * @param {string} receiptData.header.storeName - Store name
   * @param {string} [receiptData.header.address] - Address
   * @param {string} [receiptData.header.phone] - Phone
   * @param {string} [receiptData.header.vatNumber] - VAT/tax number
   * @param {Array}  receiptData.items - Line items [{name, qty, price, nameAr?}]
   * @param {Object} receiptData.totals - Totals {subtotal, tax, discount, total}
   * @param {Object} [receiptData.payment] - Payment info {method, amount, change}
   * @param {string} [receiptData.footer] - Footer text
   * @param {string} [receiptData.footerAr] - Arabic footer text
   * @param {string} [receiptData.barcode] - Barcode data (Code128)
   * @param {string} [receiptData.qrcode] - QR code data
   * @param {boolean} [receiptData.openDrawer] - Open cash drawer after print
   * @param {boolean} [receiptData.cutPaper] - Cut paper after print (default: true)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  printReceipt: (receiptData) => {
    if (!receiptData || typeof receiptData !== 'object') {
      return Promise.reject(new Error('receiptData must be an object'));
    }
    return ipcRenderer.invoke('print-receipt', receiptData);
  },

  // ─── Raw ESC/POS Printing ─────────────────────────
  /**
   * Send raw ESC/POS commands (Base64-encoded buffer).
   * For advanced use when you build your own ESC/POS commands.
   */
  printRaw: (printerIP, printerPort, rawBase64) => {
    return ipcRenderer.invoke('print-raw', { printerIP, printerPort, rawBase64 });
  },

  // ─── Cash Drawer ──────────────────────────────────
  openCashDrawer: (printerIP, printerPort) => {
    return ipcRenderer.invoke('open-cash-drawer', {
      printerIP: printerIP || undefined,
      printerPort: printerPort || undefined
    });
  },

  // ─── Printer Test ─────────────────────────────────
  testPrinter: (printerIP, printerPort) => {
    return ipcRenderer.invoke('test-printer', {
      printerIP: printerIP || undefined,
      printerPort: printerPort || undefined
    });
  },

  // ─── Auto-Update Status ───────────────────────────
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, message) => callback(message));
  }
});
```

After this preload runs, any JavaScript on the loaded web page can call `window.electronPOS.printReceipt({...})`. The function returns a Promise, making integration seamless with modern async/await code in the ERP.

---

## printer-service.js — ESC/POS printing engine with Arabic support

This module handles all thermal printing logic using two approaches: **`node-thermal-printer`** for structured receipt building, and **raw TCP sockets** for direct ESC/POS command sending.

```js
// printer-service.js
const { ThermalPrinter, PrinterTypes, CharacterSet } = require('node-thermal-printer');
const net = require('node:net');
const iconv = require('iconv-lite');

class PrinterService {
  constructor(printerIP, printerPort = 9100) {
    this.printerIP = printerIP;
    this.printerPort = printerPort;
    this.interface = `tcp://${printerIP}:${printerPort}`;
  }

  // ─── Create a fresh printer instance (stateless per print job) ─────
  _createPrinter() {
    return new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: this.interface,
      characterSet: CharacterSet.PC437_USA,
      width: 48,                        // 48 chars for 80mm paper
      removeSpecialCharacters: false,
      options: { timeout: 5000 }
    });
  }

  // ─── Test Connection ────────────────────────────────────────────
  async testConnection() {
    const printer = this._createPrinter();
    return await printer.isPrinterConnected();
  }

  // ─── Print Full Receipt ─────────────────────────────────────────
  async printReceipt(data) {
    const printer = this._createPrinter();
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      throw new Error(`Printer not reachable at ${this.interface}`);
    }

    // ── Header ──
    printer.alignCenter();
    if (data.header) {
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.println(data.header.storeName || 'STORE');
      printer.setTextNormal();
      printer.bold(false);

      if (data.header.address) printer.println(data.header.address);
      if (data.header.phone) printer.println(`Tel: ${data.header.phone}`);
      if (data.header.vatNumber) printer.println(`VAT: ${data.header.vatNumber}`);
    }
    printer.drawLine();

    // ── Arabic Header (via code page WPC1256) ──
    if (data.header && data.header.storeNameAr) {
      this._appendArabicLine(printer, data.header.storeNameAr, 'center');
    }

    // ── Invoice Info ──
    if (data.invoiceNo) {
      printer.alignLeft();
      printer.println(`Invoice: ${data.invoiceNo}`);
    }
    if (data.date) {
      printer.println(`Date: ${data.date}`);
    }
    if (data.cashier) {
      printer.println(`Cashier: ${data.cashier}`);
    }
    printer.drawLine();

    // ── Column Headers ──
    printer.bold(true);
    printer.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.45 },
      { text: 'Qty', align: 'CENTER', width: 0.15 },
      { text: 'Price', align: 'RIGHT', width: 0.20 },
      { text: 'Total', align: 'RIGHT', width: 0.20 }
    ]);
    printer.bold(false);
    printer.drawLine();

    // ── Line Items ──
    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        const lineTotal = ((item.qty || 1) * (item.price || 0)).toFixed(2);
        printer.tableCustom([
          { text: item.name || '', align: 'LEFT', width: 0.45 },
          { text: String(item.qty || 1), align: 'CENTER', width: 0.15 },
          { text: (item.price || 0).toFixed(2), align: 'RIGHT', width: 0.20 },
          { text: lineTotal, align: 'RIGHT', width: 0.20 }
        ]);

        // Print Arabic item name on next line if provided
        if (item.nameAr) {
          this._appendArabicLine(printer, `  ${item.nameAr}`, 'right');
        }
      }
    }

    // ── Totals ──
    printer.drawLine();
    if (data.totals) {
      if (data.totals.subtotal !== undefined) {
        printer.leftRight('Subtotal:', data.totals.subtotal.toFixed(2));
      }
      if (data.totals.discount) {
        printer.leftRight('Discount:', `-${data.totals.discount.toFixed(2)}`);
      }
      if (data.totals.tax !== undefined) {
        printer.leftRight('Tax (VAT):', data.totals.tax.toFixed(2));
      }
      printer.drawLine();
      printer.bold(true);
      printer.setTextDoubleHeight();
      printer.leftRight('TOTAL:', (data.totals.total || 0).toFixed(2));
      printer.setTextNormal();
      printer.bold(false);
    }

    // ── Payment Info ──
    if (data.payment) {
      printer.drawLine();
      printer.leftRight('Payment:', data.payment.method || 'Cash');
      if (data.payment.amount) {
        printer.leftRight('Paid:', data.payment.amount.toFixed(2));
      }
      if (data.payment.change) {
        printer.leftRight('Change:', data.payment.change.toFixed(2));
      }
    }

    printer.drawLine();

    // ── Barcode ──
    if (data.barcode) {
      printer.alignCenter();
      printer.newLine();
      printer.code128(data.barcode, {
        width: 'MEDIUM',   // SMALL | MEDIUM | LARGE
        height: 60,
        text: 2            // 0=none, 1=above, 2=below, 3=both
      });
      printer.newLine();
    }

    // ── QR Code ──
    if (data.qrcode) {
      printer.alignCenter();
      printer.printQR(data.qrcode, {
        cellSize: 4,        // 1-8, module size in dots
        correction: 'M',    // L, M, Q, H
        model: 2            // 1 or 2 (use 2 for modern QR)
      });
      printer.newLine();
    }

    // ── Footer ──
    printer.alignCenter();
    if (data.footer) {
      printer.println(data.footer);
    }
    if (data.footerAr) {
      this._appendArabicLine(printer, data.footerAr, 'center');
    }
    printer.newLine();
    printer.newLine();

    // ── Cut Paper ──
    if (data.cutPaper !== false) {
      printer.partialCut();
    }

    // ── Cash Drawer ──
    if (data.openDrawer) {
      printer.openCashDrawer();
    }

    // ── Execute (send to printer) ──
    await printer.execute();
    printer.clear();
  }

  // ─── Arabic Text via WPC1256 Code Page ──────────────────────────
  // NOTE: This uses code page encoding. Arabic glyphs will print but
  // may not have proper shaping (connected letter forms). For perfect
  // Arabic rendering, use the image-based approach below.
  _appendArabicLine(printer, text, align = 'right') {
    const buffer = printer.getBuffer();
    const ESC = 0x1B;

    // Set alignment
    const alignByte = align === 'center' ? 0x01 : align === 'right' ? 0x02 : 0x00;
    const alignCmd = Buffer.from([ESC, 0x61, alignByte]);

    // Select WPC1256 (Arabic) code page: ESC t 50
    const codepageCmd = Buffer.from([ESC, 0x74, 0x32]);

    // Encode Arabic text to Windows-1256
    const encoded = iconv.encode(text, 'win1256');

    // Line feed
    const LF = Buffer.from([0x0A]);

    // Reset to PC437: ESC t 0
    const resetCmd = Buffer.from([ESC, 0x74, 0x00]);

    // Append all to printer buffer
    const combined = Buffer.concat([alignCmd, codepageCmd, encoded, LF, resetCmd]);
    printer.setBuffer(Buffer.concat([buffer, combined]));
  }

  // ─── Open Cash Drawer Only ──────────────────────────────────────
  async openCashDrawer() {
    // ESC p 0 25 255 — kick drawer pin 2
    const cmd = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFF]);
    await PrinterService.sendRawTCP(this.printerIP, this.printerPort, cmd);
  }

  // ─── Raw TCP Socket Send ────────────────────────────────────────
  static sendRawTCP(ip, port, buffer) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      client.setTimeout(5000);

      client.connect(port, ip, () => {
        client.write(buffer, () => {
          client.destroy();
          resolve();
        });
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error(`TCP timeout connecting to ${ip}:${port}`));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(new Error(`TCP error: ${err.message}`));
      });
    });
  }
}

module.exports = PrinterService;
```

Two approaches coexist here. The `printReceipt` method uses **`node-thermal-printer`** for clean, structured receipt building with its high-level API. The `sendRawTCP` static method provides a **raw TCP socket** escape hatch for sending arbitrary ESC/POS byte sequences directly — useful when the web ERP constructs its own ESC/POS buffers.

---

## How your web ERP calls window.electronPOS.printReceipt()

This is the JavaScript your web-based ERP runs. It detects the Electron environment and calls the bridged API:

```js
// In your web ERP's JavaScript (runs in the BrowserWindow)
async function printSaleReceipt(sale) {
  // Check if running inside the Electron wrapper
  if (!window.electronPOS?.isElectron) {
    alert('Desktop printing requires the Electron app. Use browser print instead.');
    window.print();
    return;
  }

  const receiptData = {
    // Optional: override printer IP per-call
    printerIP: '192.168.1.100',
    printerPort: 9100,

    header: {
      storeName: 'ACME Electronics',
      storeNameAr: 'أكمي للإلكترونيات',
      address: '123 King Fahd Road, Riyadh',
      phone: '+966-11-123-4567',
      vatNumber: '300012345600003'
    },

    invoiceNo: 'INV-2025-001847',
    date: new Date().toLocaleString('en-SA'),
    cashier: 'Ahmed',

    items: [
      { name: 'USB-C Cable 2m', nameAr: 'كيبل يو اس بي', qty: 2, price: 25.00 },
      { name: 'Wireless Mouse', nameAr: 'ماوس لاسلكي', qty: 1, price: 89.00 },
      { name: 'Screen Protector', qty: 3, price: 15.00 }
    ],

    totals: {
      subtotal: 184.00,
      discount: 10.00,
      tax: 26.10,       // 15% VAT
      total: 200.10
    },

    payment: {
      method: 'Cash',
      amount: 250.00,
      change: 49.90
    },

    barcode: 'INV2025001847',           // Code128 barcode
    qrcode: 'https://erp.acme.sa/verify/INV-2025-001847',  // QR code

    footer: 'Thank you for shopping with us!',
    footerAr: 'شكراً لتسوقكم معنا',

    openDrawer: true,     // Kick cash drawer after printing
    cutPaper: true        // Cut paper after receipt
  };

  try {
    const result = await window.electronPOS.printReceipt(receiptData);
    if (result.success) {
      console.log('Receipt printed successfully');
    } else {
      console.error('Print failed:', result.error);
      alert(`Print failed: ${result.error}`);
    }
  } catch (err) {
    console.error('Print error:', err);
  }
}

// Open cash drawer without printing
async function openDrawer() {
  if (window.electronPOS?.isElectron) {
    await window.electronPOS.openCashDrawer('192.168.1.100', 9100);
  }
}

// Test printer connectivity
async function testPrinter() {
  if (window.electronPOS?.isElectron) {
    const result = await window.electronPOS.testPrinter('192.168.1.100', 9100);
    alert(result.connected ? 'Printer OK' : 'Printer not reachable');
  }
}
```

---

## Raw TCP approach for full ESC/POS control

When you need byte-level control — for example, to print a receipt entirely constructed by your ERP backend — use the raw TCP method. This builds ESC/POS commands manually:

```js
// Raw ESC/POS receipt builder (runs in web ERP, sends via Electron bridge)
function buildRawReceipt() {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const parts = [];
  const add = (data) => parts.push(typeof data === 'string'
    ? new Uint8Array([...data].map(c => c.charCodeAt(0)))
    : new Uint8Array(data));

  add([ESC, 0x40]);                     // Initialize printer
  add([ESC, 0x61, 0x01]);               // Center align
  add([ESC, 0x45, 0x01]);               // Bold ON
  add([GS, 0x21, 0x11]);                // Double height + double width
  add('ACME STORE\n');
  add([GS, 0x21, 0x00]);                // Normal size
  add([ESC, 0x45, 0x00]);               // Bold OFF
  add('123 King Fahd Road\n');
  add('================================\n');

  // Items
  add([ESC, 0x61, 0x00]);               // Left align
  add('USB-C Cable x2       SAR 50.00\n');
  add('Wireless Mouse x1    SAR 89.00\n');
  add('================================\n');
  add([ESC, 0x45, 0x01]);
  add('TOTAL              SAR 200.10\n');
  add([ESC, 0x45, 0x00]);
  add('================================\n');

  // QR Code (Epson GS ( k commands)
  add([ESC, 0x61, 0x01]);               // Center
  const qrText = 'https://erp.acme.sa/v/INV001';
  const qrBytes = [...qrText].map(c => c.charCodeAt(0));
  const storeLen = qrBytes.length + 3;
  add([GS, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // Model 2
  add([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]);        // Size 6
  add([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]);        // Error correction M
  add([GS, 0x28, 0x6B, storeLen & 0xFF, (storeLen >> 8) & 0xFF,
       0x31, 0x50, 0x30, ...qrBytes]);                          // Store data
  add([GS, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]);        // Print QR
  add([LF]);

  // Barcode (Code128)
  add([ESC, 0x61, 0x01]);               // Center
  add([GS, 0x68, 0x50]);                // Height 80
  add([GS, 0x77, 0x02]);                // Width 2
  add([GS, 0x48, 0x02]);                // HRI text below
  const barcodeText = 'INV2025001';
  add([GS, 0x6B, 73, barcodeText.length, ...barcodeText.split('').map(c => c.charCodeAt(0))]);
  add([LF, LF]);

  // Partial cut + cash drawer
  add([GS, 0x56, 0x42, 0x03]);          // Feed 3 lines + partial cut
  add([ESC, 0x70, 0x00, 0x19, 0xFF]);   // Cash drawer pin 2

  // Combine and Base64-encode for transport over IPC
  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return btoa(String.fromCharCode(...combined));
}

// Send raw ESC/POS to printer
async function printRawReceipt() {
  const rawBase64 = buildRawReceipt();
  const result = await window.electronPOS.printRaw('192.168.1.100', 9100, rawBase64);
  console.log('Raw print result:', result);
}
```

---

## ESC/POS command quick reference for Epson TM-T88

This table covers every command used in this guide. All byte values are hexadecimal.

| Function | Bytes | Notes |
|---|---|---|
| **Initialize** | `1B 40` | Reset all settings |
| **Bold on/off** | `1B 45 01` / `1B 45 00` | |
| **Underline on/off** | `1B 2D 01` / `1B 2D 00` | Use `02` for thick underline |
| **Align left/center/right** | `1B 61 00` / `01` / `02` | |
| **Normal size** | `1D 21 00` | |
| **Double height** | `1D 21 01` | |
| **Double width** | `1D 21 10` | |
| **Double both** | `1D 21 11` | |
| **Arabic code page (WPC1256)** | `1B 74 32` | Best Arabic coverage |
| **Arabic code page (PC720)** | `1B 74 20` | Basic Arabic |
| **Arabic code page (IBM864)** | `1B 74 25` | Common alternative |
| **Full cut** | `1D 56 00` | |
| **Partial cut** | `1D 56 01` | |
| **Feed + partial cut** | `1D 56 42 nn` | nn = lines to feed first |
| **Cash drawer pin 2** | `1B 70 00 19 FF` | 50ms on, 510ms off |
| **Cash drawer pin 5** | `1B 70 01 19 FF` | Secondary drawer |
| **Barcode height** | `1D 68 nn` | nn in dots (e.g., `50` = 80) |
| **Barcode width** | `1D 77 nn` | nn = 1–6 |
| **HRI text position** | `1D 48 nn` | 0=none, 1=above, 2=below |
| **Print Code128** | `1D 6B 49 nn data` | nn = data length |
| **Print EAN-13** | `1D 6B 43 0D data` | 13 digits |

---

## Arabic text printing — the two approaches

**Approach 1: Code page encoding (fast, imperfect shaping).** The `_appendArabicLine` method in `printer-service.js` switches to **WPC1256** (Windows-1256) code page via `ESC t 0x32`, encodes text with `iconv-lite`, and sends the bytes. This prints recognizable Arabic characters but Epson printers **do not perform Arabic glyph shaping** — letters may appear in their isolated form rather than properly connected. Acceptable for short labels like price tags or simple footers.

**Approach 2: Render Arabic as raster image (perfect output).** For production-quality Arabic receipts, render text to a bitmap using the `canvas` npm package and send as a raster image. Add `canvas` to your dependencies (`npm install canvas`) and use this helper:

```js
// Add to printer-service.js
const { createCanvas } = require('canvas');

async _printArabicAsImage(printer, text, fontSize = 24) {
  const canvasWidth = 576;  // 576px = 80mm at 203 DPI
  const canvasHeight = Math.ceil(fontSize * 1.8);
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Black Arabic text, right-to-left
  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText(text, canvasWidth / 2, fontSize * 1.2);

  // Send as image — node-thermal-printer handles raster conversion
  await printer.printImageBuffer(canvas.toBuffer('image/png'));
}
```

The `canvas` package is a native C++ module requiring build tools. On Windows, `npm install canvas` needs Python and Visual Studio Build Tools. If you want to avoid native dependencies entirely, stick with Approach 1 or pre-render Arabic images server-side and send them as Base64.

---

## Auto-updater with electron-updater

The auto-updater in `main.js` uses **`electron-updater` v6.8.3** from the `electron-builder` ecosystem. Key configuration points:

**For GitHub Releases publishing**, add a `GH_TOKEN` environment variable when building:

```bash
# Build and publish to GitHub Releases
GH_TOKEN=your_github_token npm run build:publish
```

**For a generic HTTP server** (self-hosted updates), change the publish config in `package.json`:

```json
"publish": [
  {
    "provider": "generic",
    "url": "https://updates.yourcompany.com/releases/"
  }
]
```

Upload the built files (`ERP Printer Bridge Setup 1.0.0.exe`, `latest.yml`) to that URL after each build. The `latest.yml` file is auto-generated by electron-builder and contains version info and checksums the updater uses to detect new versions. **Do not call `autoUpdater.setFeedURL()`** — electron-builder embeds the update URL in an `app-update.yml` resource file during build.

---

## Building the Windows installer

Run one command to produce an NSIS installer:

```bash
# Development build (local testing)
npm run build

# Production build with auto-publish
GH_TOKEN=your_token npm run build:publish
```

Output lands in `dist/`:

- `ERP Printer Bridge Setup 1.0.0.exe` — NSIS installer (**~85-120 MB**)
- `latest.yml` — update manifest for electron-updater
- `ERP Printer Bridge-1.0.0-win.zip` — portable archive

The NSIS configuration in `package.json` creates a user-friendly **assisted installer** (not one-click) that lets users choose the installation directory, creates desktop and Start Menu shortcuts, and launches the app after installation. Set `"perMachine": true` to install for all users (requires admin elevation).

---

## Summary: How It All Connects

```
┌─────────────────────────────────────────────────┐
│           Your Web ERP (on server)              │
│                                                 │
│  JavaScript calls:                              │
│  window.electronPOS.printReceipt(receiptData)   │
│                                                 │
└──────────────────────┬──────────────────────────┘
                       │ IPC (invoke)
                       ▼
┌─────────────────────────────────────────────────┐
│          Electron Main Process (main.js)        │
│                                                 │
│  ipcMain.handle('print-receipt') →              │
│  PrinterService.printReceipt(data)              │
│                                                 │
└──────────────────────┬──────────────────────────┘
                       │ Raw TCP (port 9100)
                       ▼
┌─────────────────────────────────────────────────┐
│        Epson TM-T88 Thermal Printer             │
│        (Network: 192.168.1.100:9100)            │
│                                                 │
│  Receives ESC/POS → Prints receipt silently     │
└─────────────────────────────────────────────────┘
```

**Install once per branch PC → Web ERP updates automatically → Printing just works.**