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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation, StaggerContainer, StaggerItem } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();

  const formatAmount = (amount: number) => {
    if (lang === "ar") return `${amount.toLocaleString("ar-SA", { minimumFractionDigits: 0 })} ر.س`;
    return `₹${amount.toLocaleString("en-IN")}`;
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices");
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("sales.deleteInvoice"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          fetchInvoices();
          toast.success(t("sales.invoiceDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete invoice:", error);
        }
      },
    });
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              ) : filteredInvoices.length === 0 ? (
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("sales.invoiceNumber")}</TableHead>
                      <TableHead>{t("sales.customer")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("sales.issueDate")}</TableHead>
                      <TableHead className="hidden sm:table-cell">{t("sales.dueDate")}</TableHead>
                      <TableHead className="text-right">{t("common.total")}</TableHead>
                      <TableHead className="text-right">{t("common.balance")}</TableHead>
                      <TableHead className="text-right">{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
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
                        <TableCell className="text-right">
                          {formatAmount(Number(invoice.total))}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              Number(invoice.balanceDue) > 0
                                ? "text-red-600 font-medium"
                                : "text-green-600"
                            }
                          >
                            {formatAmount(Number(invoice.balanceDue))}
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
