"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
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
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
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
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function EditPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { symbol, locale } = useCurrency();
  const { unitConversions } = useUnitConversions();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    supplierId: "",
    invoiceDate: "",
    dueDate: "",
    supplierInvoiceRef: "",
    notes: "",
    branchId: "",
    warehouseId: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const [applyRoundOff, setApplyRoundOff] = useState(false);

  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const taxInclusiveRef = useRef<HTMLButtonElement>(null);
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const focusQuantity = useCallback((itemId: string) => {
    const input = quantityRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchInvoice();
    // Initial supplier and invoice load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchProducts();
    // Refresh product options from the selected warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouseId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        addLineItem();
      }
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

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          supplierId: data.supplier.id,
          invoiceDate: data.invoiceDate.split("T")[0],
          dueDate: data.dueDate.split("T")[0],
          supplierInvoiceRef: data.supplierInvoiceRef || "",
          notes: data.notes || "",
          branchId: data.branchId || "",
          warehouseId: data.warehouseId || "",
        });
        if (data.isTaxInclusive !== null && data.isTaxInclusive !== undefined) {
          setTaxInclusive(data.isTaxInclusive);
        }
        setApplyRoundOff(Boolean(data.applyRoundOff));
        setLineItems(
          data.items.map((item: { id: string; product: { id: string } | null; quantity: number; unitId: string | null; conversionFactor: number; unitCost: number; discount: number; gstRate?: number; hsnCode?: string; vatRate?: number }) => ({
            id: item.id,
            productId: item.product?.id || "",
            quantity: Number(item.quantity),
            unitId: item.unitId || "",
            conversionFactor: Number(item.conversionFactor) || 1,
            unitCost: Number(item.unitCost),
            discount: Number(item.discount),
            gstRate: Number(item.gstRate) || 0,
            hsnCode: item.hsnCode || "",
            vatRate: item.vatRate !== undefined ? Number(item.vatRate) : 15,
          }))
        );
      } else {
        toast.error(t("purchases.notFound"));
        router.push("/purchase-invoices");
      }
    } catch (error) {
      console.error("Failed to fetch purchase invoice:", error);
      toast.error(t("purchases.failedToLoad"));
      router.push("/purchase-invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const addLineItem = useCallback(() => {
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
      },
    ]);
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
          if (isLastItem) {
            shouldAddNewLine = true;
          }
          return {
            ...item,
            productId: value as string,
            unitId: product.unitId || "",
            conversionFactor: 1,
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
          },
        ]);
      }, 0);
    }
  };

  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const taxEnabled = session?.user?.gstEnabled || saudiEnabled;
  const orgTaxInclusive = !!(session?.user as { isTaxInclusivePrice?: boolean })?.isTaxInclusivePrice;
  const [taxInclusive, setTaxInclusive] = useState(orgTaxInclusive);
  useEffect(() => { setTaxInclusive(orgTaxInclusive); }, [orgTaxInclusive]);

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

    const validItems = lineItems.filter((item) => item.productId);

    if (validItems.length === 0) {
      toast.error(t("purchases.addProductValidation"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/purchase-invoices/${id}`, {
        method: "PUT",
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
            };
          }),
        }),
      });

      if (response.ok) {
        toast.success(t("purchases.invoiceUpdated"));
        router.push(`/purchase-invoices/${id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || t("purchases.failedToUpdate"));
      }
    } catch (error) {
      console.error("Failed to update purchase invoice:", error);
      toast.error(t("purchases.failedToUpdate"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href={`/purchase-invoices/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("purchases.editInvoice")}</h2>
            <p className="text-slate-500">{t("purchases.updatePurchaseDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
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
                />
                <div className="grid gap-4 sm:grid-cols-2 mt-4">
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

            <Card>
              <CardHeader>
                <CardTitle>{t("purchases.purchaseItems")}</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
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
                      {lineItems.map((item) => {
                        const lineAmts = getPurchaseLineAmounts(item);
                        const lineGross = lineAmts.gross;
                        const lineNet = lineAmts.net;
                        const lineAmountKey = getLineAmountKey(item.id, lineGross, lineNet);
                        return (
                          <TableRow key={item.id} className="group hover:bg-slate-50 border-b">
                            <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                              <ProductCombobox
                                products={products}
                                value={item.productId}
                                onValueChange={(value) =>
                                  updateLineItem(item.id, "productId", value)
                                }
                                onSelect={() => focusQuantity(item.id)}
                              />
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card Layout */}
                <div className="sm:hidden divide-y divide-slate-200">
                  {lineItems.map((item) => {
                    const lineAmtsMob = getPurchaseLineAmounts(item);
                    const lineGross = lineAmtsMob.gross;
                    const lineNet = lineAmtsMob.net;
                    const lineAmountKey = getLineAmountKey(item.id, lineGross, lineNet);

                    return (
                      <div key={item.id} className="p-3 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <Label className="text-xs text-slate-500 mb-1 block">{t("common.product")} *</Label>
                            <ProductCombobox
                              products={products}
                              value={item.productId}
                              onValueChange={(value) =>
                                updateLineItem(item.id, "productId", value)
                              }
                              onSelect={() => focusQuantity(item.id)}
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
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

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

            <Card>
              <CardHeader>
                <CardTitle>{t("common.summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-medium">{t("purchases.stockUpdate")}</p>
                  <p className="text-blue-600">
                    {t("purchases.stockUpdateEditDesc")}
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
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{saudiEnabled ? t("purchases.vatLabel") : t("common.gst")}</span>
                      <span key={`summary-tax:${tax.toFixed(2)}`}>{symbol}{tax.toLocaleString(locale)}</span>
                    </div>
                  )}
                  {applyRoundOff && roundOffAmount !== 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
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
                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting || !formData.supplierId || !formData.dueDate}
                  >
                    {isSubmitting ? t("common.updating") : t("purchases.updatePurchaseInvoice")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </PageAnimation>
  );
}
