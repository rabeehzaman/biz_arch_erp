"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TrendingUp, GitBranch, RefreshCw, Download, AlertTriangle, Warehouse, ChevronRight, ChevronDown } from "lucide-react";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

interface WarehouseRow {
    warehouseId: string | null;
    warehouseName: string;
    warehouseCode: string | null;
    invoiceCount: number;
    revenue: number;
    totalInvoiced: number;
    collected: number;
    outstanding: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
}

interface BranchRow {
    branchId: string | null;
    branchName: string;
    branchCode: string | null;
    invoiceCount: number;
    revenue: number;
    totalInvoiced: number;
    collected: number;
    outstanding: number;
    purchases: number;
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    warehouses: WarehouseRow[];
}

interface Totals {
    invoiceCount: number;
    revenue: number;
    totalInvoiced: number;
    collected: number;
    outstanding: number;
    purchases: number;
    cogs: number;
    grossProfit: number;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

function marginColor(m: number) {
    return m >= 20 ? "text-emerald-600" : m >= 10 ? "text-amber-600" : "text-red-600";
}

export default function BranchPLPage() {
    const { data: session } = useSession();
    const multiBranchEnabled = (session?.user as any)?.multiBranchEnabled;

    const today = new Date();
    const firstOfYear = new Date(today.getFullYear(), 0, 1);

    const [fromDate, setFromDate] = useState(format(firstOfYear, "yyyy-MM-dd"));
    const [toDate, setToDate] = useState(format(today, "yyyy-MM-dd"));
    const [rows, setRows] = useState<BranchRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ fromDate, toDate });
            const res = await fetch(`/api/reports/branch-pl?${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setRows(data.rows);
            setTotals(data.totals);
        } catch {
            toast.error("Failed to load branch P&L");
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleExpand = (branchId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(branchId)) next.delete(branchId);
            else next.add(branchId);
            return next;
        });
    };

    function exportCSV() {
        const headers = ["Type", "Branch", "Code", "Invoices", "Revenue", "Total Invoiced", "Collected", "Outstanding", "Purchases", "COGS", "Gross Profit", "Margin %"];
        const csvRows = [headers.join(",")];
        for (const r of rows) {
            csvRows.push([
                "Branch", `"${r.branchName}"`, r.branchCode || "", r.invoiceCount,
                r.revenue.toFixed(2), r.totalInvoiced.toFixed(2), r.collected.toFixed(2),
                r.outstanding.toFixed(2), r.purchases.toFixed(2), r.cogs.toFixed(2),
                r.grossProfit.toFixed(2), r.grossMargin.toFixed(1),
            ].join(","));
            for (const w of r.warehouses) {
                csvRows.push([
                    "Warehouse", `"${r.branchName} > ${w.warehouseName}"`, w.warehouseCode || "",
                    w.invoiceCount, w.revenue.toFixed(2), w.totalInvoiced.toFixed(2),
                    w.collected.toFixed(2), w.outstanding.toFixed(2), "",
                    w.cogs.toFixed(2), w.grossProfit.toFixed(2), w.grossMargin.toFixed(1),
                ].join(","));
            }
        }
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `branch-pl-${fromDate}-to-${toDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (!multiBranchEnabled) {
        return (
            <PageAnimation>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Multi-Branch Not Enabled</h2>
                    <p className="text-slate-500 max-w-md">
                        The Branch P&L report is only available for organizations with multi-branch mode enabled.
                        Contact your administrator to enable this feature.
                    </p>
                </div>
            </PageAnimation>
        );
    }

    const overallMargin = totals && totals.revenue > 0
        ? (totals.grossProfit / totals.revenue) * 100
        : 0;

    return (
        <PageAnimation>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Branch P&L Report</h2>
                        <p className="text-slate-500">Revenue, COGS and gross profit breakdown by branch (expand for warehouse detail)</p>
                    </div>
                    <div className="flex gap-2">
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

                {/* Date Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">From Date</Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">To Date</Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
                            </div>
                            <Button onClick={fetchData} size="sm">Apply</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                {totals && (
                    <StaggerContainer>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">Total Revenue</p>
                                    <p className="text-xl font-bold text-slate-900">{fmt(totals.revenue)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">Total COGS</p>
                                    <p className="text-xl font-bold text-red-600">{fmt(totals.cogs)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">Gross Profit</p>
                                    <p className={`text-xl font-bold ${totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                        {fmt(totals.grossProfit)}
                                    </p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">Overall Margin</p>
                                    <p className={`text-xl font-bold ${marginColor(overallMargin)}`}>{pct(overallMargin)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                        </div>
                    </StaggerContainer>
                )}

                {/* Branch Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GitBranch className="h-5 w-5" />
                            Branch Performance
                            <span className="text-xs font-normal text-slate-400 ml-2">Click a branch row to expand warehouse details</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        {loading ? (
                            <TableSkeleton columns={9} rows={4} />
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <TrendingUp className="h-12 w-12 mb-3 text-slate-300" />
                                <p className="font-medium">No data for this period</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-8"></TableHead>
                                        <TableHead>Branch / Warehouse</TableHead>
                                        <TableHead className="text-right">Invoices</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">COGS</TableHead>
                                        <TableHead className="text-right">Gross Profit</TableHead>
                                        <TableHead className="text-right">Margin</TableHead>
                                        <TableHead className="text-right">Collected</TableHead>
                                        <TableHead className="text-right">Outstanding</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, i) => {
                                        const key = row.branchId ?? `unassigned-${i}`;
                                        const isOpen = expanded.has(key);
                                        const hasWarehouses = row.warehouses.length > 1 || (row.warehouses.length === 1 && row.warehouses[0].warehouseId !== null);
                                        return (
                                            <>
                                                {/* Branch row */}
                                                <TableRow
                                                    key={`branch-${i}`}
                                                    className={`cursor-pointer hover:bg-slate-50 font-medium ${isOpen ? "bg-purple-50/50" : ""}`}
                                                    onClick={() => hasWarehouses && toggleExpand(key)}
                                                >
                                                    <TableCell className="pl-4">
                                                        {hasWarehouses ? (
                                                            isOpen
                                                                ? <ChevronDown className="h-4 w-4 text-slate-400" />
                                                                : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                        ) : null}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-1.5 bg-purple-100 rounded">
                                                                <GitBranch className="h-3.5 w-3.5 text-purple-600" />
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-slate-900">{row.branchName}</span>
                                                                {row.branchCode && <span className="ml-2 text-xs text-slate-400">({row.branchCode})</span>}
                                                            </div>
                                                            {!row.branchId && <Badge variant="outline" className="text-xs text-slate-400">Unassigned</Badge>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{row.invoiceCount}</TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">{fmt(row.revenue)}</TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">{fmt(row.cogs)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        <span className={row.grossProfit >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                                                            {fmt(row.grossProfit)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        <span className={`font-medium ${marginColor(row.grossMargin)}`}>{pct(row.grossMargin)}</span>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-emerald-600">{fmt(row.collected)}</TableCell>
                                                    <TableCell className="text-right tabular-nums">
                                                        <span className={row.outstanding > 0 ? "text-amber-600" : "text-slate-400"}>{fmt(row.outstanding)}</span>
                                                    </TableCell>
                                                </TableRow>

                                                {/* Warehouse drill-down rows */}
                                                {isOpen && row.warehouses.map((wh, wi) => (
                                                    <TableRow key={`wh-${i}-${wi}`} className="bg-slate-50/80 hover:bg-slate-100/60">
                                                        <TableCell></TableCell>
                                                        <TableCell className="pl-10">
                                                            <div className="flex items-center gap-2">
                                                                <Warehouse className="h-3.5 w-3.5 text-indigo-400" />
                                                                <span className="text-sm text-slate-700">{wh.warehouseName}</span>
                                                                {wh.warehouseCode && <span className="text-xs text-slate-400">({wh.warehouseCode})</span>}
                                                                {!wh.warehouseId && <span className="text-xs text-slate-400 italic">unassigned</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">{wh.invoiceCount}</TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">{fmt(wh.revenue)}</TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm text-red-500">{fmt(wh.cogs)}</TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">
                                                            <span className={wh.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                                {fmt(wh.grossProfit)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">
                                                            <span className={marginColor(wh.grossMargin)}>{pct(wh.grossMargin)}</span>
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm text-emerald-600">{fmt(wh.collected)}</TableCell>
                                                        <TableCell className="text-right tabular-nums text-sm">
                                                            <span className={wh.outstanding > 0 ? "text-amber-600" : "text-slate-400"}>{fmt(wh.outstanding)}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </>
                                        );
                                    })}

                                    {/* Totals row */}
                                    {totals && (
                                        <TableRow className="bg-slate-100 font-bold border-t-2">
                                            <TableCell></TableCell>
                                            <TableCell>Total</TableCell>
                                            <TableCell className="text-right tabular-nums">{totals.invoiceCount}</TableCell>
                                            <TableCell className="text-right tabular-nums">{fmt(totals.revenue)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">{fmt(totals.cogs)}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                <span className={totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}>{fmt(totals.grossProfit)}</span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                <span className={marginColor(overallMargin)}>{pct(overallMargin)}</span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">{fmt(totals.collected)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-amber-600">{fmt(totals.outstanding)}</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageAnimation>
    );
}
