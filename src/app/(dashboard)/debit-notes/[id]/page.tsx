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
}

export default function DebitNoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDebitNote();
  }, []);

  const fetchDebitNote = async () => {
    try {
      const response = await fetch(`/api/debit-notes/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setDebitNote(data);
    } catch (error) {
      toast.error("Failed to load debit note");
      console.error("Failed to fetch debit note:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this debit note? This will restore supplier balance and restore stock."
      )
    )
      return;

    try {
      const response = await fetch(`/api/debit-notes/${params.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Debit note deleted");
      router.push("/debit-notes");
    } catch (error) {
      toast.error("Failed to delete debit note");
      console.error("Failed to delete debit note:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Loading debit note...</p>
        </div>
      </div>
    );
  }

  if (!debitNote) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Debit note not found</p>
          <Link href="/debit-notes" className="mt-4 inline-block">
            <Button variant="outline">Back to Debit Notes</Button>
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
              <Link href="/debit-notes">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {debitNote.debitNoteNumber}
                </h2>
                <p className="text-slate-500">Debit Note Details</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/debit-notes/${debitNote.id}/edit`}>
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
                <CardTitle>Supplier Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-500">Supplier Name</div>
                  <div className="font-medium">{debitNote.supplier.name}</div>
                </div>
                {debitNote.supplier.email && (
                  <div>
                    <div className="text-sm text-slate-500">Email</div>
                    <div className="font-medium">{debitNote.supplier.email}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Debit Note Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <div className="text-sm text-slate-500">Issue Date</div>
                  <div className="font-medium">
                    {format(new Date(debitNote.issueDate), "dd MMMM yyyy")}
                  </div>
                </div>
                {debitNote.purchaseInvoice && (
                  <div>
                    <div className="text-sm text-slate-500">
                      Original Purchase Invoice
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
                    <div className="text-sm text-slate-500">Reason</div>
                    <div className="font-medium">{debitNote.reason}</div>
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
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debitNote.items.map((item) => (
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
                        ₹{Number(item.unitCost).toLocaleString("en-IN")}
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
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>₹{Number(debitNote.subtotal).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax ({debitNote.taxRate}%):</span>
                  <span>₹{Number(debitNote.taxAmount).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-orange-600">
                    ₹{Number(debitNote.total).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {debitNote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 whitespace-pre-wrap">{debitNote.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
        </PageAnimation>
      );
}
