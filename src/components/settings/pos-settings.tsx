"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Monitor, Wifi, Usb, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isElectronEnvironment } from "@/lib/electron-print";

export function POSSettings() {
  const [receiptPrinting, setReceiptPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Electron printer config state
  const [isElectron, setIsElectron] = useState(false);
  const [connectionType, setConnectionType] = useState<"network" | "usb">("network");
  const [networkIP, setNetworkIP] = useState("192.168.1.100");
  const [networkPort, setNetworkPort] = useState("9100");
  const [usbPrinterName, setUsbPrinterName] = useState("");
  const [installedPrinters, setInstalledPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  useEffect(() => {
    fetch("/api/settings/pos-receipt-printing")
      .then((r) => r.json())
      .then((data) => setReceiptPrinting(data.value === "true"))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Load Electron printer config on mount
  useEffect(() => {
    const electron = isElectronEnvironment();
    setIsElectron(electron);

    if (electron && window.electronPOS) {
      window.electronPOS.getPrinterConfig().then((res) => {
        if (res.success && res.config) {
          setConnectionType(res.config.connectionType || "network");
          setNetworkIP(res.config.networkIP || "192.168.1.100");
          setNetworkPort(String(res.config.networkPort || 9100));
          setUsbPrinterName(res.config.usbPrinterName || "");
        }
      });
    }
  }, []);

  const loadPrinters = useCallback(async () => {
    if (!window.electronPOS) return;
    setLoadingPrinters(true);
    try {
      const res = await window.electronPOS.listPrinters();
      if (res.success && res.printers) {
        setInstalledPrinters(res.printers);
        if (!usbPrinterName && res.printers.length > 0) {
          const defaultPrinter = res.printers.find((p) => p.isDefault);
          setUsbPrinterName(defaultPrinter?.name || res.printers[0].name);
        }
      }
    } catch {
      toast.error("Failed to list printers");
    } finally {
      setLoadingPrinters(false);
    }
  }, [usbPrinterName]);

  // Load printers when switching to USB mode
  useEffect(() => {
    if (isElectron && connectionType === "usb") {
      loadPrinters();
    }
  }, [isElectron, connectionType, loadPrinters]);

  const handleToggle = async (checked: boolean) => {
    const prev = receiptPrinting;
    setReceiptPrinting(checked);

    try {
      const res = await fetch("/api/settings/pos-receipt-printing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: checked ? "true" : "false" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Receipt printing ${checked ? "enabled" : "disabled"}`);
    } catch {
      setReceiptPrinting(prev);
      toast.error("Failed to update receipt printing setting");
    }
  };

  const savePrinterConfig = async () => {
    if (!window.electronPOS) return;
    setIsSavingConfig(true);
    try {
      const config = {
        connectionType,
        networkIP,
        networkPort: parseInt(networkPort, 10) || 9100,
        usbPrinterName,
      };
      const res = await window.electronPOS.savePrinterConfig(config);
      if (res.success) {
        toast.success("Printer configuration saved");
      } else {
        toast.error("Failed to save printer configuration");
      }
    } catch {
      toast.error("Failed to save printer configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const testConnection = async () => {
    if (!window.electronPOS) return;
    setIsTesting(true);
    try {
      const config = {
        connectionType,
        networkIP,
        networkPort: parseInt(networkPort, 10) || 9100,
        usbPrinterName,
      };
      const res = await window.electronPOS.testPrinter(config);
      if (res.success && res.connected) {
        toast.success("Printer is connected and reachable");
      } else {
        toast.error(res.error || "Printer is not reachable");
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const openCashDrawer = async () => {
    if (!window.electronPOS) return;
    try {
      const res = await window.electronPOS.openCashDrawer();
      if (res.success) {
        toast.success("Cash drawer opened");
      } else {
        toast.error(res.error || "Failed to open cash drawer");
      }
    } catch {
      toast.error("Failed to open cash drawer");
    }
  };

  const printTestReceipt = async () => {
    if (!window.electronPOS) return;
    try {
      const res = await window.electronPOS.printReceipt({
        header: { storeName: "TEST RECEIPT" },
        invoiceNo: "TEST-001",
        date: new Date().toLocaleString(),
        items: [
          { name: "Test Item 1", qty: 2, price: 100 },
          { name: "Test Item 2", qty: 1, price: 250 },
        ],
        totals: { subtotal: 450, tax: 67.5, total: 517.5 },
        footer: "This is a test receipt",
        cutPaper: true,
      });
      if (res.success) {
        toast.success("Test receipt printed");
      } else {
        toast.error(res.error || "Test print failed");
      }
    } catch {
      toast.error("Test print failed");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            POS Receipts
          </CardTitle>
          <CardDescription>
            Configure receipt printing for the Point of Sale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="receipt-printing">Auto-print receipt after sale</Label>
              <p className="text-sm text-muted-foreground">
                {isElectron
                  ? "Automatically print receipt to thermal printer after each POS checkout (silent, no dialog)"
                  : "Automatically open the print dialog with a thermal receipt after each POS checkout"}
              </p>
            </div>
            <Switch
              id="receipt-printing"
              checked={receiptPrinting}
              onCheckedChange={handleToggle}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {isElectron ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Thermal Printer Configuration
            </CardTitle>
            <CardDescription>
              Configure the thermal printer connected to this POS terminal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Type */}
            <div className="space-y-3">
              <Label>Connection Type</Label>
              <div className="flex gap-3">
                <Button
                  variant={connectionType === "network" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setConnectionType("network")}
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Network (TCP/IP)
                </Button>
                <Button
                  variant={connectionType === "usb" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setConnectionType("usb")}
                >
                  <Usb className="h-4 w-4 mr-2" />
                  USB Printer
                </Button>
              </div>
            </div>

            {/* Network Config */}
            {connectionType === "network" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="printer-ip">Printer IP Address</Label>
                    <Input
                      id="printer-ip"
                      placeholder="192.168.1.100"
                      value={networkIP}
                      onChange={(e) => setNetworkIP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="printer-port">Port</Label>
                    <Input
                      id="printer-port"
                      type="number"
                      placeholder="9100"
                      value={networkPort}
                      onChange={(e) => setNetworkPort(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* USB Config */}
            {connectionType === "usb" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>Installed Printers</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadPrinters}
                      disabled={loadingPrinters}
                    >
                      {loadingPrinters ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Refresh
                    </Button>
                  </div>
                  {installedPrinters.length > 0 ? (
                    <Select value={usbPrinterName} onValueChange={setUsbPrinterName}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a printer" />
                      </SelectTrigger>
                      <SelectContent>
                        {installedPrinters.map((p) => (
                          <SelectItem key={p.name} value={p.name}>
                            {p.displayName || p.name}
                            {p.isDefault ? " (Default)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loadingPrinters ? "Loading printers..." : "No printers found. Make sure your printer is installed in Windows."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={testConnection} disabled={isTesting} variant="outline">
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Button onClick={openCashDrawer} variant="outline">
                Open Cash Drawer
              </Button>
              <Button onClick={printTestReceipt} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print Test Receipt
              </Button>
            </div>

            {/* Save */}
            <Button onClick={savePrinterConfig} disabled={isSavingConfig} className="w-full">
              {isSavingConfig ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Printer Configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Silent Thermal Printing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm">
                  Install the <strong>BizArch Desktop App</strong> for silent thermal printing without print dialogs.
                </p>
                <p className="text-sm text-muted-foreground">
                  The desktop app supports network printers (TCP/IP port 9100) and USB printers via Windows print spooler.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
