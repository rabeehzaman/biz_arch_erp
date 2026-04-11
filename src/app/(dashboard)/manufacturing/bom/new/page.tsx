"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
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
  quantityType: "ABSOLUTE" | "PERCENTAGE";
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
    { productId: "", quantity: 1, quantityType: "ABSOLUTE" as const, wastagePercent: 0, issueMethod: "BACKFLUSH" as const, isPhantom: false },
  ]);

  useEffect(() => {
    fetch("/api/products?limit=1000")
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
  }, []);

  // Auto-set autoConsumeOnSale when bomType is RECIPE
  useEffect(() => {
    if (bomType === "RECIPE") setAutoConsumeOnSale(true);
    else if (bomType === "MANUFACTURING") setAutoConsumeOnSale(false);
  }, [bomType]);

  function addItem() {
    setItems([...items, { productId: "", quantity: 1, quantityType: "ABSOLUTE" as const, wastagePercent: 0, issueMethod: "BACKFLUSH" as const, isPhantom: false }]);
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
      toast.error(t("manufacturing.fillAllRequired"));
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
      toast.error(t("manufacturing.failedToCreateBom"));
    } finally {
      setSubmitting(false);
    }
  }

  // Searchable product filter function
  const productFilterFn = (product: Product, query: string) => {
    const q = query.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.sku?.toLowerCase().includes(q) ?? false)
    );
  };

  return (
    <div className="space-y-6">
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
              <Combobox
                items={products}
                value={productId}
                onValueChange={setProductId}
                getId={(p) => p.id}
                getLabel={(p) => p.name}
                filterFn={productFilterFn}
                renderItem={(p) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{p.name}</span>
                    {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                  </div>
                )}
                placeholder={t("common.search") + "..."}
                emptyText={t("manufacturing.noBOMFound")}
              />
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
                <div className="min-w-0 flex-1">
                  <Label>{t("common.product")}</Label>
                  <Combobox
                    items={products.filter((p) => p.id !== productId)}
                    value={item.productId}
                    onValueChange={(v) => updateItem(index, "productId", v)}
                    getId={(p) => p.id}
                    getLabel={(p) => p.name}
                    filterFn={productFilterFn}
                    renderItem={(p) => (
                      <div className="flex flex-col">
                        <span className="font-medium">{p.name}</span>
                        {p.sku && <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>}
                      </div>
                    )}
                    placeholder={t("common.search") + "..."}
                    emptyText={t("manufacturing.noBOMFound")}
                  />
                </div>
                <div className="w-32">
                  <Label>{item.quantityType === "PERCENTAGE" ? "%" : t("common.quantity")}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0.0001"
                      max={item.quantityType === "PERCENTAGE" ? 100 : undefined}
                      step="any"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={item.quantityType === "PERCENTAGE" ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-9 shrink-0 px-0 text-xs font-bold"
                      onClick={() => updateItem(index, "quantityType", item.quantityType === "PERCENTAGE" ? "ABSOLUTE" : "PERCENTAGE")}
                      title={item.quantityType === "PERCENTAGE" ? "Switch to absolute quantity" : "Switch to percentage of output"}
                    >
                      %
                    </Button>
                  </div>
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
