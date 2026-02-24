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
}

export default function CreditNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    fetchCreditNote();
  }, []);

  const fetchCreditNote = async () => {
    try {
      const response = await fetch(`/api/credit-notes/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setCreditNote(data);
    } catch (error) {
      toast.error("Failed to load credit note");
      console.error("Failed to fetch credit note:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setConfirmDialog({
      title: "Delete Credit Note",
      description: "Are you sure you want to delete this credit note? This will restore customer balance and remove stock lots.",
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/credit-notes/${params.id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete");
          toast.success("Credit note deleted");
          router.push("/credit-notes");
        } catch (error) {
          toast.error("Failed to delete credit note");
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
          <p className="text-slate-500">Loading credit note...</p>
        </div>
      </div>
    );
  }

  if (!creditNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Credit note not found</p>
          <Link href="/credit-notes" className="mt-4 inline-block">
            <Button variant="outline">Back to Credit Notes</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
        <PageAnimation>
          <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Link href="/credit-notes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {creditNote.creditNoteNumber}
                </h2>
                <p className="text-slate-500">Credit Note Details</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/credit-notes/${creditNote.id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-500">Customer Name</div>
                  <div className="font-medium">{creditNote.customer.name}</div>
                </div>
                {creditNote.customer.email && (
                  <div>
                    <div className="text-sm text-slate-500">Email</div>
                    <div className="font-medium">{creditNote.customer.email}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credit Note Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-500">Issue Date</div>
                  <div className="font-medium">
                    {format(new Date(creditNote.issueDate), "dd MMMM yyyy")}
                  </div>
                </div>
                {creditNote.invoice && (
                  <div>
                    <div className="text-sm text-slate-500">Original Invoice</div>
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
                    <div className="text-sm text-slate-500">Reason</div>
                    <div className="font-medium">{creditNote.reason}</div>
                  </div>
                )}
                {creditNote.createdBy && (
                  <div>
                    <div className="text-sm text-slate-500">Created By</div>
                    <div className="font-medium">{creditNote.createdBy.name}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
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
                              SKU: {item.product.sku}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        ₹{Number(item.unitPrice).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-right">{item.discount}%</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{Number(item.total).toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-2 max-w-xs ml-auto">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">
                    ₹{Number(creditNote.total).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {creditNote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
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
