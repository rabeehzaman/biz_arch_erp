"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomerCombobox } from "@/components/invoices/customer-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { getProductUnitOptions, resolveUnitPrice, getDefaultUnit } from "@/lib/unit-utils";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { useJewelleryRates } from "@/hooks/use-jewellery-rates";
import { JewelleryLineFields, createJewelleryLineState, type JewelleryLineState, type JewelleryItemData } from "@/components/jewellery-shop/jewellery-line-fields";
import { calculateJewelleryLinePrice } from "@/lib/jewellery/client-pricing";
import { useFormConfig } from "@/hooks/use-form-config";

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
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
  unitPrice: number;
  discount: number;
  jewellery?: JewelleryLineState | null;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function NewCreditNotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const { isFieldHidden, isColumnHidden, getDefault } = useFormConfig("creditNote");
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = useState(getDefault("reason", ""));
  const [notes, setNotes] = useState(getDefault("notes", ""));
  const [branchId, setBranchId] = useState(getDefault("branchId", ""));
  const [warehouseId, setWarehouseId] = useState(getDefault("warehouseId", ""));
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: Date.now().toString(),
      productId: "",
      description: "",
      quantity: 1,
      unitId: "",
      conversionFactor: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);
  const { data: session } = useSession();
  const { symbol } = useCurrency();
  const { t } = useLanguage();
  const jewelleryEnabled = !!(session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled;
  const { getRate: getGoldRate } = useJewelleryRates(jewelleryEnabled);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchProducts();
    // Product options are refreshed from the selected warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

  // Pre-fill form when duplicating an existing credit note
  useEffect(() => {
    if (!duplicateId) return;
    const fetchDuplicate = async () => {
      try {
        const response = await fetch(`/api/credit-notes/${duplicateId}`);
        if (!response.ok) return;
        const data = await response.json();
        setCustomerId(data.customer?.id || "");
        setIssueDate(new Date().toISOString().split("T")[0]);
        setReason(data.reason || "");
        setNotes(data.notes || "");
        setBranchId(data.branch?.id || "");
        setWarehouseId(data.warehouse?.id || "");
        if (data.items && data.items.length > 0) {
          setLineItems(
            data.items.map((item: any, idx: number) => ({
              id: `dup-${idx}`,
              productId: item.product?.id || item.productId || "",
              description: item.description || "",
              quantity: Number(item.quantity) || 1,
              unitId: item.unitId || "",
              conversionFactor: item.conversionFactor || 1,
              unitPrice: Number(item.unitPrice) || 0,
              discount: Number(item.discount) || 0,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch credit note for duplication:", error);
      }
    };
    fetchDuplicate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateId]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers?compact=true");
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchProducts = async () => {
    try {
      const url = warehouseId ? `/api/products?warehouseId=${warehouseId}&compact=true` : "/api/products?compact=true";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const updateLineItem = (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== id) return item;

        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          if (product) {
            // Check if this product is jewellery-linked
            let jewellery: JewelleryLineState | null = null;
            let unitPrice = Number(product.price);

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
              unitPrice = pricing.subtotal;
            }

            const defaultUnit = getDefaultUnit(product, product.unitConversions);

            return {
              ...item,
              productId: value as string,
              description: product.name,
              unitId: defaultUnit ? defaultUnit.unitId : (product.unitId || ""),
              conversionFactor: defaultUnit ? defaultUnit.conversionFactor : 1,
              unitPrice: defaultUnit ? defaultUnit.unitPrice : unitPrice,
              jewellery,
            };
          }
          return { ...item, productId: value as string, description: "", unitPrice: 0, jewellery: null };
        }

        if (field === "unitId") {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            const resolved = resolveUnitPrice(Number(product.price), value as string, product.unitId!, product.unitConversions);
            return { ...item, unitId: value as string, conversionFactor: resolved.conversionFactor, unitPrice: resolved.unitPrice };
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const addLineItem = (focusNewProduct: boolean = false) => {
    const newId = Date.now().toString();
    setLineItems([
      ...lineItems,
      {
        id: newId,
        productId: "",
        description: "",
        quantity: 1,
        unitId: "",
        conversionFactor: 1,
        unitPrice: 0,
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

  const removeItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id));
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      if (!item.productId) return sum;
      return (
        sum + item.quantity * item.unitPrice * (1 - item.discount / 100)
      );
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const total = calculateTotal();

  const updateJewelleryField = (lineItemId: string, field: keyof JewelleryLineState, value: string | number) => {
    setLineItems((prev) =>
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
        return { ...item, jewellery: updated, unitPrice: pricing.subtotal };
      })
    );
  };

  const fmt = (n: number) => `${symbol}${n.toFixed(2)}`;

  const focusQuantity = (itemId: string) => {
    const quantityInput = quantityRefs.current.get(itemId);
    if (quantityInput) {
      quantityInput.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error(t("common.pleaseSelectCustomer"));
      return;
    }

    const validItems = lineItems.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error(t("common.pleaseAddAtLeastOneItem"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          invoiceId: invoiceId || null,
          issueDate,
          items: validItems.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitId: item.unitId || null,
            conversionFactor: item.conversionFactor || 1,
            unitPrice: item.unitPrice,
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
          branchId: branchId || undefined,
          warehouseId: warehouseId || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create credit note");
      }

      const data = await response.json();
      toast.success(t("creditNotes.creditNoteCreated"));
      router.push(`/credit-notes/${data.id}`);
    } catch (error: any) {
      toast.error(error.message);
      console.error("Failed to create credit note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/credit-notes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("creditNotes.newCreditNote")}
            </h2>
            <p className="text-slate-500">{t("creditNotes.newCreditNoteDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("creditNotes.creditNoteDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BranchWarehouseSelector
                branchId={branchId}
                warehouseId={warehouseId}
                onBranchChange={setBranchId}
                onWarehouseChange={setWarehouseId}
                focusNextFocusable={focusNextFocusable}
              />
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">{t("common.customer")} *</Label>
                  <CustomerCombobox
                    customers={customers}
                    value={customerId}
                    onValueChange={setCustomerId}
                    onCustomerCreated={(c) => {
                      setCustomers((prev) => [...prev, c]);
                    }}
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

                {!isFieldHidden("invoiceId") && (
                <div className="space-y-2">
                  <Label htmlFor="invoiceId">{t("creditNotes.originalInvoice")} ({t("common.optional")})</Label>
                  <Input
                    id="invoiceId"
                    placeholder={t("creditNotes.invoicePlaceholder")}
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  />
                </div>
                )}

                {!isFieldHidden("reason") && (
                <div className="space-y-2">
                  <Label htmlFor="reason">{t("creditNotes.reasonForReturn")}</Label>
                  <Input
                    id="reason"
                    placeholder={t("creditNotes.reasonPlaceholder")}
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
                {lineItems.map((item, index) => {
                  const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
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
                            onValueChange={(value) =>
                              updateLineItem(item.id, "productId", value)
                            }
                            onProductCreated={fetchProducts}
                            onSelect={() => focusQuantity(item.id)}
                            onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
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
                          <Label className="sm:hidden text-xs text-slate-500">{t("common.unitPrice")} *</Label>
                          <Input
                            type="number"
                            onFocus={(e) => e.target.select()}
                            placeholder={t("common.unitPrice")}
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                            }
                            min="0"
                            step="0.001"
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

                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={lineItems.length === 1}
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
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("common.total")}:</span>
                  <span key={`summary-total:${total.toFixed(2)}`}>{symbol}{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="hidden gap-4 sm:flex sm:justify-end">
            <Link href="/credit-notes">
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.creating") : t("creditNotes.createCreditNote")}
            </Button>
          </div>
          <StickyBottomBar>
            <Link href="/credit-notes" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t("common.creating") : t("creditNotes.createCreditNote")}
            </Button>
          </StickyBottomBar>
        </form>
      </div>
    </PageAnimation>
  );
}
