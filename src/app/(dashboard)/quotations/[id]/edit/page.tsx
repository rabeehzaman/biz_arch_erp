"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { CustomerCombobox } from "@/components/invoices/customer-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";

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
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    customerId: "",
    issueDate: "",
    validUntil: "",
    taxRate: "0",
    notes: "",
    terms: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const formRef = useRef<HTMLFormElement>(null);
  const quantityRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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
    fetchQuotation();
  }, [id]);

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

  const fetchQuotation = async () => {
    try {
      const response = await fetch(`/api/quotations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          customerId: data.customer.id,
          issueDate: data.issueDate.split("T")[0],
          validUntil: data.validUntil.split("T")[0],
          taxRate: String(data.taxRate),
          notes: data.notes || "",
          terms: data.terms || "",
        });
        setLineItems(
          data.items.map((item: { id: string; product: { id: string } | null; quantity: number; unitPrice: number; discount: number }) => ({
            id: item.id,
            productId: item.product?.id || "",
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            discount: Number(item.discount),
          }))
        );
      } else {
        toast.error("Quotation not found");
        router.push("/quotations");
      }
    } catch (error) {
      console.error("Failed to fetch quotation:", error);
      toast.error("Failed to load quotation");
      router.push("/quotations");
    } finally {
      setIsLoading(false);
    }
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        productId: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
      },
    ]);
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
          if (isLastItem) {
            shouldAddNewLine = true;
          }
          return {
            ...item,
            productId: value as string,
            unitPrice: Number(product.price),
          };
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
            id: Date.now().toString(),
            productId: "",
            quantity: 1,
            unitPrice: 0,
            discount: 0,
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
    return (calculateSubtotal() * parseFloat(formData.taxRate || "0")) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = lineItems.filter((item) => item.productId);

    if (validItems.length === 0) {
      toast.error("Please add at least one product to the quotation");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/quotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          issueDate: formData.issueDate,
          validUntil: formData.validUntil,
          taxRate: parseFloat(formData.taxRate) || 0,
          notes: formData.notes || null,
          terms: formData.terms || null,
          items: validItems.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              description: product?.name || "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
            };
          }),
        }),
      });

      if (response.ok) {
        toast.success("Quotation updated");
        router.push(`/quotations/${id}`);
      } else {
        toast.error("Failed to update quotation");
      }
    } catch (error) {
      console.error("Failed to update quotation:", error);
      toast.error("Failed to update quotation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/quotations/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Edit Quotation</h2>
          <p className="text-slate-500">Update quotation details</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quotation Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer *</Label>
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
                <Label htmlFor="issueDate">Issue Date *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  min={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, validUntil: e.target.value })
                  }
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardAction>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </CardAction>
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
                        onSelect={() => focusQuantity(item.id)}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:contents">
                    <div className="sm:col-span-2">
                      <Label>Quantity *</Label>
                      <Input
                        ref={(el) => {
                          if (el) {
                            quantityRefs.current.set(item.id, el);
                          } else {
                            quantityRefs.current.delete(item.id);
                          }
                        }}
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
                      Line Total: ₹{(item.quantity * item.unitPrice * (1 - item.discount / 100)).toLocaleString("en-IN")}
                      {item.discount > 0 && (
                        <span className="ml-2 text-green-600">(-{item.discount}%)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>₹{calculateTotal().toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button
                  type="submit"
                  disabled={isSubmitting || !formData.customerId || !formData.issueDate || !formData.validUntil || !lineItems.some(item => item.productId)}
                >
                  {isSubmitting ? "Updating..." : "Update Quotation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
