"use client";

import { useState, useEffect, useRef, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Scale, History } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CustomerCombobox } from "@/components/invoices/customer-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { useUnitConversions } from "@/hooks/use-unit-conversions";
import { BranchWarehouseSelector } from "@/components/inventory/branch-warehouse-selector";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { parseWeightBarcode, WeighMachineConfig } from "@/lib/weigh-machine/barcode-parser";
import { useCurrency } from "@/hooks/use-currency";
import { Switch } from "@/components/ui/switch";
import { useRoundOffSettings } from "@/hooks/use-round-off-settings";
import { calculateRoundOff } from "@/lib/round-off";
import { createClientId } from "@/lib/client-id";
import { useLanguage } from "@/lib/i18n";
import { PriceHistoryDialog } from "@/components/invoices/price-history-dialog";

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost?: number;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  isService?: boolean;
  availableStock?: number;
  gstRate?: number;
  hsnCode?: string;
  weighMachineCode?: string | null;
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
  vatRate: number;
}

function getLineAmountKey(itemId: string, ...amounts: number[]) {
  return `${itemId}:${amounts.map((amount) => amount.toFixed(2)).join(":")}`;
}

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { data: session } = useSession();
  const { symbol, locale, fmt } = useCurrency();
  const { unitConversions } = useUnitConversions();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    customerId: "",
    date: "",
    dueDate: "",
    notes: "",
    terms: "",
    branchId: "",
    warehouseId: "",
    paymentType: "CASH",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [priceHistoryItem, setPriceHistoryItem] = useState<{ productId: string; productName: string } | null>(null);
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const [applyRoundOff, setApplyRoundOff] = useState(false);

  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const paymentTypeRef = useRef<HTMLButtonElement>(null);
  const taxInclusiveRef = useRef<HTMLButtonElement>(null);
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const focusQuantity = useCallback((itemId: string) => {
    const input = quantityRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  const weighMachineEnabled = !!(session?.user as { isWeighMachineEnabled?: boolean })?.isWeighMachineEnabled;
  const weighMachineConfig = useMemo<WeighMachineConfig>(() => ({
    prefix: (session?.user as { weighMachineBarcodePrefix?: string | null })?.weighMachineBarcodePrefix ?? "77",
    productCodeLen: (session?.user as { weighMachineProductCodeLen?: number | null })?.weighMachineProductCodeLen ?? 5,
    weightDigits: (session?.user as { weighMachineWeightDigits?: number | null })?.weighMachineWeightDigits ?? 5,
    decimalPlaces: (session?.user as { weighMachineDecimalPlaces?: number | null })?.weighMachineDecimalPlaces ?? 3,
  }), [session]);

  const handleWeightScan = useCallback((barcode: string) => {
    const parsed = parseWeightBarcode(barcode, weighMachineConfig);
    if (!parsed) return;

    const product = products.find((p) => p.weighMachineCode === parsed.productCode);
    if (!product) {
      toast.error(`${t("sales.productNotFoundForCode")}: ${parsed.productCode}`);
      return;
    }

    setLineItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === product.id && i.quantity === 0);
      if (existingIdx !== -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: parsed.weightKg } : item
        );
      }
      return [
        ...prev,
        {
          id: createClientId("invoice-line"),
          productId: product.id,
          quantity: parsed.weightKg,
          unitId: product.unitId || "",
          conversionFactor: 1,
          unitPrice: Number(product.price),
          discount: 0,
          gstRate: Number(product.gstRate) || 0,
          hsnCode: product.hsnCode || "",
          vatRate: 15,
        },
      ];
    });

    toast.success(`${product.name} — ${parsed.weightKg} kg`);
  }, [products, weighMachineConfig]);

  useBarcodeScanner(handleWeightScan, weighMachineEnabled);

  useEffect(() => {
    fetchCustomers();
    fetchInvoice();
    // Initial customer and invoice load only.
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

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers?compact=true");
    const data = await response.json();
    setCustomers(data);
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
      const response = await fetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          customerId: data.customer.id,
          date: data.issueDate.split("T")[0],
          dueDate: data.dueDate.split("T")[0],
          notes: data.notes || "",
          terms: data.terms || "",
          branchId: data.branchId || "",
          warehouseId: data.warehouseId || "",
          paymentType: data.paymentType || "CASH",
        });
        if (data.isTaxInclusive !== null && data.isTaxInclusive !== undefined) {
          setTaxInclusive(data.isTaxInclusive);
        }
        setApplyRoundOff(Boolean(data.applyRoundOff));
        setLineItems(
          data.items.map((item: { id: string; product: { id: string } | null; quantity: number; unitId: string | null; conversionFactor: number; unitPrice: number; discount: number; gstRate?: number; hsnCode?: string; vatRate?: number }) => ({
            id: item.id,
            productId: item.product?.id || "",
            quantity: Number(item.quantity),
            unitId: item.unitId || "",
            conversionFactor: Number(item.conversionFactor) || 1,
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
            gstRate: Number(item.gstRate) || 0,
            hsnCode: item.hsnCode || "",
            vatRate: Number(item.vatRate) || 0,
          }))
        );
      } else {
        toast.error(t("sales.invoiceNotFound"));
        router.push("/invoices");
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      toast.error(t("sales.failedToLoadInvoice"));
      router.push("/invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const orgTaxInclusive = !!(session?.user as { isTaxInclusivePrice?: boolean })?.isTaxInclusivePrice;
  const [taxInclusive, setTaxInclusive] = useState(orgTaxInclusive);
  useEffect(() => { setTaxInclusive(orgTaxInclusive); }, [orgTaxInclusive]);
  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const taxEnabled = session?.user?.gstEnabled || saudiEnabled;

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      {
        id: createClientId("invoice-line"),
        productId: "",
        quantity: 1,
        unitId: "",
        conversionFactor: 1,
        unitPrice: 0,
        discount: 0,
        gstRate: 0,
        hsnCode: "",
        vatRate: saudiEnabled ? 15 : 0,
      },
    ]);
  }, [saudiEnabled]);

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
            unitPrice: Number(product.price),
            gstRate: Number(product.gstRate) || 0,
            hsnCode: product.hsnCode || "",
            vatRate: saudiEnabled ? 15 : 0,
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
    });

    setLineItems(updatedItems);

    if (shouldAddNewLine) {
      setTimeout(() => {
        setLineItems((prev) => [
          ...prev,
          {
            id: createClientId("invoice-line"),
            productId: "",
            quantity: 1,
            unitId: "",
            conversionFactor: 1,
            unitPrice: 0,
            discount: 0,
            gstRate: 0,
            hsnCode: "",
            vatRate: 0,
          },
        ]);
      }, 0);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => {
      const gross = item.quantity * item.unitPrice * (1 - item.discount / 100);
      if (taxInclusive) {
        const rate = saudiEnabled ? (item.vatRate || 0) : (item.gstRate || 0);
        return sum + (rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross);
      }
      return sum + gross;
    }, 0);
  };

  const calculateTax = () => {
    return lineItems.reduce((sum, item) => {
      const gross = item.quantity * item.unitPrice * (1 - item.discount / 100);
      const rate = saudiEnabled ? (item.vatRate || 0) : (item.gstRate || 0);
      if (taxInclusive) {
        const base = rate > 0 ? Math.round((gross / (1 + rate / 100)) * 100) / 100 : gross;
        return sum + (base * rate) / 100;
      }
      return sum + (gross * rate) / 100;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

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

    const validItems = lineItems.filter((item) => item.productId);

    if (validItems.length === 0) {
      toast.error(t("sales.addAtLeastOneProduct"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          issueDate: formData.date,
          dueDate: formData.dueDate,
          notes: formData.notes || null,
          terms: formData.terms || null,
          branchId: formData.branchId || undefined,
          warehouseId: formData.warehouseId || undefined,
          paymentType: formData.paymentType || "CASH",
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
              unitPrice: item.unitPrice,
              discount: item.discount,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              ...(saudiEnabled && { vatRate: item.vatRate ?? 15 }),
            };
          }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const warnings = data.warnings || [];

        // Display warnings if any
        if (warnings.length > 0) {
          warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 6000 });
          });
        }

        toast.success(t("sales.invoiceUpdated"));
        router.push(`/invoices/${id}`);
      } else {
        toast.error(t("sales.failedToUpdateInvoice"));
      }
    } catch (error) {
      console.error("Failed to update invoice:", error);
      toast.error(t("sales.failedToUpdateInvoice"));
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
          <Link href={`/invoices/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("sales.editInvoice")}</h2>
            <p className="text-slate-500">{t("sales.editInvoiceDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("sales.invoiceDetails")}</CardTitle>
              </CardHeader>
              <CardContent>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(id) => setFormData(prev => ({ ...prev, branchId: id }))}
                  onWarehouseChange={(id) => setFormData(prev => ({ ...prev, warehouseId: id }))}
                  focusNextFocusable={focusNextFocusable}
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                    <Label htmlFor="date">{t("sales.issueDate")} *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">{t("sales.dueDate")} *</Label>
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
                  <div className="grid gap-2">
                    <Label htmlFor="paymentType">{t("sales.paymentType")} *</Label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={(value) => {
                        setFormData({ ...formData, paymentType: value });
                      }}
                      onOpenChange={(open) => {
                        if (!open) {
                          setTimeout(() => focusNextFocusable(paymentTypeRef), 10);
                        }
                      }}
                    >
                      <SelectTrigger id="paymentType" ref={paymentTypeRef}>
                        <SelectValue placeholder={t("common.selectType")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">
                          {t("common.cashPaymentType")} {session?.user?.saudiEInvoiceEnabled ? "/ نقدي" : ""}
                        </SelectItem>
                        <SelectItem value="CREDIT">
                          {t("common.creditPaymentType")} {session?.user?.saudiEInvoiceEnabled ? "/ آجل" : ""}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {taxEnabled && (
                    <div className="grid gap-2">
                      <Label>{t("common.pricing")}</Label>
                      <Select
                        value={taxInclusive ? "inclusive" : "exclusive"}
                        onValueChange={(v) => setTaxInclusive(v === "inclusive")}
                        onOpenChange={(open) => {
                          if (!open) {
                            setTimeout(() => focusNextFocusable(taxInclusiveRef), 10);
                          }
                        }}
                      >
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
              {weighMachineEnabled && (
                <div className="mx-6 mb-3 flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
                  <Scale className="h-4 w-4 shrink-0" />
                  {t("sales.weighMachineActive")}
                </div>
              )}
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
                        <TableHead className="font-semibold">{t("common.unitPrice")} *</TableHead>
                        <TableHead className="font-semibold">{t("common.discountPercent")}</TableHead>
                        {session?.user?.gstEnabled && !saudiEnabled && <TableHead className="font-semibold">{t("common.gstPercent")}</TableHead>}
                        {saudiEnabled && <TableHead className="font-semibold">{t("common.vatPercent")}</TableHead>}
                        {(session?.user?.gstEnabled || saudiEnabled) ? (
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
                        const product = products.find((p) => p.id === item.productId);
                        const availableStock = product?.availableStock ?? 0;
                        const hasStockShortfall = item.productId && item.quantity > availableStock;
                        const lineGross = item.quantity * item.unitPrice * (1 - item.discount / 100);
                        const taxRate = saudiEnabled ? (item.vatRate || 0) : (item.gstRate || 0);
                        const lineNet = lineGross * (1 + taxRate / 100);
                        const lineAmountKey = getLineAmountKey(item.id, lineGross, lineNet);
                        return (
                          <TableRow key={item.id} className="group hover:bg-slate-50 border-b">
                            <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                              <div className="flex items-start gap-1">
                                <div className="flex-1">
                                  <ProductCombobox
                                    products={products}
                                    value={item.productId}
                                    onValueChange={(value) =>
                                      updateLineItem(item.id, "productId", value)
                                    }
                                    onSelect={() => focusQuantity(item.id)}
                                  />
                                </div>
                                {item.productId && (
                                  <button
                                    type="button"
                                    className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-slate-100"
                                    onClick={() => setPriceHistoryItem({ productId: item.productId, productName: product?.name || "" })}
                                    title={t("sales.priceHistory")}
                                  >
                                    <History className="h-3.5 w-3.5" />
                                  </button>
                                )}
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
                                min="1"
                                step="0.01"
                                value={item.quantity || ""}
                                onChange={(e) =>
                                  updateLineItem(
                                    item.id,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className={`border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100 ${hasStockShortfall ? "border border-yellow-500 bg-yellow-50 focus-visible:ring-yellow-500" : ""}`}
                                required
                              />
                              {hasStockShortfall && (
                                <p className="text-[10px] text-yellow-600 mt-1 absolute bottom-[-5px] left-2">
                                  {availableStock === 0
                                    ? `⚠ ${t("sales.noStock")}`
                                    : `⚠ ${t("sales.onlyNInStock").replace("{n}", String(availableStock))}`}
                                </p>
                              )}
                            </TableCell>
                            {session?.user?.multiUnitEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <ItemUnitSelect
                                  value={item.unitId}
                                  onValueChange={(value) => updateLineItem(item.id, "unitId", value)}
                                  options={(() => {
                                    const product = products.find((p) => p.id === item.productId);
                                    if (!product) return [];
                                    const baseOption = { id: product.unitId!, name: product.unit?.name || product.unit?.code || t("common.baseUnit"), conversionFactor: 1 };
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
                              {item.productId && product?.cost !== undefined && Number(product.cost) > 0 && (
                                <p className="text-[10px] text-slate-400 mt-0.5 px-1">{t("common.cost")}: {fmt(Number(product.cost))}</p>
                              )}
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
                            {saudiEnabled && (
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <Input
                                  type="number"
                                  onFocus={(e) => e.target.select()}
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.vatRate || ""}
                                  onChange={(e) =>
                                    updateLineItem(item.id, "vatRate", parseFloat(e.target.value) || 0)
                                  }
                                  className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                                  placeholder="15"
                                />
                              </TableCell>
                            )}
                            {(session?.user?.gstEnabled || saudiEnabled) ? (
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
                                    {symbol}{lineNet.toFixed(2)}
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
                    const product = products.find((p) => p.id === item.productId);
                    const availableStock = product?.availableStock ?? 0;
                    const hasStockShortfall = item.productId && item.quantity > availableStock;
                    const lineGross = item.quantity * item.unitPrice * (1 - item.discount / 100);
                    const taxRate = saudiEnabled ? (item.vatRate || 0) : (item.gstRate || 0);
                    const lineNet = lineGross * (1 + taxRate / 100);
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
                          <div className="flex gap-1 mt-5">
                            {item.productId && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600"
                                onClick={() => setPriceHistoryItem({ productId: item.productId, productName: product?.name || "" })}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => removeLineItem(item.id)}
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.quantity")} *</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="1"
                              step="0.01"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                              }
                              className={hasStockShortfall ? "border-yellow-500 bg-yellow-50" : ""}
                              required
                            />
                            {hasStockShortfall && (
                              <p className="text-[10px] text-yellow-600 mt-0.5">
                                {availableStock === 0 ? `⚠ ${t("sales.noStock")}` : `⚠ ${t("sales.onlyNInStock").replace("{n}", String(availableStock))}`}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">{t("common.unitPrice")} *</Label>
                            <Input
                              type="number"
                              onFocus={(e) => e.target.select()}
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateLineItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                              }
                              required
                            />
                            {item.productId && product?.cost !== undefined && Number(product.cost) > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{t("common.cost")}: {fmt(Number(product.cost))}</p>
                            )}
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
                          {saudiEnabled && (
                            <div>
                              <Label className="text-xs text-slate-500">{t("common.vatPercent")}</Label>
                              <Input
                                type="number"
                                onFocus={(e) => e.target.select()}
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.vatRate || ""}
                                onChange={(e) =>
                                  updateLineItem(item.id, "vatRate", parseFloat(e.target.value) || 0)
                                }
                                placeholder="15"
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
                                  const baseOption = { id: p.unitId!, name: p.unit?.name || p.unit?.code || t("common.baseUnit"), conversionFactor: 1 };
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
                            {(session?.user?.gstEnabled || saudiEnabled)
                              ? `${symbol}${lineNet.toFixed(2)}`
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
                  <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{t("common.applyRoundOff")}</p>
                      <p className="text-xs text-slate-500">
                        {roundOffEnabled
                          ? t("sales.roundOffEnabledHint")
                          : t("sales.roundOffDisabledHint")}
                      </p>
                    </div>
                    <Switch
                      checked={applyRoundOff}
                      onCheckedChange={setApplyRoundOff}
                      disabled={!roundOffEnabled}
                    />
                  </div>
                  {taxInclusive && (
                    <div className="mb-2 text-left text-xs font-medium text-blue-600 sm:text-right">{t("common.pricesIncludeTax")}</div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>{t("common.subtotal")}</span>
                    <span key={`summary-subtotal:${subtotal.toFixed(2)}`}>{symbol}{subtotal.toLocaleString(locale)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>{saudiEnabled ? `${t("common.vat")} (ضريبة القيمة المضافة)` : t("common.gst")}</span>
                      <span key={`summary-tax:${tax.toFixed(2)}`}>{symbol}{tax.toFixed(2)}</span>
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
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? t("common.updating") : t("sales.updateInvoice")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>

        <PriceHistoryDialog
          productId={priceHistoryItem?.productId || ""}
          productName={priceHistoryItem?.productName || ""}
          customerId={formData.customerId || undefined}
          customerName={customers.find((c) => c.id === formData.customerId)?.name}
          open={!!priceHistoryItem}
          onOpenChange={(open) => { if (!open) setPriceHistoryItem(null); }}
        />
      </div>
    </PageAnimation>
  );
}
