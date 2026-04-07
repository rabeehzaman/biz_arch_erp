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
import { ArrowLeft, Building2, Copy, CreditCard, Download, Loader2, Package, Pencil, Printer } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useCurrency } from "@/hooks/use-currency";
import { useLanguage } from "@/lib/i18n";
import { isCapacitorEnvironment } from "@/lib/capacitor-plugins";
import { downloadBlob } from "@/lib/download";

interface PurchaseInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
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
  // Saudi VAT fields
  totalVat?: number | null;
  items: PurchaseInvoiceItem[];
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function PurchaseInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { symbol, locale, fmt } = useCurrency();
  const { t } = useLanguage();

  const statusLabels: Record<string, string> = {
    DRAFT: t("purchases.statusDraft"),
    RECEIVED: t("purchases.statusReceived"),
    PAID: t("purchases.statusPaid"),
    PARTIALLY_PAID: t("purchases.statusPartial"),
    CANCELLED: t("purchases.statusCancelled"),
  };

  const [invoice, setInvoice] = useState<PurchaseInvoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    cashBankAccountId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    reference: "",
  });
  const [cashBankAccounts, setCashBankAccounts] = useState<Array<{ id: string; name: string; accountSubType: string; isDefault: boolean }>>([]);

  useEffect(() => {
    fetchInvoice();
    fetchCashBankAccounts();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
          cashBankAccountId: paymentForm.cashBankAccountId,
          reference: paymentForm.reference || undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to record payment");
      }
      setIsPaymentDialogOpen(false);
      fetchInvoice();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("payments.failedToRecordPayment"));
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
    } catch (error) {
      toast.error(t("purchases.failedToUpdateStatus"));
      console.error("Failed to update status:", error);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/purchase-invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      const filename = `purchase-invoice-${invoice?.purchaseInvoiceNumber}-${format(new Date(), "yyyy-MM-dd")}.pdf`;
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
      const response = await fetch(`/api/purchase-invoices/${id}/pdf`);
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();

      if (isCapacitorEnvironment()) {
        const { capacitorPrintPdf } = await import("@/lib/capacitor-pdf-printer");
        await capacitorPrintPdf(blob, `Purchase Invoice ${invoice?.purchaseInvoiceNumber}`);
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
            <Link href="/purchase-invoices">
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:size-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                {t("purchases.purchaseInvoiceTitle")} {invoice.purchaseInvoiceNumber}
              </h2>
              <p className="text-sm text-slate-500">
                {t("purchases.dated")} {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
              </p>
              {invoice.isTaxInclusive !== null && (
                <span className="text-[11px] text-muted-foreground">
                  {invoice.isTaxInclusive ? t("common.taxInclusive") : t("common.taxExclusive")}
                </span>
              )}
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={invoice.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="col-span-2 h-9 w-full sm:h-10 sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">{t("purchases.statusDraft")}</SelectItem>
                <SelectItem value="RECEIVED">{t("purchases.statusReceived")}</SelectItem>
                <SelectItem value="PAID">{t("purchases.statusPaid")}</SelectItem>
                <SelectItem value="PARTIALLY_PAID">{t("purchases.statusPartial")}</SelectItem>
                <SelectItem value="CANCELLED">{t("purchases.statusCancelled")}</SelectItem>
              </SelectContent>
            </Select>
            {Number(invoice.balanceDue) > 0 && (
              <Button onClick={() => setIsPaymentDialogOpen(true)} size="sm" className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
                <CreditCard className="h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">{t("common.pay")}</span>
                <span className="hidden sm:inline">{t("payments.recordPayment")}</span>
              </Button>
            )}
            <Link href={`/purchase-invoices/${id}/edit`} className="col-span-1 sm:w-auto">
              <Button variant="outline" size="sm" className="h-9 w-full sm:h-10 sm:w-auto">
                <Pencil className="h-4 w-4 sm:mr-2" />
                {t("common.edit")}
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-invoices/new?duplicate=${invoice.id}`)} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
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
          </div>
        </div>

        <Tabs defaultValue="invoice" className="w-full">
          <TabsList className="print:hidden h-auto min-w-full justify-start gap-1 rounded-xl p-0.5 sm:min-w-0 sm:w-fit sm:p-1">
            <TabsTrigger value="invoice" className="min-h-[36px] shrink-0 px-3 py-1.5">{t("sales.invoice")}</TabsTrigger>
            <TabsTrigger value="journal" className="min-h-[36px] shrink-0 px-3 py-1.5">{t("accounting.journalEntries")}</TabsTrigger>
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
                  <p className="text-sm text-slate-500">{t("purchases.purchaseInvoiceTitle")}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <h2 className="text-lg font-bold sm:text-xl">{invoice.purchaseInvoiceNumber}</h2>
                <Badge className={statusColors[invoice.status]}>
                  {statusLabels[invoice.status]}
                </Badge>
                {invoice.supplierInvoiceRef && (
                  <p className="text-sm text-slate-500 mt-1">
                    {t("purchases.ref")}: {invoice.supplierInvoiceRef}
                  </p>
                )}
              </div>
            </div>

            {/* Supplier & Dates */}
            <div className="mb-5 grid gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">
                  {t("common.supplier")}
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
                    <span className="text-slate-500">{t("purchases.purchaseDate")}:</span>{" "}
                    <span className="font-medium">
                      {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-slate-500">{t("sales.dueDate")}:</span>{" "}
                    <span className="font-medium">
                      {format(new Date(invoice.dueDate), "dd MMM yyyy")}
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
              const isSaudi = Number(invoice.totalVat) > 0;
              const hasGst = Number(invoice.totalCgst) > 0 || Number(invoice.totalSgst) > 0 || Number(invoice.totalIgst) > 0;
              const hasTax = isSaudi || hasGst || Number(invoice.taxAmount) > 0;
              const getItemTax = (item: PurchaseInvoiceItem) =>
                Number(item.vatAmount || 0) + Number(item.cgstAmount || 0) + Number(item.sgstAmount || 0) + Number(item.igstAmount || 0);
              return (
                <>
            {/* Line Items — Desktop */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.qty")}</TableHead>
                    <TableHead className="text-right">{t("common.unitCost")}</TableHead>
                    <TableHead className="text-right">{t("common.discount")}</TableHead>
                    {hasTax ? (
                      <>
                        <TableHead className="text-right">{t("common.grossAmount")}</TableHead>
                        <TableHead className="text-right">{t("common.netAmount")}</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">{t("common.total")}</TableHead>
                    )}
                    <TableHead className="text-right print:hidden">{t("common.stock")}</TableHead>
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
                        {symbol}{Number(item.unitCost).toLocaleString(locale)}
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
                      <TableCell className="text-right print:hidden">
                        {item.stockLot && (
                          <div className="flex items-center justify-end gap-1">
                            <Package className="h-4 w-4 text-green-600" />
                            <span className="text-green-600">
                              {Number(item.stockLot.remainingQuantity)} {t("purchases.remaining")}
                            </span>
                          </div>
                        )}
                      </TableCell>
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
                    <span>{t("common.cost")}: {symbol}{Number(item.unitCost).toLocaleString(locale)}</span>
                    {Number(item.discount) > 0 && (
                      <span className="text-green-600">{t("common.discount")}: {Number(item.discount)}%</span>
                    )}
                    {item.stockLot && (
                      <span className="text-green-600">
                        {t("common.stock")}: {Number(item.stockLot.remainingQuantity)} {t("purchases.left")}
                      </span>
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
                <div className="flex justify-between text-sm">
                  <span>{t("common.subtotal")}</span>
                  <span>{symbol}{Number(invoice.subtotal).toLocaleString(locale)}</span>
                </div>
                {Number(invoice.totalVat) > 0 ? (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{t("purchases.vatLabel")}</span>
                    <span>{symbol}{Number(invoice.totalVat).toFixed(2)}</span>
                  </div>
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
                  <span className={Number(invoice.balanceDue) > 0 ? "text-orange-600" : "text-green-600"}>
                    {symbol}{Number(invoice.balanceDue).toLocaleString(locale)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 pt-8 border-t">
                <h3 className="text-sm font-semibold text-slate-500 mb-2">
                  {t("common.notes")}
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
                <DialogTitle>{t("payments.recordPayment")}</DialogTitle>
                <DialogDescription>
                  {t("purchases.recordPaymentForInvoice")} {invoice.purchaseInvoiceNumber}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>{t("common.supplier")}</Label>
                  <p className="text-sm font-medium">{invoice.supplier.name}</p>
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
                  {isRecordingPayment ? t("common.recording") : t("payments.recordPayment")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PageAnimation>
  );
}
