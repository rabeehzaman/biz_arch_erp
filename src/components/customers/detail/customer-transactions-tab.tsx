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
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string | null;
    total: number;
    balanceDue: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    paymentNumber: string;
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    invoice?: { invoiceNumber: string };
  }>;
  creditNotes: Array<{
    id: string;
    creditNoteNumber: string;
    issueDate: string;
    total: number;
  }>;
  quotations: Array<{
    id: string;
    quotationNumber: string;
    issueDate: string;
    validUntil: string | null;
    total: number;
    status: string;
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

export function CustomerTransactionsTab({ customerId }: { customerId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const router = useRouter();
  const [data, setData] = useState<TransactionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    invoices: true,
    payments: false,
    creditNotes: false,
    quotations: false,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}/transactions`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, [customerId]);

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
      key: "invoices",
      label: t("customerDetail.invoices"),
      icon: FileText,
      count: data.invoices.length,
      newLink: `/invoices/create?customerId=${customerId}`,
      newLabel: t("customerDetail.newInvoice"),
    },
    {
      key: "payments",
      label: t("customerDetail.payments"),
      icon: CreditCard,
      count: data.payments.length,
      newLink: `/payments/create?customerId=${customerId}`,
      newLabel: t("customerDetail.newPayment"),
    },
    {
      key: "creditNotes",
      label: t("customerDetail.creditNotes"),
      icon: Receipt,
      count: data.creditNotes.length,
      newLink: `/credit-notes/create?customerId=${customerId}`,
      newLabel: t("customerDetail.newCreditNote"),
    },
    {
      key: "quotations",
      label: t("customerDetail.quotations"),
      icon: ClipboardList,
      count: data.quotations.length,
      newLink: `/quotations/create?customerId=${customerId}`,
      newLabel: t("customerDetail.newQuotation"),
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
              {section.key === "invoices" && (
                <InvoicesTable
                  invoices={data.invoices}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/invoices/${id}`)}
                />
              )}
              {section.key === "payments" && (
                <PaymentsTable
                  payments={data.payments}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/payments/${id}`)}
                />
              )}
              {section.key === "creditNotes" && (
                <CreditNotesTable
                  creditNotes={data.creditNotes}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/credit-notes/${id}`)}
                />
              )}
              {section.key === "quotations" && (
                <QuotationsTable
                  quotations={data.quotations}
                  fmt={fmt}
                  t={t}
                  onRowClick={(id) => router.push(`/quotations/${id}`)}
                />
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function InvoicesTable({ invoices, fmt, t, onRowClick }: { invoices: TransactionsData["invoices"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (invoices.length === 0) return <EmptySection t={t} />;
  return (
    <>
      {/* Mobile */}
      <div className="space-y-3 sm:hidden">
        {invoices.map((inv) => (
          <div key={inv.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(inv.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium text-blue-600">{inv.invoiceNumber}</span>
              <StatusBadge status={inv.status} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
              <span>{format(new Date(inv.issueDate), "dd MMM yyyy")}</span>
              <span className="font-semibold text-slate-900">{fmt(inv.total)}</span>
            </div>
            {inv.balanceDue > 0 && (
              <p className="mt-1 text-xs text-red-600">{t("customerDetail.balanceDue")}: {fmt(inv.balanceDue)}</p>
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
              <TableHead>{t("customerDetail.invoiceNo")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
              <TableHead className="text-right">{t("customerDetail.balanceDue")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(inv.id)}>
                <TableCell>{format(new Date(inv.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono text-blue-600">{inv.invoiceNumber}</TableCell>
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
              <TableHead>{t("customerDetail.paymentNo")}</TableHead>
              <TableHead>{t("customerDetail.invoiceRef")}</TableHead>
              <TableHead>{t("customerDetail.paymentMethod")}</TableHead>
              <TableHead className="text-right">{t("common.amount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(p.id)}>
                <TableCell>{format(new Date(p.paymentDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{p.paymentNumber}</TableCell>
                <TableCell className="font-mono text-blue-600">{p.invoice?.invoiceNumber || "-"}</TableCell>
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

function CreditNotesTable({ creditNotes, fmt, t, onRowClick }: { creditNotes: TransactionsData["creditNotes"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (creditNotes.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {creditNotes.map((cn) => (
          <div key={cn.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(cn.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{cn.creditNoteNumber}</span>
              <span className="font-semibold">{fmt(cn.total)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{format(new Date(cn.issueDate), "dd MMM yyyy")}</p>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("customerDetail.creditNoteNo")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditNotes.map((cn) => (
              <TableRow key={cn.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(cn.id)}>
                <TableCell>{format(new Date(cn.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{cn.creditNoteNumber}</TableCell>
                <TableCell className="text-right font-medium">{fmt(cn.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function QuotationsTable({ quotations, fmt, t, onRowClick }: { quotations: TransactionsData["quotations"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (quotations.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {quotations.map((q) => (
          <div key={q.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(q.id)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{q.quotationNumber}</span>
              <StatusBadge status={q.status} />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{format(new Date(q.issueDate), "dd MMM yyyy")}</span>
              <span className="font-semibold text-slate-900">{fmt(q.total)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("customerDetail.quotationNo")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.map((q) => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(q.id)}>
                <TableCell>{format(new Date(q.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{q.quotationNumber}</TableCell>
                <TableCell className="text-right font-medium">{fmt(q.total)}</TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
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
    <p className="py-6 text-center text-sm text-slate-400">{t("customerDetail.noTransactions")}</p>
  );
}
