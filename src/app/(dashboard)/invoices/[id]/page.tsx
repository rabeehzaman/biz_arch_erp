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
import { ArrowLeft, Building2, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product: {
    name: string;
  } | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  terms: string | null;
  items: InvoiceItem[];
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  SENT: "default",
  PAID: "default",
  PARTIALLY_PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  PAID: "Paid",
  PARTIALLY_PAID: "Partial",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data);
      } else {
        router.push("/invoices");
      }
    } catch (error) {
      console.error("Failed to fetch invoice:", error);
      router.push("/invoices");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const response = await fetch(`/api/invoices/${id}`, {
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

  const handlePrint = () => {
    window.print();
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
          <Link href="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Invoice {invoice.invoiceNumber}
            </h2>
            <p className="text-slate-500">
              Created on {format(new Date(invoice.issueDate), "dd MMM yyyy")}
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
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
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
                <p className="text-sm text-slate-500">Invoice</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">{invoice.invoiceNumber}</h2>
              <Badge variant={statusColors[invoice.status] as "default" | "secondary" | "destructive"}>
                {statusLabels[invoice.status]}
              </Badge>
            </div>
          </div>

          {/* Bill To & Dates */}
          <div className="grid sm:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 mb-2">
                Bill To
              </h3>
              <div>
                <p className="font-semibold">{invoice.customer.name}</p>
                {invoice.customer.email && (
                  <p className="text-sm text-slate-600">{invoice.customer.email}</p>
                )}
                {invoice.customer.phone && (
                  <p className="text-sm text-slate-600">{invoice.customer.phone}</p>
                )}
                {invoice.customer.address && (
                  <p className="text-sm text-slate-600">
                    {invoice.customer.address}
                    {invoice.customer.city && `, ${invoice.customer.city}`}
                    {invoice.customer.state && `, ${invoice.customer.state}`}
                    {invoice.customer.zipCode && ` - ${invoice.customer.zipCode}`}
                  </p>
                )}
              </div>
            </div>
            <div className="sm:text-right">
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-slate-500">Issue Date:</span>{" "}
                  <span className="font-medium">
                    {format(new Date(invoice.issueDate), "dd MMM yyyy")}
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
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right">
                    ₹{Number(item.unitPrice).toLocaleString("en-IN")}
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
                <span className={Number(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"}>
                  ₹{Number(invoice.balanceDue).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(invoice.notes || invoice.terms) && (
            <div className="mt-8 pt-8 border-t grid sm:grid-cols-2 gap-8">
              {invoice.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">
                    Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
