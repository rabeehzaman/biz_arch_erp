"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

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
}

interface LineItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function NewCreditNotePage() {
  const router = useRouter();
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
  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      productId: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
    },
  ]);

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
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
      const response = await fetch("/api/products");
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      productId,
      description: product.name,
      unitPrice: product.price,
    };
    setItems(newItems);

    // Auto-add new line if this is the last item
    if (index === items.length - 1) {
      addItem();
    }
  };

  const updateItem = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => {
      if (!item.productId) return sum;
      return (
        sum + item.quantity * item.unitPrice * (1 - item.discount / 100)
      );
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error("Please select a customer");
      return;
    }

    const validItems = items.filter((item) => item.productId);
    if (validItems.length === 0) {
      toast.error("Please add at least one item");
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
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
          taxRate: 0,
          reason: reason || null,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create credit note");
      }

      const data = await response.json();
      toast.success("Credit note created successfully");
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
                New Credit Note
              </h2>
              <p className="text-slate-500">Create a new sales return</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Credit Note Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer *</Label>
                    <select
                      id="customer"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      required
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
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
                    <Label htmlFor="invoiceId">Original Invoice (Optional)</Label>
                    <Input
                      id="invoiceId"
                      placeholder="Leave blank for standalone credit note"
                      value={invoiceId}
                      onChange={(e) => setInvoiceId(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason for Return</Label>
                    <Input
                      id="reason"
                      placeholder="e.g., Damaged goods"
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
                  <Button type="button" onClick={addItem} variant="outline" size="sm">
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
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductSelect(index, e.target.value)}
                          className="rounded-md border border-input bg-background px-3 py-2"
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} {product.sku ? `(${product.sku})` : ""}
                            </option>
                          ))}
                        </select>

                        <div className="grid grid-cols-1 gap-2 sm:contents">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                        />

                        <Input
                          type="number"
                          placeholder="Unit Price"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          min="0"
                          step="0.01"
                        />

                        <Input
                          type="number"
                          placeholder="Discount %"
                          value={item.discount}
                          onChange={(e) =>
                            updateItem(index, "discount", parseFloat(e.target.value) || 0)
                          }
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
                              item.unitPrice *
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
                          onClick={() => removeItem(index)}
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
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>₹{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href="/credit-notes">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Credit Note"}
              </Button>
            </div>
          </form>
        </div>
        </PageAnimation>
      );
}
