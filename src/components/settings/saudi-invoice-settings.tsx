"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

interface SaudiSettings {
  saudiEInvoiceEnabled: boolean;
  vatNumber: string | null;
  commercialRegNumber: string | null;
  arabicName: string | null;
  arabicAddress: string | null;
  arabicCity: string | null;
  invoicePdfFormat: string;
}

export function SaudiInvoiceSettings() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin" || role === "superadmin";

  const [settings, setSettings] = useState<SaudiSettings>({
    saudiEInvoiceEnabled: false,
    vatNumber: "",
    commercialRegNumber: "",
    arabicName: "",
    arabicAddress: "",
    arabicCity: "",
    invoicePdfFormat: "A5_LANDSCAPE",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/settings/saudi-invoice")
      .then((r) => r.json())
      .then((data) => {
        setSettings({
          saudiEInvoiceEnabled: data.saudiEInvoiceEnabled ?? false,
          vatNumber: data.vatNumber ?? "",
          commercialRegNumber: data.commercialRegNumber ?? "",
          arabicName: data.arabicName ?? "",
          arabicAddress: data.arabicAddress ?? "",
          arabicCity: data.arabicCity ?? "",
          invoicePdfFormat: data.invoicePdfFormat ?? "A5_LANDSCAPE",
        });
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/settings/saudi-invoice", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saudiEInvoiceEnabled: settings.saudiEInvoiceEnabled,
        vatNumber: settings.vatNumber || null,
        commercialRegNumber: settings.commercialRegNumber || null,
        arabicName: settings.arabicName || null,
        arabicAddress: settings.arabicAddress || null,
        arabicCity: settings.arabicCity || null,
        invoicePdfFormat: settings.invoicePdfFormat,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(data.error || "Failed to save settings");
    }
    setSaving(false);
  };

  const trnValid = !settings.vatNumber || /^3\d{14}$/.test(settings.vatNumber);
  const warnings: string[] = [];
  if (settings.saudiEInvoiceEnabled) {
    if (!settings.vatNumber) warnings.push("VAT Number (TRN) is required for ZATCA compliance");
    if (!settings.arabicName) warnings.push("Arabic company name is recommended for ZATCA compliance");
    if (!settings.arabicAddress) warnings.push("Arabic address is recommended for ZATCA compliance");
  }

  if (loading) return <div className="text-sm text-slate-500">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Saudi E-Invoice (ZATCA Phase 1)</CardTitle>
            <CardDescription>
              Configure ZATCA-compliant e-invoicing for Saudi Arabia. Enables VAT at 15% and QR code generation on invoices.
            </CardDescription>
          </div>
          <Badge variant={settings.saudiEInvoiceEnabled ? "default" : "secondary"}>
            {settings.saudiEInvoiceEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Saudi e-invoice settings saved successfully.</AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Feature Toggle - Admin only */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Enable Saudi E-Invoicing</Label>
            <p className="text-sm text-slate-500">
              Switches tax from GST to VAT (15%). Generates ZATCA-compliant QR codes on invoices.
            </p>
          </div>
          <Switch
            checked={settings.saudiEInvoiceEnabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, saudiEInvoiceEnabled: v }))}
            disabled={!isAdmin}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* VAT Number (TRN) */}
          <div className="space-y-2">
            <Label htmlFor="vatNumber">
              VAT Number (TRN) <span className="text-slate-400 text-xs">رقم التسجيل الضريبي</span>
            </Label>
            <Input
              id="vatNumber"
              value={settings.vatNumber ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, vatNumber: e.target.value }))}
              placeholder="3XXXXXXXXXXXXXX (15 digits)"
              maxLength={15}
              className={!trnValid ? "border-red-500" : ""}
            />
            {!trnValid && (
              <p className="text-xs text-red-500">TRN must be 15 digits starting with 3</p>
            )}
          </div>

          {/* Commercial Registration Number */}
          <div className="space-y-2">
            <Label htmlFor="commercialRegNumber">
              Commercial Registration No. <span className="text-slate-400 text-xs">رقم السجل التجاري</span>
            </Label>
            <Input
              id="commercialRegNumber"
              value={settings.commercialRegNumber ?? ""}
              onChange={(e) => setSettings((s) => ({ ...s, commercialRegNumber: e.target.value }))}
              placeholder="1010XXXXXX"
            />
          </div>
        </div>

        {/* Arabic Fields */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-slate-700">Arabic Information (اللغة العربية)</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="arabicName">Arabic Company Name <span className="text-slate-400 text-xs">(اسم الشركة)</span></Label>
              <Input
                id="arabicName"
                value={settings.arabicName ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, arabicName: e.target.value }))}
                placeholder="اسم الشركة بالعربية"
                dir="rtl"
                className="text-right font-arabic"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arabicCity">Arabic City <span className="text-slate-400 text-xs">(المدينة)</span></Label>
              <Input
                id="arabicCity"
                value={settings.arabicCity ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, arabicCity: e.target.value }))}
                placeholder="المدينة"
                dir="rtl"
                className="text-right"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="arabicAddress">Arabic Address <span className="text-slate-400 text-xs">(العنوان)</span></Label>
              <Input
                id="arabicAddress"
                value={settings.arabicAddress ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, arabicAddress: e.target.value }))}
                placeholder="العنوان بالكامل"
                dir="rtl"
                className="text-right"
              />
            </div>
          </div>
        </div>

        {/* Invoice PDF Format */}
        <div className="space-y-2">
          <Label>Invoice PDF Format</Label>
          <Select
            value={settings.invoicePdfFormat}
            onValueChange={(v) => setSettings((s) => ({ ...s, invoicePdfFormat: v }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A5_LANDSCAPE">A5 Landscape (Default)</SelectItem>
              <SelectItem value="A4_PORTRAIT">A4 Portrait</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">A4 Portrait is recommended for Saudi ZATCA-compliant invoices</p>
        </div>

        <Button onClick={handleSave} disabled={saving || !trnValid}>
          {saving ? "Saving..." : "Save Saudi E-Invoice Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
