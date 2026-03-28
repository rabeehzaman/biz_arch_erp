interface ElectronPrinterConfig {
  connectionType: 'network' | 'windows' | 'rawUsb';
  receiptRenderMode: 'htmlDriver' | 'htmlRaster' | 'escposText' | 'bitmapCanvas';
  arabicCodePage: 'pc864' | 'wpc1256';
  networkIP: string;
  networkPort: number;
  windowsPrinterName: string;
  usbVendorId: number | null;
  usbProductId: number | null;
  usbSerialNumber: string;
  receiptMarginLeft: number;
  receiptMarginRight: number;
}

interface ElectronPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: number;
}

interface ElectronUsbPrinter {
  id: string;
  vendorId: number | null;
  productId: number | null;
  serialNumber: string;
  manufacturer: string;
  product: string;
  displayName: string;
}

interface ElectronPrintResult {
  success: boolean;
  error?: string;
}

interface ElectronCachedReceiptData {
  invoiceNumber: string;
  date: string;
  [key: string]: unknown;
}

interface ElectronCachedReceiptRecord {
  key: string;
  invoiceNumber?: string | null;
  cachedAt: string;
  renderMode: 'htmlDriver' | 'htmlRaster' | 'escposText' | 'bitmapCanvas';
  printerProfileHash: string;
  receiptData: ElectronCachedReceiptData;
}

interface ElectronPOS {
  isElectron: true;
  platform: string;
  printReceipt: (
    data: Record<string, unknown>,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult>;
  printStyledReceipt: (
    html: string,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult>;
  printRasterizedReceipt: (
    html: string,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult>;
  printBitmapReceipt: (
    imageBuffer: ArrayBuffer,
    qrCodeText?: string | null,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult>;
  cacheRenderedReceipt: (
    html: string,
    receiptData: ElectronCachedReceiptData,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult & { key?: string; cachedAt?: string }>;
  printAndCacheRenderedReceipt: (
    html: string,
    receiptData: ElectronCachedReceiptData,
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult & { key?: string; cachedAt?: string }>;
  printCachedReceipt: (
    options?: { key?: string | null },
    config?: Partial<ElectronPrinterConfig>
  ) => Promise<ElectronPrintResult>;
  getLatestCachedReceipt: () => Promise<{
    success: boolean;
    receipt?: ElectronCachedReceiptRecord | null;
    error?: string;
  }>;
  listPrinters: () => Promise<{ success: boolean; printers?: ElectronPrinter[]; error?: string }>;
  listUsbPrinters: () => Promise<{ success: boolean; printers?: ElectronUsbPrinter[]; error?: string }>;
  testPrinter: (config?: Partial<ElectronPrinterConfig>) => Promise<{ success: boolean; connected?: boolean; error?: string }>;
  openCashDrawer: (config?: Partial<ElectronPrinterConfig>) => Promise<ElectronPrintResult>;
  getPrinterConfig: () => Promise<{ success: boolean; config: ElectronPrinterConfig }>;
  savePrinterConfig: (config: ElectronPrinterConfig) => Promise<{ success: boolean; config?: ElectronPrinterConfig }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  // KOT Printer (separate from receipt printer)
  getKotPrinterConfig: () => Promise<{ success: boolean; config: ElectronPrinterConfig }>;
  saveKotPrinterConfig: (config: ElectronPrinterConfig) => Promise<{ success: boolean; config?: ElectronPrinterConfig }>;
  onUpdateStatus: (callback: (message: string) => void) => void;
  checkForUpdates: () => Promise<{ updateAvailable?: boolean; error?: string }>;
  getAppVersion: () => Promise<string>;
}

interface Window {
  electronPOS?: ElectronPOS;
}
