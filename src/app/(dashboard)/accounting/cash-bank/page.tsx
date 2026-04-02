"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wallet, ArrowRightLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

interface CashBankAccount {
  id: string;
  name: string;
  accountSubType: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  isDefault: boolean;
  isActive: boolean;
  account: { id: string; code: string; name: string };
  _count: { transactions: number };
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountSubType: string;
}

export default function CashBankPage() {
  const { fmt, locale } = useCurrency();
  const { t, tt } = useLanguage();
  const router = useRouter();
  const [accounts, setAccounts] = useState<CashBankAccount[]>([]);
  const [coaAccounts, setCoaAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    accountId: "",
    accountSubType: "BANK",
    bankName: "",
    accountNumber: "",
    openingBalance: "",
  });
  const [transferData, setTransferData] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    description: "",
    transactionDate: new Date().toISOString().split("T")[0],
  });

  const fetchData = useCallback(async () => {
    try {
      const [cbRes, coaRes] = await Promise.all([
        fetch("/api/cash-bank-accounts"),
        fetch("/api/accounts"),
      ]);
      setAccounts(await cbRes.json());
      const allAccounts = await coaRes.json();
      setCoaAccounts(
        allAccounts.filter(
          (a: Account) => a.accountSubType === "BANK" || a.accountSubType === "CASH"
        )
      );
    } catch {
      toast.error(t("accounting.failedToLoadData"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      toast.success(t("accounting.accountCreated"));
      setIsDialogOpen(false);
      setFormData({ name: "", accountId: "", accountSubType: "BANK", bankName: "", accountNumber: "", openingBalance: "" });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? tt(error.message) : t("accounting.failedToCreateAccount"));
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/cash-bank-accounts/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...transferData,
          amount: parseFloat(transferData.amount),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }
      toast.success(t("accounting.transferCompleted"));
      setIsTransferOpen(false);
      setTransferData({ fromAccountId: "", toAccountId: "", amount: "", description: "", transactionDate: new Date().toISOString().split("T")[0] });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? tt(error.message) : t("accounting.failedToTransfer"));
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("accounting.cashAndBank")}</h2>
              <p className="text-slate-500">{t("accounting.manageCashBankAccounts")}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/reports/cash-bank-summary">
                <Button variant="outline" className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" />
                  {t("reports.summaryReport")}
                </Button>
              </Link>
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    {t("accounting.transfer")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <form className="contents" onSubmit={handleTransfer}>
                    <DialogHeader className="pr-12">
                      <DialogTitle>{t("accounting.transferBetweenAccounts")}</DialogTitle>
                      <DialogDescription>{t("accounting.transferBetweenAccountsDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:py-4">
                      <div className="grid gap-2">
                        <Label>{t("accounting.fromAccount")} *</Label>
                        <Select value={transferData.fromAccountId} onValueChange={(v) => setTransferData({ ...transferData, fromAccountId: v })}>
                          <SelectTrigger><SelectValue placeholder={t("accounting.selectSource")} /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter((a) => a.isActive).map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString(locale)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("accounting.toAccount")} *</Label>
                        <Select value={transferData.toAccountId} onValueChange={(v) => setTransferData({ ...transferData, toAccountId: v })}>
                          <SelectTrigger><SelectValue placeholder={t("accounting.selectDestination")} /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter((a) => a.isActive && a.id !== transferData.fromAccountId).map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>{t("common.amount")} *</Label>
                          <Input type="number" step="0.001" value={transferData.amount} onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })} required />
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("common.date")}</Label>
                          <Input type="date" value={transferData.transactionDate} onChange={(e) => setTransferData({ ...transferData, transactionDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>{t("common.description")}</Label>
                        <Input value={transferData.description} onChange={(e) => setTransferData({ ...transferData, description: e.target.value })} placeholder={t("accounting.transferDescriptionPlaceholder")} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">{t("accounting.transfer")}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("accounting.addAccount")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <form className="contents" onSubmit={handleCreate}>
                    <DialogHeader className="pr-12">
                      <DialogTitle>{t("accounting.addCashBankAccount")}</DialogTitle>
                      <DialogDescription>{t("accounting.createCashBankAccountDesc")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2 sm:py-4">
                      <div className="grid gap-2">
                        <Label>{t("common.name")} *</Label>
                        <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t("accounting.cashBankNamePlaceholder")} required />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>{t("common.type")} *</Label>
                          <Select value={formData.accountSubType} onValueChange={(v) => setFormData({ ...formData, accountSubType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BANK">{t("accounting.bankAccount")}</SelectItem>
                              <SelectItem value="CASH">{t("accounting.cashAccount")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("accounting.coaAccount")}</Label>
                          <Select value={formData.accountId} onValueChange={(v) => setFormData({ ...formData, accountId: v })}>
                            <SelectTrigger><SelectValue placeholder={t("accounting.linkToCoa")} /></SelectTrigger>
                            <SelectContent>
                              {coaAccounts.filter((a) => a.accountSubType === formData.accountSubType).map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {formData.accountSubType === "BANK" && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>{t("accounting.bankName2")}</Label>
                            <Input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} />
                          </div>
                          <div className="grid gap-2">
                            <Label>{t("accounting.accountNumber2")}</Label>
                            <Input value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>{t("common.openingBalance")}</Label>
                        <Input type="number" step="0.001" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">{t("accounting.createAccount")}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.totalBalance")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {fmt(totalBalance)}
              </p>
            </CardContent>
          </Card>

          {/* Account Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-slate-500">{t("accounting.loadingAccounts")}</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("accounting.noAccountsFound")}</h3>
                <p className="text-sm text-slate-500">{t("accounting.addFirstCashBankAccount")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex min-w-0 cursor-pointer"
                  onClick={() => router.push(`/accounting/cash-bank/${account.id}`)}
                >
                  <Card className="w-full transition-shadow hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="min-w-0 break-words font-semibold">{account.name}</h3>
                        <Badge variant="outline">
                          {account.accountSubType === "BANK" ? t("accounting.bank") : t("accounting.cash")}
                        </Badge>
                      </div>
                      {account.bankName && (
                        <p className="break-words text-sm text-slate-500">{account.bankName}</p>
                      )}
                      <p className="mt-3 break-all text-xl font-bold sm:text-2xl">
                        {fmt(Number(account.balance))}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {account._count.transactions} {t("accounting.transactions")}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        {account.isDefault && (
                          <Badge variant="secondary">{t("common.default")}</Badge>
                        )}
                        <Link
                          href={`/reports/${account.accountSubType === "CASH" ? "cash-book" : "bank-book"}?accountId=${account.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-auto text-xs text-blue-600 hover:underline"
                        >
                          {t("reports.viewReport")}
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
        </PageAnimation>
      );
}
