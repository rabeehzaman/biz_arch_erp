"use client";

import { useState, useEffect, use } from "react";
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

const txTypeLabels: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  OPENING_BALANCE: "Opening Balance",
};

export default function CashBankDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
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
  }, [id]);

  const fetchAccount = async () => {
    try {
      const response = await fetch(`/api/cash-bank-accounts/${id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      setAccount(await response.json());
    } catch {
      toast.error("Failed to load account");
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
      toast.success(`${dialogType === "deposit" ? "Deposit" : "Withdrawal"} recorded`);
      setDialogType(null);
      setFormData({ amount: "", description: "", transactionDate: new Date().toISOString().split("T")[0] });
      fetchAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record transaction");
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
    return <p className="text-center py-8 text-slate-500">Account not found</p>;
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogType("withdrawal")}>
                <Minus className="mr-2 h-4 w-4" />
                Withdrawal
              </Button>
              <Button onClick={() => setDialogType("deposit")}>
                <Plus className="mr-2 h-4 w-4" />
                Deposit
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {Number(account.balance).toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                })}
              </p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">
                  {account.accountSubType === "BANK" ? "Bank" : "Cash"}
                </Badge>
                {account.isDefault && <Badge variant="secondary">Default</Badge>}
                <Badge variant="outline">COA: {account.account.code}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {account.transactions.length === 0 ? (
                <p className="text-center py-4 text-slate-500">No transactions yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
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
                            {txTypeLabels[tx.transactionType] || tx.transactionType}
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
              )}
            </CardContent>
          </Card>

          <Dialog open={!!dialogType} onOpenChange={() => setDialogType(null)}>
            <DialogContent>
              <form onSubmit={handleTransaction}>
                <DialogHeader>
                  <DialogTitle>
                    {dialogType === "deposit" ? "Record Deposit" : "Record Withdrawal"}
                  </DialogTitle>
                  <DialogDescription>
                    {dialogType === "deposit"
                      ? "Add funds to this account."
                      : "Remove funds from this account."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={formData.transactionDate}
                      onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder={dialogType === "deposit" ? "Deposit description" : "Withdrawal description"}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {dialogType === "deposit" ? "Record Deposit" : "Record Withdrawal"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        </PageAnimation>
      );
}
