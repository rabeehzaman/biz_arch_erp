"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import { Plus, Wallet, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

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
      toast.success("Account created");
      setIsDialogOpen(false);
      setFormData({ name: "", accountId: "", accountSubType: "BANK", bankName: "", accountNumber: "", openingBalance: "" });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create account");
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
      toast.success("Transfer completed");
      setIsTransferOpen(false);
      setTransferData({ fromAccountId: "", toAccountId: "", amount: "", description: "", transactionDate: new Date().toISOString().split("T")[0] });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to transfer");
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Cash & Bank</h2>
              <p className="text-slate-500">Manage cash and bank accounts</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleTransfer}>
                    <DialogHeader>
                      <DialogTitle>Transfer Between Accounts</DialogTitle>
                      <DialogDescription>Move funds between cash/bank accounts.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>From Account *</Label>
                        <Select value={transferData.fromAccountId} onValueChange={(v) => setTransferData({ ...transferData, fromAccountId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter((a) => a.isActive).map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name} ({Number(a.balance).toLocaleString("en-IN")})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>To Account *</Label>
                        <Select value={transferData.toAccountId} onValueChange={(v) => setTransferData({ ...transferData, toAccountId: v })}>
                          <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                          <SelectContent>
                            {accounts.filter((a) => a.isActive && a.id !== transferData.fromAccountId).map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Amount *</Label>
                          <Input type="number" step="0.01" value={transferData.amount} onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })} required />
                        </div>
                        <div className="grid gap-2">
                          <Label>Date</Label>
                          <Input type="date" value={transferData.transactionDate} onChange={(e) => setTransferData({ ...transferData, transactionDate: e.target.value })} />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input value={transferData.description} onChange={(e) => setTransferData({ ...transferData, description: e.target.value })} placeholder="Transfer description" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Transfer</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>Add Cash/Bank Account</DialogTitle>
                      <DialogDescription>Create a new cash or bank account.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Name *</Label>
                        <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. HDFC Current Account" required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Type *</Label>
                          <Select value={formData.accountSubType} onValueChange={(v) => setFormData({ ...formData, accountSubType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BANK">Bank Account</SelectItem>
                              <SelectItem value="CASH">Cash Account</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>COA Account *</Label>
                          <Select value={formData.accountId} onValueChange={(v) => setFormData({ ...formData, accountId: v })}>
                            <SelectTrigger><SelectValue placeholder="Link to COA" /></SelectTrigger>
                            <SelectContent>
                              {coaAccounts.filter((a) => a.accountSubType === formData.accountSubType).map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {formData.accountSubType === "BANK" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label>Bank Name</Label>
                            <Input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} />
                          </div>
                          <div className="grid gap-2">
                            <Label>Account Number</Label>
                            <Input value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2">
                        <Label>Opening Balance</Label>
                        <Input type="number" step="0.01" value={formData.openingBalance} onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Account</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Total Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {totalBalance.toLocaleString("en-IN", { style: "currency", currency: "INR" })}
              </p>
            </CardContent>
          </Card>

          {/* Account Cards */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Wallet className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">No accounts found</h3>
                <p className="text-sm text-slate-500">Add your first cash or bank account</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {accounts.map((account) => (
                <Link key={account.id} href={`/accounting/cash-bank/${account.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{account.name}</h3>
                        <Badge variant="outline">
                          {account.accountSubType === "BANK" ? "Bank" : "Cash"}
                        </Badge>
                      </div>
                      {account.bankName && (
                        <p className="text-sm text-slate-500">{account.bankName}</p>
                      )}
                      <p className="text-2xl font-bold mt-3">
                        {Number(account.balance).toLocaleString("en-IN", {
                          style: "currency",
                          currency: "INR",
                        })}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {account._count.transactions} transactions
                      </p>
                      {account.isDefault && (
                        <Badge variant="secondary" className="mt-2">Default</Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
        </PageAnimation>
      );
}
