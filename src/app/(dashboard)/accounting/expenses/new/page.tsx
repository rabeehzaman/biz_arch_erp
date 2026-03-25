"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/hooks/use-currency";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
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
import { PageAnimation } from "@/components/ui/page-animation";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useLanguage } from "@/lib/i18n";
import { useFormConfig } from "@/hooks/use-form-config";

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
  const { locale } = useCurrency();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const supplierSelectRef = useRef<HTMLButtonElement>(null);
  const accountSelectRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const { t } = useLanguage();
  const { isFieldHidden, getDefault } = useFormConfig("expense");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState(getDefault("description", ""));
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState(getDefault("notes", ""));
  const [lines, setLines] = useState<ExpenseLine[]>([
    { accountId: "", description: "", amount: "" },
  ]);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/suppliers?compact=true").then((r) => r.json()),
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
      toast.error(t("accounting.atLeastOneLineRequired"));
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

      setIsDirty(false);
      toast.success(t("accounting.expenseCreated"));
      router.push("/accounting/expenses");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("accounting.failedToCreateExpense")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/accounting/expenses">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("accounting.newExpense")}</h2>
            <p className="text-slate-500">{t("accounting.recordBusinessExpense")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)}>
          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.expenseDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <Label>{t("common.date")} *</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    required
                  />
                </div>
                {!isFieldHidden("supplierId") && (
                <div className="grid gap-2">
                  <Label>{t("accounting.supplierOptional")}</Label>
                  <Select
                    value={supplierId}
                    onValueChange={setSupplierId}
                    onOpenChange={(open) => {
                      if (!open) {
                        setTimeout(() => focusNextFocusable(supplierSelectRef), 10);
                      }
                    }}
                  >
                    <SelectTrigger ref={supplierSelectRef}>
                      <SelectValue placeholder={t("accounting.noSupplier")} />
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
                )}
              </div>

              {!isFieldHidden("description") && (
              <div className="grid gap-2">
                <Label>{t("common.description")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("accounting.expenseDescPlaceholder")}
                />
              </div>
              )}

              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-base font-semibold">{t("accounting.lineItems")}</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={addLine}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    {t("accounting.addLine")}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="hidden grid-cols-[1fr_1fr_120px_40px] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
                    <span>{t("accounting.expenseAccount")}</span>
                    <span>{t("common.description")}</span>
                    <span className="text-right">{t("common.amount")}</span>
                    <span />
                  </div>

                  {lines.map((line, index) => (
                    <div key={index}>
                      <div className="hidden grid-cols-[1fr_1fr_120px_40px] items-center gap-2 sm:grid">
                        <Select
                          value={line.accountId}
                          onValueChange={(v) =>
                            updateLine(index, "accountId", v)
                          }
                          onOpenChange={(open) => {
                            if (!open) {
                              const ref = accountSelectRefs.current.get(index);
                              if (ref) setTimeout(() => focusNextFocusable(ref), 10);
                            }
                          }}
                        >
                          <SelectTrigger ref={(el) => {
                            if (el) accountSelectRefs.current.set(index, el);
                            else accountSelectRefs.current.delete(index);
                          }}>
                            <SelectValue placeholder={t("accounting.selectAccount")} />
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
                          placeholder={t("common.description")}
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

                      <div className="rounded-lg border border-slate-200 p-3 sm:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <Label className="text-sm font-semibold">{t("common.item")} {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 1}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2">
                            <Label className="text-xs text-slate-500">{t("accounting.expenseAccount")}</Label>
                            <Select
                              value={line.accountId}
                              onValueChange={(v) => updateLine(index, "accountId", v)}
                              onOpenChange={(open) => {
                                if (!open) {
                                  const ref = accountSelectRefs.current.get(index);
                                  if (ref) setTimeout(() => focusNextFocusable(ref), 10);
                                }
                              }}
                            >
                              <SelectTrigger ref={(el) => {
                                if (el) accountSelectRefs.current.set(index, el);
                                else accountSelectRefs.current.delete(index);
                              }}>
                                <SelectValue placeholder={t("accounting.selectAccount")} />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-xs text-slate-500">{t("common.description")}</Label>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              placeholder={t("common.description")}
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-xs text-slate-500">{t("common.amount")}</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.amount}
                              onChange={(e) => updateLine(index, "amount", e.target.value)}
                              placeholder="0.00"
                              className="text-right"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between font-bold text-base">
                      <span>{t("common.total")}:</span>
                      <span className="font-mono">
                        {subtotal.toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {!isFieldHidden("notes") && (
              <div className="grid gap-2">
                <Label>{t("common.notes")}</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("common.additionalNotesPlaceholder")}
                />
              </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link href="/accounting/expenses">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    {t("common.cancel")}
                  </Button>
                </Link>
                <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting || subtotal <= 0}>
                  {isSubmitting ? t("common.creating") : t("accounting.createExpense")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageAnimation>
  );
}
