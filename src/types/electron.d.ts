interface ElectronPrinterConfig {
  connectionType: 'network' | 'usb';
  networkIP: string;
  networkPort: number;
  usbPrinterName: string;
}

interface ElectronPrinter {
  name: string;
  displayName: string;
  isDefault: boolean;
  status: number;
}

interface ElectronPrintResult {
  success: boolean;
  error?: string;
}

interface ElectronPOS {
  isElectron: true;
  platform: string;
  printReceipt: (data: Record<string, unknown>) => Promise<ElectronPrintResult>;
  listPrinters: () => Promise<{ success: boolean; printers?: ElectronPrinter[]; error?: string }>;
  testPrinter: (config?: Partial<ElectronPrinterConfig>) => Promise<{ success: boolean; connected?: boolean; error?: string }>;
  openCashDrawer: () => Promise<ElectronPrintResult>;
  getPrinterConfig: () => Promise<{ success: boolean; config: ElectronPrinterConfig }>;
  savePrinterConfig: (config: ElectronPrinterConfig) => Promise<{ success: boolean }>;
  onUpdateStatus: (callback: (message: string) => void) => void;
}

interface Window {
  electronPOS?: ElectronPOS;
}
