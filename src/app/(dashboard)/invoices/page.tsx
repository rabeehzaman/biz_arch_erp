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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { LoadMoreTrigger } from "@/components/load-more-trigger";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  issueDate: string;
  dueDate: string;
  total: number;
  balanceDue: number;
  _count: {
    items: number;
  };
}

function getInvoiceStatus(balanceDue: number, dueDate: string, t: (key: string) => string) {
  if (balanceDue <= 0) return { label: t("common.paid"), className: "bg-green-100 text-green-700" };
  if (new Date(dueDate) < new Date()) return { label: t("common.overdue"), className: "bg-red-100 text-red-700" };
  return { label: t("common.unpaid"), className: "bg-yellow-100 text-yellow-700" };
}

export default function InvoicesPage() {
  const router = useRouter();
  const {
    items: invoices,
    isLoading,
    isLoadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    loadMore,
    refresh,
  } = useInfiniteList<Invoice>({ url: "/api/invoices" });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("sales.deleteInvoice"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          refresh();
          toast.success(t("sales.invoiceDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete invoice:", error);
        }
      },
    });
  };

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("sales.invoices")}</h2>
            <p className="text-slate-500">{t("dashboard.createInvoiceDesc")}</p>
          </div>
          <Link href="/invoices/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("sales.newInvoice")}
            </Button>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t("sales.searchInvoices")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("sales.noInvoices")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noMatchFound")
                      : t("sales.noInvoicesDesc")}
                  </p>
                  {!searchQuery && (
                    <Link href="/invoices/new" className="mt-4">
                      <Button variant="outline">{t("sales.createInvoice")}</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {invoices.map((invoice) => {
                      const status = getInvoiceStatus(Number(invoice.balanceDue), invoice.dueDate, t);

                      return (
                        <div
                          key={invoice.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {invoice.invoiceNumber}
                              </p>
                              <p className="truncate text-sm text-slate-700">
                                {invoice.customer.name}
                              </p>
                              {invoice.customer.email && (
                                <p className="truncate text-xs text-slate-500">
                                  {invoice.customer.email}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {t("sales.issueDate")}
                              </p>
                              <p className="mt-1 font-medium text-slate-900">
                                {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {t("sales.dueDate")}
                              </p>
                              <p className="mt-1 font-medium text-slate-900">
                                {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {t("common.total")}
                              </p>
                              <p className="mt-1 font-medium text-slate-900">
                                {fmt(Number(invoice.total))}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {t("common.balance")}
                              </p>
                              <p
                                className={`mt-1 font-semibold ${
                                  Number(invoice.balanceDue) > 0 ? "text-red-600" : "text-green-600"
                                }`}
                              >
                                {fmt(Number(invoice.balanceDue))}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Button asChild variant="outline" className="min-h-[44px] flex-1">
                              <Link href={`/invoices/${invoice.id}`}>
                                <Eye className="h-4 w-4" />
                                {t("common.details")}
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              className="min-h-[44px] flex-1 text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("common.delete")}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("sales.invoiceNumber")}</TableHead>
                          <TableHead>{t("sales.customer")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("sales.issueDate")}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t("sales.dueDate")}</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">{t("common.total")}</TableHead>
                          <TableHead className="text-right">{t("common.balance")}</TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow
                            key={invoice.id}
                            onClick={() => router.push(`/invoices/${invoice.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              {invoice.invoiceNumber}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{invoice.customer.name}</div>
                                {invoice.customer.email && (
                                  <div className="text-sm text-slate-500">
                                    {invoice.customer.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const status = getInvoiceStatus(Number(invoice.balanceDue), invoice.dueDate, t);
                                return (
                                  <Badge variant="outline" className={status.className}>
                                    {status.label}
                                  </Badge>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {format(new Date(invoice.issueDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-right">
                              {fmt(Number(invoice.total))}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  Number(invoice.balanceDue) > 0
                                    ? "text-red-600 font-medium"
                                    : "text-green-600"
                                }
                              >
                                {fmt(Number(invoice.balanceDue))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Link href={`/invoices/${invoice.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(invoice.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <LoadMoreTrigger hasMore={hasMore} isLoadingMore={isLoadingMore} onLoadMore={loadMore} />
                </>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      </StaggerContainer>
      {confirmDialog && (
        <ConfirmDialog
          open={!!confirmDialog}
          onOpenChange={(open) => !open && setConfirmDialog(null)}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
    </PageAnimation>
  );
}
