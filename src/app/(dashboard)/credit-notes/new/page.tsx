"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { useUnitConversions } from "@/hooks/use-unit-conversions";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useCurrency } from "@/hooks/use-currency";
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
  unitPrice: number;
  discount: number;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function NewCreditNotePage() {
  const router = useRouter();
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
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [branchId, setBranchId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
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
  const { unitConversions } = useUnitConversions();
  const { symbol } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchProducts();
    // Product options are refreshed from the selected warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId]);

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
            return {
              ...item,
              productId: value as string,
              description: product.name,
              unitId: product.unitId || "",
              conversionFactor: 1,
              unitPrice: Number(product.price),
            };
          }
          return { ...item, productId: value as string, description: "", unitPrice: 0 };
        }

        if (field === "unitId") {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            if (value === product.unitId) {
              return {
                ...item,
                unitId: value as string,
                conversionFactor: 1,
                unitPrice: Number(product.price),
              };
            }
            const altConversion = unitConversions.find(uc => uc.toUnitId === product.unitId && uc.fromUnitId === value);
            if (altConversion) {
              return {
                ...item,
                unitId: value as string,
                conversionFactor: Number(altConversion.conversionFactor),
                unitPrice: Number(product.price) * Number(altConversion.conversionFactor),
              };
            }
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

                <div className="space-y-2">
                  <Label htmlFor="invoiceId">{t("creditNotes.originalInvoice")} ({t("common.optional")})</Label>
                  <Input
                    id="invoiceId"
                    placeholder={t("creditNotes.invoicePlaceholder")}
                    value={invoiceId}
                    onChange={(e) => setInvoiceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">{t("creditNotes.reasonForReturn")}</Label>
                  <Input
                    id="reason"
                    placeholder={t("creditNotes.reasonPlaceholder")}
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
                  <div key={item.id} className="flex gap-2 items-start">
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
                            step="0.01"
                            ref={(el) => {
                              if (el) quantityRefs.current.set(item.id, el);
                              else quantityRefs.current.delete(item.id);
                            }}
                          />
                        </div>

                        {session?.user?.multiUnitEnabled && (
                          <div className="space-y-1">
                            <Label className="sm:hidden text-xs text-slate-500">{t("common.unit")}</Label>
                            <ItemUnitSelect
                              value={item.unitId}
                              onValueChange={(value) => updateLineItem(item.id, "unitId", value)}
                              options={(() => {
                                const product = products.find((p) => p.id === item.productId);
                                if (!product) return [];
                                const baseOption = { id: product.unitId!, name: product.unit?.name || product.unit?.code || t("sales.baseUnit"), conversionFactor: 1 };
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
                            step="0.01"
                          />
                        </div>

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
                            step="0.01"
                          />
                        </div>
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
                )})}
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
                <div className="flex justify-between text-lg font-bold">
                  <span>{t("common.total")}:</span>
                  <span key={`summary-total:${total.toFixed(2)}`}>{symbol}{total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/credit-notes">
              <Button type="button" variant="outline">
                {t("common.cancel")}
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.creating") : t("creditNotes.createCreditNote")}
            </Button>
          </div>
        </form>
      </div>
    </PageAnimation>
  );
}
