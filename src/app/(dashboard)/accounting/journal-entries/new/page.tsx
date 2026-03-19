"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/hooks/use-currency";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useEnterToTab } from "@/hooks/use-enter-to-tab";
import { useLanguage } from "@/lib/i18n";

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

interface Line {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
}

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { locale } = useCurrency();
  const { containerRef: formRef, focusNextFocusable } = useEnterToTab();
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { accountId: "", description: "", debit: "", credit: "" },
    { accountId: "", description: "", debit: "", credit: "" },
  ]);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts)
      .catch(() => toast.error(t("accounting.failedToLoadAccounts")));
  }, []);

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => {
    setLines([...lines, { accountId: "", description: "", debit: "", credit: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof Line, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    // Clear opposite field when entering a value
    if (field === "debit" && value) updated[index].credit = "";
    if (field === "credit" && value) updated[index].debit = "";
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isBalanced) {
      toast.error(t("accounting.debitsEqualCredits"));
      return;
    }

    const validLines = lines.filter((l) => l.accountId && (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0));
    if (validLines.length < 2) {
      toast.error(t("accounting.atLeastTwoLines"));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          lines: validLines.map((l) => ({
            accountId: l.accountId,
            description: l.description || null,
            debit: parseFloat(l.debit) || 0,
            credit: parseFloat(l.credit) || 0,
          })),
          status: "POSTED",
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create");
      }

      setIsDirty(false);
      toast.success(t("accounting.journalEntryCreated"));
      router.push("/accounting/journal-entries");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accounting.failedToCreateJournalEntry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <Link href="/accounting/journal-entries">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("accounting.newJournalEntry")}</h2>
            <p className="text-slate-500">{t("accounting.createManualJournalEntry")}</p>
          </div>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChangeCapture={() => setIsDirty(true)}>
          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.entryDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("common.date")} *</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("common.description")} *</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("accounting.journalEntryDescPlaceholder")}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-base font-semibold">{t("accounting.lines")}</Label>
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={addLine}>
                    <Plus className="mr-2 h-3 w-3" />
                    {t("accounting.addLine")}
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="hidden grid-cols-[1fr_1fr_120px_120px_40px] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
                    <span>{t("common.account")}</span>
                    <span>{t("common.description")}</span>
                    <span className="text-right">{t("accounting.debit")}</span>
                    <span className="text-right">{t("accounting.credit")}</span>
                    <span />
                  </div>

                  {lines.map((line, index) => (
                    <div key={index}>
                      <div className="hidden grid-cols-[1fr_1fr_120px_120px_40px] items-center gap-2 sm:grid">
                        <Combobox
                          items={accounts}
                          value={line.accountId}
                          onValueChange={(v) => updateLine(index, "accountId", v)}
                          getId={(a) => a.id}
                          getLabel={(a) => `${a.code} - ${a.name}`}
                          filterFn={(a, query) =>
                            a.code.toLowerCase().includes(query.toLowerCase()) ||
                            a.name.toLowerCase().includes(query.toLowerCase())
                          }
                          placeholder={t("accounting.selectAccount")}
                          onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                        />

                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(index, "description", e.target.value)
                          }
                          placeholder={t("accounting.lineDescPlaceholder")}
                        />

                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debit}
                          onChange={(e) =>
                            updateLine(index, "debit", e.target.value)
                          }
                          placeholder="0.00"
                          className="text-right"
                        />

                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.credit}
                          onChange={(e) =>
                            updateLine(index, "credit", e.target.value)
                          }
                          placeholder="0.00"
                          className="text-right"
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 2}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="rounded-lg border border-slate-200 p-3 sm:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <Label className="text-sm font-semibold">{t("accounting.lineNumber")} {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 2}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="mt-3 space-y-3">
                          <div className="grid gap-2">
                            <Label className="text-xs text-slate-500">{t("common.account")}</Label>
                            <Combobox
                              items={accounts}
                              value={line.accountId}
                              onValueChange={(v) => updateLine(index, "accountId", v)}
                              getId={(a) => a.id}
                              getLabel={(a) => `${a.code} - ${a.name}`}
                              filterFn={(a, query) =>
                                a.code.toLowerCase().includes(query.toLowerCase()) ||
                                a.name.toLowerCase().includes(query.toLowerCase())
                              }
                              placeholder={t("accounting.selectAccount")}
                              onSelectFocusNext={(triggerRef) => focusNextFocusable(triggerRef)}
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label className="text-xs text-slate-500">{t("common.description")}</Label>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              placeholder={t("accounting.lineDescPlaceholder")}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                              <Label className="text-xs text-slate-500">{t("accounting.debit")}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.debit}
                                onChange={(e) => updateLine(index, "debit", e.target.value)}
                                placeholder="0.00"
                                className="text-right"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label className="text-xs text-slate-500">{t("accounting.credit")}</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.credit}
                                onChange={(e) => updateLine(index, "credit", e.target.value)}
                                placeholder="0.00"
                                className="text-right"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="hidden grid-cols-[1fr_1fr_120px_120px_40px] gap-2 border-t pt-3 font-semibold sm:grid">
                    <span />
                    <span className="text-right">{t("common.totals")}:</span>
                    <span className="text-right font-mono">
                      {totalDebit.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-right font-mono">
                      {totalCredit.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span />
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 sm:hidden">
                    <div className="flex items-center justify-between text-sm font-semibold">
                      <span>{t("accounting.totalDebit")}</span>
                      <span className="font-mono">
                        {totalDebit.toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm font-semibold">
                      <span>{t("accounting.totalCredit")}</span>
                      <span className="font-mono">
                        {totalCredit.toLocaleString(locale, {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {!isBalanced && totalDebit + totalCredit > 0 && (
                    <p className="text-sm text-red-600">
                      {t("accounting.difference")}: {Math.abs(totalDebit - totalCredit).toLocaleString(locale, { minimumFractionDigits: 2 })} — {t("accounting.debitsEqualCredits")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Link href="/accounting/journal-entries">
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    {t("common.cancel")}
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isSubmitting || !isBalanced || totalDebit === 0}
                >
                  {isSubmitting ? t("accounting.posting") : t("accounting.postJournal")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </PageAnimation>
  );
}
