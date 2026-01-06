"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";

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
  unit: string;
}

interface LineItem {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  discount: number;
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    supplierInvoiceRef: "",
    taxRate: "0",
    notes: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", quantity: 1, unitCost: 0, discount: 0 },
  ]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
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

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        productId: "",
        quantity: 1,
        unitCost: 0,
        discount: 0,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const updateLineItem = (id: string, field: string, value: string | number) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;

        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          if (product) {
            return {
              ...item,
              productId: value as string,
              // Use product cost if available, otherwise use selling price
              unitCost: Number(product.cost) || Number(product.price),
            };
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const calculateSubtotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitCost * (1 - item.discount / 100),
      0
    );
  };

  const calculateTax = () => {
    return (calculateSubtotal() * parseFloat(formData.taxRate || "0")) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all items have products selected
    const invalidItems = lineItems.filter((item) => !item.productId);
    if (invalidItems.length > 0) {
      toast.error("All items must have a product selected");
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
          taxRate: parseFloat(formData.taxRate) || 0,
          notes: formData.notes || null,
          items: lineItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              description: product?.name || "",
              quantity: item.quantity,
              unitCost: item.unitCost,
              discount: item.discount,
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

      <form onSubmit={handleSubmit}>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Purchase Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lineItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-4 sm:grid-cols-12 items-end p-4 border rounded-lg"
                    >
                      <div className="sm:col-span-5">
                        <Label>Product *</Label>
                        <ProductCombobox
                          products={products}
                          value={item.productId}
                          onValueChange={(value) =>
                            updateLineItem(item.id, "productId", value)
                          }
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) =>
                            updateLineItem(
                              item.id,
                              "quantity",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Unit Cost *</Label>
                        <Input
                          type="number"
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
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Disc %</Label>
                        <Input
                          type="number"
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
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="sm:col-span-12 text-right text-sm text-slate-500">
                        Line Total: ₹{(item.quantity * item.unitCost * (1 - item.discount / 100)).toLocaleString("en-IN")}
                        {item.discount > 0 && (
                          <span className="ml-2 text-green-600">(-{item.discount}%)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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
  );
}
