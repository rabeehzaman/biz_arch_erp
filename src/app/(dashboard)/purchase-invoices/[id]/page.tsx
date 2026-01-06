"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, Download, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PurchaseInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  discount: number;
  total: number;
  product: {
    name: string;
  } | null;
  stockLot: {
    id: string;
    remainingQuantity: number;
  } | null;
}

interface PurchaseInvoice {
  id: string;
  purchaseInvoiceNumber: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  invoiceDate: string;
  dueDate: string;
  supplierInvoiceRef: string | null;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  items: PurchaseInvoiceItem[];
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  RECEIVED: "default",
  PAID: "default",
  PARTIALLY_PAID: "default",
  CANCELLED: "secondary",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  PAID: "Paid",
  PARTIALLY_PAID: "Partial",
  CANCELLED: "Cancelled",
};

export default function PurchaseInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else {
        router.push("/purchase-invoices");
      }
    } catch (error) {
      console.error("Failed to fetch purchase invoice:", error);
      router.push("/purchase-invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update");
      fetchInvoice();
      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error("Failed to update status:", error);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/purchase-invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-invoice-${invoice?.purchaseInvoiceNumber}-${format(
        new Date(),
        "yyyy-MM-dd"
      )}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF");
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header - Hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/purchase-invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Purchase Invoice {invoice.purchaseInvoiceNumber}
            </h2>
            <p className="text-slate-500">
              Dated {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Document */}
      <Card className="print:shadow-none print:border-none">
        <CardContent className="p-8">
          {/* Company & Invoice Info */}
          <div className="flex justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">BizArch ERP</h1>
                <p className="text-sm text-slate-500">Purchase Invoice</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">{invoice.purchaseInvoiceNumber}</h2>
              <Badge variant={statusColors[invoice.status] as "default" | "secondary" | "destructive"}>
                {statusLabels[invoice.status]}
              </Badge>
              {invoice.supplierInvoiceRef && (
                <p className="text-sm text-slate-500 mt-1">
                  Ref: {invoice.supplierInvoiceRef}
                </p>
              )}
            </div>
          </div>

          {/* Supplier & Dates */}
          <div className="grid sm:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2">
                Supplier
              </h3>
              <div>
                <p className="font-semibold">{invoice.supplier.name}</p>
                {invoice.supplier.email && (
                  <p className="text-sm text-slate-600">{invoice.supplier.email}</p>
                )}
                {invoice.supplier.phone && (
                  <p className="text-sm text-slate-600">{invoice.supplier.phone}</p>
                )}
                {invoice.supplier.address && (
                  <p className="text-sm text-slate-600">
                    {invoice.supplier.address}
                    {invoice.supplier.city && `, ${invoice.supplier.city}`}
                    {invoice.supplier.state && `, ${invoice.supplier.state}`}
                    {invoice.supplier.zipCode && ` - ${invoice.supplier.zipCode}`}
                  </p>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-slate-500">Purchase Date:</span>{" "}
                  <span className="font-medium">
                    {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                  </span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-500">Due Date:</span>{" "}
                  <span className="font-medium">
                    {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right print:hidden">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right">
                    ₹{Number(item.unitCost).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(item.discount) > 0 ? (
                      <span className="text-green-600">{Number(item.discount)}%</span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    ₹{Number(item.total).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right print:hidden">
                    {item.stockLot && (
                      <div className="flex items-center justify-end gap-1">
                        <Package className="h-4 w-4 text-green-600" />
                        <span className="text-green-600">
                          {Number(item.stockLot.remainingQuantity)} remaining
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="flex justify-end mt-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>₹{Number(invoice.subtotal).toLocaleString("en-IN")}</span>
              </div>
              {Number(invoice.taxRate) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax ({Number(invoice.taxRate)}%)</span>
                  <span>₹{Number(invoice.taxAmount).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>₹{Number(invoice.total).toLocaleString("en-IN")}</span>
              </div>
              {Number(invoice.amountPaid) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid</span>
                  <span>₹{Number(invoice.amountPaid).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Balance Due</span>
                <span className={Number(invoice.balanceDue) > 0 ? "text-orange-600" : "text-green-600"}>
                  ₹{Number(invoice.balanceDue).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-8 pt-8 border-t">
              <h3 className="text-sm font-semibold text-slate-500 mb-2">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
