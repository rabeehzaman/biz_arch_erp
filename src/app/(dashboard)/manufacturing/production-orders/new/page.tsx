"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface BOM {
  id: string;
  name: string;
  version: number;
  bomType: string;
  product: { id: string; name: string };
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

export default function NewProductionOrderPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [boms, setBoms] = useState<BOM[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [bomId, setBomId] = useState("");
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [plannedDate, setPlannedDate] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [outputWarehouseId, setOutputWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/manufacturing/bom?status=ACTIVE")
      .then((r) => r.json())
      .then((data) => setBoms(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => setWarehouses(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const selectedBom = boms.find((b) => b.id === bomId);

  async function handleSubmit() {
    if (!bomId || plannedQuantity <= 0) {
      toast.error(t("manufacturing.selectBomAndQuantity"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manufacturing/production-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bomId,
          plannedQuantity,
          plannedDate: plannedDate || null,
          sourceWarehouseId: sourceWarehouseId || null,
          outputWarehouseId: outputWarehouseId || null,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        const order = await res.json();
        toast.success(t("manufacturing.orderCreated"));
        router.push(`/manufacturing/production-orders/${order.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create production order");
      }
    } catch {
      toast.error(t("manufacturing.failedToCreateOrder"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/manufacturing/production-orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{t("manufacturing.newProductionOrder")}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("manufacturing.selectBOM")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("manufacturing.bom")}</Label>
            <Select value={bomId} onValueChange={setBomId}>
              <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
              <SelectContent>
                {boms.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} v{b.version} — {b.product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBom && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("manufacturing.outputProduct")}: {selectedBom.product.name} ({selectedBom.bomType})
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t("manufacturing.plannedQuantity")}</Label>
              <Input type="number" min="0.0001" step="any" value={plannedQuantity} onChange={(e) => setPlannedQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t("common.date")}</Label>
              <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
            </div>
          </div>

          {warehouses.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>{t("manufacturing.sourceWarehouse")}</Label>
                <Select value={sourceWarehouseId} onValueChange={setSourceWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("manufacturing.outputWarehouse")}</Label>
                <Select value={outputWarehouseId} onValueChange={setOutputWarehouseId}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/manufacturing/production-orders">
          <Button variant="outline">{t("common.cancel")}</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? t("common.saving") + "..." : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
