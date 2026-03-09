interface ElectronPrinterConfig {
  connectionType: 'network' | 'windows' | 'rawUsb';
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
  listPrinters: () => Promise<{ success: boolean; printers?: ElectronPrinter[]; error?: string }>;
  listUsbPrinters: () => Promise<{ success: boolean; printers?: ElectronUsbPrinter[]; error?: string }>;
  testPrinter: (config?: Partial<ElectronPrinterConfig>) => Promise<{ success: boolean; connected?: boolean; error?: string }>;
  openCashDrawer: (config?: Partial<ElectronPrinterConfig>) => Promise<ElectronPrintResult>;
  getPrinterConfig: () => Promise<{ success: boolean; config: ElectronPrinterConfig }>;
  savePrinterConfig: (config: ElectronPrinterConfig) => Promise<{ success: boolean; config?: ElectronPrinterConfig }>;
  clearCache: () => Promise<{ success: boolean; error?: string }>;
  onUpdateStatus: (callback: (message: string) => void) => void;
}

interface Window {
  electronPOS?: ElectronPOS;
}
