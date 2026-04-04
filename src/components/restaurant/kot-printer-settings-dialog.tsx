"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Monitor,
  Plus,
  Printer,
  Trash2,
  Wifi,
  XCircle,
  Pencil,
} from "lucide-react";
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
  getKotMultiPrinterConfig,
  saveKotMultiPrinterConfig,
  generateStationId,
  printKOT,
  type KOTReceiptData,
  type KOTPrinterStation,
  type KOTMultiPrinterConfig,
} from "@/lib/restaurant/kot-print";

interface KOTPrinterSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

function getDefaultMobileConfig(): MobilePrinterConfig {
  return {
    connectionType: "tcp",
    host: "",
    port: 9100,
    paperWidth: 80,
    timeoutSeconds: 10,
    cutPaper: true,
    openCashDrawer: false,
    receiptMarginLeft: 2,
    receiptMarginRight: 2,
  };
}

function getDefaultElectronConfig(): ElectronPrinterConfig {
  return {
    connectionType: "network",
    receiptRenderMode: "htmlRaster",
    arabicCodePage: "pc864",
    networkIP: "",
    networkPort: 9100,
    windowsPrinterName: "",
    usbVendorId: null,
    usbProductId: null,
    usbSerialNumber: "",
    receiptMarginLeft: 2,
    receiptMarginRight: 2,
  };
}

export function KOTPrinterSettingsDialog({ open, onOpenChange }: KOTPrinterSettingsDialogProps) {
  const [isElectron, setIsElectron] = useState(false);
  const [isCapacitor, setIsCapacitor] = useState(false);

  // Multi-printer state
  const [stations, setStations] = useState<KOTPrinterStation[]>([]);
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editing state for the currently selected station
  const [editName, setEditName] = useState("");
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);

  // Electron editing state
  const [editConnectionType, setEditConnectionType] = useState<"network" | "windows">("network");
  const [editNetworkIP, setEditNetworkIP] = useState("");
  const [editNetworkPort, setEditNetworkPort] = useState("9100");
  const [editWindowsPrinterName, setEditWindowsPrinterName] = useState("");
  const [installedPrinters, setInstalledPrinters] = useState<{ name: string; displayName: string; isDefault: boolean }[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);

  // Capacitor editing state
  const [editMobileHost, setEditMobileHost] = useState("");
  const [editMobilePort, setEditMobilePort] = useState("9100");
  const [editMobilePaperWidth, setEditMobilePaperWidth] = useState<58 | 80>(80);

  const [isTesting, setIsTesting] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useSWR<CategoryData[]>(
    open ? "/api/product-categories" : null,
    fetcher,
  );

  // Load config when dialog opens
  useEffect(() => {
    if (!open) return;

    const electron = isElectronEnvironment();
    const capacitor = isCapacitorEnvironment();
    setIsElectron(electron);
    setIsCapacitor(capacitor);

    const config = getKotMultiPrinterConfig();
    if (config && config.stations.length > 0) {
      setStations(config.stations);
    } else {
      // Start with one default station
      setStations([{
        id: generateStationId(),
        name: "Kitchen",
        categoryIds: [],
        isDefault: true,
        mobileConfig: capacitor ? getDefaultMobileConfig() : null,
        electronConfig: electron ? getDefaultElectronConfig() : null,
      }]);
    }
    setEditingStationId(null);
  }, [open]);

  // Load installed printers for Electron
  const loadPrinters = useCallback(async () => {
    if (!window.electronPOS) return;
    setLoadingPrinters(true);
    try {
      const res = await window.electronPOS.listPrinters();
      if (res.success && res.printers) {
        setInstalledPrinters(res.printers);
      }
    } catch {
      toast.error("Failed to list printers");
    } finally {
      setLoadingPrinters(false);
    }
  }, []);

  // Start editing a station
  const startEditing = (station: KOTPrinterStation) => {
    setEditingStationId(station.id);
    setEditName(station.name);
    setEditIsDefault(station.isDefault);
    setEditCategoryIds([...station.categoryIds]);

    if (isElectron && station.electronConfig) {
      const ec = station.electronConfig;
      setEditConnectionType(ec.connectionType === "windows" ? "windows" : "network");
      setEditNetworkIP(ec.networkIP || "");
      setEditNetworkPort(String(ec.networkPort || 9100));
      setEditWindowsPrinterName(ec.windowsPrinterName || "");
    } else if (isElectron) {
      setEditConnectionType("network");
      setEditNetworkIP("");
      setEditNetworkPort("9100");
      setEditWindowsPrinterName("");
    }

    if (isCapacitor && station.mobileConfig) {
      const mc = station.mobileConfig;
      setEditMobileHost(mc.host || "");
      setEditMobilePort(String(mc.port || 9100));
      setEditMobilePaperWidth(mc.paperWidth === 58 ? 58 : 80);
    } else if (isCapacitor) {
      setEditMobileHost("");
      setEditMobilePort("9100");
      setEditMobilePaperWidth(80);
    }

    if (isElectron && station.electronConfig?.connectionType === "windows") {
      loadPrinters();
    }
  };

  // Save editing back to station list
  const saveStationEdit = () => {
    setStations(prev => prev.map(s => {
      if (s.id !== editingStationId) {
        // If we're setting a new default, unset others
        if (editIsDefault && s.isDefault) return { ...s, isDefault: false };
        return s;
      }

      const updatedStation: KOTPrinterStation = {
        ...s,
        name: editName.trim() || "Kitchen",
        isDefault: editIsDefault,
        categoryIds: editCategoryIds,
        mobileConfig: isCapacitor ? {
          connectionType: "tcp",
          host: editMobileHost.trim(),
          port: parseInt(editMobilePort, 10) || 9100,
          paperWidth: editMobilePaperWidth,
          timeoutSeconds: 10,
          cutPaper: true,
          openCashDrawer: false,
          receiptMarginLeft: 2,
          receiptMarginRight: 2,
        } : s.mobileConfig,
        electronConfig: isElectron ? {
          connectionType: editConnectionType,
          receiptRenderMode: editConnectionType === "windows" ? "htmlDriver" : "htmlRaster",
          arabicCodePage: "pc864",
          networkIP: editNetworkIP.trim(),
          networkPort: parseInt(editNetworkPort, 10) || 9100,
          windowsPrinterName: editWindowsPrinterName,
          usbVendorId: null,
          usbProductId: null,
          usbSerialNumber: "",
          receiptMarginLeft: 2,
          receiptMarginRight: 2,
        } : s.electronConfig,
      };

      return updatedStation;
    }));
    setEditingStationId(null);
  };

  // Add a new station
  const addStation = () => {
    const newStation: KOTPrinterStation = {
      id: generateStationId(),
      name: "",
      categoryIds: [],
      isDefault: stations.length === 0,
      mobileConfig: isCapacitor ? getDefaultMobileConfig() : null,
      electronConfig: isElectron ? getDefaultElectronConfig() : null,
    };
    setStations(prev => [...prev, newStation]);
    startEditing(newStation);
  };

  // Remove a station
  const removeStation = (stationId: string) => {
    const station = stations.find(s => s.id === stationId);
    if (station?.isDefault && stations.length > 1) {
      toast.error("Cannot delete the default station. Set another station as default first.");
      return;
    }
    setStations(prev => {
      const remaining = prev.filter(s => s.id !== stationId);
      // If we removed the only default, make the first one default
      if (remaining.length > 0 && !remaining.some(s => s.isDefault)) {
        remaining[0] = { ...remaining[0], isDefault: true };
      }
      return remaining;
    });
    if (editingStationId === stationId) setEditingStationId(null);
  };

  // Test connection for the station being edited
  const testConnection = async () => {
    setIsTesting(true);
    try {
      if (isCapacitor) {
        if (!editMobileHost.trim()) {
          toast.error("Enter the printer IP address");
          return;
        }
        const config: MobilePrinterConfig = {
          connectionType: "tcp",
          host: editMobileHost.trim(),
          port: parseInt(editMobilePort, 10) || 9100,
          paperWidth: editMobilePaperWidth,
          timeoutSeconds: 10,
          cutPaper: true,
          openCashDrawer: false,
          receiptMarginLeft: 2,
          receiptMarginRight: 2,
        };
        const res = await testMobilePrinterConnection(config);
        if (res.success && res.connected) {
          toast.success("Printer is reachable");
        } else {
          toast.error(res.error || "Printer is not reachable");
        }
      } else if (isElectron && window.electronPOS) {
        const config: ElectronPrinterConfig = {
          connectionType: editConnectionType,
          receiptRenderMode: editConnectionType === "windows" ? "htmlDriver" : "htmlRaster",
          arabicCodePage: "pc864",
          networkIP: editNetworkIP.trim(),
          networkPort: parseInt(editNetworkPort, 10) || 9100,
          windowsPrinterName: editWindowsPrinterName,
          usbVendorId: null,
          usbProductId: null,
          usbSerialNumber: "",
          receiptMarginLeft: 2,
          receiptMarginRight: 2,
        };
        const res = await window.electronPOS.testPrinter(config);
        if (res.success && res.connected) {
          toast.success("Printer connected");
        } else {
          toast.error(res.error || "Printer not reachable");
        }
      }
    } catch {
      toast.error("Connection test failed");
    } finally {
      setIsTesting(false);
    }
  };

  // Print test KOT to the station being edited
  const printTestKot = async () => {
    // Save current edits first
    saveStationEdit();

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
      stationName: editName.trim() || undefined,
      items: [
        { name: "Chicken Biryani", nameAr: "\u0628\u0631\u064A\u0627\u0646\u064A \u062F\u062C\u0627\u062C", quantity: 2, modifiers: ["Extra Spicy", "No Onion"], isNew: true },
        { name: "Butter Naan", nameAr: "\u0646\u0627\u0646 \u0628\u0627\u0644\u0632\u0628\u062F\u0629", quantity: 4 },
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

  // Save all stations to localStorage
  const handleSave = () => {
    setIsSaving(true);
    try {
      // Validate: at least one station should have a host/printer configured
      const hasConfigured = stations.some(s => {
        if (isCapacitor) return !!s.mobileConfig?.host;
        if (isElectron) {
          if (s.electronConfig?.connectionType === "windows") return !!s.electronConfig.windowsPrinterName;
          return !!s.electronConfig?.networkIP;
        }
        return false;
      });

      if (!hasConfigured && stations.length > 0) {
        toast.error("At least one station needs a printer configured");
        return;
      }

      // Ensure exactly one default
      if (stations.length > 0 && !stations.some(s => s.isDefault)) {
        stations[0].isDefault = true;
      }

      const config: KOTMultiPrinterConfig = {
        version: 2,
        stations,
      };
      saveKotMultiPrinterConfig(config);
      toast.success("KOT printer settings saved");
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  // Get categories assigned to other stations (for disabling in checkboxes)
  const getCategoryAssignments = (): Map<string, string> => {
    const map = new Map<string, string>(); // categoryId → station name
    for (const s of stations) {
      if (s.id === editingStationId) continue;
      for (const catId of s.categoryIds) {
        map.set(catId, s.name);
      }
    }
    return map;
  };

  // Get display info for a station
  const getStationSummary = (station: KOTPrinterStation): string => {
    if (isCapacitor && station.mobileConfig?.host) {
      return `${station.mobileConfig.host}:${station.mobileConfig.port}`;
    }
    if (isElectron && station.electronConfig) {
      if (station.electronConfig.connectionType === "windows") {
        return station.electronConfig.windowsPrinterName || "No printer selected";
      }
      return station.electronConfig.networkIP
        ? `${station.electronConfig.networkIP}:${station.electronConfig.networkPort}`
        : "No IP configured";
    }
    return "Not configured";
  };

  const getCategoryNames = (categoryIds: string[]): string => {
    if (categoryIds.length === 0) return "All unassigned categories";
    return categoryIds
      .map(id => categories.find(c => c.id === id)?.name ?? id)
      .join(", ");
  };

  // ── Station List View ──────────────────────────────────────

  const renderStationList = () => (
    <div className="space-y-3">
      {stations.map(station => (
        <div
          key={station.id}
          className="border rounded-lg p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">
                {station.name || "Unnamed Station"}
              </span>
              {station.isDefault && (
                <Badge variant="secondary" className="text-xs">Default</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => startEditing(station)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {stations.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStation(station.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{getStationSummary(station)}</p>
          <p className="text-xs text-muted-foreground">{getCategoryNames(station.categoryIds)}</p>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addStation} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Printer Station
      </Button>

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

  // ── Station Edit View ──────────────────────────────────────

  const renderStationEdit = () => {
    const categoryAssignments = getCategoryAssignments();

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { saveStationEdit(); }} className="mb-1 -ml-2">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to stations
        </Button>

        {/* Station Name */}
        <div className="space-y-1">
          <Label htmlFor="station-name">Station Name</Label>
          <Input
            id="station-name"
            placeholder="e.g. Hot Kitchen, Bar, Cold Kitchen"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
        </div>

        {/* Default toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="station-default"
            checked={editIsDefault}
            onCheckedChange={(checked) => setEditIsDefault(!!checked)}
          />
          <Label htmlFor="station-default" className="text-sm cursor-pointer">
            Default station (receives items not assigned to other stations)
          </Label>
        </div>

        {/* Capacitor: IP + Port + Paper Width */}
        {isCapacitor && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="station-host">Printer IP Address</Label>
                <Input
                  id="station-host"
                  placeholder="192.168.1.100"
                  value={editMobileHost}
                  onChange={(e) => setEditMobileHost(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="station-port">Port</Label>
                <Input
                  id="station-port"
                  type="number"
                  placeholder="9100"
                  value={editMobilePort}
                  onChange={(e) => setEditMobilePort(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Paper Width</Label>
              <Select
                value={String(editMobilePaperWidth)}
                onValueChange={(v) => setEditMobilePaperWidth(v === "58" ? 58 : 80)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Electron: Connection Type + fields */}
        {isElectron && (
          <>
            <div className="space-y-2">
              <Label>Connection Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={editConnectionType === "network" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setEditConnectionType("network")}
                >
                  <Wifi className="mr-2 h-4 w-4" />
                  Network
                </Button>
                <Button
                  variant={editConnectionType === "windows" ? "default" : "outline"}
                  className="w-full"
                  onClick={() => {
                    setEditConnectionType("windows");
                    loadPrinters();
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Windows
                </Button>
              </div>
            </div>

            {editConnectionType === "network" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="station-ip">Printer IP</Label>
                  <Input
                    id="station-ip"
                    placeholder="192.168.1.100"
                    value={editNetworkIP}
                    onChange={(e) => setEditNetworkIP(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="station-eport">Port</Label>
                  <Input
                    id="station-eport"
                    type="number"
                    placeholder="9100"
                    value={editNetworkPort}
                    onChange={(e) => setEditNetworkPort(e.target.value)}
                  />
                </div>
              </div>
            )}

            {editConnectionType === "windows" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Installed Printers</Label>
                  <Button variant="ghost" size="sm" onClick={loadPrinters} disabled={loadingPrinters}>
                    {loadingPrinters && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Refresh
                  </Button>
                </div>
                {installedPrinters.length > 0 ? (
                  <Select value={editWindowsPrinterName} onValueChange={setEditWindowsPrinterName}>
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
                    {loadingPrinters ? "Loading..." : "No printers found. Click Refresh."}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Category Assignment */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <Label>Assigned Categories</Label>
            {editIsDefault && (
              <p className="text-xs text-muted-foreground">
                This is the default station. It will also receive items from categories not assigned to other stations.
              </p>
            )}
            <div className="max-h-40 overflow-y-auto space-y-1.5 border rounded-md p-2">
              {categories.map(cat => {
                const assignedTo = categoryAssignments.get(cat.id);
                const isChecked = editCategoryIds.includes(cat.id);
                const isDisabled = !!assignedTo;

                return (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditCategoryIds(prev => [...prev, cat.id]);
                        } else {
                          setEditCategoryIds(prev => prev.filter(id => id !== cat.id));
                        }
                      }}
                    />
                    <Label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer flex-1">
                      {cat.name}
                      {isDisabled && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (assigned to {assignedTo})
                        </span>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
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
      </div>
    );
  };

  // ── Web fallback ────────────────────────────────────────────

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
      <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
        Close
      </Button>
    </div>
  );

  // ── Main render ─────────────────────────────────────────────

  const isNative = isElectron || isCapacitor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isElectron ? <Monitor className="h-5 w-5" /> : isCapacitor ? <Wifi className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            KOT Printer Settings
          </DialogTitle>
          <DialogDescription>
            {isNative
              ? "Configure kitchen printer stations. Assign product categories to route orders to different printers."
              : "Configure the kitchen printer for sending orders."
            }
          </DialogDescription>
        </DialogHeader>

        {!isNative
          ? renderWebContent()
          : editingStationId
            ? renderStationEdit()
            : renderStationList()
        }
      </DialogContent>
    </Dialog>
  );
}
