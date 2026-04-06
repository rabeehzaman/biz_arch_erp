"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JournalEntryTab } from "@/components/journal-entry-tab";
import { ArrowLeft, Building2, ChevronDown, Copy, Download, Eye, Loader2, Pencil, Printer, Receipt, CreditCard, Send, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QRCode from "react-qr-code";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { shareContent } from "@/lib/capacitor-share";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";
import { printInvoiceReceipt } from "@/lib/print-invoice-receipt";
import type { InvoiceReceiptData } from "@/components/invoices/invoice-receipt";

interface InvoiceItem {
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
  roundOffAmount: number;
  applyRoundOff: boolean;
  total: number;
  amountPaid: number;
  balanceDue: number;
  sentAt: string | null;
  notes: string | null;
  terms: string | null;
  paymentType: string;
  items: InvoiceItem[];
  payments?: {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference: string | null;
  }[];
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
  // Saudi e-Invoice fields
  saudiInvoiceType?: string | null;
  totalVat?: number | null;
  qrCodeData?: string | null;
  invoiceUuid?: string | null;
  invoiceCounterValue?: number | null;
  isTaxInclusive?: boolean | null;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { symbol, locale, fmt } = useCurrency();
  const saudiEnabled = !!(session?.user as { saudiEInvoiceEnabled?: boolean })?.saudiEInvoiceEnabled;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    cashBankAccountId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
  });
  const [cashBankAccounts, setCashBankAccounts] = useState<Array<{ id: string; name: string; accountSubType: string; isDefault: boolean }>>([]);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [assignedTemplates, setAssignedTemplates] = useState<string[]>([]);
  const [receiptMeta, setReceiptMeta] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchInvoice();
    fetchCashBankAccounts();
    fetch("/api/settings/invoice-templates").then((r) => r.json()).then((d) => {
      if (d.assigned) setAssignedTemplates(d.assigned);
    }).catch(() => {});
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch receipt meta for Saudi receipt printing
  useEffect(() => {
    if (!saudiEnabled) return;
    fetch("/api/receipt-meta").then((r) => r.json()).then((d) => {
      if (!d.error) setReceiptMeta(d);
    }).catch(() => {});
  }, [saudiEnabled]);

  useEffect(() => {
    if (invoice && Number(invoice.balanceDue) > 0) {
      setPaymentForm((prev) => ({ ...prev, amount: Number(invoice.balanceDue).toFixed(2) }));
    }
  }, [invoice]);

  useEffect(() => {
    if (cashBankAccounts.length > 0 && !paymentForm.cashBankAccountId) {
      const defaultAcc = cashBankAccounts.find((a) => a.isDefault) || cashBankAccounts[0];
      setPaymentForm((prev) => ({ ...prev, cashBankAccountId: defaultAcc.id }));
    }
  }, [cashBankAccounts]);

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

  const fetchCashBankAccounts = async () => {
    try {
      const response = await fetch("/api/cash-bank-accounts?activeOnly=true");
      if (response.ok) {
        const data = await response.json();
        setCashBankAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch cash/bank accounts:", error);
    }
  };

  const handleDownloadPDF = async (template?: string) => {
    setIsDownloading(true);
    try {
      const pdfUrl = template ? `/api/invoices/${id}/pdf?template=${template}` : `/api/invoices/${id}/pdf`;
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      if (isCapacitorEnvironment()) {
        const { capacitorDownloadPdf } = await import("@/lib/capacitor-pdf-printer");
        await capacitorDownloadPdf(blob, `invoice-${invoice?.invoiceNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
        toast.success(t("common.savedToDownloads"));
      } else {
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
      }
    } catch (error) {
      toast.error(t("common.pdfDownloadFailed"));
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    setIsRecordingPayment(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: invoice.customer.id,
          invoiceId: invoice.id,
          amount: parseFloat(paymentForm.amount),
          paymentDate: paymentForm.paymentDate,
          cashBankAccountId: paymentForm.cashBankAccountId,
          reference: paymentForm.reference || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t("payments.failedToRecordPayment"));
      }

      setIsPaymentDialogOpen(false);
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("payments.failedToRecordPayment"));
    } finally {
      setIsRecordingPayment(false);
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
      fetchInvoice();
    } catch {
      toast.error(t("sales.failedToMarkAsSent"));
    } finally {
      setIsMarkingSent(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch(`/api/invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      if (isCapacitorEnvironment()) {
        const { capacitorPrintPdf } = await import("@/lib/capacitor-pdf-printer");
        await capacitorPrintPdf(blob, `Invoice ${invoice?.invoiceNumber}`);
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

  const handlePrintReceipt = async () => {
    if (!invoice || !receiptMeta) return;
    setIsPrintingReceipt(true);
    try {
      // On Capacitor with a configured thermal printer: fetch PDF and print natively
      if (isCapacitorEnvironment()) {
        const { getMobilePrinterConfig, capacitorPrintPdfToThermal } = await import("@/lib/capacitor-print");
        const printerConfig = getMobilePrinterConfig();
        if (printerConfig && (printerConfig.host || printerConfig.address)) {
          const response = await fetch(`/api/invoices/${id}/pdf`);
          if (!response.ok) throw new Error("Failed to generate PDF");
          const blob = await response.blob();
          const result = await capacitorPrintPdfToThermal(blob, printerConfig);
          if (result.success) return;
          console.warn("Thermal print failed, falling back:", result.error);
        }
      }

      // Fallback: HTML receipt via printInvoiceReceipt (browser print dialog / print preview)
      let qrCodeDataURL: string | null = (receiptMeta.qrCodeDataURL as string) || null;
      if (invoice.qrCodeData && !qrCodeDataURL) {
        const qrRes = await fetch(`/api/receipt-meta?qrCodeData=${encodeURIComponent(invoice.qrCodeData)}`);
        const qrData = await qrRes.json();
        if (qrData.qrCodeDataURL) qrCodeDataURL = qrData.qrCodeDataURL;
      }

      const data: InvoiceReceiptData = {
        storeName: receiptMeta.storeName as string || "",
        storeAddress: receiptMeta.storeAddress as string | undefined,
        storeCity: receiptMeta.storeCity as string | undefined,
        storeState: receiptMeta.storeState as string | undefined,
        storePhone: receiptMeta.storePhone as string | undefined,
        vatNumber: receiptMeta.vatNumber as string | undefined,
        secondaryName: receiptMeta.secondaryName as string | undefined,
        logoUrl: receiptMeta.logoUrl as string | undefined,
        logoHeight: receiptMeta.logoHeight as number | undefined,
        brandColor: receiptMeta.brandColor as string | undefined,
        currency: receiptMeta.currency as string || "SAR",

        invoiceNumber: invoice.invoiceNumber,
        issueDate: new Date(invoice.issueDate),
        dueDate: new Date(invoice.dueDate),
        paymentType: invoice.paymentType,
        saudiInvoiceType: invoice.saudiInvoiceType || undefined,

        customerName: invoice.customer.name,
        customerSecondaryName: invoice.customer.arabicName || undefined,
        customerPhone: invoice.customer.phone || undefined,
        customerEmail: invoice.customer.email || undefined,
        customerAddress: invoice.customer.address || undefined,
        customerCity: invoice.customer.city || undefined,
        customerState: invoice.customer.state || undefined,
        customerZipCode: invoice.customer.zipCode || undefined,
        customerVatNumber: invoice.customer.vatNumber || undefined,

        items: invoice.items.map((item) => ({
          name: item.product?.name || item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          lineTotal: Number(item.total),
        })),

        subtotal: Number(invoice.subtotal),
        taxRate: Number(invoice.taxRate),
        taxAmount: invoice.totalVat ? Number(invoice.totalVat) : Number(invoice.taxAmount),
        roundOffAmount: invoice.applyRoundOff ? Number(invoice.roundOffAmount) : undefined,
        total: Number(invoice.total),
        isTaxInclusivePrice: invoice.isTaxInclusive || false,

        amountPaid: Number(invoice.amountPaid),
        balanceDue: Number(invoice.balanceDue),
        isOverdue: new Date(invoice.dueDate) < new Date() && Number(invoice.balanceDue) > 0,

        payments: (invoice.payments || []).map((p) => ({
          date: new Date(p.paymentDate),
          method: p.paymentMethod,
          amount: Number(p.amount),
          reference: p.reference,
        })),

        notes: invoice.notes || undefined,
        terms: invoice.terms || undefined,
        qrCodeDataURL: qrCodeDataURL || undefined,
      };

      await printInvoiceReceipt(data);
    } catch (error) {
      toast.error(t("common.printFailed"));
      console.error(error);
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-slate-500">{t("common.loading")}</div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <PageAnimation>
      <div className="space-y-4 print:space-y-4 sm:space-y-6">
        {/* Header - Hidden on print */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
            <Link href="/invoices">
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:size-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                {t("sales.invoice")} {invoice.invoiceNumber}
              </h2>
              <p className="text-sm text-slate-500">
                {t("common.createdOn")} {format(new Date(invoice.issueDate), "dd MMM yyyy")}
              </p>
              {invoice.isTaxInclusive !== null && invoice.isTaxInclusive !== undefined && (
                <span className="text-[11px] text-muted-foreground">
                  {invoice.isTaxInclusive ? t("common.taxInclusive") : t("common.taxExclusive")}
                </span>
              )}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={`/invoices/${id}/edit`} className="col-span-1 sm:w-auto">
              <Button variant="outline" size="sm" className="h-9 w-full sm:h-10 sm:w-auto">
                <Pencil className="h-4 w-4 sm:mr-2" />
                <span className="sm:inline">{t("common.edit")}</span>
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => router.push(`/invoices/new?duplicate=${invoice.id}`)} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="sm:inline">{t("common.duplicate")}</span>
            </Button>
            {invoice && Number(invoice.balanceDue) > 0 && (
              <Button onClick={() => setIsPaymentDialogOpen(true)} size="sm" className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
                <CreditCard className="h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">{t("common.pay")}</span>
                <span className="hidden sm:inline">{t("sales.recordPayment")}</span>
              </Button>
            )}
            {invoice && !invoice.sentAt && Number(invoice.balanceDue) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAsSent}
                disabled={isMarkingSent}
                className="col-span-1 h-9 w-full sm:h-10 sm:w-auto"
              >
                <Send className="h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">{t("common.sent2")}</span>
                <span className="hidden sm:inline">{t("sales.markAsSent")}</span>
              </Button>
            )}
            {invoice?.sentAt && (
              <span className="col-span-2 text-xs text-slate-500 sm:w-auto sm:text-sm">
                {t("sales.sentOn")} {format(new Date(invoice.sentAt), "dd MMM yyyy")}
              </span>
            )}
            <div className="col-span-1 flex w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => handleDownloadPDF()} disabled={isDownloading} className="h-9 flex-1 rounded-r-none border-r-0 sm:h-10 sm:flex-initial">
                {isDownloading
                  ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  : <Download className="h-4 w-4 sm:mr-2" />}
                <span className="sm:hidden">{isDownloading ? "..." : "PDF"}</span>
                <span className="hidden sm:inline">{isDownloading ? t("common.downloading") : t("common.downloadPDF")}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 rounded-l-none px-2 sm:h-10" disabled={isDownloading}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {assignedTemplates.map((key) => {
                    const labels: Record<string, string> = {
                      A5_LANDSCAPE: "A5 Landscape",
                      A4_PORTRAIT: "A4 Portrait",
                      A4_GST2: "A4 GST",
                      A4_VAT: "A4 VAT",
                      A4_BILINGUAL: "A4 Bilingual",
                      A4_MODERN_GST: "A4 Modern GST",
                      A4_JEWELLERY: "A4 Jewellery",
                    };
                    return (
                      <DropdownMenuItem key={key} onClick={() => handleDownloadPDF(key)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {labels[key] || key}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              {isPrinting
                ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                : <Printer className="h-4 w-4 sm:mr-2" />}
              <span>{isPrinting ? "..." : t("common.print")}</span>
            </Button>
            {saudiEnabled && (
              <Button variant="outline" size="sm" onClick={handlePrintReceipt} disabled={isPrintingReceipt || !receiptMeta} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
                {isPrintingReceipt
                  ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                  : <Receipt className="h-4 w-4 sm:mr-2" />}
                <span>{isPrintingReceipt ? "..." : "Receipt"}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="col-span-1 h-9 w-full sm:h-10 sm:w-auto"
              onClick={async () => {
                if (isCapacitorEnvironment()) {
                  try {
                    const response = await fetch(`/api/invoices/${id}/pdf`);
                    if (!response.ok) throw new Error("Failed to generate PDF");
                    const blob = await response.blob();
                    const { capacitorSharePdf } = await import("@/lib/capacitor-pdf-printer");
                    await capacitorSharePdf(blob, `invoice-${invoice?.invoiceNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
                  } catch (error) {
                    toast.error(t("common.shareFailed"));
                    console.error(error);
                  }
                } else {
                  await shareContent({
                    title: `${t("sales.invoice")} ${invoice?.invoiceNumber}`,
                    text: `${t("sales.invoice")} ${invoice?.invoiceNumber} — ${symbol}${Number(invoice?.total ?? 0).toLocaleString(locale)}`,
                    url: typeof window !== "undefined" ? window.location.href : undefined,
                  });
                }
              }}
            >
              <Share2 className="h-4 w-4 sm:mr-2" />
              <span className="sm:inline">{t("common.share")}</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="invoice" className="w-full">
          <TabsList className="print:hidden h-auto min-w-full justify-start gap-1 rounded-xl p-0.5 sm:min-w-0 sm:w-fit sm:p-1">
            <TabsTrigger value="invoice" className="min-h-[36px] shrink-0 px-3 py-1.5">{t("sales.invoice")}</TabsTrigger>
            <TabsTrigger value="journal" className="min-h-[36px] shrink-0 px-3 py-1.5">{t("accounting.journal")}</TabsTrigger>
          </TabsList>

          <TabsContent value="invoice">
            {/* Invoice Document */}
            <Card className="print:shadow-none print:border-none">
              <CardContent className="p-4 sm:p-8">
                {/* Company & Invoice Info */}
                <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary sm:h-12 sm:w-12">
                      <Building2 className="h-5 w-5 text-primary-foreground sm:h-7 sm:w-7" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold sm:text-2xl">BizArch ERP</h1>
                      <p className="text-sm text-slate-500">{t("sales.invoice")}</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <h2 className="text-lg font-bold sm:text-xl">
                      {invoice.invoiceNumber}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(invoice.invoiceNumber); }}
                        className="ml-1 inline-flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        title={t("common.copyToClipboard") || "Copy to clipboard"}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </h2>
                  </div>
                </div>

                {/* Bill To & Dates */}
                <div className="mb-5 grid gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-8">
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-sm sm:normal-case sm:tracking-normal">
                      {t("common.billTo")}
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
                    <div className="grid gap-1 text-sm sm:space-y-1">
                      <p className="text-sm">
                        <span className="text-slate-500">{t("sales.issueDate")}:</span>{" "}
                        <span className="font-medium">
                          {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-slate-500">{t("sales.dueDate")}:</span>{" "}
                        <span className="font-medium">
                          {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                        </span>
                      </p>
                      <p className="text-sm">
                        <span className="text-slate-500">{t("sales.paymentType")}:</span>{" "}
                        <span className="font-medium">
                          {invoice.paymentType === "CREDIT" ? t("common.creditPaymentType") : t("common.cashPaymentType")}
                        </span>
                      </p>
                      {invoice.branch && (
                        <p className="text-sm">
                          <span className="text-slate-500">{t("common.branch")}:</span>{" "}
                          <span className="font-medium">{invoice.branch.name}</span>
                        </p>
                      )}
                      {invoice.warehouse && (
                        <p className="text-sm">
                          <span className="text-slate-500">{t("common.warehouse")}:</span>{" "}
                          <span className="font-medium">{invoice.warehouse.name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {(() => {
                  const isSaudi = !!invoice.saudiInvoiceType;
                  const hasGst = Number(invoice.totalCgst) > 0 || Number(invoice.totalSgst) > 0 || Number(invoice.totalIgst) > 0;
                  const hasTax = isSaudi || hasGst || Number(invoice.taxAmount) > 0;
                  const getItemTax = (item: InvoiceItem) =>
                    Number(item.vatAmount || 0) + Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0) + Number(item.igstAmount || 0);
                  return (
                    <>
                {/* Line Items — Desktop */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">{t("common.description")}</TableHead>
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
                      {invoice.items.map((item) => {
                        const itemTax = getItemTax(item);
                        return (
                        <TableRow key={item.id}>
                          <TableCell>{item.description}</TableCell>
                          <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                          <TableCell className="text-right">
                            {symbol}{Number(item.unitPrice).toLocaleString(locale)}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(item.discount) > 0 ? (
                              <span className="text-green-600">{Number(item.discount)}%</span>
                            ) : (
                              "-"
                            )}
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
                                    ({isSaudi ? t("common.vat") : t("common.gst")}: {fmt(itemTax)})
                                  </div>
                                )}
                              </TableCell>
                            </>
                          ) : (
                            <TableCell className="text-right">
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
                  {invoice.items.map((item) => {
                    const itemTax = getItemTax(item);
                    return (
                    <div key={item.id} className="p-3 space-y-1">
                      <div className="font-medium text-sm">{item.description}</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                        <span>{t("common.qty")}: {Number(item.quantity)}</span>
                        <span>{t("common.price")}: {symbol}{Number(item.unitPrice).toLocaleString(locale)}</span>
                        {Number(item.discount) > 0 && (
                          <span className="text-green-600">{t("common.discount")}: {Number(item.discount)}%</span>
                        )}
                      </div>
                      <div className="text-right font-semibold text-sm">
                        {hasTax ? fmt(Number(item.total) + itemTax) : `${symbol}${Number(item.total).toLocaleString(locale)}`}
                        {hasTax && itemTax > 0 && (
                          <span className="text-[10px] text-slate-400 ml-1">
                            ({isSaudi ? t("common.vat") : t("common.gst")}: {fmt(itemTax)})
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
                <div className="flex justify-end mt-6">
                  <div className="w-full sm:w-64 space-y-2">
                    {invoice.saudiInvoiceType && invoice.qrCodeData && (
                      <div className="flex flex-col items-end gap-1 mb-4">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                          {invoice.saudiInvoiceType === "SIMPLIFIED" ? t("sales.simplifiedTaxInvoice") : t("sales.taxInvoice")} — ZATCA Phase 1
                        </span>
                        {invoice.invoiceCounterValue && (
                          <span className="text-xs text-slate-400">ICV: {invoice.invoiceCounterValue}</span>
                        )}
                        <div className="border p-1 bg-white" title="Scan to verify invoice (ZATCA Phase 1)">
                          <QRCode value={invoice.qrCodeData} size={96} level="M" />
                        </div>
                        <span className="text-[10px] text-slate-400">{t("sales.zatcaCompliantQR")}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>{t("common.subtotal")}</span>
                      <span>{symbol}{Number(invoice.subtotal).toLocaleString(locale)}</span>
                    </div>
                    {invoice.saudiInvoiceType ? (
                      Number(invoice.totalVat) > 0 && (
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>{t("sales.vat")} — ضريبة القيمة المضافة</span>
                          <span>{symbol}{Number(invoice.totalVat).toFixed(2)}</span>
                        </div>
                      )
                    ) : (
                      <>
                        {Number(invoice.totalCgst) > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{t("common.cgst")}</span>
                            <span>{symbol}{Number(invoice.totalCgst).toLocaleString(locale)}</span>
                          </div>
                        )}
                        {Number(invoice.totalSgst) > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{t("common.sgst")}</span>
                            <span>{symbol}{Number(invoice.totalSgst).toLocaleString(locale)}</span>
                          </div>
                        )}
                        {Number(invoice.totalIgst) > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{t("common.igst")}</span>
                            <span>{symbol}{Number(invoice.totalIgst).toLocaleString(locale)}</span>
                          </div>
                        )}
                        {Number(invoice.totalCgst) === 0 && Number(invoice.totalSgst) === 0 && Number(invoice.totalIgst) === 0 && Number(invoice.taxAmount) > 0 && (
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{t("common.tax")}</span>
                            <span>{symbol}{Number(invoice.taxAmount).toLocaleString(locale)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {invoice.applyRoundOff && Number(invoice.roundOffAmount) !== 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>{t("common.roundOff")}</span>
                        <span>
                          {Number(invoice.roundOffAmount) >= 0 ? "+" : ""}
                          {symbol}{Number(invoice.roundOffAmount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>{t("common.total")}</span>
                      <span>{symbol}{Number(invoice.total).toLocaleString(locale)}</span>
                    </div>
                    {Number(invoice.amountPaid) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>{t("sales.amountPaid")}</span>
                        <span>{symbol}{Number(invoice.amountPaid).toLocaleString(locale)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>{t("common.balanceDue")}</span>
                      <span className={Number(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"}>
                        {symbol}{Number(invoice.balanceDue).toLocaleString(locale)}
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
                          {t("common.notes")}
                        </h3>
                        <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
                      </div>
                    )}
                    {invoice.terms && (
                      <div>
                        <h3 className="text-sm font-semibold text-slate-500 mb-2">
                          {t("common.termsAndConditions")}
                        </h3>
                        <p className="text-sm whitespace-pre-wrap">{invoice.terms}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="journal">
            <JournalEntryTab sourceType="INVOICE" sourceId={id} />
          </TabsContent>
        </Tabs>

        {/* Record Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleRecordPayment}>
              <DialogHeader>
                <DialogTitle>{t("sales.recordPayment")}</DialogTitle>
                <DialogDescription>
                  {t("sales.recordPaymentDesc")} {invoice.invoiceNumber}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>{t("common.customer")}</Label>
                  <p className="text-sm font-medium">{invoice.customer.name}</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-amount">{t("common.amount")} *</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.001"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="pay-date">{t("payments.paymentDate")} *</Label>
                    <Input
                      id="pay-date"
                      type="date"
                      value={paymentForm.paymentDate}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("payments.payFrom")}</Label>
                    <Select
                      value={paymentForm.cashBankAccountId}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, cashBankAccountId: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cashBankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pay-ref">{t("common.reference")}</Label>
                  <Input
                    id="pay-ref"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    placeholder={t("payments.referencePlaceholder")}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="submit" disabled={isRecordingPayment} className="w-full sm:w-auto">
                  {isRecordingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isRecordingPayment ? t("common.recording") : t("sales.recordPayment")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
