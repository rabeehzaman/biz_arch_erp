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
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";

interface DebitNote {
  id: string;
  debitNoteNumber: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
  };
  purchaseInvoice: {
    id: string;
    purchaseInvoiceNumber: string;
  } | null;
  issueDate: string;
  total: number;
  reason: string | null;
  _count: {
    items: number;
  };
}

export default function DebitNotesPage() {
  const router = useRouter();
  const {
    items: debitNotes,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<DebitNote>({ url: "/api/debit-notes" });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("accounting.deleteDebitNote"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/debit-notes/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
          toast.success(t("accounting.debitNoteDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete debit note:", error);
        }
      },
    });
  };

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("debitNotes.title")}</h2>
            <p className="text-slate-500">
              {t("debitNotes.manageDebitNotes")}
            </p>
          </div>
          <Link href="/debit-notes/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("debitNotes.newDebitNote")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t("debitNotes.searchDebitNotes")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : debitNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {t("debitNotes.noDebitNotesFound")}
                </h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : t("debitNotes.noDebitNotesDesc")}
                </p>
                {!searchQuery && (
                  <Link href="/debit-notes/new" className="mt-4">
                    <Button variant="outline">{t("debitNotes.newDebitNote")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {debitNotes.map((debitNote) => (
                    <div key={debitNote.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("debitNotes.dnNo")}
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{debitNote.debitNoteNumber}</p>
                        </div>
                        <p className="text-sm font-semibold text-orange-600">{fmt(Number(debitNote.total))}</p>
                      </div>

                      <div className="mt-4 min-w-0">
                        <p className="font-medium text-slate-900">{debitNote.supplier.name}</p>
                        {debitNote.supplier.email && (
                          <p className="mt-1 break-all text-sm text-slate-500">{debitNote.supplier.email}</p>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("sales.issueDate")}
                          </p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(debitNote.issueDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("purchases.purchaseInvoiceNumber")}
                          </p>
                          {debitNote.purchaseInvoice ? (
                            <Link href={`/purchase-invoices/${debitNote.purchaseInvoice.id}`} className="mt-1 block font-medium text-blue-600 hover:underline">
                              {debitNote.purchaseInvoice.purchaseInvoiceNumber}
                            </Link>
                          ) : (
                            <p className="mt-1 font-medium text-slate-400">-</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button asChild variant="outline" className="min-h-[44px] flex-1">
                          <Link href={`/debit-notes/${debitNote.id}`}>
                            <Eye className="h-4 w-4" />
                            {t("common.details")}
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-[44px] flex-1 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(debitNote.id)}
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
                        <TableHead>{t("debitNotes.dnNo")}</TableHead>
                        <TableHead>{t("suppliers.supplier")}</TableHead>
                        <TableHead>{t("purchases.purchaseInvoiceNumber")}</TableHead>
                        <TableHead>{t("sales.issueDate")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debitNotes.map((debitNote) => (
                        <TableRow
                          key={debitNote.id}
                          onClick={() => router.push(`/debit-notes/${debitNote.id}`)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {debitNote.debitNoteNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {debitNote.supplier.name}
                              </div>
                              {debitNote.supplier.email && (
                                <div className="text-sm text-slate-500">
                                  {debitNote.supplier.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {debitNote.purchaseInvoice ? (
                              <Link
                                href={`/purchase-invoices/${debitNote.purchaseInvoice.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 hover:underline"
                              >
                                {debitNote.purchaseInvoice.purchaseInvoiceNumber}
                              </Link>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(debitNote.issueDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right text-orange-600 font-medium">
                            {fmt(Number(debitNote.total))}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Link href={`/debit-notes/${debitNote.id}`}>
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(debitNote.id)}
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
