"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const PURITY_LABELS: Record<string, string> = {
  K24: "24K (999)", K22: "22K (916)", K21: "21K (875)",
  K18: "18K (750)", K14: "14K (583)", K9: "9K (375)",
};

export default function GoldRatesPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const { data: todayRates, mutate: mutateTodayRates } = useSWR("/api/jewellery/gold-rates/today", fetcher);
  const { data: rateHistory, mutate: mutateHistory } = useSWR("/api/jewellery/gold-rates?limit=50", fetcher);

  const [sellRate, setSellRate] = useState("");
  const [purity, setPurity] = useState("K24");
  const [saving, setSaving] = useState(false);

  const handleSetRate = useCallback(async () => {
    if (!sellRate || Number(sellRate) <= 0) {
      toast.error("Please enter a valid sell rate");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jewellery/gold-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          metalType: "GOLD",
          purity,
          sellRate: Number(sellRate),
        }),
      });
      if (res.ok) {
        toast.success("Gold rate updated");
        setSellRate("");
        mutateTodayRates();
        mutateHistory();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to set rate");
      }
    } catch {
      toast.error("Failed to set rate");
    } finally {
      setSaving(false);
    }
  }, [sellRate, purity, mutateTodayRates, mutateHistory]);

  const rates = Array.isArray(todayRates) ? todayRates : [];
  const history = Array.isArray(rateHistory) ? rateHistory : rateHistory?.rates || [];

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.goldRates")}</h1>
            <p className="text-muted-foreground">Set daily gold rates and view history</p>
          </div>
        </div>

        {/* Today's Rates Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rates.length > 0 ? rates.map((rate: { id: string; purity: string; sellRate: number; buyRate: number }) => (
            <Card key={rate.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-sm font-semibold">
                    {PURITY_LABELS[rate.purity] || rate.purity}
                  </Badge>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold">{fmt(Number(rate.sellRate))}</p>
                  <p className="text-xs text-muted-foreground">Sell /g</p>
                </div>
                <div className="mt-1">
                  <p className="text-sm text-muted-foreground">{fmt(Number(rate.buyRate))} Buy /g</p>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card className="col-span-full">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No rates set for today. Enter the 24K rate below to get started.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Set Rate Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Set Today&apos;s Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-40">
                <Label>Purity</Label>
                <Select value={purity} onValueChange={setPurity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1 max-w-xs">
                <Label>Sell Rate (per gram)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellRate}
                  onChange={(e) => setSellRate(e.target.value)}
                  placeholder="Enter sell rate per gram"
                />
              </div>
              <Button onClick={handleSetRate} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Rate
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              If you set the 24K rate, other purity rates are auto-derived. Buy rate is auto-calculated from spread.
            </p>
          </CardContent>
        </Card>

        {/* Rate History */}
        <Card>
          <CardHeader>
            <CardTitle>Rate History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Purity</TableHead>
                      <TableHead>Metal</TableHead>
                      <TableHead className="text-right">Sell Rate</TableHead>
                      <TableHead className="text-right">Buy Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((rate: { id: string; date: string; purity: string; metalType: string; sellRate: number; buyRate: number }) => (
                      <TableRow key={rate.id}>
                        <TableCell>{new Date(rate.date).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant="outline">{rate.purity}</Badge></TableCell>
                        <TableCell>{rate.metalType}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(rate.sellRate))}</TableCell>
                        <TableCell className="text-right">{fmt(Number(rate.buyRate))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No rate history yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
