"use client";

import { useState, useEffect, use } from "react";
import { useCurrency } from "@/hooks/use-currency";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  runningBalance: number;
  description: string;
  transactionDate: string;
}

interface CashBankAccount {
  id: string;
  name: string;
  accountSubType: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  isDefault: boolean;
  account: { id: string; code: string; name: string };
  transactions: Transaction[];
}

const txTypeLabels = (t: (key: string) => string): Record<string, string> => ({
  DEPOSIT: t("accounting.txTypeDeposit"),
  WITHDRAWAL: t("accounting.txTypeWithdrawal"),
  TRANSFER_IN: t("accounting.txTypeTransferIn"),
  TRANSFER_OUT: t("accounting.txTypeTransferOut"),
  OPENING_BALANCE: t("accounting.txTypeOpeningBalance"),
});

export default function CashBankDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { fmt } = useCurrency();
  const { t } = useLanguage();
  const txLabels = txTypeLabels(t);
  const [account, setAccount] = useState<CashBankAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogType, setDialogType] = useState<"deposit" | "withdrawal" | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    fetchAccount();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchAccount = async () => {
    try {
      const response = await fetch(`/api/cash-bank-accounts/${id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setAccount(await response.json());
    } catch {
      toast.error(t("accounting.failedToLoadAccount"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogType) return;

    try {
      const response = await fetch(`/api/cash-bank-accounts/${id}/${dialogType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          description: formData.description,
          transactionDate: formData.transactionDate,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      toast.success(dialogType === "deposit" ? t("accounting.depositRecorded") : t("accounting.withdrawalRecorded"));
      setDialogType(null);
      setFormData({ amount: "", description: "", transactionDate: new Date().toISOString().split("T")[0] });
      fetchAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounting.failedToRecordTransaction"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!account) {
    return <p className="text-center py-8 text-slate-500">{t("accounting.accountNotFound")}</p>;
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <Link href="/accounting/cash-bank">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{account.name}</h2>
                <p className="text-slate-500">
                  {account.bankName && `${account.bankName} `}
                  {account.accountNumber && `- ${account.accountNumber}`}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => setDialogType("withdrawal")} className="w-full sm:w-auto">
                <Minus className="mr-2 h-4 w-4" />
                {t("accounting.withdrawal")}
              </Button>
              <Button onClick={() => setDialogType("deposit")} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {t("accounting.deposit")}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.currentBalance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {fmt(Number(account.balance))}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {account.accountSubType === "BANK" ? t("accounting.bank") : t("accounting.cash")}
                </Badge>
                {account.isDefault && <Badge variant="secondary">{t("common.default")}</Badge>}
                <Badge variant="outline">{t("accounting.coaLabel")} {account.account.code}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.transactionHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              {account.transactions.length === 0 ? (
                <p className="text-center py-4 text-slate-500">{t("accounting.noTransactionsYet")}</p>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {account.transactions.map((tx) => (
                      <div key={tx.id} className="rounded-lg border p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-slate-900">
                              {format(new Date(tx.transactionDate), "dd MMM yyyy")}
                            </div>
                            <div className="mt-2">
                              <Badge variant="outline">
                                {txLabels[tx.transactionType] || tx.transactionType}
                              </Badge>
                            </div>
                          </div>
                          <div className={`font-semibold ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {Number(tx.amount) >= 0 ? "+" : ""}
                            {fmt(Number(tx.amount))}
                          </div>
                        </div>
                        <div className="mt-3 text-slate-600">{tx.description}</div>
                        <div className="mt-3 flex items-center justify-between border-t pt-3">
                          <span className="text-xs uppercase tracking-wide text-slate-400">{t("accounting.runningBalance")}</span>
                          <span className="font-medium text-slate-900">{fmt(Number(tx.runningBalance))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("common.date")}</TableHead>
                          <TableHead>{t("common.type")}</TableHead>
                          <TableHead>{t("common.description")}</TableHead>
                          <TableHead className="text-right">{t("common.amount")}</TableHead>
                          <TableHead className="text-right">{t("common.balance")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {account.transactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell>
                              {format(new Date(tx.transactionDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {txLabels[tx.transactionType] || tx.transactionType}
                              </Badge>
                            </TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell
                              className={`text-right font-mono ${
                                Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              {Number(tx.amount) >= 0 ? "+" : ""}
                              {Number(tx.amount).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(tx.runningBalance).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
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

          <Dialog open={!!dialogType} onOpenChange={() => setDialogType(null)}>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleTransaction}>
                <DialogHeader>
                  <DialogTitle>
                    {dialogType === "deposit" ? t("accounting.recordDeposit") : t("accounting.recordWithdrawal")}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogType === "deposit"
                      ? t("accounting.addFundsDesc")
                      : t("accounting.removeFundsDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>{t("common.amount")} *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("common.date")}</Label>
                    <Input
                      type="date"
                      value={formData.transactionDate}
                      onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("common.description")}</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={dialogType === "deposit" ? t("accounting.depositDescPlaceholder") : t("accounting.withdrawalDescPlaceholder")}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="submit" className="w-full sm:w-auto">
                    {dialogType === "deposit" ? t("accounting.recordDeposit") : t("accounting.recordWithdrawal")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        </PageAnimation>
      );
}
