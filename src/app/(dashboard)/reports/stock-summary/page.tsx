"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Package, Search, AlertTriangle, Warehouse, RefreshCw, Download, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadBlob } from "@/lib/download";

interface StockRow {
    productId: string;
    productName: string;
    sku: string | null;
    unit: { id: string; name: string; code: string } | null;
    defaultUnit: { unitName: string; unitCode: string; conversionFactor: number } | null;
    warehouseId: string | null;
    warehouseName: string | null;
    branchName: string | null;
    totalQuantity: number;
    totalValue: number;
    avgCost: number;
    reorderPoint: number | null;
    lotCount: number;
}

interface Summary {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
}

interface WarehouseOption {
    id: string;
    name: string;
    code: string;
    branch: { id: string; name: string; code: string };
}

interface BranchOption {
    id: string;
    name: string;
    code: string;
}

export default function StockSummaryPage() {
    const router = useRouter();
    const { t, isRTL } = useLanguage();
    const BackArrow = isRTL ? ArrowRight : ArrowLeft;
    const { data: session } = useSession();
    const multiBranchEnabled = session?.user?.multiBranchEnabled;
    const { symbol, locale } = useCurrency();

    const [rows, setRows] = useState<StockRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
    const [branches, setBranches] = useState<BranchOption[]>([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [filterBranchId, setFilterBranchId] = useState("all");
    const [filterWarehouseId, setFilterWarehouseId] = useState("all");
    const [lowStockOnly, setLowStockOnly] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterWarehouseId !== "all") params.set("warehouseId", filterWarehouseId);
            if (filterBranchId !== "all") params.set("branchId", filterBranchId);
            if (lowStockOnly) params.set("lowStockOnly", "true");

            const res = await fetch(`/api/reports/stock-summary?${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setRows(data.rows);
            setSummary(data.summary);
            setWarehouses(data.warehouses);
            setBranches(data.branches);
        } catch {
            toast.error(t("reports.noDataForPeriod"));
        } finally {
            setLoading(false);
        }
    }, [filterWarehouseId, filterBranchId, lowStockOnly, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredRows = rows.filter((r) =>
        r.productName.toLowerCase().includes(search.toLowerCase()) ||
        (r.sku ?? "").toLowerCase().includes(search.toLowerCase())
    );

    // Branch filter changes should reset warehouse filter
    function handleBranchChange(val: string) {
        setFilterBranchId(val);
        setFilterWarehouseId("all");
    }

    const warehousesForFilter = filterBranchId === "all"
        ? warehouses
        : warehouses.filter((w) => w.branch.id === filterBranchId);

    async function exportCSV() {
        const headers = [
            t("reports.product"), "SKU", t("reports.warehouseName"), t("reports.branchName"), t("reports.qtyInStock"), t("reports.avgCost"), t("reports.totalStockValue"), t("reports.reorderAt"), t("reports.lots")
        ];
        const csvRows = [
            headers.join(","),
            ...filteredRows.map((r) => {
                const qty = r.defaultUnit
                    ? (r.totalQuantity / r.defaultUnit.conversionFactor)
                    : r.totalQuantity;
                const unitCode = r.defaultUnit ? r.defaultUnit.unitCode : (r.unit?.code || "");
                return [
                    `"${r.productName}"`,
                    r.sku || "",
                    r.warehouseName || "Global",
                    r.branchName || "",
                    `${qty} ${unitCode}`.trim(),
                    r.avgCost.toFixed(2),
                    r.totalValue.toFixed(2),
                    r.reorderPoint ?? "",
                    r.lotCount,
                ].join(",");
            })
        ];
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        await downloadBlob(blob, `stock-summary-${new Date().toISOString().split("T")[0]}.csv`);
    }

    return (
        <PageAnimation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href="/reports" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                            <BackArrow className="h-4 w-4" />
                            {t("nav.reports")}
                        </Link>
                        <h2 className="text-2xl font-bold text-slate-900">{t("reports.stockSummary")}</h2>
                        <p className="text-slate-500">{t("reports.stockSummaryDesc")}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 sm:w-auto">
                            <RefreshCw className="h-4 w-4" />
                            {t("reports.refresh")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 sm:w-auto">
                            <Download className="h-4 w-4" />
                            {t("reports.exportCsv")}
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <StaggerContainer>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-5 flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <Package className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">{t("reports.productWarehouseCombos")}</p>
                                            <p className="text-2xl font-bold">{summary.totalItems}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-5 flex items-center gap-3">
                                        <div className="p-2 bg-emerald-50 rounded-lg">
                                            <Warehouse className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">{t("reports.totalStockValue")}</p>
                                            <p className="text-2xl font-bold">
                                                {symbol}{summary.totalValue.toLocaleString(locale, { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-5 flex items-center gap-3">
                                        <div className="p-2 bg-red-50 rounded-lg">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">{t("reports.lowStockItems")}</p>
                                            <p className="text-2xl font-bold text-red-600">{summary.lowStockCount}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                        </div>
                    </StaggerContainer>
                )}

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder={t("reports.searchProducts")}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {multiBranchEnabled && branches.length > 0 && (
                                <Select value={filterBranchId} onValueChange={handleBranchChange}>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder={t("reports.allBranches")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t("reports.allBranches")}</SelectItem>
                                        {branches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {multiBranchEnabled && warehouses.length > 0 && (
                                <Select value={filterWarehouseId} onValueChange={setFilterWarehouseId}>
                                    <SelectTrigger className="w-full sm:w-[200px]">
                                        <SelectValue placeholder={t("reports.allWarehouses")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t("reports.allWarehouses")}</SelectItem>
                                        {warehousesForFilter.map((w) => (
                                            <SelectItem key={w.id} value={w.id}>
                                                {filterBranchId === "all" ? `${w.branch.name} → ${w.name}` : w.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="low-stock"
                                    checked={lowStockOnly}
                                    onCheckedChange={setLowStockOnly}
                                />
                                <Label htmlFor="low-stock" className="text-sm cursor-pointer whitespace-nowrap">
                                    {t("reports.lowStockOnly")}
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t("reports.stockLevels")}
                            {filteredRows.length !== rows.length && (
                                <span className="text-slate-400 font-normal ml-2 text-sm">
                                    ({filteredRows.length} of {rows.length})
                                </span>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <TableSkeleton columns={7} rows={6} />
                        ) : filteredRows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <Package className="h-12 w-12 mb-3 text-slate-300" />
                                <p className="font-medium">{t("reports.noStockFound")}</p>
                                <p className="text-sm">
                                    {lowStockOnly ? t("reports.noLowStock") : t("reports.noInventoryMatching")}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 p-4 sm:hidden">
                                    {filteredRows.map((row, i) => {
                                        const isLow = row.reorderPoint !== null && row.totalQuantity <= row.reorderPoint;

                                        return (
                                            <div
                                                key={`${row.productId}-${row.warehouseId ?? "null"}-${i}`}
                                                onClick={() => router.push(`/products?highlight=${row.productId}`)}
                                                className={`cursor-pointer rounded-2xl border p-4 shadow-sm hover:bg-muted/50 ${isLow ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-white"}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-slate-900">{row.productName}</p>
                                                        {row.sku && <p className="mt-1 text-xs text-slate-500">{t("reports.skuLabel")} {row.sku}</p>}
                                                    </div>
                                                    {isLow ? (
                                                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            {t("reports.lowStockItems")}
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                            {t("common.active")}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                    {multiBranchEnabled && (
                                                        <div className="col-span-2">
                                                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.warehouseName")}</p>
                                                            <p className="mt-1 text-slate-900">
                                                                {row.warehouseName || "Global"}
                                                                {row.branchName && <span className="text-slate-500"> · {row.branchName}</span>}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.qtyInStock")}</p>
                                                        <p className={`mt-1 font-semibold ${isLow ? "text-red-600" : "text-slate-900"}`}>
                                                            {row.defaultUnit
                                                                ? (row.totalQuantity / row.defaultUnit.conversionFactor).toLocaleString(locale, { maximumFractionDigits: 3 })
                                                                : row.totalQuantity.toLocaleString(locale, { maximumFractionDigits: 2 })}
                                                            <span className="ml-1 text-xs text-slate-400">
                                                                {row.defaultUnit ? row.defaultUnit.unitCode : row.unit?.code}
                                                            </span>
                                                        </p>
                                                        {row.reorderPoint !== null && (
                                                            <p className="mt-1 text-xs text-slate-400">{t("reports.reorderAt")} {row.reorderPoint}</p>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.avgCost")}</p>
                                                        <p className="mt-1 font-medium text-slate-900">
                                                            {symbol}{row.avgCost.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.totalStockValue")}</p>
                                                        <p className="mt-1 font-semibold text-slate-900">
                                                            {symbol}{row.totalValue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("reports.lots")}</p>
                                                        <p className="mt-1 font-medium text-slate-900">
                                                            {row.lotCount} {row.lotCount === 1 ? t("reports.lot") : t("reports.lots")}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="hidden sm:block">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead>{t("reports.product")}</TableHead>
                                                {multiBranchEnabled && <TableHead>{t("reports.warehouseName")}</TableHead>}
                                                <TableHead className="text-right">{t("reports.qtyInStock")}</TableHead>
                                                <TableHead className="text-right">{t("reports.avgCost")}</TableHead>
                                                <TableHead className="text-right">{t("reports.totalStockValue")}</TableHead>
                                                <TableHead className="text-center">{t("reports.lots")}</TableHead>
                                                <TableHead className="text-center">{t("common.status")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRows.map((row, i) => {
                                                const isLow = row.reorderPoint !== null && row.totalQuantity <= row.reorderPoint;
                                                return (
                                                    <TableRow
                                                        key={`${row.productId}-${row.warehouseId ?? "null"}-${i}`}
                                                        onClick={() => router.push(`/products?highlight=${row.productId}`)}
                                                        className={`cursor-pointer ${isLow ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-muted/50"}`}
                                                    >
                                                        <TableCell>
                                                            <p className="font-medium text-slate-900">{row.productName}</p>
                                                            {row.sku && <p className="text-xs text-slate-500">{t("reports.skuLabel")} {row.sku}</p>}
                                                        </TableCell>
                                                        {multiBranchEnabled && (
                                                            <TableCell>
                                                                {row.warehouseName ? (
                                                                    <div>
                                                                        <p className="text-sm text-slate-700">{row.warehouseName}</p>
                                                                        {row.branchName && (
                                                                            <p className="text-xs text-slate-400">{row.branchName}</p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm text-slate-400">Global</span>
                                                                )}
                                                            </TableCell>
                                                        )}
                                                        <TableCell className="text-right tabular-nums">
                                                            <span className={isLow ? "text-red-600 font-semibold" : ""}>
                                                                {row.defaultUnit
                                                                    ? (row.totalQuantity / row.defaultUnit.conversionFactor).toLocaleString(locale, { maximumFractionDigits: 3 })
                                                                    : row.totalQuantity.toLocaleString(locale, { maximumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-xs text-slate-400 ml-1">
                                                                {row.defaultUnit ? row.defaultUnit.unitCode : row.unit?.code}
                                                            </span>
                                                            {row.reorderPoint !== null && (
                                                                <p className="text-xs text-slate-400">
                                                                    {t("reports.reorderAt")} {row.reorderPoint}
                                                                </p>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">
                                                            {symbol}{row.avgCost.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium tabular-nums">
                                                            {symbol}{row.totalValue.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className="text-xs">
                                                                {row.lotCount} {row.lotCount === 1 ? t("reports.lot") : t("reports.lots")}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {isLow ? (
                                                                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                                                                    <AlertTriangle className="h-3 w-3" />
                                                                    {t("reports.lowStockItems")}
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                                    {t("common.active")}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageAnimation>
    );
}
