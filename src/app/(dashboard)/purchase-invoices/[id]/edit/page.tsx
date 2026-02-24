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
import { SupplierCombobox } from "@/components/invoices/supplier-combobox";
import { ProductCombobox } from "@/components/invoices/product-combobox";
import { PageAnimation } from "@/components/ui/page-animation";

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

export default function EditPurchaseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    supplierId: "",
    invoiceDate: "",
    dueDate: "",
    supplierInvoiceRef: "",
    taxRate: "0",
    notes: "",
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
    fetchSuppliers();
    fetchProducts();
    fetchInvoice();
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

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          supplierId: data.supplier.id,
          invoiceDate: data.invoiceDate.split("T")[0],
          dueDate: data.dueDate.split("T")[0],
          supplierInvoiceRef: data.supplierInvoiceRef || "",
          taxRate: String(data.taxRate),
          notes: data.notes || "",
        });
        setLineItems(
          data.items.map((item: { id: string; product: { id: string } | null; quantity: number; unitCost: number; discount: number }) => ({
            id: item.id,
            productId: item.product?.id || "",
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            discount: Number(item.discount),
          }))
        );
      } else {
        toast.error("Purchase invoice not found");
        router.push("/purchase-invoices");
      }
    } catch (error) {
      console.error("Failed to fetch purchase invoice:", error);
      toast.error("Failed to load purchase invoice");
      router.push("/purchase-invoices");
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
            unitCost: Number(product.cost) || Number(product.price),
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
            unitCost: 0,
            discount: 0,
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
    return (calculateSubtotal() * parseFloat(formData.taxRate || "0")) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validItems = lineItems.filter((item) => item.productId);

    if (validItems.length === 0) {
      toast.error("Please add at least one product to the purchase invoice");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/purchase-invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          supplierInvoiceRef: formData.supplierInvoiceRef || null,
          taxRate: parseFloat(formData.taxRate) || 0,
          notes: formData.notes || null,
          items: validItems.map((item) => {
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
        toast.success("Purchase invoice updated");
        router.push(`/purchase-invoices/${id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update purchase invoice");
      }
    } catch (error) {
      console.error("Failed to update purchase invoice:", error);
      toast.error("Failed to update purchase invoice");
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
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/purchase-invoices/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Edit Purchase Invoice</h2>
            <p className="text-slate-500">Update purchase invoice details</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
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

            <Card>
              <CardHeader>
                <CardTitle>Purchase Items</CardTitle>
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
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label>Unit Cost *</Label>
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
                            required
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label>Disc %</Label>
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

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
                  <p className="font-medium">Stock Update</p>
                  <p className="text-blue-600">
                    Updating this purchase invoice will automatically adjust stock levels for the selected products.
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
                    {isSubmitting ? "Updating..." : "Update Purchase Invoice"}
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
