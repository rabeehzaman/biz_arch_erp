"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Globe } from "lucide-react";
import { INDIAN_STATES } from "@/lib/gst/constants";

interface GSTConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
}

export function OrgSettingsDialog({
  open,
  onOpenChange,
  orgId,
  orgName,
}: GSTConfigDialogProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [gstEnabled, setGstEnabled] = useState(false);
  const [eInvoicingEnabled, setEInvoicingEnabled] = useState(false);
  const [multiUnitEnabled, setMultiUnitEnabled] = useState(false);
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [isMobileShopModuleEnabled, setIsMobileShopModuleEnabled] = useState(false);
  const [gstin, setGstin] = useState("");
  const [gstStateCode, setGstStateCode] = useState("");

  const [saudiEInvoiceEnabled, setSaudiEInvoiceEnabled] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [commercialRegNumber, setCommercialRegNumber] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [arabicAddress, setArabicAddress] = useState("");
  const [arabicCity, setArabicCity] = useState("");
  const [invoicePdfFormat, setInvoicePdfFormat] = useState("A5_LANDSCAPE");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    if (open && orgId) {
      setLoading(true);
      setError("");
      fetch(`/api/admin/organizations/${orgId}`)
        .then((res) => res.json())
        .then((data) => {
          setGstEnabled(data.gstEnabled || false);
          setEInvoicingEnabled(data.eInvoicingEnabled || false);
          setMultiUnitEnabled(data.multiUnitEnabled || false);
          setMultiBranchEnabled(data.multiBranchEnabled || false);
          setIsMobileShopModuleEnabled(data.isMobileShopModuleEnabled || false);
          setGstin(data.gstin || "");
          setGstStateCode(data.gstStateCode || "");
          setSaudiEInvoiceEnabled(data.saudiEInvoiceEnabled || false);
          setVatNumber(data.vatNumber || "");
          setCommercialRegNumber(data.commercialRegNumber || "");
          setArabicName(data.arabicName || "");
          setArabicAddress(data.arabicAddress || "");
          setArabicCity(data.arabicCity || "");
          setInvoicePdfFormat(data.invoicePdfFormat || "A5_LANDSCAPE");
          setLanguage(data.language || "en");
        })
        .catch(() => setError("Failed to load organization"))
        .finally(() => setLoading(false));
    }
  }, [open, orgId]);

  const handleGstinChange = (value: string) => {
    const upper = value.toUpperCase();
    setGstin(upper);
    if (upper.length >= 2) {
      const code = upper.substring(0, 2);
      if (INDIAN_STATES[code]) {
        setGstStateCode(code);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    if (gstEnabled && !gstin) {
      setError("GSTIN is required when GST is enabled");
      setSaving(false);
      return;
    }

    if (gstEnabled && gstin) {
      const gstinRegex =
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin)) {
        setError("Invalid GSTIN format");
        setSaving(false);
        return;
      }
    }

    if (eInvoicingEnabled && !gstEnabled) {
      setError("GST must be enabled before enabling e-invoicing");
      setSaving(false);
      return;
    }

    if (saudiEInvoiceEnabled && gstEnabled) {
      setError("Cannot enable both GST and Saudi E-Invoice simultaneously");
      setSaving(false);
      return;
    }

    if (saudiEInvoiceEnabled && vatNumber && !/^3\d{14}$/.test(vatNumber)) {
      setError("Invalid VAT Number (TRN). Must be 15 digits starting with 3.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gstEnabled,
          eInvoicingEnabled: gstEnabled ? eInvoicingEnabled : false,
          multiUnitEnabled,
          multiBranchEnabled,
          isMobileShopModuleEnabled,
          gstin: gstEnabled ? gstin : null,
          gstStateCode: gstEnabled ? gstStateCode : null,
          saudiEInvoiceEnabled,
          vatNumber: saudiEInvoiceEnabled ? vatNumber || null : null,
          commercialRegNumber: saudiEInvoiceEnabled ? commercialRegNumber || null : null,
          arabicName: saudiEInvoiceEnabled ? arabicName || null : null,
          arabicAddress: saudiEInvoiceEnabled ? arabicAddress || null : null,
          arabicCity: saudiEInvoiceEnabled ? arabicCity || null : null,
          invoicePdfFormat,
          language,
        }),
      });

      if (res.ok) {
        onOpenChange(false);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save organization settings");
      }
    } catch {
      setError("Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  };

  const stateName = gstStateCode ? INDIAN_STATES[gstStateCode] : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
          <DialogDescription>
            Configure settings for <strong>{orgName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {error && (
              <p className="text-sm text-red-500 font-medium">{error}</p>
            )}

            {/* Language Selection */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Organization Language
                </Label>
                <p className="text-xs text-muted-foreground">
                  Set the UI language for all users of this organization
                </p>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية (Arabic)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="gstEnabled">Enable GST</Label>
                <p className="text-xs text-muted-foreground">
                  Enable Indian GST tax system for this organization
                </p>
              </div>
              <Switch
                id="gstEnabled"
                checked={gstEnabled}
                onCheckedChange={(checked) => {
                  setGstEnabled(checked);
                  if (!checked) setEInvoicingEnabled(false);
                  if (checked) setSaudiEInvoiceEnabled(false);
                }}
              />
            </div>

            {gstEnabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder="27AAAAA0000A1Z5"
                    maxLength={15}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    15-digit GST Identification Number
                  </p>
                </div>

                {gstStateCode && stateName && (
                  <div className="space-y-2">
                    <Label>State (auto-derived)</Label>
                    <p className="text-sm font-medium">
                      {gstStateCode} - {stateName}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="eInvoicingEnabled">Enable E-Invoicing</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable NIC e-invoicing for B2B transactions
                    </p>
                  </div>
                  <Switch
                    id="eInvoicingEnabled"
                    checked={eInvoicingEnabled}
                    onCheckedChange={setEInvoicingEnabled}
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="multiUnitEnabled">Enable Alternate Units</Label>
                <p className="text-xs text-muted-foreground">
                  Allow defining products with multiple units of measurement (e.g. Cartons vs Pieces)
                </p>
              </div>
              <Switch
                id="multiUnitEnabled"
                checked={multiUnitEnabled}
                onCheckedChange={setMultiUnitEnabled}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="multiBranchEnabled">Enable Multi-Branch</Label>
                <p className="text-xs text-muted-foreground">
                  Manage multiple branches, warehouses, and stock transfers across locations
                </p>
              </div>
              <Switch
                id="multiBranchEnabled"
                checked={multiBranchEnabled}
                onCheckedChange={setMultiBranchEnabled}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="isMobileShopModuleEnabled">Enable Mobile Shop</Label>
                <p className="text-xs text-muted-foreground">
                  Track individual mobile devices by IMEI from purchase to sale
                </p>
              </div>
              <Switch
                id="isMobileShopModuleEnabled"
                checked={isMobileShopModuleEnabled}
                onCheckedChange={setIsMobileShopModuleEnabled}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label htmlFor="saudiEInvoiceEnabled">Enable Saudi E-Invoice (ZATCA)</Label>
                <p className="text-xs text-muted-foreground">
                  ZATCA Phase 1 e-invoicing with VAT at 15% and QR codes. Disables GST.
                </p>
              </div>
              <Switch
                id="saudiEInvoiceEnabled"
                checked={saudiEInvoiceEnabled}
                onCheckedChange={(checked) => {
                  setSaudiEInvoiceEnabled(checked);
                  if (checked) {
                    setGstEnabled(false);
                    setEInvoicingEnabled(false);
                  }
                }}
              />
            </div>

            {saudiEInvoiceEnabled && (
              <div className="space-y-4 pl-2">
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">
                    VAT Number (TRN) <span className="text-xs text-muted-foreground">رقم التسجيل الضريبي</span>
                  </Label>
                  <Input
                    id="vatNumber"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                    placeholder="3XXXXXXXXXXXXXX (15 digits)"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="commercialRegNumber">
                    Commercial Registration No. <span className="text-xs text-muted-foreground">رقم السجل التجاري</span>
                  </Label>
                  <Input
                    id="commercialRegNumber"
                    value={commercialRegNumber}
                    onChange={(e) => setCommercialRegNumber(e.target.value)}
                    placeholder="1010XXXXXX"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arabicName">Arabic Company Name <span className="text-xs text-muted-foreground">(اسم الشركة)</span></Label>
                  <Input
                    id="arabicName"
                    value={arabicName}
                    onChange={(e) => setArabicName(e.target.value)}
                    placeholder="اسم الشركة بالعربية"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arabicAddress">Arabic Address <span className="text-xs text-muted-foreground">(العنوان)</span></Label>
                  <Input
                    id="arabicAddress"
                    value={arabicAddress}
                    onChange={(e) => setArabicAddress(e.target.value)}
                    placeholder="العنوان بالكامل"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arabicCity">Arabic City <span className="text-xs text-muted-foreground">(المدينة)</span></Label>
                  <Input
                    id="arabicCity"
                    value={arabicCity}
                    onChange={(e) => setArabicCity(e.target.value)}
                    placeholder="المدينة"
                    dir="rtl"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Invoice PDF Format</Label>
                  <Select value={invoicePdfFormat} onValueChange={setInvoicePdfFormat}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A5_LANDSCAPE">A5 Landscape (Default)</SelectItem>
                      <SelectItem value="A4_PORTRAIT">A4 Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
