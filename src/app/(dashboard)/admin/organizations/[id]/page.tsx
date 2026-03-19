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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, ArrowLeft, Loader2, Settings, Trash2, Shield, Receipt, Wrench, RefreshCw, Globe, Scale, Save, Users, KeyRound, Eye, EyeOff, UserCog, Gem } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { SidebarConfigDialog } from "../sidebar-config-dialog";
import { PageAnimation } from "@/components/ui/page-animation";
import { INDIAN_STATES } from "@/lib/gst/constants";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

interface OrganizationDetails {
    id: string;
    name: string;
    slug: string;
    edition: string;
    gstEnabled: boolean;
    eInvoicingEnabled: boolean;
    multiUnitEnabled: boolean;
    multiBranchEnabled: boolean;
    isMobileShopModuleEnabled: boolean;
    isWeighMachineEnabled: boolean;
    isJewelleryModuleEnabled: boolean;
    jewelleryHuidMandatory: boolean;
    jewellerySasoMandatory: boolean;
    jewelleryConsignmentEnabled: boolean;
    jewellerySchemesEnabled: boolean;
    jewelleryOldGoldEnabled: boolean;
    jewelleryRepairsEnabled: boolean;
    jewelleryKarigarsEnabled: boolean;
    jewelleryGoldTaxRate: number;
    jewelleryMakingChargeTaxRate: number;
    jewelleryStoneTaxRate: number;
    jewelleryInvestmentGoldTaxRate: number;
    jewelleryPanRequired: boolean;
    jewelleryPanThreshold: number;
    jewelleryCashLimitEnabled: boolean;
    jewelleryCashLimitAmount: number;
    jewelleryTcsEnabled: boolean;
    jewelleryTcsRate: number;
    jewelleryTcsThreshold: number;
    jewelleryDefaultWastagePercent: number;
    jewelleryKarigarWastageTolerance: number;
    jewelleryWeightTolerance: number;
    jewelleryBuyRateSpread: number;
    jewelleryAutoDerivePurities: boolean;
    jewelleryAgingAlertDays: number;
    jewelleryReconciliationTolerance: number;
    jewelleryDefaultMakingChargeType: string;
    jewellerySchemeMaxDuration: number;
    jewellerySchemeBonusMonths: number;
    jewellerySchemeEnforce365Days: boolean;
    jewellerySchemeRedemptionDiscount: number;
    jewelleryThemeEnabled: boolean;
    jewelleryThemeColor: string | null;
    jewelleryThemePreset: string | null;
    jewelleryEnabledPurities: string[];
    jewelleryEnabledMetals: string[];
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
    transferPdfFormat: string;
    transferPdfHideCost: boolean;
    pdfHeaderImageUrl: string | null;
    pdfFooterImageUrl: string | null;
    brandColor: string | null;
    invoiceLogoHeight: number | null;
    posReceiptLogoUrl: string | null;
    posReceiptLogoHeight: number | null;
    language: string;
    currency: string;
    posAccountingMode: string;
    posDefaultCashAccountId: string | null;
    posDefaultBankAccountId: string | null;
    isTaxInclusivePrice: boolean;
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
    const { t } = useLanguage();

    const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Dialog states
    const [sidebarConfigOpen, setSidebarConfigOpen] = useState(false);

    // Inline settings state
    const [edition, setEditionState] = useState("INDIA");
    const [gstEnabled, setGstEnabled] = useState(false);
    const [eInvoicingEnabled, setEInvoicingEnabled] = useState(false);
    const [multiUnitEnabled, setMultiUnitEnabled] = useState(false);
    const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
    const [isMobileShopModuleEnabled, setIsMobileShopModuleEnabled] = useState(false);
    const [isWeighMachineEnabled, setIsWeighMachineEnabled] = useState(false);
    const [isJewelleryModuleEnabled, setIsJewelleryModuleEnabled] = useState(false);
    const [jewelleryHuidMandatory, setJewelleryHuidMandatory] = useState(true);
    const [jewellerySasoMandatory, setJewellerySasoMandatory] = useState(true);
    const [jewelleryConsignmentEnabled, setJewelleryConsignmentEnabled] = useState(false);
    const [jewellerySchemesEnabled, setJewellerySchemesEnabled] = useState(true);
    const [jewelleryOldGoldEnabled, setJewelleryOldGoldEnabled] = useState(true);
    const [jewelleryRepairsEnabled, setJewelleryRepairsEnabled] = useState(true);
    const [jewelleryKarigarsEnabled, setJewelleryKarigarsEnabled] = useState(true);
    const [jewelleryGoldTaxRate, setJewelleryGoldTaxRate] = useState(3);
    const [jewelleryMakingChargeTaxRate, setJewelleryMakingChargeTaxRate] = useState(5);
    const [jewelleryStoneTaxRate, setJewelleryStoneTaxRate] = useState(3);
    const [jewelleryInvestmentGoldTaxRate, setJewelleryInvestmentGoldTaxRate] = useState(3);
    const [jewelleryPanRequired, setJewelleryPanRequired] = useState(true);
    const [jewelleryPanThreshold, setJewelleryPanThreshold] = useState(200000);
    const [jewelleryCashLimitEnabled, setJewelleryCashLimitEnabled] = useState(true);
    const [jewelleryCashLimitAmount, setJewelleryCashLimitAmount] = useState(200000);
    const [jewelleryTcsEnabled, setJewelleryTcsEnabled] = useState(false);
    const [jewelleryTcsRate, setJewelleryTcsRate] = useState(1);
    const [jewelleryTcsThreshold, setJewelleryTcsThreshold] = useState(500000);
    const [jewelleryDefaultWastagePercent, setJewelleryDefaultWastagePercent] = useState(5);
    const [jewelleryKarigarWastageTolerance, setJewelleryKarigarWastageTolerance] = useState(3);
    const [jewelleryWeightTolerance, setJewelleryWeightTolerance] = useState(0.05);
    const [jewelleryBuyRateSpread, setJewelleryBuyRateSpread] = useState(5);
    const [jewelleryAutoDerivePurities, setJewelleryAutoDerivePurities] = useState(true);
    const [jewelleryAgingAlertDays, setJewelleryAgingAlertDays] = useState(180);
    const [jewelleryReconciliationTolerance, setJewelleryReconciliationTolerance] = useState(1);
    const [jewelleryDefaultMakingChargeType, setJewelleryDefaultMakingChargeType] = useState("PER_GRAM");
    const [jewellerySchemeMaxDuration, setJewellerySchemeMaxDuration] = useState(11);
    const [jewellerySchemeBonusMonths, setJewellerySchemeBonusMonths] = useState(1);
    const [jewellerySchemeEnforce365Days, setJewellerySchemeEnforce365Days] = useState(true);
    const [jewellerySchemeRedemptionDiscount, setJewellerySchemeRedemptionDiscount] = useState(0);
    const [jewelleryThemeEnabled, setJewelleryThemeEnabled] = useState(true);
    const [jewelleryThemeColor, setJewelleryThemeColor] = useState("#b8860b");
    const [jewelleryThemePreset, setJewelleryThemePreset] = useState("gold");
    const [jewelleryEnabledPurities, setJewelleryEnabledPurities] = useState<string[]>(["K24", "K22", "K21", "K18", "K14", "K9"]);
    const [jewelleryEnabledMetals, setJewelleryEnabledMetals] = useState<string[]>(["GOLD", "SILVER", "PLATINUM"]);
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
    const [transferPdfFormat, setTransferPdfFormat] = useState("DEFAULT");
    const [transferPdfHideCost, setTransferPdfHideCost] = useState(false);
    const [pdfHeaderImageUrl, setPdfHeaderImageUrl] = useState("");
    const [pdfFooterImageUrl, setPdfFooterImageUrl] = useState("");
    const [brandColor, setBrandColor] = useState("");
    const [invoiceLogoHeight, setInvoiceLogoHeight] = useState(60);
    const [posReceiptLogoUrl, setPosReceiptLogoUrl] = useState("");
    const [posReceiptLogoHeight, setPosReceiptLogoHeight] = useState(80);
    const [language, setLanguage] = useState("en");
    const [currency, setCurrency] = useState("INR");
    const [posAccountingMode, setPosAccountingMode] = useState("DIRECT");
    const [posDefaultCashAccountId, setPosDefaultCashAccountId] = useState("");
    const [posDefaultBankAccountId, setPosDefaultBankAccountId] = useState("");
    const [isTaxInclusivePrice, setIsTaxInclusivePrice] = useState(false);
    const [saving, setSaving] = useState(false);

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

    // Change role state
    const [changeRoleOpen, setChangeRoleOpen] = useState(false);
    const [changeRoleUser, setChangeRoleUser] = useState<{ id: string; name: string | null; email: string; role: string } | null>(null);
    const [selectedRole, setSelectedRole] = useState("");
    const [isChangingRole, setIsChangingRole] = useState(false);
    const [changeRoleError, setChangeRoleError] = useState("");

    // Cash/Bank accounts for POS default settlement
    const [orgCashBankAccounts, setOrgCashBankAccounts] = useState<Array<{ id: string; name: string; accountSubType: string }>>([]);

    const populateSettingsState = (data: OrganizationDetails) => {
        setEditionState(data.edition || "INDIA");
        setGstEnabled(data.gstEnabled || false);
        setEInvoicingEnabled(data.eInvoicingEnabled || false);
        setMultiUnitEnabled(data.multiUnitEnabled || false);
        setMultiBranchEnabled(data.multiBranchEnabled || false);
        setIsMobileShopModuleEnabled(data.isMobileShopModuleEnabled || false);
        setIsWeighMachineEnabled(data.isWeighMachineEnabled || false);
        setIsJewelleryModuleEnabled(data.isJewelleryModuleEnabled || false);
        setJewelleryHuidMandatory(data.jewelleryHuidMandatory ?? true);
        setJewellerySasoMandatory(data.jewellerySasoMandatory ?? true);
        setJewelleryConsignmentEnabled(data.jewelleryConsignmentEnabled || false);
        setJewellerySchemesEnabled(data.jewellerySchemesEnabled ?? true);
        setJewelleryOldGoldEnabled(data.jewelleryOldGoldEnabled ?? true);
        setJewelleryRepairsEnabled(data.jewelleryRepairsEnabled ?? true);
        setJewelleryKarigarsEnabled(data.jewelleryKarigarsEnabled ?? true);
        setJewelleryGoldTaxRate(Number(data.jewelleryGoldTaxRate) || 3);
        setJewelleryMakingChargeTaxRate(Number(data.jewelleryMakingChargeTaxRate) || 5);
        setJewelleryStoneTaxRate(Number(data.jewelleryStoneTaxRate) || 3);
        setJewelleryInvestmentGoldTaxRate(Number(data.jewelleryInvestmentGoldTaxRate) || 3);
        setJewelleryPanRequired(data.jewelleryPanRequired ?? true);
        setJewelleryPanThreshold(Number(data.jewelleryPanThreshold) || 200000);
        setJewelleryCashLimitEnabled(data.jewelleryCashLimitEnabled ?? true);
        setJewelleryCashLimitAmount(Number(data.jewelleryCashLimitAmount) || 200000);
        setJewelleryTcsEnabled(data.jewelleryTcsEnabled || false);
        setJewelleryTcsRate(Number(data.jewelleryTcsRate) || 1);
        setJewelleryTcsThreshold(Number(data.jewelleryTcsThreshold) || 500000);
        setJewelleryDefaultWastagePercent(Number(data.jewelleryDefaultWastagePercent) || 5);
        setJewelleryKarigarWastageTolerance(Number(data.jewelleryKarigarWastageTolerance) || 3);
        setJewelleryWeightTolerance(Number(data.jewelleryWeightTolerance) || 0.05);
        setJewelleryBuyRateSpread(Number(data.jewelleryBuyRateSpread) || 5);
        setJewelleryAutoDerivePurities(data.jewelleryAutoDerivePurities ?? true);
        setJewelleryAgingAlertDays(data.jewelleryAgingAlertDays || 180);
        setJewelleryReconciliationTolerance(Number(data.jewelleryReconciliationTolerance) || 1);
        setJewelleryDefaultMakingChargeType(data.jewelleryDefaultMakingChargeType || "PER_GRAM");
        setJewellerySchemeMaxDuration(data.jewellerySchemeMaxDuration || 11);
        setJewellerySchemeBonusMonths(data.jewellerySchemeBonusMonths || 1);
        setJewellerySchemeEnforce365Days(data.jewellerySchemeEnforce365Days ?? true);
        setJewellerySchemeRedemptionDiscount(Number(data.jewellerySchemeRedemptionDiscount) || 0);
        setJewelleryThemeEnabled(data.jewelleryThemeEnabled ?? true);
        setJewelleryThemeColor(data.jewelleryThemeColor || "#b8860b");
        setJewelleryThemePreset(data.jewelleryThemePreset || "gold");
        setJewelleryEnabledPurities(data.jewelleryEnabledPurities || ["K24", "K22", "K21", "K18", "K14", "K9"]);
        setJewelleryEnabledMetals(data.jewelleryEnabledMetals || ["GOLD", "SILVER", "PLATINUM"]);
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
        setTransferPdfFormat(data.transferPdfFormat || "DEFAULT");
        setTransferPdfHideCost(data.transferPdfHideCost || false);
        setPdfHeaderImageUrl(data.pdfHeaderImageUrl || "");
        setPdfFooterImageUrl(data.pdfFooterImageUrl || "");
        setBrandColor(data.brandColor || "");
        setInvoiceLogoHeight(data.invoiceLogoHeight ?? 60);
        setPosReceiptLogoUrl(data.posReceiptLogoUrl || "");
        setPosReceiptLogoHeight(data.posReceiptLogoHeight ?? 80);
        setLanguage(data.language || "en");
        setCurrency(data.currency || "INR");
        setPosAccountingMode(data.posAccountingMode || "DIRECT");
        setPosDefaultCashAccountId(data.posDefaultCashAccountId || "");
        setPosDefaultBankAccountId(data.posDefaultBankAccountId || "");
        setIsTaxInclusivePrice(data.isTaxInclusivePrice || false);
    };

    const fetchOrganization = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/organizations/${id}`);
            if (res.ok) {
                const data = await res.json();
                setOrganization(data);
                populateSettingsState(data);
            } else {
                setError(t("admin.failedToLoadOrg"));
            }
        } catch {
            setError(t("admin.failedToLoadOrg"));
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchCashBankAccounts = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/organizations/${id}/cash-bank-accounts`);
            if (res.ok) {
                const data = await res.json();
                setOrgCashBankAccounts(data);
            }
        } catch {
            // silently fail — accounts dropdown will just be empty
        }
    }, [id]);

    useEffect(() => {
        fetchOrganization();
    }, [fetchOrganization]);

    useEffect(() => {
        if (posAccountingMode === "CLEARING_ACCOUNT") {
            fetchCashBankAccounts();
        }
    }, [posAccountingMode, fetchCashBankAccounts]);

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

        if (gstEnabled && !gstin) {
            toast.error(t("admin.gstinRequired"));
            setSaving(false);
            return;
        }

        if (gstEnabled && gstin) {
            const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!gstinRegex.test(gstin)) {
                toast.error(t("admin.invalidGstin"));
                setSaving(false);
                return;
            }
        }

        if (eInvoicingEnabled && !gstEnabled) {
            toast.error(t("admin.gstMustBeEnabled"));
            setSaving(false);
            return;
        }

        if (saudiEInvoiceEnabled && gstEnabled) {
            toast.error(t("admin.cannotEnableBothGstSaudi"));
            setSaving(false);
            return;
        }

        if (saudiEInvoiceEnabled && vatNumber && !/^3\d{14}$/.test(vatNumber)) {
            toast.error(t("admin.invalidVatNumber"));
            setSaving(false);
            return;
        }

        try {
            const res = await fetch(`/api/admin/organizations/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    edition,
                    gstEnabled,
                    eInvoicingEnabled: gstEnabled ? eInvoicingEnabled : false,
                    multiUnitEnabled,
                    multiBranchEnabled,
                    isMobileShopModuleEnabled,
                    isWeighMachineEnabled,
                    isJewelleryModuleEnabled,
                    jewelleryHuidMandatory,
                    jewellerySasoMandatory,
                    jewelleryConsignmentEnabled,
                    jewellerySchemesEnabled,
                    jewelleryOldGoldEnabled,
                    jewelleryRepairsEnabled,
                    jewelleryKarigarsEnabled,
                    jewelleryGoldTaxRate,
                    jewelleryMakingChargeTaxRate,
                    jewelleryStoneTaxRate,
                    jewelleryInvestmentGoldTaxRate,
                    jewelleryPanRequired,
                    jewelleryPanThreshold,
                    jewelleryCashLimitEnabled,
                    jewelleryCashLimitAmount,
                    jewelleryTcsEnabled,
                    jewelleryTcsRate,
                    jewelleryTcsThreshold,
                    jewelleryDefaultWastagePercent,
                    jewelleryKarigarWastageTolerance,
                    jewelleryWeightTolerance,
                    jewelleryBuyRateSpread,
                    jewelleryAutoDerivePurities,
                    jewelleryAgingAlertDays,
                    jewelleryReconciliationTolerance,
                    jewelleryDefaultMakingChargeType,
                    jewellerySchemeMaxDuration,
                    jewellerySchemeBonusMonths,
                    jewellerySchemeEnforce365Days,
                    jewellerySchemeRedemptionDiscount,
                    jewelleryThemeEnabled,
                    jewelleryThemeColor: jewelleryThemeColor || null,
                    jewelleryThemePreset: jewelleryThemePreset || null,
                    jewelleryEnabledPurities,
                    jewelleryEnabledMetals,
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
                    transferPdfFormat,
                    transferPdfHideCost,
                    pdfHeaderImageUrl,
                    pdfFooterImageUrl,
                    brandColor: brandColor || null,
                    invoiceLogoHeight,
                    posReceiptLogoUrl: posReceiptLogoUrl || null,
                    posReceiptLogoHeight,
                    language,
                    currency,
                    posAccountingMode,
                    posDefaultCashAccountId: posAccountingMode === "CLEARING_ACCOUNT" ? posDefaultCashAccountId || null : null,
                    posDefaultBankAccountId: posAccountingMode === "CLEARING_ACCOUNT" ? posDefaultBankAccountId || null : null,
                    isTaxInclusivePrice,
                }),
            });

            if (res.ok) {
                toast.success(t("admin.settingsSaved"));
                fetchOrganization();
            } else {
                const data = await res.json();
                toast.error(data.error || t("admin.failedToSaveSettings"));
            }
        } catch {
            toast.error(t("admin.failedToSaveSettings"));
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
                setDeleteError(data.error || t("admin.failedToDeleteOrg"));
            }
        } catch {
            setDeleteError(t("admin.failedToDeleteOrg"));
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
                setResetSuccess(type === "transactions_only" ? t("admin.transactionResetSuccess") : t("admin.completeResetSuccess"));
                fetchOrganization();
                setResetTxOpen(false);
                setResetFullOpen(false);
            } else {
                const data = await res.json();
                setResetError(data.error || t("admin.failedToResetOrg"));
            }
        } catch {
            setResetError(t("admin.failedToResetOrg"));
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
                setRecalcSuccess(t("admin.fifoSuccess").replace("{count}", String(data.productsProcessed)));
                setRecalcOpen(false);
            } else {
                const data = await res.json();
                setRecalcError(data.error || t("admin.failedToRecalcFifo"));
            }
        } catch {
            setRecalcError(t("admin.failedToRecalcFifo"));
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

    const openChangeRoleDialog = (user: { id: string; name: string | null; email: string; role: string }) => {
        setChangeRoleUser(user);
        setSelectedRole(user.role);
        setChangeRoleError("");
        setChangeRoleOpen(true);
    };

    const handleChangeRole = async () => {
        setChangeRoleError("");
        if (!selectedRole || !changeRoleUser) return;
        if (selectedRole === changeRoleUser.role) {
            setChangeRoleError(t("admin.selectDifferentRole"));
            return;
        }
        setIsChangingRole(true);
        try {
            const res = await fetch(`/api/admin/users/${changeRoleUser.id}/change-role`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: selectedRole }),
            });
            if (res.ok) {
                setChangeRoleOpen(false);
                fetchOrganization();
                toast.success(t("admin.roleUpdatedTo").replace("{role}", selectedRole) + ` — ${changeRoleUser.name || changeRoleUser.email}`);
            } else {
                const data = await res.json();
                setChangeRoleError(data.error || t("admin.failedToChangeRole"));
            }
        } catch {
            setChangeRoleError(t("admin.failedToChangeRole"));
        } finally {
            setIsChangingRole(false);
        }
    };

    const handleResetPassword = async () => {
        setResetPwError("");
        if (!newPassword || newPassword.length < 6) {
            setResetPwError(t("admin.passwordMinLength"));
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetPwError(t("admin.passwordsDoNotMatch"));
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
                setResetPwSuccess(t("admin.passwordResetFor").replace("{name}", resetPwUser.name || resetPwUser.email));
                setResetPwOpen(false);
            } else {
                const data = await res.json();
                setResetPwError(data.error || t("admin.failedToResetPassword"));
            }
        } catch {
            setResetPwError(t("admin.failedToResetPassword"));
        } finally {
            setIsResettingPw(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center px-4">
                <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{t("admin.loadingOrgDetails")}</p>
                        <p className="text-xs text-muted-foreground">{t("admin.fetchingSettings")}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !organization) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <p className="text-xl font-medium text-destructive">{error || t("admin.orgNotFound")}</p>
                <Button variant="outline" asChild>
                    <Link href="/admin/organizations">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t("admin.backToOrganizations")}
                    </Link>
                </Button>
            </div>
        );
    }

    const stateName = gstStateCode ? INDIAN_STATES[gstStateCode] : "";

    return (
        <PageAnimation>
            <div className="space-y-5 sm:space-y-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                        <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0 rounded-full">
                            <Link href="/admin/organizations">
                                <ArrowLeft className="h-5 w-5" />
                                <span className="sr-only">Back</span>
                            </Link>
                        </Button>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="break-words text-2xl font-bold tracking-tight">{organization.name}</h1>
                                <Badge variant="secondary" className="max-w-full break-all">{organization.slug}</Badge>
                                {organization.gstEnabled && <Badge variant="default">{t("admin.gstEnabled")}</Badge>}
                                {organization.saudiEInvoiceEnabled && <Badge variant="default">{t("admin.zatca")}</Badge>}
                            </div>
                            <p className="break-words text-muted-foreground">{t("admin.manageSettingsDesc")}</p>
                        </div>
                    </div>
                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full sm:w-auto">
                        {saving
                            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            : <Save className="mr-2 h-4 w-4" />
                        }
                        {t("admin.saveSettings")}
                    </Button>
                </div>

                <div className="grid min-w-0 gap-6 md:grid-cols-2">
                    {/* Organization Details */}
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                {t("admin.organizationDetails")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t("admin.created")}</p>
                                    <p className="text-sm">{new Date(organization.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t("admin.gstin")}</p>
                                    <p className="text-sm">{organization.gstin || t("admin.notProvided")}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t("admin.users")}</p>
                                    <p className="text-sm">{organization._count.users}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t("admin.customers")}</p>
                                    <p className="text-sm">{organization._count.customers}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t("admin.invoices")}</p>
                                    <p className="text-sm">{organization._count.invoices}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sidebar Features */}
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                {t("admin.sidebarFeatures")}
                            </CardTitle>
                            <CardDescription>{t("admin.sidebarFeaturesDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                                    <div className="p-2 bg-primary/10 rounded-full text-primary">
                                        <Settings className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold">{t("admin.menuConfiguration")}</h4>
                                        <p className="break-words text-sm text-muted-foreground">{t("admin.menuConfigDesc")}</p>
                                    </div>
                                </div>
                                <Button variant="outline" onClick={() => setSidebarConfigOpen(true)} className="w-full sm:w-auto">{t("admin.configure")}</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization Settings */}
                    <Card className="min-w-0 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Receipt className="h-5 w-5" />
                                {t("admin.orgSettings")}
                            </CardTitle>
                            <CardDescription>{t("admin.configureSettingsDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="general" className="min-w-0 w-full">
                                <div className="mb-6 max-w-full overflow-x-auto border-b">
                                    <TabsList className="h-auto min-w-max w-max justify-start gap-1 rounded-xl border-b-0 bg-transparent p-1 sm:w-fit">
                                        <TabsTrigger
                                            value="general"
                                            className="relative h-10 shrink-0 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                                        >
                                            {t("admin.tabGeneral")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="taxation"
                                            className="relative h-10 shrink-0 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                                        >
                                            {t("admin.tabTaxation")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="modules"
                                            className="relative h-10 shrink-0 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                                        >
                                            {t("admin.tabModules")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="invoice"
                                            className="relative h-10 shrink-0 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                                        >
                                            {t("admin.tabInvoicePdf")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="jewellery"
                                            className="relative h-10 shrink-0 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-3 font-semibold text-muted-foreground shadow-none transition-none data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                                        >
                                            <Gem className="mr-1.5 h-4 w-4" />
                                            {t("admin.jewelleryTab")}
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* GENERAL TAB */}
                                <TabsContent value="general" className="space-y-6 mt-0">
                                    {/* Edition */}
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                {t("edition.edition")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("edition.editionDesc")}
                                            </p>
                                        </div>
                                        <Select value={edition} onValueChange={(val) => {
                                            if (val !== edition) {
                                                if (confirm(t("edition.switchWarning"))) {
                                                    setEditionState(val);
                                                    if (val === "INDIA") {
                                                        setCurrency("INR");
                                                        setLanguage("en");
                                                        setGstEnabled(true);
                                                        setSaudiEInvoiceEnabled(false);
                                                    } else {
                                                        setCurrency("SAR");
                                                        setLanguage("en");
                                                        setSaudiEInvoiceEnabled(true);
                                                        setGstEnabled(false);
                                                        setEInvoicingEnabled(false);
                                                    }
                                                }
                                            }
                                        }}>
                                            <SelectTrigger className="w-full sm:w-52">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INDIA">{"\u{1F1EE}\u{1F1F3}"} {t("edition.india")}</SelectItem>
                                                <SelectItem value="SAUDI">{"\u{1F1F8}\u{1F1E6}"} {t("edition.saudi")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Language — only for Saudi */}
                                    {edition === "SAUDI" && (
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                {t("admin.organizationLanguageLabel")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.setLanguageDesc")}
                                            </p>
                                        </div>
                                        <Select value={language} onValueChange={setLanguage}>
                                            <SelectTrigger className="w-full sm:w-44">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en">{t("admin.english")}</SelectItem>
                                                <SelectItem value="ar">العربية (Arabic)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    )}

                                    {/* Currency — read-only, auto-set by edition */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                {t("admin.currency")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.setCurrencyFullDesc")}
                                            </p>
                                        </div>
                                        <Select value={currency} onValueChange={setCurrency} disabled>
                                            <SelectTrigger className="w-full sm:w-44">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="INR">₹ INR (Rupee)</SelectItem>
                                                <SelectItem value="SAR">SAR (Riyal)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TabsContent>

                                {/* TAXATION TAB */}
                                <TabsContent value="taxation" className="space-y-6 mt-0">
                                    {/* GST — India edition only */}
                                    {edition === "INDIA" && (
                                    <>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="gstEnabled">{t("admin.enableGst")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableGstDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="gstEnabled"
                                            checked={gstEnabled}
                                            onCheckedChange={(checked) => {
                                                setGstEnabled(checked);
                                                if (!checked) setEInvoicingEnabled(false);
                                            }}
                                        />
                                    </div>

                                    {gstEnabled && (
                                        <div className="space-y-6 pl-4 border-l-2 border-muted mt-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="gstin">{t("admin.gstin")}</Label>
                                                <Input
                                                    id="gstin"
                                                    value={gstin}
                                                    onChange={(e) => handleGstinChange(e.target.value)}
                                                    placeholder="27AAAAA0000A1Z5"
                                                    maxLength={15}
                                                    className="font-mono max-w-xs"
                                                />
                                                <p className="text-xs text-muted-foreground">{t("admin.gstinHelp")}</p>
                                            </div>

                                            {gstStateCode && stateName && (
                                                <div className="space-y-1">
                                                    <Label>{t("admin.stateAutoDerived")}</Label>
                                                    <p className="text-sm font-medium">{gstStateCode} - {stateName}</p>
                                                </div>
                                            )}

                                            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="eInvoicingEnabled">{t("admin.enableEInvoicing")}</Label>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t("admin.enableEInvoicingDesc")}
                                                    </p>
                                                </div>
                                                <Switch
                                                    id="eInvoicingEnabled"
                                                    checked={eInvoicingEnabled}
                                                    onCheckedChange={setEInvoicingEnabled}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    </>
                                    )}

                                    {/* Saudi E-Invoice — Saudi edition only */}
                                    {edition === "SAUDI" && (
                                    <>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="saudiEInvoiceEnabled">{t("admin.enableSaudiEInvoice")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.saudiZatcaDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="saudiEInvoiceEnabled"
                                            checked={saudiEInvoiceEnabled}
                                            onCheckedChange={setSaudiEInvoiceEnabled}
                                        />
                                    </div>

                                    {saudiEInvoiceEnabled && (
                                        <div className="space-y-4 pl-4 border-l-2 border-muted mt-4 max-w-md">
                                            <div className="space-y-2">
                                                <Label htmlFor="vatNumber">
                                                    {t("admin.vatNumberLabel")} <span className="text-xs text-muted-foreground">رقم التسجيل الضريبي</span>
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
                                                    {t("admin.commercialRegLabel")} <span className="text-xs text-muted-foreground">رقم السجل التجاري</span>
                                                </Label>
                                                <Input
                                                    id="commercialRegNumber"
                                                    value={commercialRegNumber}
                                                    onChange={(e) => setCommercialRegNumber(e.target.value)}
                                                    placeholder="1010XXXXXX"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="arabicName">{t("admin.arabicCompanyName")} <span className="text-xs text-muted-foreground">(اسم الشركة)</span></Label>
                                                <Input
                                                    id="arabicName"
                                                    value={arabicName}
                                                    onChange={(e) => setArabicName(e.target.value)}
                                                    placeholder="اسم الشركة بالعربية"
                                                    dir="rtl"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="arabicAddress">{t("admin.arabicAddress")} <span className="text-xs text-muted-foreground">(العنوان)</span></Label>
                                                <Input
                                                    id="arabicAddress"
                                                    value={arabicAddress}
                                                    onChange={(e) => setArabicAddress(e.target.value)}
                                                    placeholder="العنوان بالكامل"
                                                    dir="rtl"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="arabicCity">{t("admin.arabicCity")} <span className="text-xs text-muted-foreground">(المدينة)</span></Label>
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
                                    </>
                                    )}

                                    {/* Tax-Inclusive Pricing */}
                                    {(gstEnabled || saudiEInvoiceEnabled) && (
                                        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-0.5">
                                                <Label htmlFor="isTaxInclusivePrice">{t("admin.taxInclusivePricing")}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("admin.taxInclusiveFullDesc")}
                                                </p>
                                            </div>
                                            <Switch
                                                id="isTaxInclusivePrice"
                                                checked={isTaxInclusivePrice}
                                                onCheckedChange={setIsTaxInclusivePrice}
                                            />
                                        </div>
                                    )}
                                </TabsContent>

                                {/* MODULES TAB */}
                                <TabsContent value="modules" className="space-y-6 mt-0">
                                    {/* Alternate Units */}
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="multiUnitEnabled">{t("admin.enableAlternateUnits")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableAlternateUnitsDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="multiUnitEnabled"
                                            checked={multiUnitEnabled}
                                            onCheckedChange={setMultiUnitEnabled}
                                        />
                                    </div>

                                    {/* Multi-Branch */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="multiBranchEnabled">{t("admin.enableMultiBranch")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableMultiBranchDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="multiBranchEnabled"
                                            checked={multiBranchEnabled}
                                            onCheckedChange={setMultiBranchEnabled}
                                        />
                                    </div>

                                    {/* Mobile Shop */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="isMobileShopModuleEnabled">{t("admin.enableMobileShop")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableMobileShopDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="isMobileShopModuleEnabled"
                                            checked={isMobileShopModuleEnabled}
                                            onCheckedChange={setIsMobileShopModuleEnabled}
                                        />
                                    </div>

                                    {/* Jewellery Shop */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="isJewelleryModuleEnabled" className="flex items-center gap-2">
                                                <Gem className="h-4 w-4" />
                                                {t("admin.enableJewelleryShop")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableJewelleryShopDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="isJewelleryModuleEnabled"
                                            checked={isJewelleryModuleEnabled}
                                            onCheckedChange={setIsJewelleryModuleEnabled}
                                        />
                                    </div>

                                    {/* Weigh Machine */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="isWeighMachineEnabled" className="flex items-center gap-2">
                                                <Scale className="h-4 w-4" />
                                                {t("admin.enableWeighMachine")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableWeighMachineDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="isWeighMachineEnabled"
                                            checked={isWeighMachineEnabled}
                                            onCheckedChange={setIsWeighMachineEnabled}
                                        />
                                    </div>

                                    {isWeighMachineEnabled && (
                                        <div className="space-y-4 pl-4 border-l-2 border-muted mt-4">
                                            <div className="grid max-w-sm grid-cols-1 gap-3 sm:grid-cols-2">
                                                <div className="space-y-2">
                                                    <Label htmlFor="weighMachineBarcodePrefix">{t("admin.barcodePrefix")}</Label>
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
                                                    <Label htmlFor="weighMachineProductCodeLen">{t("admin.productCodeLen")}</Label>
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
                                                    <Label htmlFor="weighMachineWeightDigits">{t("admin.weightDigits")}</Label>
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
                                                    <Label htmlFor="weighMachineDecimalPlaces">{t("admin.decimalPlaces")}</Label>
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
                                                <p className="text-xs font-medium text-muted-foreground mb-1">{t("admin.barcodePreview")}</p>
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

                                    {/* POS Accounting Mode */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="flex items-center gap-2">
                                                <Receipt className="h-4 w-4" />
                                                {t("admin.posAccountingMode")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground max-w-md">
                                                {t("admin.posAccountingDirectDesc")}
                                                <br />
                                                {t("admin.posAccountingClearingDesc")}
                                            </p>
                                        </div>
                                        <Select value={posAccountingMode} onValueChange={setPosAccountingMode}>
                                            <SelectTrigger className="w-full sm:w-56">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DIRECT">{t("admin.directRealtime")}</SelectItem>
                                                <SelectItem value="CLEARING_ACCOUNT">{t("admin.clearingAccount")}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {posAccountingMode === "CLEARING_ACCOUNT" && (
                                        <div className="space-y-4 border-l-2 border-muted pl-4 ml-2">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>{t("admin.defaultCashSettlement")}</Label>
                                                    <p className="text-xs text-muted-foreground max-w-md">
                                                        {t("admin.defaultCashSettlementDesc")}
                                                    </p>
                                                </div>
                                                <Select value={posDefaultCashAccountId || "__none__"} onValueChange={(v) => setPosDefaultCashAccountId(v === "__none__" ? "" : v)}>
                                                    <SelectTrigger className="w-full sm:w-56">
                                                        <SelectValue placeholder={t("admin.selectCashAccount")} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">{t("admin.none")}</SelectItem>
                                                        {orgCashBankAccounts
                                                            .filter(a => a.accountSubType === "CASH")
                                                            .map(a => (
                                                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-0.5">
                                                    <Label>{t("admin.defaultBankSettlement")}</Label>
                                                    <p className="text-xs text-muted-foreground max-w-md">
                                                        {t("admin.defaultBankSettlementDesc")}
                                                    </p>
                                                </div>
                                                <Select value={posDefaultBankAccountId || "__none__"} onValueChange={(v) => setPosDefaultBankAccountId(v === "__none__" ? "" : v)}>
                                                    <SelectTrigger className="w-full sm:w-56">
                                                        <SelectValue placeholder={t("admin.selectBankAccount")} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">{t("admin.none")}</SelectItem>
                                                        {orgCashBankAccounts
                                                            .filter(a => a.accountSubType === "BANK")
                                                            .map(a => (
                                                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                                                            ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* INVOICE & PDF TAB */}
                                <TabsContent value="invoice" className="space-y-6 mt-0">
                                    {/* Invoice PDF Format */}
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label>{t("admin.invoicePdfFormat")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.invoicePdfFormatDesc")}
                                            </p>
                                        </div>
                                        <Select value={invoicePdfFormat} onValueChange={setInvoicePdfFormat}>
                                            <SelectTrigger className="w-full sm:w-52">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {edition === "INDIA" && (
                                                    <>
                                                    <SelectItem value="A5_LANDSCAPE">{t("admin.a5Landscape")}</SelectItem>
                                                    <SelectItem value="A4_PORTRAIT">{t("admin.a4PortraitGst")}</SelectItem>
                                                    <SelectItem value="A4_GST2">{t("admin.a4PortraitGst2")}</SelectItem>
                                                    <SelectItem value="A4_MODERN_GST">{t("admin.a4ModernPortfolio")}</SelectItem>
                                                    </>
                                                )}
                                                {edition === "SAUDI" && (
                                                    <>
                                                    <SelectItem value="A4_VAT">{t("admin.a4PortraitVat")}</SelectItem>
                                                    <SelectItem value="A4_BILINGUAL">{t("admin.a4Bilingual")}</SelectItem>
                                                    <SelectItem value="A4_MODERN_GST">{t("admin.a4ModernPortfolio")}</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Transfer PDF Format */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label>{t("admin.transferPdfFormat")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.transferPdfFormatDesc")}
                                            </p>
                                        </div>
                                        <Select value={transferPdfFormat} onValueChange={setTransferPdfFormat}>
                                            <SelectTrigger className="w-full sm:w-52">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DEFAULT">{t("admin.defaultEnglish")}</SelectItem>
                                                {edition === "SAUDI" && (
                                                    <SelectItem value="ARABIC">{t("admin.allArabic")} (عربي)</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Transfer PDF Hide Cost */}
                                    <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label>{t("admin.hideCostTransferPdf")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.hideCostTransferPdfDesc")}
                                            </p>
                                        </div>
                                        <Switch checked={transferPdfHideCost} onCheckedChange={setTransferPdfHideCost} />
                                    </div>

                                    {/* PDF Header/Footer Images */}
                                    {(invoicePdfFormat === "A4_PORTRAIT" || invoicePdfFormat === "A4_GST2" || invoicePdfFormat === "A4_VAT" || invoicePdfFormat === "A4_BILINGUAL") && (
                                        <div className="space-y-4 pt-6 border-t border-border mt-4">
                                            <div className="space-y-0.5 mb-2">
                                                <Label>{t("admin.pdfHeaderFooterImages")}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("admin.pdfHeaderFooterDesc")}
                                                </p>
                                            </div>
                                            <div className="space-y-2 max-w-md">
                                                <Label htmlFor="pdfHeaderImageUrl" className="text-xs">{t("admin.headerImageUrl")}</Label>
                                                <Input
                                                    id="pdfHeaderImageUrl"
                                                    value={pdfHeaderImageUrl}
                                                    onChange={(e) => setPdfHeaderImageUrl(e.target.value)}
                                                    placeholder="https://example.com/header.png"
                                                />
                                            </div>
                                            <div className="space-y-2 max-w-md">
                                                <Label htmlFor="pdfFooterImageUrl" className="text-xs">{t("admin.footerImageUrl")}</Label>
                                                <Input
                                                    id="pdfFooterImageUrl"
                                                    value={pdfFooterImageUrl}
                                                    onChange={(e) => setPdfFooterImageUrl(e.target.value)}
                                                    placeholder="https://example.com/footer.png"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {invoicePdfFormat === "A4_MODERN_GST" && (
                                        <div className="space-y-4 pt-6 border-t border-border mt-4">
                                            <div className="space-y-0.5 mb-2">
                                                <Label>{t("admin.companyLogoUrl")}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("admin.companyLogoDesc")}
                                                </p>
                                            </div>
                                            <div className="space-y-2 max-w-md">
                                                <Label htmlFor="pdfHeaderImageUrl" className="text-xs">{t("admin.logoImageUrl")}</Label>
                                                <Input
                                                    id="pdfHeaderImageUrl"
                                                    value={pdfHeaderImageUrl}
                                                    onChange={(e) => setPdfHeaderImageUrl(e.target.value)}
                                                    placeholder="https://example.com/logo.png"
                                                />
                                            </div>
                                            <div className="space-y-2 max-w-md mt-4">
                                                <Label className="text-xs">{t("admin.invoiceLogoHeight")}: {invoiceLogoHeight}px</Label>
                                                <input
                                                    type="range"
                                                    min={20}
                                                    max={200}
                                                    value={invoiceLogoHeight}
                                                    onChange={(e) => setInvoiceLogoHeight(Number(e.target.value))}
                                                    className="w-full"
                                                />
                                                <p className="text-xs text-muted-foreground">{t("admin.logoHeightDesc")}</p>
                                            </div>

                                            <div className="space-y-0.5 mb-2 mt-6">
                                                <Label>{t("admin.brandColor")}</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {t("admin.brandColorDesc")}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 max-w-md">
                                                <Input
                                                    id="brandColor"
                                                    value={brandColor}
                                                    onChange={(e) => setBrandColor(e.target.value)}
                                                    placeholder="#2a3b38"
                                                    className="flex-1"
                                                />
                                                <input
                                                    type="color"
                                                    value={brandColor || "#2a3b38"}
                                                    onChange={(e) => setBrandColor(e.target.value)}
                                                    className="h-9 w-12 cursor-pointer rounded border border-input p-0.5"
                                                />
                                                <div
                                                    className="h-9 w-9 rounded border border-input flex-shrink-0"
                                                    style={{ backgroundColor: brandColor || "#2a3b38" }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* POS Receipt Logo */}
                                    <div className="space-y-4 pt-6 border-t border-border mt-4">
                                        <div className="space-y-0.5 mb-2">
                                            <Label>{t("admin.posReceiptLogo")}</Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.posReceiptLogoDesc")}
                                            </p>
                                        </div>
                                        <div className="space-y-2 max-w-md">
                                            <Label className="text-xs">{t("admin.posLogoUrl")}</Label>
                                            <Input
                                                value={posReceiptLogoUrl}
                                                onChange={(e) => setPosReceiptLogoUrl(e.target.value)}
                                                placeholder="https://example.com/pos-logo.png (or leave blank to use invoice logo)"
                                            />
                                        </div>
                                        <div className="space-y-2 max-w-md">
                                            <Label className="text-xs">{t("admin.posLogoHeight")}: {posReceiptLogoHeight}px</Label>
                                            <input
                                                type="range"
                                                min={20}
                                                max={200}
                                                value={posReceiptLogoHeight}
                                                onChange={(e) => setPosReceiptLogoHeight(Number(e.target.value))}
                                                className="w-full"
                                            />
                                            <p className="text-xs text-muted-foreground">{t("admin.posLogoHeightDesc")}</p>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* JEWELLERY TAB */}
                                <TabsContent value="jewellery" className="space-y-6 mt-0">
                                    {/* Master Toggle */}
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="isJewelleryModuleEnabled" className="flex items-center gap-2">
                                                <Gem className="h-4 w-4" />
                                                {t("admin.enableJewelleryShop")}
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                {t("admin.enableJewelleryShopDesc")}
                                            </p>
                                        </div>
                                        <Switch
                                            id="isJewelleryModuleEnabled"
                                            checked={isJewelleryModuleEnabled}
                                            onCheckedChange={setIsJewelleryModuleEnabled}
                                        />
                                    </div>

                                    {isJewelleryModuleEnabled && (
                                        <div className="space-y-8 pl-4 border-l-2 border-muted mt-4">
                                            {/* Theme & Branding */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryThemeBranding")}</h4>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="space-y-0.5">
                                                        <Label>{t("admin.jewelleryEnableTheme")}</Label>
                                                        <p className="text-xs text-muted-foreground">{t("admin.jewelleryEnableThemeDesc")}</p>
                                                    </div>
                                                    <Switch checked={jewelleryThemeEnabled} onCheckedChange={setJewelleryThemeEnabled} />
                                                </div>
                                                {jewelleryThemeEnabled && (
                                                    <div className="grid max-w-sm grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewelleryThemePreset")}</Label>
                                                            <Select value={jewelleryThemePreset} onValueChange={setJewelleryThemePreset}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="gold">Gold</SelectItem>
                                                                    <SelectItem value="rose-gold">Rose Gold</SelectItem>
                                                                    <SelectItem value="platinum">Platinum</SelectItem>
                                                                    <SelectItem value="emerald">Emerald</SelectItem>
                                                                    <SelectItem value="custom">Custom</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        {jewelleryThemePreset === "custom" && (
                                                            <div className="space-y-2">
                                                                <Label>{t("admin.jewelleryCustomColor")}</Label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input value={jewelleryThemeColor} onChange={(e) => setJewelleryThemeColor(e.target.value)} placeholder="#b8860b" className="flex-1" />
                                                                    <input type="color" value={jewelleryThemeColor || "#b8860b"} onChange={(e) => setJewelleryThemeColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input p-0.5" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Module Features */}
                                            <div className="space-y-4 border-t border-border pt-6">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryModuleFeatures")}</h4>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryOldGoldExchange")}</Label>
                                                        <Switch checked={jewelleryOldGoldEnabled} onCheckedChange={setJewelleryOldGoldEnabled} />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryRepairs")}</Label>
                                                        <Switch checked={jewelleryRepairsEnabled} onCheckedChange={setJewelleryRepairsEnabled} />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryKarigars")}</Label>
                                                        <Switch checked={jewelleryKarigarsEnabled} onCheckedChange={setJewelleryKarigarsEnabled} />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryConsignment")}</Label>
                                                        <Switch checked={jewelleryConsignmentEnabled} onCheckedChange={setJewelleryConsignmentEnabled} />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewellerySchemes")}</Label>
                                                        <Switch checked={jewellerySchemesEnabled} onCheckedChange={setJewellerySchemesEnabled} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Tax & Compliance */}
                                            <div className="space-y-4 border-t border-border pt-6">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryTaxCompliance")}</h4>
                                                <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryGoldTaxRate")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="100" value={jewelleryGoldTaxRate} onChange={(e) => setJewelleryGoldTaxRate(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryMakingChargeTaxRate")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="100" value={jewelleryMakingChargeTaxRate} onChange={(e) => setJewelleryMakingChargeTaxRate(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryStoneTaxRate")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="100" value={jewelleryStoneTaxRate} onChange={(e) => setJewelleryStoneTaxRate(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryInvestmentGoldTaxRate")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="100" value={jewelleryInvestmentGoldTaxRate} onChange={(e) => setJewelleryInvestmentGoldTaxRate(Number(e.target.value))} />
                                                    </div>
                                                </div>
                                                <div className="grid gap-4 sm:grid-cols-2 mt-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryPanRequired")}</Label>
                                                        <Switch checked={jewelleryPanRequired} onCheckedChange={setJewelleryPanRequired} />
                                                    </div>
                                                    {jewelleryPanRequired && (
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewelleryPanThreshold")}</Label>
                                                            <Input type="number" min="0" value={jewelleryPanThreshold} onChange={(e) => setJewelleryPanThreshold(Number(e.target.value))} />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryCashLimit")}</Label>
                                                        <Switch checked={jewelleryCashLimitEnabled} onCheckedChange={setJewelleryCashLimitEnabled} />
                                                    </div>
                                                    {jewelleryCashLimitEnabled && (
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewelleryCashLimitAmount")}</Label>
                                                            <Input type="number" min="0" value={jewelleryCashLimitAmount} onChange={(e) => setJewelleryCashLimitAmount(Number(e.target.value))} />
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between gap-3">
                                                        <Label>{t("admin.jewelleryTcs")}</Label>
                                                        <Switch checked={jewelleryTcsEnabled} onCheckedChange={setJewelleryTcsEnabled} />
                                                    </div>
                                                    {jewelleryTcsEnabled && (
                                                        <>
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewelleryTcsRate")}</Label>
                                                            <Input type="number" step="0.01" min="0" max="100" value={jewelleryTcsRate} onChange={(e) => setJewelleryTcsRate(Number(e.target.value))} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewelleryTcsThreshold")}</Label>
                                                            <Input type="number" min="0" value={jewelleryTcsThreshold} onChange={(e) => setJewelleryTcsThreshold(Number(e.target.value))} />
                                                        </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hallmarking */}
                                            <div className="space-y-4 border-t border-border pt-6">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryHallmarking")}</h4>
                                                <div className="grid gap-4 sm:grid-cols-2">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <Label>{t("admin.jewelleryHuidMandatory")}</Label>
                                                            <Switch checked={jewelleryHuidMandatory} onCheckedChange={setJewelleryHuidMandatory} />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{t("admin.jewelleryHuidMandatoryDesc")}</p>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <Label>{t("admin.jewellerySasoMandatory")}</Label>
                                                            <Switch checked={jewellerySasoMandatory} onCheckedChange={setJewellerySasoMandatory} />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{t("admin.jewellerySasoMandatoryDesc")}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pricing & Rates */}
                                            <div className="space-y-4 border-t border-border pt-6">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryPricingRates")}</h4>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="space-y-0.5">
                                                        <Label>{t("admin.jewelleryAutoDerivePurities")}</Label>
                                                        <p className="text-xs text-muted-foreground">{t("admin.jewelleryAutoDerivePuritiesDesc")}</p>
                                                    </div>
                                                    <Switch checked={jewelleryAutoDerivePurities} onCheckedChange={setJewelleryAutoDerivePurities} />
                                                </div>
                                                <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryBuyRateSpread")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="50" value={jewelleryBuyRateSpread} onChange={(e) => setJewelleryBuyRateSpread(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryDefaultWastage")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="50" value={jewelleryDefaultWastagePercent} onChange={(e) => setJewelleryDefaultWastagePercent(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryDefaultMakingChargeType")}</Label>
                                                        <Select value={jewelleryDefaultMakingChargeType} onValueChange={setJewelleryDefaultMakingChargeType}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="PER_GRAM">Per Gram</SelectItem>
                                                                <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                                                                <SelectItem value="FIXED">Fixed</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Inventory */}
                                            <div className="space-y-4 border-t border-border pt-6">
                                                <h4 className="text-sm font-semibold text-foreground">{t("admin.jewelleryInventorySettings")}</h4>
                                                <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryWeightTolerance")}</Label>
                                                        <Input type="number" step="0.001" min="0" value={jewelleryWeightTolerance} onChange={(e) => setJewelleryWeightTolerance(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryAgingAlertDays")}</Label>
                                                        <Input type="number" min="1" value={jewelleryAgingAlertDays} onChange={(e) => setJewelleryAgingAlertDays(Number(e.target.value))} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>{t("admin.jewelleryReconciliationTolerance")}</Label>
                                                        <Input type="number" step="0.01" min="0" max="10" value={jewelleryReconciliationTolerance} onChange={(e) => setJewelleryReconciliationTolerance(Number(e.target.value))} />
                                                    </div>
                                                </div>

                                                {/* Enabled Purities */}
                                                <div className="space-y-2">
                                                    <Label>{t("admin.jewelleryEnabledPurities")}</Label>
                                                    <div className="flex flex-wrap gap-3">
                                                        {["K24", "K22", "K21", "K18", "K14", "K9"].map((p) => (
                                                            <label key={p} className="flex items-center gap-1.5 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={jewelleryEnabledPurities.includes(p)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setJewelleryEnabledPurities([...jewelleryEnabledPurities, p]);
                                                                        else setJewelleryEnabledPurities(jewelleryEnabledPurities.filter((x) => x !== p));
                                                                    }}
                                                                    className="rounded"
                                                                />
                                                                {p}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Enabled Metals */}
                                                <div className="space-y-2">
                                                    <Label>{t("admin.jewelleryEnabledMetals")}</Label>
                                                    <div className="flex flex-wrap gap-3">
                                                        {["GOLD", "SILVER", "PLATINUM"].map((m) => (
                                                            <label key={m} className="flex items-center gap-1.5 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={jewelleryEnabledMetals.includes(m)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setJewelleryEnabledMetals([...jewelleryEnabledMetals, m]);
                                                                        else setJewelleryEnabledMetals(jewelleryEnabledMetals.filter((x) => x !== m));
                                                                    }}
                                                                    className="rounded"
                                                                />
                                                                {m.charAt(0) + m.slice(1).toLowerCase()}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Schemes (India) */}
                                            {jewellerySchemesEnabled && (
                                                <div className="space-y-4 border-t border-border pt-6">
                                                    <h4 className="text-sm font-semibold text-foreground">{t("admin.jewellerySchemeSettings")}</h4>
                                                    <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewellerySchemeMaxDuration")}</Label>
                                                            <Input type="number" min="1" max="24" value={jewellerySchemeMaxDuration} onChange={(e) => setJewellerySchemeMaxDuration(Number(e.target.value))} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewellerySchemeBonusMonths")}</Label>
                                                            <Input type="number" min="0" max="6" value={jewellerySchemeBonusMonths} onChange={(e) => setJewellerySchemeBonusMonths(Number(e.target.value))} />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <Label>{t("admin.jewellerySchemeEnforce365Days")}</Label>
                                                            <Switch checked={jewellerySchemeEnforce365Days} onCheckedChange={setJewellerySchemeEnforce365Days} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>{t("admin.jewellerySchemeRedemptionDiscount")}</Label>
                                                            <Input type="number" step="0.01" min="0" max="100" value={jewellerySchemeRedemptionDiscount} onChange={(e) => setJewellerySchemeRedemptionDiscount(Number(e.target.value))} />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>

                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Maintenance Utilities */}
                    <Card className="min-w-0 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wrench className="h-5 w-5" />
                                {t("admin.maintenanceUtilities")}
                            </CardTitle>
                            <CardDescription>{t("admin.maintenanceDesc")}</CardDescription>
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
                            <div className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="sm:max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">{t("admin.recalculateFifo")}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t("admin.recalculateFifoDesc")}
                                    </p>
                                </div>
                                <Button variant="outline" className="w-full border-blue-200 text-blue-600 hover:bg-blue-50 sm:w-auto" onClick={() => setRecalcOpen(true)}>
                                    {t("admin.recalculateFifoButton")}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Users */}
                    <Card className="min-w-0 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                {t("admin.usersCount").replace("{count}", String(organization.users?.length || 0))}
                            </CardTitle>
                            <CardDescription>{t("admin.usersDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {resetPwSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200 mb-4">
                                    {resetPwSuccess}
                                </div>
                            )}
                            {organization.users && organization.users.length > 0 ? (
                                <>
                                    <div className="space-y-3 sm:hidden">
                                        {organization.users.map((user) => (
                                            <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div className="min-w-0 space-y-1">
                                                        <p className="font-medium text-slate-900">{user.name || t("admin.unnamedUser")}</p>
                                                        <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                                                    </div>
                                                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                                        {user.role}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                    <span>{t("admin.joined")} {new Date(user.createdAt).toLocaleDateString()}</span>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-3"
                                                            onClick={() => openChangeRoleDialog(user)}
                                                        >
                                                            <UserCog className="mr-1.5 h-3.5 w-3.5" />
                                                            {t("admin.role")}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 px-3"
                                                            onClick={() => openResetPwDialog(user)}
                                                        >
                                                            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                                            {t("admin.resetPassword")}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="hidden sm:block">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>{t("admin.name")}</TableHead>
                                                    <TableHead>{t("admin.email")}</TableHead>
                                                    <TableHead>{t("admin.role")}</TableHead>
                                                    <TableHead>{t("admin.created")}</TableHead>
                                                    <TableHead className="text-right">{t("admin.actions2")}</TableHead>
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
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openChangeRoleDialog(user)}
                                                                >
                                                                    <UserCog className="mr-1.5 h-3.5 w-3.5" />
                                                                    {t("admin.changeRole")}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openResetPwDialog(user)}
                                                                >
                                                                    <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                                                                    {t("admin.resetPassword")}
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t("admin.noUsersFound")}</p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Danger Zone */}
                    <Card className="min-w-0 border-red-200 md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-red-600 flex items-center gap-2">
                                <Trash2 className="h-5 w-5" />
                                {t("admin.dangerZone")}
                            </CardTitle>
                            <CardDescription>{t("admin.dangerZoneDesc")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {resetSuccess && (
                                <div className="text-sm font-medium text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
                                    {resetSuccess}
                                </div>
                            )}
                            <div className="flex flex-col gap-4 rounded-lg border border-red-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="sm:max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">{t("admin.resetTxOnly")}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t("admin.resetTxOnlyDesc")}
                                    </p>
                                </div>
                                <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 sm:w-auto" onClick={() => setResetTxOpen(true)}>
                                    {t("admin.resetTransactions")}
                                </Button>
                            </div>

                            <div className="flex flex-col gap-4 rounded-lg border border-red-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="sm:max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">{t("admin.completeReset")}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t("admin.completeResetDesc")}
                                    </p>
                                </div>
                                <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-red-50 sm:w-auto" onClick={() => setResetFullOpen(true)}>
                                    {t("admin.completeReset")}
                                </Button>
                            </div>

                            <div className="flex flex-col gap-4 rounded-lg border border-red-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="sm:max-w-[70%]">
                                    <h4 className="font-semibold text-sm text-foreground">{t("admin.deleteOrganization")}</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t("admin.deleteOrgDesc")}
                                    </p>
                                </div>
                                <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setDeleteOpen(true)}>
                                    {t("admin.yesDeleteOrg")}
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
                            <AlertDialogTitle>{t("admin.areYouAbsolutelySure")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.deleteOrgDialogDesc")} — <strong className="text-foreground">{organization.name}</strong>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {deleteError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {deleteError}
                            </div>
                        )}
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
                            <Button variant="destructive" onClick={handleDeleteOrg} disabled={isDeleting}>
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                {t("admin.deleteOrganization")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetTxOpen} onOpenChange={(open) => !open && !isResetting && setResetTxOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.resetTransactionsConfirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.resetTxDialogDesc")} — <strong className="text-foreground">{organization.name}</strong>
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">{t("admin.actionIrreversible")}</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isResetting}>{t("common.cancel")}</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("transactions_only")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                {t("admin.confirmReset")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetFullOpen} onOpenChange={(open) => !open && !isResetting && setResetFullOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.completeResetConfirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.completeResetDialogDesc")} — <strong className="text-foreground">{organization.name}</strong>
                                <br />
                                <span className="text-red-600 font-semibold mt-2 block">{t("admin.actionIrreversibleExtreme")}</span>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {resetError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {resetError}
                            </div>
                        )}
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isResetting}>{t("common.cancel")}</AlertDialogCancel>
                            <Button variant="destructive" onClick={() => handleReset("complete_reset")} disabled={isResetting}>
                                {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                {t("admin.confirmFullReset")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={recalcOpen} onOpenChange={(open) => !open && !isRecalculating && setRecalcOpen(false)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.recalculateFifoConfirm")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.recalculateFifoDialogDesc")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        {recalcError && (
                            <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                {recalcError}
                            </div>
                        )}
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isRecalculating}>{t("common.cancel")}</AlertDialogCancel>
                            <Button onClick={handleRecalculateFIFO} disabled={isRecalculating}>
                                {isRecalculating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                {t("admin.startRecalculation")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={changeRoleOpen} onOpenChange={(open) => { if (!open && !isChangingRole) { setChangeRoleOpen(false); setChangeRoleError(""); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.changeRole")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.changeRoleDesc")} <strong className="text-foreground">{changeRoleUser?.name || changeRoleUser?.email}</strong>
                                {changeRoleUser?.name && <span className="text-muted-foreground"> ({changeRoleUser.email})</span>}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-2">
                            {changeRoleError && (
                                <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                                    {changeRoleError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>{t("admin.newRole")}</Label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t("admin.selectRole")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">admin</SelectItem>
                                        <SelectItem value="user">user</SelectItem>
                                        <SelectItem value="pos">pos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isChangingRole}>{t("common.cancel")}</AlertDialogCancel>
                            <Button onClick={handleChangeRole} disabled={isChangingRole || !selectedRole}>
                                {isChangingRole ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCog className="h-4 w-4 mr-2" />}
                                {t("admin.changeRole")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={resetPwOpen} onOpenChange={(open) => { if (!open && !isResettingPw) { setResetPwOpen(false); setResetPwError(""); } }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.resetPassword")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.resetPasswordDesc")} <strong className="text-foreground">{resetPwUser?.name || resetPwUser?.email}</strong>
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
                                <Label htmlFor="newPassword">{t("admin.newPassword")}</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder={t("admin.minSixChars")}
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
                                <Label htmlFor="confirmPassword">{t("admin.confirmPassword")}</Label>
                                <Input
                                    id="confirmPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t("admin.reenterPassword")}
                                />
                            </div>
                        </div>
                        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <AlertDialogCancel disabled={isResettingPw}>{t("common.cancel")}</AlertDialogCancel>
                            <Button onClick={handleResetPassword} disabled={isResettingPw || !newPassword || !confirmPassword}>
                                {isResettingPw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                                {t("admin.resetPassword")}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PageAnimation>
    );
}
