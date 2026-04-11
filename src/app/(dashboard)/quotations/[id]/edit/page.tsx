"use client";

import { useState, useEffect, useRef, useCallback, useMemo, use } from "react";
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
import { CustomerCombobox } from "@/components/invoices/customer-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/hooks/use-currency";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { getProductUnitOptions, resolveUnitPrice, getDefaultUnit } from "@/lib/unit-utils";
import { calculateLineAmounts } from "@/lib/line-amounts";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useLanguage } from "@/lib/i18n";

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  gstRate?: number;
  hsnCode?: string;
  unitConversions?: { unitId: string; unit: { name: string; code?: string }; conversionFactor: number; price?: number | null; isDefaultUnit?: boolean }[];
}

interface LineItem {
  id: string;
  productId: string;
  quantity: number;
  unitId: string;
  conversionFactor: number;
  unitPrice: number;
  discount: number;
  gstRate: number;
  hsnCode: string;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

type QuotationTaxMode = "none" | "gst" | "vat";

function getQuotationTaxMode(gstEnabled: boolean | undefined, saudiEnabled: boolean): QuotationTaxMode {
  if (saudiEnabled) return "vat";
  if (gstEnabled) return "gst";
  return "none";
}

function getItemTaxRate(item: LineItem, taxMode: QuotationTaxMode): number {
  return taxMode === "vat" ? (Number((item as { vatRate?: number }).vatRate) || 0) : taxMode === "gst" ? (Number(item.gstRate) || 0) : 0;
}

export default function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    customerId: "",
    issueDate: "",
    validUntil: "",
    notes: "",
    terms: "",
    branchId: "",
    warehouseId: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const { data: session } = useSession();
  const { symbol, locale, fmt } = useCurrency();
  const { t } = useLanguage();

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
    fetchCustomers();
    fetchQuotation();
    // Initial customer and quotation load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    const url = formData.warehouseId
      ? `/api/products?warehouseId=${formData.warehouseId}&compact=true`
      : "/api/products?compact=true";
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setProducts(data))
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouseId]);

  // Resolve customer-specific price list prices when customer changes
  const isPriceListOn = (session?.user as { isPriceListEnabled?: boolean })?.isPriceListEnabled ?? false;
  useEffect(() => {
    if (!isPriceListOn || !formData.customerId) return;
    fetch(`/api/products/resolved-prices?customerId=${formData.customerId}`)
      .then((r) => r.json())
      .then((resolved: Record<string, { price: number; basePrice: number }>) => {
        if (!resolved || Object.keys(resolved).length === 0) return;
        setProducts((prev) =>
          prev.map((p) => {
            const rp = resolved[p.id];
            if (rp) return { ...p, price: rp.price, basePrice: rp.basePrice };
            return p;
          })
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customerId, isPriceListOn]);

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

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers?compact=true");
    const data = await response.json();
    setCustomers(data);
  };

  const fetchQuotation = async () => {
    try {
      const response = await fetch(`/api/quotations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          customerId: data.customer.id,
          issueDate: data.issueDate.split("T")[0],
          validUntil: data.validUntil.split("T")[0],
          notes: data.notes || "",
          terms: data.terms || "",
          branchId: data.branchId || "",
          warehouseId: data.warehouseId || "",
        });
        if (data.isTaxInclusive !== null && data.isTaxInclusive !== undefined) {
          setTaxInclusive(data.isTaxInclusive);
        }
        setLineItems(
          data.items.map((item: { id: string; product: { id: string } | null; quantity: number; unitId: string | null; conversionFactor: number; unitPrice: number; discount: number; gstRate?: number; hsnCode?: string }) => ({
            id: item.id,
            productId: item.product?.id || "",
            quantity: Number(item.quantity),
            unitId: item.unitId || "",
            conversionFactor: Number(item.conversionFactor) || 1,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            gstRate: Number(item.gstRate) || 0,
            hsnCode: item.hsnCode || "",
          }))
        );
      } else {
        toast.error(t("quotations.notFound"));
        router.push("/quotations");
      }
    } catch (error) {
      console.error("Failed to fetch quotation:", error);
      toast.error(t("quotations.failedToLoad"));
      router.push("/quotations");
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
        unitPrice: 0,
        discount: 0,
        gstRate: 0,
        hsnCode: "",
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
        if (value === item.productId) return item;
        const product = products.find((p) => p.id === value);
        if (product) {
          if (isLastItem) {
            shouldAddNewLine = true;
          }
          const defaultUnit = getDefaultUnit(product, product.unitConversions);

          return {
            ...item,
            productId: value as string,
            unitId: defaultUnit ? defaultUnit.unitId : (product.unitId || ""),
            conversionFactor: defaultUnit ? defaultUnit.conversionFactor : 1,
            unitPrice: defaultUnit ? defaultUnit.unitPrice : Number(product.price),
            gstRate: Number(product.gstRate) || 0,
            hsnCode: product.hsnCode || "",
          };
        }
      }

      if (field === "unitId") {
        if (value === item.unitId) return item;
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const resolved = resolveUnitPrice(Number(product.price), value as string, product.unitId!, product.unitConversions);
          return { ...item, unitId: value as string, conversionFactor: resolved.conversionFactor, unitPrice: resolved.unitPrice };
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
            unitPrice: 0,
            discount: 0,
            gstRate: 0,
            hsnCode: "",
          },
        ]);
      }, 0);
    }
  };

  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const taxMode = getQuotationTaxMode(session?.user?.gstEnabled, saudiEnabled);
  const taxEnabled = taxMode !== "none";
  const orgTaxInclusive = !!(session?.user as { isTaxInclusivePrice?: boolean } | undefined)?.isTaxInclusivePrice;
  const [taxInclusive, setTaxInclusive] = useState(orgTaxInclusive);
  useEffect(() => { setTaxInclusive(orgTaxInclusive); }, [orgTaxInclusive]);

  const { subtotal, tax, total } = useMemo(() => {
    return lineItems.reduce(
      (summary, item) => {
        if (!item.productId) return summary;
        const taxRate = getItemTaxRate(item, taxMode);
        const amounts = calculateLineAmounts({ quantity: Number(item.quantity) || 0, unitPrice: Number(item.unitPrice) || 0, discount: Number(item.discount) || 0, taxRate }, taxInclusive);
        return {
          subtotal: summary.subtotal + amounts.subtotal,
          tax: summary.tax + amounts.tax,
          total: summary.total + amounts.total,
        };
      },
      { subtotal: 0, tax: 0, total: 0 }
    );
  }, [lineItems, taxInclusive, taxMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = lineItems.filter((item) => item.productId);

    if (validItems.length === 0) {
      toast.error(t("quotations.addAtLeastOneProduct"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          issueDate: formData.issueDate,
          validUntil: formData.validUntil,
          notes: formData.notes || null,
          terms: formData.terms || null,
          branchId: formData.branchId || undefined,
          warehouseId: formData.warehouseId || undefined,
          isTaxInclusive: taxInclusive,
          items: validItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              description: product?.name || "",
              quantity: item.quantity,
              unitId: item.unitId || null,
              conversionFactor: item.conversionFactor || 1,
              unitPrice: item.unitPrice,
              discount: item.discount,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
            };
          }),
        }),
      });

      if (response.ok) {
        router.push(`/quotations/${id}`);
      } else {
        toast.error(t("quotations.failedToUpdate"));
      }
    } catch (error) {
      console.error("Failed to update quotation:", error);
      toast.error(t("quotations.failedToUpdate"));
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
          <Link href={`/quotations/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("quotations.editQuotation")}</h2>
            <p className="text-slate-500">{t("quotations.editQuotationDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("quotations.quotationDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(id) => setFormData(prev => ({ ...prev, branchId: id }))}
                  onWarehouseChange={(id) => setFormData(prev => ({ ...prev, warehouseId: id }))}
                  focusNextFocusable={focusNextFocusable}
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="customer">{t("common.customer")} *</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={formData.customerId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customerId: value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="issueDate">{t("sales.issueDate")} *</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, issueDate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="validUntil">{t("quotations.validUntil")} *</Label>
                    <Input
                      id="validUntil"
                      type="date"
                      value={formData.validUntil}
                      min={formData.issueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, validUntil: e.target.value })
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
                <CardTitle>{t("common.lineItems")}</CardTitle>
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
                        <TableHead className="w-[30%] font-semibold">{t("common.product")} *</TableHead>
                        <TableHead className="w-[10%] font-semibold">{t("common.quantity")} *</TableHead>
                        {session?.user?.multiUnitEnabled && (
                          <TableHead className="w-[12%] font-semibold">{t("common.unit")}</TableHead>
                        )}
                        <TableHead className="w-[12%] font-semibold">{t("common.unitPrice")} *</TableHead>
                        <TableHead className="w-[10%] font-semibold">{t("common.discountPercent")}</TableHead>
                        {session?.user?.gstEnabled && !saudiEnabled && <TableHead className="w-[8%] font-semibold">{t("common.gstPercent")}</TableHead>}
                        {saudiEnabled && <TableHead className="w-[8%] font-semibold">{t("common.vatPercent")}</TableHead>}
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
                        const lineAmts = calculateLineAmounts({ quantity: Number(item.quantity) || 0, unitPrice: Number(item.unitPrice) || 0, discount: Number(item.discount) || 0, taxRate: getItemTaxRate(item, taxMode) }, taxInclusive);
                        const lineAmountKey = getLineAmountKey(item.id, lineAmts.subtotal, lineAmts.total);
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
                                min="0.001"
                                step="0.001"
                                value={item.quantity}
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
                                    return getProductUnitOptions(product as { unitId: string; unit?: { name?: string; code?: string } | null }, product.unitConversions);
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
                                step="0.001"
                                value={item.unitPrice}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "unitPrice",
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
                                step="0.001"
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
                            {session?.user?.gstEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  max="100"
                                  step="0.001"
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
                                    {fmt(lineAmts.subtotal)}
                                  </span>
                                  {item.discount > 0 && (
                                    <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                  <span key={`${lineAmountKey}:net`}>
                                    {fmt(lineAmts.total)}
                                  </span>
                                  {lineAmts.tax > 0 && (
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      ({saudiEnabled ? t("common.vat") : t("common.gst")}: {fmt(lineAmts.tax)})
                                    </div>
                                  )}
                                </TableCell>
                              </>
                            ) : (
                              <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                <span key={`${lineAmountKey}:single`}>
                                  {fmt(lineAmts.total)}
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
                    const lineAmts = calculateLineAmounts({ quantity: Number(item.quantity) || 0, unitPrice: Number(item.unitPrice) || 0, discount: Number(item.discount) || 0, taxRate: getItemTaxRate(item, taxMode) }, taxInclusive);
                    const lineAmountKey = getLineAmountKey(item.id, lineAmts.subtotal, lineAmts.total);

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
                              min="0.001"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.unitPrice")} *</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.001"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.discount")} %</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              max="100"
                              step="0.001"
                              value={item.discount || ""}
                              onChange={(e) =>
                                updateLineItem(item.id, "discount", parseFloat(e.target.value) || 0)
                              }
                              placeholder="0"
                            />
                          </div>
                          {session?.user?.gstEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">{t("common.gstPercent")}</Label>
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                max="100"
                                step="0.001"
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
                                  return getProductUnitOptions(p as { unitId: string; unit?: { name?: string; code?: string } | null }, p.unitConversions);
                                })()}
                                disabled={!item.productId}
                                onSelectFocusNext={(ref) => focusNextFocusable(ref)}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end pt-1 border-t border-dashed border-slate-200">
                          <span key={`${lineAmountKey}:mobile`} className="text-sm font-semibold">
                            {fmt(lineAmts.total)}
                          </span>
                          {lineAmts.tax > 0 && taxEnabled && (
                            <span className="text-[10px] text-slate-400 ml-1">
                              ({saudiEnabled ? t("common.vat") : t("common.gst")}: {fmt(lineAmts.tax)})
                            </span>
                          )}
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
                    placeholder={t("sales.notesPlaceholder")}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="terms">{t("common.termsAndConditions")}</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData({ ...formData, terms: e.target.value })
                    }
                    placeholder={t("sales.termsPlaceholder")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("common.summary")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="ml-auto max-w-full space-y-2 sm:max-w-xs">
                  {taxInclusive && (
                    <div className="mb-2 text-left text-xs font-medium text-blue-600 sm:text-right">{t("common.pricesIncludeTax")}</div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>{t("common.subtotal")}</span>
                    <span key={`summary-subtotal:${subtotal.toFixed(2)}`}>{symbol}{subtotal.toLocaleString(locale)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{t("common.gst")}</span>
                      <span key={`summary-tax:${tax.toFixed(2)}`}>{symbol}{tax.toLocaleString(locale)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>{t("common.total")}</span>
                    <span key={`summary-total:${total.toFixed(2)}`}>{symbol}{total.toLocaleString(locale)}</span>
                  </div>
                </div>
                <div className="mt-6 hidden gap-3 sm:flex sm:justify-end">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting || !formData.customerId || !formData.issueDate || !formData.validUntil || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? t("common.updating") : t("quotations.updateQuotation")}
                  </Button>
                </div>
                <StickyBottomBar>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || !formData.customerId || !formData.issueDate || !formData.validUntil || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? t("common.updating") : t("quotations.updateQuotation")}
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
