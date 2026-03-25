"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useRouter, useSearchParams } from "next/navigation";
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
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
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
import { useJewelleryRates } from "@/hooks/use-jewellery-rates";
import { JewelleryLineFields, createJewelleryLineState, type JewelleryLineState, type JewelleryItemData } from "@/components/jewellery-shop/jewellery-line-fields";
import { calculateJewelleryLinePrice } from "@/lib/jewellery/client-pricing";
import { OldGoldAdjustment } from "@/components/jewellery-shop/old-gold-adjustment";
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
  cost?: number;
  unitId: string | null;
  unit: { id: string; name: string; code: string } | null;
  isService?: boolean;
  isImeiTracked?: boolean;
  availableStock?: number;
  gstRate?: number;
  hsnCode?: string;
  weighMachineCode?: string | null;
  jewelleryItem?: JewelleryItemData | null;
}

interface MobileDeviceOption {
  id: string;
  imei1: string;
  imei2: string | null;
  brand: string;
  model: string;
  color: string | null;
  storageCapacity: string | null;
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
  vatRate: number; // Saudi VAT rate (15 or 0)
  selectedImeis: string[];
  jewellery?: JewelleryLineState | null;
}

type InvoiceTaxMode = "none" | "gst" | "vat";

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function getInvoiceTaxMode(gstEnabled: boolean | undefined, saudiEnabled: boolean): InvoiceTaxMode {
  if (saudiEnabled) return "vat";
  if (gstEnabled) return "gst";
  return "none";
}

function getInvoiceLineAmounts(item: LineItem, taxMode: InvoiceTaxMode, taxInclusive: boolean) {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const taxRate = taxMode === "vat"
    ? Number(item.vatRate) || 0
    : taxMode === "gst"
      ? Number(item.gstRate) || 0
      : 0;
  const discountedAmount = quantity * unitPrice * (1 - discount / 100);

  if (taxInclusive && taxRate > 0) {
    const subtotal = roundCurrency(discountedAmount / (1 + taxRate / 100));
    const tax = roundCurrency(discountedAmount - subtotal);

    return {
      subtotal,
      tax,
      total: roundCurrency(discountedAmount),
    };
  }

  const subtotal = roundCurrency(discountedAmount);
  const tax = roundCurrency(discountedAmount * (taxRate / 100));

  return {
    subtotal,
    tax,
    total: roundCurrency(subtotal + tax),
  };
}

function getLineAmountKey(itemId: string, subtotal: number, total: number) {
  return `${itemId}:${subtotal}:${total}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicate");
  const { t } = useLanguage();
  const { isFieldHidden, getDefault } = useFormConfig("salesInvoice");
  const [customers, setCustomers] = useState<Customer[]>([]);
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
    customerId: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: getDefault("dueDate", getDefaultDueDate()),
    notes: getDefault("notes", ""),
    terms: getDefault("terms", ""),
    branchId: getDefault("branchId", ""),
    warehouseId: getDefault("warehouseId", ""),
    paymentType: getDefault("paymentType", "CASH"),
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitId: "", conversionFactor: 1, unitPrice: 0, discount: 0, gstRate: 0, hsnCode: "", vatRate: 15, selectedImeis: [] },
  ]);
  const [availableDevices, setAvailableDevices] = useState<Record<string, MobileDeviceOption[]>>({});
  const [priceHistoryItem, setPriceHistoryItem] = useState<{ productId: string; productName: string } | null>(null);
  const [oldGoldAdjustmentId, setOldGoldAdjustmentId] = useState<string | null>(null);
  const [oldGoldDeduction, setOldGoldDeduction] = useState(0);

  const { data: session, status: sessionStatus } = useSession();
  const { fmt } = useCurrency();
  const { unitConversions } = useUnitConversions();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const saveAndNew = useRef(false);
  const paymentTypeRef = useRef<HTMLButtonElement>(null);
  const taxInclusiveRef = useRef<HTMLButtonElement>(null);
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const productComboRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const jewelleryEnabled = !!(session?.user as { isJewelleryModuleEnabled?: boolean })?.isJewelleryModuleEnabled;
  const { getRate: getGoldRate } = useJewelleryRates(jewelleryEnabled);

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
      // Check if there's an existing line for this product with quantity 0
      const existingIdx = prev.findIndex((i) => i.productId === product.id && i.quantity === 0);
      if (existingIdx !== -1) {
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: parsed.weightKg } : item
        );
      }
      // Otherwise add a new line
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
          selectedImeis: [],
        },
      ];
    });

    toast.success(`${product.name} — ${parsed.weightKg} kg`);
  }, [products, weighMachineConfig]);

  useBarcodeScanner(handleWeightScan, weighMachineEnabled);

  // Focus quantity input for a specific line item
  const focusQuantity = useCallback((itemId: string) => {
    const input = quantityRefs.current.get(itemId);
    if (input) {
      input.focus();
      input.select();
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    fetchProducts();
    // Refresh product options from the selected warehouse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.warehouseId]);

  // Pre-fill form when duplicating an existing invoice
  useEffect(() => {
    if (!duplicateId) return;
    const fetchDuplicate = async () => {
      try {
        const response = await fetch(`/api/invoices/${duplicateId}`);
        if (!response.ok) return;
        const data = await response.json();
        setFormData({
          customerId: data.customer?.id || "",
          date: new Date().toISOString().split("T")[0],
          dueDate: getDefaultDueDate(),
          notes: data.notes || "",
          terms: data.terms || "",
          branchId: data.branch?.id || "",
          warehouseId: data.warehouse?.id || "",
          paymentType: data.paymentType || "CASH",
        });
        if (data.items && data.items.length > 0) {
          setLineItems(
            data.items.map((item: any, idx: number) => ({
              id: `dup-${idx}`,
              productId: item.product?.id || item.productId || "",
              quantity: Number(item.quantity) || 1,
              unitId: item.unitId || "",
              conversionFactor: item.conversionFactor || 1,
              unitPrice: Number(item.unitPrice) || 0,
              discount: Number(item.discount) || 0,
              gstRate: Number(item.gstRate) || 0,
              hsnCode: item.hsnCode || "",
              vatRate: Number(item.vatRate) ?? 15,
              selectedImeis: [],
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch invoice for duplication:", error);
      }
    };
    fetchDuplicate();
    // Only run on mount when duplicateId is present
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
        if (e.shiftKey) {
          saveAndNew.current = true;
        }
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

  const addLineItem = useCallback((focusNewProduct: boolean = false) => {
    const newId = createClientId("invoice-line");
    setLineItems((prev) => [
      ...prev,
      {
        id: newId,
        productId: "",
        quantity: 1,
        unitId: "",
        conversionFactor: 1,
        unitPrice: 0,
        discount: 0,
        gstRate: 0,
        hsnCode: "",
        vatRate: 15,
        selectedImeis: [],
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

          // Check if this product is jewellery-linked
          let jewellery: JewelleryLineState | null = null;
          let unitPrice = Number(product.price);

          if (jewelleryEnabled && product.jewelleryItem && product.jewelleryItem.status === "IN_STOCK") {
            const ji = product.jewelleryItem;
            const rate = getGoldRate(ji.purity, ji.metalType);
            jewellery = createJewelleryLineState(ji, rate);
            // Calculate live price from jewellery pricing engine
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

          return {
            ...item,
            productId: value as string,
            unitId: product.unitId || "",
            conversionFactor: 1,
            unitPrice,
            gstRate: Number(product.gstRate) || 0,
            hsnCode: product.hsnCode || (jewellery ? "7113" : ""),
            jewellery,
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

    // Fetch available devices for IMEI-tracked products
    if (field === "productId") {
      const prod = products.find((p) => p.id === value);
      if (prod?.isImeiTracked && session?.user?.isMobileShopModuleEnabled) {
        fetchDevicesForProduct(value as string);
      }
    }

    // Add new line after state update if needed
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
            vatRate: 15,
            selectedImeis: [],
          },
        ]);
      }, 0);
    }
  };

  const updateJewelleryField = (lineItemId: string, field: keyof JewelleryLineState, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== lineItemId || !item.jewellery) return item;
        const updated = { ...item.jewellery, [field]: value };
        // Recalculate unitPrice from jewellery pricing
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

  const fetchDevicesForProduct = async (productId: string) => {
    if (availableDevices[productId]) return;
    try {
      const res = await fetch(`/api/mobile-devices?productId=${productId}&status=IN_STOCK`);
      if (res.ok) {
        const devices = await res.json();
        setAvailableDevices((prev) => ({ ...prev, [productId]: devices }));
      }
    } catch {
      // ignore
    }
  };

  const toggleImei = (itemId: string, imei: string) => {
    setLineItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const exists = item.selectedImeis.includes(imei);
      const newImeis = exists
        ? item.selectedImeis.filter((i) => i !== imei)
        : [...item.selectedImeis, imei];
      return { ...item, selectedImeis: newImeis, quantity: newImeis.length || 1 };
    }));
  };

  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const orgTaxInclusive = !!(session?.user as { isTaxInclusivePrice?: boolean })?.isTaxInclusivePrice;
  const [taxInclusive, setTaxInclusive] = useState(getDefault("taxInclusive", orgTaxInclusive));
  const { roundOffMode, roundOffEnabled } = useRoundOffSettings();
  const [applyRoundOff, setApplyRoundOff] = useState(false);
  useEffect(() => { setTaxInclusive(orgTaxInclusive); }, [orgTaxInclusive]);
  useEffect(() => { setApplyRoundOff(roundOffEnabled); }, [roundOffEnabled]);
  const taxMode = getInvoiceTaxMode(session?.user?.gstEnabled, saudiEnabled);
  const taxEnabled = taxMode !== "none";

  const totals = useMemo(() => {
    const summary = lineItems.reduce(
      (summary, item) => {
        if (!item.productId) return summary;

        const amounts = getInvoiceLineAmounts(item, taxMode, taxInclusive);
        summary.subtotal = roundCurrency(summary.subtotal + amounts.subtotal);
        summary.tax = roundCurrency(summary.tax + amounts.tax);
        summary.total = roundCurrency(summary.total + amounts.total);

        return summary;
      },
      { subtotal: 0, tax: 0, total: 0 }
    );

    const { roundOffAmount, roundedTotal } = calculateRoundOff(
      summary.total,
      roundOffMode,
      applyRoundOff
    );

    return {
      ...summary,
      roundOffAmount,
      grandTotal: roundedTotal,
    };
  }, [applyRoundOff, lineItems, roundOffMode, taxInclusive, taxMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out blank items (items without a product selected)
    const validItems = lineItems.filter((item) => item.productId);

    // Validate that at least one item has a product selected
    if (validItems.length === 0) {
      toast.error(t("sales.addAtLeastOneProduct"));
      return;
    }

    if (session?.user?.multiBranchEnabled && !formData.warehouseId) {
      toast.error(t("sales.selectBranchAndWarehouse"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          issueDate: formData.date,
          dueDate: formData.dueDate,
          notes: formData.notes || null,
          terms: formData.terms || null,
          branchId: formData.branchId || undefined,
          warehouseId: formData.warehouseId || undefined,
          paymentType: formData.paymentType,
          isTaxInclusive: taxInclusive,
          applyRoundOff,
          ...(oldGoldAdjustmentId && { oldGoldAdjustmentId }),
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
              ...(product?.isImeiTracked && item.selectedImeis.length > 0 && { selectedImeis: item.selectedImeis }),
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
            };
          }),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const invoice = data.invoice || data;
        const warnings = data.warnings || [];

        // Display warnings if any
        if (warnings.length > 0) {
          warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 6000 });
          });
        }

        setIsDirty(false);
        if (saveAndNew.current) {
          saveAndNew.current = false;
          toast.success(t("sales.invoiceCreatedStartingNew"));
          router.push("/invoices/new");
        } else {
          toast.success(t("sales.invoiceCreated"), {
            action: { label: t("sales.newInvoice"), onClick: () => router.push("/invoices/new") },
          });
          router.push(`/invoices/${invoice.id}`);
        }
      } else {
        toast.error(t("sales.failedToCreateInvoice"));
      }
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error(t("sales.failedToCreateInvoice"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionStatus === "loading") {
    return (
      <PageAnimation>
        <div className="flex items-center justify-center py-8">
          <div className="text-slate-500">{t("common.loading")}</div>
        </div>
      </PageAnimation>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("sales.newInvoice")}</h2>
            <p className="text-slate-500">{t("sales.newInvoiceDesc")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)} className="sm:pb-0 pb-16">
          <div className="space-y-6">
            {/* Customer & Date */}
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
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customer">{t("common.customer")} *</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={formData.customerId}
                      onValueChange={(value: string) =>
                        setFormData(prev => ({ ...prev, customerId: value }))
                      }
                      onCustomerCreated={fetchCustomers}
                      required
                      onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                      autoFocus={true}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">{t("sales.issueDate")} *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, date: e.target.value }))
                      }
                      required
                      suppressHydrationWarning
                    />
                  </div>
                  {!isFieldHidden("dueDate") && (
                  <div className="grid gap-2">
                    <Label htmlFor="dueDate">{t("sales.dueDate")} *</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, dueDate: e.target.value }))
                      }
                      required
                      suppressHydrationWarning
                    />
                  </div>
                  )}
                  {!isFieldHidden("paymentType") && (
                  <div className="grid gap-2">
                    <Label htmlFor="paymentType">{t("sales.paymentType")} *</Label>
                    <Select
                      value={formData.paymentType}
                      onValueChange={(value) => {
                        setFormData(prev => ({ ...prev, paymentType: value }));
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
                  )}
                  {taxEnabled && !isFieldHidden("taxInclusive") && (
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

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>{t("common.lineItems")}</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={() => addLineItem(true)}>
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
                        {taxMode === "gst" && <TableHead className="font-semibold">{t("common.gstPercent")}</TableHead>}
                        {taxMode === "vat" && <TableHead className="font-semibold">{t("common.vatPercent")}</TableHead>}
                        {taxMode !== "none" ? (
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
                        const availableStock = product?.availableStock ?? 0;
                        const hasStockShortfall = item.productId && !product?.isService && item.quantity > availableStock;
                        const isImeiTracked = product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
                        const devices = isImeiTracked ? (availableDevices[item.productId] || []) : [];
                        const lineAmounts = getInvoiceLineAmounts(item, taxMode, taxInclusive);

                        return (
                          <Fragment key={item.id}>
                            <TableRow className="group hover:bg-slate-50 border-b">
                              <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                                <div className="flex items-start gap-1" ref={(el) => {
                                  if (el) {
                                    const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                                    if (button) productComboRefs.current.set(item.id, button);
                                  } else {
                                    productComboRefs.current.delete(item.id);
                                  }
                                }}>
                                  <div className="flex-1">
                                    <ProductCombobox
                                      products={products}
                                      value={item.productId}
                                      onValueChange={(value: string) =>
                                        updateLineItem(item.id, "productId", value)
                                      }
                                      onProductCreated={fetchProducts}
                                      onSelect={() => focusQuantity(item.id)}
                                      onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
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
                                {item.productId && product?.cost !== undefined && product.cost > 0 && (
                                  <p className="text-[10px] text-slate-400 mt-0.5 px-1">{t("common.cost")}: {fmt(product.cost)}</p>
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
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
                                      e.preventDefault();
                                      e.stopPropagation(); // Prevent useEnterToTab from also moving focus
                                      const isLastItem = index === lineItems.length - 1;
                                      if (isLastItem) {
                                        addLineItem(true);
                                      } else {
                                        // Manually force focus to the next product row
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
                              {taxMode === "gst" && (
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
                              {taxMode === "vat" && (
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
                              {taxMode !== "none" ? (
                                <>
                                  <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                    <span key={getLineAmountKey(item.id, lineAmounts.subtotal, lineAmounts.total)}>
                                      {fmt(lineAmounts.subtotal)}
                                    </span>
                                    {item.discount > 0 && (
                                      <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                    <span key={`${getLineAmountKey(item.id, lineAmounts.subtotal, lineAmounts.total)}:net`}>
                                      {fmt(lineAmounts.total)}
                                    </span>
                                  </TableCell>
                                </>
                              ) : (
                                <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                  <span key={`${getLineAmountKey(item.id, lineAmounts.subtotal, lineAmounts.total)}:single`}>
                                    {fmt(lineAmounts.total)}
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
                            {isImeiTracked && devices.length > 0 && (
                              <TableRow className="bg-green-50/50">
                                <TableCell colSpan={99} className="p-3">
                                  <p className="text-xs font-medium text-green-700 mb-2">
                                    {t("sales.selectImeisToSell").replace("{selected}", String(item.selectedImeis.length)).replace("{available}", String(devices.length))}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {devices.map((device) => {
                                      const selected = item.selectedImeis.includes(device.imei1);
                                      return (
                                        <button
                                          key={device.id}
                                          type="button"
                                          onClick={() => toggleImei(item.id, device.imei1)}
                                          className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors ${selected
                                            ? "bg-green-600 text-white border-green-700"
                                            : "bg-white text-slate-700 border-slate-300 hover:border-green-400"
                                            }`}
                                        >
                                          {device.imei1}
                                          {device.color && ` · ${device.color}`}
                                          {device.storageCapacity && ` · ${device.storageCapacity}`}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                            {isImeiTracked && devices.length === 0 && item.productId && (
                              <TableRow className="bg-yellow-50/50">
                                <TableCell colSpan={99} className="p-2">
                                  <p className="text-xs text-yellow-700">{t("sales.noDevicesInStock")}</p>
                                </TableCell>
                              </TableRow>
                            )}
                            {item.jewellery && (
                              <TableRow>
                                <TableCell colSpan={99} className="p-2">
                                  <JewelleryLineFields
                                    jewelleryData={item.jewellery}
                                    goldRate={getGoldRate(item.jewellery.purity, item.jewellery.metalType)}
                                    onUpdate={(field, value) => updateJewelleryField(item.id, field, value)}
                                    fmt={fmt}
                                  />
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
                    const availableStock = product?.availableStock ?? 0;
                    const hasStockShortfall = item.productId && !product?.isService && item.quantity > availableStock;
                    const isImeiTracked = product?.isImeiTracked && session?.user?.isMobileShopModuleEnabled;
                    const devices = isImeiTracked ? (availableDevices[item.productId] || []) : [];
                    const lineAmounts = getInvoiceLineAmounts(item, taxMode, taxInclusive);

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
                              onValueChange={(value: string) =>
                                updateLineItem(item.id, "productId", value)
                              }
                              onProductCreated={fetchProducts}
                              onSelect={() => focusQuantity(item.id)}
                              onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
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
                            {item.productId && product?.cost !== undefined && product.cost > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5">{t("common.cost")}: {fmt(product.cost)}</p>
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
                          {taxMode === "gst" && (
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
                          {taxMode === "vat" && (
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
                          <span
                            key={`${getLineAmountKey(item.id, lineAmounts.subtotal, lineAmounts.total)}:mobile`}
                            className="text-sm font-semibold"
                          >
                            {fmt(lineAmounts.total)}
                          </span>
                        </div>

                        {isImeiTracked && devices.length > 0 && (
                          <div className="bg-green-50 rounded p-2">
                            <p className="text-xs font-medium text-green-700 mb-2">
                              {t("sales.selectImeis").replace("{selected}", String(item.selectedImeis.length)).replace("{available}", String(devices.length))}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {devices.map((device) => {
                                const selected = item.selectedImeis.includes(device.imei1);
                                return (
                                  <button key={device.id} type="button" onClick={() => toggleImei(item.id, device.imei1)}
                                    className={`px-2 py-1 rounded text-xs font-mono border transition-colors ${selected ? "bg-green-600 text-white border-green-700" : "bg-white text-slate-700 border-slate-300"}`}>
                                    {device.imei1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {isImeiTracked && devices.length === 0 && item.productId && (
                          <p className="text-xs text-yellow-700 bg-yellow-50 rounded p-2">{t("sales.noDevicesInStockShort")}</p>
                        )}
                        {item.jewellery && (
                          <JewelleryLineFields
                            jewelleryData={item.jewellery}
                            goldRate={getGoldRate(item.jewellery.purity, item.jewellery.metalType)}
                            onUpdate={(field, value) => updateJewelleryField(item.id, field, value)}
                            fmt={fmt}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Old Gold Adjustment (jewellery only) */}
            {jewelleryEnabled && formData.customerId && lineItems.some((i) => i.jewellery) && (
              <OldGoldAdjustment
                customerId={formData.customerId}
                selectedId={oldGoldAdjustmentId}
                onSelect={(id, amount) => {
                  setOldGoldAdjustmentId(id);
                  setOldGoldDeduction(amount);
                }}
                fmt={fmt}
              />
            )}

            {/* Notes */}
            {(!isFieldHidden("notes") || !isFieldHidden("terms")) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("common.additionalInformation")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {!isFieldHidden("notes") && (
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t("common.notes")}</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder={t("sales.notesPlaceholder")}
                  />
                </div>
                )}
                {!isFieldHidden("terms") && (
                <div className="grid gap-2">
                  <Label htmlFor="terms">{t("common.termsAndConditions")}</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, terms: e.target.value }))
                    }
                    placeholder={t("sales.termsPlaceholder")}
                  />
                </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Summary */}
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
                  {taxMode === "vat" && (
                    <div className="mb-2 text-left text-xs font-medium text-slate-500 sm:text-right">{t("sales.vatInvoiceZatca")}</div>
                  )}
                  {taxInclusive && (
                    <div className="mb-2 text-left text-xs font-medium text-blue-600 sm:text-right">{t("common.pricesIncludeTax")}</div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span>{t("common.subtotal")}</span>
                    <span key={`summary-subtotal:${totals.subtotal}`}>{fmt(totals.subtotal)}</span>
                  </div>
                  {totals.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{taxMode === "vat" ? `${t("common.vat")} (ضريبة القيمة المضافة)` : t("common.gst")}</span>
                      <span key={`summary-tax:${totals.tax}`}>{fmt(totals.tax)}</span>
                    </div>
                  )}
                  {applyRoundOff && totals.roundOffAmount !== 0 && (
                    <div className="flex justify-between text-sm">
                      <span>{t("common.roundOff")}</span>
                      <span key={`summary-roundoff:${totals.roundOffAmount}`}>
                        {totals.roundOffAmount >= 0 ? "+" : ""}
                        {fmt(totals.roundOffAmount)}
                      </span>
                    </div>
                  )}
                  {oldGoldDeduction > 0 && (
                    <div className="flex justify-between text-sm text-amber-700">
                      <span>Old Gold Adjustment</span>
                      <span>-{fmt(oldGoldDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>{t("common.total")}</span>
                    <span key={`summary-total:${totals.grandTotal}`}>{fmt(totals.grandTotal)}</span>
                  </div>
                </div>
                <div className="mt-6 hidden gap-3 sm:flex sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-auto"
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                    onClick={() => {
                      saveAndNew.current = true;
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {isSubmitting ? t("common.saving") : t("common.saveAndNew")}
                  </Button>
                  <Button
                    type="submit"
                    className="w-auto"
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? t("common.creating") : t("sales.createInvoice")}
                  </Button>
                </div>
                <StickyBottomBar>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                    onClick={() => {
                      saveAndNew.current = true;
                      formRef.current?.requestSubmit();
                    }}
                  >
                    {isSubmitting ? t("common.saving") : t("common.saveAndNew")}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? t("common.creating") : t("sales.createInvoice")}
                  </Button>
                </StickyBottomBar>
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
