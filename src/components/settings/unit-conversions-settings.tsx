"use client";

import { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Unit {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
}

interface UnitConversion {
    id: string;
    fromUnitId: string;
    toUnitId: string;
    conversionFactor: number;
    fromUnit: Unit;
    toUnit: Unit;
}

export function UnitConversionsSettings({ unitRefreshKey }: { unitRefreshKey?: number }) {
    const { t } = useLanguage();
    const [conversions, setConversions] = useState<UnitConversion[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingConversion, setEditingConversion] = useState<UnitConversion | null>(null);

    const [formData, setFormData] = useState({
        fromUnitId: "",
        toUnitId: "",
        conversionFactor: "",
    });

    useEffect(() => {
        fetchData();
    }, [unitRefreshKey]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [conversionsRes, unitsRes] = await Promise.all([
                fetch("/api/unit-conversions"),
                fetch("/api/units")
            ]);

            if (!conversionsRes.ok || !unitsRes.ok) throw new Error("Failed to fetch data");

            const conversionsData = await conversionsRes.json();
            const unitsData = await unitsRes.json();

            setConversions(conversionsData);
            setUnits(unitsData.filter((u: Unit) => u.isActive));
        } catch (error) {
            toast.error(t("units.loadFailed"));
            console.error("Failed to fetch unit conversions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchConversions = async () => {
        try {
            const response = await fetch("/api/unit-conversions");
            if (!response.ok) throw new Error("Failed to fetch");
            const data = await response.json();
            setConversions(data);
        } catch (error) {
            console.error("Failed to fetch unit conversions:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (formData.fromUnitId === formData.toUnitId) {
            toast.error(t("units.unitsMustBeDifferent"));
            return;
        }

        const payload = {
            fromUnitId: formData.fromUnitId,
            toUnitId: formData.toUnitId,
            conversionFactor: parseFloat(formData.conversionFactor),
        };

        try {
            const response = editingConversion
                ? await fetch(`/api/unit-conversions/${editingConversion.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ conversionFactor: payload.conversionFactor }),
                })
                : await fetch("/api/unit-conversions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to save");
            }

            setIsDialogOpen(false);
            resetForm();
            fetchConversions();
            toast.success(editingConversion ? t("units.conversionUpdated") : t("units.conversionAdded"));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save conversion");
            console.error("Failed to save conversion:", error);
        }
    };

    const handleEdit = (conversion: UnitConversion) => {
        setEditingConversion(conversion);
        setFormData({
            fromUnitId: conversion.fromUnitId,
            toUnitId: conversion.toUnitId,
            conversionFactor: conversion.conversionFactor.toString(),
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("units.deleteConversionConfirm"))) return;

        try {
            const response = await fetch(`/api/unit-conversions/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete");
            fetchConversions();
            toast.success(t("units.conversionDeleted"));
        } catch (error) {
            toast.error(t("units.conversionDeleteFailed"));
            console.error("Failed to delete conversion:", error);
        }
    };

    const resetForm = () => {
        setEditingConversion(null);
        setFormData({
            fromUnitId: "",
            toUnitId: "",
            conversionFactor: "",
        });
    };

    return (
        <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl">{t("units.globalConversions")}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                        {t("units.globalConversionsDesc")}
                    </p>
                </div>
                <Dialog
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) resetForm();
                    }}
                >
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            {t("units.addConversion")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form className="contents" onSubmit={handleSubmit}>
                            <DialogHeader className="pr-12">
                                <DialogTitle>
                                    {editingConversion ? t("units.editConversionRule") : t("units.addConversionRule")}
                                </DialogTitle>
                                <DialogDescription>
                                    {editingConversion
                                        ? t("units.editConversionDesc")
                                        : t("units.addConversionDesc")}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-2 sm:py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="fromUnit">{t("units.alternateUnitFrom")}</Label>
                                    <Select
                                        value={formData.fromUnitId}
                                        onValueChange={(value) => setFormData({ ...formData, fromUnitId: value })}
                                        disabled={!!editingConversion}
                                        required
                                    >
                                        <SelectTrigger id="fromUnit">
                                            <SelectValue placeholder={t("units.selectUnitPlaceholder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {units.map((unit) => (
                                                <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.code})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">
                                        {t("units.alternateUnitDesc")}
                                    </p>
                                </div>

                                <div className="flex justify-center my-2 text-slate-400">
                                    <ArrowRightLeft className="h-5 w-5 rotate-90" />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="toUnit">{t("units.baseUnitTo")}</Label>
                                    <Select
                                        value={formData.toUnitId}
                                        onValueChange={(value) => setFormData({ ...formData, toUnitId: value })}
                                        disabled={!!editingConversion}
                                        required
                                    >
                                        <SelectTrigger id="toUnit">
                                            <SelectValue placeholder={t("units.selectBaseUnitPlaceholder")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {units.map((unit) => (
                                                <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.code})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-500">
                                        {t("units.baseUnitDesc")}
                                    </p>
                                </div>

                                <div className="grid gap-2 mt-2">
                                    <Label htmlFor="conversionFactor">{t("units.conversionFactor")}</Label>
                                    <Input
                                        id="conversionFactor"
                                        type="number"
                                        min="0.0001"
                                        step="0.0001"
                                        value={formData.conversionFactor}
                                        onChange={(e) =>
                                            setFormData({ ...formData, conversionFactor: e.target.value })
                                        }
                                        placeholder="e.g., 10"
                                        required
                                    />
                                    <p className="text-xs text-slate-500">
                                        {t("units.conversionFactorDesc")}
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit">
                                    {editingConversion ? t("units.updateRule") : t("units.addRule")}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <TableSkeleton columns={4} rows={3} />
                ) : conversions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg border-dashed">
                        <ArrowRightLeft className="h-10 w-10 text-slate-300 mb-2" />
                        <h3 className="text-base font-semibold">{t("units.noConversionRules")}</h3>
                        <p className="text-sm text-slate-500 max-w-sm mt-1">
                            {t("units.noConversionRulesDesc")}
                        </p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("units.rule")}</TableHead>
                                <TableHead>{t("units.fromUnit")}</TableHead>
                                <TableHead>{t("units.toBaseUnit")}</TableHead>
                                <TableHead className="text-right">{t("common.actions")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {conversions.map((conversion) => (
                                <TableRow key={conversion.id}>
                                    <TableCell>
                                        <div className="font-medium bg-slate-100 px-3 py-1.5 rounded-md inline-block">
                                            1 {conversion.fromUnit.name} = {Number(conversion.conversionFactor)} {conversion.toUnit.name}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {conversion.fromUnit.name}{" "}
                                        <span className="text-slate-500 text-sm">({conversion.fromUnit.code.toUpperCase()})</span>
                                    </TableCell>
                                    <TableCell>
                                        {conversion.toUnit.name}{" "}
                                        <span className="text-slate-500 text-sm">({conversion.toUnit.code.toUpperCase()})</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEdit(conversion)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(conversion.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
