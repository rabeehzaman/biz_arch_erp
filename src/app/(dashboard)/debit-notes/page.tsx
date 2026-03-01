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
import { Plus, Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

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
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();

  const formatAmount = (amount: number) => {
    if (lang === "ar") return `${amount.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ر.س`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  useEffect(() => {
    fetchDebitNotes();
  }, []);

  const fetchDebitNotes = async () => {
    try {
      const response = await fetch("/api/debit-notes");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setDebitNotes(data);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch debit notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
          fetchDebitNotes();
          toast.success(t("accounting.debitNoteDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete debit note:", error);
        }
      },
    });
  };

  const filteredDebitNotes = debitNotes.filter(
    (dn) =>
      dn.debitNoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dn.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dn.purchaseInvoice?.purchaseInvoiceNumber &&
        dn.purchaseInvoice.purchaseInvoiceNumber
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("accounting.debitNotes")}</h2>
            <p className="text-slate-500">
              {lang === "ar" ? "إدارة مرتجعات المشتريات ومديونيات الموردين" : "Manage purchase returns and supplier debits"}
            </p>
          </div>
          <Link href="/debit-notes/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("accounting.newDebitNote")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={lang === "ar" ? "بحث في إشعارات المدين..." : "Search debit notes..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : filteredDebitNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">
                  {lang === "ar" ? "لا توجد إشعارات مدين" : "No debit notes found"}
                </h3>
                <p className="text-sm text-slate-500">
                  {searchQuery
                    ? t("common.noMatchFound")
                    : lang === "ar" ? "أنشئ أول إشعار مدين" : "Create your first debit note to get started"}
                </p>
                {!searchQuery && (
                  <Link href="/debit-notes/new" className="mt-4">
                    <Button variant="outline">{t("accounting.newDebitNote")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "ar" ? "رقم إشعار المدين" : "DN #"}</TableHead>
                    <TableHead>{t("suppliers.supplier")}</TableHead>
                    <TableHead>{t("purchases.purchaseInvoiceNumber")}</TableHead>
                    <TableHead>{t("sales.issueDate")}</TableHead>
                    <TableHead className="text-right">{t("common.total")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebitNotes.map((debitNote) => (
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
                        {formatAmount(Number(debitNote.total))}
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
