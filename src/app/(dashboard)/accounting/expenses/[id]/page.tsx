"use client";

import { useState, useEffect, use } from "react";
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
  const [expense, setExpense] = useState<Expense | null>(null);
  const [cashBankAccounts, setCashBankAccounts] = useState<CashBankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "void" | null>(null);

  useEffect(() => {
    fetchData();
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
      toast.error("Failed to load expense");
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
      toast.success("Expense approved");
      setConfirmAction(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
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
      toast.success("Expense paid");
      setIsPayDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pay");
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
      toast.success("Expense voided");
      setConfirmAction(null);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to void");
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
    return <p className="text-center py-8 text-slate-500">Expense not found</p>;
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/accounting/expenses">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {expense.expenseNumber}
                </h2>
                <p className="text-slate-500">{expense.description || "Expense"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={statusColors[expense.status]}>{expense.status}</Badge>
              {expense.status === "DRAFT" && (
                <Button onClick={() => setConfirmAction("approve")}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              )}
              {expense.status === "APPROVED" && (
                <Button onClick={() => setIsPayDialogOpen(true)}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Pay
                </Button>
              )}
              {expense.status !== "VOID" && expense.status !== "DRAFT" && (
                <Button variant="destructive" onClick={() => setConfirmAction("void")}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Void
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Date</span>
                  <p className="font-medium">
                    {format(new Date(expense.expenseDate), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Supplier</span>
                  <p className="font-medium">{expense.supplier?.name || "None"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Paid From</span>
                  <p className="font-medium">{expense.cashBankAccount?.name || "Not yet paid"}</p>
                </div>
                <div>
                  <span className="text-slate-500">Total</span>
                  <p className="font-medium text-lg">
                    {Number(expense.total).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
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
                        {Number(item.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={2} className="text-right font-medium">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(expense.subtotal).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                  {Number(expense.taxAmount) > 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-slate-500">
                        Tax ({Number(expense.taxRate)}%)
                      </TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {Number(expense.taxAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-bold">
                    <TableCell colSpan={2} className="text-right">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(expense.total).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pay Dialog */}
          <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
            <DialogContent>
              <form onSubmit={handlePay}>
                <DialogHeader>
                  <DialogTitle>Pay Expense</DialogTitle>
                  <DialogDescription>
                    Select the account to pay this expense from.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label>Pay From *</Label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={setSelectedAccountId}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashBankAccounts
                        .filter((a) => a.isActive !== false)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} ({Number(a.balance).toLocaleString("en-IN", { style: "currency", currency: "INR" })})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!selectedAccountId}>
                    Pay {Number(expense.total).toLocaleString("en-IN", { style: "currency", currency: "INR" })}
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
                  {confirmAction === "approve" ? "Approve Expense" : "Void Expense"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "approve"
                    ? "This will approve the expense for payment."
                    : "This will void the expense and reverse any related transactions."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmAction === "approve" ? handleApprove : handleVoid}
                  className={
                    confirmAction === "void"
                      ? "bg-red-600 hover:bg-red-700"
                      : undefined
                  }
                >
                  {confirmAction === "approve" ? "Approve" : "Void"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </PageAnimation>
      );
}
