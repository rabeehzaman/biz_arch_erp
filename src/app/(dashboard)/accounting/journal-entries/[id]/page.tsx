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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { useLanguage } from "@/lib/i18n";

interface JournalLine {
  id: string;
  account: { id: string; code: string; name: string };
  description: string | null;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  date: string;
  description: string;
  status: string;
  sourceType: string;
  sourceId: string | null;
  lines: JournalLine[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  POSTED: "bg-green-100 text-green-700",
  VOID: "bg-red-100 text-red-700",
};

export default function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { locale } = useCurrency();
  const { t } = useLanguage();
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"post" | "void" | null>(null);

  useEffect(() => {
    fetchEntry();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchEntry = async () => {
    try {
      const response = await fetch(`/api/journal-entries/${id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEntry(data);
    } catch {
      toast.error(t("accounting.failedToLoadJournalEntry"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async () => {
    if (!confirmAction || !entry) return;

    try {
      const response = await fetch(
        `/api/journal-entries/${entry.id}/${confirmAction}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Failed to ${confirmAction}`);
      }
      setConfirmAction(null);
      fetchEntry();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common.error")
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!entry) {
    return <p className="text-center py-8 text-slate-500">{t("accounting.entryNotFound")}</p>;
  }

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce(
    (sum, l) => sum + Number(l.credit),
    0
  );

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <Link href="/accounting/journal-entries">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {entry.journalNumber}
                </h2>
                <p className="text-slate-500">{entry.description}</p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Badge className={statusColors[entry.status]}>{entry.status}</Badge>
              {entry.status === "DRAFT" && (
                <Button onClick={() => setConfirmAction("post")} className="w-full sm:w-auto">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {t("accounting.post")}
                </Button>
              )}
              {entry.status === "POSTED" && entry.sourceType === "MANUAL" && (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmAction("void")}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {t("common.void")}
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.entryDetails")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <span className="text-slate-500">{t("common.date")}</span>
                  <p className="font-medium">
                    {format(new Date(entry.date), "dd MMM yyyy")}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t("common.source")}</span>
                  <p className="font-medium">{entry.sourceType}</p>
                </div>
                <div>
                  <span className="text-slate-500">{t("accounting.totalDebit")}</span>
                  <p className="font-medium font-mono">
                    {totalDebit.toLocaleString(locale, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">{t("accounting.totalCredit")}</span>
                  <p className="font-medium font-mono">
                    {totalCredit.toLocaleString(locale, {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("accounting.lines")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:hidden">
                {entry.lines.map((line) => (
                  <div key={line.id} className="rounded-lg border p-4 text-sm">
                    <div className="font-medium text-slate-900">
                      <span className="mr-2 font-mono text-slate-500">{line.account.code}</span>
                      {line.account.name}
                    </div>
                    <div className="mt-2 text-slate-600">{line.description || t("common.noDescription")}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">{t("accounting.debit")}</div>
                        <div className="font-medium text-slate-900">
                          {Number(line.debit) > 0
                            ? Number(line.debit).toLocaleString(locale, { minimumFractionDigits: 2 })
                            : "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-400">{t("accounting.credit")}</div>
                        <div className="font-medium text-slate-900">
                          {Number(line.credit) > 0
                            ? Number(line.credit).toLocaleString(locale, { minimumFractionDigits: 2 })
                            : "-"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("accounting.totalDebit")}</span>
                    <span className="font-semibold">
                      {totalDebit.toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-slate-500">{t("accounting.totalCredit")}</span>
                    <span className="font-semibold">
                      {totalCredit.toLocaleString(locale, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.account")}</TableHead>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("accounting.debit")}</TableHead>
                    <TableHead className="text-right">{t("accounting.credit")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <span className="font-mono text-slate-500 mr-2">
                          {line.account.code}
                        </span>
                        {line.account.name}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {line.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(line.debit) > 0
                          ? Number(line.debit).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(line.credit) > 0
                          ? Number(line.credit).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                            })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2} className="text-right">
                      {t("common.totals")}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totalDebit.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totalCredit.toLocaleString(locale, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <AlertDialog
            open={!!confirmAction}
            onOpenChange={() => setConfirmAction(null)}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmAction === "post"
                    ? t("accounting.postJournalEntry")
                    : t("accounting.voidJournalEntry")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmAction === "post"
                    ? t("accounting.postJournalEntryConfirm")
                    : t("accounting.voidJournalEntryConfirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAction}
                  className={
                    confirmAction === "void"
                      ? "bg-red-600 hover:bg-red-700"
                      : undefined
                  }
                >
                  {confirmAction === "post" ? t("accounting.postEntry") : t("accounting.voidEntry")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        </PageAnimation>
      );
}
