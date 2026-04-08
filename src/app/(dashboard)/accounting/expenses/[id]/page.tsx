"use client";

import { useState, useEffect, use } from "react";
import { useCurrency } from "@/hooks/use-currency";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, CheckCircle, Wallet, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { AttachmentDialog } from "@/components/attachments/attachment-dialog";
import { useLanguage } from "@/lib/i18n";

interface ExpenseItem {
  id: string;
  account: { id: string; code: string; name: string };
  description: string;
  amount: number;
}

interface Expense {
  id: string;
  expenseNumber: string;
  status: string;
  expenseDate: string;
  description: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  total: number;
  notes: string | null;
  supplier: { id: string; name: string } | null;
  cashBankAccount: { id: string; name: string } | null;
  items: ExpenseItem[];
}

interface CashBankAccount {
  id: string;
  name: string;
  balance: number;
  accountSubType: string;
  isActive: boolean;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { fmt, locale } = useCurrency();
  const { t } = useLanguage();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "void" | null>(null);

  useEffect(() => {
    fetchData();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchData = async () => {
    try {
      const [expRes, cbRes] = await Promise.all([
        fetch(`/api/expenses/${id}`),
        fetch("/api/cash-bank-accounts"),
      ]);
      if (!expRes.ok) throw new Error("Failed to fetch");
      setExpense(await expRes.json());
      setCashBankAccounts(await cbRes.json());
    } catch {
      toast.error(t("accounting.failedToLoadExpense"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/expenses/${id}/approve`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      setConfirmAction(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounting.failedToApprove"));
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/expenses/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashBankAccountId: selectedAccountId }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      setIsPayDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounting.failedToPay"));
    }
  };

  const handleVoid = async () => {
    try {
      const response = await fetch(`/api/expenses/${id}/void`, {
        method: "POST",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      setConfirmAction(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounting.failedToVoid"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!expense) {
    return <p className="text-center py-8 text-slate-500">{t("accounting.expenseNotFound")}</p>;
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <Link href="/accounting/expenses">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {expense.expenseNumber}
                </h2>
                <p className="text-slate-500">{expense.description || t("accounting.expense")}</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Badge className={statusColors[expense.status]}>{expense.status}</Badge>
              {expense.status === "DRAFT" && (
                <Button onClick={() => setConfirmAction("approve")} className="w-full sm:w-auto">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("common.approve")}
                </Button>
              )}
              {expense.status === "APPROVED" && (
                <Button onClick={() => setIsPayDialogOpen(true)} className="w-full sm:w-auto">
                  <Wallet className="mr-2 h-4 w-4" />
                  {t("common.pay")}
                </Button>
              )}
              {expense.status !== "VOID" && expense.status !== "DRAFT" && (
                <Button variant="destructive" onClick={() => setConfirmAction("void")} className="w-full sm:w-auto">
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("common.void")}
                </Button>
              )}
              <AttachmentDialog documentType="expense" documentId={expense.id} />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("common.details")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <span className="text-slate-500">{t("common.date")}</span>
                  <p className="font-medium">
                    {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t("common.supplier")}</span>
                  <p className="font-medium">{expense.supplier?.name || t("common.none")}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("accounting.paidFrom")}</span>
                  <p className="font-medium">{expense.cashBankAccount?.name || t("accounting.notYetPaid")}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("common.total")}</span>
                  <p className="font-medium text-lg">
                    {fmt(Number(expense.total))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.lineItems")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:hidden">
                {expense.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4 text-sm">
                    <div className="font-medium text-slate-900">
                      <span className="mr-2 font-mono text-slate-500">{item.account.code}</span>
                      {item.account.name}
                    </div>
                    <div className="mt-2 text-slate-600">{item.description}</div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <span className="text-xs uppercase tracking-wide text-slate-400">{t("common.amount")}</span>
                      <span className="font-semibold text-slate-900">{fmt(Number(item.amount))}</span>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">{t("common.subtotal")}</span>
                    <span className="font-medium">{fmt(Number(expense.subtotal))}</span>
                  </div>
                  {Number(expense.totalCgst) > 0 && (
                    <div className="mt-2 flex justify-between text-slate-500">
                      <span>CGST</span>
                      <span>{fmt(Number(expense.totalCgst))}</span>
                    </div>
                  )}
                  {Number(expense.totalSgst) > 0 && (
                    <div className="mt-2 flex justify-between text-slate-500">
                      <span>SGST</span>
                      <span>{fmt(Number(expense.totalSgst))}</span>
                    </div>
                  )}
                  {Number(expense.totalIgst) > 0 && (
                    <div className="mt-2 flex justify-between text-slate-500">
                      <span>IGST</span>
                      <span>{fmt(Number(expense.totalIgst))}</span>
                    </div>
                  )}
                  {Number(expense.totalCgst) === 0 && Number(expense.totalSgst) === 0 && Number(expense.totalIgst) === 0 && Number(expense.taxAmount) > 0 && (
                    <div className="mt-2 flex justify-between text-slate-500">
                      <span>{t("common.tax")}</span>
                      <span>{fmt(Number(expense.taxAmount))}</span>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-base font-semibold">
                    <span>{t("common.total")}</span>
                    <span>{fmt(Number(expense.total))}</span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.account")}</TableHead>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expense.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono text-slate-500 mr-2">
                          {item.account.code}
                        </span>
                        {item.account.name}
                      </TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(item.amount).toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={2} className="text-right font-medium">
                      {t("common.subtotal")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(expense.subtotal).toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  {Number(expense.totalCgst) > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-slate-500">CGST</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {Number(expense.totalCgst).toLocaleString(locale, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )}
                  {Number(expense.totalSgst) > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-slate-500">SGST</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {Number(expense.totalSgst).toLocaleString(locale, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )}
                  {Number(expense.totalIgst) > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-slate-500">IGST</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {Number(expense.totalIgst).toLocaleString(locale, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )}
                  {Number(expense.totalCgst) === 0 && Number(expense.totalSgst) === 0 && Number(expense.totalIgst) === 0 && Number(expense.taxAmount) > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-slate-500">{t("common.tax")}</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {Number(expense.taxAmount).toLocaleString(locale, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2} className="text-right">
                      {t("common.total")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(expense.total).toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pay Dialog */}
          <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handlePay}>
                <DialogHeader>
                  <DialogTitle>{t("accounting.payExpense")}</DialogTitle>
                  <DialogDescription>
                    {t("accounting.selectPayAccount")}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label>{t("accounting.payFrom")}</Label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder={t("accounting.selectAccount")} />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts
                        .filter((a) => a.isActive !== false)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({fmt(Number(a.balance))})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="submit" disabled={!selectedAccountId} className="w-full sm:w-auto">
                    {t("common.pay")} {fmt(Number(expense.total))}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Confirm Dialog */}
          <AlertDialog
            open={!!confirmAction}
            onOpenChange={() => setConfirmAction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction === "approve" ? t("accounting.approveExpense") : t("accounting.voidExpense")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "approve"
                    ? t("accounting.approveExpenseDesc")
                    : t("accounting.voidExpenseDesc")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmAction === "approve" ? handleApprove : handleVoid}
                  className={
                    confirmAction === "void"
                      ? "bg-red-600 hover:bg-red-700"
                      : undefined
                  }
                >
                  {confirmAction === "approve" ? t("common.approve") : t("common.void")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </PageAnimation>
      );
}
