"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, Download, Pencil, Printer, CreditCard, Send } from "lucide-react";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

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
    vatNumber?: string | null;
    arabicName?: string | null;
  };
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  sentAt: string | null;
  notes: string | null;
  terms: string | null;
  items: InvoiceItem[];
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
  // Saudi e-Invoice fields
  saudiInvoiceType?: string | null;
  totalVat?: number | null;
  qrCodeData?: string | null;
  invoiceUuid?: string | null;
  invoiceCounterValue?: number | null;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "CASH",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
  });
  const [isMarkingSent, setIsMarkingSent] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  useEffect(() => {
    if (invoice && Number(invoice.balanceDue) > 0) {
      setPaymentForm((prev) => ({ ...prev, amount: Number(invoice.balanceDue).toFixed(2) }));
    }
  }, [invoice]);

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

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber}-${format(
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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: invoice.customer.id,
          invoiceId: invoice.id,
          amount: parseFloat(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to record payment");
      }

      toast.success("Payment recorded");
      setIsPaymentDialogOpen(false);
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    }
  };

  const handleMarkAsSent = async () => {
    if (!invoice) return;
    setIsMarkingSent(true);
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markSent" }),
      });
      if (!response.ok) throw new Error("Failed to mark as sent");
      toast.success("Invoice marked as sent");
      fetchInvoice();
    } catch {
      toast.error("Failed to mark invoice as sent");
    } finally {
      setIsMarkingSent(false);
    }
  };

  const handlePrint = async () => {
    try {
      const response = await fetch(`/api/invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    } catch (error) {
      toast.error("Failed to print invoice");
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
    <PageAnimation>
      <div className="space-y-6 print:space-y-4">
        {/* Header - Hidden on print */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
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
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/invoices/${id}/edit`}>
              <Button variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            {invoice && Number(invoice.balanceDue) > 0 && (
              <Button onClick={() => setIsPaymentDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            )}
            {invoice && !invoice.sentAt && Number(invoice.balanceDue) > 0 && (
              <Button variant="outline" onClick={handleMarkAsSent} disabled={isMarkingSent}>
                <Send className="mr-2 h-4 w-4" />
                Mark as Sent
              </Button>
            )}
            {invoice?.sentAt && (
              <span className="text-sm text-slate-500">
                Sent {format(new Date(invoice.sentAt), "dd MMM yyyy")}
              </span>
            )}
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Invoice Document */}
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-4 sm:p-8">
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
                  {invoice.branch && (
                    <p className="text-sm">
                      <span className="text-slate-500">Branch:</span>{" "}
                      <span className="font-medium">{invoice.branch.name}</span>
                    </p>
                  )}
                  {invoice.warehouse && (
                    <p className="text-sm">
                      <span className="text-slate-500">Warehouse:</span>{" "}
                      <span className="font-medium">{invoice.warehouse.name}</span>
                    </p>
                  )}
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
              <div className="w-full sm:w-64 space-y-2">
                {invoice.saudiInvoiceType && invoice.qrCodeData && (
                  <div className="flex flex-col items-end gap-1 mb-4">
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                      {invoice.saudiInvoiceType === "SIMPLIFIED" ? "Simplified Tax Invoice" : "Tax Invoice"} — ZATCA Phase 1
                    </span>
                    {invoice.invoiceCounterValue && (
                      <span className="text-xs text-slate-400">ICV: {invoice.invoiceCounterValue}</span>
                    )}
                    <div className="border p-1 bg-white" title="Scan to verify invoice (ZATCA Phase 1)">
                      <QRCode value={invoice.qrCodeData} size={96} level="M" />
                    </div>
                    <span className="text-[10px] text-slate-400">ZATCA Compliant QR</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{invoice.saudiInvoiceType ? "SAR" : "₹"}{Number(invoice.subtotal).toLocaleString(invoice.saudiInvoiceType ? "en-SA" : "en-IN")}</span>
                </div>
                {invoice.saudiInvoiceType ? (
                  Number(invoice.totalVat) > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>VAT (15%) — ضريبة القيمة المضافة</span>
                      <span>SAR {Number(invoice.totalVat).toFixed(2)}</span>
                    </div>
                  )
                ) : (
                  <>
                    {Number(invoice.totalCgst) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>CGST</span>
                        <span>₹{Number(invoice.totalCgst).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Number(invoice.totalSgst) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>SGST</span>
                        <span>₹{Number(invoice.totalSgst).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Number(invoice.totalIgst) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>IGST</span>
                        <span>₹{Number(invoice.totalIgst).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {Number(invoice.totalCgst) === 0 && Number(invoice.totalSgst) === 0 && Number(invoice.totalIgst) === 0 && Number(invoice.taxAmount) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Tax</span>
                        <span>₹{Number(invoice.taxAmount).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{invoice.saudiInvoiceType ? `SAR ${Number(invoice.total).toFixed(2)}` : `₹${Number(invoice.total).toLocaleString("en-IN")}`}</span>
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

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <form onSubmit={handleRecordPayment}>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Record a payment for invoice {invoice.invoiceNumber}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Customer</Label>
                  <p className="text-sm font-medium">{invoice.customer.name}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-amount">Amount *</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pay-date">Payment Date *</Label>
                    <Input
                      id="pay-date"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={paymentForm.paymentMethod}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CHECK">Check</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-ref">Reference</Label>
                  <Input
                    id="pay-ref"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder="Transaction ID, check #..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
