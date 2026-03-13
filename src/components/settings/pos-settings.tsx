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
import { capacitorPrintWithConfig, getDefaultMobilePrinterConfig, getMobilePrinterConfig, isCapacitorEnvironment, openMobileCashDrawer, saveMobilePrinterConfig, testMobilePrinterConnection, type MobilePrinterConfig } from "@/lib/capacitor-print";
import { electronPrintWithConfig, isElectronEnvironment } from "@/lib/electron-print";
import { useLanguage } from "@/lib/i18n";
import {
  DEFAULT_ENABLED_POS_PAYMENT_METHODS,
  POS_PAYMENT_METHODS,
  type POSPaymentMethod,
} from "@/lib/pos/payment-methods";

type ConnectionType = "network" | "windows" | "rawUsb";
type ReceiptRenderMode = ElectronPrinterConfig["receiptRenderMode"];
type ArabicCodePage = ElectronPrinterConfig["arabicCodePage"];

export function POSSettings() {
  const { t } = useLanguage();
  const [receiptPrinting, setReceiptPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState<POSPaymentMethod[]>(
    DEFAULT_ENABLED_POS_PAYMENT_METHODS
  );
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<POSPaymentMethod[]>(
    DEFAULT_ENABLED_POS_PAYMENT_METHODS
  );
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [isSavingPaymentMethods, setIsSavingPaymentMethods] = useState(false);

  // Electron printer config state
  const [isElectron, setIsElectron] = useState(false);
  const [isCapacitor, setIsCapacitor] = useState(false);
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
  const [mobileHost, setMobileHost] = useState("");
  const [mobilePort, setMobilePort] = useState("9100");
  const [mobilePaperWidth, setMobilePaperWidth] = useState<58 | 80>(80);
  const [mobileTimeoutSeconds, setMobileTimeoutSeconds] = useState("10");
  const [mobileCutPaper, setMobileCutPaper] = useState(true);
  const [mobileOpenCashDrawerOnPrint, setMobileOpenCashDrawerOnPrint] = useState(false);

  useEffect(() => {
    fetch("/api/settings/pos-receipt-printing")
      .then((r) => r.json())
      .then((data) => setReceiptPrinting(data.value === "true"))
      .catch(() => { })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/settings/pos-payment-methods")
      .then((r) => r.json())
      .then((data) => {
        const methods = Array.isArray(data.methods) && data.methods.length > 0
          ? data.methods
          : DEFAULT_ENABLED_POS_PAYMENT_METHODS;
        setEnabledPaymentMethods(methods);
        setSavedPaymentMethods(methods);
      })
      .catch(() => {
        toast.error(t("pos.paymentMethodsLoadFailed"));
      })
      .finally(() => setIsLoadingPaymentMethods(false));
  }, [t]);

  useEffect(() => {
    const electron = isElectronEnvironment();
    const capacitor = isCapacitorEnvironment();
    setIsElectron(electron);
    setIsCapacitor(capacitor);

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

    if (capacitor) {
      const config = getMobilePrinterConfig() ?? getDefaultMobilePrinterConfig();
      setMobileHost(config.host);
      setMobilePort(String(config.port));
      setMobilePaperWidth(config.paperWidth);
      setMobileTimeoutSeconds(String(config.timeoutSeconds));
      setMobileCutPaper(config.cutPaper);
      setMobileOpenCashDrawerOnPrint(config.openCashDrawer);
      setReceiptMarginLeft(config.receiptMarginLeft);
      setReceiptMarginRight(config.receiptMarginRight);
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

  const buildMobileConfig = (): MobilePrinterConfig => ({
    connectionType: "tcp",
    host: mobileHost.trim(),
    port: parseInt(mobilePort, 10) || 9100,
    paperWidth: mobilePaperWidth,
    timeoutSeconds: parseInt(mobileTimeoutSeconds, 10) || 10,
    cutPaper: mobileCutPaper,
    openCashDrawer: mobileOpenCashDrawerOnPrint,
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

  const validateMobileConfig = (config: MobilePrinterConfig): string | null => {
    if (!config.host) {
      return t("pos.enterPrinterIp");
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

  const togglePaymentMethod = (method: POSPaymentMethod, checked: boolean) => {
    setEnabledPaymentMethods((current) => {
      if (checked) {
        return POS_PAYMENT_METHODS.filter(
          (paymentMethod) => paymentMethod === method || current.includes(paymentMethod)
        );
      }

      const nextMethods = current.filter((paymentMethod) => paymentMethod !== method);
      return nextMethods.length > 0 ? nextMethods : current;
    });
  };

  const savePaymentMethods = async () => {
    if (enabledPaymentMethods.length === 0) {
      toast.error(t("pos.atLeastOnePaymentMethod"));
      return;
    }

    setIsSavingPaymentMethods(true);
    try {
      const response = await fetch("/api/settings/pos-payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methods: enabledPaymentMethods }),
      });

      if (!response.ok) {
        throw new Error();
      }

      setSavedPaymentMethods(enabledPaymentMethods);
      toast.success(t("pos.paymentMethodsSaved"));
    } catch {
      toast.error(t("pos.paymentMethodsSaveFailed"));
    } finally {
      setIsSavingPaymentMethods(false);
    }
  };

  const savePrinterConfig = async () => {
    if (isCapacitor) {
      const config = buildMobileConfig();
      const validationError = validateMobileConfig(config);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setIsSavingConfig(true);
      try {
        saveMobilePrinterConfig(config);
        toast.success(t("pos.mobilePrinterConfigSaved"));
      } catch {
        toast.error(t("pos.mobilePrinterConfigSaveFailed"));
      } finally {
        setIsSavingConfig(false);
      }
      return;
    }

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
    if (isCapacitor) {
      const config = buildMobileConfig();
      const validationError = validateMobileConfig(config);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setIsTesting(true);
      try {
        const res = await testMobilePrinterConnection(config);
        if (res.success && res.connected) {
          toast.success(t("pos.mobilePrinterReachable"));
        } else {
          toast.error(res.error || t("pos.mobilePrinterUnreachable"));
        }
      } catch {
        toast.error(t("pos.mobileConnectionTestFailed"));
      } finally {
        setIsTesting(false);
      }
      return;
    }

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
    if (isCapacitor) {
      const config = buildMobileConfig();
      const validationError = validateMobileConfig(config);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      try {
        const res = await openMobileCashDrawer(config);
        if (res.success) {
          toast.success("Cash drawer opened");
        } else {
          toast.error(res.error || "Failed to open cash drawer");
        }
      } catch {
        toast.error("Failed to open cash drawer");
      }
      return;
    }

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
    const config = isCapacitor ? buildMobileConfig() : buildConfig();
    const validationError = isCapacitor
      ? validateMobileConfig(config as MobilePrinterConfig)
      : validateConfig(config as ElectronPrinterConfig);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const testReceiptData: ReceiptData = {
      storeName: "TEST RECEIPT",
      arabicName: "فاتورة تجريبية",
      invoiceNumber: "TEST-001",
      date: new Date(),
      items: [
        { name: "Test Item 1", nameAr: "صنف تجريبي ١", quantity: 2, unitPrice: 100, discount: 0, lineTotal: 200 },
        { name: "Test Item 2", nameAr: "صنف تجريبي ٢", quantity: 1, unitPrice: 250, discount: 0, lineTotal: 250 },
      ],
      subtotal: 450,
      taxRate: 15,
      taxAmount: 67.5,
      total: 517.5,
      payments: [{ method: "CASH", amount: 517.5 }],
      change: 0,
    };

    try {
      const res = isCapacitor
        ? await capacitorPrintWithConfig(testReceiptData, config as MobilePrinterConfig)
        : await electronPrintWithConfig(testReceiptData, config as ElectronPrinterConfig);
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

  const paymentMethodsDirty =
    enabledPaymentMethods.join("|") !== savedPaymentMethods.join("|");
  const paymentMethodLabels: Record<POSPaymentMethod, string> = {
    CASH: t("common.cash"),
    CREDIT_CARD: t("pos.card"),
    UPI: "UPI",
    BANK_TRANSFER: t("common.bankTransfer"),
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
                  : isCapacitor
                    ? t("pos.autoPrintReceiptMobile")
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

      <Card>
        <CardHeader>
          <CardTitle>{t("pos.paymentMethods")}</CardTitle>
          <CardDescription>{t("pos.paymentMethodsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {POS_PAYMENT_METHODS.map((method) => {
            const isEnabled = enabledPaymentMethods.includes(method);
            const isLastEnabled =
              isEnabled && enabledPaymentMethods.length === 1;

            return (
              <div
                key={method}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={`payment-method-${method}`}>
                    {paymentMethodLabels[method]}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t("pos.availableInCheckout")}
                  </p>
                </div>
                <Switch
                  id={`payment-method-${method}`}
                  checked={isEnabled}
                  disabled={isLoadingPaymentMethods || isSavingPaymentMethods || isLastEnabled}
                  onCheckedChange={(checked) => togglePaymentMethod(method, checked)}
                />
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t("pos.atLeastOnePaymentMethod")}
            </p>
            <Button
              onClick={savePaymentMethods}
              disabled={isLoadingPaymentMethods || isSavingPaymentMethods || !paymentMethodsDirty}
            >
              {isSavingPaymentMethods ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                t("common.save")
              )}
            </Button>
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
      ) : isCapacitor ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {t("pos.mobileThermalPrinterConfig")}
            </CardTitle>
            <CardDescription>
              {t("pos.mobileThermalPrinterConfigDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="mobile-printer-host">{t("pos.printerIpAddress")}</Label>
                <Input
                  id="mobile-printer-host"
                  placeholder="192.168.1.100"
                  value={mobileHost}
                  onChange={(e) => setMobileHost(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mobile-printer-port">{t("pos.port")}</Label>
                <Input
                  id="mobile-printer-port"
                  type="number"
                  placeholder="9100"
                  value={mobilePort}
                  onChange={(e) => setMobilePort(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t("pos.paperWidth")}</Label>
                <Select
                  value={String(mobilePaperWidth)}
                  onValueChange={(value) => setMobilePaperWidth(value === "58" ? 58 : 80)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("pos.paperWidth")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58">{t("pos.paper58mm")}</SelectItem>
                    <SelectItem value="80">{t("pos.paper80mm")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mobile-timeout">{t("pos.connectionTimeout")}</Label>
                <Input
                  id="mobile-timeout"
                  type="number"
                  min={3}
                  max={60}
                  value={mobileTimeoutSeconds}
                  onChange={(e) => setMobileTimeoutSeconds(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("pos.receiptMargins")}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="mobile-margin-left" className="text-xs text-muted-foreground">
                    {t("pos.leftMargin")} (mm)
                  </Label>
                  <Input
                    id="mobile-margin-left"
                    type="number"
                    min={0}
                    max={15}
                    value={receiptMarginLeft}
                    onChange={(e) => setReceiptMarginLeft(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mobile-margin-right" className="text-xs text-muted-foreground">
                    {t("pos.rightMargin")} (mm)
                  </Label>
                  <Input
                    id="mobile-margin-right"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="mobile-cut-paper">{t("pos.cutPaper")}</Label>
                  <p className="text-xs text-muted-foreground">{t("pos.cutPaperDesc")}</p>
                </div>
                <Switch
                  id="mobile-cut-paper"
                  checked={mobileCutPaper}
                  onCheckedChange={setMobileCutPaper}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="mobile-open-drawer">{t("pos.openDrawerAfterPrint")}</Label>
                  <p className="text-xs text-muted-foreground">{t("pos.openDrawerAfterPrintDesc")}</p>
                </div>
                <Switch
                  id="mobile-open-drawer"
                  checked={mobileOpenCashDrawerOnPrint}
                  onCheckedChange={setMobileOpenCashDrawerOnPrint}
                />
              </div>
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
