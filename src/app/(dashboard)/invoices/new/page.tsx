"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
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
  isService?: boolean;
  availableStock?: number;
  gstRate?: number;
  hsnCode?: string;
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

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  };

  const [formData, setFormData] = useState({
    customerId: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: getDefaultDueDate(),
    notes: "",
    terms: "",
    branchId: "",
    warehouseId: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitId: "", conversionFactor: 1, unitPrice: 0, discount: 0, gstRate: 0, hsnCode: "" },
  ]);

  const { data: session } = useSession();
  const { unitConversions } = useUnitConversions();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
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
    fetchCustomers();
    fetchProducts();
  }, []);

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
  }, []);

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers");
    const data = await response.json();
    setCustomers(data);
  };

  const fetchProducts = async () => {
    const response = await fetch("/api/products");
    const data = await response.json();
    setProducts(data);
  };

  const addLineItem = (focusNewProduct: boolean = false) => {
    const newId = Date.now().toString();
    setLineItems([
      ...lineItems,
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
            unitPrice: Number(product.price),
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
            unitPrice: 0,
            discount: 0,
            gstRate: 0,
            hsnCode: "",
          },
        ]);
      }, 0);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice * (1 - item.discount / 100),
      0
    );
  };

  const calculateTax = () => {
    return lineItems.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
      return sum + (lineTotal * (item.gstRate || 0)) / 100;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out blank items (items without a product selected)
    const validItems = lineItems.filter((item) => item.productId);

    // Validate that at least one item has a product selected
    if (validItems.length === 0) {
      toast.error("Please add at least one product to the invoice");
      return;
    }

    if (session?.user?.multiBranchEnabled && !formData.warehouseId) {
      toast.error("Please select a branch and warehouse");
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
        const data = await response.json();
        const invoice = data.invoice || data;
        const warnings = data.warnings || [];

        // Display warnings if any
        if (warnings.length > 0) {
          warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 6000 });
          });
        }

        toast.success("Invoice created");
        router.push(`/invoices/${invoice.id}`);
      } else {
        toast.error("Failed to create invoice");
      }
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">New Invoice</h2>
            <p className="text-slate-500">Create a new invoice for a customer</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Customer & Date */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <BranchWarehouseSelector
                  branchId={formData.branchId}
                  warehouseId={formData.warehouseId}
                  onBranchChange={(id) => setFormData(prev => ({ ...prev, branchId: id }))}
                  onWarehouseChange={(id) => setFormData(prev => ({ ...prev, warehouseId: id }))}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <CustomerCombobox
                      customers={customers}
                      value={formData.customerId}
                      onValueChange={(value: string) =>
                        setFormData({ ...formData, customerId: value })
                      }
                      onCustomerCreated={fetchCustomers}
                      required
                      onSelectFocusNext={(triggerRef: any) => focusNextFocusable(triggerRef)}
                      autoFocus={true}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date">Issue Date *</Label>
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
                    <Label htmlFor="dueDate">Due Date *</Label>
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
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
                <CardAction>
                  <Button type="button" variant="outline" size="sm" onClick={() => addLineItem(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="p-0 border-t border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[30%] font-semibold">Product *</TableHead>
                      <TableHead className="w-[10%] font-semibold">Quantity *</TableHead>
                      {session?.user?.multiUnitEnabled && (
                        <TableHead className="w-[12%] font-semibold">Unit</TableHead>
                      )}
                      <TableHead className="w-[12%] font-semibold">Unit Price *</TableHead>
                      <TableHead className="w-[10%] font-semibold">Disc %</TableHead>
                      {session?.user?.gstEnabled && <TableHead className="w-[8%] font-semibold">GST %</TableHead>}
                      {session?.user?.gstEnabled ? (
                        <>
                          <TableHead className="text-right font-semibold">Gross Amount</TableHead>
                          <TableHead className="text-right font-semibold">Net Amount</TableHead>
                        </>
                      ) : (
                        <TableHead className="text-right font-semibold">Line Total</TableHead>
                      )}
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => {
                      const product = products.find((p) => p.id === item.productId);
                      const availableStock = product?.availableStock ?? 0;
                      const hasStockShortfall = item.productId && !product?.isService && item.quantity > availableStock;
                      const shortfall = item.quantity - availableStock;

                      return (
                        <TableRow key={item.id} className="group hover:bg-slate-50 border-b">
                          <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                            <div ref={(el) => {
                              if (el) {
                                // Find the combobox trigger button inside
                                const button = el.querySelector('button[role="combobox"]') as HTMLButtonElement;
                                if (button) productComboRefs.current.set(item.id, button);
                              } else {
                                productComboRefs.current.delete(item.id);
                              }
                            }}>
                              <ProductCombobox
                                products={products}
                                value={item.productId}
                                onValueChange={(value: string) =>
                                  updateLineItem(item.id, "productId", value)
                                }
                                onProductCreated={fetchProducts}
                                onSelect={() => focusQuantity(item.id)}
                                onSelectFocusNext={(triggerRef: any) => focusNextFocusable(triggerRef)}
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
                                  ? "⚠ No stock"
                                  : `⚠ Only ${availableStock} in stock`}
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
                          {session?.user?.gstEnabled && (
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
                          {session?.user?.gstEnabled ? (
                            <>
                              <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                                ₹{(item.quantity * item.unitPrice * (1 - item.discount / 100)).toLocaleString("en-IN")}
                                {item.discount > 0 && (
                                  <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                ₹{((item.quantity * item.unitPrice * (1 - item.discount / 100)) * (1 + (item.gstRate || 0) / 100)).toLocaleString("en-IN")}
                              </TableCell>
                            </>
                          ) : (
                            <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                              ₹{(item.quantity * item.unitPrice * (1 - item.discount / 100)).toLocaleString("en-IN")}
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
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Notes to the customer..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    value={formData.terms}
                    onChange={(e) =>
                      setFormData({ ...formData, terms: e.target.value })
                    }
                    placeholder="Payment terms..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-w-xs ml-auto">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{calculateSubtotal().toLocaleString("en-IN")}</span>
                  </div>
                  {calculateTax() > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>GST</span>
                      <span>₹{calculateTax().toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>₹{calculateTotal().toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? "Creating..." : "Create Invoice"}
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
