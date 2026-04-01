"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, FileText, ShoppingCart, Receipt, ArrowRightLeft, Settings2 } from "lucide-react";

interface TransactionsData {
  salesInvoices: Array<{ id: string; invoiceId: string; invoiceNumber: string; issueDate: string; customerName: string; quantity: number; unitPrice: number; total: number }>;
  purchaseInvoices: Array<{ id: string; purchaseInvoiceId: string; purchaseInvoiceNumber: string; invoiceDate: string; supplierName: string; quantity: number; unitCost: number; total: number }>;
  creditNotes: Array<{ id: string; creditNoteId: string; creditNoteNumber: string; issueDate: string; quantity: number; unitPrice: number; total: number }>;
  debitNotes: Array<{ id: string; debitNoteId: string; debitNoteNumber: string; issueDate: string; quantity: number; unitCost: number; total: number }>;
  stockTransfers: Array<{ id: string; stockTransferId: string; transferNumber: string; transferDate: string; sourceWarehouse: string; destinationWarehouse: string; quantity: number }>;
  inventoryAdjustments: Array<{ id: string; adjustmentId: string; adjustmentNumber: string; adjustmentDate: string; adjustmentType: string; quantity: number; unitCost: number; reason: string | null }>;
}

export function ProductTransactionsTab({ productId }: { productId: string }) {
  const { t } = useLanguage();
  const { fmt } = useCurrency();
  const router = useRouter();
  const [data, setData] = useState<TransactionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    salesInvoices: true, purchaseInvoices: false, creditNotes: false,
    debitNotes: false, stockTransfers: false, inventoryAdjustments: false,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(`/api/products/${productId}/transactions`);
        if (!res.ok) throw new Error("Failed to fetch");
        setData(await res.json());
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, [productId]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!data) return null;

  const sections = [
    { key: "salesInvoices", label: t("productDetail.salesInvoices"), icon: FileText, count: data.salesInvoices.length },
    { key: "purchaseInvoices", label: t("productDetail.purchaseInvoices"), icon: ShoppingCart, count: data.purchaseInvoices.length },
    { key: "creditNotes", label: t("productDetail.creditNotes"), icon: Receipt, count: data.creditNotes.length },
    { key: "debitNotes", label: t("productDetail.debitNotes"), icon: FileText, count: data.debitNotes.length },
    { key: "stockTransfers", label: t("productDetail.stockTransfers"), icon: ArrowRightLeft, count: data.stockTransfers.length },
    { key: "inventoryAdjustments", label: t("productDetail.inventoryAdjustments"), icon: Settings2, count: data.inventoryAdjustments.length },
  ];

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader className="cursor-pointer py-4" onClick={() => toggleSection(section.key)}>
            <div className="flex items-center gap-3">
              {openSections[section.key] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
              <section.icon className="h-4 w-4 text-slate-500" />
              <CardTitle className="text-base">{section.label}</CardTitle>
              <Badge variant="secondary" className="text-xs">{section.count}</Badge>
            </div>
          </CardHeader>
          {openSections[section.key] && (
            <CardContent className="pt-0">
              {section.key === "salesInvoices" && <SalesTable items={data.salesInvoices} fmt={fmt} t={t} onRowClick={(id) => router.push(`/invoices/${id}`)} />}
              {section.key === "purchaseInvoices" && <PurchaseTable items={data.purchaseInvoices} fmt={fmt} t={t} onRowClick={(id) => router.push(`/purchase-invoices/${id}`)} />}
              {section.key === "creditNotes" && <CreditNoteTable items={data.creditNotes} fmt={fmt} t={t} onRowClick={(id) => router.push(`/credit-notes/${id}`)} />}
              {section.key === "debitNotes" && <DebitNoteTable items={data.debitNotes} fmt={fmt} t={t} onRowClick={(id) => router.push(`/debit-notes/${id}`)} />}
              {section.key === "stockTransfers" && <TransferTable items={data.stockTransfers} t={t} />}
              {section.key === "inventoryAdjustments" && <AdjustmentTable items={data.inventoryAdjustments} fmt={fmt} t={t} />}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function EmptySection({ t }: { t: (k: string) => string }) {
  return <p className="py-6 text-center text-sm text-slate-400">{t("productDetail.noTransactions")}</p>;
}

function SalesTable({ items, fmt, t, onRowClick }: { items: TransactionsData["salesInvoices"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {items.map((item) => (
          <div key={item.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(item.invoiceId)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium text-blue-600">{item.invoiceNumber}</span>
              <span className="font-semibold">{fmt(item.total)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{format(new Date(item.issueDate), "dd MMM yyyy")}</span>
              <span>{item.customerName}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(item.invoiceId)}>
                <TableCell>{format(new Date(item.issueDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono text-blue-600">{item.invoiceNumber}</TableCell>
                <TableCell>{item.customerName}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{fmt(item.unitPrice)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function PurchaseTable({ items, fmt, t, onRowClick }: { items: TransactionsData["purchaseInvoices"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {items.map((item) => (
          <div key={item.id} className="cursor-pointer rounded-lg border p-3" onClick={() => onRowClick(item.purchaseInvoiceId)}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-medium">{item.purchaseInvoiceNumber}</span>
              <span className="font-semibold">{fmt(item.total)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>{format(new Date(item.invoiceDate), "dd MMM yyyy")}</span>
              <span>{item.supplierName}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(item.purchaseInvoiceId)}>
                <TableCell>{format(new Date(item.invoiceDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-mono">{item.purchaseInvoiceNumber}</TableCell>
                <TableCell>{item.supplierName}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{fmt(item.unitCost)}</TableCell>
                <TableCell className="text-right font-medium">{fmt(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function CreditNoteTable({ items, fmt, t, onRowClick }: { items: TransactionsData["creditNotes"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow><TableHead>{t("common.date")}</TableHead><TableHead>#</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">{t("common.total")}</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(item.creditNoteId)}>
              <TableCell>{format(new Date(item.issueDate), "dd MMM yyyy")}</TableCell>
              <TableCell className="font-mono">{item.creditNoteNumber}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right font-medium">{fmt(item.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DebitNoteTable({ items, fmt, t, onRowClick }: { items: TransactionsData["debitNotes"]; fmt: (v: number) => string; t: (k: string) => string; onRowClick: (id: string) => void }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow><TableHead>{t("common.date")}</TableHead><TableHead>#</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">{t("common.total")}</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onRowClick(item.debitNoteId)}>
              <TableCell>{format(new Date(item.issueDate), "dd MMM yyyy")}</TableCell>
              <TableCell className="font-mono">{item.debitNoteNumber}</TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right font-medium">{fmt(item.total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TransferTable({ items, t }: { items: TransactionsData["stockTransfers"]; t: (k: string) => string }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow><TableHead>{t("common.date")}</TableHead><TableHead>#</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{format(new Date(item.transferDate), "dd MMM yyyy")}</TableCell>
              <TableCell className="font-mono">{item.transferNumber}</TableCell>
              <TableCell>{item.sourceWarehouse}</TableCell>
              <TableCell>{item.destinationWarehouse}</TableCell>
              <TableCell className="text-right font-medium">{item.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdjustmentTable({ items, fmt, t }: { items: TransactionsData["inventoryAdjustments"]; fmt: (v: number) => string; t: (k: string) => string }) {
  if (items.length === 0) return <EmptySection t={t} />;
  return (
    <div className="hidden sm:block">
      <Table>
        <TableHeader><TableRow><TableHead>{t("common.date")}</TableHead><TableHead>#</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{format(new Date(item.adjustmentDate), "dd MMM yyyy")}</TableCell>
              <TableCell className="font-mono">{item.adjustmentNumber}</TableCell>
              <TableCell><Badge variant={item.adjustmentType === "INCREASE" ? "success" : "destructive"} className="text-xs">{item.adjustmentType}</Badge></TableCell>
              <TableCell className="text-right">{item.quantity}</TableCell>
              <TableCell className="text-right">{fmt(item.unitCost)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
