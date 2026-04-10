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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Product {
  id: string;
  name: string;
  sku: string | null;
}

interface BOMItemRow {
  productId: string;
  quantity: number;
  wastagePercent: number;
  issueMethod: "BACKFLUSH" | "MANUAL";
  isPhantom: boolean;
}

export default function NewBOMPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [bomType, setBomType] = useState<"MANUFACTURING" | "RECIPE" | "KIT">("MANUFACTURING");
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [autoConsumeOnSale, setAutoConsumeOnSale] = useState(false);
  const [consumptionPolicy, setConsumptionPolicy] = useState<"ALLOW_NEGATIVE" | "WARN" | "BLOCK">("WARN");
  const [processLossPercent, setProcessLossPercent] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<BOMItemRow[]>([
    { productId: "", quantity: 1, wastagePercent: 0, issueMethod: "BACKFLUSH", isPhantom: false },
  ]);

  useEffect(() => {
    fetch("/api/products?limit=1000")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : data.products || []))
      .catch(() => {});
  }, []);

  // Auto-set autoConsumeOnSale when bomType is RECIPE
  useEffect(() => {
    if (bomType === "RECIPE") setAutoConsumeOnSale(true);
    else if (bomType === "MANUFACTURING") setAutoConsumeOnSale(false);
  }, [bomType]);

  function addItem() {
    setItems([...items, { productId: "", quantity: 1, wastagePercent: 0, issueMethod: "BACKFLUSH", isPhantom: false }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof BOMItemRow, value: unknown) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  }

  async function handleSubmit() {
    if (!name || !productId || items.some((i) => !i.productId)) {
      toast.error("Fill all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manufacturing/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          productId,
          bomType,
          outputQuantity,
          autoConsumeOnSale,
          consumptionPolicy,
          processLossPercent,
          notes: notes || null,
          items: items.map((item, index) => ({
            ...item,
            sortOrder: index,
          })),
        }),
      });

      if (res.ok) {
        const bom = await res.json();
        toast.success(t("manufacturing.bomCreated"));
        router.push(`/manufacturing/bom/${bom.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create BOM");
      }
    } catch {
      toast.error("Failed to create BOM");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Link href="/manufacturing/bom">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">{t("manufacturing.newBOM")}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>{t("manufacturing.outputProduct")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t("manufacturing.bomName")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Recipe v1" />
            </div>
            <div>
              <Label>{t("manufacturing.outputProduct")}</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("manufacturing.bomType")}</Label>
              <Select value={bomType} onValueChange={(v) => setBomType(v as typeof bomType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUFACTURING">{t("manufacturing.manufacturing")}</SelectItem>
                  <SelectItem value="RECIPE">{t("manufacturing.recipe")}</SelectItem>
                  <SelectItem value="KIT">{t("manufacturing.kit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("manufacturing.outputQuantity")}</Label>
              <Input type="number" min="0.0001" step="any" value={outputQuantity} onChange={(e) => setOutputQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t("manufacturing.consumptionPolicy")}</Label>
              <Select value={consumptionPolicy} onValueChange={(v) => setConsumptionPolicy(v as typeof consumptionPolicy)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WARN">{t("manufacturing.warn")}</SelectItem>
                  <SelectItem value="ALLOW_NEGATIVE">{t("manufacturing.allowNegative")}</SelectItem>
                  <SelectItem value="BLOCK">{t("manufacturing.block")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("manufacturing.processLossPercent")}</Label>
              <Input type="number" min="0" max="100" step="0.01" value={processLossPercent} onChange={(e) => setProcessLossPercent(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={autoConsumeOnSale} onCheckedChange={setAutoConsumeOnSale} />
            <Label>{t("manufacturing.autoConsumeOnSale")}</Label>
          </div>
          <div>
            <Label>{t("common.notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("manufacturing.components")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" /> {t("manufacturing.addComponent")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-end gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <Label>{t("common.product")}</Label>
                  <Select value={item.productId} onValueChange={(v) => updateItem(index, "productId", v)}>
                    <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((p) => p.id !== productId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>{t("common.quantity")}</Label>
                  <Input type="number" min="0.0001" step="any" value={item.quantity} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} />
                </div>
                <div className="w-20">
                  <Label>{t("manufacturing.wastagePercent")}</Label>
                  <Input type="number" min="0" max="100" step="0.01" value={item.wastagePercent} onChange={(e) => updateItem(index, "wastagePercent", Number(e.target.value))} />
                </div>
                <div className="w-28">
                  <Label>{t("manufacturing.issueMethod")}</Label>
                  <Select value={item.issueMethod} onValueChange={(v) => updateItem(index, "issueMethod", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BACKFLUSH">{t("manufacturing.backflush")}</SelectItem>
                      <SelectItem value="MANUAL">{t("manufacturing.manual")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/manufacturing/bom">
          <Button variant="outline">{t("common.cancel")}</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? t("common.saving") + "..." : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
