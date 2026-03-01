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
import { Plus, Search, FileText, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

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
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();

  const formatAmount = (amount: number) => {
    if (lang === "ar") return `${amount.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ر.س`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  useEffect(() => {
    fetchCreditNotes();
  }, []);

  const fetchCreditNotes = async () => {
    try {
      const response = await fetch("/api/credit-notes");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCreditNotes(data);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch credit notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
          fetchCreditNotes();
          toast.success(t("accounting.creditNoteDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete credit note:", error);
        }
      },
    });
  };

  const filteredCreditNotes = creditNotes.filter(
    (cn) =>
      cn.creditNoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cn.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (cn.invoice?.invoiceNumber &&
        cn.invoice.invoiceNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("accounting.creditNotes")}</h2>
            <p className="text-slate-500">
              {lang === "ar" ? "إدارة مرتجعات المبيعات وائتمانات العملاء" : "Manage sales returns and customer credits"}
            </p>
          </div>
          <Link href="/credit-notes/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("accounting.newCreditNote")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={lang === "ar" ? "بحث في إشعارات الائتمان..." : "Search credit notes..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filteredCreditNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {lang === "ar" ? "لا توجد إشعارات ائتمان" : "No credit notes found"}
                </h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : lang === "ar" ? "أنشئ أول إشعار ائتمان" : "Create your first credit note to get started"}
                </p>
                {!searchQuery && (
                  <Link href="/credit-notes/new" className="mt-4">
                    <Button variant="outline">{t("accounting.newCreditNote")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "ar" ? "رقم إشعار الائتمان" : "CN #"}</TableHead>
                    <TableHead>{t("sales.customer")}</TableHead>
                    <TableHead>{t("sales.invoiceNumber")}</TableHead>
                    <TableHead>{t("sales.issueDate")}</TableHead>
                    <TableHead className="text-right">{t("common.total")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreditNotes.map((creditNote) => (
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
                        {formatAmount(Number(creditNote.total))}
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
            )}
          </CardContent>
        </Card>
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
