"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";

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
}

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitCost: number;
  discount: number;
}

export default function NewDebitNotePage() {
  const router = useRouter();
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
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: "",
      description: "",
      quantity: 1,
      unitCost: 0,
      discount: 0,
    },
  ]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("/api/suppliers");
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
      const response = await fetch("/api/products");
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

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId
          ? {
            ...item,
            productId,
            description: product.name,
            unitCost: product.cost,
            gstRate: (product as any).gstRate || 0,
            hsnCode: (product as any).hsnCode || "",
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
      prevItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }

    const validItems = items.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error("Please add at least one item");
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
            unitCost: item.unitCost,
            discount: item.discount,
            gstRate: (item as any).gstRate || 0,
            hsnCode: (item as any).hsnCode || null,
          })),
          reason: reason || null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create debit note");
      }

      const data = await response.json();
      toast.success("Debit note created successfully");
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
              New Debit Note
            </h2>
            <p className="text-slate-500">Create a new purchase return</p>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <strong>Stock Validation:</strong> Debit notes will check if you have
            sufficient stock available before processing the return. Make sure the
            products you're returning are still in your inventory.
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Debit Note Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier *</Label>
                  <select
                    id="supplier"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                    autoFocus
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="issueDate">Issue Date</Label>
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
                    Original Purchase Invoice (Optional)
                  </Label>
                  <Input
                    id="purchaseInvoiceId"
                    placeholder="Leave blank for standalone debit note"
                    value={purchaseInvoiceId}
                    onChange={(e) => setPurchaseInvoiceId(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Return</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Defective items"
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
                <CardTitle>Items</CardTitle>
                <Button type="button" onClick={() => addLineItem(true)} variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <div className="sm:col-span-5">
                        <Label>Product *</Label>
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

                      <div className="grid grid-cols-1 gap-2 sm:contents">
                        <Input
                          type="number"
                          onFocus={(e) => e.target.select()}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          required
                          ref={(el) => {
                            if (el) quantityRefs.current.set(item.id, el);
                            else quantityRefs.current.delete(item.id);
                          }}
                        />

                        <Input
                          type="number"
                          onFocus={(e) => e.target.select()}
                          placeholder="Unit Cost"
                          value={item.unitCost}
                          onChange={(e) =>
                            updateLineItem(item.id, "unitCost", parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                          required
                        />

                        <Input
                          type="number"
                          onFocus={(e) => e.target.select()}
                          placeholder="Discount %"
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
                              e.stopPropagation(); // Prevent useEnterToTab from also running
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
                          step="0.01"
                        />
                      </div>

                      <div className="flex items-center justify-end">
                        <span className="text-sm font-medium">
                          ₹
                          {(
                            item.quantity *
                            item.unitCost *
                            (1 - item.discount / 100)
                          ).toFixed(2)}
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
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{calculateSubtotal().toFixed(2)}</span>
                </div>
                {calculateTax() > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>GST:</span>
                    <span>₹{calculateTax().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>₹{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/debit-notes">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Debit Note"}
            </Button>
          </div>
        </form>
      </div>
    </PageAnimation>
  );
}
