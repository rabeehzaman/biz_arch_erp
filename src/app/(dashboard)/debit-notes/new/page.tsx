"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { getProductUnitOptions, resolveUnitPrice, getDefaultUnit } from "@/lib/unit-utils";
import { useCurrency } from "@/hooks/use-currency";
import { Switch } from "@/components/ui/switch";
import { useRoundOffSettings } from "@/hooks/use-round-off-settings";
import { calculateRoundOff } from "@/lib/round-off";
import { useLanguage } from "@/lib/i18n";
import { useJewelleryRates } from "@/hooks/use-jewellery-rates";
import { JewelleryLineFields, createJewelleryLineState, type JewelleryLineState, type JewelleryItemData } from "@/components/jewellery-shop/jewellery-line-fields";
import { calculateJewelleryLinePrice } from "@/lib/jewellery/client-pricing";
import { useFormConfig } from "@/hooks/use-form-config";

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
  sku: string | null;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  unitConversions?: any[];
  jewelleryItem?: JewelleryItemData | null;
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
  jewellery?: JewelleryLineState | null;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function NewDebitNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const { isFieldHidden, isColumnHidden, getDefault } = useFormConfig("debitNote");
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState(getDefault("reason", ""));
  const [notes, setNotes] = useState(getDefault("notes", ""));
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
    },
  ]);
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const [applyRoundOff, setApplyRoundOff] = useState(false);
  const { t } = useLanguage();
  const jewelleryEnabled = !!(session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled;
  const { getRate: getGoldRate } = useJewelleryRates(jewelleryEnabled);

  useEffect(() => {
    setApplyRoundOff(roundOffEnabled);
  }, [roundOffEnabled]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  // Pre-fill form when duplicating an existing debit note
  useEffect(() => {
    if (!duplicateId) return;
    const fetchDuplicate = async () => {
      try {
        const response = await fetch(`/api/debit-notes/${duplicateId}`);
        if (!response.ok) return;
        const data = await response.json();
        setSupplierId(data.supplier?.id || "");
        setIssueDate(new Date().toISOString().split("T")[0]);
        setReason(data.reason || "");
        setNotes(data.notes || "");
        if (data.items && data.items.length > 0) {
          setItems(
            data.items.map((item: any, idx: number) => ({
              id: `dup-${idx}`,
              productId: item.product?.id || item.productId || "",
              description: item.description || "",
              quantity: Number(item.quantity) || 1,
              unitId: item.unitId || "",
              conversionFactor: item.conversionFactor || 1,
              unitCost: Number(item.unitCost) || 0,
              discount: Number(item.discount) || 0,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch debit note for duplication:", error);
      }
    };
    fetchDuplicate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateId]);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers?compact=true");
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch("/api/products?compact=true");
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const focusQuantity = (itemId: string) => {
    const quantityInput = quantityRefs.current.get(itemId);
    if (quantityInput) {
      quantityInput.focus();
    }
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // Check if this product is jewellery-linked
    let jewellery: JewelleryLineState | null = null;
    let unitCost = product.cost;

    if (jewelleryEnabled && product.jewelleryItem) {
      const ji = product.jewelleryItem;
      const rate = getGoldRate(ji.purity, ji.metalType);
      jewellery = createJewelleryLineState(ji, rate);
      const pricing = calculateJewelleryLinePrice({
        grossWeight: Number(ji.grossWeight),
        stoneWeight: Number(ji.stoneWeight) || 0,
        purity: ji.purity,
        metalType: ji.metalType,
        goldRate: rate,
        wastagePercent: Number(ji.wastagePercent),
        makingChargeType: ji.makingChargeType as "PER_GRAM" | "PERCENTAGE" | "FIXED",
        makingChargeValue: Number(ji.makingChargeValue),
        stoneValue: Number(ji.stoneValue),
      });
      unitCost = pricing.subtotal;
    }

    const baseCostForDefault = Number(product.cost) || Number(product.price);
    const defaultUnit = getDefaultUnit(product, product.unitConversions, { basePrice: baseCostForDefault });

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? {
            ...item,
            productId,
            description: product.name,
            unitId: defaultUnit ? defaultUnit.unitId : (product.unitId || ""),
            conversionFactor: defaultUnit ? defaultUnit.conversionFactor : 1,
            unitCost: defaultUnit ? defaultUnit.unitPrice : unitCost,
            gstRate: (product as any).gstRate || 0,
            hsnCode: (product as any).hsnCode || (jewellery ? "7113" : ""),
            jewellery,
          }
          : item
      )
    );

    // Auto-add new line if this is the last item
    const isLastItem = items[items.length - 1].id === itemId;
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
            const resolved = resolveUnitPrice(Number(product.cost) || Number(product.price), value as string, product.unitId!, product.unitConversions, { ignoreOverridePrice: true });
            return { ...item, unitId: value as string, conversionFactor: resolved.conversionFactor, unitCost: resolved.unitPrice };
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const addLineItem = (focusNewProduct: boolean = false) => {
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

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      if (!item.productId) return sum;
      return (
        sum + item.quantity * item.unitCost * (1 - item.discount / 100)
      );
    }, 0);
  };

  const calculateTax = () => {
    return items.reduce((sum, item) => {
      if (!item.productId) return sum;
      const lineTotal = item.quantity * item.unitCost * (1 - item.discount / 100);
      return sum + (lineTotal * ((item as any).gstRate || 0)) / 100;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const updateJewelleryField = (lineItemId: string, field: keyof JewelleryLineState, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== lineItemId || !item.jewellery) return item;
        const updated = { ...item.jewellery, [field]: value };
        const pricing = calculateJewelleryLinePrice({
          grossWeight: updated.grossWeight,
          stoneWeight: updated.stoneWeight || 0,
          purity: updated.purity,
          metalType: updated.metalType,
          goldRate: updated.goldRate,
          wastagePercent: updated.wastagePercent,
          makingChargeType: updated.makingChargeType,
          makingChargeValue: updated.makingChargeValue,
          stoneValue: updated.stoneValue,
        });
        return { ...item, jewellery: updated, unitCost: pricing.subtotal };
      })
    );
  };

  const fmt = (n: number) => `${symbol}${n.toFixed(2)}`;

  const subtotal = calculateSubtotal();
  const tax = calculateTax();
  const total = calculateTotal();
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
      const response = await fetch("/api/debit-notes", {
        method: "POST",
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
            gstRate: (item as any).gstRate || 0,
            hsnCode: (item as any).hsnCode || null,
            ...(item.jewellery && {
              jewellery: {
                jewelleryItemId: item.jewellery.jewelleryItemId,
                goldRate: item.jewellery.goldRate,
                purity: item.jewellery.purity,
                metalType: item.jewellery.metalType,
                grossWeight: item.jewellery.grossWeight,
                stoneWeight: item.jewellery.stoneWeight,
                wastagePercent: item.jewellery.wastagePercent,
                makingChargeType: item.jewellery.makingChargeType,
                makingChargeValue: item.jewellery.makingChargeValue,
                stoneValue: item.jewellery.stoneValue,
                tagNumber: item.jewellery.tagNumber,
                huidNumber: item.jewellery.huidNumber,
              },
            }),
          })),
          reason: reason || null,
          notes: notes || null,
          applyRoundOff,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create debit note");
      }

      const data = await response.json();
      router.push(`/debit-notes/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
      console.error("Failed to create debit note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/debit-notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("debitNotes.newDebitNote")}
            </h2>
            <p className="text-slate-500">{t("debitNotes.newDebitNoteDesc")}</p>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <strong>{t("debitNotes.stockValidation")}:</strong> {t("debitNotes.stockValidationNewDesc")}
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
                    onSelectFocusNext={(triggerRef: any) => focusNextFocusable(triggerRef)}
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

                {!isFieldHidden("purchaseInvoiceId") && (
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
                )}

                {!isFieldHidden("reason") && (
                <div className="space-y-2">
                  <Label htmlFor="reason">{t("debitNotes.reasonForReturn")}</Label>
                  <Input
                    id="reason"
                    placeholder={t("debitNotes.reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("sales.items")}</CardTitle>
                <Button type="button" onClick={() => addLineItem(true)} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("common.addItem")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item, index) => {
                  const lineTotal = item.quantity * item.unitCost * (1 - item.discount / 100);
                  const lineAmountKey = getLineAmountKey(item.id, lineTotal);
                  return (
                  <div key={item.id} className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <div className="sm:col-span-5">
                        <Label>{t("common.product")} *</Label>
                        <div ref={(el) => {
                          if (el) {
                            const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                            if (button) productComboRefs.current.set(item.id, button);
                          } else {
                            productComboRefs.current.delete(item.id);
                          }
                        }}>
                          <ProductCombobox
                            products={products as any}
                            value={item.productId}
                            onValueChange={(value: string) =>
                              handleProductSelect(item.id, value)
                            }
                            onProductCreated={fetchProducts}
                            onSelect={() => focusQuantity(item.id)}
                            onSelectFocusNext={(triggerRef: any) => focusNextFocusable(triggerRef)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:contents gap-2">
                        <div className="space-y-1">
                          <Label className="sm:hidden text-xs text-slate-500">{t("common.quantity")} *</Label>
                          <Input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            placeholder={t("common.qty")}
                            value={item.quantity}
                            onChange={(e) =>
                              updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
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

                        {session?.user?.multiUnitEnabled && !isColumnHidden("unit") && (
                          <div className="space-y-1">
                            <Label className="sm:hidden text-xs text-slate-500">{t("common.unit")}</Label>
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
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="sm:hidden text-xs text-slate-500">{t("common.unitCost")} *</Label>
                          <Input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            placeholder={t("common.unitCost")}
                            value={item.unitCost}
                            onChange={(e) =>
                              updateLineItem(item.id, "unitCost", parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="0.001"
                            required
                          />
                        </div>

                        {!isColumnHidden("discount") && (
                        <div className="space-y-1">
                          <Label className="sm:hidden text-xs text-slate-500">{t("common.discount")} %</Label>
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
                              if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                const isLastItem = index === items.length - 1;
                                if (isLastItem) {
                                  addLineItem(true);
                                } else {
                                  const nextItemId = items[index + 1].id;
                                  const nextProductTrigger = productComboRefs.current.get(nextItemId);
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
                        )}
                      </div>

                      <div className="flex items-center justify-end">
                        <span key={`${lineAmountKey}:line`} className="text-sm font-medium">
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
                  {item.jewellery && (
                    <JewelleryLineFields
                      jewelleryData={item.jewellery}
                      goldRate={getGoldRate(item.jewellery.purity, item.jewellery.metalType)}
                      onUpdate={(field, value) => updateJewelleryField(item.id, field, value)}
                      fmt={fmt}
                    />
                  )}
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>

          {!isFieldHidden("notes") && (
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
          )}

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
                  <span key={`summary-subtotal:${subtotal.toFixed(2)}`}>{symbol}{subtotal.toFixed(2)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{t("common.gst")}:</span>
                    <span key={`summary-tax:${tax.toFixed(2)}`}>{symbol}{tax.toFixed(2)}</span>
                  </div>
                )}
                {applyRoundOff && roundOffAmount !== 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{t("common.roundOff")}:</span>
                    <span key={`summary-roundoff:${roundOffAmount.toFixed(2)}`}>
                      {roundOffAmount >= 0 ? "+" : ""}
                      {symbol}{roundOffAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>{t("common.total")}:</span>
                  <span key={`summary-total:${roundedTotal.toFixed(2)}`}>{symbol}{roundedTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden gap-4 sm:flex sm:justify-end">
            <Link href="/debit-notes">
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.creating") : t("debitNotes.createDebitNote")}
            </Button>
          </div>
          <StickyBottomBar>
            <Link href="/debit-notes" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t("common.creating") : t("debitNotes.createDebitNote")}
            </Button>
          </StickyBottomBar>
        </form>
      </div>
    </PageAnimation>
  );
}
