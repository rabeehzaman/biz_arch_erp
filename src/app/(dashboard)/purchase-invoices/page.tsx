"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Search, Receipt, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TableSkeleton } from "@/components/table-skeleton";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useLanguage } from "@/lib/i18n";
import { useCurrency } from "@/hooks/use-currency";

interface PurchaseInvoice {
  id: string;
  purchaseInvoiceNumber: string;
  supplier: {
    id: string;
    name: string;
    email: string | null;
  };
  invoiceDate: string;
  dueDate: string;
  status: string;
  supplierInvoiceRef: string | null;
  total: number;
  balanceDue: number;
  _count: {
    items: number;
  };
}

const statusColors: Record<string, string> = {
  DRAFT: "secondary",
  RECEIVED: "default",
  PAID: "default",
  PARTIALLY_PAID: "default",
  CANCELLED: "secondary",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  PAID: "Paid",
  PARTIALLY_PAID: "Partial",
  CANCELLED: "Cancelled",
};

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { t, lang } = useLanguage();
  const { fmt } = useCurrency();

  useEffect(() => {
    fetchInvoices();
    // Refresh when the status filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchInvoices = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/purchase-invoices?${params}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      toast.error(t("common.error"));
      console.error("Failed to fetch purchase invoices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      title: t("purchases.deletePurchaseInvoice"),
      description: t("common.deleteConfirm"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/purchase-invoices/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error("Failed to delete");
          fetchInvoices();
          toast.success(t("purchases.purchaseInvoiceDeleted"));
        } catch (error) {
          toast.error(t("common.error"));
          console.error("Failed to delete purchase invoice:", error);
        }
      },
    });
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.purchaseInvoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.supplierInvoiceRef?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t("purchases.purchaseInvoices")}</h2>
            <p className="text-slate-500">{lang === "ar" ? "إدارة المشتريات من الموردين" : "Manage purchases from suppliers"}</p>
          </div>
          <Link href="/purchase-invoices/new" className="w-full sm:w-auto">
            <Button className="w-full">
              <Plus className={`h-4 w-4 ${lang === "ar" ? "ml-2" : "mr-2"}`} />
              {t("purchases.newPurchase")}
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={lang === "ar" ? "بحث في المشتريات..." : "Search purchases..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={8} rows={5} />
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Receipt className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold">{t("purchases.noPurchaseInvoices")}</h3>
                <p className="text-sm text-slate-500">
                  {searchQuery || statusFilter !== "all"
                    ? t("common.noMatchFound")
                    : t("purchases.noPurchaseInvoicesDesc")}
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Link href="/purchase-invoices/new" className="mt-4">
                    <Button variant="outline">{t("purchases.newPurchase")}</Button>
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {filteredInvoices.map((invoice) => (
                    <div key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            {t("purchases.purchaseInvoiceNumber")}
                          </p>
                          <p className="mt-1 font-semibold text-slate-900">{invoice.purchaseInvoiceNumber}</p>
                        </div>
                        <Badge variant={statusColors[invoice.status] as "default" | "secondary" | "destructive"}>
                          {statusLabels[invoice.status]}
                        </Badge>
                      </div>

                      <div className="mt-4 min-w-0">
                        <p className="font-medium text-slate-900">{invoice.supplier.name}</p>
                        {invoice.supplier.email && (
                          <p className="mt-1 break-all text-sm text-slate-500">{invoice.supplier.email}</p>
                        )}
                        {invoice.supplierInvoiceRef && (
                          <p className="mt-2 text-sm text-slate-500">
                            {lang === "ar" ? "مرجع المورد" : "Supplier Ref"}: {invoice.supplierInvoiceRef}
                          </p>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.date")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("sales.dueDate")}</p>
                          <p className="mt-1 font-medium text-slate-900">
                            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.total")}</p>
                          <p className="mt-1 font-semibold text-slate-900">{fmt(Number(invoice.total))}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{t("common.balance")}</p>
                          <p className={`mt-1 font-semibold ${Number(invoice.balanceDue) > 0 ? "text-orange-600" : "text-green-600"}`}>
                            {fmt(Number(invoice.balanceDue))}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button asChild variant="outline" className="min-h-[44px] flex-1">
                          <Link href={`/purchase-invoices/${invoice.id}`}>
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
                  ))}
                </div>

                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("purchases.purchaseInvoiceNumber")}</TableHead>
                        <TableHead>{t("suppliers.supplier")}</TableHead>
                        <TableHead>{lang === "ar" ? "مرجع المورد" : "Supplier Ref"}</TableHead>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead>{t("sales.dueDate")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                        <TableHead className="text-right">{t("common.balance")}</TableHead>
                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.purchaseInvoiceNumber}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{invoice.supplier.name}</div>
                              {invoice.supplier.email && (
                                <div className="text-sm text-slate-500">
                                  {invoice.supplier.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {invoice.supplierInvoiceRef || "-"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.invoiceDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusColors[invoice.status] as "default" | "secondary" | "destructive"}>
                              {statusLabels[invoice.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {fmt(Number(invoice.total))}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                Number(invoice.balanceDue) > 0
                                  ? "text-orange-600 font-medium"
                                  : "text-green-600"
                              }
                            >
                              {fmt(Number(invoice.balanceDue))}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link href={`/purchase-invoices/${invoice.id}`}>
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
              </>
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
