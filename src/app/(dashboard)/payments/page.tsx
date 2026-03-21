"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, CreditCard, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { PullToRefreshIndicator } from "@/components/mobile/pull-to-refresh-indicator";
import { FloatingActionButton } from "@/components/mobile/floating-action-button";
import { SwipeableCard } from "@/components/mobile/swipeable-card";

interface Payment {
  id: string;
  paymentNumber: string;
  customer: {
    id: string;
    name: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  amount: number;
  discountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

interface Customer {
  id: string;
  name: string;
  balance: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  balanceDue: number;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

const methodLabels = (t: (key: string) => string): Record<string, string> => ({
  CASH: t("common.cash"),
  BANK_TRANSFER: t("common.bankTransfer"),
  CHECK: t("common.check"),
  CREDIT_CARD: t("common.creditCard"),
  UPI: t("common.upi"),
  OTHER: t("common.other"),
  ADJUSTMENT: t("common.adjustment") || "Adjustment",
});

export default function PaymentsPage() {
  const router = useRouter();
  const {
    items: payments,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<Payment>({ url: "/api/payments" });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { t, lang } = useLanguage();
  const { symbol, locale, fmt } = useCurrency();
  const { pullDistance, isRefreshing } = usePullToRefresh({ onRefresh: refresh });
  const [formData, setFormData] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    discountReceived: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "CASH",
    reference: "",
    notes: "",
    adjustmentAccountId: "",
  });

  useEffect(() => {
    fetchCustomers();
    fetchInvoices();
    fetchAccounts();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers?compact=true");
    const data = await response.json();
    setCustomers(data);
  };

  const fetchInvoices = async () => {
    const response = await fetch("/api/invoices");
    const data = await response.json();
    setInvoices(data.filter((inv: Invoice) => Number(inv.balanceDue) > 0));
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === formData.customerId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.customerId) errors.customerId = t("validation.customerRequired");
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = t("validation.amountRequired");
    if (!formData.paymentDate) errors.paymentDate = t("validation.paymentDateRequired");
    if (formData.paymentMethod === "ADJUSTMENT" && !formData.adjustmentAccountId) {
      errors.adjustmentAccountId = t("validation.accountRequired") || "Account is required for adjustments";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          invoiceId: formData.invoiceId || null,
          amount: parseFloat(formData.amount),
          discountReceived: parseFloat(formData.discountReceived) || 0,
          paymentDate: formData.paymentDate,
          paymentMethod: formData.paymentMethod,
          reference: formData.reference || null,
          notes: formData.notes || null,
          adjustmentAccountId: formData.paymentMethod === "ADJUSTMENT" ? formData.adjustmentAccountId : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      setIsDialogOpen(false);
      resetForm();
      refresh();
      fetchCustomers();
      fetchInvoices();
      toast.success(t("payments.paymentRecorded"));
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to save payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customerId: "",
      invoiceId: "",
      amount: "",
      discountReceived: "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMethod: "CASH",
      reference: "",
      notes: "",
      adjustmentAccountId: "",
    });
    setFormErrors({});
  };

  const handleDelete = async () => {
    if (!deletePayment) return;

    try {
      const response = await fetch(`/api/payments/${deletePayment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setDeletePayment(null);
      refresh();
      fetchCustomers();
      fetchInvoices();
      toast.success(t("payments.paymentDeleted"));
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to delete payment:", error);
    }
  };

  return (
    <PageAnimation>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("payments.customerPayments")}</h2>
            <p className="text-slate-500">{t("payments.managePayments")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
                {t("payments.recordPayment")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form className="contents" onSubmit={handleSubmit}>
                <DialogHeader className="pr-12">
                  <DialogTitle>{t("payments.recordPayment")}</DialogTitle>
                  <DialogDescription>
                    {t("dashboard.recordPaymentDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="customer">{t("sales.customer")} *</Label>
                    <Combobox
                      items={customers}
                      value={formData.customerId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, customerId: value, invoiceId: "" });
                        if (value) setFormErrors((prev) => ({ ...prev, customerId: "" }));
                      }}
                      getId={(customer) => customer.id}
                      getLabel={(customer) => customer.name}
                      filterFn={(customer, query) =>
                        customer.name.toLowerCase().includes(query)
                      }
                      renderItem={(customer) => (
                        <div className="flex justify-between w-full">
                          <span>{customer.name}</span>
                          <span className="text-slate-500 text-xs">
                            Balance: {symbol}{Number(customer.balance).toLocaleString(locale)}
                          </span>
                        </div>
                      )}
                      placeholder={t("common.enterToSearch")}
                      emptyText={t("common.noResults")}
                    />
                    {formErrors.customerId && <p className="text-sm text-red-500">{formErrors.customerId}</p>}
                  </div>
                  {formData.customerId && customerInvoices.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="invoice">{t("common.linkToInvoice")}</Label>
                      <Select
                        value={formData.invoiceId}
                        onValueChange={(value) => {
                          const inv = invoices.find((i) => i.id === value);
                          setFormData({
                            ...formData,
                            invoiceId: value,
                            amount: inv ? Number(inv.balanceDue).toFixed(2) : formData.amount,
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.selectInvoice")} />
                        </SelectTrigger>
                        <SelectContent>
                          {customerInvoices.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.invoiceNumber} (Due: {symbol}{Number(invoice.balanceDue).toLocaleString(locale)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">{t("common.amount")} *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => {
                          setFormData({ ...formData, amount: e.target.value });
                          if (e.target.value) setFormErrors((prev) => ({ ...prev, amount: "" }));
                        }}
                        className={formErrors.amount ? "border-red-500" : ""}
                      />
                      {formErrors.amount && <p className="text-sm text-red-500">{formErrors.amount}</p>}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="discountReceived">{t("common.discount")}</Label>
                      <Input
                        id="discountReceived"
                        type="number"
                        step="0.01"
                        value={formData.discountReceived}
                        onChange={(e) =>
                          setFormData({ ...formData, discountReceived: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentDate">{t("payments.paymentDate")} *</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        value={formData.paymentDate}
                        onChange={(e) =>
                          setFormData({ ...formData, paymentDate: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentMethod">{t("payments.paymentMethod")}</Label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value) =>
                          setFormData({ ...formData, paymentMethod: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">{t("common.cash")}</SelectItem>
                          <SelectItem value="BANK_TRANSFER">{t("common.bankTransfer")}</SelectItem>
                          <SelectItem value="CHECK">{t("common.check")}</SelectItem>
                          <SelectItem value="CREDIT_CARD">{t("common.creditCard")}</SelectItem>
                          <SelectItem value="UPI">{t("common.upi")}</SelectItem>
                          <SelectItem value="OTHER">{t("common.other")}</SelectItem>
                          <SelectItem value="ADJUSTMENT">{t("common.adjustment") || "Adjustment"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.paymentMethod !== "ADJUSTMENT" && (
                      <div className="grid gap-2">
                        <Label htmlFor="reference">{t("common.reference")}</Label>
                        <Input
                          id="reference"
                          value={formData.reference}
                          onChange={(e) =>
                            setFormData({ ...formData, reference: e.target.value })
                          }
                          placeholder={t("common.checkTransactionId")}
                        />
                      </div>
                    )}
                  </div>

                  {formData.paymentMethod === "ADJUSTMENT" && (
                    <div className="grid gap-2">
                      <Label htmlFor="adjustmentAccount">{t("common.adjustmentAccount") || "Adjustment Account"} *</Label>
                      <Combobox
                        items={accounts}
                        value={formData.adjustmentAccountId}
                        onValueChange={(value) => {
                          setFormData({ ...formData, adjustmentAccountId: value });
                          if (value) setFormErrors((prev) => ({ ...prev, adjustmentAccountId: "" }));
                        }}
                        getId={(account) => account.id}
                        getLabel={(account) => `${account.name} (${account.code})`}
                        filterFn={(account, query) =>
                          `${account.name} ${account.code}`.toLowerCase().includes(query.toLowerCase())
                        }
                        renderItem={(account) => (
                          <div className="flex justify-between w-full">
                            <span>{account.name}</span>
                            <span className="text-slate-500 text-xs">{account.code}</span>
                          </div>
                        )}
                        placeholder={t("common.searchAccount") || "Search account..."}
                        emptyText={t("common.noResults")}
                      />
                      {formErrors.adjustmentAccountId && <p className="text-sm text-red-500">{formErrors.adjustmentAccountId}</p>}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="notes">{t("common.notes")}</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? t("common.recording") : t("payments.recordPayment")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t("payments.searchPayments")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : payments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CreditCard className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("payments.noPayments")}</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : t("payments.noPaymentsDesc")}
                  </p>
                </div>
              ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {payments.map((payment) => (
                    <SwipeableCard
                      key={payment.id}
                      actionWidth={70}
                      actions={
                        <button
                          type="button"
                          className="flex h-full w-full items-center justify-center bg-red-500 text-sm font-medium text-white"
                          onClick={() => setDeletePayment(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      }
                    >
                      <div onClick={() => payment.invoice?.id && router.push(`/invoices/${payment.invoice.id}`)} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${payment.invoice?.id ? "cursor-pointer hover:bg-muted/50" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("payments.paymentNo")}</p>
                          <p className="mt-1 font-semibold text-slate-900">{payment.paymentNumber}</p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">{fmt(Number(payment.amount))}</p>
                      </div>

                      <div className="mt-4 min-w-0">
                        <p className="font-medium text-slate-900">{payment.customer.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{methodLabels(t)[payment.paymentMethod]}</Badge>
                          {payment.invoice?.invoiceNumber && (
                            <Badge variant="secondary">{payment.invoice.invoiceNumber}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.date")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.discount")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {Number(payment.discountReceived) > 0 ? fmt(Number(payment.discountReceived)) : "-"}
                          </p>
                        </div>
                      </div>

                      </div>
                    </SwipeableCard>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("payments.paymentNo")}</TableHead>
                          <TableHead>{t("sales.customer")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("sales.invoiceNumber")}</TableHead>
                          <TableHead>{t("common.date")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("payments.paymentMethod")}</TableHead>
                          <TableHead className="text-right">{t("common.amount")}</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">{t("common.discount")}</TableHead>
                          <TableHead className="w-[80px]">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id} onClick={() => payment.invoice?.id && router.push(`/invoices/${payment.invoice.id}`)} className={payment.invoice?.id ? "cursor-pointer hover:bg-muted/50" : ""}>
                            <TableCell className="font-medium">
                              {payment.paymentNumber}
                            </TableCell>
                            <TableCell>{payment.customer.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {payment.invoice?.invoiceNumber || "-"}
                            </TableCell>
                            <TableCell>
                              {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline">
                                {methodLabels(t)[payment.paymentMethod]}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {fmt(Number(payment.amount))}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right text-slate-500">
                              {Number(payment.discountReceived) > 0
                                ? fmt(Number(payment.discountReceived))
                                : "-"}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletePayment(payment)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
            <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
          </CardContent>
        </Card>

        <AlertDialog open={!!deletePayment} onOpenChange={() => setDeletePayment(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("payments.deletePayment")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("payments.deletePaymentDesc").replace("{paymentNumber}", deletePayment?.paymentNumber || "")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <FloatingActionButton onClick={() => setIsDialogOpen(true)} label={t("payments.recordPayment")} />
    </PageAnimation>
  );
}
