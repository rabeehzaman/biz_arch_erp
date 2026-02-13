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

export default function SettingsPage() {
  const [formData, setFormData] = useState<CompanySettingsFormData>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      toast.error("Failed to load settings");
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
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500">
          Manage your company information and banking details
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Your company details for invoices and documents
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="companyName">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Your Company Name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Textarea
                  id="companyAddress"
                  name="companyAddress"
                  value={formData.companyAddress}
                  onChange={handleChange}
                  placeholder="Street address"
                  rows={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="companyCity">City</Label>
                  <Input
                    id="companyCity"
                    name="companyCity"
                    value={formData.companyCity}
                    onChange={handleChange}
                    placeholder="City"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyState">State</Label>
                  <Input
                    id="companyState"
                    name="companyState"
                    value={formData.companyState}
                    onChange={handleChange}
                    placeholder="State"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="companyZipCode">ZIP Code</Label>
                  <Input
                    id="companyZipCode"
                    name="companyZipCode"
                    value={formData.companyZipCode}
                    onChange={handleChange}
                    placeholder="ZIP Code"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyCountry">Country</Label>
                  <Input
                    id="companyCountry"
                    name="companyCountry"
                    value={formData.companyCountry}
                    onChange={handleChange}
                    placeholder="Country"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="companyPhone">Phone</Label>
                  <Input
                    id="companyPhone"
                    name="companyPhone"
                    value={formData.companyPhone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="companyEmail">Email</Label>
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
                Tax & Banking Details
              </CardTitle>
              <CardDescription>
                GST and bank account information for payments
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="companyGstNumber">GST Number</Label>
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
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="Bank name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bankAccountNumber">Account Number</Label>
                <Input
                  id="bankAccountNumber"
                  name="bankAccountNumber"
                  value={formData.bankAccountNumber}
                  onChange={handleChange}
                  placeholder="Account number"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="bankIfscCode">IFSC Code</Label>
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
                <Label htmlFor="bankBranch">Branch</Label>
                <Input
                  id="bankBranch"
                  name="bankBranch"
                  value={formData.bankBranch}
                  onChange={handleChange}
                  placeholder="Branch name"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
