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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ArrowRightLeft } from "lucide-react";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

const fetcher = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

export default function OldGoldPage() {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const { data, mutate, isLoading } = useSWR("/api/jewellery/old-gold", fetcher);
  const purchases = Array.isArray(data) ? data : [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: "", weight: "", testedPurity: "K22", purityPercentage: "91.67",
    reading1: "", reading2: "", reading3: "",
    testMethod: "XRF", meltingLossPercent: "2", rate: "", panNumber: "", notes: "",
  });

  const calcTotal = () => {
    const w = Number(form.weight) || 0;
    const pp = Number(form.purityPercentage) || 0;
    const r = Number(form.rate) || 0;
    const ml = Number(form.meltingLossPercent) || 0;
    return (w * (pp / 100) * r * (1 - ml / 100)).toFixed(2);
  };

  const handleAvgReadings = () => {
    if (form.reading1 === "" || form.reading2 === "" || form.reading3 === "") return;
    const r1 = Number(form.reading1), r2 = Number(form.reading2), r3 = Number(form.reading3);
    if (!isNaN(r1) && !isNaN(r2) && !isNaN(r3)) {
      setForm({ ...form, purityPercentage: ((r1 + r2 + r3) / 3).toFixed(2) });
    }
  };

  const handleCreate = useCallback(async () => {
    if (!form.weight || !form.rate) { toast.error(t("jewellery.weightAndRateRequired")); return; }
    setSaving(true);
    try {
      const testReadings = [form.reading1, form.reading2, form.reading3]
        .filter(v => v !== "")
        .map(Number);
      const res = await fetch("/api/jewellery/old-gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName || null,
          weight: Number(form.weight),
          testedPurity: form.testedPurity,
          purityPercentage: Number(form.purityPercentage),
          testReadings: testReadings.length === 3 ? testReadings : null,
          testMethod: form.testMethod,
          meltingLossPercent: Number(form.meltingLossPercent),
          rate: Number(form.rate),
          panNumber: form.panNumber || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        toast.success(t("jewellery.oldGoldRecorded"));
        setDialogOpen(false);
        setForm({ customerName: "", weight: "", testedPurity: "K22", purityPercentage: "91.67", reading1: "", reading2: "", reading3: "", testMethod: "XRF", meltingLossPercent: "2", rate: "", panNumber: "", notes: "" });
        mutate();
      } else {
        const d = await res.json();
        toast.error(d.error || t("jewellery.failedToRecordPurchase"));
      }
    } catch { toast.error(t("jewellery.failedToRecordPurchase")); }
    finally { setSaving(false); }
  }, [form, mutate]);

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.oldGoldExchange")}</h1>
            <p className="text-muted-foreground">{t("jewellery.oldGoldPurchase")}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> {t("jewellery.recordPurchase")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("jewellery.oldGoldPurchase")}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>{t("jewellery.customerNameWalkIn")}</Label>
                  <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder={t("jewellery.customerName")} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("jewellery.weightGrams")} *</Label>
                    <Input type="number" step="0.001" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jewellery.testedPurity")}</Label>
                    <Select value={form.testedPurity} onValueChange={(v) => setForm({ ...form, testedPurity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="K24">24K</SelectItem>
                        <SelectItem value="K22">22K</SelectItem>
                        <SelectItem value="K21">21K</SelectItem>
                        <SelectItem value="K18">18K</SelectItem>
                        <SelectItem value="K14">14K</SelectItem>
                        <SelectItem value="K9">9K</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jewellery.testMethod")}</Label>
                    <Select value={form.testMethod} onValueChange={(v) => setForm({ ...form, testMethod: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XRF">XRF</SelectItem>
                        <SelectItem value="FIRE_ASSAY">Fire Assay</SelectItem>
                        <SelectItem value="TOUCHSTONE">Touchstone</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("jewellery.purityReadings")}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    <Input type="number" step="0.001" placeholder={`${t("jewellery.reading")} 1`} value={form.reading1} onChange={(e) => setForm({ ...form, reading1: e.target.value })} />
                    <Input type="number" step="0.001" placeholder={`${t("jewellery.reading")} 2`} value={form.reading2} onChange={(e) => setForm({ ...form, reading2: e.target.value })} />
                    <Input type="number" step="0.001" placeholder={`${t("jewellery.reading")} 3`} value={form.reading3} onChange={(e) => setForm({ ...form, reading3: e.target.value })} />
                    <Button variant="outline" type="button" onClick={handleAvgReadings}>{t("jewellery.avg")}</Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("jewellery.purityAverage")}</Label>
                    <Input type="number" step="0.001" value={form.purityPercentage} onChange={(e) => setForm({ ...form, purityPercentage: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jewellery.meltingLoss")}</Label>
                    <Input type="number" step="0.001" value={form.meltingLossPercent} onChange={(e) => setForm({ ...form, meltingLossPercent: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("jewellery.ratePerGram")} *</Label>
                    <Input type="number" step="0.001" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                  </div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">{t("jewellery.totalValue")}: <span className="text-lg">{fmt(Number(calcTotal()))}</span></p>
                </div>
                <div className="space-y-2">
                  <Label>{t("jewellery.panNumber")}</Label>
                  <Input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} />
                </div>
                <div className="space-y-2">
                  <Label>{t("common.notes")}</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={handleCreate} disabled={saving} className="w-full">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("jewellery.recordPurchase")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : purchases.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.date")}</TableHead>
                      <TableHead>{t("jewellery.customerName")}</TableHead>
                      <TableHead className="text-right">{t("jewellery.weightGrams")}</TableHead>
                      <TableHead>{t("jewellery.purity")}</TableHead>
                      <TableHead className="text-right">{t("common.rate")}</TableHead>
                      <TableHead className="text-right">{t("jewellery.totalValue")}</TableHead>
                      <TableHead>{t("jewellery.pan")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>{p.customer?.name || p.customerName || "Walk-in"}</TableCell>
                        <TableCell className="text-right">{Number(p.weight).toFixed(3)}</TableCell>
                        <TableCell><Badge variant="outline">{p.testedPurity}</Badge></TableCell>
                        <TableCell className="text-right">{fmt(Number(p.rate))}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(p.totalValue))}</TableCell>
                        <TableCell className="font-mono text-xs">{p.panNumber || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowRightLeft className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">{t("jewellery.noOldGoldPurchases")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageAnimation>
  );
}
