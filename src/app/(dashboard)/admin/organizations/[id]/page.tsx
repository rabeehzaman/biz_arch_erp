"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, ArrowLeft, Loader2, Settings, Trash2, Shield, Receipt, Wrench, RefreshCw, Globe, Scale, Save, Users, KeyRound, Eye, EyeOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SidebarConfigDialog } from "../sidebar-config-dialog";
import { PageAnimation } from "@/components/ui/page-animation";
import { INDIAN_STATES } from "@/lib/gst/constants";
import Link from "next/link";

interface OrganizationDetails {
    id: string;
    name: string;
    slug: string;
    gstEnabled: boolean;
    eInvoicingEnabled: boolean;
    multiUnitEnabled: boolean;
    multiBranchEnabled: boolean;
    isMobileShopModuleEnabled: boolean;
    isWeighMachineEnabled: boolean;
    weighMachineBarcodePrefix: string;
    weighMachineProductCodeLen: number;
    weighMachineWeightDigits: number;
    weighMachineDecimalPlaces: number;
    gstin: string | null;
    gstStateCode: string | null;
    saudiEInvoiceEnabled: boolean;
    vatNumber: string | null;
    commercialRegNumber: string | null;
    arabicName: string | null;
    arabicAddress: string | null;
    arabicCity: string | null;
    invoicePdfFormat: string;
    pdfHeaderImageUrl: string | null;
    pdfFooterImageUrl: string | null;
    language: string;
    currency: string;
    createdAt: string;
    users: Array<{
        id: string;
        name: string | null;
        email: string;
        role: string;
        createdAt: string;
    }>;
    _count: {
        users: number;
        customers: number;
        invoices: number;
    };
}

export default function OrganizationDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Dialog states
    const [sidebarConfigOpen, setSidebarConfigOpen] = useState(false);

    // Inline settings state
    const [gstEnabled, setGstEnabled] = useState(false);
    const [eInvoicingEnabled, setEInvoicingEnabled] = useState(false);
    const [multiUnitEnabled, setMultiUnitEnabled] = useState(false);
    const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
    const [isMobileShopModuleEnabled, setIsMobileShopModuleEnabled] = useState(false);
    const [isWeighMachineEnabled, setIsWeighMachineEnabled] = useState(false);
    const [weighMachineBarcodePrefix, setWeighMachineBarcodePrefix] = useState("77");
    const [weighMachineProductCodeLen, setWeighMachineProductCodeLen] = useState(5);
    const [weighMachineWeightDigits, setWeighMachineWeightDigits] = useState(5);
    const [weighMachineDecimalPlaces, setWeighMachineDecimalPlaces] = useState(3);
    const [gstin, setGstin] = useState("");
    const [gstStateCode, setGstStateCode] = useState("");
    const [saudiEInvoiceEnabled, setSaudiEInvoiceEnabled] = useState(false);
    const [vatNumber, setVatNumber] = useState("");
    const [commercialRegNumber, setCommercialRegNumber] = useState("");
    const [arabicName, setArabicName] = useState("");
    const [arabicAddress, setArabicAddress] = useState("");
    const [arabicCity, setArabicCity] = useState("");
    const [invoicePdfFormat, setInvoicePdfFormat] = useState("A5_LANDSCAPE");
    const [pdfHeaderImageUrl, setPdfHeaderImageUrl] = useState("");
    const [pdfFooterImageUrl, setPdfFooterImageUrl] = useState("");
    const [language, setLanguage] = useState("en");
    const [currency, setCurrency] = useState("INR");
    const [saving, setSaving] = useState(false);
    const [settingsError, setSettingsError] = useState("");
    const [settingsSuccess, setSettingsSuccess] = useState("");

    // Delete state
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    // Reset state
    const [resetTxOpen, setResetTxOpen] = useState(false);
    const [resetFullOpen, setResetFullOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState("");
    const [resetSuccess, setResetSuccess] = useState("");

    // Recalculate state
    const [recalcOpen, setRecalcOpen] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [recalcError, setRecalcError] = useState("");
    const [recalcSuccess, setRecalcSuccess] = useState("");

    // Reset password state
    const [resetPwOpen, setResetPwOpen] = useState(false);
    const [resetPwUser, setResetPwUser] = useState<{ id: string; name: string | null; email: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isResettingPw, setIsResettingPw] = useState(false);
    const [resetPwError, setResetPwError] = useState("");
    const [resetPwSuccess, setResetPwSuccess] = useState("");

    const populateSettingsState = (data: OrganizationDetails) => {
        setGstEnabled(data.gstEnabled || false);
        setEInvoicingEnabled(data.eInvoicingEnabled || false);
        setMultiUnitEnabled(data.multiUnitEnabled || false);
        setMultiBranchEnabled(data.multiBranchEnabled || false);
        setIsMobileShopModuleEnabled(data.isMobileShopModuleEnabled || false);
        setIsWeighMachineEnabled(data.isWeighMachineEnabled || false);
        setWeighMachineBarcodePrefix(data.weighMachineBarcodePrefix || "77");
        setWeighMachineProductCodeLen(data.weighMachineProductCodeLen || 5);
        setWeighMachineWeightDigits(data.weighMachineWeightDigits || 5);
        setWeighMachineDecimalPlaces(data.weighMachineDecimalPlaces || 3);
        setGstin(data.gstin || "");
        setGstStateCode(data.gstStateCode || "");
        setSaudiEInvoiceEnabled(data.saudiEInvoiceEnabled || false);
        setVatNumber(data.vatNumber || "");
        setCommercialRegNumber(data.commercialRegNumber || "");
        setArabicName(data.arabicName || "");
        setArabicAddress(data.arabicAddress || "");
        setArabicCity(data.arabicCity || "");
        setInvoicePdfFormat(data.invoicePdfFormat || "A5_LANDSCAPE");
        setPdfHeaderImageUrl(data.pdfHeaderImageUrl || "");
        setPdfFooterImageUrl(data.pdfFooterImageUrl || "");
        setLanguage(data.language || "en");
        setCurrency(data.currency || "INR");
    };

    const fetchOrganization = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/organizations/${id}`);
            if (res.ok) {
                const data = await res.json();
                setOrganization(data);
                populateSettingsState(data);
            } else {
                setError("Failed to load organization details");
            }
        } catch {
            setError("Failed to load organization details");
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        fetchOrganization();
    }, [fetchOrganization]);

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

    const handleSaveSettings = async () => {
        setSaving(true);
        setSettingsError("");
        setSettingsSuccess("");

        if (gstEnabled && !gstin) {
            setSettingsError("GSTIN is required when GST is enabled");
            setSaving(false);
            return;
        }

        if (gstEnabled && gstin) {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(gstin)) {
                setSettingsError("Invalid GSTIN format");
                setSaving(false);
                return;
            }
        }

        if (eInvoicingEnabled && !gstEnabled) {
            setSettingsError("GST must be enabled before enabling e-invoicing");
            setSaving(false);
            return;
        }

        if (saudiEInvoiceEnabled && gstEnabled) {
            setSettingsError("Cannot enable both GST and Saudi E-Invoice simultaneously");
            setSaving(false);
            return;
        }

        if (saudiEInvoiceEnabled && vatNumber && !/^3\d{14}$/.test(vatNumber)) {
            setSettingsError("Invalid VAT Number (TRN). Must be 15 digits starting with 3.");
            setSaving(false);
            return;
        }

        try {
            const res = await fetch(`/api/admin/organizations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gstEnabled,
                    eInvoicingEnabled: gstEnabled ? eInvoicingEnabled : false,
                    multiUnitEnabled,
                    multiBranchEnabled,
                    isMobileShopModuleEnabled,
                    isWeighMachineEnabled,
                    weighMachineBarcodePrefix,
                    weighMachineProductCodeLen,
                    weighMachineWeightDigits,
                    weighMachineDecimalPlaces,
                    gstin: gstEnabled ? gstin : null,
                    gstStateCode: gstEnabled ? gstStateCode : null,
                    saudiEInvoiceEnabled,
                    vatNumber: saudiEInvoiceEnabled ? vatNumber || null : null,
                    commercialRegNumber: saudiEInvoiceEnabled ? commercialRegNumber || null : null,
                    arabicName: saudiEInvoiceEnabled ? arabicName || null : null,
                    arabicAddress: saudiEInvoiceEnabled ? arabicAddress || null : null,
                    arabicCity: saudiEInvoiceEnabled ? arabicCity || null : null,
                    invoicePdfFormat,
                    pdfHeaderImageUrl,
                    pdfFooterImageUrl,
                    language,
                    currency,
                }),
            });

            if (res.ok) {
                setSettingsSuccess("Settings saved successfully.");
                fetchOrganization();
            } else {
                const data = await res.json();
                setSettingsError(data.error || "Failed to save organization settings");
            }
        } catch {
            setSettingsError("Failed to save organization settings");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOrg = async (e: React.MouseEvent) => {
        e.preventDefault();
        setDeleteError("");
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/organizations/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                router.push("/admin/organizations");
            } else {
                const data = await res.json();
                setDeleteError(data.error || "Failed to delete organization");
            }
        } catch {
            setDeleteError("Failed to delete organization");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReset = async (type: "transactions_only" | "complete_reset") => {
        setResetError("");
        setResetSuccess("");
        setIsResetting(true);
        try {
            const res = await fetch(`/api/admin/organizations/${id}/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            if (res.ok) {
                setResetSuccess(`Successfully performed ${type === "transactions_only" ? "transaction reset" : "complete reset"}.`);
                fetchOrganization();
                setResetTxOpen(false);
                setResetFullOpen(false);
            } else {
                const data = await res.json();
                setResetError(data.error || "Failed to reset organization");
            }
        } catch {
            setResetError("Failed to reset organization");
        } finally {
            setIsResetting(false);
        }
    };

    const handleRecalculateFIFO = async () => {
        setRecalcError("");
        setRecalcSuccess("");
        setIsRecalculating(true);
        try {
            const res = await fetch(`/api/admin/organizations/${id}/recalculate-fifo`, {
                method: "POST",
            });
            if (res.ok) {
                const data = await res.json();
                setRecalcSuccess(`Successfully recalculated FIFO for ${data.productsProcessed} products.`);
                setRecalcOpen(false);
            } else {
                const data = await res.json();
                setRecalcError(data.error || "Failed to recalculate FIFO");
            }
        } catch {
            setRecalcError("Failed to recalculate FIFO");
        } finally {
            setIsRecalculating(false);
        }
    };

    const openResetPwDialog = (user: { id: string; name: string | null; email: string }) => {
        setResetPwUser(user);
        setNewPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setResetPwError("");
        setResetPwSuccess("");
        setResetPwOpen(true);
    };

    const handleResetPassword = async () => {
        setResetPwError("");
        if (!newPassword || newPassword.length < 6) {
            setResetPwError("Password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetPwError("Passwords do not match");
            return;
        }
        if (!resetPwUser) return;

        setIsResettingPw(true);
        try {
            const res = await fetch(`/api/admin/users/${resetPwUser.id}/reset-password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword }),
            });
            if (res.ok) {
                setResetPwSuccess(`Password reset successfully for ${resetPwUser.name || resetPwUser.email}`);
                setResetPwOpen(false);
            } else {
                const data = await res.json();
                setResetPwError(data.error || "Failed to reset password");
            }
        } catch {
            setResetPwError("Failed to reset password");
        } finally {
            setIsResettingPw(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !organization) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <p className="text-xl font-medium text-destructive">{error || "Organization not found"}</p>
                <Button variant="outline" asChild>
                    <Link href="/admin/organizations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Organizations
                    </Link>
                </Button>
            </div>
        );
    }

    const stateName = gstStateCode ? INDIAN_STATES[gstStateCode] : "";

    return (
        <PageAnimation>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="shrink-0">
                        <Link href="/admin/organizations">
                            <ArrowLeft className="h-5 w-5" />
                            <span className="sr-only">Back</span>
                        </Link>
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{organization.name}</h1>
                            <Badge variant="secondary">{organization.slug}</Badge>
                            {organization.gstEnabled && <Badge variant="default">GST Enabled</Badge>}
                            {organization.saudiEInvoiceEnabled && <Badge variant="default">ZATCA</Badge>}
                        </div>
                        <p className="text-muted-foreground">Manage settings and configuration for this organization</p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Organization Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Organization Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                                    <p className="text-sm">{new Date(organization.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">GSTIN</p>
                                    <p className="text-sm">{organization.gstin || "Not provided"}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Users</p>
                                    <p className="text-sm">{organization._count.users}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Customers</p>
                                    <p className="text-sm">{organization._count.customers}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Invoices</p>
                                    <p className="text-sm">{organization._count.invoices}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sidebar Features */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Sidebar Features
                            </CardTitle>
                            <CardDescription>Manage accessible menu items for this organization</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                                        <Settings className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm">Menu Configuration</h4>
                                        <p className="text-sm text-muted-foreground">Control which sidebar items are visible</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => setSidebarConfigOpen(true)}>Configure</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization Settings — inline */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5" />
                                Organization Settings
                            </CardTitle>
                            <CardDescription>Configure features and tax settings for this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {settingsError && (
                                <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                    {settingsError}
                                </div>
                            )}
                            {settingsSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                    {settingsSuccess}
                                </div>
                            )}

                            {/* Language */}
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
                                    <SelectTrigger className="w-44">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en">English</SelectItem>
                                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Currency */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="flex items-center gap-2">
                                        <Globe className="h-4 w-4" />
                                        Currency
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Set the currency used for all transactions
                                    </p>
                                </div>
                                <Select value={currency} onValueChange={setCurrency}>
                                    <SelectTrigger className="w-44">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="INR">₹ INR (Rupee)</SelectItem>
                                        <SelectItem value="SAR">SAR (Riyal)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* GST */}
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
                                            className="font-mono max-w-xs"
                                        />
                                        <p className="text-xs text-muted-foreground">15-digit GST Identification Number</p>
                                    </div>

                                    {gstStateCode && stateName && (
                                        <div className="space-y-1">
                                            <Label>State (auto-derived)</Label>
                                            <p className="text-sm font-medium">{gstStateCode} - {stateName}</p>
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

                            {/* Alternate Units */}
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

                            {/* Multi-Branch */}
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

                            {/* Mobile Shop */}
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

                            {/* Weigh Machine */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-0.5">
                                    <Label htmlFor="isWeighMachineEnabled" className="flex items-center gap-2">
                                        <Scale className="h-4 w-4" />
                                        Enable Weigh Machine
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Decode EAN-13 weight barcodes from weigh machines at POS/invoice screen
                                    </p>
                                </div>
                                <Switch
                                    id="isWeighMachineEnabled"
                                    checked={isWeighMachineEnabled}
                                    onCheckedChange={setIsWeighMachineEnabled}
                                />
                            </div>

                            {isWeighMachineEnabled && (
                                <div className="space-y-4 pl-2">
                                    <div className="grid grid-cols-2 gap-3 max-w-sm">
                                        <div className="space-y-2">
                                            <Label htmlFor="weighMachineBarcodePrefix">Barcode Prefix</Label>
                                            <Input
                                                id="weighMachineBarcodePrefix"
                                                value={weighMachineBarcodePrefix}
                                                onChange={(e) => setWeighMachineBarcodePrefix(e.target.value)}
                                                placeholder="77"
                                                maxLength={4}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="weighMachineProductCodeLen">Product Code Length</Label>
                                            <Input
                                                id="weighMachineProductCodeLen"
                                                type="number"
                                                min={1}
                                                max={8}
                                                value={weighMachineProductCodeLen}
                                                onChange={(e) => setWeighMachineProductCodeLen(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="weighMachineWeightDigits">Weight Digits</Label>
                                            <Input
                                                id="weighMachineWeightDigits"
                                                type="number"
                                                min={1}
                                                max={8}
                                                value={weighMachineWeightDigits}
                                                onChange={(e) => setWeighMachineWeightDigits(Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="weighMachineDecimalPlaces">Decimal Places</Label>
                                            <Input
                                                id="weighMachineDecimalPlaces"
                                                type="number"
                                                min={0}
                                                max={4}
                                                value={weighMachineDecimalPlaces}
                                                onChange={(e) => setWeighMachineDecimalPlaces(Number(e.target.value))}
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-md bg-muted p-3 max-w-sm">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Barcode preview</p>
                                        <p className="font-mono text-sm">
                                            <span className="text-blue-600">{weighMachineBarcodePrefix}</span>
                                            <span className="text-green-600">{"P".repeat(weighMachineProductCodeLen)}</span>
                                            <span className="text-orange-600">{"N".repeat(weighMachineWeightDigits - weighMachineDecimalPlaces)}{"D".repeat(weighMachineDecimalPlaces)}</span>
                                            <span className="text-slate-400">C</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            e.g. <span className="font-mono">{weighMachineBarcodePrefix}12345012501</span> → product <span className="font-mono">12345</span>, weight <span className="font-mono">1.250</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Saudi E-Invoice */}
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
                                <div className="space-y-4 pl-2 max-w-sm">
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
                                </div>
                            )}

                            {/* Invoice PDF Format */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-0.5">
                                    <Label>Invoice PDF Format</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Paper size and orientation for generated invoice PDFs
                                    </p>
                                </div>
                                <Select value={invoicePdfFormat} onValueChange={setInvoicePdfFormat}>
                                    <SelectTrigger className="w-52">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="A5_LANDSCAPE">A5 Landscape (Default)</SelectItem>
                                        <SelectItem value="A4_PORTRAIT">A4 Portrait (GST)</SelectItem>
                                        <SelectItem value="A4_GST2">A4 Portrait (GST 2)</SelectItem>
                                        <SelectItem value="A4_VAT">A4 Portrait (VAT - Arabic)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* PDF Header/Footer Images */}
                            {(invoicePdfFormat === "A4_PORTRAIT" || invoicePdfFormat === "A4_GST2" || invoicePdfFormat === "A4_VAT") && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-0.5 mb-2">
                                        <Label>PDF Header / Footer Images</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Optional images rendered edge-to-edge at the top/bottom of each A4 invoice page (e.g., company letterhead)
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pdfHeaderImageUrl" className="text-xs">Header Image URL</Label>
                                        <Input
                                            id="pdfHeaderImageUrl"
                                            value={pdfHeaderImageUrl}
                                            onChange={(e) => setPdfHeaderImageUrl(e.target.value)}
                                            placeholder="https://example.com/header.png"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pdfFooterImageUrl" className="text-xs">Footer Image URL</Label>
                                        <Input
                                            id="pdfFooterImageUrl"
                                            value={pdfFooterImageUrl}
                                            onChange={(e) => setPdfFooterImageUrl(e.target.value)}
                                            placeholder="https://example.com/footer.png"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Save */}
                            <div className="pt-4 border-t flex items-center gap-4">
                                <Button onClick={handleSaveSettings} disabled={saving}>
                                    {saving
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Save className="mr-2 h-4 w-4" />
                                    }
                                    Save Settings
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Maintenance Utilities */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wrench className="h-5 w-5" />
                                Maintenance Utilities
                            </CardTitle>
                            <CardDescription>Tools to ensure data integrity for this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {recalcSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                    {recalcSuccess}
                                </div>
                            )}
                            {recalcError && (
                                <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                    {recalcError}
                                </div>
                            )}
                            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Recalculate FIFO Inventory</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Rebuilds the entire Cost of Goods Sold (COGS) logic for all products chronologically. This fixes accounting irregularities caused by deep backdated changes, but may take some time depending on data volume.
                                    </p>
                                </div>
                                <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setRecalcOpen(true)}>
                                    Recalculate FIFO
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Users */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Users ({organization.users?.length || 0})
                            </CardTitle>
                            <CardDescription>Users belonging to this organization</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {resetPwSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200 mb-4">
                                    {resetPwSuccess}
                                </div>
                            )}
                            {organization.users && organization.users.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {organization.users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.name || "—"}</TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openResetPwDialog(user)}
                                                    >
                                                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                                                        Reset Password
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-sm text-muted-foreground">No users found for this organization.</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    <Card className="border-red-200 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <Trash2 className="h-5 w-5" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>Irreversible actions for this organization</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {resetSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                    {resetSuccess}
                                </div>
                            )}
                            <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Reset Transactions Only</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove all transactions (invoices, bills, payments, journals) but keep master data such as products, customers, suppliers, chart of accounts, and settings.
                                    </p>
                                </div>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setResetTxOpen(true)}>
                                    Reset Transactions
                                </Button>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-border/50">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Complete Reset</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove all data (transactions AND master data) associated with this organization. Administrative users will be kept, but the organization will be essentially new.
                                    </p>
                                </div>
                                <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50" onClick={() => setResetFullOpen(true)}>
                                    Complete Reset
                                </Button>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-border/50">
                                <div className="max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">Delete Organization</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Permanently remove this organization and all its data. Only possible if the organization has no existing customers or invoices.
                                    </p>
                                </div>
                                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                                    Yes, Delete Organization
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {sidebarConfigOpen && (
                    <SidebarConfigDialog
                        open={sidebarConfigOpen}
                        onOpenChange={setSidebarConfigOpen}
                        orgId={organization.id}
                        orgName={organization.name}
                    />
                )}

                <AlertDialog open={deleteOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the organization <strong className="text-foreground">{organization.name}</strong>.
                                This action cannot be undone. You can only delete organizations that have no associated data (customers, invoices, products, etc).
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {deleteError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {deleteError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={handleDeleteOrg} disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete Organization
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetTxOpen} onOpenChange={(open) => !open && !isResetting && setResetTxOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reset Transactions?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to delete all transactions for <strong className="text-foreground">{organization.name}</strong>?
                                Master data like products, customers, and suppliers will be kept.
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">This action is irreversible and should be done with caution.</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("transactions_only")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Confirm Reset
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetFullOpen} onOpenChange={(open) => !open && !isResetting && setResetFullOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Complete Reset?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to perform a complete reset for <strong className="text-foreground">{organization.name}</strong>?
                                This will wipe ALL transactions and master data, effectively emptying the organization.
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">This action is irreversible and should be done with extreme caution.</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("complete_reset")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Confirm Full Reset
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={recalcOpen} onOpenChange={(open) => !open && !isRecalculating && setRecalcOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Recalculate FIFO Inventory?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will reprocess all inventory stock consumptions to fix COGS calculation discrepancies.
                                This operation is system intensive and might take up to a minute depending on the organization scale.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {recalcError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {recalcError}
                            </div>
                        )}
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isRecalculating}>Cancel</AlertDialogCancel>
                            <Button onClick={handleRecalculateFIFO} disabled={isRecalculating}>
                                {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                Start Recalculation
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetPwOpen} onOpenChange={(open) => { if (!open && !isResettingPw) { setResetPwOpen(false); setResetPwError(""); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password</AlertDialogTitle>
                            <AlertDialogDescription>
                                Set a new password for <strong className="text-foreground">{resetPwUser?.name || resetPwUser?.email}</strong>
                                {resetPwUser?.name && <span className="text-muted-foreground"> ({resetPwUser.email})</span>}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-2">
                            {resetPwError && (
                                <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                    {resetPwError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter password"
                                />
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isResettingPw}>Cancel</AlertDialogCancel>
                            <Button onClick={handleResetPassword} disabled={isResettingPw || !newPassword || !confirmPassword}>
                                {isResettingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                                Reset Password
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PageAnimation>
    );
}
