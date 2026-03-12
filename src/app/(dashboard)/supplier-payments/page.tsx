"use client";

import { useState, useEffect } from "react";
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
import { Plus, Search, Wallet, Trash2 } from "lucide-react";
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
import { useCurrency } from "@/hooks/use-currency";

interface SupplierPayment {
  id: string;
  paymentNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  purchaseInvoice: {
    id: string;
    purchaseInvoiceNumber: string;
  } | null;
  amount: number;
  discountGiven: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

interface Supplier {
  id: string;
  name: string;
  balance: number;
}

interface PurchaseInvoice {
  id: string;
  purchaseInvoiceNumber: string;
  supplierId: string;
  balanceDue: number;
}

interface Account {
  id: string;
  name: string;
  code: string;
}

const methodLabels: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Check",
  CREDIT_CARD: "Credit Card",
  UPI: "UPI",
  OTHER: "Other",
  ADJUSTMENT: "Adjustment",
};
import { useLanguage } from "@/lib/i18n";

export default function SupplierPaymentsPage() {
  const { t, lang } = useLanguage();
  const { symbol } = useCurrency();
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deletePayment, setDeletePayment] = useState<SupplierPayment | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    supplierId: "",
    purchaseInvoiceId: "",
    amount: "",
    discountGiven: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "CASH",
    reference: "",
    notes: "",
    adjustmentAccountId: "",
  });

  useEffect(() => {
    fetchPayments();
    fetchSuppliers();
    fetchInvoices();
    fetchAccounts();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/supplier-payments");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      toast.error("Failed to load payments");
      console.error("Failed to fetch payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    const response = await fetch("/api/suppliers?compact=true");
    const data = await response.json();
    setSuppliers(data);
  };

  const fetchInvoices = async () => {
    const response = await fetch("/api/purchase-invoices");
    const data = await response.json();
    setInvoices(data.filter((inv: PurchaseInvoice) => Number(inv.balanceDue) > 0));
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

  const supplierInvoices = invoices.filter(
    (inv) => inv.supplierId === formData.supplierId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.supplierId) errors.supplierId = "Supplier is required";
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = "Valid amount is required";
    if (!formData.paymentDate) errors.paymentDate = "Payment date is required";
    if (formData.paymentMethod === "ADJUSTMENT" && !formData.adjustmentAccountId) {
      errors.adjustmentAccountId = "Account is required for adjustments";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const response = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: formData.supplierId,
          purchaseInvoiceId: formData.purchaseInvoiceId || null,
          amount: parseFloat(formData.amount),
          discountGiven: parseFloat(formData.discountGiven) || 0,
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
      fetchPayments();
      fetchSuppliers();
      fetchInvoices();
      toast.success("Payment recorded");
    } catch (error) {
      toast.error("Failed to record payment");
      console.error("Failed to save payment:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      supplierId: "",
      purchaseInvoiceId: "",
      amount: "",
      discountGiven: "",
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
      const response = await fetch(`/api/supplier-payments/${deletePayment.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      setDeletePayment(null);
      fetchPayments();
      fetchSuppliers();
      fetchInvoices();
      toast.success("Payment deleted successfully");
    } catch (error) {
      toast.error("Failed to delete payment");
      console.error("Failed to delete payment:", error);
    }
  };

  const filteredPayments = payments.filter(
    (payment) =>
      payment.paymentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("payments.supplierPayments")}</h2>
            <p className="text-slate-500">{t("payments.manageSupplierPayments")}</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
                {t("payments.recordSupplierPayment")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form className="contents" onSubmit={handleSubmit}>
                <DialogHeader className="pr-12">
                  <DialogTitle>Record Supplier Payment</DialogTitle>
                  <DialogDescription>
                    Record a payment to a supplier.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 sm:py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Combobox
                      items={suppliers}
                      value={formData.supplierId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, supplierId: value, purchaseInvoiceId: "" })
                      }
                      getId={(supplier) => supplier.id}
                      getLabel={(supplier) => supplier.name}
                      filterFn={(supplier, query) =>
                        supplier.name.toLowerCase().includes(query)
                      }
                      renderItem={(supplier) => (
                        <div className="flex justify-between w-full">
                          <span>{supplier.name}</span>
                          <span className="text-slate-500 text-xs">
                            Payable: {symbol}{Number(supplier.balance).toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                      placeholder="Search supplier..."
                      emptyText="No suppliers found."
                    />
                    {formErrors.supplierId && <p className="text-sm text-red-500">{formErrors.supplierId}</p>}
                  </div>
                  {formData.supplierId && supplierInvoices.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="invoice">Link to Purchase Invoice (Optional)</Label>
                      <Select
                        value={formData.purchaseInvoiceId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, purchaseInvoiceId: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                        <SelectContent>
                          {supplierInvoices.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id}>
                              {invoice.purchaseInvoiceNumber} (Due: {symbol}{Number(invoice.balanceDue).toLocaleString("en-IN")})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount *</Label>
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
                      <Label htmlFor="discountGiven">Discount Given</Label>
                      <Input
                        id="discountGiven"
                        type="number"
                        step="0.01"
                        value={formData.discountGiven}
                        onChange={(e) =>
                          setFormData({ ...formData, discountGiven: e.target.value })
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentDate">Payment Date *</Label>
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
                      <Label htmlFor="paymentMethod">Payment Method</Label>
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
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                          <SelectItem value="CHECK">Check</SelectItem>
                          <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                          <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.paymentMethod !== "ADJUSTMENT" && (
                      <div className="grid gap-2">
                        <Label htmlFor="reference">Reference</Label>
                        <Input
                          id="reference"
                          value={formData.reference}
                          onChange={(e) =>
                            setFormData({ ...formData, reference: e.target.value })
                          }
                          placeholder="Check #, Transaction ID..."
                        />
                      </div>
                    )}
                  </div>

                  {formData.paymentMethod === "ADJUSTMENT" && (
                    <div className="grid gap-2">
                      <Label htmlFor="adjustmentAccount">Adjustment Account *</Label>
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
                        placeholder="Search account..."
                        emptyText="No results"
                      />
                      {formErrors.adjustmentAccountId && <p className="text-sm text-red-500">{formErrors.adjustmentAccountId}</p>}
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes</Label>
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
                  <Button type="submit">Record Payment</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t("payments.searchPaymentsPlaceholder")}
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
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("payments.noPaymentsFound")}</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noResultsFound")
                    : t("payments.recordFirstSupplierPayment")}
                  </p>
                </div>
              ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {filteredPayments.map((payment) => (
                    <div key={payment.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Payment #</p>
                          <p className="mt-1 font-semibold text-slate-900">{payment.paymentNumber}</p>
                        </div>
                        <p className="text-sm font-semibold text-orange-600">
                          {symbol}{Number(payment.amount).toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div className="mt-4 min-w-0">
                        <p className="font-medium text-slate-900">{payment.supplier.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">{methodLabels[payment.paymentMethod]}</Badge>
                          {payment.purchaseInvoice?.purchaseInvoiceNumber && (
                            <Badge variant="secondary">{payment.purchaseInvoice.purchaseInvoiceNumber}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Discount</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {Number(payment.discountGiven) > 0
                              ? `${symbol}${Number(payment.discountGiven).toLocaleString("en-IN")}`
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Button
                          variant="ghost"
                          className="min-h-[44px] w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletePayment(payment)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment #</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead className="hidden sm:table-cell">Purchase Invoice</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="hidden sm:table-cell">Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium">
                            {payment.paymentNumber}
                          </TableCell>
                          <TableCell>{payment.supplier.name}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {payment.purchaseInvoice?.purchaseInvoiceNumber || "-"}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {format(new Date(payment.paymentDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline">
                              {methodLabels[payment.paymentMethod]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-orange-600">
                            {symbol}{Number(payment.amount).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {Number(payment.discountGiven) > 0
                              ? `${symbol}${Number(payment.discountGiven).toLocaleString("en-IN")}`
                              : "-"}
                          </TableCell>
                          <TableCell>
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
              </>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deletePayment} onOpenChange={() => setDeletePayment(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Payment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete payment {deletePayment?.paymentNumber}?
                This will reverse the supplier balance and any invoice allocations.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageAnimation>
  );
}
