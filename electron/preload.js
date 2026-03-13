// preload.js — contextBridge API for window.electronPOS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPOS', {
  // ─── Identity ──────────────────────────────────────
  isElectron: true,
  platform: process.platform,

  // ─── Receipt Printing ─────────────────────────────
  printReceipt: (receiptData, config) => {
    if (!receiptData || typeof receiptData !== 'object') {
      return Promise.reject(new Error('receiptData must be an object'));
    }
    return ipcRenderer.invoke('print-receipt', receiptData, config);
  },

  // ─── Styled HTML Receipt Printing ───────────────────
  printStyledReceipt: (html, config) => {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('html must be a string'));
    }
    return ipcRenderer.invoke('print-styled-receipt', html, config);
  },

  printRasterizedReceipt: (html, config) => {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('html must be a string'));
    }
    return ipcRenderer.invoke('print-rasterized-receipt', html, config);
  },

  cacheRenderedReceipt: (html, receiptData, config) => {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('html must be a string'));
    }
    return ipcRenderer.invoke('cache-rendered-receipt', html, receiptData, config);
  },

  printAndCacheRenderedReceipt: (html, receiptData, config) => {
    if (typeof html !== 'string') {
      return Promise.reject(new Error('html must be a string'));
    }
    return ipcRenderer.invoke('print-and-cache-rendered-receipt', html, receiptData, config);
  },

  printCachedReceipt: (options, config) => ipcRenderer.invoke('print-cached-receipt', options, config),
  getLatestCachedReceipt: () => ipcRenderer.invoke('get-latest-cached-receipt'),

  // ─── Printer Management ────────────────────────────
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  listUsbPrinters: () => ipcRenderer.invoke('list-usb-printers'),

  testPrinter: (config) => ipcRenderer.invoke('test-printer', config),

  // ─── Cash Drawer ──────────────────────────────────
  openCashDrawer: (config) => ipcRenderer.invoke('open-cash-drawer', config),

  // ─── Config Persistence ────────────────────────────
  getPrinterConfig: () => ipcRenderer.invoke('get-printer-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('save-printer-config', config),

  // ─── Cache Management ────────────────────────────
  clearCache: () => ipcRenderer.invoke('clear-cache'),

  // ─── Auto-Update ─────────────────────────────────
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, message) => callback(message));
  },
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
});
