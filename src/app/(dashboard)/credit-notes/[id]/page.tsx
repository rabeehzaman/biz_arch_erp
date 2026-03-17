"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Edit, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageAnimation } from "@/components/ui/page-animation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCurrency } from "@/hooks/use-currency";
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
  subtotal: number;
  total: number;
  reason: string | null;
  notes: string | null;
  appliedToBalance: boolean;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    product: {
      id: string;
      name: string;
      sku: string | null;
    } | null;
  }[];
  createdBy: {
    id: string;
    name: string;
  } | null;
  branch?: { id: string; name: string; code: string } | null;
  warehouse?: { id: string; name: string; code: string } | null;
}

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const { symbol } = useCurrency();
  const { t } = useLanguage();

  useEffect(() => {
    fetchCreditNote();
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCreditNote = async () => {
    try {
      const response = await fetch(`/api/credit-notes/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCreditNote(data);
    } catch (error) {
      toast.error(t("creditNotes.failedToLoad"));
      console.error("Failed to fetch credit note:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: t("accounting.deleteCreditNote"),
      description: t("creditNotes.deleteConfirmDesc"),
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/credit-notes/${params.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          toast.success(t("creditNotes.creditNoteDeleted"));
          router.push("/credit-notes");
        } catch (error) {
          toast.error(t("creditNotes.failedToDelete"));
          console.error("Failed to delete credit note:", error);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t("creditNotes.loadingCreditNote")}</p>
        </div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">{t("creditNotes.notFound")}</p>
          <Link href="/credit-notes" className="mt-4 inline-block">
            <Button variant="outline">{t("creditNotes.backToCreditNotes")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageAnimation>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 sm:items-center sm:gap-4">
            <Link href="/credit-notes">
              <Button variant="ghost" size="icon-sm" className="shrink-0 sm:size-10">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900 sm:text-2xl">
                {creditNote.creditNoteNumber}
              </h2>
              <p className="text-sm text-slate-500">{t("creditNotes.creditNoteDetails")}</p>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href={`/credit-notes/${creditNote.id}/edit`} className="col-span-1 sm:w-auto">
              <Button variant="outline" size="sm" className="h-9 w-full sm:h-10 sm:w-auto">
                <Edit className="h-4 w-4 sm:mr-2" />
                {t("common.edit")}
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={handleDelete} className="col-span-1 h-9 w-full sm:h-10 sm:w-auto">
              <Trash2 className="h-4 w-4 sm:mr-2" />
              {t("common.delete")}
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.customerInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm text-slate-500">{t("customers.customerName")}</div>
                <div className="font-medium">{creditNote.customer.name}</div>
              </div>
              {creditNote.customer.email && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.email")}</div>
                  <div className="font-medium">{creditNote.customer.email}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("creditNotes.creditNoteInformation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm text-slate-500">{t("sales.issueDate")}</div>
                <div className="font-medium">
                  {format(new Date(creditNote.issueDate), "dd MMMM yyyy")}
                </div>
              </div>
              {creditNote.invoice && (
                <div>
                  <div className="text-sm text-slate-500">{t("creditNotes.originalInvoice")}</div>
                  <Link
                    href={`/invoices/${creditNote.invoice.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {creditNote.invoice.invoiceNumber}
                  </Link>
                </div>
              )}
              {creditNote.reason && (
                <div>
                  <div className="text-sm text-slate-500">{t("creditNotes.reason")}</div>
                  <div className="font-medium">{creditNote.reason}</div>
                </div>
              )}
              {creditNote.createdBy && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.createdBy")}</div>
                  <div className="font-medium">{creditNote.createdBy.name}</div>
                </div>
              )}
              {creditNote.branch && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.branch")}</div>
                  <div className="font-medium">{creditNote.branch.name}</div>
                </div>
              )}
              {creditNote.warehouse && (
                <div>
                  <div className="text-sm text-slate-500">{t("common.warehouse")}</div>
                  <div className="font-medium">{creditNote.warehouse.name}</div>
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
                    <TableHead className="text-right">{t("common.unitPrice")}</TableHead>
                    <TableHead className="text-right">{t("common.discount")}</TableHead>
                    <TableHead className="text-right">{t("common.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditNote.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.description}</div>
                          {item.product?.sku && (
                            <div className="text-sm text-slate-500">
                              {t("products.sku")}: {item.product.sku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {symbol}{Number(item.unitPrice).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">{item.discount}%</TableCell>
                      <TableCell className="text-right font-medium">
                        {symbol}{Number(item.total).toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="sm:hidden divide-y divide-slate-200 border rounded-lg">
              {creditNote.items.map((item) => (
                <div key={item.id} className="p-3 space-y-1">
                  <div className="font-medium text-sm">{item.description}</div>
                  {item.product?.sku && (
                    <div className="text-xs text-slate-500">{t("products.sku")}: {item.product.sku}</div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>{t("common.qty")}: {item.quantity}</span>
                    <span>{t("common.price")}: {symbol}{Number(item.unitPrice).toLocaleString("en-IN")}</span>
                    {Number(item.discount) > 0 && (
                      <span className="text-green-600">{t("common.discount")}: {item.discount}%</span>
                    )}
                  </div>
                  <div className="text-right font-semibold text-sm">
                    {symbol}{Number(item.total).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>

            <div className="ml-auto mt-4 max-w-full space-y-2 sm:max-w-xs">
              <div className="flex justify-between text-lg font-bold">
                <span>{t("common.total")}:</span>
                <span className="text-green-600">
                  {symbol}{Number(creditNote.total).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {creditNote.notes && (
          <Card>
            <CardHeader>
              <CardTitle>{t("common.notes")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap">{creditNote.notes}</p>
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
