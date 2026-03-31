"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Plus, FileText, CreditCard, Receipt, ClipboardList } from "lucide-react";
import Link from "next/link";

interface TransactionsData {
  purchaseInvoices: Array<{
    id: string;
    purchaseInvoiceNumber: string;
    issueDate: string;
    dueDate: string | null;
    total: number;
    balanceDue: number;
    status: string;
    supplierInvoiceRef: string | null;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    purchaseInvoice?: { purchaseInvoiceNumber: string };
  }>;
  debitNotes: Array<{
    id: string;
    debitNoteNumber: string;
    issueDate: string;
    total: number;
  }>;
  expenses: Array<{
    id: string;
    expenseDate: string;
    category: string;
    total: number;
    description: string | null;
  }>;
}

const statusColors: Record<string, string> = {
  PAID: "text-green-600 bg-green-50",
  PARTIAL: "text-amber-600 bg-amber-50",
  OVERDUE: "text-red-600 bg-red-50",
  UNPAID: "text-slate-600 bg-slate-50",
  SENT: "text-blue-600 bg-blue-50",
  DRAFT: "text-slate-500 bg-slate-50",
  ACCEPTED: "text-green-600 bg-green-50",
  DECLINED: "text-red-600 bg-red-50",
  EXPIRED: "text-orange-600 bg-orange-50",
};

export function SupplierTransactionsTab({ supplierId }: { supplierId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const router = useRouter();
  const [data, setData] = useState<TransactionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    purchaseInvoices: true,
    payments: false,
    debitNotes: false,
    expenses: false,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(`/api/suppliers/${supplierId}/transactions`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, [supplierId]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const sections = [
    {
      key: "purchaseInvoices",
      label: t("supplierDetail.purchaseInvoices"),
      icon: FileText,
      count: data.purchaseInvoices.length,
      newLink: `/purchase-invoices/create?supplierId=${supplierId}`,
      newLabel: t("supplierDetail.newPurchaseInvoice"),
    },
    {
      key: "payments",
      label: t("supplierDetail.payments"),
      icon: CreditCard,
      count: data.payments.length,
      newLink: `/supplier-payments/create?supplierId=${supplierId}`,
      newLabel: t("supplierDetail.newPayment"),
    },
    {
      key: "debitNotes",
      label: t("supplierDetail.debitNotes"),
      icon: Receipt,
      count: data.debitNotes.length,
      newLink: `/debit-notes/create?supplierId=${supplierId}`,
      newLabel: t("supplierDetail.newDebitNote"),
    },
    {
      key: "expenses",
      label: t("supplierDetail.expenses"),
      icon: ClipboardList,
      count: data.expenses.length,
      newLink: `/expenses/create?supplierId=${supplierId}`,
      newLabel: t("supplierDetail.newExpense"),
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader
            className="cursor-pointer py-4"
            onClick={() => toggleSection(section.key)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {openSections[section.key] ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                )}
                <section.icon className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-base">{section.label}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {section.count}
                </Badge>
              </div>
              <Link href={section.newLink} onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm">
                  <Plus className="mr-1 h-3 w-3" />
                  <span className="hidden sm:inline">{section.newLabel}</span>
                  <span className="sm:hidden">{t("common.new")}</span>
                </Button>
              </Link>
            </div>
          </CardHeader>
          {openSections[section.key] && (
            <CardContent className="pt-0">
              {section.key === "purchaseInvoices" && (
                <PurchaseInvoicesTable
                  purchaseInvoices={data.purchaseInvoices}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/purchase-invoices/${id}`)}
                />
              )}
              {section.key === "payments" && (
                <PaymentsTable
                  payments={data.payments}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/supplier-payments/${id}`)}
                />
              )}
              {section.key === "debitNotes" && (
                <DebitNotesTable
                  debitNotes={data.debitNotes}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/debit-notes/${id}`)}
                />
              )}
              {section.key === "expenses" && (
                <ExpensesTable
                  expenses={data.expenses}
                  fmt={fmt}
                  t={t}
                />
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function PurchaseInvoicesTable({ purchaseInvoices, fmt, t, onRowClick }: { purchaseInvoices: TransactionsData["purchaseInvoices"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (purchaseInvoices.length === 0) return <EmptySection t={t} />;
  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 sm:hidden">
        {purchaseInvoices.map((inv) => (
          <div key={inv.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(inv.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium text-blue-600">{inv.purchaseInvoiceNumber}</span>
              <StatusBadge status={inv.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
              <span>{format(new Date(inv.issueDate), "dd MMM yyyy")}</span>
              <span className="font-semibold text-slate-900">{fmt(inv.total)}</span>
            </div>
            {inv.balanceDue > 0 && (
              <p className="mt-1 text-xs text-red-600">{t("supplierDetail.balanceDue")}: {fmt(inv.balanceDue)}</p>
            )}
          </div>
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("supplierDetail.purchaseInvoiceNo")}</TableHead>
              <TableHead>{t("supplierDetail.supplierInvoiceRef")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
              <TableHead className="text-right">{t("supplierDetail.balanceDue")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseInvoices.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(inv.id)}>
                <TableCell>{format(new Date(inv.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono text-blue-600">{inv.purchaseInvoiceNumber}</TableCell>
                <TableCell className="text-slate-500">{inv.supplierInvoiceRef || "-"}</TableCell>
                <TableCell className="text-right">{fmt(inv.total)}</TableCell>
                <TableCell className="text-right text-red-600">{inv.balanceDue > 0 ? fmt(inv.balanceDue) : "-"}</TableCell>
                <TableCell><StatusBadge status={inv.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PaymentsTable({ payments, fmt, t, onRowClick }: { payments: TransactionsData["payments"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (payments.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {payments.map((p) => (
          <div key={p.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(p.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{p.paymentNumber}</span>
              <span className="font-semibold text-green-600">{fmt(p.amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{format(new Date(p.paymentDate), "dd MMM yyyy")}</span>
              <span>{p.paymentMethod}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("supplierDetail.paymentNo")}</TableHead>
              <TableHead>{t("supplierDetail.purchaseInvoiceRef")}</TableHead>
              <TableHead>{t("supplierDetail.paymentMethod")}</TableHead>
              <TableHead className="text-right">{t("common.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(p.id)}>
                <TableCell>{format(new Date(p.paymentDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{p.paymentNumber}</TableCell>
                <TableCell className="font-mono text-blue-600">{p.purchaseInvoice?.purchaseInvoiceNumber || "-"}</TableCell>
                <TableCell>{p.paymentMethod}</TableCell>
                <TableCell className="text-right font-medium text-green-600">{fmt(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function DebitNotesTable({ debitNotes, fmt, t, onRowClick }: { debitNotes: TransactionsData["debitNotes"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (debitNotes.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {debitNotes.map((dn) => (
          <div key={dn.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(dn.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{dn.debitNoteNumber}</span>
              <span className="font-semibold">{fmt(dn.total)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{format(new Date(dn.issueDate), "dd MMM yyyy")}</p>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("supplierDetail.debitNoteNo")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debitNotes.map((dn) => (
              <TableRow key={dn.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(dn.id)}>
                <TableCell>{format(new Date(dn.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{dn.debitNoteNumber}</TableCell>
                <TableCell className="text-right font-medium">{fmt(dn.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function ExpensesTable({ expenses, fmt, t }: { expenses: TransactionsData["expenses"]; fmt: (v: number) => string; t: (k: string) => string }) {
  if (expenses.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {expenses.map((exp) => (
          <div key={exp.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">{exp.category}</span>
              <span className="font-semibold">{fmt(exp.total)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{format(new Date(exp.expenseDate), "dd MMM yyyy")}</span>
              {exp.description && <span className="truncate ml-2">{exp.description}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("supplierDetail.category")}</TableHead>
              <TableHead>{t("common.description")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((exp) => (
              <TableRow key={exp.id}>
                <TableCell>{format(new Date(exp.expenseDate), "dd MMM yyyy")}</TableCell>
                <TableCell>{exp.category}</TableCell>
                <TableCell className="text-slate-500">{exp.description || "-"}</TableCell>
                <TableCell className="text-right font-medium">{fmt(exp.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || "text-slate-600 bg-slate-50";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  );
}

function EmptySection({ t }: { t: (k: string) => string }) {
  return (
    <p className="py-6 text-center text-sm text-slate-400">{t("supplierDetail.noTransactions")}</p>
  );
}
