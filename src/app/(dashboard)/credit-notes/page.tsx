"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, FileText, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
  } | null;
  issueDate: string;
  total: number;
  reason: string | null;
  _count: {
    items: number;
  };
}

export default function CreditNotesPage() {
  const router = useRouter();
  const {
    items: creditNotes,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<CreditNote>({ url: "/api/credit-notes" });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("accounting.deleteCreditNote"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/credit-notes/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
          toast.success(t("accounting.creditNoteDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete credit note:", error);
        }
      },
    });
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("creditNotes.title")}</h2>
            <p className="text-slate-500">
              {t("creditNotes.manageCreditNotes")}
            </p>
          </div>
          <Link href="/credit-notes/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("creditNotes.newCreditNote")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t("creditNotes.searchCreditNotes")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : creditNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {t("creditNotes.noCreditNotesFound")}
                </h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : t("creditNotes.noCreditNotesDesc")}
                </p>
                {!searchQuery && (
                  <Link href="/credit-notes/new" className="mt-4">
                    <Button variant="outline">{t("creditNotes.newCreditNote")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {creditNotes.map((creditNote) => (
                    <div key={creditNote.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("creditNotes.cnNo")}
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{creditNote.creditNoteNumber}</p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">{fmt(Number(creditNote.total))}</p>
                      </div>

                      <div className="mt-4 min-w-0">
                        <p className="font-medium text-slate-900">{creditNote.customer.name}</p>
                        {creditNote.customer.email && (
                          <p className="mt-1 break-all text-sm text-slate-500">{creditNote.customer.email}</p>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("sales.issueDate")}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(creditNote.issueDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("sales.invoiceNumber")}
                          </p>
                          {creditNote.invoice ? (
                            <Link href={`/invoices/${creditNote.invoice.id}`} className="mt-1 block font-medium text-blue-600 hover:underline">
                              {creditNote.invoice.invoiceNumber}
                            </Link>
                          ) : (
                            <p className="mt-1 font-medium text-slate-400">-</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <Button asChild variant="outline" className="min-h-[44px]">
                          <Link href={`/credit-notes/${creditNote.id}`}>
                            <Eye className="h-4 w-4" />
                            {t("common.details")}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="min-h-[44px]">
                          <Link href={`/credit-notes/${creditNote.id}/edit`}>
                            <Edit className="h-4 w-4" />
                            {t("common.edit")}
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-[44px] text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(creditNote.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("creditNotes.cnNo")}</TableHead>
                        <TableHead>{t("sales.customer")}</TableHead>
                        <TableHead>{t("sales.invoiceNumber")}</TableHead>
                        <TableHead>{t("sales.issueDate")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditNotes.map((creditNote) => (
                        <TableRow
                          key={creditNote.id}
                          onClick={() => router.push(`/credit-notes/${creditNote.id}`)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {creditNote.creditNoteNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {creditNote.customer.name}
                              </div>
                              {creditNote.customer.email && (
                                <div className="text-sm text-slate-500">
                                  {creditNote.customer.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {creditNote.invoice ? (
                              <Link
                                href={`/invoices/${creditNote.invoice.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline"
                              >
                                {creditNote.invoice.invoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(creditNote.issueDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {fmt(Number(creditNote.total))}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/credit-notes/${creditNote.id}`}>
                              <Button variant="ghost" size="icon" title="View">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link href={`/credit-notes/${creditNote.id}/edit`}>
                              <Button variant="ghost" size="icon" title="Edit">
                                <Edit className="h-4 w-4 text-blue-500" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(creditNote.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
        <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
        {confirmDialog && (
          <ConfirmDialog
            open={!!confirmDialog}
            onOpenChange={(open) => !open && setConfirmDialog(null)}
            title={confirmDialog.title}
            description={confirmDialog.description}
            onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          />
        )}
      </div>
    </PageAnimation>
  );
}
