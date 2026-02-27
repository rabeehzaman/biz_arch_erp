"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Package, Search, AlertTriangle, Warehouse, RefreshCw, Download } from "lucide-react";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface StockRow {
    productId: string;
    productName: string;
    sku: string | null;
    unit: { id: string; name: string; code: string } | null;
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
    const { data: session } = useSession();
    const multiBranchEnabled = session?.user?.multiBranchEnabled;

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
            toast.error("Failed to load stock summary");
        } finally {
            setLoading(false);
        }
    }, [filterWarehouseId, filterBranchId, lowStockOnly]);

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

    function exportCSV() {
        const headers = [
            "Product", "SKU", "Warehouse", "Branch", "Qty", "Avg Cost", "Total Value", "Reorder Point", "Lots"
        ];
        const csvRows = [
            headers.join(","),
            ...filteredRows.map((r) => [
                `"${r.productName}"`,
                r.sku || "",
                r.warehouseName || "Global",
                r.branchName || "",
                r.totalQuantity,
                r.avgCost.toFixed(2),
                r.totalValue.toFixed(2),
                r.reorderPoint ?? "",
                r.lotCount,
            ].join(","))
        ];
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stock-summary-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <PageAnimation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Stock Summary</h2>
                        <p className="text-slate-500">Current inventory levels by product and warehouse</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
                            <Download className="h-4 w-4" />
                            Export CSV
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
                                            <p className="text-sm text-slate-500">Product-Warehouse Combos</p>
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
                                            <p className="text-sm text-slate-500">Total Stock Value</p>
                                            <p className="text-2xl font-bold">
                                                ₹{summary.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
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
                                            <p className="text-sm text-slate-500">Low Stock Items</p>
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
                                    placeholder="Search products..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            {multiBranchEnabled && branches.length > 0 && (
                                <Select value={filterBranchId} onValueChange={handleBranchChange}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="All Branches" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Branches</SelectItem>
                                        {branches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {multiBranchEnabled && warehouses.length > 0 && (
                                <Select value={filterWarehouseId} onValueChange={setFilterWarehouseId}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="All Warehouses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Warehouses</SelectItem>
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
                                    Low stock only
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Stock Levels
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
                                <p className="font-medium">No stock found</p>
                                <p className="text-sm">
                                    {lowStockOnly ? "No low-stock items for the selected filters" : "No inventory matching your filters"}
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        {multiBranchEnabled && <TableHead>Warehouse</TableHead>}
                                        <TableHead className="text-right">Qty in Stock</TableHead>
                                        <TableHead className="text-right">Avg Cost</TableHead>
                                        <TableHead className="text-right">Total Value</TableHead>
                                        <TableHead className="text-center">Lots</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRows.map((row, i) => {
                                        const isLow = row.reorderPoint !== null && row.totalQuantity <= row.reorderPoint;
                                        return (
                                            <TableRow
                                                key={`${row.productId}-${row.warehouseId ?? "null"}-${i}`}
                                                className={isLow ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50"}
                                            >
                                                <TableCell>
                                                    <p className="font-medium text-slate-900">{row.productName}</p>
                                                    {row.sku && <p className="text-xs text-slate-500">SKU: {row.sku}</p>}
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
                                                        {row.totalQuantity.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                                    </span>
                                                    {row.unit && (
                                                        <span className="text-xs text-slate-400 ml-1">{row.unit.code}</span>
                                                    )}
                                                    {row.reorderPoint !== null && (
                                                        <p className="text-xs text-slate-400">
                                                            Reorder at {row.reorderPoint}
                                                        </p>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-sm">
                                                    ₹{row.avgCost.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-right font-medium tabular-nums">
                                                    ₹{row.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="text-xs">
                                                        {row.lotCount} {row.lotCount === 1 ? "lot" : "lots"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isLow ? (
                                                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-1">
                                                            <AlertTriangle className="h-3 w-3" />
                                                            Low Stock
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                            In Stock
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageAnimation>
    );
}
