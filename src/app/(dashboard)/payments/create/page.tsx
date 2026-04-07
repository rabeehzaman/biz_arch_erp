"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { StickyBottomBar } from "@/components/mobile/sticky-bottom-bar";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { useFormConfig } from "@/hooks/use-form-config";

interface Customer {
  id: string;
  name: string;
  balance: number;
}

interface UnpaidInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  customerId: string;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

export default function CreatePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId") || "";
  const { t, lang } = useLanguage();
  const { symbol, locale, fmt } = useCurrency();
  const { isFieldHidden, getDefault } = useFormConfig("payment");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allInvoices, setAllInvoices] = useState<UnpaidInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<
    Array<{ id: string; name: string; accountSubType: string; isDefault: boolean }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [manualAllocations, setManualAllocations] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    customerId: preselectedCustomerId,
    amount: "",
    discountReceived: "",
    paymentDate: new Date().toISOString().split("T")[0],
    cashBankAccountId: "",
    reference: getDefault("reference", ""),
    notes: getDefault("notes", ""),
    adjustmentAccountId: "",
  });

  useEffect(() => {
    fetchCustomers();
    fetchInvoices();
    fetchAccounts();
    fetchCashBankAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cashBankAccounts.length > 0 && !formData.cashBankAccountId) {
      const defaultAcc = cashBankAccounts.find((a) => a.isDefault) || cashBankAccounts[0];
      setFormData((prev) => ({ ...prev, cashBankAccountId: defaultAcc.id }));
    }
  }, [cashBankAccounts]);

  // Reset manual allocations when customer changes
  useEffect(() => {
    setManualAllocations({});
  }, [formData.customerId]);

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers?compact=true");
    const data = await response.json();
    setCustomers(data);
  };

  const fetchInvoices = async () => {
    const response = await fetch("/api/invoices?limit=500");
    const json = await response.json();
    const items = Array.isArray(json) ? json : json.data ?? [];
    setAllInvoices(
      items
        .filter((inv: UnpaidInvoice) => Number(inv.balanceDue) > 0)
        .sort((a: UnpaidInvoice, b: UnpaidInvoice) =>
          new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime()
        )
    );
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) setAccounts(await response.json());
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  const fetchCashBankAccounts = async () => {
    try {
      const response = await fetch("/api/cash-bank-accounts?activeOnly=true");
      if (response.ok) setCashBankAccounts(await response.json());
    } catch (error) {
      console.error("Failed to fetch cash/bank accounts:", error);
    }
  };

  // Filter invoices for selected customer, sorted oldest first
  const customerInvoices = useMemo(
    () => allInvoices.filter((inv) => inv.customerId === formData.customerId),
    [allInvoices, formData.customerId]
  );

  // Compute FIFO allocations
  const computedAllocations = useMemo(() => {
    const totalPayment = (parseFloat(formData.amount) || 0) + (parseFloat(formData.discountReceived) || 0);
    if (totalPayment <= 0 || customerInvoices.length === 0) return {};

    const result: Record<string, number> = {};
    let remaining = totalPayment;

    // 1. Apply manual allocations first
    for (const inv of customerInvoices) {
      const manual = parseFloat(manualAllocations[inv.id] || "");
      if (!isNaN(manual) && manual > 0) {
        const capped = Math.min(manual, Number(inv.balanceDue), remaining);
        result[inv.id] = capped;
        remaining -= capped;
      }
    }

    // 2. Auto-distribute remaining to un-allocated invoices (FIFO - oldest first)
    for (const inv of customerInvoices) {
      if (remaining <= 0) break;
      if (result[inv.id] !== undefined) continue;
      const apply = Math.min(remaining, Number(inv.balanceDue));
      if (apply > 0) {
        result[inv.id] = apply;
        remaining -= apply;
      }
    }

    return result;
  }, [formData.amount, formData.discountReceived, customerInvoices, manualAllocations]);

  const totalAllocated = useMemo(
    () => Object.values(computedAllocations).reduce((sum, v) => sum + v, 0),
    [computedAllocations]
  );

  const totalPayment = (parseFloat(formData.amount) || 0) + (parseFloat(formData.discountReceived) || 0);
  const unallocated = Math.max(0, totalPayment - totalAllocated);

  const selectedCustomer = customers.find((c) => c.id === formData.customerId);
  const isAdjustment = formData.cashBankAccountId === "ADJUSTMENT";

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!formData.customerId) errors.customerId = t("validation.customerRequired");
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = t("validation.amountRequired");
    if (!formData.paymentDate) errors.paymentDate = t("validation.paymentDateRequired");
    if (isAdjustment && !formData.adjustmentAccountId) {
      errors.adjustmentAccountId = t("validation.accountRequired") || "Account is required";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);

    try {
      const allocationEntries = Object.entries(computedAllocations)
        .filter(([, amount]) => amount > 0)
        .map(([invoiceId, amount]) => ({ invoiceId, amount }));

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          amount: parseFloat(formData.amount),
          discountReceived: parseFloat(formData.discountReceived) || 0,
          paymentDate: formData.paymentDate,
          ...(isAdjustment
            ? { paymentMethod: "ADJUSTMENT", adjustmentAccountId: formData.adjustmentAccountId }
            : { cashBankAccountId: formData.cashBankAccountId }),
          allocations: allocationEntries.length > 0 ? allocationEntries : undefined,
          reference: formData.reference || null,
          notes: formData.notes || null,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      toast.success(t("payments.paymentRecorded") || "Payment recorded successfully");
      router.push("/payments");
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to save payment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6 pb-32 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/payments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("payments.recordPayment")}</h2>
            <p className="text-slate-500">{t("dashboard.recordPaymentDesc")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Form + Invoice Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("payments.paymentDetails") || "Payment Details"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Customer */}
                <div className="grid gap-2">
                  <Label>{t("sales.customer")} *</Label>
                  <Combobox
                    items={customers}
                    value={formData.customerId}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, customerId: value }));
                      if (value) setFormErrors((prev) => ({ ...prev, customerId: "" }));
                    }}
                    getId={(c) => c.id}
                    getLabel={(c) => c.name}
                    filterFn={(c, query) => c.name.toLowerCase().includes(query)}
                    renderItem={(c) => (
                      <div className="flex justify-between w-full">
                        <span>{c.name}</span>
                        <span className="text-slate-500 text-xs">
                          {t("common.balance")}: {fmt(Number(c.balance))}
                        </span>
                      </div>
                    )}
                    placeholder={t("common.enterToSearch")}
                    emptyText={t("common.noResults")}
                  />
                  {formErrors.customerId && <p className="text-sm text-red-500">{formErrors.customerId}</p>}
                  {selectedCustomer && (
                    <p className="text-sm text-slate-500">
                      {t("common.balance")}: <span className="font-medium">{fmt(Number(selectedCustomer.balance))}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Amount */}
                  <div className="grid gap-2">
                    <Label>{t("common.amount")} *</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.amount}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, amount: e.target.value }));
                        if (e.target.value) setFormErrors((prev) => ({ ...prev, amount: "" }));
                      }}
                      placeholder="0.00"
                      className={formErrors.amount ? "border-red-500" : ""}
                    />
                    {formErrors.amount && <p className="text-sm text-red-500">{formErrors.amount}</p>}
                  </div>

                  {/* Discount */}
                  <div className="grid gap-2">
                    <Label>{t("common.discount")}</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={formData.discountReceived}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountReceived: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Payment Date */}
                  <div className="grid gap-2">
                    <Label>{t("payments.paymentDate")} *</Label>
                    <Input
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, paymentDate: e.target.value }))}
                    />
                  </div>

                  {/* Pay From */}
                  <div className="grid gap-2">
                    <Label>{t("payments.payFrom")}</Label>
                    <Select
                      value={formData.cashBankAccountId}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, cashBankAccountId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {cashBankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                        <SelectItem value="ADJUSTMENT">{t("common.adjustment") || "Adjustment"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!isAdjustment && !isFieldHidden("reference") && (
                  <div className="grid gap-2">
                    <Label>{t("common.reference")}</Label>
                    <Input
                      value={formData.reference}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
                      placeholder={t("common.checkTransactionId")}
                    />
                  </div>
                )}

                {isAdjustment && (
                  <div className="grid gap-2">
                    <Label>{t("common.adjustmentAccount") || "Adjustment Account"} *</Label>
                    <Combobox
                      items={accounts}
                      value={formData.adjustmentAccountId}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, adjustmentAccountId: value }));
                        if (value) setFormErrors((prev) => ({ ...prev, adjustmentAccountId: "" }));
                      }}
                      getId={(a) => a.id}
                      getLabel={(a) => `${a.name} (${a.code})`}
                      filterFn={(a, query) => `${a.name} ${a.code}`.toLowerCase().includes(query.toLowerCase())}
                      renderItem={(a) => (
                        <div className="flex justify-between w-full">
                          <span>{a.name}</span>
                          <span className="text-slate-500 text-xs">{a.code}</span>
                        </div>
                      )}
                      placeholder={t("common.searchAccount") || "Search account..."}
                      emptyText={t("common.noResults")}
                    />
                    {formErrors.adjustmentAccountId && <p className="text-sm text-red-500">{formErrors.adjustmentAccountId}</p>}
                  </div>
                )}

                {!isFieldHidden("notes") && (
                  <div className="grid gap-2">
                    <Label>{t("common.notes")}</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice Allocation */}
            {formData.customerId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("payments.invoiceAllocation") || "Invoice Allocation"}</CardTitle>
                </CardHeader>
                <CardContent>
                  {customerInvoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CreditCard className="h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm text-slate-500">
                        {t("payments.noUnpaidInvoices") || "No unpaid invoices for this customer"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("sales.invoiceNumber")}</TableHead>
                              <TableHead>{t("common.date")}</TableHead>
                              <TableHead className="text-right">{t("common.total")}</TableHead>
                              <TableHead className="text-right">{t("common.balanceDue") || "Balance Due"}</TableHead>
                              <TableHead className="text-right w-[160px]">{t("common.amount")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customerInvoices.map((inv) => {
                              const allocated = computedAllocations[inv.id] || 0;
                              const isManual = manualAllocations[inv.id] !== undefined && manualAllocations[inv.id] !== "";
                              return (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                                  <TableCell>{format(new Date(inv.issueDate), "dd MMM yyyy")}</TableCell>
                                  <TableCell className="text-right">{fmt(Number(inv.total))}</TableCell>
                                  <TableCell className="text-right font-medium text-orange-600">
                                    {fmt(Number(inv.balanceDue))}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      step="0.001"
                                      value={isManual ? manualAllocations[inv.id] : (allocated > 0 ? allocated.toFixed(2) : "")}
                                      onChange={(e) => {
                                        setManualAllocations((prev) => ({
                                          ...prev,
                                          [inv.id]: e.target.value,
                                        }));
                                      }}
                                      onFocus={(e) => {
                                        // When user focuses and there's an auto-allocated value, set it as manual
                                        if (!isManual && allocated > 0) {
                                          setManualAllocations((prev) => ({
                                            ...prev,
                                            [inv.id]: allocated.toFixed(2),
                                          }));
                                        }
                                      }}
                                      onBlur={(e) => {
                                        // Clear manual if empty to let FIFO recalculate
                                        if (e.target.value === "" || e.target.value === "0") {
                                          setManualAllocations((prev) => {
                                            const next = { ...prev };
                                            delete next[inv.id];
                                            return next;
                                          });
                                        }
                                      }}
                                      placeholder="0.00"
                                      className={`w-[140px] text-right ${lang === "ar" ? "ml-auto" : "ml-auto"} ${allocated > 0 ? "border-green-300" : ""}`}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="space-y-3 sm:hidden">
                        {customerInvoices.map((inv) => {
                          const allocated = computedAllocations[inv.id] || 0;
                          const isManual = manualAllocations[inv.id] !== undefined && manualAllocations[inv.id] !== "";
                          return (
                            <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-slate-900">{inv.invoiceNumber}</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {format(new Date(inv.issueDate), "dd MMM yyyy")}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">{t("common.balanceDue") || "Balance Due"}</p>
                                  <p className="font-medium text-orange-600">{fmt(Number(inv.balanceDue))}</p>
                                </div>
                              </div>
                              <div className="mt-3">
                                <Label className="text-xs text-slate-500">{t("common.amount")}</Label>
                                <Input
                                  type="number"
                                  step="0.001"
                                  value={isManual ? manualAllocations[inv.id] : (allocated > 0 ? allocated.toFixed(2) : "")}
                                  onChange={(e) => {
                                    setManualAllocations((prev) => ({
                                      ...prev,
                                      [inv.id]: e.target.value,
                                    }));
                                  }}
                                  onBlur={(e) => {
                                    if (e.target.value === "" || e.target.value === "0") {
                                      setManualAllocations((prev) => {
                                        const next = { ...prev };
                                        delete next[inv.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  placeholder="0.00"
                                  className={`mt-1 text-right ${allocated > 0 ? "border-green-300" : ""}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Summary (desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("common.summary") || "Summary"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">{t("common.amount")}</span>
                    <span className="font-medium">{fmt(parseFloat(formData.amount) || 0)}</span>
                  </div>
                  {(parseFloat(formData.discountReceived) || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{t("common.discount")}</span>
                      <span className="font-medium">{fmt(parseFloat(formData.discountReceived) || 0)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3 flex justify-between text-sm">
                    <span className="text-slate-500">{t("payments.totalSettlement") || "Total Settlement"}</span>
                    <span className="font-semibold">{fmt(totalPayment)}</span>
                  </div>
                  {customerInvoices.length > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{t("payments.allocated") || "Allocated"}</span>
                        <span className="font-medium text-green-600">{fmt(totalAllocated)}</span>
                      </div>
                      {unallocated > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{t("payments.unallocated") || "Unallocated"}</span>
                          <span className="font-medium text-orange-600">{fmt(unallocated)}</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="pt-3">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isSubmitting ? t("common.recording") : t("payments.recordPayment")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile Summary + Submit */}
        <StickyBottomBar
          topContent={
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("payments.totalSettlement") || "Total"}: <span className="font-semibold text-slate-900">{fmt(totalPayment)}</span></span>
              {customerInvoices.length > 0 && totalAllocated > 0 && (
                <span className="text-green-600">{t("payments.allocated") || "Allocated"}: {fmt(totalAllocated)}</span>
              )}
            </div>
          }
        >
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? t("common.recording") : t("payments.recordPayment")}
          </Button>
        </StickyBottomBar>
      </div>
    </PageAnimation>
  );
}
