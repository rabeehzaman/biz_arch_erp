"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttachmentDialog } from "@/components/attachments/attachment-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Copy, Edit, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrency } from "@/hooks/use-currency";
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
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOffAmount: number;
  applyRoundOff: boolean;
  total: number;
  reason: string | null;
  notes: string | null;
  appliedToBalance: boolean;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitCost: number;
    discount: number;
    total: number;
    product: {
      id: string;
      name: string;
      sku: string | null;
    };
  }[];
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
}

export default function DebitNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { symbol, locale } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    fetchDebitNote();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDebitNote = async () => {
    try {
      const response = await fetch(`/api/debit-notes/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setDebitNote(data);
    } catch (error) {
      toast.error(t("debitNotes.failedToLoad"));
      console.error("Failed to fetch debit note:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: t("accounting.deleteDebitNote"),
      description: t("debitNotes.deleteConfirmDesc"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/debit-notes/${params.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          router.push("/debit-notes");
        } catch (error) {
          toast.error(t("debitNotes.failedToDelete"));
          console.error("Failed to delete debit note:", error);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t("debitNotes.loadingDebitNote")}</p>
        </div>
      </div>
    );
  }

  if (!debitNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t("debitNotes.notFound")}</p>
          <Link href="/debit-notes" className="mt-4 inline-block">
            <Button variant="outline">{t("debitNotes.backToDebitNotes")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
            <Link href="/debit-notes">
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:size-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                {debitNote.debitNoteNumber}
              </h2>
              <p className="text-sm text-slate-500">{t("debitNotes.debitNoteDetails")}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href={`/debit-notes/${debitNote.id}/edit`} className="col-span-1 sm:w-auto">
              <Button variant="outline" size="sm" className="h-9 w-full sm:h-10 sm:w-auto">
                <Edit className="h-4 w-4 sm:mr-2" />
                {t("common.edit")}
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => router.push(`/debit-notes/new?duplicate=${debitNote.id}`)} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              <Copy className="h-4 w-4 sm:mr-2" />
              {t("common.duplicate")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              {t("common.delete")}
            </Button>
            <AttachmentDialog documentType="debit_note" documentId={debitNote.id} />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.supplierInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm text-slate-500">{t("suppliers.supplierName")}</div>
                <Link href={`/suppliers/${debitNote.supplier.id}`} className="font-medium hover:underline">{debitNote.supplier.name}</Link>
              </div>
              {debitNote.supplier.email && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.email")}</div>
                  <div className="font-medium">{debitNote.supplier.email}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("debitNotes.debitNoteInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm text-slate-500">{t("sales.issueDate")}</div>
                <div className="font-medium">
                  {format(new Date(debitNote.issueDate), "dd MMMM yyyy")}
                </div>
              </div>
              {debitNote.purchaseInvoice && (
                <div>
                  <div className="text-sm text-slate-500">
                    {t("debitNotes.originalPurchaseInvoice")}
                  </div>
                  <Link
                    href={`/purchase-invoices/${debitNote.purchaseInvoice.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {debitNote.purchaseInvoice.purchaseInvoiceNumber}
                  </Link>
                </div>
              )}
              {debitNote.reason && (
                <div>
                  <div className="text-sm text-slate-500">{t("debitNotes.reason")}</div>
                  <div className="font-medium">{debitNote.reason}</div>
                </div>
              )}
              {debitNote.branch && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.branch")}</div>
                  <div className="font-medium">{debitNote.branch.name}</div>
                </div>
              )}
              {debitNote.warehouse && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.warehouse")}</div>
                  <div className="font-medium">{debitNote.warehouse.name}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("sales.items")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.description")}</TableHead>
                    <TableHead className="text-right">{t("common.quantity")}</TableHead>
                    <TableHead className="text-right">{t("common.unitCost")}</TableHead>
                    <TableHead className="text-right">{t("common.discount")}</TableHead>
                    <TableHead className="text-right">{t("common.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debitNote.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product?.id ? <Link href={`/products/${item.product.id}`} className="hover:underline">{item.description}</Link> : item.description}</div>
                          {item.product?.sku && (
                            <div className="text-sm text-slate-500">
                              {t("products.sku")}: {item.product.sku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {symbol}{Number(item.unitCost).toLocaleString(locale)}
                      </TableCell>
                      <TableCell className="text-right">{item.discount}%</TableCell>
                      <TableCell className="text-right font-medium">
                        {symbol}{Number(item.total).toLocaleString(locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="sm:hidden divide-y divide-slate-200 border rounded-lg">
              {debitNote.items.map((item) => (
                <div key={item.id} className="p-3 space-y-1">
                  <div className="font-medium text-sm">{item.product?.id ? <Link href={`/products/${item.product.id}`} className="hover:underline">{item.description}</Link> : item.description}</div>
                  {item.product?.sku && (
                    <div className="text-xs text-slate-500">{t("products.sku")}: {item.product.sku}</div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{t("common.qty")}: {item.quantity}</span>
                    <span>{t("common.cost")}: {symbol}{Number(item.unitCost).toLocaleString(locale)}</span>
                    {Number(item.discount) > 0 && (
                      <span className="text-green-600">{t("common.discount")}: {item.discount}%</span>
                    )}
                  </div>
                  <div className="text-right font-semibold text-sm">
                    {symbol}{Number(item.total).toLocaleString(locale)}
                  </div>
                </div>
              ))}
            </div>

            <div className="ml-auto mt-4 max-w-full space-y-2 sm:max-w-xs">
              <div className="flex justify-between text-sm">
                <span>{t("common.subtotal")}:</span>
                <span>{symbol}{Number(debitNote.subtotal).toLocaleString(locale)}</span>
              </div>
              {Number(debitNote.totalCgst) > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t("common.cgst")}:</span>
                  <span>{symbol}{Number(debitNote.totalCgst).toLocaleString(locale)}</span>
                </div>
              )}
              {Number(debitNote.totalSgst) > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t("common.sgst")}:</span>
                  <span>{symbol}{Number(debitNote.totalSgst).toLocaleString(locale)}</span>
                </div>
              )}
              {Number(debitNote.totalIgst) > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t("common.igst")}:</span>
                  <span>{symbol}{Number(debitNote.totalIgst).toLocaleString(locale)}</span>
                </div>
              )}
              {Number(debitNote.totalCgst) === 0 && Number(debitNote.totalSgst) === 0 && Number(debitNote.totalIgst) === 0 && Number(debitNote.taxAmount) > 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t("common.tax")}:</span>
                  <span>{symbol}{Number(debitNote.taxAmount).toLocaleString(locale)}</span>
                </div>
              )}
              {debitNote.applyRoundOff && Number(debitNote.roundOffAmount) !== 0 && (
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{t("common.roundOff")}:</span>
                  <span>
                    {Number(debitNote.roundOffAmount) >= 0 ? "+" : ""}
                    {symbol}{Number(debitNote.roundOffAmount).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>{t("common.total")}:</span>
                <span className="text-orange-600">
                  {symbol}{Number(debitNote.total).toLocaleString(locale)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {debitNote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>{t("common.notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap">{debitNote.notes}</p>
            </CardContent>
          </Card>
        )}
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
