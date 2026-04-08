"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/hooks/use-currency";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AttachmentDialog } from "@/components/attachments/attachment-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, Copy, Download, FileCheck, Ban, Info, Loader2, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";
import { downloadBlob } from "@/lib/download";

interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate?: number | null;
  vatAmount?: number | null;
  gstRate?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
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
  const { symbol, locale, fmt } = useCurrency();
  const router = useRouter();
  const { t } = useLanguage();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void; variant?: "default" | "destructive"; confirmLabel?: string } | null>(null);

  useEffect(() => {
    fetchQuotation();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/quotations/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      const filename = `quotation-${quotation?.quotationNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
      await downloadBlob(blob, filename);
      if (isCapacitorEnvironment()) toast.success(t("common.savedToDownloads"));
    } catch (error) {
      toast.error(t("common.pdfDownloadFailed"));
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch(`/api/quotations/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      if (isCapacitorEnvironment()) {
        const { capacitorPrintPdf } = await import("@/lib/capacitor-pdf-printer");
        await capacitorPrintPdf(blob, `Quotation ${quotation?.quotationNumber}`);
      } else {
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, "_blank");
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    } catch (error) {
      toast.error(t("common.printFailed"));
      console.error(error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleConvertToInvoice = async () => {
    setConfirmDialog({
      title: t("quotations.convertToInvoice"),
      description: `${t("quotations.convertConfirm")} ${t("common.thisActionCannot")}`,
      variant: "default",
      confirmLabel: t("quotations.convertToInvoice"),
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
          router.push(`/invoices/${invoice.id}`);
        } catch (error: any) {
          toast.error(error.message || t("quotations.failedToConvert"));
          console.error(error);
        } finally {
          setIsConverting(false);
        }
      },
    });
  };

  const handleCancelQuotation = async () => {
    setConfirmDialog({
      title: t("quotations.cancelQuotation"),
      description: `${t("quotations.cancelConfirm")} ${t("common.thisActionCannot")}`,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/quotations/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "CANCELLED" }),
          });

          if (!response.ok) throw new Error("Failed to cancel");

          fetchQuotation();
        } catch (error) {
          toast.error(t("quotations.failedToCancel"));
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

    const statusLabels: Record<string, string> = {
      SENT: t("common.sent2"),
      CONVERTED: t("common.converted"),
      CANCELLED: t("common.cancelled"),
      EXPIRED: t("common.expired"),
    };

    return (
      <Badge className={colors[status]}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  const isExpired = quotation && new Date() > new Date(quotation.validUntil);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">{t("common.loading")}</div>
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <PageAnimation>
      <div className="space-y-4 print:space-y-4 sm:space-y-6">
        {/* Header - Hidden on print */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
            <Link href="/quotations">
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:size-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 sm:text-2xl">
                {t("quotations.quotation")} {quotation.quotationNumber}
                {getStatusBadge(quotation.status)}
              </h2>
              <p className="text-sm text-slate-500">
                {t("common.createdOn")} {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                {" • "}
                {t("quotations.validUntil")} {format(new Date(quotation.validUntil), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap">
            {quotation.status !== "CONVERTED" && (
              <Link href={`/quotations/${id}/edit`} className="col-span-1 sm:w-auto">
                <Button variant="outline" size="sm" className="h-9 w-full sm:h-10 sm:w-auto">
                  <Pencil className="h-4 w-4 sm:mr-2" />
                  {t("common.edit")}
                </Button>
              </Link>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/quotations/new?duplicate=${quotation.id}`)} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="sm:inline">{t("common.duplicate")}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloading} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              {isDownloading
                ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                : <Download className="h-4 w-4 sm:mr-2" />}
              <span className="sm:hidden">{isDownloading ? "..." : "PDF"}</span>
              <span className="hidden sm:inline">{isDownloading ? t("common.downloading") : t("common.downloadPDF")}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              {isPrinting
                ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                : <Printer className="h-4 w-4 sm:mr-2" />}
              <span>{isPrinting ? "..." : t("common.print")}</span>
            </Button>
            {quotation.status === "SENT" && !isExpired && (
              <>
                <Button onClick={handleConvertToInvoice} disabled={isConverting} size="sm" className="col-span-2 h-9 w-full sm:h-10 sm:w-auto">
                  <FileCheck className="h-4 w-4 sm:mr-2" />
                  <span className="sm:hidden">{isConverting ? "..." : t("common.converted")}</span>
                  <span className="hidden sm:inline">{isConverting ? t("quotations.converting") : t("quotations.convertToInvoice")}</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancelQuotation} className="col-span-2 h-9 w-full sm:h-10 sm:w-auto">
                  <Ban className="h-4 w-4 sm:mr-2" />
                  {t("common.cancel")}
                </Button>
              </>
            )}
            <AttachmentDialog documentType="quotation" documentId={quotation.id} />
          </div>
        </div>

        {/* Converted Invoice Alert */}
        {quotation.status === "CONVERTED" && quotation.convertedInvoice && (
          <Alert className="print:hidden">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t("quotations.convertedAlert")}{" "}
              <Link
                href={`/invoices/${quotation.convertedInvoice.id}`}
                className="font-medium underline"
              >
                {quotation.convertedInvoice.invoiceNumber}
              </Link>
              {quotation.convertedAt &&
                ` ${t("quotations.convertedToInvoiceOn")} ${format(new Date(quotation.convertedAt), "dd MMM yyyy")}`}
            </AlertDescription>
          </Alert>
        )}

        {/* Expired Alert */}
        {isExpired && quotation.status === "SENT" && (
          <Alert variant="destructive" className="print:hidden">
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t("quotations.expiredOn")} {format(new Date(quotation.validUntil), "dd MMM yyyy")}
            </AlertDescription>
          </Alert>
        )}

        {/* Quotation Document */}
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-4 sm:p-8 print:p-0">
            {/* Company Header */}
            <div className="mb-5 flex flex-col gap-3 print:mb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-100 p-2.5 sm:p-3">
                  <Building2 className="h-5 w-5 text-slate-600 sm:h-6 sm:w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 print:text-xl sm:text-2xl">
                    BizArch ERP
                  </h1>
                  <p className="text-slate-600">{t("quotations.quotation")}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-sm text-slate-600">{t("quotations.quotationNumber")}</div>
                <div className="text-lg font-bold">{quotation.quotationNumber}</div>
              </div>
            </div>

            {/* Customer & Dates */}
            <div className="mb-5 grid gap-4 print:mb-6 sm:mb-8 sm:grid-cols-2 sm:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-600 mb-2">
                  {t("quotations.quotationTo")}
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
                  <div className="text-sm text-slate-600">{t("sales.issueDate")}</div>
                  <div className="font-medium">
                    {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-slate-600">{t("quotations.validUntil")}</div>
                  <div className="font-medium">
                    {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                  </div>
                </div>
                {quotation.branch && (
                  <div className="mt-4">
                    <div className="text-sm text-slate-600">{t("common.branch")}</div>
                    <div className="font-medium">{quotation.branch.name}</div>
                  </div>
                )}
                {quotation.warehouse && (
                  <div className="mt-2">
                    <div className="text-sm text-slate-600">{t("common.warehouse")}</div>
                    <div className="font-medium">{quotation.warehouse.name}</div>
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const hasGst = Number(quotation.totalCgst) > 0 || Number(quotation.totalSgst) > 0 || Number(quotation.totalIgst) > 0;
              const hasTax = hasGst || Number(quotation.taxAmount) > 0;
              const getItemTax = (item: QuotationItem) =>
                Number(item.vatAmount || 0) + Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0) + Number(item.igstAmount || 0);
              return (
                <>
            {/* Line Items — Desktop */}
            <div className="hidden sm:block">
              <Table className="print:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.qty")}</TableHead>
                    <TableHead className="text-right">{t("common.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("common.discount")}</TableHead>
                    {hasTax ? (
                      <>
                        <TableHead className="text-right">{t("common.grossAmount")}</TableHead>
                        <TableHead className="text-right">{t("common.netAmount")}</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">{t("common.total")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items.map((item) => {
                    const itemTax = getItemTax(item);
                    return (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {Number(item.quantity).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        {symbol}{Number(item.unitPrice).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.discount)}%
                      </TableCell>
                      {hasTax ? (
                        <>
                          <TableCell className="text-right text-slate-500">
                            {symbol}{Number(item.total).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {fmt(Number(item.total) + itemTax)}
                            {itemTax > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                ({t("common.gst")}: {fmt(itemTax)})
                              </div>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-right font-medium">
                          {symbol}{Number(item.total).toLocaleString(locale)}
                        </TableCell>
                      )}
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Line Items — Mobile */}
            <div className="sm:hidden divide-y divide-slate-200 border rounded-lg">
              {quotation.items.map((item) => {
                const itemTax = getItemTax(item);
                return (
                <div key={item.id} className="p-3 space-y-1">
                  <div className="font-medium text-sm">{item.description}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{t("common.qty")}: {Number(item.quantity).toLocaleString(locale)}</span>
                    <span>{t("common.price")}: {symbol}{Number(item.unitPrice).toLocaleString(locale)}</span>
                    {Number(item.discount) > 0 && (
                      <span className="text-green-600">{t("common.discount")}: {Number(item.discount)}%</span>
                    )}
                  </div>
                  <div className="text-right font-semibold text-sm">
                    {hasTax ? fmt(Number(item.total) + itemTax) : `${symbol}${Number(item.total).toLocaleString(locale)}`}
                    {hasTax && itemTax > 0 && (
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({t("common.gst")}: {fmt(itemTax)})
                      </span>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
                </>
              );
            })()}

            {/* Totals */}
            <div className="flex justify-end mt-6 print:mt-4">
              <div className="w-full sm:w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t("common.subtotal")}</span>
                  <span className="font-medium">
                    {symbol}{Number(quotation.subtotal).toLocaleString(locale)}
                  </span>
                </div>
                {Number(quotation.totalCgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t("common.cgst")}</span>
                    <span className="font-medium">{symbol}{Number(quotation.totalCgst).toLocaleString(locale)}</span>
                  </div>
                )}
                {Number(quotation.totalSgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t("common.sgst")}</span>
                    <span className="font-medium">{symbol}{Number(quotation.totalSgst).toLocaleString(locale)}</span>
                  </div>
                )}
                {Number(quotation.totalIgst) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t("common.igst")}</span>
                    <span className="font-medium">{symbol}{Number(quotation.totalIgst).toLocaleString(locale)}</span>
                  </div>
                )}
                {Number(quotation.totalCgst) === 0 && Number(quotation.totalSgst) === 0 && Number(quotation.totalIgst) === 0 && Number(quotation.taxAmount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">{t("common.tax")}</span>
                    <span className="font-medium">{symbol}{Number(quotation.taxAmount).toLocaleString(locale)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>{t("common.total")}</span>
                  <span>{symbol}{Number(quotation.total).toLocaleString(locale)}</span>
                </div>
              </div>
            </div>

            {/* Notes and Terms */}
            {(quotation.notes || quotation.terms) && (
              <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t print:mt-6">
                {quotation.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">
                      {t("common.notes")}
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {quotation.notes}
                    </p>
                  </div>
                )}
                {quotation.terms && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 mb-2">
                      {t("common.termsAndConditions")}
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
