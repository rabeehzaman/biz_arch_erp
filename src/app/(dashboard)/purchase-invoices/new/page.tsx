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
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useSession } from "next-auth/react";
import { ItemUnitSelect } from "@/components/invoices/item-unit-select";
import { useUnitConversions } from "@/hooks/use-unit-conversions";

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
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitId: "", conversionFactor: 1, unitCost: 0, discount: 0, gstRate: 0, hsnCode: "" },
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
    fetchSuppliers();
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

  const fetchSuppliers = async () => {
    const response = await fetch("/api/suppliers");
    const data = await response.json();
    setSuppliers(data);
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
          },
        ]);
      }, 0);
    }
  };

  const calculateSubtotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitCost * (1 - item.discount / 100),
      0
    );
  };

  const calculateTax = () => {
    return lineItems.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitCost * (1 - item.discount / 100);
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
      toast.error("Please add at least one product to the purchase invoice");
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
            };
          }),
        }),
      });

      if (response.ok) {
        const invoice = await response.json();
        toast.success("Purchase invoice created and stock updated");
        router.push(`/purchase-invoices/${invoice.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create purchase invoice");
      }
    } catch (error) {
      console.error("Failed to create purchase invoice:", error);
      toast.error("Failed to create purchase invoice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/purchase-invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">New Purchase Invoice</h2>
            <p className="text-slate-500">Record a purchase from a supplier</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Supplier & Date */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="supplier">Supplier *</Label>
                  <SupplierCombobox
                    suppliers={suppliers}
                    value={formData.supplierId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, supplierId: value })
                    }
                    required
                    onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                    autoFocus={true}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplierInvoiceRef">Supplier Invoice Ref</Label>
                  <Input
                    id="supplierInvoiceRef"
                    value={formData.supplierInvoiceRef}
                    onChange={(e) =>
                      setFormData({ ...formData, supplierInvoiceRef: e.target.value })
                    }
                    placeholder="Supplier's invoice number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invoiceDate">Purchase Date *</Label>
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
                  <Label htmlFor="dueDate">Payment Due Date *</Label>
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
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Items</CardTitle>
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
                      <TableHead className="w-[12%] font-semibold">Unit Cost *</TableHead>
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
                      return (
                        <TableRow key={item.id} className="group hover:bg-slate-50 border-b">
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
                                  e.stopPropagation(); // Prevent useEnterToTab from also moving focus
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
                                ₹{(item.quantity * item.unitCost * (1 - item.discount / 100)).toLocaleString("en-IN")}
                                {item.discount > 0 && (
                                  <div className="text-xs text-green-600">(-{item.discount}%)</div>
                                )}
                              </TableCell>
                              <TableCell className="text-right align-top p-2 py-4 text-sm font-medium border-r border-slate-100 last:border-0">
                                ₹{((item.quantity * item.unitCost * (1 - item.discount / 100)) * (1 + (item.gstRate || 0) / 100)).toLocaleString("en-IN")}
                              </TableCell>
                            </>
                          ) : (
                            <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                              ₹{(item.quantity * item.unitCost * (1 - item.discount / 100)).toLocaleString("en-IN")}
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
                    placeholder="Any additional notes..."
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-medium">Stock Update</p>
                  <p className="text-blue-600">
                    Creating this purchase invoice will automatically add stock for the selected products.
                  </p>
                </div>
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
                    disabled={isSubmitting || !formData.supplierId || !formData.dueDate}
                  >
                    {isSubmitting ? "Creating..." : "Create Purchase Invoice"}
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
