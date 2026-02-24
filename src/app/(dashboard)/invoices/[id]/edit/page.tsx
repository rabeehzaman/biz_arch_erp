"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
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
  availableStock?: number;
}

interface LineItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export default function EditInvoicePage({
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
    date: "",
    dueDate: "",
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

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          customerId: data.customer.id,
          date: data.issueDate.split("T")[0],
          dueDate: data.dueDate.split("T")[0],
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
        toast.error("Invoice not found");
        router.push("/invoices");
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      toast.error("Failed to load invoice");
      router.push("/invoices");
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
      toast.error("Please add at least one product to the invoice");
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
        const data = await response.json();
        const warnings = data.warnings || [];

        // Display warnings if any
        if (warnings.length > 0) {
          warnings.forEach((warning: string) => {
            toast.warning(warning, { duration: 6000 });
          });
        }

        toast.success("Invoice updated");
        router.push(`/invoices/${id}`);
      } else {
        toast.error("Failed to update invoice");
      }
    } catch (error) {
      console.error("Failed to update invoice:", error);
      toast.error("Failed to update invoice");
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
          <Link href={`/invoices/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Edit Invoice</h2>
            <p className="text-slate-500">Update invoice details</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
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
              <CardContent className="p-0 border-t border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[40%] font-semibold">Product *</TableHead>
                      <TableHead className="w-[15%] font-semibold">Quantity *</TableHead>
                      <TableHead className="w-[15%] font-semibold">Unit Price *</TableHead>
                      <TableHead className="w-[10%] font-semibold">Disc %</TableHead>
                      <TableHead className="text-right font-semibold">Line Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => {
                      const product = products.find((p) => p.id === item.productId);
                      const availableStock = product?.availableStock ?? 0;
                      const hasStockShortfall = item.productId && item.quantity > availableStock;
                      const shortfall = item.quantity - availableStock;

                      return (
                        <TableRow key={item.id} className="group hover:bg-slate-50 border-b">
                          <TableCell className="align-top p-2 border-r border-slate-100 last:border-0">
                            <ProductCombobox
                              products={products}
                              value={item.productId}
                              onValueChange={(value) =>
                                updateLineItem(item.id, "productId", value)
                              }
                              onSelect={() => focusQuantity(item.id)}
                            />
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
                              className="border-0 focus-visible:ring-1 rounded-sm bg-transparent transition-colors hover:bg-slate-100"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="text-right align-top p-2 py-4 text-sm text-slate-500 border-r border-slate-100 last:border-0">
                            ₹{(item.quantity * item.unitPrice * (1 - item.discount / 100)).toLocaleString("en-IN")}
                            {item.discount > 0 && (
                              <div className="text-xs text-green-600">(-{item.discount}%)</div>
                            )}
                          </TableCell>
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
                    disabled={isSubmitting || !formData.customerId || !formData.date || !lineItems.some(item => item.productId)}
                  >
                    {isSubmitting ? "Updating..." : "Update Invoice"}
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
