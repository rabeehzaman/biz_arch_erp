"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

interface Quotation {
  id: string;
  quotationNumber: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
  };
  issueDate: string;
  validUntil: string;
  status: "SENT" | "CONVERTED" | "CANCELLED" | "EXPIRED";
  total: number;
  _count: {
    items: number;
  };
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  useEffect(() => {
    fetchQuotations();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQuotations = async () => {
    try {
      const response = await fetch("/api/quotations");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setQuotations(data);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch quotations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("quotations.quotationDeleted"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to delete");
          }
          fetchQuotations();
          toast.success(t("quotations.quotationDeleted"));
        } catch (error: any) {
          toast.error(error.message || t("common.error"));
          console.error("Failed to delete quotation:", error);
        }
      },
    });
  };

  const filteredQuotations = quotations.filter(
    (quotation) =>
      quotation.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quotation.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      SENT: "default",
      CONVERTED: "secondary",
      CANCELLED: "secondary",
      EXPIRED: "destructive",
    };

    const colors: Record<string, string> = {
      SENT: "bg-blue-500",
      CONVERTED: "bg-green-500",
      CANCELLED: "bg-gray-500",
      EXPIRED: "bg-red-500",
    };

    const statusLabels: Record<string, string> = {
      SENT: t("common.sent2"),
      CONVERTED: t("common.converted"),
      CANCELLED: t("common.cancelled"),
      EXPIRED: t("common.expired"),
    };

    return (
      <Badge variant={variants[status] || "default"} className={colors[status]}>
        {statusLabels[status] || status}
      </Badge>
    );
  };

  return (
    <PageAnimation>
      <StaggerContainer className="space-y-6">
        <StaggerItem className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("quotations.title")}</h2>
            <p className="text-slate-500">{t("quotations.manageQuotations")}</p>
          </div>
          <Link href="/quotations/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("quotations.newQuotation")}
            </Button>
          </Link>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <CardHeader>
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={t("quotations.searchQuotations")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton columns={7} rows={5} />
              ) : filteredQuotations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <h3 className="mt-4 text-lg font-semibold">{t("quotations.noQuotations")}</h3>
                  <p className="text-sm text-slate-500">
                    {searchQuery
                      ? t("common.noMatchFound")
                      : t("quotations.noQuotationsDesc")}
                  </p>
                  {!searchQuery && (
                    <Link href="/quotations/new" className="mt-4">
                      <Button variant="outline">{t("quotations.createQuotation")}</Button>
                    </Link>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-3 sm:hidden">
                    {filteredQuotations.map((quotation) => (
                      <div key={quotation.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("quotations.quotationNumber")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">{quotation.quotationNumber}</p>
                          </div>
                          {getStatusBadge(quotation.status)}
                        </div>

                        <div className="mt-4 min-w-0">
                          <p className="font-medium text-slate-900">{quotation.customer.name}</p>
                          {quotation.customer.email && (
                            <p className="mt-1 break-all text-sm text-slate-500">{quotation.customer.email}</p>
                          )}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("sales.issueDate")}
                            </p>
                            <p className="mt-1 font-medium text-slate-900">
                              {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("quotations.validUntil")}
                            </p>
                            <p className="mt-1 font-medium text-slate-900">
                              {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              {t("common.total")}
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">{fmt(Number(quotation.total))}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.items")}</p>
                            <p className="mt-1 font-medium text-slate-900">{quotation._count.items}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <Button asChild variant="outline" className="min-h-[44px] flex-1">
                            <Link href={`/quotations/${quotation.id}`}>
                              <Eye className="h-4 w-4" />
                              {t("common.details")}
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            className="min-h-[44px] flex-1 text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(quotation.id)}
                            disabled={quotation.status === "CONVERTED"}
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
                          <TableHead>{t("quotations.quotationNumber")}</TableHead>
                          <TableHead>{t("sales.customer")}</TableHead>
                          <TableHead>{t("sales.issueDate")}</TableHead>
                          <TableHead>{t("quotations.validUntil")}</TableHead>
                          <TableHead>{t("common.status")}</TableHead>
                          <TableHead className="text-right">{t("common.total")}</TableHead>
                          <TableHead className="text-right">{t("common.actions")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredQuotations.map((quotation) => (
                          <TableRow
                            key={quotation.id}
                            onClick={() => router.push(`/quotations/${quotation.id}`)}
                            className="cursor-pointer hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              {quotation.quotationNumber}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{quotation.customer.name}</div>
                                {quotation.customer.email && (
                                  <div className="text-sm text-slate-500">
                                    {quotation.customer.email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(quotation.issueDate), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>
                              {format(new Date(quotation.validUntil), "dd MMM yyyy")}
                            </TableCell>
                            <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                            <TableCell className="text-right">
                              {fmt(Number(quotation.total))}
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Link href={`/quotations/${quotation.id}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(quotation.id)}
                                disabled={quotation.status === "CONVERTED"}
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
