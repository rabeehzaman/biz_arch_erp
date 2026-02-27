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
import { TrendingUp, GitBranch, RefreshCw, Download, AlertTriangle } from "lucide-react";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { format } from "date-fns";

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

export default function BranchPLPage() {
    const { data: session } = useSession();
    const multiBranchEnabled = session?.user?.multiBranchEnabled;

    const today = new Date();
    const firstOfYear = new Date(today.getFullYear(), 0, 1);

    const [fromDate, setFromDate] = useState(format(firstOfYear, "yyyy-MM-dd"));
    const [toDate, setToDate] = useState(format(today, "yyyy-MM-dd"));
    const [rows, setRows] = useState<BranchRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    function exportCSV() {
        const headers = ["Branch", "Code", "Invoices", "Revenue", "Total Invoiced", "Collected", "Outstanding", "Purchases", "COGS", "Gross Profit", "Margin %"];
        const csvRows = [
            headers.join(","),
            ...rows.map((r) => [
                `"${r.branchName}"`,
                r.branchCode || "",
                r.invoiceCount,
                r.revenue.toFixed(2),
                r.totalInvoiced.toFixed(2),
                r.collected.toFixed(2),
                r.outstanding.toFixed(2),
                r.purchases.toFixed(2),
                r.cogs.toFixed(2),
                r.grossProfit.toFixed(2),
                r.grossMargin.toFixed(1),
            ].join(","))
        ];
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
                        <p className="text-slate-500">Revenue, COGS and gross profit breakdown by branch</p>
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
                                <Input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-40"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">To Date</Label>
                                <Input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-40"
                                />
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
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-xs text-slate-500">Total Revenue</p>
                                        <p className="text-xl font-bold text-slate-900">{fmt(totals.revenue)}</p>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-xs text-slate-500">Total COGS</p>
                                        <p className="text-xl font-bold text-red-600">{fmt(totals.cogs)}</p>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-xs text-slate-500">Gross Profit</p>
                                        <p className={`text-xl font-bold ${totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                            {fmt(totals.grossProfit)}
                                        </p>
                                    </CardContent>
                                </Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card>
                                    <CardContent className="p-4">
                                        <p className="text-xs text-slate-500">Overall Margin</p>
                                        <p className={`text-xl font-bold ${overallMargin >= 20 ? "text-emerald-600" : overallMargin >= 10 ? "text-amber-600" : "text-red-600"}`}>
                                            {pct(overallMargin)}
                                        </p>
                                    </CardContent>
                                </Card>
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
                                        <TableHead>Branch</TableHead>
                                        <TableHead className="text-right">Invoices</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">COGS</TableHead>
                                        <TableHead className="text-right">Gross Profit</TableHead>
                                        <TableHead className="text-right">Margin</TableHead>
                                        <TableHead className="text-right">Collected</TableHead>
                                        <TableHead className="text-right">Outstanding</TableHead>
                                        <TableHead className="text-right">Purchases</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row, i) => {
                                        const marginColor = row.grossMargin >= 20 ? "text-emerald-600" : row.grossMargin >= 10 ? "text-amber-600" : "text-red-600";
                                        return (
                                            <TableRow key={i} className="hover:bg-slate-50">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-purple-100 rounded">
                                                            <GitBranch className="h-3.5 w-3.5 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900">{row.branchName}</p>
                                                            {row.branchCode && (
                                                                <p className="text-xs text-slate-400">{row.branchCode}</p>
                                                            )}
                                                        </div>
                                                        {!row.branchId && (
                                                            <Badge variant="outline" className="text-xs text-slate-400">Unassigned</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{row.invoiceCount}</TableCell>
                                                <TableCell className="text-right tabular-nums font-medium">{fmt(row.revenue)}</TableCell>
                                                <TableCell className="text-right tabular-nums text-red-600">{fmt(row.cogs)}</TableCell>
                                                <TableCell className="text-right tabular-nums font-semibold">
                                                    <span className={row.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                        {fmt(row.grossProfit)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    <span className={`font-medium ${marginColor}`}>{pct(row.grossMargin)}</span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-emerald-600">{fmt(row.collected)}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    <span className={row.outstanding > 0 ? "text-amber-600" : "text-slate-400"}>
                                                        {fmt(row.outstanding)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-slate-600">{fmt(row.purchases)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {/* Totals row */}
                                    {totals && (
                                        <TableRow className="bg-slate-100 font-bold border-t-2">
                                            <TableCell>Total</TableCell>
                                            <TableCell className="text-right tabular-nums">{totals.invoiceCount}</TableCell>
                                            <TableCell className="text-right tabular-nums">{fmt(totals.revenue)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-red-600">{fmt(totals.cogs)}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                <span className={totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
                                                    {fmt(totals.grossProfit)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                <span className={overallMargin >= 20 ? "text-emerald-600" : overallMargin >= 10 ? "text-amber-600" : "text-red-600"}>
                                                    {pct(overallMargin)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-emerald-600">{fmt(totals.collected)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-amber-600">{fmt(totals.outstanding)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{fmt(totals.purchases)}</TableCell>
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
