"use client";

import { use, useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, ArrowLeft, Save, TrendingUp, TrendingDown, Package, AlertTriangle, Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { ProductCombobox } from "@/components/invoices/product-combobox";

interface CountItem {
  id: string;
  productId: string;
  productName: string;
  sku: string | null;
  unitCode: string | null;
  systemQuantity: number;
  physicalQuantity: string;
  reason: string;
}

function makeEmptyItem(): CountItem {
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    productId: "",
    productName: "",
    sku: null,
    unitCode: null,
    systemQuantity: 0,
    physicalQuantity: "",
    reason: "",
  };
}

export default function EditStockTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { locale } = useCurrency();
  const { t } = useLanguage();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();

  const [products, setProducts] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const [adjustmentNumber, setAdjustmentNumber] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "RECONCILED">("DRAFT");
  const [countDate, setCountDate] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");

  const [countItems, setCountItems] = useState<CountItem[]>([makeEmptyItem()]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  const multiBranchEnabled = session?.user?.multiBranchEnabled;

  // Refs for focus management
  const physicalQtyRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    // Fetch warehouses for the selector
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const active = data.filter((w: any) => w.isActive);
          setWarehouses(active);
        }
      });
  }, []);

  // Fetch existing stock take data
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/inventory-adjustments/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        setAdjustmentNumber(data.adjustmentNumber);
        setStatus(data.status);
        setCountDate(data.adjustmentDate ? data.adjustmentDate.split("T")[0] : "");
        setWarehouseId(data.warehouseId || "");
        setNotes(data.notes || "");

        const mappedItems: CountItem[] = data.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku || null,
          unitCode: item.product.unit?.code || null,
          systemQuantity: Number(item.systemQuantity),
          physicalQuantity: String(Number(item.physicalQuantity)),
          reason: item.reason || "",
        }));

        setCountItems(mappedItems.length > 0 ? mappedItems : [makeEmptyItem()]);
      })
      .catch(() => {
        toast.error(t("inventory.failedToCreateStockTake"));
        router.push("/inventory/adjustments");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, router, t]);

  // Fetch products with stock when warehouse changes (only after data loaded)
  useEffect(() => {
    if (!warehouseId) {
      setProducts([]);
      return;
    }
    fetch(`/api/products/stock?warehouseId=${warehouseId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setProducts(data); });
  }, [warehouseId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        addEmptyItem(true);
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getSystemQuantity = useCallback((product: any): number => {
    return (
      product.stockLots?.reduce(
        (sum: number, lot: any) => sum + Number(lot.remainingQuantity),
        0
      ) || 0
    );
  }, []);

  const usedProductIds = useMemo(
    () => new Set(countItems.filter(i => i.productId).map((item) => item.productId)),
    [countItems]
  );

  const availableProducts = useMemo(
    () => products.filter((p: any) => !p.isService),
    [products]
  );

  // Map products for ProductCombobox interface
  const comboboxProducts = useMemo(
    () => availableProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price) || 0,
      sku: p.sku || undefined,
      barcode: p.barcode || undefined,
      isService: p.isService || false,
      availableStock: getSystemQuantity(p),
      unitId: p.unitId || null,
      unit: p.unit || null,
    })),
    [availableProducts, getSystemQuantity]
  );

  const focusPhysicalQty = useCallback((itemId: string) => {
    const input = physicalQtyRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const addEmptyItem = useCallback((focusNewProduct: boolean = false) => {
    const newItem = makeEmptyItem();
    setCountItems((prev) => [...prev, newItem]);
    if (focusNewProduct) {
      setTimeout(() => {
        const trigger = productComboRefs.current.get(newItem.id);
        if (trigger) trigger.focus();
      }, 50);
    }
  }, []);

  const addAllProducts = useCallback(() => {
    const newItems: CountItem[] = [];
    for (const product of availableProducts) {
      if (usedProductIds.has(product.id)) continue;
      const systemQty = getSystemQuantity(product);
      newItems.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2) + product.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku || null,
        unitCode: product.unitCode || null,
        systemQuantity: systemQty,
        physicalQuantity: "",
        reason: "",
      });
    }
    if (newItems.length > 0) {
      // Remove any empty rows first, then add all products
      setCountItems((prev) => [
        ...prev.filter(i => i.productId),
        ...newItems,
      ]);
      setIsDirty(true);
    }
  }, [availableProducts, usedProductIds, getSystemQuantity]);

  const removeItem = (id: string) => {
    if (countItems.length === 1) return;
    setCountItems((prev) => prev.filter((item) => item.id !== id));
    setIsDirty(true);
  };

  const updateItemProduct = useCallback((itemId: string, productId: string) => {
    setIsDirty(true);
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const itemIndex = countItems.findIndex((item) => item.id === itemId);
    const isLastItem = itemIndex === countItems.length - 1;

    setCountItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId: product.id,
              productName: product.name,
              sku: product.sku || null,
              unitCode: product.unitCode || null,
              systemQuantity: getSystemQuantity(product),
            }
          : item
      )
    );

    // Auto-add new row if selecting product on last item
    if (isLastItem) {
      setTimeout(() => {
        setCountItems((prev) => [...prev, makeEmptyItem()]);
      }, 0);
    }
  }, [products, countItems, getSystemQuantity]);

  const updateItem = (
    id: string,
    field: "physicalQuantity" | "reason",
    value: string
  ) => {
    setIsDirty(true);
    setCountItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const getDifference = (item: CountItem): number | null => {
    const physical = parseFloat(item.physicalQuantity);
    if (isNaN(physical)) return null;
    return physical - item.systemQuantity;
  };

  const validItems = countItems.filter(
    (item) => item.productId && item.physicalQuantity !== ""
  );

  const summary = useMemo(() => {
    let surplusCount = 0;
    let shortageCount = 0;
    let noChangeCount = 0;

    for (const item of validItems) {
      const diff = getDifference(item);
      if (diff === null) continue;
      if (diff > 0) surplusCount++;
      else if (diff < 0) shortageCount++;
      else noChangeCount++;
    }

    return { surplusCount, shortageCount, noChangeCount, totalCounted: validItems.length };
  }, [validItems]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validItems.length === 0) {
      toast.error(t("inventory.addAtLeastOneProduct"));
      return;
    }

    if (!countDate) {
      toast.error(t("inventory.countDate"));
      return;
    }

    if (!warehouseId) {
      toast.error(t("purchases.selectBranchWarehouse"));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/inventory-adjustments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustmentDate: countDate,
          warehouseId: warehouseId || undefined,
          notes: notes || undefined,
          items: validItems.map((item) => ({
            productId: item.productId,
            physicalQuantity: parseFloat(item.physicalQuantity),
            reason: item.reason || undefined,
          })),
        }),
      });

      if (res.ok) {
        setIsDirty(false);
        toast.success(t("inventory.stockTakeUpdated"));
        router.push(`/inventory/adjustments/${id}`);
      } else {
        const err = await res.json();
        toast.error(err.error || t("inventory.failedToCreateStockTake"));
      }
    } catch {
      toast.error(t("inventory.failedToCreateStockTake"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDifference = (item: CountItem) => {
    const diff = getDifference(item);
    if (diff === null) return <span className="text-slate-400">-</span>;
    if (diff === 0) {
      return <span className="text-slate-500">{t("inventory.noChange")}</span>;
    }
    if (diff > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-green-700 font-medium">
          <TrendingUp className="h-3.5 w-3.5" />+{diff.toLocaleString(locale)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-red-700 font-medium">
        <TrendingDown className="h-3.5 w-3.5" />{diff.toLocaleString(locale)}
      </span>
    );
  };

  const renderDifferenceBadge = (item: CountItem) => {
    const diff = getDifference(item);
    if (diff === null) return null;
    if (diff === 0) return <Badge variant="secondary">{t("inventory.noChange")}</Badge>;
    if (diff > 0) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <TrendingUp className="mr-1 h-3 w-3" />+{diff.toLocaleString(locale)} {t("inventory.surplus")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <TrendingDown className="mr-1 h-3 w-3" />{diff.toLocaleString(locale)} {t("inventory.shortage")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <PageAnimation>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </PageAnimation>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href={`/inventory/adjustments/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-baseline flex-wrap gap-x-2">
              {t("inventory.editStockTake")}
              {adjustmentNumber && (
                <span className="ml-2 text-lg font-normal text-slate-500">#{adjustmentNumber}</span>
              )}
            </h2>
            <p className="text-slate-500">{t("inventory.stockTake")}</p>
          </div>
        </div>

        {/* Reconciled Warning Banner */}
        {status === "RECONCILED" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              This stock take has been reconciled. Saving changes will recalculate all stock adjustments.
            </p>
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Count Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory.countDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                {multiBranchEnabled ? (
                  <BranchWarehouseSelector
                    branchId={branchId}
                    warehouseId={warehouseId}
                    onBranchChange={(id) => setBranchId(id)}
                    onWarehouseChange={(id) => setWarehouseId(id)}
                    disabled
                  />
                ) : warehouses.length > 1 ? (
                  <div className="mb-4 grid gap-2">
                    <Label>{t("inventory.warehouse")} *</Label>
                    <Select value={warehouseId} disabled>
                      <SelectTrigger>
                        <SelectValue placeholder={t("inventory.selectWarehouse")} />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="countDate">{t("inventory.countDate")}</Label>
                    <Input
                      id="countDate"
                      type="date"
                      value={countDate}
                      onChange={(e) => { setCountDate(e.target.value); setIsDirty(true); }}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">{t("common.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
                      placeholder={t("common.notes")}
                      rows={2}
                    />
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* Count Items — only show after warehouse selected */}
            {warehouseId && <Card>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <CardTitle>
                    {t("inventory.countItems")}
                    {countItems.filter(i => i.productId).length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {countItems.filter(i => i.productId).length}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addAllProducts}
                      disabled={usedProductIds.size === availableProducts.length}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      {t("inventory.addAllProducts")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 border-t border-slate-200">
                  {/* Desktop Table */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-semibold" style={{ width: "40%" }}>{t("common.product")} *</TableHead>
                          <TableHead className="font-semibold text-center" style={{ width: "9%" }}>{t("inventory.systemQty")}</TableHead>
                          <TableHead className="font-semibold text-center" style={{ width: "11%" }}>{t("inventory.physicalQty")} *</TableHead>
                          <TableHead className="font-semibold text-center" style={{ width: "9%" }}>{t("inventory.difference")}</TableHead>
                          <TableHead className="font-semibold" style={{ width: "21%" }}>{t("inventory.reason")}</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {countItems.map((item, index) => (
                          <Fragment key={item.id}>
                            <TableRow className="group hover:bg-slate-50 border-b">
                              {/* Product */}
                              <TableCell className="align-top p-2 border-r border-slate-100">
                                {item.productId ? (
                                  <div className="py-1.5 px-1">
                                    <span className="font-medium text-sm">{item.productName}</span>
                                    {item.sku && (
                                      <span className="ml-1.5 text-xs text-slate-400">({item.sku})</span>
                                    )}
                                  </div>
                                ) : (
                                  <div
                                    ref={(el) => {
                                      if (el) {
                                        const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                                        if (button) productComboRefs.current.set(item.id, button);
                                      } else {
                                        productComboRefs.current.delete(item.id);
                                      }
                                    }}
                                  >
                                    <ProductCombobox
                                      products={comboboxProducts.filter(p => !usedProductIds.has(p.id))}
                                      value={item.productId}
                                      onValueChange={(v) => updateItemProduct(item.id, v)}
                                      onSelect={() => focusPhysicalQty(item.id)}
                                      onSelectFocusNext={(ref) => focusNextFocusable(ref)}
                                    />
                                  </div>
                                )}
                              </TableCell>

                              {/* System Qty */}
                              <TableCell className="align-middle p-2 text-center border-r border-slate-100">
                                <span className="text-sm text-slate-600 font-medium">
                                  {item.productId ? item.systemQuantity.toLocaleString(locale) : "-"}
                                </span>
                              </TableCell>

                              {/* Physical Qty */}
                              <TableCell className="align-top p-2 border-r border-slate-100">
                                <Input
                                  ref={(el) => {
                                    if (el) physicalQtyRefs.current.set(item.id, el);
                                    else physicalQtyRefs.current.delete(item.id);
                                  }}
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  step="0.001"
                                  value={item.physicalQuantity}
                                  onChange={(e) => updateItem(item.id, "physicalQuantity", e.target.value)}
                                  placeholder={t("inventory.enterPhysicalQty")}
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100 text-center"
                                  disabled={!item.productId}
                                />
                              </TableCell>

                              {/* Difference */}
                              <TableCell className="align-middle p-2 text-center border-r border-slate-100">
                                {renderDifference(item)}
                              </TableCell>

                              {/* Reason */}
                              <TableCell className="align-top p-2 border-r border-slate-100">
                                <Input
                                  type="text"
                                  value={item.reason}
                                  onChange={(e) => updateItem(item.id, "reason", e.target.value)}
                                  placeholder={t("inventory.reason")}
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  disabled={!item.productId}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const isLastItem = index === countItems.length - 1;
                                      if (isLastItem) {
                                        addEmptyItem(true);
                                      } else {
                                        const nextItemId = countItems[index + 1].id;
                                        // Focus next product combobox or physical qty
                                        if (countItems[index + 1].productId) {
                                          focusPhysicalQty(nextItemId);
                                        } else {
                                          const nextTrigger = productComboRefs.current.get(nextItemId);
                                          if (nextTrigger) nextTrigger.focus();
                                        }
                                      }
                                    }
                                  }}
                                />
                              </TableCell>

                              {/* Delete */}
                              <TableCell className="align-middle p-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-500"
                                  onClick={() => removeItem(item.id)}
                                  disabled={countItems.length === 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="sm:hidden divide-y divide-slate-200">
                    {countItems.map((item) => (
                      <div key={item.id} className="p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            {item.productId ? (
                              <div>
                                <span className="font-medium text-sm">{item.productName}</span>
                                {item.sku && (
                                  <span className="ml-1.5 text-xs text-slate-400">({item.sku})</span>
                                )}
                              </div>
                            ) : (
                              <ProductCombobox
                                products={comboboxProducts.filter(p => !usedProductIds.has(p.id))}
                                value={item.productId}
                                onValueChange={(v) => updateItemProduct(item.id, v)}
                              />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => removeItem(item.id)}
                            disabled={countItems.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {item.productId && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-slate-500">{t("inventory.systemQty")}</Label>
                                <div className="mt-1 text-sm font-medium text-slate-600 px-3 py-2 bg-slate-50 rounded-md">
                                  {item.systemQuantity.toLocaleString(locale)}
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500">{t("inventory.physicalQty")} *</Label>
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  step="0.001"
                                  value={item.physicalQuantity}
                                  onChange={(e) => updateItem(item.id, "physicalQuantity", e.target.value)}
                                  placeholder={t("inventory.enterPhysicalQty")}
                                  className="mt-1"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-xs text-slate-500">{t("inventory.reason")}</Label>
                              <Input
                                type="text"
                                value={item.reason}
                                onChange={(e) => updateItem(item.id, "reason", e.target.value)}
                                placeholder={t("inventory.reason")}
                                className="mt-1"
                              />
                            </div>

                            <div className="flex justify-end pt-1 border-t border-dashed border-slate-200">
                              {renderDifferenceBadge(item)}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>}

            {/* Summary */}
            {warehouseId && countItems.filter(i => i.productId).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("inventory.countSummary")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="ml-auto max-w-full space-y-2 sm:max-w-xs">
                    <div className="flex justify-between text-sm">
                      <span>{t("inventory.countItems")}</span>
                      <Badge variant="secondary">{summary.totalCounted}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-green-600" />{t("inventory.surplus")}
                      </span>
                      <span className="text-green-700 font-medium">{summary.surplusCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <TrendingDown className="h-4 w-4 text-red-600" />{t("inventory.shortage")}
                      </span>
                      <span className="text-red-700 font-medium">{summary.shortageCount}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span>{t("inventory.noChange")}</span>
                      <span className="text-slate-500 font-medium">{summary.noChangeCount}</span>
                    </div>
                  </div>

                  <div className="mt-6 hidden gap-3 sm:flex sm:justify-end">
                    <Link href={`/inventory/adjustments/${id}`}>
                      <Button type="button" variant="outline">{t("common.cancel")}</Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting || validItems.length === 0}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>

                  <StickyBottomBar>
                    <Button type="submit" className="flex-1" disabled={isSubmitting || validItems.length === 0}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSubmitting ? t("common.saving") : t("common.save")}
                    </Button>
                  </StickyBottomBar>
                </CardContent>
              </Card>
            )}
          </div>
        </form>
      </div>
    </PageAnimation>
  );
}
