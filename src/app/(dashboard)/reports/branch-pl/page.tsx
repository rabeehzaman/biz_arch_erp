"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
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
import { TrendingUp, GitBranch, RefreshCw, Download, AlertTriangle, Warehouse, ChevronRight, ChevronDown, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { firstOfYear as firstOfYearStr, lastOfMonth } from "@/lib/date-utils";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { downloadBlob } from "@/lib/download";
import { useBranchFilter } from "@/hooks/use-branch-filter";
import { BranchFilterSelect } from "@/components/reports/branch-filter-select";

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

const pct = (n: number) => `${n.toFixed(1)}%`;

function marginColor(m: number) {
    return m >= 20 ? "text-emerald-600" : m >= 10 ? "text-amber-600" : "text-red-600";
}

function MobileMetric({
    label,
    value,
    className = "",
}: {
    label: string;
    value: string | number;
    className?: string;
}) {
    return (
        <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-sm font-semibold ${className}`}>{value}</p>
        </div>
    );
}

export default function BranchPLPage() {
    const { t, isRTL } = useLanguage();
    const BackArrow = isRTL ? ArrowRight : ArrowLeft;
    const { data: session } = useSession();
    const multiBranchEnabled = (session?.user as any)?.multiBranchEnabled;
    const { branches, filterBranchId, setFilterBranchId, branchParam } = useBranchFilter();
    const { symbol, locale } = useCurrency();
    const fmt = (n: number) => `${symbol}${n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    const [fromDate, setFromDate] = useState(firstOfYearStr());
    const [toDate, setToDate] = useState(lastOfMonth());
    const [rows, setRows] = useState<BranchRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ fromDate, toDate });
            if (branchParam) params.set("branchId", branchParam);
            const res = await fetch(`/api/reports/branch-pl?${params}`);
            if (!res.ok) throw new Error("Failed to load");
            const data = await res.json();
            setRows(data.rows);
            setTotals(data.totals);
        } catch {
            toast.error(t("reports.noDataForPeriod"));
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate, t, branchParam]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const toggleExpand = (branchId: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(branchId)) next.delete(branchId);
            else next.add(branchId);
            return next;
        });
    };

    async function exportCSV() {
        const headers = [t("reports.type"), t("reports.branchName"), t("common.code"), t("reports.invoiceNumber"), t("reports.totalRevenue"), t("reports.invoiced"), t("reports.collected"), t("reports.outstanding"), t("reports.purchases"), t("reports.cogs"), t("reports.grossProfit"), t("reports.margin")];
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
        await downloadBlob(blob, `branch-pl-${fromDate}-to-${toDate}.csv`);
    }

    if (!multiBranchEnabled) {
        return (
            <PageAnimation>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">{t("reports.multiBranchDisabled")}</h2>
                    <p className="text-slate-500 max-w-md">
                        {t("reports.multiBranchDisabledDesc")}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link href="/reports" className="mb-1 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                            <BackArrow className="h-4 w-4" />
                            {t("nav.reports")}
                        </Link>
                        <h2 className="text-2xl font-bold text-slate-900">{t("reports.branchPL")}</h2>
                        <p className="text-slate-500">{t("reports.branchPlDesc")}</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            {t("reports.refresh")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
                            <Download className="h-4 w-4" />
                            {t("reports.exportCsv")}
                        </Button>
                    </div>
                </div>

                {/* Date Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="grid gap-4 sm:grid-cols-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{t("reports.fromDate")}</Label>
                                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500">{t("reports.toDate")}</Label>
                                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                            </div>
                            <BranchFilterSelect
                                branches={branches}
                                filterBranchId={filterBranchId}
                                onBranchChange={setFilterBranchId}
                                multiBranchEnabled={multiBranchEnabled}
                            />
                            <Button onClick={fetchData} size="sm" className="w-full self-end sm:w-auto">{t("reports.generate")}</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Cards */}
                {totals && (
                    <StaggerContainer>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">{t("reports.totalRevenue")}</p>
                                    <p className="text-xl font-bold text-slate-900">{fmt(totals.revenue)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">{t("reports.totalCogs")}</p>
                                    <p className="text-xl font-bold text-red-600">{fmt(totals.cogs)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">{t("reports.grossProfit")}</p>
                                    <p className={`text-xl font-bold ${totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                        {fmt(totals.grossProfit)}
                                    </p>
                                </CardContent></Card>
                            </StaggerItem>
                            <StaggerItem>
                                <Card><CardContent className="p-4">
                                    <p className="text-xs text-slate-500">{t("reports.overallMargin")}</p>
                                    <p className={`text-xl font-bold ${marginColor(overallMargin)}`}>{pct(overallMargin)}</p>
                                </CardContent></Card>
                            </StaggerItem>
                        </div>
                    </StaggerContainer>
                )}

                {/* Branch Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex flex-wrap items-center gap-2">
                            <GitBranch className="h-5 w-5" />
                            {t("reports.branchPerformance")}
                            <span className="ml-0 text-xs font-normal text-slate-400 sm:ml-2">{t("reports.expandHint")}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <TableSkeleton columns={9} rows={4} />
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <TrendingUp className="h-12 w-12 mb-3 text-slate-300" />
                                <p className="font-medium">{t("reports.noDataAvailable")}</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 p-4 sm:hidden">
                                    {rows.map((row, i) => {
                                        const key = row.branchId ?? `unassigned-${i}`;
                                        const isOpen = expanded.has(key);
                                        const hasWarehouses = row.warehouses.length > 1 || (row.warehouses.length === 1 && row.warehouses[0].warehouseId !== null);

                                        return (
                                            <div key={key} className="rounded-xl border bg-white p-4 shadow-sm">
                                                <button
                                                    type="button"
                                                    className="flex w-full items-start justify-between gap-3 text-left"
                                                    onClick={() => hasWarehouses && toggleExpand(key)}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-semibold text-slate-900">{row.branchName}</span>
                                                            {row.branchCode && <span className="text-xs text-slate-400">({row.branchCode})</span>}
                                                            {!row.branchId && <Badge variant="outline" className="text-xs text-slate-400">{t("common.inactive")}</Badge>}
                                                        </div>
                                                        <p className="mt-1 text-sm text-slate-500">{row.invoiceCount} {t("reports.invoiceNumber")}</p>
                                                    </div>
                                                    {hasWarehouses ? (
                                                        isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />
                                                    ) : null}
                                                </button>

                                                <div className="mt-4 grid grid-cols-2 gap-3">
                                                    <MobileMetric label={t("reports.totalRevenue")} value={fmt(row.revenue)} />
                                                    <MobileMetric label={t("reports.cogs")} value={fmt(row.cogs)} className="text-red-600" />
                                                    <MobileMetric label={t("reports.grossProfit")} value={fmt(row.grossProfit)} className={row.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                                                    <MobileMetric label={t("reports.margin")} value={pct(row.grossMargin)} className={marginColor(row.grossMargin)} />
                                                    <MobileMetric label={t("reports.collected")} value={fmt(row.collected)} className="text-emerald-600" />
                                                    <MobileMetric label={t("reports.outstanding")} value={fmt(row.outstanding)} className={row.outstanding > 0 ? "text-amber-600" : "text-slate-500"} />
                                                </div>

                                                {isOpen && hasWarehouses && (
                                                    <div className="mt-4 space-y-2 border-t pt-4">
                                                        {row.warehouses.map((wh, wi) => (
                                                            <div key={`wh-mobile-${i}-${wi}`} className="rounded-lg bg-slate-50 p-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Warehouse className="h-3.5 w-3.5 text-indigo-400" />
                                                                    <span className="text-sm font-medium text-slate-700">{wh.warehouseName}</span>
                                                                    {wh.warehouseCode && <span className="text-xs text-slate-400">({wh.warehouseCode})</span>}
                                                                </div>
                                                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                                                    <MobileMetric label={t("reports.totalRevenue")} value={fmt(wh.revenue)} />
                                                                    <MobileMetric label={t("reports.totalProfit")} value={fmt(wh.grossProfit)} className={wh.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                                                                    <MobileMetric label={t("reports.margin")} value={pct(wh.grossMargin)} className={marginColor(wh.grossMargin)} />
                                                                    <MobileMetric label={t("reports.outstanding")} value={fmt(wh.outstanding)} className={wh.outstanding > 0 ? "text-amber-600" : "text-slate-500"} />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {totals && (
                                        <div className="rounded-xl border bg-slate-100 p-4">
                                            <p className="font-semibold text-slate-900">{t("reports.totals")}</p>
                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <MobileMetric label={t("reports.totalRevenue")} value={fmt(totals.revenue)} />
                                                <MobileMetric label={t("reports.cogs")} value={fmt(totals.cogs)} className="text-red-600" />
                                                <MobileMetric label={t("reports.grossProfit")} value={fmt(totals.grossProfit)} className={totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />
                                                <MobileMetric label={t("reports.margin")} value={pct(overallMargin)} className={marginColor(overallMargin)} />
                                                <MobileMetric label={t("reports.collected")} value={fmt(totals.collected)} className="text-emerald-600" />
                                                <MobileMetric label={t("reports.outstanding")} value={fmt(totals.outstanding)} className="text-amber-600" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="hidden overflow-x-auto sm:block">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="w-8"></TableHead>
                                                <TableHead>{t("reports.branchWarehouse")}</TableHead>
                                                <TableHead className="text-right">{t("reports.invoiceNumber")}</TableHead>
                                                <TableHead className="text-right">{t("reports.totalRevenue")}</TableHead>
                                                <TableHead className="text-right">{t("reports.cogs")}</TableHead>
                                                <TableHead className="text-right">{t("reports.grossProfit")}</TableHead>
                                                <TableHead className="text-right">{t("reports.margin")}</TableHead>
                                                <TableHead className="text-right">{t("reports.collected")}</TableHead>
                                                <TableHead className="text-right">{t("reports.outstanding")}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {rows.map((row, i) => {
                                                const key = row.branchId ?? `unassigned-${i}`;
                                                const isOpen = expanded.has(key);
                                                const hasWarehouses = row.warehouses.length > 1 || (row.warehouses.length === 1 && row.warehouses[0].warehouseId !== null);
                                                return (
                                                    <Fragment key={key}>
                                                        <TableRow
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
                                                                    {!row.branchId && <Badge variant="outline" className="text-xs text-slate-400">{t("common.inactive")}</Badge>}
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

                                                        {isOpen && row.warehouses.map((wh, wi) => (
                                                            <TableRow key={`wh-${i}-${wi}`} className="bg-slate-50/80 hover:bg-slate-100/60">
                                                                <TableCell></TableCell>
                                                                <TableCell className="pl-10">
                                                                    <div className="flex items-center gap-2">
                                                                        <Warehouse className="h-3.5 w-3.5 text-indigo-400" />
                                                                        <span className="text-sm text-slate-700">{wh.warehouseName}</span>
                                                                        {wh.warehouseCode && <span className="text-xs text-slate-400">({wh.warehouseCode})</span>}
                                                                        {!wh.warehouseId && <span className="text-xs text-slate-400 italic">{t("common.inactive").toLowerCase()}</span>}
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
                                                    </Fragment>
                                                );
                                            })}

                                            {totals && (
                                                <TableRow className="bg-slate-100 font-bold border-t-2">
                                                    <TableCell></TableCell>
                                                    <TableCell>{t("reports.totals")}</TableCell>
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
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageAnimation>
    );
}
