// preload.js — contextBridge API for window.electronPOS
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronPOS', {
  // ─── Identity ──────────────────────────────────────
  isElectron: true,
  platform: process.platform,

  // ─── Receipt Printing ─────────────────────────────
  printReceipt: (receiptData) => {
    if (!receiptData || typeof receiptData !== 'object') {
      return Promise.reject(new Error('receiptData must be an object'));
    }
    return ipcRenderer.invoke('print-receipt', receiptData);
  },

  // ─── Printer Management ────────────────────────────
  listPrinters: () => ipcRenderer.invoke('list-printers'),

  testPrinter: (config) => ipcRenderer.invoke('test-printer', config),

  // ─── Cash Drawer ──────────────────────────────────
  openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),

  // ─── Config Persistence ────────────────────────────
  getPrinterConfig: () => ipcRenderer.invoke('get-printer-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('save-printer-config', config),

  // ─── Auto-Update Status ───────────────────────────
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, message) => callback(message));
  },
});
