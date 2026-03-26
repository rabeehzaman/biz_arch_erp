"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Users, Clock, TrendingUp, ArrowRightLeft, Scale } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export default function JewelleryReportsPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [activeReport, setActiveReport] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];
  const monthStart = `${today.substring(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);

  const { data: stockData, isLoading: stockLoading } = useSWR(
    mounted && activeReport === "stock" ? "/api/jewellery/reports/stock-valuation" : null, fetcher
  );
  const { data: agingData, isLoading: agingLoading } = useSWR(
    mounted && activeReport === "aging" ? "/api/jewellery/reports/inventory-aging" : null, fetcher
  );
  const { data: karigarData, isLoading: karigarLoading } = useSWR(
    mounted && activeReport === "karigar" ? "/api/jewellery/reports/karigar-reconciliation" : null, fetcher
  );
  const { data: profitData, isLoading: profitLoading } = useSWR(
    mounted && activeReport === "profit" ? `/api/jewellery/reports/profit?from=${fromDate}&to=${toDate}` : null, fetcher
  );
  const { data: metalData, isLoading: metalLoading } = useSWR(
    mounted && activeReport === "metal" ? `/api/jewellery/reports/metal-balance?from=${fromDate}&to=${toDate}` : null, fetcher
  );
  const { data: movementData, isLoading: movementLoading } = useSWR(
    mounted && activeReport === "movement" ? `/api/jewellery/reports/gold-movement?from=${fromDate}&to=${toDate}` : null, fetcher
  );

  const reports = [
    { id: "profit", title: "Profit Analysis", desc: "Revenue, COGS, margin split by metal vs making", icon: TrendingUp, color: "text-green-600" },
    { id: "stock", title: "Stock Valuation", desc: "Current inventory valued at today's gold rates", icon: Package, color: "text-blue-600" },
    { id: "metal", title: "Metal Balance", desc: "Fine gold inflow vs outflow by source", icon: Scale, color: "text-amber-600" },
    { id: "movement", title: "Gold Movement", desc: "Gold flow in/out by source type", icon: ArrowRightLeft, color: "text-purple-600" },
    { id: "aging", title: "Inventory Aging", desc: "Items by age bracket with aging alerts", icon: Clock, color: "text-orange-600" },
    { id: "karigar", title: "Karigar Reconciliation", desc: "Gold issued vs returned per artisan", icon: Users, color: "text-indigo-600" },
  ];

  const needsDateRange = ["profit", "metal", "movement"].includes(activeReport || "");

  if (!mounted) return <PageAnimation><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-amber-600" /></div></PageAnimation>;

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.jewelleryReports")}</h1>
          <p className="text-muted-foreground">Business intelligence for your jewellery operations</p>
        </div>

        {/* Report Selector */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Card key={r.id} className={`cursor-pointer transition-all hover:border-primary hover:shadow-sm ${activeReport === r.id ? "border-primary bg-primary/5 shadow-sm" : ""}`} onClick={() => setActiveReport(r.id)}>
              <CardContent className="pt-5 pb-4">
                <r.icon className={`h-6 w-6 ${r.color}`} />
                <h3 className="mt-2 font-semibold text-sm">{r.title}</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Date Range Picker (for time-based reports) */}
        {needsDateRange && (
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 w-40" />
            </div>
          </div>
        )}

        {/* ═══ PROFIT ANALYSIS REPORT ═══ */}
        {activeReport === "profit" && (
          <Card>
            <CardHeader><CardTitle>Profit Analysis</CardTitle><CardDescription>{fromDate} to {toDate}</CardDescription></CardHeader>
            <CardContent>
              {profitLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : profitData?.summary ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="text-xl font-bold">{fmt(profitData.summary.totalRevenue)}</p>
                      <p className="text-[10px] text-muted-foreground">{profitData.summary.invoiceCount} invoices, {profitData.summary.itemCount} items</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Cost of Goods</p>
                      <p className="text-xl font-bold">{fmt(profitData.summary.totalCOGS)}</p>
                      <p className="text-[10px] text-muted-foreground">{profitData.summary.totalFineWeight}g fine gold sold</p>
                    </div>
                    <div className="rounded-lg border p-3 border-green-200 bg-green-50/50">
                      <p className="text-xs text-green-700">Gross Profit</p>
                      <p className="text-xl font-bold text-green-700">{fmt(profitData.summary.totalProfit)}</p>
                      <p className="text-[10px] text-green-600">{profitData.summary.overallMargin}% margin</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Gold Weight Sold</p>
                      <p className="text-xl font-bold">{profitData.summary.totalGrossWeight}g</p>
                      <p className="text-[10px] text-muted-foreground">{profitData.summary.totalFineWeight}g fine</p>
                    </div>
                  </div>

                  {/* Margin Split */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Profit Source Breakdown</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Metal Margin</p>
                        <p className="text-lg font-bold">{fmt(profitData.marginSplit.metalProfit)}</p>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>Rev: {fmt(profitData.marginSplit.metalRevenue)}</span>
                          <span>Cost: {fmt(profitData.marginSplit.metalCOGS)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, profitData.marginSplit.metalMargin))}%` }} />
                        </div>
                        <p className="text-[10px] text-right text-muted-foreground">{profitData.marginSplit.metalMargin}%</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Making Margin</p>
                        <p className="text-lg font-bold">{fmt(profitData.marginSplit.makingProfit)}</p>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                          <span>Rev: {fmt(profitData.marginSplit.makingRevenue)}</span>
                          <span>Cost: {fmt(profitData.marginSplit.makingCOGS)}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, profitData.marginSplit.makingMargin))}%` }} />
                        </div>
                        <p className="text-[10px] text-right text-muted-foreground">{profitData.marginSplit.makingMargin}%</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-muted-foreground">Stone Revenue</p>
                        <p className="text-lg font-bold">{fmt(profitData.marginSplit.stoneRevenue)}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Included in item pricing</p>
                      </div>
                    </div>
                  </div>

                  {/* Per-Invoice Table */}
                  {profitData.invoices?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Invoice Details</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">COGS</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profitData.invoices.map((inv: any) => (
                            <TableRow key={inv.invoiceNumber}>
                              <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                              <TableCell>{new Date(inv.date).toLocaleDateString()}</TableCell>
                              <TableCell>{inv.customerName}</TableCell>
                              <TableCell className="text-right">{inv.itemCount}</TableCell>
                              <TableCell className="text-right">{fmt(inv.revenue)}</TableCell>
                              <TableCell className="text-right">{fmt(inv.cogs)}</TableCell>
                              <TableCell className={`text-right font-medium ${inv.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(inv.profit)}</TableCell>
                              <TableCell className="text-right"><Badge variant={inv.marginPercent >= 10 ? "default" : "outline"}>{inv.marginPercent}%</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No sales data for this period</p>}
            </CardContent>
          </Card>
        )}

        {/* ═══ STOCK VALUATION REPORT ═══ */}
        {activeReport === "stock" && (
          <Card>
            <CardHeader><CardTitle>Stock Valuation Report</CardTitle><CardDescription>Based on {stockData?.rateDate ? `rates from ${new Date(stockData.rateDate).toLocaleDateString()}` : "latest rates"}</CardDescription></CardHeader>
            <CardContent>
              {stockLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : stockData?.groups ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3 mb-6">
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-xl font-bold">{stockData.totals?.totalItems || 0}</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Fine Gold</p><p className="text-xl font-bold">{Number(stockData.totals?.totalFineWeight || 0).toFixed(3)}g</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Market Value</p><p className="text-xl font-bold">{fmt(Number(stockData.totals?.totalMarketValue || 0))}</p></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Purity</TableHead><TableHead>Metal</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Net Wt</TableHead><TableHead className="text-right">Fine Wt</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stockData.groups.map((g: any, i: number) => (
                        <TableRow key={i}><TableCell><Badge variant="outline">{g.purity}</Badge></TableCell><TableCell>{g.metalType}</TableCell><TableCell className="text-right">{g.itemCount}</TableCell><TableCell className="text-right">{Number(g.totalNetWeight).toFixed(3)}</TableCell><TableCell className="text-right">{Number(g.totalFineWeight).toFixed(3)}</TableCell><TableCell className="text-right">{g.rate ? fmt(Number(g.rate)) : "—"}</TableCell><TableCell className="text-right font-medium">{fmt(Number(g.marketValue))}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center py-8 text-muted-foreground">No stock data</p>}
            </CardContent>
          </Card>
        )}

        {/* ═══ METAL BALANCE REPORT ═══ */}
        {activeReport === "metal" && (
          <Card>
            <CardHeader><CardTitle>Metal Balance</CardTitle><CardDescription>Fine gold ledger — {fromDate} to {toDate}</CardDescription></CardHeader>
            <CardContent>
              {metalLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : metalData?.summary ? (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3 border-green-200 bg-green-50/50"><p className="text-xs text-green-700">Total Inflow</p><p className="text-xl font-bold text-green-700">{metalData.summary.totalInflowFineWeight}g</p></div>
                    <div className="rounded-lg border p-3 border-red-200 bg-red-50/50"><p className="text-xs text-red-700">Total Outflow</p><p className="text-xl font-bold text-red-700">{metalData.summary.totalOutflowFineWeight}g</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net Balance</p><p className={`text-xl font-bold ${metalData.summary.netBalanceFineWeight >= 0 ? "text-green-700" : "text-red-700"}`}>{metalData.summary.netBalanceFineWeight}g</p></div>
                  </div>
                  {metalData.sourceBreakdown?.length > 0 && (
                    <Table>
                      <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Direction</TableHead><TableHead className="text-right">Fine Weight (g)</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {metalData.sourceBreakdown.map((s: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{s.sourceType.replace(/_/g, " ")}</TableCell>
                            <TableCell><Badge variant={s.direction === "INFLOW" ? "default" : "destructive"}>{s.direction}</Badge></TableCell>
                            <TableCell className="text-right">{Number(s.fineWeight).toFixed(3)}</TableCell>
                            <TableCell className="text-right">{s.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {metalData.karigarBalances?.length > 0 && (
                    <>
                      <h3 className="text-sm font-semibold">Gold with Karigars</h3>
                      <Table>
                        <TableHeader><TableRow><TableHead>Karigar</TableHead><TableHead className="text-right">Issued (g)</TableHead><TableHead className="text-right">Returned (g)</TableHead><TableHead className="text-right">Balance (g)</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {metalData.karigarBalances.map((k: any) => (
                            <TableRow key={k.karigarId}><TableCell className="font-medium">{k.karigarName}</TableCell><TableCell className="text-right">{k.issuedFineWeight}</TableCell><TableCell className="text-right">{k.returnedFineWeight}</TableCell><TableCell className="text-right font-medium">{k.balanceFineWeight}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No metal ledger data</p>}
            </CardContent>
          </Card>
        )}

        {/* ═══ GOLD MOVEMENT REPORT ═══ */}
        {activeReport === "movement" && (
          <Card>
            <CardHeader><CardTitle>Gold Movement</CardTitle><CardDescription>{fromDate} to {toDate}</CardDescription></CardHeader>
            <CardContent>
              {movementLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : movementData?.summary ? (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3 border-green-200 bg-green-50/50"><p className="text-xs text-green-700">Total Inflow</p><p className="text-xl font-bold text-green-700">{Number(movementData.summary.totalInflow).toFixed(3)}g</p></div>
                    <div className="rounded-lg border p-3 border-red-200 bg-red-50/50"><p className="text-xs text-red-700">Total Outflow</p><p className="text-xl font-bold text-red-700">{Number(movementData.summary.totalOutflow).toFixed(3)}g</p></div>
                    <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Net Movement</p><p className={`text-xl font-bold ${movementData.summary.netMovement >= 0 ? "text-green-700" : "text-red-700"}`}>{Number(movementData.summary.netMovement).toFixed(3)}g</p></div>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-green-700">Inflows</h3>
                      {movementData.inflows?.length > 0 ? (
                        <Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Purity</TableHead><TableHead className="text-right">Fine Wt</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                          <TableBody>{movementData.inflows.map((f: any, i: number) => (<TableRow key={i}><TableCell>{f.source.replace(/_/g, " ")}</TableCell><TableCell><Badge variant="outline">{f.purity}</Badge></TableCell><TableCell className="text-right">{Number(f.fineWeight).toFixed(3)}</TableCell><TableCell className="text-right">{f.count}</TableCell></TableRow>))}</TableBody></Table>
                      ) : <p className="text-xs text-muted-foreground">No inflows</p>}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2 text-red-700">Outflows</h3>
                      {movementData.outflows?.length > 0 ? (
                        <Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Purity</TableHead><TableHead className="text-right">Fine Wt</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
                          <TableBody>{movementData.outflows.map((f: any, i: number) => (<TableRow key={i}><TableCell>{f.source.replace(/_/g, " ")}</TableCell><TableCell><Badge variant="outline">{f.purity}</Badge></TableCell><TableCell className="text-right">{Number(f.fineWeight).toFixed(3)}</TableCell><TableCell className="text-right">{f.count}</TableCell></TableRow>))}</TableBody></Table>
                      ) : <p className="text-xs text-muted-foreground">No outflows</p>}
                    </div>
                  </div>
                </div>
              ) : <p className="text-center py-8 text-muted-foreground">No movement data</p>}
            </CardContent>
          </Card>
        )}

        {/* ═══ INVENTORY AGING REPORT ═══ */}
        {activeReport === "aging" && (
          <Card>
            <CardHeader><CardTitle>Inventory Aging</CardTitle></CardHeader>
            <CardContent>
              {agingLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : agingData?.brackets ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Age Bracket</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Fine Weight</TableHead><TableHead className="text-right">Market Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {agingData.brackets.map((b: any, i: number) => (
                      <TableRow key={i} className={b.maxDays === null ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">{b.label}{b.maxDays === null && <Badge variant="destructive" className="ml-2">Alert</Badge>}</TableCell>
                        <TableCell className="text-right">{b.itemCount}</TableCell>
                        <TableCell className="text-right">{Number(b.totalFineWeight).toFixed(3)}g</TableCell>
                        <TableCell className="text-right">{fmt(Number(b.marketValue))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No aging data</p>}
            </CardContent>
          </Card>
        )}

        {/* ═══ KARIGAR RECONCILIATION REPORT ═══ */}
        {activeReport === "karigar" && (
          <Card>
            <CardHeader><CardTitle>Karigar Reconciliation</CardTitle><CardDescription>All weights in fine gold (24K equivalent)</CardDescription></CardHeader>
            <CardContent>
              {karigarLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : karigarData?.reconciliations?.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Karigar</TableHead><TableHead className="text-right">Issued</TableHead><TableHead className="text-right">Returned</TableHead><TableHead className="text-right">Scrap</TableHead><TableHead className="text-right">Wastage</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Wastage%</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {karigarData.reconciliations.map((k: any) => (
                      <TableRow key={k.karigarId} className={k.wastageExceeded ? "bg-red-50" : ""}>
                        <TableCell><div className="font-medium">{k.karigarName}</div><div className="text-[10px] text-muted-foreground">{k.specialization}</div></TableCell>
                        <TableCell className="text-right">{Number(k.summary.totalIssued).toFixed(3)}g</TableCell>
                        <TableCell className="text-right">{Number(k.summary.totalReturned).toFixed(3)}g</TableCell>
                        <TableCell className="text-right">{Number(k.summary.totalScrap).toFixed(3)}g</TableCell>
                        <TableCell className="text-right">{Number(k.summary.totalWastage).toFixed(3)}g</TableCell>
                        <TableCell className="text-right font-medium">{Number(k.summary.balance).toFixed(3)}g</TableCell>
                        <TableCell className="text-right">{k.wastagePercent}%</TableCell>
                        <TableCell>{k.wastageExceeded ? <Badge variant="destructive">Over</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No karigar data</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </PageAnimation>
  );
}
