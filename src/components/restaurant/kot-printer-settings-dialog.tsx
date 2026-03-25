"use client";

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Monitor, Printer, Wifi, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { isElectronEnvironment } from "@/lib/electron-print";
import {
  isCapacitorEnvironment,
  testMobilePrinterConnection,
  type MobilePrinterConfig,
} from "@/lib/capacitor-print";
import {
  getKotElectronConfig,
  saveKotElectronConfig,
  getKotMobilePrinterConfig,
  saveKotMobilePrinterConfig,
  printKOT,
  type KOTReceiptData,
} from "@/lib/restaurant/kot-print";

interface KOTPrinterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KOTPrinterSettingsDialog({ open, onOpenChange }: KOTPrinterSettingsDialogProps) {
  const [isElectron, setIsElectron] = useState(false);
  const [isCapacitor, setIsCapacitor] = useState(false);

  // Electron state
  const [connectionType, setConnectionType] = useState<"network" | "windows">("network");
  const [networkIP, setNetworkIP] = useState("");
  const [networkPort, setNetworkPort] = useState("9100");
  const [windowsPrinterName, setWindowsPrinterName] = useState("");
  const [installedPrinters, setInstalledPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Capacitor state
  const [mobileHost, setMobileHost] = useState("");
  const [mobilePort, setMobilePort] = useState("9100");
  const [mobilePaperWidth, setMobilePaperWidth] = useState<58 | 80>(80);

  // Shared state
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load saved config when dialog opens
  useEffect(() => {
    if (!open) return;

    const electron = isElectronEnvironment();
    const capacitor = isCapacitorEnvironment();
    setIsElectron(electron);
    setIsCapacitor(capacitor);

    if (electron) {
      const config = getKotElectronConfig();
      if (config) {
        setConnectionType(config.connectionType === "windows" ? "windows" : "network");
        setNetworkIP(config.networkIP || "");
        setNetworkPort(String(config.networkPort || 9100));
        setWindowsPrinterName(config.windowsPrinterName || "");
      }
    }

    if (capacitor) {
      const config = getKotMobilePrinterConfig();
      if (config) {
        setMobileHost(config.host || "");
        setMobilePort(String(config.port || 9100));
        setMobilePaperWidth(config.paperWidth === 58 ? 58 : 80);
      }
    }
  }, [open]);

  // Load installed printers for Electron Windows mode
  const loadPrinters = useCallback(async () => {
    if (!window.electronPOS) return;
    setLoadingPrinters(true);
    try {
      const res = await window.electronPOS.listPrinters();
      if (res.success && res.printers) {
        setInstalledPrinters(res.printers);
        if (!windowsPrinterName && res.printers.length > 0) {
          const defaultPrinter = res.printers.find((p) => p.isDefault);
          setWindowsPrinterName(defaultPrinter?.name || res.printers[0].name);
        }
      }
    } catch {
      toast.error("Failed to list printers");
    } finally {
      setLoadingPrinters(false);
    }
  }, [windowsPrinterName]);

  useEffect(() => {
    if (!isElectron || !open) return;
    if (connectionType === "windows") loadPrinters();
  }, [isElectron, open, connectionType, loadPrinters]);

  // Build configs
  const buildElectronConfig = (): ElectronPrinterConfig => ({
    connectionType,
    receiptRenderMode: connectionType === "windows" ? "htmlDriver" : "htmlRaster",
    arabicCodePage: "pc864",
    networkIP: networkIP.trim(),
    networkPort: parseInt(networkPort, 10) || 9100,
    windowsPrinterName,
    usbVendorId: null,
    usbProductId: null,
    usbSerialNumber: "",
    receiptMarginLeft: 2,
    receiptMarginRight: 2,
  });

  const buildMobileConfig = (): MobilePrinterConfig => ({
    connectionType: "tcp",
    host: mobileHost.trim(),
    port: parseInt(mobilePort, 10) || 9100,
    paperWidth: mobilePaperWidth,
    timeoutSeconds: 10,
    cutPaper: true,
    openCashDrawer: false,
    receiptMarginLeft: 2,
    receiptMarginRight: 2,
  });

  // Test connection
  const testConnection = async () => {
    setIsTesting(true);

    try {
      if (isCapacitor) {
        const config = buildMobileConfig();
        if (!config.host) {
          toast.error("Enter the printer IP address");
          return;
        }
        const res = await testMobilePrinterConnection(config);
        if (res.success && res.connected) {
          toast.success("KOT printer is reachable");
        } else {
          toast.error(res.error || "KOT printer is not reachable");
        }
      } else if (isElectron && window.electronPOS) {
        const config = buildElectronConfig();
        if (connectionType === "network" && !config.networkIP) {
          toast.error("Enter the printer IP address");
          return;
        }
        if (connectionType === "windows" && !config.windowsPrinterName) {
          toast.error("Select a printer");
          return;
        }
        const res = await window.electronPOS.testPrinter(config);
        if (res.success && res.connected) {
          toast.success("KOT printer connected");
        } else {
          toast.error(res.error || "KOT printer not reachable");
        }
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  // Print test KOT
  const printTestKot = async () => {
    const testData: KOTReceiptData = {
      kotNumber: "TEST-001",
      kotType: "STANDARD",
      orderType: "DINE_IN",
      tableName: "Table 5",
      tableNumber: 5,
      section: "Main Hall",
      serverName: "Test Server",
      guestCount: 4,
      timestamp: new Date(),
      items: [
        { name: "Chicken Biryani", nameAr: "برياني دجاج", quantity: 2, modifiers: ["Extra Spicy", "No Onion"], isNew: true },
        { name: "Butter Naan", nameAr: "نان بالزبدة", quantity: 4 },
        { name: "Mango Lassi", quantity: 2, notes: "Less sugar" },
      ],
      specialInstructions: "Allergic to nuts - please be careful",
    };

    try {
      const result = await printKOT(testData);
      if (result.success) {
        toast.success("Test KOT printed successfully");
      } else {
        toast.error(result.error || "Test KOT print failed");
      }
    } catch {
      toast.error("Test KOT print failed");
    }
  };

  // Save config
  const handleSave = () => {
    setIsSaving(true);

    try {
      if (isCapacitor) {
        const config = buildMobileConfig();
        if (!config.host) {
          toast.error("Enter the printer IP address");
          return;
        }
        saveKotMobilePrinterConfig(config);
        toast.success("KOT printer settings saved");
      } else if (isElectron) {
        const config = buildElectronConfig();
        if (connectionType === "network" && !config.networkIP) {
          toast.error("Enter the printer IP address");
          return;
        }
        if (connectionType === "windows" && !config.windowsPrinterName) {
          toast.error("Select a printer");
          return;
        }
        saveKotElectronConfig(config);
        toast.success("KOT printer settings saved");
      }

      onOpenChange(false);
    } catch {
      toast.error("Failed to save KOT printer settings");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Render sections ---

  const renderElectronContent = () => (
    <div className="space-y-4">
      {/* Connection Type */}
      <div className="space-y-2">
        <Label>Connection Type</Label>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant={connectionType === "network" ? "default" : "outline"}
            className="w-full"
            onClick={() => setConnectionType("network")}
          >
            <Wifi className="mr-2 h-4 w-4" />
            Network (TCP/IP)
          </Button>
          <Button
            variant={connectionType === "windows" ? "default" : "outline"}
            className="w-full"
            onClick={() => setConnectionType("windows")}
          >
            <Printer className="mr-2 h-4 w-4" />
            Windows Printer
          </Button>
        </div>
      </div>

      {/* Network fields */}
      {connectionType === "network" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="kot-printer-ip">Printer IP Address</Label>
            <Input
              id="kot-printer-ip"
              placeholder="192.168.1.100"
              value={networkIP}
              onChange={(e) => setNetworkIP(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kot-printer-port">Port</Label>
            <Input
              id="kot-printer-port"
              type="number"
              placeholder="9100"
              value={networkPort}
              onChange={(e) => setNetworkPort(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Windows printer dropdown */}
      {connectionType === "windows" && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label>Installed Printers</Label>
            <Button variant="ghost" size="sm" onClick={loadPrinters} disabled={loadingPrinters}>
              {loadingPrinters && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Refresh
            </Button>
          </div>
          {installedPrinters.length > 0 ? (
            <Select value={windowsPrinterName} onValueChange={setWindowsPrinterName}>
              <SelectTrigger>
                <SelectValue placeholder="Select a printer" />
              </SelectTrigger>
              <SelectContent>
                {installedPrinters.map((printer) => (
                  <SelectItem key={printer.name} value={printer.name}>
                    {printer.displayName || printer.name}
                    {printer.isDefault ? " (Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loadingPrinters ? "Loading printers..." : "No printers found. Click Refresh."}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={testConnection} disabled={isTesting} variant="outline" size="sm">
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Test Connection
        </Button>
        <Button onClick={printTestKot} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          Print Test KOT
        </Button>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderCapacitorContent = () => (
    <div className="space-y-4">
      {/* IP + Port */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <Label htmlFor="kot-mobile-host">Printer IP Address</Label>
          <Input
            id="kot-mobile-host"
            placeholder="192.168.1.100"
            value={mobileHost}
            onChange={(e) => setMobileHost(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kot-mobile-port">Port</Label>
          <Input
            id="kot-mobile-port"
            type="number"
            placeholder="9100"
            value={mobilePort}
            onChange={(e) => setMobilePort(e.target.value)}
          />
        </div>
      </div>

      {/* Paper Width */}
      <div className="space-y-1">
        <Label>Paper Width</Label>
        <Select
          value={String(mobilePaperWidth)}
          onValueChange={(value) => setMobilePaperWidth(value === "58" ? 58 : 80)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Paper width" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="58">58mm</SelectItem>
            <SelectItem value="80">80mm</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={testConnection} disabled={isTesting} variant="outline" size="sm">
          {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Test Connection
        </Button>
        <Button onClick={printTestKot} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          Print Test KOT
        </Button>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );

  const renderWebContent = () => (
    <div className="space-y-4">
      <div className="flex items-start gap-3 py-4">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm">
            KOT printing requires the <strong>BizArch Desktop App</strong> or the <strong>BizArch Mobile App</strong> for
            direct thermal printer support.
          </p>
          <p className="text-sm text-muted-foreground">
            On the web, KOT will use the browser print dialog as a fallback.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={printTestKot} variant="outline" size="sm">
          <Printer className="mr-2 h-4 w-4" />
          Print Test KOT (Browser)
        </Button>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isElectron ? <Monitor className="h-5 w-5" /> : isCapacitor ? <Wifi className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            KOT Printer Settings
          </DialogTitle>
          <DialogDescription>
            Configure the kitchen printer for sending orders. This can be a different printer from your receipt printer.
          </DialogDescription>
        </DialogHeader>

        {isElectron ? renderElectronContent() : isCapacitor ? renderCapacitorContent() : renderWebContent()}
      </DialogContent>
    </Dialog>
  );
}
