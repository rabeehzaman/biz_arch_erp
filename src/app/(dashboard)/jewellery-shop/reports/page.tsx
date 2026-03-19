"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Package, Users, Clock } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function JewelleryReportsPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const [activeReport, setActiveReport] = useState<string | null>(null);

  const { data: stockData, isLoading: stockLoading } = useSWR(
    activeReport === "stock" ? "/api/jewellery/reports/stock-valuation" : null, fetcher
  );
  const { data: agingData, isLoading: agingLoading } = useSWR(
    activeReport === "aging" ? "/api/jewellery/reports/inventory-aging" : null, fetcher
  );
  const { data: karigarData, isLoading: karigarLoading } = useSWR(
    activeReport === "karigar" ? "/api/jewellery/reports/karigar-reconciliation" : null, fetcher
  );

  const reports = [
    { id: "stock", title: "Stock Valuation", desc: "Current inventory valued at today's gold rates", icon: Package },
    { id: "aging", title: "Inventory Aging", desc: "Items by age bracket with aging alerts", icon: Clock },
    { id: "karigar", title: "Karigar Reconciliation", desc: "Gold issued vs returned per artisan", icon: Users },
  ];

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.jewelleryReports")}</h1>
          <p className="text-muted-foreground">Business intelligence for your jewellery operations</p>
        </div>

        {/* Report Selector */}
        <div className="grid gap-4 sm:grid-cols-3">
          {reports.map((r) => (
            <Card key={r.id} className={`cursor-pointer transition-colors hover:border-primary ${activeReport === r.id ? "border-primary bg-primary/5" : ""}`} onClick={() => setActiveReport(r.id)}>
              <CardContent className="pt-6">
                <r.icon className="h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">{r.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Stock Valuation Report */}
        {activeReport === "stock" && (
          <Card>
            <CardHeader><CardTitle>Stock Valuation Report</CardTitle><CardDescription>Based on {stockData?.rateDate ? `rates from ${new Date(stockData.rateDate).toLocaleDateString()}` : "latest rates"}</CardDescription></CardHeader>
            <CardContent>
              {stockLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : stockData?.groups ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3 mb-6">
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total Items</p><p className="text-2xl font-bold">{stockData.totals?.totalItems || 0}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total Fine Gold (g)</p><p className="text-2xl font-bold">{Number(stockData.totals?.totalFineWeight || 0).toFixed(3)}</p></div>
                    <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total Market Value</p><p className="text-2xl font-bold">{fmt(Number(stockData.totals?.totalMarketValue || 0))}</p></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Purity</TableHead><TableHead>Metal</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Net Weight</TableHead><TableHead className="text-right">Fine Weight</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Market Value</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {stockData.groups.map((g: any, i: number) => (
                        <TableRow key={i}><TableCell><Badge variant="outline">{g.purity}</Badge></TableCell><TableCell>{g.metalType}</TableCell><TableCell className="text-right">{g.itemCount}</TableCell><TableCell className="text-right">{Number(g.totalNetWeight).toFixed(3)}</TableCell><TableCell className="text-right">{Number(g.totalFineWeight).toFixed(3)}</TableCell><TableCell className="text-right">{g.rate ? fmt(Number(g.rate)) : "—"}</TableCell><TableCell className="text-right font-medium">{fmt(Number(g.marketValue))}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center py-8 text-muted-foreground">No data available</p>}
            </CardContent>
          </Card>
        )}

        {/* Inventory Aging Report */}
        {activeReport === "aging" && (
          <Card>
            <CardHeader><CardTitle>Inventory Aging Report</CardTitle></CardHeader>
            <CardContent>
              {agingLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : agingData?.brackets ? (
                <>
                  <Table>
                    <TableHeader><TableRow><TableHead>Age Bracket</TableHead><TableHead className="text-right">Items</TableHead><TableHead className="text-right">Fine Weight (g)</TableHead><TableHead className="text-right">Est. Market Value</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {agingData.brackets.map((b: any, i: number) => (
                        <TableRow key={i} className={b.maxDays === null ? "bg-red-50" : ""}>
                          <TableCell className="font-medium">{b.label}{b.maxDays === null && <Badge variant="destructive" className="ml-2">Alert</Badge>}</TableCell>
                          <TableCell className="text-right">{b.itemCount}</TableCell>
                          <TableCell className="text-right">{Number(b.totalFineWeight).toFixed(3)}</TableCell>
                          <TableCell className="text-right">{fmt(Number(b.marketValue))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : <p className="text-center py-8 text-muted-foreground">No data available</p>}
            </CardContent>
          </Card>
        )}

        {/* Karigar Reconciliation Report */}
        {activeReport === "karigar" && (
          <Card>
            <CardHeader><CardTitle>Karigar Reconciliation</CardTitle><CardDescription>All weights in fine gold (24K equivalent)</CardDescription></CardHeader>
            <CardContent>
              {karigarLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : Array.isArray(karigarData) && karigarData.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Karigar</TableHead><TableHead className="text-right">Issued (g)</TableHead><TableHead className="text-right">Returned (g)</TableHead><TableHead className="text-right">Scrap (g)</TableHead><TableHead className="text-right">Wastage (g)</TableHead><TableHead className="text-right">Balance (g)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {karigarData.map((k: any) => (
                      <TableRow key={k.karigarId} className={k.wastageExceeded ? "bg-red-50" : ""}>
                        <TableCell className="font-medium">{k.karigarName}</TableCell>
                        <TableCell className="text-right">{Number(k.totalIssued).toFixed(3)}</TableCell>
                        <TableCell className="text-right">{Number(k.totalReturned).toFixed(3)}</TableCell>
                        <TableCell className="text-right">{Number(k.totalScrap).toFixed(3)}</TableCell>
                        <TableCell className="text-right">{Number(k.totalWastage).toFixed(3)}</TableCell>
                        <TableCell className="text-right font-medium">{Number(k.balance).toFixed(3)}</TableCell>
                        <TableCell>{k.wastageExceeded ? <Badge variant="destructive">Over Limit</Badge> : <Badge variant="outline">OK</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-center py-8 text-muted-foreground">No karigar data available</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </PageAnimation>
  );
}
