"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useUnitConversions } from "@/hooks/use-unit-conversions";
import { useCurrency } from "@/hooks/use-currency";
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
  cost: number;
  sku: string | null;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
}

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitId: string;
  conversionFactor: number;
  unitCost: number;
  discount: number;
  gstRate: number;
  hsnCode: string;
}

interface DebitNoteResponse {
  id: string;
  supplier: { id: string };
  purchaseInvoice: { id: string } | null;
  issueDate: string;
  reason: string | null;
  notes: string | null;
  applyRoundOff: boolean;
  items: Array<{
    id: string;
    description: string;
    quantity: number | string;
    unitId: string | null;
    conversionFactor: number | string;
    unitCost: number | string;
    discount: number | string;
    gstRate: number | string | null;
    hsnCode: string | null;
    product: { id: string } | null;
  }>;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function EditDebitNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const { unitConversions } = useUnitConversions();
  const { symbol } = useCurrency();
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const { t } = useLanguage();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [applyRoundOff, setApplyRoundOff] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: "",
      description: "",
      quantity: 1,
      unitId: "",
      conversionFactor: 1,
      unitCost: 0,
      discount: 0,
      gstRate: 0,
      hsnCode: "",
    },
  ]);

  useEffect(() => {
    void fetchSuppliers();
    void fetchProducts();
    void fetchDebitNote();
    // Route param is the only dependency for initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers?compact=true");
      if (!response.ok) return;
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products?compact=true");
      if (!response.ok) return;
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const fetchDebitNote = async () => {
    try {
      const response = await fetch(`/api/debit-notes/${id}`);
      if (!response.ok) {
        toast.error(t("debitNotes.notFound"));
        router.push("/debit-notes");
        return;
      }

      const data: DebitNoteResponse = await response.json();
      setSupplierId(data.supplier.id);
      setPurchaseInvoiceId(data.purchaseInvoice?.id || "");
      setIssueDate(data.issueDate.split("T")[0]);
      setReason(data.reason || "");
      setNotes(data.notes || "");
      setApplyRoundOff(Boolean(data.applyRoundOff));
      setItems(
        data.items.length > 0
          ? data.items.map((item) => ({
              id: item.id,
              productId: item.product?.id || "",
              description: item.description,
              quantity: Number(item.quantity),
              unitId: item.unitId || "",
              conversionFactor: Number(item.conversionFactor) || 1,
              unitCost: Number(item.unitCost),
              discount: Number(item.discount),
              gstRate: Number(item.gstRate) || 0,
              hsnCode: item.hsnCode || "",
            }))
          : [
              {
                id: crypto.randomUUID(),
                productId: "",
                description: "",
                quantity: 1,
                unitId: "",
                conversionFactor: 1,
                unitCost: 0,
                discount: 0,
                gstRate: 0,
                hsnCode: "",
              },
            ]
      );
    } catch (error) {
      console.error("Failed to fetch debit note:", error);
      toast.error(t("debitNotes.failedToLoad"));
      router.push("/debit-notes");
    } finally {
      setIsLoading(false);
    }
  };

  const focusQuantity = (itemId: string) => {
    const quantityInput = quantityRefs.current.get(itemId);
    if (quantityInput) {
      quantityInput.focus();
      quantityInput.select();
    }
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              productId,
              description: product.name,
              unitId: product.unitId || "",
              conversionFactor: 1,
              unitCost: product.cost,
            }
          : item
      )
    );

    const isLastItem = items[items.length - 1]?.id === itemId;
    if (isLastItem) {
      addLineItem(true);
    } else {
      focusQuantity(itemId);
    }
  };

  const updateLineItem = (
    itemId: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        if (field === "unitId") {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            if (value === product.unitId) {
              return {
                ...item,
                unitId: value as string,
                conversionFactor: 1,
                unitCost: Number(product.cost),
              };
            }
            const altConversion = unitConversions.find(
              (conversion) =>
                conversion.toUnitId === product.unitId &&
                conversion.fromUnitId === value
            );
            if (altConversion) {
              return {
                ...item,
                unitId: value as string,
                conversionFactor: Number(altConversion.conversionFactor),
                unitCost:
                  Number(product.cost) *
                  Number(altConversion.conversionFactor),
              };
            }
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const addLineItem = (focusNewProduct = false) => {
    const newId = crypto.randomUUID();
    setItems((prevItems) => [
      ...prevItems,
      {
        id: newId,
        productId: "",
        description: "",
        quantity: 1,
        unitId: "",
        conversionFactor: 1,
        unitCost: 0,
        discount: 0,
        gstRate: 0,
        hsnCode: "",
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
  };

  const removeItem = (idToRemove: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== idToRemove));
    }
  };

  const calculateSubtotal = () =>
    items.reduce((sum, item) => {
      if (!item.productId) return sum;
      return sum + item.quantity * item.unitCost * (1 - item.discount / 100);
    }, 0);

  const calculateTax = () =>
    items.reduce((sum, item) => {
      if (!item.productId) return sum;
      const lineTotal =
        item.quantity * item.unitCost * (1 - item.discount / 100);
      return sum + (lineTotal * (item.gstRate || 0)) / 100;
    }, 0);

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const total = subtotal + tax;
  const { roundOffAmount, roundedTotal } = calculateRoundOff(
    total,
    roundOffMode,
    applyRoundOff
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error(t("common.pleaseSelectSupplier"));
      return;
    }

    const validItems = items.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error(t("common.pleaseAddAtLeastOneItem"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/debit-notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          purchaseInvoiceId: purchaseInvoiceId || null,
          issueDate,
          items: validItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitId: item.unitId || null,
            conversionFactor: item.conversionFactor || 1,
            unitCost: item.unitCost,
            discount: item.discount,
            gstRate: item.gstRate || 0,
            hsnCode: item.hsnCode || null,
          })),
          reason: reason || null,
          notes: notes || null,
          applyRoundOff,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update debit note");
      }

      toast.success(t("debitNotes.debitNoteUpdated"));
      router.push(`/debit-notes/${id}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update debit note";
      toast.error(message);
      console.error("Failed to update debit note:", error);
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
        <div className="flex items-center gap-4">
          <Link href={`/debit-notes/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("debitNotes.editDebitNote")}
            </h2>
            <p className="text-slate-500">{t("debitNotes.editDesc")}</p>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
          <div className="text-sm text-orange-800">
            <strong>{t("debitNotes.stockValidation")}:</strong> {t("debitNotes.stockValidationEditDesc")}
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("debitNotes.debitNoteDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier">{t("common.supplier")} *</Label>
                  <SupplierCombobox
                    suppliers={suppliers}
                    value={supplierId}
                    onValueChange={setSupplierId}
                    onSupplierCreated={fetchSuppliers}
                    required
                    autoFocus
                    onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issueDate">{t("sales.issueDate")}</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="purchaseInvoiceId">
                    {t("debitNotes.originalPurchaseInvoice")} ({t("common.optional")})
                  </Label>
                  <Input
                    id="purchaseInvoiceId"
                    placeholder={t("debitNotes.purchaseInvoicePlaceholder")}
                    value={purchaseInvoiceId}
                    onChange={(e) => setPurchaseInvoiceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">{t("debitNotes.reasonForReturn")}</Label>
                  <Input
                    id="reason"
                    placeholder={t("debitNotes.reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("sales.items")}</CardTitle>
                <Button
                  type="button"
                  onClick={() => addLineItem(true)}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("common.addItem")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineTotal =
                    item.quantity * item.unitCost * (1 - item.discount / 100);
                  const lineAmountKey = getLineAmountKey(item.id, lineTotal);
                  return (
                    <div key={item.id} className="flex items-start gap-2">
                      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-5">
                        <div className="sm:col-span-5">
                          <Label>{t("common.product")} *</Label>
                          <div
                            ref={(el) => {
                              if (el) {
                                const button = el.querySelector(
                                  'button[role="combobox"]'
                                ) as HTMLButtonElement | null;
                                if (button) {
                                  productComboRefs.current.set(item.id, button);
                                }
                              } else {
                                productComboRefs.current.delete(item.id);
                              }
                            }}
                          >
                            <ProductCombobox
                              products={products as never[]}
                              value={item.productId}
                              onValueChange={(value: string) =>
                                handleProductSelect(item.id, value)
                              }
                              onProductCreated={fetchProducts}
                              onSelect={() => focusQuantity(item.id)}
                              onSelectFocusNext={(triggerRef) =>
                                focusNextFocusable(triggerRef)
                              }
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:contents">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 sm:hidden">
                              {t("common.quantity")} *
                            </Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              placeholder={t("common.qty")}
                              value={item.quantity}
                              onChange={(e) =>
                                updateLineItem(
                                  item.id,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              step="0.001"
                              required
                              ref={(el) => {
                                if (el) quantityRefs.current.set(item.id, el);
                                else quantityRefs.current.delete(item.id);
                              }}
                            />
                          </div>

                          {session?.user?.multiUnitEnabled && (
                            <div className="space-y-1">
                              <Label className="text-xs text-slate-500 sm:hidden">
                                {t("common.unit")}
                              </Label>
                              <ItemUnitSelect
                                value={item.unitId}
                                onValueChange={(value) =>
                                  updateLineItem(item.id, "unitId", value)
                                }
                                options={(() => {
                                  const product = products.find(
                                    (productOption) =>
                                      productOption.id === item.productId
                                  );
                                  if (!product) return [];
                                  const baseOption = {
                                    id: product.unitId!,
                                    name:
                                      product.unit?.name ||
                                      product.unit?.code ||
                                      t("sales.baseUnit"),
                                    conversionFactor: 1,
                                  };
                                  const alternateOptions = unitConversions
                                    .filter(
                                      (conversion) =>
                                        conversion.toUnitId === product.unitId
                                    )
                                    .map((conversion) => ({
                                      id: conversion.fromUnitId,
                                      name: conversion.fromUnit.name,
                                      conversionFactor: Number(
                                        conversion.conversionFactor
                                      ),
                                    }));
                                  return [baseOption, ...alternateOptions];
                                })()}
                                disabled={!item.productId}
                                onSelectFocusNext={(ref) =>
                                  focusNextFocusable(ref)
                                }
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 sm:hidden">
                              {t("common.unitCost")} *
                            </Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              placeholder={t("common.unitCost")}
                              value={item.unitCost}
                              onChange={(e) =>
                                updateLineItem(
                                  item.id,
                                  "unitCost",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              min="0"
                              step="0.001"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 sm:hidden">
                              {t("common.discount")} %
                            </Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              placeholder={t("common.discountPercent")}
                              value={item.discount || ""}
                              onChange={(e) =>
                                updateLineItem(
                                  item.id,
                                  "discount",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  !e.ctrlKey &&
                                  !e.metaKey &&
                                  !e.altKey &&
                                  !e.shiftKey
                                ) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const isLastItem =
                                    index === items.length - 1;
                                  if (isLastItem) {
                                    addLineItem(true);
                                  } else {
                                    const nextItemId = items[index + 1]?.id;
                                    const nextProductTrigger =
                                      productComboRefs.current.get(nextItemId);
                                    if (nextProductTrigger) {
                                      nextProductTrigger.focus();
                                    }
                                  }
                                }
                              }}
                              min="0"
                              max="100"
                              step="0.001"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <span
                            key={`${lineAmountKey}:line`}
                            className="text-sm font-medium"
                          >
                            {symbol}
                            {lineTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
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
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">{t("common.notes")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("common.additionalNotesPlaceholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("common.summary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{t("common.applyRoundOff")}</p>
                    <p className="text-xs text-slate-500">
                      {roundOffEnabled
                        ? t("common.roundOffEnabledDesc")
                        : t("common.roundOffDisabledDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={applyRoundOff}
                    onCheckedChange={setApplyRoundOff}
                    disabled={!roundOffEnabled}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t("common.subtotal")}:</span>
                  <span key={`summary-subtotal:${subtotal.toFixed(2)}`}>
                    {symbol}
                    {subtotal.toFixed(2)}
                  </span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{t("common.gst")}:</span>
                    <span key={`summary-tax:${tax.toFixed(2)}`}>
                      {symbol}
                      {tax.toFixed(2)}
                    </span>
                  </div>
                )}
                {applyRoundOff && roundOffAmount !== 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{t("common.roundOff")}:</span>
                    <span key={`summary-roundoff:${roundOffAmount.toFixed(2)}`}>
                      {roundOffAmount >= 0 ? "+" : ""}
                      {symbol}
                      {roundOffAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>{t("common.total")}:</span>
                  <span key={`summary-total:${roundedTotal.toFixed(2)}`}>
                    {symbol}
                    {roundedTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden gap-4 sm:flex sm:justify-end">
            <Link href={`/debit-notes/${id}`}>
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.updating") : t("debitNotes.updateDebitNote")}
            </Button>
          </div>
          <StickyBottomBar>
            <Link href={`/debit-notes/${id}`} className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t("common.updating") : t("debitNotes.updateDebitNote")}
            </Button>
          </StickyBottomBar>
        </form>
      </div>
    </PageAnimation>
  );
}
