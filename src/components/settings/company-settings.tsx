"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_SETTINGS, type CompanySettingsFormData } from "@/lib/validations/settings";
import { useLanguage } from "@/lib/i18n";

export function CompanySettings() {
  const [formData, setFormData] = useState<CompanySettingsFormData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setFormData(data);
    } catch (error) {
      toast.error(t("settings.settingsLoadFailed"));
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("settings.settingsSaveFailed"));
      }

      toast.success(t("settings.settingsSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.settingsSaveFailed"));
      console.error("Failed to save settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {t("settings.companyInfo")}
            </CardTitle>
            <CardDescription>
              {t("settings.companyInfoDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyName">
                {t("settings.companyName")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder={t("settings.companyName")}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="companyAddress">{t("settings.address")}</Label>
              <Textarea
                id="companyAddress"
                name="companyAddress"
                value={formData.companyAddress}
                onChange={handleChange}
                placeholder={t("settings.address")}
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="companyCity">{t("settings.city")}</Label>
                <Input
                  id="companyCity"
                  name="companyCity"
                  value={formData.companyCity}
                  onChange={handleChange}
                  placeholder={t("settings.city")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyState">{t("settings.state")}</Label>
                <Input
                  id="companyState"
                  name="companyState"
                  value={formData.companyState}
                  onChange={handleChange}
                  placeholder={t("settings.state")}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="companyZipCode">{t("settings.zipCode")}</Label>
                <Input
                  id="companyZipCode"
                  name="companyZipCode"
                  value={formData.companyZipCode}
                  onChange={handleChange}
                  placeholder={t("settings.zipCode")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyCountry">{t("settings.country")}</Label>
                <Input
                  id="companyCountry"
                  name="companyCountry"
                  value={formData.companyCountry}
                  onChange={handleChange}
                  placeholder={t("settings.country")}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="companyPhone">{t("settings.phone")}</Label>
                <Input
                  id="companyPhone"
                  name="companyPhone"
                  value={formData.companyPhone}
                  onChange={handleChange}
                  placeholder="+966 5X XXX XXXX"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyEmail">{t("settings.email")}</Label>
                <Input
                  id="companyEmail"
                  name="companyEmail"
                  type="email"
                  value={formData.companyEmail}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("settings.taxBanking")}
            </CardTitle>
            <CardDescription>
              {t("settings.taxBankingDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="companyGstNumber">{t("settings.gstNumber")}</Label>
              <Input
                id="companyGstNumber"
                name="companyGstNumber"
                value={formData.companyGstNumber}
                onChange={handleChange}
                placeholder="22AAAAA0000A1Z5"
              />
              <p className="text-xs text-slate-500">
                Format: 22AAAAA0000A1Z5 (15 characters)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bankName">{t("settings.bankName")}</Label>
              <Input
                id="bankName"
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder={t("settings.bankName")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bankAccountNumber">{t("settings.accountNumber")}</Label>
              <Input
                id="bankAccountNumber"
                name="bankAccountNumber"
                value={formData.bankAccountNumber}
                onChange={handleChange}
                placeholder={t("settings.accountNumber")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bankIfscCode">{t("settings.ifscCode")}</Label>
              <Input
                id="bankIfscCode"
                name="bankIfscCode"
                value={formData.bankIfscCode}
                onChange={handleChange}
                placeholder="SBIN0001234"
              />
              <p className="text-xs text-slate-500">
                Format: SBIN0001234 (11 characters)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bankBranch">{t("settings.branch")}</Label>
              <Input
                id="bankBranch"
                name="bankBranch"
                value={formData.bankBranch}
                onChange={handleChange}
                placeholder={t("settings.branch")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? t("settings.saving") : t("settings.saveSettings")}
        </Button>
      </div>
    </form>
  );
}
