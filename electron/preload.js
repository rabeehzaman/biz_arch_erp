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

  // ─── Printer Management ────────────────────────────
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  listUsbPrinters: () => ipcRenderer.invoke('list-usb-printers'),

  testPrinter: (config) => ipcRenderer.invoke('test-printer', config),

  // ─── Cash Drawer ──────────────────────────────────
  openCashDrawer: (config) => ipcRenderer.invoke('open-cash-drawer', config),

  // ─── Config Persistence ────────────────────────────
  getPrinterConfig: () => ipcRenderer.invoke('get-printer-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('save-printer-config', config),

  // ─── Auto-Update Status ───────────────────────────
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, message) => callback(message));
  },
});
