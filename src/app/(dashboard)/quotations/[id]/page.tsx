"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, Download, FileCheck, Ban, Info, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface QuotationItem {
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

interface Quotation {
  id: string;
  quotationNumber: string;
  status: "SENT" | "CONVERTED" | "CANCELLED" | "EXPIRED";
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
  validUntil: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  total: number;
  notes: string | null;
  terms: string | null;
  items: QuotationItem[];
  convertedInvoice?: {
    id: string;
    invoiceNumber: string;
  } | null;
  convertedAt?: string | null;
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
}

export default function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void; variant?: "default" | "destructive"; confirmLabel?: string } | null>(null);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      const response = await fetch(`/api/quotations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setQuotation(data);
      } else {
        router.push("/quotations");
      }
    } catch (error) {
      console.error("Failed to fetch quotation:", error);
      router.push("/quotations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/quotations/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quotation-${quotation?.quotationNumber}-${format(
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

  const handlePrint = async () => {
    try {
      const response = await fetch(`/api/quotations/${id}/pdf`);
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
      toast.error("Failed to print quotation");
      console.error(error);
    }
  };

  const handleConvertToInvoice = async () => {
    setConfirmDialog({
      title: "Convert to Invoice",
      description: "Convert this quotation to an invoice? This action cannot be undone.",
      variant: "default",
      confirmLabel: "Convert to Invoice",
      onConfirm: async () => {
        setIsConverting(true);
        try {
          const response = await fetch(`/api/quotations/${id}/convert`, {
            method: "POST",
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to convert");
          }

          const invoice = await response.json();
          toast.success("Quotation converted to invoice");
          router.push(`/invoices/${invoice.id}`);
        } catch (error: any) {
          toast.error(error.message || "Failed to convert quotation");
          console.error(error);
        } finally {
          setIsConverting(false);
        }
      },
    });
  };

  const handleCancelQuotation = async () => {
    setConfirmDialog({
      title: "Cancel Quotation",
      description: "Cancel this quotation? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/quotations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "CANCELLED" }),
          });

          if (!response.ok) throw new Error("Failed to cancel");

          fetchQuotation();
          toast.success("Quotation cancelled");
        } catch (error) {
          toast.error("Failed to cancel quotation");
          console.error(error);
        }
      },
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      SENT: "bg-blue-500",
      CONVERTED: "bg-green-500",
      CANCELLED: "bg-gray-500",
      EXPIRED: "bg-red-500",
    };

    return (
      <Badge className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const isExpired = quotation && new Date() > new Date(quotation.validUntil);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <PageAnimation>
      <div className="space-y-6 print:space-y-4">
        {/* Header - Hidden on print */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-4">
            <Link href="/quotations">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                Quotation {quotation.quotationNumber}
                {getStatusBadge(quotation.status)}
              </h2>
              <p className="text-slate-500">
                Created on {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                {" • "}
                Valid until {format(new Date(quotation.validUntil), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quotation.status !== "CONVERTED" && (
              <Link href={`/quotations/${id}/edit`}>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
            )}
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {quotation.status === "SENT" && !isExpired && (
              <>
                <Button onClick={handleConvertToInvoice} disabled={isConverting}>
                  <FileCheck className="mr-2 h-4 w-4" />
                  {isConverting ? "Converting..." : "Convert to Invoice"}
                </Button>
                <Button variant="destructive" onClick={handleCancelQuotation}>
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Converted Invoice Alert */}
        {quotation.status === "CONVERTED" && quotation.convertedInvoice && (
          <Alert className="print:hidden">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This quotation was converted to invoice{" "}
              <Link
                href={`/invoices/${quotation.convertedInvoice.id}`}
                className="font-medium underline"
              >
                {quotation.convertedInvoice.invoiceNumber}
              </Link>
              {quotation.convertedAt &&
                ` on ${format(new Date(quotation.convertedAt), "dd MMM yyyy")}`}
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Alert */}
        {isExpired && quotation.status === "SENT" && (
          <Alert variant="destructive" className="print:hidden">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This quotation expired on {format(new Date(quotation.validUntil), "dd MMM yyyy")}
            </AlertDescription>
          </Alert>
        )}

        {/* Quotation Document */}
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-4 sm:p-8 print:p-0">
            {/* Company Header */}
            <div className="flex items-start justify-between mb-8 print:mb-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-3">
                  <Building2 className="h-6 w-6 text-slate-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 print:text-xl">
                    BizArch ERP
                  </h1>
                  <p className="text-slate-600">Quotation</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-600">Quotation Number</div>
                <div className="text-lg font-bold">{quotation.quotationNumber}</div>
              </div>
            </div>

            {/* Customer & Dates */}
            <div className="grid grid-cols-2 gap-8 mb-8 print:mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">
                  Quotation To
                </h3>
                <div className="text-slate-900">
                  <div className="font-semibold">{quotation.customer.name}</div>
                  {quotation.customer.email && (
                    <div className="text-sm text-slate-600">
                      {quotation.customer.email}
                    </div>
                  )}
                  {quotation.customer.phone && (
                    <div className="text-sm text-slate-600">
                      {quotation.customer.phone}
                    </div>
                  )}
                  {quotation.customer.address && (
                    <div className="text-sm text-slate-600 mt-1">
                      {quotation.customer.address}
                      {quotation.customer.city && `, ${quotation.customer.city}`}
                      {quotation.customer.state && `, ${quotation.customer.state}`}
                      {quotation.customer.zipCode && ` ${quotation.customer.zipCode}`}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-4">
                  <div className="text-sm text-slate-600">Issue Date</div>
                  <div className="font-medium">
                    {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">Valid Until</div>
                  <div className="font-medium">
                    {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                  </div>
                </div>
                {quotation.branch && (
                  <div className="mt-4">
                    <div className="text-sm text-slate-600">Branch</div>
                    <div className="font-medium">{quotation.branch.name}</div>
                  </div>
                )}
                {quotation.warehouse && (
                  <div className="mt-2">
                    <div className="text-sm text-slate-600">Warehouse</div>
                    <div className="font-medium">{quotation.warehouse.name}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Line Items */}
            <Table className="print:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotation.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">
                      {Number(item.quantity).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      ₹{Number(item.unitPrice).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.discount)}%
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{Number(item.total).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Totals */}
            <div className="flex justify-end mt-6 print:mt-4">
              <div className="w-full sm:w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium">
                    ₹{Number(quotation.subtotal).toLocaleString("en-IN")}
                  </span>
                </div>
                {Number(quotation.totalCgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">CGST</span>
                    <span className="font-medium">₹{Number(quotation.totalCgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(quotation.totalSgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">SGST</span>
                    <span className="font-medium">₹{Number(quotation.totalSgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(quotation.totalIgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">IGST</span>
                    <span className="font-medium">₹{Number(quotation.totalIgst).toLocaleString("en-IN")}</span>
                  </div>
                )}
                {Number(quotation.totalCgst) === 0 && Number(quotation.totalSgst) === 0 && Number(quotation.totalIgst) === 0 && Number(quotation.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Tax</span>
                    <span className="font-medium">₹{Number(quotation.taxAmount).toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>₹{Number(quotation.total).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            {(quotation.notes || quotation.terms) && (
              <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t print:mt-6">
                {quotation.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">
                      Notes
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {quotation.notes}
                    </p>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">
                      Terms & Conditions
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {quotation.terms}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        {confirmDialog && (
          <ConfirmDialog
            open={!!confirmDialog}
            onOpenChange={(open) => !open && setConfirmDialog(null)}
            title={confirmDialog.title}
            description={confirmDialog.description}
            variant={confirmDialog.variant}
            confirmLabel={confirmDialog.confirmLabel}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          />
        )}
      </div>
    </PageAnimation>
  );
}
