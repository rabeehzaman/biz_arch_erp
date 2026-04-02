"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useLanguage } from "@/lib/i18n";

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  isImeiTracked?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface ImeiEntry {
  imei1: string;
  imei2: string;
  brand: string;
  model: string;
  color: string;
  storageCapacity: string;
  ram: string;
  conditionGrade: string;
}

interface LineItem {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  notes: string;
  imeiNumbers: ImeiEntry[];
}

function makeEmptyLine(): LineItem {
  return {
    id: Date.now().toString(),
    productId: "",
    quantity: 1,
    unitCost: 0,
    notes: "",
    imeiNumbers: [],
  };
}

const makeEmptyImei = (): ImeiEntry => ({
  imei1: "", imei2: "", brand: "", model: "", color: "", storageCapacity: "", ram: "", conditionGrade: "NEW",
});

export default function NewOpeningStockPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { symbol, locale } = useCurrency();
  const { t } = useLanguage();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [existingStockKeys, setExistingStockKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const [formData, setFormData] = useState({
    stockDate: new Date().toISOString().split("T")[0],
    branchId: "",
    warehouseId: "",
    supplierId: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitCost: 0, notes: "", imeiNumbers: [] },
  ]);

  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const focusQuantity = useCallback((itemId: string) => {
    const input = quantityRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchExistingStocks();
  }, []);

  useEffect(() => {
    if (formData.warehouseId) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouseId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        addLineItem(true);
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

  const fetchProducts = async () => {
    const url = formData.warehouseId
      ? `/api/products?warehouseId=${formData.warehouseId}&compact=true`
      : "/api/products?compact=true";
    const res = await fetch(url);
    if (res.ok) setProducts(await res.json());
  };

  const fetchSuppliers = async () => {
    const res = await fetch("/api/suppliers?compact=true");
    if (res.ok) setSuppliers(await res.json());
  };

  const fetchExistingStocks = async () => {
    const res = await fetch("/api/opening-stocks");
    if (res.ok) {
      const data = await res.json();
      const keys = new Set<string>(
        data.map((s: { productId: string; warehouseId: string | null }) =>
          `${s.productId}|${s.warehouseId ?? ""}`
        )
      );
      setExistingStockKeys(keys);
    }
  };

  const hasImeiTrackedItems = lineItems.some((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
  });

  const addLineItem = useCallback((focusNewProduct: boolean = false) => {
    const newItem = makeEmptyLine();
    setLineItems((prev) => [...prev, newItem]);
    if (focusNewProduct) {
      setTimeout(() => {
        const trigger = productComboRefs.current.get(newItem.id);
        if (trigger) trigger.focus();
      }, 50);
    }
  }, []);

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: string, value: string | number) => {
    let shouldAddNewLine = false;
    const itemIndex = lineItems.findIndex((item) => item.id === id);
    const isLastItem = itemIndex === lineItems.length - 1;

    const updatedItems = lineItems.map((item) => {
      if (item.id !== id) return item;

      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        if (product) {
          if (isLastItem) shouldAddNewLine = true;

          // Warn if product already has opening stock
          const key = `${product.id}|${formData.warehouseId ?? ""}`;
          if (existingStockKeys.has(key)) {
            toast.warning(t("inventory.productAlreadyHasStock"));
          }

          return {
            ...item,
            productId: value as string,
            unitCost: Number(product.cost) || Number(product.price),
          };
        }
      }

      return { ...item, [field]: value };
    });

    setLineItems(updatedItems);

    // Sync IMEI count
    if (field === "quantity" || field === "productId") {
      const updatedItem = updatedItems.find((i) => i.id === id);
      if (updatedItem) {
        const prod = products.find((p) => p.id === updatedItem.productId);
        if (prod?.isImeiTracked) {
          setTimeout(() => syncImeiCount(id, updatedItem.quantity), 0);
        }
      }
    }

    if (shouldAddNewLine) {
      setTimeout(() => {
        setLineItems((prev) => [...prev, makeEmptyLine()]);
      }, 0);
    }
  };

  const syncImeiCount = (itemId: string, qty: number) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const product = products.find((p) => p.id === item.productId);
      if (!product?.isImeiTracked) return item;
      const count = Math.max(0, Math.floor(qty));
      const current = item.imeiNumbers;
      if (current.length === count) return item;
      if (current.length < count) {
        return { ...item, imeiNumbers: [...current, ...Array(count - current.length).fill(null).map(() => makeEmptyImei())] };
      }
      return { ...item, imeiNumbers: current.slice(0, count) };
    }));
  };

  const updateImeiField = (itemId: string, imeiIndex: number, field: keyof ImeiEntry, value: string) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const updated = [...item.imeiNumbers];
      updated[imeiIndex] = { ...updated[imeiIndex], [field]: value };
      return { ...item, imeiNumbers: updated };
    }));
  };

  const totalValue = lineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const validItems = lineItems.filter((item) => item.productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validItems.length === 0) {
      toast.error(t("inventory.addAtLeastOneProduct"));
      return;
    }

    if (!formData.stockDate) {
      toast.error(t("inventory.stockDateRequired"));
      return;
    }

    if (session?.user?.multiBranchEnabled && !formData.warehouseId) {
      toast.error(t("purchases.selectBranchWarehouse"));
      return;
    }

    // Check for within-batch duplicates
    const seen = new Set<string>();
    for (const item of validItems) {
      const key = `${item.productId}|${formData.warehouseId ?? ""}`;
      if (seen.has(key)) {
        const product = products.find((p) => p.id === item.productId);
        toast.error(`${t("inventory.duplicateProductInBatch")}: ${product?.name}`);
        return;
      }
      seen.add(key);
    }

    // Check IMEI requirements
    if (hasImeiTrackedItems && !formData.supplierId) {
      toast.error(t("inventory.supplierRequiredForImei"));
      return;
    }

    for (const item of validItems) {
      const product = products.find((p) => p.id === item.productId);
      if (product?.isImeiTracked && item.imeiNumbers.length > 0) {
        const missing = item.imeiNumbers.some((imei) => !imei.imei1 || !imei.brand || !imei.model);
        if (missing) {
          toast.error(`${t("inventory.fillRequiredImeiFields")} - ${product.name}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/opening-stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockDate: formData.stockDate,
          warehouseId: formData.warehouseId || null,
          items: validItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              notes: item.notes || null,
              deviceDetails: product?.isImeiTracked && item.imeiNumbers.length > 0
                ? { supplierId: formData.supplierId, imeiNumbers: item.imeiNumbers }
                : undefined,
            };
          }),
        }),
      });

      if (res.ok) {
        setIsDirty(false);
        toast.success(t("inventory.openingStockAdded"));
        router.push("/inventory/opening-stock");
      } else {
        const err = await res.json();
        toast.error(err.error || t("inventory.failedToAddOpeningStock"));
      }
    } catch {
      toast.error(t("inventory.failedToAddOpeningStock"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/inventory/opening-stock">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("inventory.addOpeningStock")}</h2>
            <p className="text-slate-500">{t("inventory.addOpeningStockDialogDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)}>
          <div className="space-y-6">
            {/* Stock Details */}
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory.stockDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(id) => setFormData((prev) => ({ ...prev, branchId: id }))}
                  onWarehouseChange={(id) => setFormData((prev) => ({ ...prev, warehouseId: id }))}
                  focusNextFocusable={focusNextFocusable}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="stockDate">{t("inventory.stockDate")}</Label>
                    <Input
                      id="stockDate"
                      type="date"
                      value={formData.stockDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, stockDate: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-slate-500">{t("inventory.fifoNote")}</p>
                  </div>
                  {hasImeiTrackedItems && (
                    <div className="grid gap-2">
                      <Label>{t("inventory.supplier2")}</Label>
                      <SupplierCombobox
                        suppliers={suppliers}
                        value={formData.supplierId}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, supplierId: v }))}
                        onSupplierCreated={fetchSuppliers}
                        onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>{t("inventory.openingStockItems")}</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={() => addLineItem(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("common.addItem")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 border-t border-slate-200">
                {/* Desktop Table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold" style={{ width: "30%" }}>{t("common.product")} *</TableHead>
                        <TableHead className="font-semibold">{t("common.quantity")} *</TableHead>
                        <TableHead className="font-semibold">{t("common.unitCost")}</TableHead>
                        <TableHead className="text-right font-semibold">{t("common.lineTotal")}</TableHead>
                        <TableHead className="font-semibold">{t("common.notes")}</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const product = products.find((p) => p.id === item.productId);
                        const isImeiTracked = product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
                        const lineTotal = item.quantity * item.unitCost;

                        return (
                          <Fragment key={item.id}>
                            <TableRow className="group hover:bg-slate-50 border-b">
                              {/* Product */}
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <div ref={(el) => {
                                  if (el) {
                                    const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                                    if (button) productComboRefs.current.set(item.id, button);
                                  } else {
                                    productComboRefs.current.delete(item.id);
                                  }
                                }}>
                                  <ProductCombobox
                                    products={products}
                                    value={item.productId}
                                    onValueChange={(value) => updateLineItem(item.id, "productId", value)}
                                    onProductCreated={fetchProducts}
                                    onSelect={() => focusQuantity(item.id)}
                                    onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                                  />
                                </div>
                              </TableCell>

                              {/* Quantity */}
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  ref={(el) => {
                                    if (el) quantityRefs.current.set(item.id, el);
                                    else quantityRefs.current.delete(item.id);
                                  }}
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0.01"
                                  step="0.001"
                                  value={item.quantity || ""}
                                  onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  required
                                />
                              </TableCell>

                              {/* Unit Cost */}
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  step="0.001"
                                  value={item.unitCost}
                                  onChange={(e) => updateLineItem(item.id, "unitCost", parseFloat(e.target.value) || 0)}
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                />
                              </TableCell>

                              {/* Total */}
                              <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                {symbol}{lineTotal.toLocaleString(locale, { minimumFractionDigits: 2 })}
                              </TableCell>

                              {/* Notes */}
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => updateLineItem(item.id, "notes", e.target.value)}
                                  placeholder={t("common.notes")}
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (index === lineItems.length - 1) {
                                        addLineItem(true);
                                      } else {
                                        const nextId = lineItems[index + 1].id;
                                        const nextTrigger = productComboRefs.current.get(nextId);
                                        if (nextTrigger) nextTrigger.focus();
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
                                  onClick={() => removeLineItem(item.id)}
                                  disabled={lineItems.length === 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>

                            {/* IMEI expansion row */}
                            {isImeiTracked && item.imeiNumbers.length > 0 && (
                              <TableRow key={`${item.id}-imei`} className="bg-blue-50/50">
                                <TableCell colSpan={99} className="p-3">
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-blue-700">{t("mobileShop.deviceDetails")} ({item.imeiNumbers.length})</p>
                                    {item.imeiNumbers.map((imei, idx) => (
                                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-white rounded border">
                                        <Input placeholder={`${t("mobileShop.imei1")} *`} value={imei.imei1} onChange={(e) => updateImeiField(item.id, idx, "imei1", e.target.value)} className="font-mono text-xs h-8" maxLength={15} required />
                                        <Input placeholder={t("mobileShop.imei2")} value={imei.imei2} onChange={(e) => updateImeiField(item.id, idx, "imei2", e.target.value)} className="font-mono text-xs h-8" maxLength={15} />
                                        <Input placeholder={t("mobileShop.brand")} value={imei.brand} onChange={(e) => updateImeiField(item.id, idx, "brand", e.target.value)} className="text-xs h-8" />
                                        <Input placeholder={t("mobileShop.model")} value={imei.model} onChange={(e) => updateImeiField(item.id, idx, "model", e.target.value)} className="text-xs h-8" />
                                        <Input placeholder={t("mobileShop.color")} value={imei.color} onChange={(e) => updateImeiField(item.id, idx, "color", e.target.value)} className="text-xs h-8" />
                                        <Select value={imei.storageCapacity} onValueChange={(value) => updateImeiField(item.id, idx, "storageCapacity", value)}>
                                          <SelectTrigger className="text-xs h-8"><SelectValue placeholder={t("mobileShop.storage")} /></SelectTrigger>
                                          <SelectContent>
                                            {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select value={imei.ram} onValueChange={(value) => updateImeiField(item.id, idx, "ram", value)}>
                                          <SelectTrigger className="text-xs h-8"><SelectValue placeholder={t("mobileShop.ram")} /></SelectTrigger>
                                          <SelectContent>
                                            {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select value={imei.conditionGrade} onValueChange={(value) => updateImeiField(item.id, idx, "conditionGrade", value)}>
                                          <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="NEW">{t("inventory.conditionNew")}</SelectItem>
                                            <SelectItem value="OPEN_BOX">{t("inventory.conditionOpenBox")}</SelectItem>
                                            <SelectItem value="GRADE_A">{t("inventory.conditionGradeA")}</SelectItem>
                                            <SelectItem value="GRADE_B">{t("inventory.conditionGradeB")}</SelectItem>
                                            <SelectItem value="GRADE_C">{t("inventory.conditionGradeC")}</SelectItem>
                                            <SelectItem value="REFURBISHED">{t("inventory.conditionRefurbished")}</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="sm:hidden divide-y divide-slate-200">
                  {lineItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    const isImeiTracked = product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
                    const lineTotal = item.quantity * item.unitCost;

                    return (
                      <div key={item.id} className="p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1" ref={(el) => {
                            if (el) {
                              const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                              if (button) productComboRefs.current.set(item.id, button);
                            } else {
                              productComboRefs.current.delete(item.id);
                            }
                          }}>
                            <Label className="text-xs text-slate-500 mb-1 block">{t("common.product")} *</Label>
                            <ProductCombobox
                              products={products}
                              value={item.productId}
                              onValueChange={(value) => updateLineItem(item.id, "productId", value)}
                              onProductCreated={fetchProducts}
                              onSelect={() => focusQuantity(item.id)}
                              onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500 mt-5"
                            onClick={() => removeLineItem(item.id)}
                            disabled={lineItems.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.quantity")} *</Label>
                            <Input
                              ref={(el) => {
                                if (el) quantityRefs.current.set(item.id, el);
                                else quantityRefs.current.delete(item.id);
                              }}
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0.01"
                              step="0.001"
                              value={item.quantity || ""}
                              onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.unitCost")}</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.001"
                              value={item.unitCost}
                              onChange={(e) => updateLineItem(item.id, "unitCost", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-slate-500">{t("common.notes")}</Label>
                          <Input
                            type="text"
                            value={item.notes}
                            onChange={(e) => updateLineItem(item.id, "notes", e.target.value)}
                            placeholder={t("common.notes")}
                          />
                        </div>

                        <div className="flex justify-end pt-1 border-t border-dashed border-slate-200">
                          <span className="text-sm font-semibold">
                            {symbol}{lineTotal.toLocaleString(locale, { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Mobile IMEI */}
                        {isImeiTracked && item.imeiNumbers.length > 0 && (
                          <div className="bg-blue-50/50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-blue-700">{t("mobileShop.deviceDetails")} ({item.imeiNumbers.length})</p>
                            {item.imeiNumbers.map((imei, idx) => (
                              <div key={idx} className="grid grid-cols-1 gap-2 rounded border bg-white p-2">
                                <Input placeholder={`${t("mobileShop.imei1")} *`} value={imei.imei1} onChange={(e) => updateImeiField(item.id, idx, "imei1", e.target.value)} className="font-mono text-xs h-8" maxLength={15} required />
                                <Input placeholder={t("mobileShop.imei2")} value={imei.imei2} onChange={(e) => updateImeiField(item.id, idx, "imei2", e.target.value)} className="font-mono text-xs h-8" maxLength={15} />
                                <Input placeholder={t("mobileShop.brand")} value={imei.brand} onChange={(e) => updateImeiField(item.id, idx, "brand", e.target.value)} className="text-xs h-8" />
                                <Input placeholder={t("mobileShop.model")} value={imei.model} onChange={(e) => updateImeiField(item.id, idx, "model", e.target.value)} className="text-xs h-8" />
                                <Input placeholder={t("mobileShop.color")} value={imei.color} onChange={(e) => updateImeiField(item.id, idx, "color", e.target.value)} className="text-xs h-8" />
                                <Select value={imei.storageCapacity} onValueChange={(value) => updateImeiField(item.id, idx, "storageCapacity", value)}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder={t("mobileShop.storage")} /></SelectTrigger>
                                  <SelectContent>
                                    {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={imei.ram} onValueChange={(value) => updateImeiField(item.id, idx, "ram", value)}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue placeholder={t("mobileShop.ram")} /></SelectTrigger>
                                  <SelectContent>
                                    {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={imei.conditionGrade} onValueChange={(value) => updateImeiField(item.id, idx, "conditionGrade", value)}>
                                  <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="NEW">{t("inventory.conditionNew")}</SelectItem>
                                    <SelectItem value="OPEN_BOX">{t("inventory.conditionOpenBox")}</SelectItem>
                                    <SelectItem value="GRADE_A">{t("inventory.conditionGradeA")}</SelectItem>
                                    <SelectItem value="GRADE_B">{t("inventory.conditionGradeB")}</SelectItem>
                                    <SelectItem value="GRADE_C">{t("inventory.conditionGradeC")}</SelectItem>
                                    <SelectItem value="REFURBISHED">{t("inventory.conditionRefurbished")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t("common.summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="ml-auto max-w-full space-y-2 sm:max-w-xs">
                  <div className="flex justify-between text-sm">
                    <span>{t("inventory.totalItems")}</span>
                    <span>{validItems.length}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>{t("inventory.totalValue")}</span>
                    <span>{symbol}{totalValue.toLocaleString(locale, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="mt-6 hidden gap-3 sm:flex sm:justify-end">
                  <Link href="/inventory/opening-stock">
                    <Button type="button" variant="outline">{t("common.cancel")}</Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting || validItems.length === 0}>
                    {isSubmitting ? t("common.creating") : t("inventory.addStock")}
                  </Button>
                </div>
                <StickyBottomBar>
                  <Button type="submit" className="flex-1" disabled={isSubmitting || validItems.length === 0}>
                    {isSubmitting ? t("common.creating") : t("inventory.addStock")}
                  </Button>
                </StickyBottomBar>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </PageAnimation>
  );
}
