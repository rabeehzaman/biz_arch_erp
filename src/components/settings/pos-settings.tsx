"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Monitor, Printer, RefreshCw, Usb, Wifi, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { ReceiptData } from "@/components/pos/receipt";
import { electronPrintWithConfig, isElectronEnvironment } from "@/lib/electron-print";
import { useLanguage } from "@/lib/i18n";

type ConnectionType = "network" | "windows" | "rawUsb";
type ReceiptRenderMode = ElectronPrinterConfig["receiptRenderMode"];
type ArabicCodePage = ElectronPrinterConfig["arabicCodePage"];

export function POSSettings() {
  const { t } = useLanguage();
  const [receiptPrinting, setReceiptPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Electron printer config state
  const [isElectron, setIsElectron] = useState(false);
  const [connectionType, setConnectionType] = useState<ConnectionType>("windows");
  const [receiptRenderMode, setReceiptRenderMode] = useState<ReceiptRenderMode>("htmlDriver");
  const [arabicCodePage, setArabicCodePage] = useState<ArabicCodePage>("pc864");
  const [networkIP, setNetworkIP] = useState("");
  const [networkPort, setNetworkPort] = useState("9100");
  const [windowsPrinterName, setWindowsPrinterName] = useState("");
  const [usbVendorId, setUsbVendorId] = useState<number | null>(null);
  const [usbProductId, setUsbProductId] = useState<number | null>(null);
  const [usbSerialNumber, setUsbSerialNumber] = useState("");
  const [installedPrinters, setInstalledPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [usbPrinters, setUsbPrinters] = useState<ElectronUsbPrinter[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [loadingUsbPrinters, setLoadingUsbPrinters] = useState(false);
  const [receiptMarginLeft, setReceiptMarginLeft] = useState(3);
  const [receiptMarginRight, setReceiptMarginRight] = useState(5);
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    fetch("/api/settings/pos-receipt-printing")
      .then((r) => r.json())
      .then((data) => setReceiptPrinting(data.value === "true"))
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const electron = isElectronEnvironment();
    setIsElectron(electron);

    if (electron && window.electronPOS) {
      window.electronPOS.getPrinterConfig().then((res) => {
        if (res.success && res.config) {
          setConnectionType(res.config.connectionType || "windows");
          setReceiptRenderMode(res.config.receiptRenderMode || "htmlDriver");
          setArabicCodePage(res.config.arabicCodePage || "pc864");
          setNetworkIP(res.config.networkIP || "");
          setNetworkPort(String(res.config.networkPort || 9100));
          setWindowsPrinterName(res.config.windowsPrinterName || "");
          setUsbVendorId(res.config.usbVendorId ?? null);
          setUsbProductId(res.config.usbProductId ?? null);
          setUsbSerialNumber(res.config.usbSerialNumber || "");
          setReceiptMarginLeft(res.config.receiptMarginLeft ?? 3);
          setReceiptMarginRight(res.config.receiptMarginRight ?? 5);
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

  const loadUsbPrinters = useCallback(async () => {
    if (!window.electronPOS) return;
    setLoadingUsbPrinters(true);
    try {
      const res = await window.electronPOS.listUsbPrinters();
      if (res.success && res.printers) {
        setUsbPrinters(res.printers);
        if ((usbVendorId === null || usbProductId === null) && res.printers.length > 0) {
          setUsbVendorId(res.printers[0].vendorId);
          setUsbProductId(res.printers[0].productId);
          setUsbSerialNumber(res.printers[0].serialNumber || "");
        }
      }
    } catch {
      toast.error("Failed to list raw USB printers");
    } finally {
      setLoadingUsbPrinters(false);
    }
  }, [usbProductId, usbVendorId]);

  useEffect(() => {
    if (!isElectron) return;

    if (connectionType === "windows") {
      loadPrinters();
    }

    if (connectionType === "rawUsb") {
      loadUsbPrinters();
    }
  }, [isElectron, connectionType, loadPrinters, loadUsbPrinters]);

  const buildConfig = (): ElectronPrinterConfig => ({
    connectionType,
    receiptRenderMode,
    arabicCodePage,
    networkIP: networkIP.trim(),
    networkPort: parseInt(networkPort, 10) || 9100,
    windowsPrinterName,
    usbVendorId,
    usbProductId,
    usbSerialNumber: usbSerialNumber.trim(),
    receiptMarginLeft,
    receiptMarginRight,
  });

  const validateConfig = (config: ElectronPrinterConfig): string | null => {
    if (config.connectionType === "network" && !config.networkIP) {
      return t("pos.enterPrinterIp");
    }

    if (config.connectionType === "windows" && !config.windowsPrinterName) {
      return t("pos.selectPrinter");
    }

    if (config.receiptRenderMode === "htmlDriver" && config.connectionType !== "windows") {
      return t("pos.windowsDriverModeRequiresWindows");
    }

    if (
      config.connectionType === "rawUsb" &&
      (config.usbVendorId === null || config.usbProductId === null)
    ) {
      return t("pos.selectRawUsbPrinter");
    }

    return null;
  };

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

    const config = buildConfig();
    const validationError = validateConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSavingConfig(true);
    try {
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

    const config = buildConfig();
    const validationError = validateConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsTesting(true);
    try {
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

    const config = buildConfig();
    const validationError = validateConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const res = await window.electronPOS.openCashDrawer(config);
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

    const config = buildConfig();
    const validationError = validateConfig(config);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const testReceiptData: ReceiptData = {
      storeName: "TEST RECEIPT",
      invoiceNumber: "TEST-001",
      date: new Date(),
      items: [
        { name: "Test Item 1", quantity: 2, unitPrice: 100, discount: 0, lineTotal: 200 },
        { name: "Test Item 2", quantity: 1, unitPrice: 250, discount: 0, lineTotal: 250 },
      ],
      subtotal: 450,
      taxRate: 15,
      taxAmount: 67.5,
      total: 517.5,
      payments: [{ method: "CASH", amount: 517.5 }],
      change: 0,
    };

    try {
      const res = await electronPrintWithConfig(testReceiptData, config);
      if (res.success) {
        toast.success("Test receipt printed");
      } else {
        toast.error(res.error || "Test print failed");
      }
    } catch {
      toast.error("Test print failed");
    }
  };

  const rawUsbSelectValue = usbVendorId !== null && usbProductId !== null
    ? `${usbVendorId}|${usbProductId}|${usbSerialNumber}`
    : "";

  const handleRawUsbSelect = (value: string) => {
    const [vendorIdRaw, productIdRaw, ...serialParts] = value.split("|");
    setUsbVendorId(Number(vendorIdRaw));
    setUsbProductId(Number(productIdRaw));
    setUsbSerialNumber(serialParts.join("|"));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            {t("pos.posReceipts")}
          </CardTitle>
          <CardDescription>
            {t("pos.posReceiptsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="receipt-printing">{t("pos.autoPrintReceipt")}</Label>
              <p className="text-sm text-muted-foreground">
                {isElectron
                  ? t("pos.autoPrintReceiptElectron")
                  : t("pos.autoPrintReceiptWeb")}
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
              {t("pos.thermalPrinterConfig")}
            </CardTitle>
            <CardDescription>
              {t("pos.thermalPrinterConfigDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>{t("pos.connectionType")}</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  variant={connectionType === "network" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setConnectionType("network")}
                >
                  <Wifi className="mr-2 h-4 w-4" />
                  {t("pos.networkTcpIp")}
                </Button>
                <Button
                  variant={connectionType === "windows" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setConnectionType("windows")}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {t("pos.windowsPrinter")}
                </Button>
                <Button
                  variant={connectionType === "rawUsb" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setConnectionType("rawUsb")}
                >
                  <Usb className="mr-2 h-4 w-4" />
                  {t("pos.rawUsb")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("pos.receiptMode")}</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  variant={receiptRenderMode === "htmlDriver" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setReceiptRenderMode("htmlDriver")}
                >
                  {t("pos.htmlDriverSpooler")}
                </Button>
                <Button
                  variant={receiptRenderMode === "htmlRaster" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setReceiptRenderMode("htmlRaster")}
                >
                  {t("pos.htmlRasterEscpos")}
                </Button>
                <Button
                  variant={receiptRenderMode === "escposText" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setReceiptRenderMode("escposText")}
                >
                  {t("pos.escposTextRaw")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {receiptRenderMode === "htmlDriver"
                  ? t("pos.htmlDriverSpoolerDesc")
                  : receiptRenderMode === "htmlRaster"
                    ? t("pos.htmlRasterEscposDesc")
                    : t("pos.escposTextRawDesc")}
              </p>
              {receiptRenderMode === "htmlDriver" && connectionType !== "windows" ? (
                <p className="text-xs text-amber-600">
                  {t("pos.windowsDriverModeRequiresWindows")}
                </p>
              ) : null}
            </div>

            {connectionType === "network" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label htmlFor="printer-ip">{t("pos.printerIpAddress")}</Label>
                    <Input
                      id="printer-ip"
                      placeholder="192.168.1.100"
                      value={networkIP}
                      onChange={(e) => setNetworkIP(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="printer-port">{t("pos.port")}</Label>
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

            {connectionType === "windows" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>{t("pos.installedPrinters")}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadPrinters}
                      disabled={loadingPrinters}
                    >
                      {loadingPrinters ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {t("pos.refresh")}
                    </Button>
                  </div>
                  {installedPrinters.length > 0 ? (
                    <Select value={windowsPrinterName} onValueChange={setWindowsPrinterName}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("pos.selectPrinter")} />
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
                      {loadingPrinters ? t("pos.loadingPrinters") : t("pos.noPrintersFound")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {connectionType === "rawUsb" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label>{t("pos.rawUsbPrinters")}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadUsbPrinters}
                      disabled={loadingUsbPrinters}
                    >
                      {loadingUsbPrinters ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {t("pos.refresh")}
                    </Button>
                  </div>
                  {usbPrinters.length > 0 ? (
                    <Select value={rawUsbSelectValue} onValueChange={handleRawUsbSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("pos.selectRawUsbPrinter")} />
                      </SelectTrigger>
                      <SelectContent>
                        {usbPrinters.map((printer) => (
                          <SelectItem
                            key={printer.id}
                            value={`${printer.vendorId ?? ""}|${printer.productId ?? ""}|${printer.serialNumber || ""}`}
                          >
                            {printer.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {loadingUsbPrinters ? t("pos.loadingPrinters") : t("pos.noUsbPrintersFound")}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("pos.rawUsbWarning")}
                </p>
              </div>
            )}

            {receiptRenderMode === "escposText" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>{t("pos.arabicCodePage")}</Label>
                  <Select value={arabicCodePage} onValueChange={(value) => setArabicCodePage(value as ArabicCodePage)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("pos.arabicCodePage")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pc864">{t("pos.pc864Recommended")}</SelectItem>
                      <SelectItem value="wpc1256">{t("pos.wpc1256Compatibility")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("pos.arabicCodePageDesc")}
                </p>
              </div>
            )}

            {/* Receipt Margins */}
            <div className="space-y-3">
              <Label>{t("pos.receiptMargins")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="margin-left" className="text-xs text-muted-foreground">
                    {t("pos.leftMargin")} (mm)
                  </Label>
                  <Input
                    id="margin-left"
                    type="number"
                    min={0}
                    max={15}
                    value={receiptMarginLeft}
                    onChange={(e) => setReceiptMarginLeft(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="margin-right" className="text-xs text-muted-foreground">
                    {t("pos.rightMargin")} (mm)
                  </Label>
                  <Input
                    id="margin-right"
                    type="number"
                    min={0}
                    max={15}
                    value={receiptMarginRight}
                    onChange={(e) => setReceiptMarginRight(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("pos.receiptMarginsDesc")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={testConnection} disabled={isTesting} variant="outline">
                {isTesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {t("pos.testConnection")}
              </Button>
              <Button onClick={openCashDrawer} variant="outline">
                {t("pos.openCashDrawer")}
              </Button>
              <Button onClick={printTestReceipt} variant="outline">
                <Printer className="mr-2 h-4 w-4" />
                {t("pos.printTestReceipt")}
              </Button>
              <Button
                onClick={async () => {
                  if (!window.electronPOS?.clearCache) return;
                  setIsClearingCache(true);
                  try {
                    const res = await window.electronPOS.clearCache();
                    if (res.success) {
                      toast.success(t("pos.cacheCleared"));
                    } else {
                      toast.error(res.error || "Failed to clear cache");
                    }
                  } catch {
                    toast.error("Failed to clear cache");
                  } finally {
                    setIsClearingCache(false);
                  }
                }}
                disabled={isClearingCache}
                variant="outline"
              >
                {isClearingCache ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("pos.clearCache")}
              </Button>
            </div>

            <Button onClick={savePrinterConfig} disabled={isSavingConfig} className="w-full">
              {isSavingConfig ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("pos.savePrinterConfig")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              {t("pos.silentThermalPrinting")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: t("pos.installDesktopApp").replace(
                      "BizArch Desktop App",
                      "<strong>BizArch Desktop App</strong>"
                    ),
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  {t("pos.desktopAppSupports")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
