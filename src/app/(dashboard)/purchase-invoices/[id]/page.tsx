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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JournalEntryTab } from "@/components/journal-entry-tab";
import { ArrowLeft, Building2, CreditCard, Download, Loader2, Package, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";

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
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOffAmount: number;
  applyRoundOff: boolean;
  total: number;
  amountPaid: number;
  balanceDue: number;
  notes: string | null;
  isTaxInclusive: boolean | null;
  items: PurchaseInvoiceItem[];
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
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
  const { symbol } = useCurrency();
  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "CASH",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
  });

  useEffect(() => {
    fetchInvoice();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (invoice && Number(invoice.balanceDue) > 0) {
      setPaymentForm((prev) => ({ ...prev, amount: Number(invoice.balanceDue).toFixed(2) }));
    }
  }, [invoice]);

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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setIsRecordingPayment(true);
    try {
      const response = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: invoice.supplier.id,
          purchaseInvoiceId: invoice.id,
          amount: parseFloat(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference || undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to record payment");
      }
      toast.success("Payment recorded successfully");
      setIsPaymentDialogOpen(false);
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setIsRecordingPayment(false);
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
    setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch(`/api/purchase-invoices/${id}/pdf`);
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
    } finally {
      setIsPrinting(false);
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
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
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
              {invoice.isTaxInclusive !== null && (
                <span className="text-xs text-muted-foreground">
                  {invoice.isTaxInclusive ? "Tax Inclusive" : "Tax Exclusive"}
                </span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={invoice.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[150px]">
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
            {Number(invoice.balanceDue) > 0 && (
              <Button onClick={() => setIsPaymentDialogOpen(true)} className="w-full sm:w-auto">
                <CreditCard className="mr-2 h-4 w-4" />
                Record Payment
              </Button>
            )}
            <Link href={`/purchase-invoices/${id}/edit`} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={isDownloading} className="w-full sm:w-auto">
              {isDownloading
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Download className="mr-2 h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Download PDF"}
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={isPrinting} className="w-full sm:w-auto">
              {isPrinting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Printer className="mr-2 h-4 w-4" />}
              {isPrinting ? "Printing..." : "Print"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="invoice" className="w-full">
          <TabsList className="print:hidden h-auto min-w-full justify-start gap-1 rounded-xl p-1 sm:min-w-0 sm:w-fit">
            <TabsTrigger value="invoice" className="shrink-0">Invoice</TabsTrigger>
            <TabsTrigger value="journal" className="shrink-0">Journal</TabsTrigger>
          </TabsList>

          <TabsContent value="invoice">
        {/* Invoice Document */}
        <Card className="print:shadow-none print:border-none">
          <CardContent className="p-4 sm:p-8">
            {/* Company & Invoice Info */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">BizArch ERP</h1>
                  <p className="text-sm text-slate-500">Purchase Invoice</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
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
            <div className="mb-8 grid gap-8 sm:grid-cols-2">
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

            {/* Line Items — Desktop */}
            <div className="hidden sm:block">
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
                        {symbol}{Number(item.unitCost).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.discount) > 0 ? (
                          <span className="text-green-600">{Number(item.discount)}%</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {symbol}{Number(item.total).toLocaleString("en-IN")}
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
            </div>

            {/* Line Items — Mobile */}
            <div className="sm:hidden divide-y divide-slate-200 border rounded-lg">
              {invoice.items.map((item) => (
                <div key={item.id} className="p-3 space-y-1">
                  <div className="font-medium text-sm">{item.description}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>Qty: {Number(item.quantity)}</span>
                    <span>Cost: {symbol}{Number(item.unitCost).toLocaleString("en-IN")}</span>
                    {Number(item.discount) > 0 && (
                      <span className="text-green-600">Discount: {Number(item.discount)}%</span>
                    )}
                    {item.stockLot && (
                      <span className="text-green-600">
                        Stock: {Number(item.stockLot.remainingQuantity)} left
                      </span>
                    )}
                  </div>
                  <div className="text-right font-semibold text-sm">
                    {symbol}{Number(item.total).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end mt-6">
              <div className="w-full sm:w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{symbol}{Number(invoice.subtotal).toLocaleString("en-IN")}</span>
                </div>
                {Number(invoice.totalCgst) > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>CGST</span>
                    <span>{symbol}{Number(invoice.totalCgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(invoice.totalSgst) > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>SGST</span>
                    <span>{symbol}{Number(invoice.totalSgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(invoice.totalIgst) > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>IGST</span>
                    <span>{symbol}{Number(invoice.totalIgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(invoice.totalCgst) === 0 && Number(invoice.totalSgst) === 0 && Number(invoice.totalIgst) === 0 && Number(invoice.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Tax</span>
                    <span>{symbol}{Number(invoice.taxAmount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {invoice.applyRoundOff && Number(invoice.roundOffAmount) !== 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Round Off</span>
                    <span>
                      {Number(invoice.roundOffAmount) >= 0 ? "+" : ""}
                      {symbol}{Number(invoice.roundOffAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{symbol}{Number(invoice.total).toLocaleString("en-IN")}</span>
                </div>
                {Number(invoice.amountPaid) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Amount Paid</span>
                    <span>{symbol}{Number(invoice.amountPaid).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Balance Due</span>
                  <span className={Number(invoice.balanceDue) > 0 ? "text-orange-600" : "text-green-600"}>
                    {symbol}{Number(invoice.balanceDue).toLocaleString("en-IN")}
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
          </TabsContent>

          <TabsContent value="journal">
            <JournalEntryTab sourceType="PURCHASE_INVOICE" sourceId={id} />
          </TabsContent>
        </Tabs>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleRecordPayment}>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
                <DialogDescription>
                  Record a payment for purchase invoice {invoice.purchaseInvoiceNumber}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Supplier</Label>
                  <p className="text-sm font-medium">{invoice.supplier.name}</p>
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
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" disabled={isRecordingPayment} className="w-full sm:w-auto">
                  {isRecordingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isRecordingPayment ? "Recording..." : "Record Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
