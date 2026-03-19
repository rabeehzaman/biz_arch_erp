"use client";

import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Package, Scale, Wrench, CreditCard, AlertTriangle, Gem } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function JewelleryDashboardPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();

  const { data: todayRates } = useSWR("/api/jewellery/gold-rates/today", fetcher);
  const { data: stockData } = useSWR("/api/jewellery/reports/stock-valuation", fetcher);
  const { data: agingData } = useSWR("/api/jewellery/reports/inventory-aging", fetcher);
  const { data: repairs } = useSWR("/api/jewellery/repairs?status=RECEIVED", fetcher);
  const { data: schemes } = useSWR("/api/jewellery/schemes?status=ACTIVE", fetcher);

  const rates = Array.isArray(todayRates) ? todayRates : [];
  const rate22K = rates.find((r: any) => r.purity === "K22");
  const rate24K = rates.find((r: any) => r.purity === "K24");

  const totalItems = stockData?.totals?.totalItems || 0;
  const totalFineWeight = Number(stockData?.totals?.totalFineWeight || 0);
  const totalMarketValue = Number(stockData?.totals?.totalMarketValue || 0);
  const pendingRepairs = Array.isArray(repairs) ? repairs.length : 0;
  const activeSchemes = Array.isArray(schemes) ? schemes.length : 0;
  const agingAlertCount = agingData?.agingItems?.length || 0;

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Gem className="h-7 w-7 text-amber-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.jewelleryDashboard")}</h1>
            <p className="text-muted-foreground">Overview of your jewellery business</p>
          </div>
        </div>

        {/* Today's Gold Rate Card */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">24K Gold Rate</p>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-900">
                {rate24K ? fmt(Number(rate24K.sellRate)) : "—"}
              </p>
              <p className="text-xs text-amber-600 mt-1">per gram (sell)</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-amber-800">22K Gold Rate</p>
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-900">
                {rate22K ? fmt(Number(rate22K.sellRate)) : "—"}
              </p>
              <p className="text-xs text-amber-600 mt-1">per gram (sell)</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Stock Items</p>
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground mt-1">{totalFineWeight.toFixed(1)}g fine gold</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-3xl font-bold">{fmt(totalMarketValue)}</p>
              <p className="text-xs text-muted-foreground mt-1">at today&apos;s rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/jewellery-shop/repairs">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Repairs</p>
                    <p className="mt-1 text-2xl font-bold">{pendingRepairs}</p>
                  </div>
                  <Wrench className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/jewellery-shop/schemes">
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Schemes</p>
                    <p className="mt-1 text-2xl font-bold">{activeSchemes}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/jewellery-shop/reports">
            <Card className={`cursor-pointer hover:border-primary transition-colors ${agingAlertCount > 0 ? "border-orange-200" : ""}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Aging Alerts</p>
                    <p className="mt-1 text-2xl font-bold">{agingAlertCount}</p>
                  </div>
                  <AlertTriangle className={`h-8 w-8 ${agingAlertCount > 0 ? "text-orange-400" : "text-muted-foreground/40"}`} />
                </div>
                {agingAlertCount > 0 && (
                  <p className="mt-2 text-xs text-orange-600">Items older than threshold</p>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Today's Rates Grid */}
        {rates.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Today&apos;s Rates — All Purities</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {rates.map((rate: any) => (
                  <div key={rate.id} className="rounded-lg border p-3 text-center">
                    <Badge variant="outline" className="font-semibold">{rate.purity}</Badge>
                    <p className="mt-2 text-lg font-bold">{fmt(Number(rate.sellRate))}</p>
                    <p className="text-xs text-muted-foreground">Buy: {fmt(Number(rate.buyRate))}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageAnimation>
  );
}
