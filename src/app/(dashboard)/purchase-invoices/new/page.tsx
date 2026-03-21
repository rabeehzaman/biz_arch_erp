"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useRouter, useSearchParams } from "next/navigation";
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
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { useUnitConversions } from "@/hooks/use-unit-conversions";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { Switch } from "@/components/ui/switch";
import { useRoundOffSettings } from "@/hooks/use-round-off-settings";
import { calculateRoundOff } from "@/lib/round-off";
import { useLanguage } from "@/lib/i18n";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  gstRate?: number;
  hsnCode?: string;
  isImeiTracked?: boolean;
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
  unitId: string;
  conversionFactor: number;
  unitCost: number;
  discount: number;
  gstRate: number;
  hsnCode: string;
  vatRate: number;
  imeiNumbers: ImeiEntry[];
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    supplierId: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: getDefaultDueDate(),
    supplierInvoiceRef: "",
    notes: "",
    branchId: "",
    warehouseId: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitId: "", conversionFactor: 1, unitCost: 0, discount: 0, gstRate: 0, hsnCode: "", vatRate: 15, imeiNumbers: [] },
  ]);

  const { data: session } = useSession();
  const { symbol, locale } = useCurrency();
  const { unitConversions } = useUnitConversions();
  const { t } = useLanguage();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const taxInclusiveRef = useRef<HTMLButtonElement>(null);
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Focus quantity input for a specific line item
  const focusQuantity = useCallback((itemId: string) => {
    const input = quantityRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchProducts();
    // Refresh product options from the selected warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouseId]);

  // Pre-fill form when duplicating an existing purchase invoice
  useEffect(() => {
    if (!duplicateId) return;
    const fetchDuplicate = async () => {
      try {
        const response = await fetch(`/api/purchase-invoices/${duplicateId}`);
        if (!response.ok) return;
        const data = await response.json();
        setFormData({
          supplierId: data.supplier?.id || "",
          invoiceDate: new Date().toISOString().split("T")[0],
          dueDate: getDefaultDueDate(),
          supplierInvoiceRef: "",
          notes: data.notes || "",
          branchId: data.branch?.id || "",
          warehouseId: data.warehouse?.id || "",
        });
        if (data.items && data.items.length > 0) {
          setLineItems(
            data.items.map((item: any, idx: number) => ({
              id: `dup-${idx}`,
              productId: item.productId || "",
              quantity: Number(item.quantity) || 1,
              unitId: item.unitId || "",
              conversionFactor: item.conversionFactor || 1,
              unitCost: Number(item.unitCost) || 0,
              discount: Number(item.discount) || 0,
              gstRate: Number(item.gstRate) || 0,
              hsnCode: item.hsnCode || "",
              vatRate: Number(item.vatRate) ?? 15,
              imeiNumbers: [],
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch purchase invoice for duplication:", error);
      }
    };
    fetchDuplicate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+A: Add new line item
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        addLineItem(true);
      }
      // Ctrl+Enter: Submit form
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Keyboard shortcuts stay bound for the lifetime of the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSuppliers = async () => {
    const response = await fetch("/api/suppliers?compact=true");
    const data = await response.json();
    setSuppliers(data);
  };

  const fetchProducts = async () => {
    const url = formData.warehouseId
      ? `/api/products?warehouseId=${formData.warehouseId}&compact=true`
      : "/api/products?compact=true";
    const response = await fetch(url);
    const data = await response.json();
    setProducts(data);
  };

  const addLineItem = useCallback((focusNewProduct: boolean = false) => {
    const newId = Date.now().toString();
    setLineItems((prev) => [
      ...prev,
      {
        id: newId,
        productId: "",
        quantity: 1,
        unitId: "",
        conversionFactor: 1,
        unitCost: 0,
        discount: 0,
        gstRate: 0,
        hsnCode: "",
        vatRate: 15,
        imeiNumbers: [],
      },
    ]);

    if (focusNewProduct) {
      setTimeout(() => {
        const productTrigger = productComboRefs.current.get(newId);
        if (productTrigger) {
          productTrigger.focus();
        }
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
          // Auto-add new line if selecting product on last item
          if (isLastItem) {
            shouldAddNewLine = true;
          }
          return {
            ...item,
            productId: value as string,
            unitId: product.unitId || "",
            conversionFactor: 1,
            // Use product cost if available, otherwise use selling price
            unitCost: Number(product.cost) || Number(product.price),
            gstRate: Number(product.gstRate) || 0,
            hsnCode: product.hsnCode || "",
          };
        }
      }

      if (field === "unitId") {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          if (value === product.unitId) {
            return {
              ...item,
              unitId: value as string,
              conversionFactor: 1,
              unitCost: Number(product.cost) || Number(product.price),
            };
          }
          const altConversion = unitConversions.find(uc => uc.toUnitId === product.unitId && uc.fromUnitId === value);
          if (altConversion) {
            const baseCost = Number(product.cost) || Number(product.price);
            return {
              ...item,
              unitId: value as string,
              conversionFactor: Number(altConversion.conversionFactor),
              unitCost: baseCost * Number(altConversion.conversionFactor),
            };
          }
        }
      }

      return { ...item, [field]: value };
    });

    setLineItems(updatedItems);

    // Sync IMEI count when quantity or product changes
    if (field === "quantity" || field === "productId") {
      const updatedItem = updatedItems.find((i) => i.id === id);
      if (updatedItem) {
        const prod = products.find((p) => p.id === updatedItem.productId);
        if (prod?.isImeiTracked) {
          setTimeout(() => syncImeiCount(id, updatedItem.quantity), 0);
        }
      }
    }

    // Add new line after state update if needed
    if (shouldAddNewLine) {
      setTimeout(() => {
        setLineItems((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            productId: "",
            quantity: 1,
            unitId: "",
            conversionFactor: 1,
            unitCost: 0,
            discount: 0,
            gstRate: 0,
            hsnCode: "",
            vatRate: 15,
            imeiNumbers: [],
          },
        ]);
      }, 0);
    }
  };

  const makeEmptyImei = (): ImeiEntry => ({
    imei1: "", imei2: "", brand: "", model: "", color: "", storageCapacity: "", ram: "", conditionGrade: "NEW",
  });

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

  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const taxEnabled = session?.user?.gstEnabled || saudiEnabled;
  const orgTaxInclusive = !!(session?.user as { isTaxInclusivePrice?: boolean })?.isTaxInclusivePrice;
  const [taxInclusive, setTaxInclusive] = useState(orgTaxInclusive);
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const [applyRoundOff, setApplyRoundOff] = useState(false);
  useEffect(() => { setTaxInclusive(orgTaxInclusive); }, [orgTaxInclusive]);
  useEffect(() => { setApplyRoundOff(roundOffEnabled); }, [roundOffEnabled]);

  function getPurchaseLineAmounts(item: LineItem) {
    const discountedAmount = item.quantity * item.unitCost * (1 - item.discount / 100);
    const taxRate = saudiEnabled ? (item.vatRate || 0) : (item.gstRate || 0);
    if (taxInclusive && taxRate > 0) {
      const subtotalLine = Math.round((discountedAmount / (1 + taxRate / 100)) * 100) / 100;
      const taxLine = Math.round((discountedAmount - subtotalLine) * 100) / 100;
      return { gross: subtotalLine, subtotal: subtotalLine, tax: taxLine, net: discountedAmount };
    }
    const taxLine = Math.round((discountedAmount * taxRate / 100) * 100) / 100;
    return { gross: discountedAmount, subtotal: discountedAmount, tax: taxLine, net: discountedAmount + taxLine };
  }

  const subtotal = lineItems.reduce((sum, item) => sum + getPurchaseLineAmounts(item).subtotal, 0);
  const tax = lineItems.reduce((sum, item) => sum + getPurchaseLineAmounts(item).tax, 0);
  const total = taxInclusive
    ? lineItems.reduce((sum, item) => sum + getPurchaseLineAmounts(item).net, 0)
    : subtotal + tax;
  const { roundOffAmount, roundedTotal } = calculateRoundOff(
    total,
    roundOffMode,
    applyRoundOff
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out blank items (items without a product selected)
    const validItems = lineItems.filter((item) => item.productId);

    // Validate that at least one item has a product selected
    if (validItems.length === 0) {
      toast.error(t("purchases.addProductValidation"));
      return;
    }

    if (session?.user?.multiBranchEnabled && !formData.warehouseId) {
      toast.error(t("purchases.selectBranchWarehouse"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/purchase-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          supplierInvoiceRef: formData.supplierInvoiceRef || null,
          notes: formData.notes || null,
          branchId: formData.branchId || undefined,
          warehouseId: formData.warehouseId || undefined,
          isTaxInclusive: taxInclusive,
          applyRoundOff,
          items: validItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              description: product?.name || "",
              quantity: item.quantity,
              unitId: item.unitId || null,
              conversionFactor: item.conversionFactor || 1,
              unitCost: item.unitCost,
              discount: item.discount,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              ...(saudiEnabled && { vatRate: item.vatRate ?? 15 }),
              ...(product?.isImeiTracked && item.imeiNumbers.length > 0 && { imeiNumbers: item.imeiNumbers }),
            };
          }),
        }),
      });

      if (response.ok) {
        const invoice = await response.json();
        setIsDirty(false);
        toast.success(t("purchases.purchaseInvoiceCreatedStock"));
        router.push(`/purchase-invoices/${invoice.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || t("purchases.failedToLoad"));
      }
    } catch (error) {
      console.error("Failed to create purchase invoice:", error);
      toast.error(t("purchases.failedToLoad"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/purchase-invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("purchases.newInvoice")}</h2>
            <p className="text-slate-500">{t("purchases.recordPurchaseDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)}>
          <div className="space-y-6">
            {/* Supplier & Date */}
            <Card>
              <CardHeader>
                <CardTitle>{t("purchases.purchaseDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(id) => setFormData(prev => ({ ...prev, branchId: id }))}
                  onWarehouseChange={(id) => setFormData(prev => ({ ...prev, warehouseId: id }))}
                  focusNextFocusable={focusNextFocusable}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="supplier">{t("common.supplier")} *</Label>
                    <SupplierCombobox
                      suppliers={suppliers}
                      value={formData.supplierId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, supplierId: value })
                      }
                      onSupplierCreated={fetchSuppliers}
                      required
                      onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                      autoFocus={true}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="supplierInvoiceRef">{t("purchases.supplierInvoiceRef")}</Label>
                    <Input
                      id="supplierInvoiceRef"
                      value={formData.supplierInvoiceRef}
                      onChange={(e) =>
                        setFormData({ ...formData, supplierInvoiceRef: e.target.value })
                      }
                      placeholder={t("purchases.supplierInvoiceRefPlaceholder")}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invoiceDate">{t("purchases.purchaseDate")} *</Label>
                    <Input
                      id="invoiceDate"
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) =>
                        setFormData({ ...formData, invoiceDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">{t("purchases.paymentDueDate")} *</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  {taxEnabled && (
                    <div className="grid gap-2">
                      <Label>{t("common.pricing")}</Label>
                      <Select value={taxInclusive ? "inclusive" : "exclusive"} onValueChange={(v) => setTaxInclusive(v === "inclusive")} onOpenChange={(open) => { if (!open) { setTimeout(() => focusNextFocusable(taxInclusiveRef), 10); } }}>
                        <SelectTrigger ref={taxInclusiveRef}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inclusive">{t("common.taxInclusive")}</SelectItem>
                          <SelectItem value="exclusive">{t("common.taxExclusive")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>{t("purchases.purchaseItems")}</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={() => addLineItem(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("common.addItem")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 border-t border-slate-200">
                {/* Desktop Table Layout */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="font-semibold" style={{ width: '30%' }}>{t("common.product")} *</TableHead>
                        <TableHead className="font-semibold">{t("common.quantity")} *</TableHead>
                        {session?.user?.multiUnitEnabled && (
                          <TableHead className="font-semibold">{t("common.unit")}</TableHead>
                        )}
                        <TableHead className="font-semibold">{t("common.unitCost")} *</TableHead>
                        <TableHead className="font-semibold">{t("common.discountPercent")}</TableHead>
                        {saudiEnabled && <TableHead className="font-semibold">{t("common.vatPercent")}</TableHead>}
                        {session?.user?.gstEnabled && !saudiEnabled && <TableHead className="font-semibold">{t("common.gstPercent")}</TableHead>}
                        {taxEnabled ? (
                          <>
                            <TableHead className="text-right font-semibold">{t("common.grossAmount")}</TableHead>
                            <TableHead className="text-right font-semibold">{t("common.netAmount")}</TableHead>
                          </>
                        ) : (
                          <TableHead className="text-right font-semibold">{t("common.lineTotal")}</TableHead>
                        )}
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((item, index) => {
                        const product = products.find((p) => p.id === item.productId);
                        const isImeiTracked = product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
                        const lineAmts = getPurchaseLineAmounts(item);
                        const lineGross = lineAmts.gross;
                        const lineNet = lineAmts.net;
                        const lineAmountKey = getLineAmountKey(item.id, lineGross, lineNet);
                        return (
                          <Fragment key={item.id}><TableRow className="group hover:bg-slate-50 border-b">
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
                                  onValueChange={(value) =>
                                    updateLineItem(item.id, "productId", value)
                                  }
                                  onProductCreated={fetchProducts}
                                  onSelect={() => focusQuantity(item.id)}
                                  onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="align-top p-2 border-r border-slate-100 last:border-0 relative">
                              <Input
                                ref={(el) => {
                                  if (el) {
                                    quantityRefs.current.set(item.id, el);
                                  } else {
                                    quantityRefs.current.delete(item.id);
                                  }
                                }}
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0.01"
                                step="0.01"
                                value={item.quantity || ""}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                required
                              />
                            </TableCell>
                            {session?.user?.multiUnitEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <ItemUnitSelect
                                  value={item.unitId}
                                  onValueChange={(value) => updateLineItem(item.id, "unitId", value)}
                                  options={(() => {
                                    const product = products.find((p) => p.id === item.productId);
                                    if (!product) return [];
                                    const baseOption = { id: product.unitId!, name: product.unit?.name || product.unit?.code || "Base Unit", conversionFactor: 1 };
                                    const alternateOptions = unitConversions
                                      .filter(uc => uc.toUnitId === product.unitId)
                                      .map(uc => ({
                                        id: uc.fromUnitId,
                                        name: uc.fromUnit.name,
                                        conversionFactor: Number(uc.conversionFactor)
                                      }));
                                    return [baseOption, ...alternateOptions];
                                  })()}
                                  disabled={!item.productId}
                                  onSelectFocusNext={(ref) => focusNextFocusable(ref)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                step="0.01"
                                value={item.unitCost}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "unitCost",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                required
                              />
                            </TableCell>
                            <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.discount || ""}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "discount",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const isLastItem = index === lineItems.length - 1;
                                    if (isLastItem) {
                                      addLineItem(true);
                                    } else {
                                      const nextItemId = lineItems[index + 1].id;
                                      const nextProductTrigger = productComboRefs.current.get(nextItemId);
                                      if (nextProductTrigger) {
                                        nextProductTrigger.focus();
                                      }
                                    }
                                  }
                                }}
                                className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                placeholder="0"
                              />
                            </TableCell>
                            {saudiEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.vatRate ?? 15}
                                  onChange={(e) =>
                                    updateLineItem(item.id, "vatRate", parseFloat(e.target.value) || 0)
                                  }
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  placeholder="15"
                                />
                              </TableCell>
                            )}
                            {session?.user?.gstEnabled && !saudiEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.gstRate || ""}
                                  onChange={(e) =>
                                    updateLineItem(item.id, "gstRate", parseFloat(e.target.value) || 0)
                                  }
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  placeholder="0"
                                />
                              </TableCell>
                            )}
                            {taxEnabled ? (
                              <>
                                <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                  <span key={`${lineAmountKey}:gross`}>
                                    {symbol}{lineGross.toLocaleString(locale)}
                                  </span>
                                  {item.discount > 0 && (
                                    <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                  <span key={`${lineAmountKey}:net`}>
                                    {symbol}{lineNet.toLocaleString(locale)}
                                  </span>
                                </TableCell>
                              </>
                            ) : (
                              <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                <span key={`${lineAmountKey}:single`}>
                                  {symbol}{lineGross.toLocaleString(locale)}
                                </span>
                                {item.discount > 0 && (
                                  <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                )}
                              </TableCell>
                            )}
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
                            {isImeiTracked && item.imeiNumbers.length > 0 && (
                              <TableRow key={`${item.id}-imei`} className="bg-blue-50/50">
                                <TableCell colSpan={99} className="p-3">
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-blue-700">{t("mobileShop.deviceDetails")} ({item.imeiNumbers.length})</p>
                                    {item.imeiNumbers.map((imei, idx) => (
                                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-white rounded border">
                                        <Input
                                          placeholder={`${t("mobileShop.imei1")} *`}
                                          value={imei.imei1}
                                          onChange={(e) => updateImeiField(item.id, idx, "imei1", e.target.value)}
                                          className="font-mono text-xs h-8"
                                          maxLength={15}
                                          required
                                        />
                                        <Input
                                          placeholder={t("mobileShop.imei2")}
                                          value={imei.imei2}
                                          onChange={(e) => updateImeiField(item.id, idx, "imei2", e.target.value)}
                                          className="font-mono text-xs h-8"
                                          maxLength={15}
                                        />
                                        <Input
                                          placeholder={t("mobileShop.brand")}
                                          value={imei.brand}
                                          onChange={(e) => updateImeiField(item.id, idx, "brand", e.target.value)}
                                          className="text-xs h-8"
                                        />
                                        <Input
                                          placeholder={t("mobileShop.model")}
                                          value={imei.model}
                                          onChange={(e) => updateImeiField(item.id, idx, "model", e.target.value)}
                                          className="text-xs h-8"
                                        />
                                        <Input
                                          placeholder={t("mobileShop.color")}
                                          value={imei.color}
                                          onChange={(e) => updateImeiField(item.id, idx, "color", e.target.value)}
                                          className="text-xs h-8"
                                        />
                                        <Select
                                          value={imei.storageCapacity}
                                          onValueChange={(value) => updateImeiField(item.id, idx, "storageCapacity", value)}
                                        >
                                          <SelectTrigger className="text-xs h-8">
                                            <SelectValue placeholder={t("mobileShop.storage")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={imei.ram}
                                          onValueChange={(value) => updateImeiField(item.id, idx, "ram", value)}
                                        >
                                          <SelectTrigger className="text-xs h-8">
                                            <SelectValue placeholder={t("mobileShop.ram")} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Select
                                          value={imei.conditionGrade}
                                          onValueChange={(value) => updateImeiField(item.id, idx, "conditionGrade", value)}
                                        >
                                          <SelectTrigger className="text-xs h-8">
                                            <SelectValue />
                                          </SelectTrigger>
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
                    const lineAmtsMob = getPurchaseLineAmounts(item);
                    const lineGross = lineAmtsMob.gross;
                    const lineNet = lineAmtsMob.net;
                    const lineAmountKey = getLineAmountKey(item.id, lineGross, lineNet);

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
                              onValueChange={(value) =>
                                updateLineItem(item.id, "productId", value)
                              }
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
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0.01"
                              step="0.01"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.unitCost")} *</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.01"
                              value={item.unitCost}
                              onChange={(e) =>
                                updateLineItem(item.id, "unitCost", parseFloat(e.target.value) || 0)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.discountPercent")}</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.discount || ""}
                              onChange={(e) =>
                                updateLineItem(item.id, "discount", parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                            />
                          </div>
                          {saudiEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">{t("common.vatPercent")}</Label>
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.vatRate ?? 15}
                                onChange={(e) =>
                                  updateLineItem(item.id, "vatRate", parseFloat(e.target.value) || 0)
                                }
                                placeholder="15"
                              />
                            </div>
                          )}
                          {session?.user?.gstEnabled && !saudiEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">{t("common.gstPercent")}</Label>
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.gstRate || ""}
                                onChange={(e) =>
                                  updateLineItem(item.id, "gstRate", parseFloat(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </div>
                          )}
                          {session?.user?.multiUnitEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">{t("common.unit")}</Label>
                              <ItemUnitSelect
                                value={item.unitId}
                                onValueChange={(value) => updateLineItem(item.id, "unitId", value)}
                                options={(() => {
                                  const p = products.find((p) => p.id === item.productId);
                                  if (!p) return [];
                                  const baseOption = { id: p.unitId!, name: p.unit?.name || p.unit?.code || "Base Unit", conversionFactor: 1 };
                                  const alternateOptions = unitConversions
                                    .filter(uc => uc.toUnitId === p.unitId)
                                    .map(uc => ({ id: uc.fromUnitId, name: uc.fromUnit.name, conversionFactor: Number(uc.conversionFactor) }));
                                  return [baseOption, ...alternateOptions];
                                })()}
                                disabled={!item.productId}
                                onSelectFocusNext={(ref) => focusNextFocusable(ref)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-1 border-t border-dashed border-slate-200">
                          <span key={`${lineAmountKey}:mobile`} className="text-sm font-semibold">
                            {taxEnabled
                              ? `${symbol}${lineNet.toLocaleString(locale)}`
                              : `${symbol}${lineGross.toLocaleString(locale)}`}
                          </span>
                        </div>

                        {/* Mobile IMEI Section */}
                        {isImeiTracked && item.imeiNumbers.length > 0 && (
                          <div className="bg-blue-50/50 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-blue-700">{t("mobileShop.deviceDetails")} ({item.imeiNumbers.length})</p>
                            {item.imeiNumbers.map((imei, idx) => (
                              <div key={idx} className="grid grid-cols-1 gap-2 rounded border bg-white p-2">
                                <Input
                                  placeholder={`${t("mobileShop.imei1")} *`}
                                  value={imei.imei1}
                                  onChange={(e) => updateImeiField(item.id, idx, "imei1", e.target.value)}
                                  className="font-mono text-xs h-8"
                                  maxLength={15}
                                  required
                                />
                                <Input
                                  placeholder={t("mobileShop.imei2")}
                                  value={imei.imei2}
                                  onChange={(e) => updateImeiField(item.id, idx, "imei2", e.target.value)}
                                  className="font-mono text-xs h-8"
                                  maxLength={15}
                                />
                                <Input
                                  placeholder={t("mobileShop.brand")}
                                  value={imei.brand}
                                  onChange={(e) => updateImeiField(item.id, idx, "brand", e.target.value)}
                                  className="text-xs h-8"
                                />
                                <Input
                                  placeholder={t("mobileShop.model")}
                                  value={imei.model}
                                  onChange={(e) => updateImeiField(item.id, idx, "model", e.target.value)}
                                  className="text-xs h-8"
                                />
                                <Input
                                  placeholder={t("mobileShop.color")}
                                  value={imei.color}
                                  onChange={(e) => updateImeiField(item.id, idx, "color", e.target.value)}
                                  className="text-xs h-8"
                                />
                                <Select
                                  value={imei.storageCapacity}
                                  onValueChange={(value) => updateImeiField(item.id, idx, "storageCapacity", value)}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder={t("mobileShop.storage")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {["8GB", "16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB", "4TB"].map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={imei.ram}
                                  onValueChange={(value) => updateImeiField(item.id, idx, "ram", value)}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue placeholder={t("mobileShop.ram")} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {["1GB", "1.5GB", "2GB", "3GB", "4GB", "6GB", "8GB", "10GB", "12GB", "16GB", "18GB", "24GB", "32GB", "64GB"].map((opt) => (
                                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={imei.conditionGrade}
                                  onValueChange={(value) => updateImeiField(item.id, idx, "conditionGrade", value)}
                                >
                                  <SelectTrigger className="text-xs h-8">
                                    <SelectValue />
                                  </SelectTrigger>
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

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>{t("common.additionalInformation")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t("common.notes")}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder={t("common.notesPlaceholder")}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>{t("common.summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-medium">{t("purchases.stockUpdate")}</p>
                  <p className="text-blue-600">
                    {t("purchases.stockUpdateCreateDesc")}
                  </p>
                </div>
                <div className="ml-auto max-w-full space-y-2 sm:max-w-xs">
                  <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{t("common.applyRoundOff")}</p>
                      <p className="text-xs text-slate-500">
                        {roundOffEnabled
                          ? t("purchases.roundOffRuleEnabled")
                          : t("purchases.roundOffRuleDisabled")}
                      </p>
                    </div>
                    <Switch
                      checked={applyRoundOff}
                      onCheckedChange={setApplyRoundOff}
                      disabled={!roundOffEnabled}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>{t("common.subtotal")}</span>
                    <span key={`summary-subtotal:${subtotal.toFixed(2)}`}>{symbol}{subtotal.toLocaleString(locale)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{saudiEnabled ? t("purchases.vatLabel") : t("common.gst")}</span>
                      <span key={`summary-tax:${tax.toFixed(2)}`}>{symbol}{tax.toLocaleString(locale)}</span>
                    </div>
                  )}
                  {applyRoundOff && roundOffAmount !== 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("common.roundOff")}</span>
                      <span key={`summary-roundoff:${roundOffAmount.toFixed(2)}`}>
                        {roundOffAmount >= 0 ? "+" : ""}
                        {symbol}{roundOffAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>{t("common.total")}</span>
                    <span key={`summary-total:${roundedTotal.toFixed(2)}`}>{symbol}{roundedTotal.toLocaleString(locale)}</span>
                  </div>
                </div>
                <div className="mt-6 hidden gap-3 sm:flex sm:justify-end">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting || !formData.supplierId || !formData.dueDate}
                  >
                    {isSubmitting ? t("common.creating") : t("purchases.createInvoice")}
                  </Button>
                </div>
                <StickyBottomBar>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || !formData.supplierId || !formData.dueDate}
                  >
                    {isSubmitting ? t("common.creating") : t("purchases.createInvoice")}
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
