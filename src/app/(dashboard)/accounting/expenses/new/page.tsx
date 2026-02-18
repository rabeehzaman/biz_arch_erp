"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ExpenseLine {
  accountId: string;
  description: string;
  amount: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ExpenseLine[]>([
    { accountId: "", description: "", amount: "" },
  ]);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
    ]).then(([accountsData, suppliersData]) => {
      // Only show expense-type accounts
      setAccounts(
        accountsData.filter((a: Account) => a.accountType === "EXPENSE")
      );
      setSuppliers(suppliersData);
    });
  }, []);

  const subtotal = lines.reduce(
    (sum, l) => sum + (parseFloat(l.amount) || 0),
    0
  );
  const taxAmount = (subtotal * (parseFloat(taxRate) || 0)) / 100;
  const total = subtotal + taxAmount;

  const addLine = () => {
    setLines([...lines, { accountId: "", description: "", amount: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof ExpenseLine, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter(
      (l) => l.accountId && l.description && parseFloat(l.amount) > 0
    );
    if (validLines.length === 0) {
      toast.error("At least one line item is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || null,
          expenseDate,
          description,
          taxRate: parseFloat(taxRate) || 0,
          notes: notes || null,
          items: validLines.map((l) => ({
            accountId: l.accountId,
            description: l.description,
            amount: parseFloat(l.amount),
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create");
      }

      toast.success("Expense created");
      router.push("/accounting/expenses");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create expense"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/accounting/expenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">New Expense</h2>
          <p className="text-slate-500">Record a business expense</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Supplier (optional)</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tax Rate %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this expense for?"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Add Line
                </Button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_1fr_120px_40px] gap-2 text-xs font-medium text-slate-500 px-1">
                  <span>Expense Account</span>
                  <span>Description</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>

                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_120px_40px] gap-2 items-center"
                  >
                    <Select
                      value={line.accountId}
                      onValueChange={(v) =>
                        updateLine(index, "accountId", v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(index, "description", e.target.value)
                      }
                      placeholder="Description"
                    />

                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.amount}
                      onChange={(e) =>
                        updateLine(index, "amount", e.target.value)
                      }
                      placeholder="0.00"
                      className="text-right"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">
                      {subtotal.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Tax ({taxRate}%):</span>
                      <span className="font-mono">
                        {taxAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base">
                    <span>Total:</span>
                    <span className="font-mono">
                      {total.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Link href="/accounting/expenses">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting || subtotal === 0}>
                {isSubmitting ? "Creating..." : "Create Expense"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
