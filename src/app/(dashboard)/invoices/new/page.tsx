"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
}

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerId: "",
    dueDate: "",
    taxRate: "18",
    discount: "0",
    notes: "",
    terms: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", productId: "", description: "", quantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
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

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
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
              description: product.name,
              unitPrice: Number(product.price),
            };
          }
        }

        return { ...item, [field]: value };
      })
    );
  };

  const calculateSubtotal = () => {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
  };

  const calculateTax = () => {
    return (calculateSubtotal() * parseFloat(formData.taxRate || "0")) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - parseFloat(formData.discount || "0");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          dueDate: formData.dueDate,
          taxRate: parseFloat(formData.taxRate) || 0,
          discount: parseFloat(formData.discount) || 0,
          notes: formData.notes || null,
          terms: formData.terms || null,
          items: lineItems.map((item) => ({
            productId: item.productId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }),
      });

      if (response.ok) {
        const invoice = await response.json();
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

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Date */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="customer">Customer *</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, customerId: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid gap-4 sm:grid-cols-12 items-end p-4 border rounded-lg"
                    >
                      <div className="sm:col-span-3">
                        <Label>Product</Label>
                        <Select
                          value={item.productId}
                          onValueChange={(value) =>
                            updateLineItem(item.id, "productId", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-4">
                        <Label>Description *</Label>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateLineItem(item.id, "description", e.target.value)
                          }
                          placeholder="Item description"
                          required
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Quantity *</Label>
                        <Input
                          type="number"
                          min="1"
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
                        <Label>Unit Price *</Label>
                        <Input
                          type="number"
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
                          required
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
                        Line Total: ₹{(item.quantity * item.unitPrice).toLocaleString("en-IN")}
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
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) =>
                      setFormData({ ...formData, taxRate: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="discount">Discount (₹)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) =>
                      setFormData({ ...formData, discount: e.target.value })
                    }
                  />
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{calculateSubtotal().toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax ({formData.taxRate}%)</span>
                    <span>₹{calculateTax().toLocaleString("en-IN")}</span>
                  </div>
                  {parseFloat(formData.discount) > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount</span>
                      <span>-₹{parseFloat(formData.discount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>₹{calculateTotal().toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !formData.customerId || !formData.dueDate}
                >
                  {isSubmitting ? "Creating..." : "Create Invoice"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
